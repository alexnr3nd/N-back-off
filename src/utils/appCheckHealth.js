/* src/utils/appCheckHealth.js */
/**
 * "The App Check SDK is wedged" flag + the gated recovery reload.
 *
 * Background (incident 2026-09-04): `@firebase/app-check` keeps ONE shared
 * token-exchange promise with no timeout. After a silent packet black-hole it
 * stayed pending for over an hour, and every callable, every Auth token refresh,
 * and the SDK's own refresher queued behind it. There is no public API to reset
 * a wedged App Check instance — only a page reload re-initializes it.
 *
 * Contract:
 *  - `markAppCheckStuck(source)` is called ONLY by the token preflight in
 *    gameCloudFunctions.js when the non-forced App Check fetch misses its deadline.
 *    Forced refreshes must never mark stuck: the SDK still serves a valid cached
 *    token to every consumer until it expires, so nothing is actually blocked.
 *  - While stuck, the preflight re-probes with a short deadline; a success calls
 *    `clearAppCheckStuck()`, which also disarms a pending reload (self-healing).
 *  - The reload is automatic but gated. It fires only when it cannot interrupt
 *    anything: no `[data-game-active="true"]` in the DOM (game screen AND both
 *    results screens set it), no save-or-enqueue in flight (`holdRecoveryReload`
 *    — a back-out mid-game runs the save headless on the dashboard, with no DOM
 *    marker), and the route is /dashboard. A poll keeps checking until all hold.
 *  - Last-chance probe: the stuck flag is a timeout heuristic and can go stale
 *    (the SDK's own refresher may have completed the exchange while the user was
 *    on the results screen). Before reloading, one short token probe runs; if it
 *    answers, the flag is cleared and nothing reloads.
 *  - One reload per page load; a sessionStorage cooldown stops a reload loop when
 *    the network is still dead after the reload (precedent: LoginScreen's
 *    `appcheck_reload_attempted`; watcher precedent: firestoreRecovery.js), and a
 *    per-tab cap (RELOAD_MAX_PER_TAB reloads within RELOAD_CAP_WINDOW_MS, also
 *    sessionStorage) stops the every-5-minutes cadence a permanently wedged SDK
 *    would otherwise produce (a blocked reCAPTCHA script never settles the SDK; no
 *    reload fixes that). The cap is a sliding window, not a lifetime count: a
 *    Capacitor WebView can live for days, and a lifetime count would have made the
 *    incident scenario (black-hole that ends after the second reload) permanently
 *    unrecoverable. Any later answer from the SDK (clearAppCheckStuck) also resets
 *    it — a reload that worked must not count against the next wedge.
 *  - `window.location.reload()` is the only reload mechanism in the app and works
 *    in the Capacitor WebView too (VersionCheckContext relies on it).
 */
import { trackEvent } from './analyticsTracker';
import { withDeadline } from './promiseDeadline';
import { fetchAppCheckToken } from '../firebaseConfig';

export const RELOAD_COOLDOWN_MS = 5 * 60 * 1000;
export const RELOAD_FIRST_CHECK_MS = 500;
export const RELOAD_POLL_MS = 2000;
export const RELOAD_DELAY_MS = 2000;
export const LAST_CHANCE_PROBE_MS = 3000;
export const RELOAD_MAX_PER_TAB = 2;
export const RELOAD_CAP_WINDOW_MS = 60 * 60 * 1000;
export const STORAGE_KEY = 'appcheck_stuck_reload_at';
export const RELOAD_TIMES_KEY = 'appcheck_stuck_reload_times';
const RELOAD_SAFE_PATHS = new Set(['/dashboard']);

// Injectable for tests (jsdom cannot reload, and window.location is awkward to stub).
const defaultDeps = () => ({
    reload: () => window.location.reload(),
    pathname: () => window.location.pathname,
    now: () => Date.now(),
    storage: () => window.sessionStorage,
    // Resolves true when the SDK ANSWERS inside the probe window — with a token, or with
    // an attestation error (a 403 is an answer; only a wedge is silence). Same rule the
    // preflight uses to clear the flag, so the two arbiters agree.
    probe: () => withDeadline(fetchAppCheckToken(false), LAST_CHANCE_PROBE_MS, {
        label: 'App Check last-chance probe',
        code: 'appcheck-last-chance-probe',
    }).then((result) => Boolean(result?.token) || Boolean(result?.error), () => false),
});
let deps = defaultDeps();

let stuckSince = null;     // ms timestamp of the first stuck signal this page load, or null
let stuckSource = null;    // which preflight caller detected it (telemetry)
let reloadArmed = false;   // watcher timers are live
let reloadFired = false;   // one-shot per page load
let skipLogged = false;    // cooldown skip is reported once per page load (3s probes would spam Sentry)
let exhaustedLogged = false;
let probeInFlight = false;
let firstCheckTimer = null;
let pollTimer = null;
let holds = 0;             // saves / enqueues in flight (see holdRecoveryReload)

const safeTrack = (name, params) => {
    try { trackEvent(name, params); } catch (_) { /* telemetry must never affect recovery */ }
};

const readLastReloadAt = () => {
    try { return Number(deps.storage().getItem(STORAGE_KEY)) || 0; } catch (_) { return 0; }
};

const writeLastReloadAt = (ts) => {
    try { deps.storage().setItem(STORAGE_KEY, String(ts)); } catch (_) { /* private mode etc. */ }
};

/** Timestamps of recovery reloads still inside the cap window (oldest first). */
const readRecentReloads = () => {
    try {
        const parsed = JSON.parse(deps.storage().getItem(RELOAD_TIMES_KEY) || '[]');
        if (!Array.isArray(parsed)) return [];
        const cutoff = deps.now() - RELOAD_CAP_WINDOW_MS;
        // A timestamp in the future (clock skew) is treated as expired, like the cooldown stamp.
        return parsed.filter((t) => typeof t === 'number' && t > cutoff && t <= deps.now());
    } catch (_) { return []; }
};

const writeRecentReloads = (times) => {
    try { deps.storage().setItem(RELOAD_TIMES_KEY, JSON.stringify(times)); } catch (_) { /* private mode etc. */ }
};

const clearRecentReloads = () => {
    try { deps.storage().removeItem(RELOAD_TIMES_KEY); } catch (_) { /* private mode etc. */ }
};

const stopWatcher = () => {
    if (firstCheckTimer !== null) { clearTimeout(firstCheckTimer); firstCheckTimer = null; }
    if (pollTimer !== null) { clearInterval(pollTimer); pollTimer = null; }
    reloadArmed = false;
};

const normalizePath = (pathname) => {
    const p = String(pathname || '');
    return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
};

const isSafeToReload = () => {
    if (holds > 0) return false;
    if (typeof document !== 'undefined' && document.querySelector('[data-game-active="true"]')) return false;
    return RELOAD_SAFE_PATHS.has(normalizePath(deps.pathname()));
};

const fire = async () => {
    if (reloadFired || stuckSince === null) { stopWatcher(); return; }
    if (probeInFlight || !isSafeToReload()) return;

    // Last-chance probe: don't reload on a stale flag.
    probeInFlight = true;
    let recovered = false;
    try {
        recovered = await deps.probe();
    } catch (_) {
        recovered = false;
    } finally {
        probeInFlight = false;
    }
    if (reloadFired || stuckSince === null) { stopWatcher(); return; } // cleared while probing
    if (recovered) {
        const waited = deps.now() - stuckSince;
        console.info(`[AppCheckHealth] App Check SDK answered the last-chance probe after ${waited}ms; recovery reload cancelled.`);
        safeTrack('appcheck_stuck_recovered', { source: stuckSource, wait_ms: waited });
        clearAppCheckStuck();
        return;
    }
    // Conditions may have changed during the probe (a save started, the user navigated).
    if (!isSafeToReload()) return;

    reloadFired = true;
    stopWatcher();
    const now = deps.now();
    writeLastReloadAt(now);
    writeRecentReloads([...readRecentReloads(), now]);
    console.warn(`[AppCheckHealth] Reloading to reinitialize the App Check SDK (source=${stuckSource}, waited ${now - stuckSince}ms).`);
    safeTrack('appcheck_stuck_reload', { source: stuckSource, wait_ms: now - stuckSince });
    // Small delay so the analytics beacon and the console line get out first.
    setTimeout(() => deps.reload(), RELOAD_DELAY_MS);
};

/**
 * Arm the safe-timed recovery reload.
 * @returns {boolean} true if a reload is armed (or already fired) this page load,
 *   false if the cooldown blocked it — callers use this to decide whether to keep
 *   a "Reconnecting…" overlay up.
 */
export const scheduleAppCheckRecoveryReload = ({ source = 'unknown' } = {}) => {
    if (reloadFired || reloadArmed) return true;
    const reloadCount = readRecentReloads().length;
    if (reloadCount >= RELOAD_MAX_PER_TAB) {
        if (!exhaustedLogged) {
            exhaustedLogged = true;
            console.warn(`[AppCheckHealth] Recovery reload exhausted: ${reloadCount} reloads in the last ${RELOAD_CAP_WINDOW_MS}ms did not unwedge the SDK; not reloading again for now.`);
            safeTrack('appcheck_stuck_reload_exhausted', { source, reload_count: reloadCount });
        }
        return false;
    }
    const sinceLast = deps.now() - readLastReloadAt();
    // A negative value means the stored timestamp is in the future (clock skew): treat as expired.
    if (sinceLast >= 0 && sinceLast < RELOAD_COOLDOWN_MS) {
        if (!skipLogged) {
            skipLogged = true;
            console.warn(`[AppCheckHealth] Recovery reload skipped: last one was ${sinceLast}ms ago (cooldown ${RELOAD_COOLDOWN_MS}ms).`);
            safeTrack('appcheck_stuck_reload_skipped', { source, since_last_ms: sinceLast });
        }
        return false;
    }
    reloadArmed = true;
    firstCheckTimer = setTimeout(fire, RELOAD_FIRST_CHECK_MS);
    pollTimer = setInterval(fire, RELOAD_POLL_MS);
    return true;
};

/**
 * Record that App Check token acquisition exceeded its deadline and arm recovery.
 * @param {string} source preflight caller ('save', 'generate', ...)
 * @returns {boolean} whether a recovery reload is armed (see scheduleAppCheckRecoveryReload)
 */
export const markAppCheckStuck = (source = 'unknown') => {
    if (stuckSince === null) {
        stuckSince = deps.now();
        stuckSource = source;
        // console.warn flows to Sentry via consoleLoggingIntegration.
        console.warn(`[AppCheckHealth] App Check token acquisition wedged (source=${source}); arming recovery reload.`);
        safeTrack('appcheck_stuck_detected', { source });
    }
    return scheduleAppCheckRecoveryReload({ source: stuckSource });
};

/**
 * A token probe succeeded after a stuck signal: the SDK recovered, no reload needed.
 * Also resets the per-tab reload cap: the SDK answering proves this page is healthy,
 * so earlier (successful) recovery reloads must not count against the next wedge.
 */
export const clearAppCheckStuck = () => {
    // The cap reset runs even when nothing is flagged in THIS page life: after a
    // recovery reload the new page starts with stuckSince === null, and its first
    // successful preflight is exactly the proof that the reload worked.
    exhaustedLogged = false;
    clearRecentReloads();
    if (stuckSince === null) return;
    stuckSince = null;
    stuckSource = null;
    if (!reloadFired) stopWatcher();
};

export const isAppCheckStuck = () => stuckSince !== null;

/** True while the watcher is polling or once the reload has been triggered. */
export const isRecoveryReloadArmed = () => reloadArmed || reloadFired;

/**
 * Block the recovery reload while a save (callable + offline enqueue) is in flight.
 * The DOM gate cannot see a headless save: backing out mid-game runs the end-game
 * save un-awaited while the router already shows the dashboard, and a reload during
 * the IndexedDB enqueue would lose the session (neither saved nor queued).
 *
 * @param {string} [label] for diagnostics only
 * @returns {() => void} release; idempotent
 */
export const holdRecoveryReload = (label = 'save') => {
    holds += 1;
    let released = false;
    return () => {
        if (released) return;
        released = true;
        holds = Math.max(0, holds - 1);
        if (holds === 0 && reloadArmed) {
            console.debug(`[AppCheckHealth] Reload hold released (${label}).`);
        }
    };
};

// --- test hooks (precedent: resetReminderPreferenceCacheForTests) ---
export const __resetAppCheckHealthForTests = () => {
    stopWatcher();
    stuckSince = null;
    stuckSource = null;
    reloadFired = false;
    skipLogged = false;
    exhaustedLogged = false;
    probeInFlight = false;
    holds = 0;
    deps = defaultDeps();
};

export const __setAppCheckHealthDepsForTests = (overrides) => {
    deps = { ...deps, ...overrides };
};

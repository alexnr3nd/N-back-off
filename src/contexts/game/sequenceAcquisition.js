/* src/contexts/game/sequenceAcquisition.js */
/**
 * Where a game sequence comes from, and in what order.
 *
 *     cache  ->  server (bounded)  ->  local generation
 *
 * Server generation stays primary whenever the network answers, so algorithm changes
 * reach players immediately. The local generator is the safety net, used when:
 *   - the device reports itself offline                        (reason 'offline')
 *   - the server has not answered within `fallbackAfterMs`     (reason 'server_timeout')
 *   - the server failed with a network-class error             (reason 'server_error')
 *   - a recent network-class failure left the breaker open     (reason 'breaker_open')
 *
 * Why a breaker: `navigator.onLine` is true on DNS-dead, captive-portal and
 * VPN-filtered networks (the 2026-09-16 incident: every fetch inside the WebView died
 * with ERR_NAME_NOT_RESOLVED after ~12s while Android reported the network VALIDATED).
 * Without the breaker, every single start on such a network would burn the full
 * fallback deadline before the player sees a stimulus. After one network-class
 * failure the next `SERVER_BACKOFF_MS` of starts go local instantly, while a
 * background probe keeps checking whether the network came back.
 *
 * What is NOT masked: auth-expired and App Check *attestation* errors are rethrown
 * untouched. They are not connectivity problems, they have their own handling in
 * `gameSetup.js`, and generating locally would only postpone them to the save.
 *
 * Pure and dependency-injected on purpose — the only import is the deadline helper,
 * everything else is a callback, so the whole decision table is unit-testable.
 */
import { withDeadline, isDeadlineError } from '../../utils/promiseDeadline';

/** How long a start waits on the server before generating locally instead. */
export const NETWORK_FALLBACK_AFTER_MS = 8000;

/** How long one network-class failure keeps the server "suspect". */
export const SERVER_BACKOFF_MS = 60000;

/** Deadline code, so the timeout can be told apart from the callable's own deadlines. */
const FALLBACK_DEADLINE_CODE = 'local-fallback-deadline';

// --- Module-level breaker state -------------------------------------------------
// Deliberately module scope (not React state): it must survive component unmounts
// between sessions and be readable from a plain async function.
let lastFailureAt = null;

// The background probe fired while the breaker is open. At most one at a time: on the
// dead network that motivates the breaker every start goes local instantly, so without
// this guard a run of quick starts would stack one hung request per start on the very
// connection that is already wedged.
let probeInFlight = null;

/**
 * Record a network-class server failure — opens the breaker.
 * @param {number} [at] - Timestamp of the failure (defaults to now).
 */
export const markServerFailure = (at = Date.now()) => { lastFailureAt = at; };

/** Record a server success (or regained connectivity) — closes the breaker. */
export const markServerSuccess = () => { lastFailureAt = null; };

/**
 * @param {number} [now] - Clock reading to evaluate against.
 * @returns {boolean} true while a recent failure keeps the server suspect.
 */
export const isServerSuspect = (now = Date.now()) =>
    lastFailureAt !== null && (now - lastFailureAt) < SERVER_BACKOFF_MS;

/** Test-only: return the breaker to its boot state. */
export const _resetServerHealthForTests = () => { lastFailureAt = null; probeInFlight = null; };

// Regaining connectivity is the strongest possible signal that the failure that
// opened the breaker is over — don't make the player wait out the backoff.
// remove-then-add keeps this idempotent if the module is re-imported (jest
// `resetModules`), and `markServerSuccess` ignores the event argument.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.removeEventListener('online', markServerSuccess);
    window.addEventListener('online', markServerSuccess);
}

const defaultIsOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

const logWarn = (log, ...args) => {
    try {
        if (log && typeof log.warn === 'function') log.warn(...args);
    } catch (e) { /* logging must never break a start */ }
};

/**
 * Run the local generator, attaching the server error that forced the fallback so a
 * crash report shows BOTH failures rather than just "generator exploded".
 */
const generateLocallyOrThrow = (generateLocally, serverError) => {
    try {
        return generateLocally();
    } catch (localError) {
        if (serverError && localError && !localError.cause) localError.cause = serverError;
        throw localError;
    }
};

/**
 * Acquire a game sequence.
 *
 * @param {object} deps
 * @param {Function} [deps.lookupCache] - `async () => response|null`. Omit to skip the cache.
 * @param {Function} deps.requestFromServer - `async () => response`. Called at most once.
 * @param {Function} deps.generateLocally - `() => response`. Synchronous local generation.
 * @param {Function} [deps.cacheLateResult] - `async (response) => void`. Receives a server
 *   response that arrived after the fallback deadline, or from the breaker's background probe.
 * @param {Function} [deps.isOnline] - Defaults to `navigator.onLine`.
 * @param {Function} deps.isNetworkError - Classifier deciding what counts as network-class.
 * @param {Function} [deps.isRetriableWithoutServer] - Optional opt-in: a non-network server
 *   error for which local generation is still acceptable (does NOT open the breaker).
 *   Unset by default, so unknown errors keep propagating.
 * @param {number} [deps.fallbackAfterMs=NETWORK_FALLBACK_AFTER_MS]
 * @param {Function} [deps.now=Date.now]
 * @param {object} [deps.log=console]
 * @returns {Promise<{response: object, source: 'cache'|'server'|'local',
 *   reason: null|'offline'|'server_timeout'|'server_error'|'breaker_open', serverError?: Error}>}
 */
export async function acquireSequence({
    lookupCache,
    requestFromServer,
    generateLocally,
    cacheLateResult,
    isOnline = defaultIsOnline,
    isNetworkError,
    isRetriableWithoutServer,
    fallbackAfterMs = NETWORK_FALLBACK_AFTER_MS,
    now = Date.now,
    log = console,
}) {
    // --- 1. Cache (use-once, pre-fetched) ---
    if (typeof lookupCache === 'function') {
        const cached = await lookupCache();
        if (cached) return { response: cached, source: 'cache', reason: null };
    }

    // --- 2. Device says it is offline: no point dialling out ---
    if (!isOnline()) {
        return { response: generateLocallyOrThrow(generateLocally, null), source: 'local', reason: 'offline' };
    }

    // --- 3. Breaker open: play now, probe the server in the background ---
    if (isServerSuspect(now())) {
        logWarn(log, '[sequenceAcquisition] Server suspect after a recent network failure — generating locally.');
        // Fire the probe BEFORE generating, so its handlers are attached even if the
        // local generator throws (otherwise a rejected probe would go unhandled).
        if (!probeInFlight) {
            probeInFlight = Promise.resolve()
                .then(() => requestFromServer())
                .then((response) => {
                    markServerSuccess();
                    // A failed cache write is not a failed request — swallow it here so it
                    // can never reach the breaker's catch below.
                    return Promise.resolve(cacheLateResult ? cacheLateResult(response) : undefined)
                        .catch(() => {});
                })
                .catch((probeError) => {
                    // Still broken: refresh the failure stamp so the backoff slides forward.
                    if (isNetworkError && isNetworkError(probeError)) markServerFailure(Date.now());
                })
                .finally(() => { probeInFlight = null; });
        }
        return { response: generateLocallyOrThrow(generateLocally, null), source: 'local', reason: 'breaker_open' };
    }

    // --- 4. Server, bounded by the fallback deadline ---
    let serverPromise;
    try {
        serverPromise = requestFromServer();
        const response = await withDeadline(serverPromise, fallbackAfterMs, {
            label: 'generateSequence (fallback)',
            code: FALLBACK_DEADLINE_CODE,
        });
        markServerSuccess();
        return { response, source: 'server', reason: null };
    } catch (error) {
        // Our own fallback deadline: the request is still in flight and may yet succeed.
        // Don't open the breaker on it — let the outcome decide.
        if (isDeadlineError(error) && error.code === FALLBACK_DEADLINE_CODE) {
            logWarn(log, `[sequenceAcquisition] Server did not answer within ${fallbackAfterMs}ms — generating locally.`);
            serverPromise
                .then((late) => {
                    markServerSuccess();
                    // Keep a cache-write failure out of the breaker's catch: IndexedDB
                    // being full says nothing about the network.
                    return Promise.resolve(cacheLateResult ? cacheLateResult(late) : undefined)
                        .catch(() => {});
                })
                .catch((lateError) => {
                    if (isNetworkError && isNetworkError(lateError)) markServerFailure(Date.now());
                });
            return { response: generateLocallyOrThrow(generateLocally, null), source: 'local', reason: 'server_timeout' };
        }

        if (isNetworkError && isNetworkError(error)) {
            markServerFailure(now());
            logWarn(log, '[sequenceAcquisition] Server failed with a network-class error — generating locally.', error.message);
            return {
                response: generateLocallyOrThrow(generateLocally, error),
                source: 'local',
                reason: 'server_error',
                serverError: error,
            };
        }

        if (isRetriableWithoutServer && isRetriableWithoutServer(error)) {
            logWarn(log, '[sequenceAcquisition] Server error classified as retriable without the server — generating locally.', error.message);
            return {
                response: generateLocallyOrThrow(generateLocally, error),
                source: 'local',
                reason: 'server_error',
                serverError: error,
            };
        }

        // Auth expiry, App Check attestation, invalid-argument, ... — never masked.
        throw error;
    }
}

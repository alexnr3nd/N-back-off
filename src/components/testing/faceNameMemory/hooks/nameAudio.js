/* src/components/testing/faceNameMemory/hooks/nameAudio.js */
/**
 * Spoken-name playback for the Face-Name Memory study phase.
 *
 * The study card is AUDIO-ONLY (the name is never shown as text), so the spoken
 * name MUST be heard or the face↔name binding can't form. Advancement is
 * TIME-BASED (no per-card tap), which on iOS Safari / mobile WebKit is
 * fundamentally incompatible with HTMLAudioElement playback: media elements need
 * a per-element user gesture, so a fresh `new Audio().play()` fired from an
 * auto-advance timer is BLOCKED.
 *
 * Fix: the Web Audio API. One shared AudioContext, unlocked ONCE inside the
 * first user gesture that enters the assessment (resume() + a 1-sample silent
 * buffer — see unlockNameAudio). Web Audio gates on STICKY activation, so once
 * the context is `running` it plays decoded buffers from the auto-advance timer
 * for the rest of the page's life with NO further gesture.
 *
 * iOS interruption recovery: when another app takes audio focus (a video/photos
 * app, a call, screen lock), iOS pushes the context into a stuck
 * `interrupted`/`suspended` state that resume() ALONE often can't recover — the
 * audio stays dead even when the speaker button is tapped. So once the context
 * has run, any later gesture that finds it not-running RECREATES it (close the
 * dead one, make a fresh one, re-decode) — the only reliable WebKit recovery,
 * and it must ride a user gesture. visibilitychange re-arms a one-shot first-tap
 * unlock so *any* tap after returning recovers, not just the speaker button.
 *
 * Self-contained on purpose (not the game's audioManager) so the assessment
 * module stays isolated. An HTMLAudio path is kept ONLY as a fallback for
 * environments without Web Audio. Public API (preloadNames / playName /
 * unlockNameAudio) is stable.
 */

const AudioContextCtor =
    typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;

let ctx = null;                  // shared, lazily-created AudioContext
let ctxRan = false;              // has THIS context instance ever reached `running`?
const buffers = new Map();       // name -> decoded AudioBuffer (bound to the live ctx)
const decoding = new Map();      // name -> in-flight Promise<AudioBuffer|null>
const htmlCache = new Map();     // name -> HTMLAudioElement (fallback path only)
const knownNames = new Set();    // every preloaded name, so we can re-warm after a recreate
let gestureArmed = false;        // one-shot first-gesture unlock currently listening?
let visibilityArmed = false;     // visibilitychange handler installed?

const GESTURE_EVENTS = ['touchstart', 'touchend', 'pointerdown', 'mousedown', 'keydown'];

const urlFor = (name) => `/audio/names/${encodeURIComponent(name)}.mp3`;

const getCtx = () => {
    if (ctx) return ctx;
    if (!AudioContextCtor) return null;
    try {
        ctx = new AudioContextCtor();
        ctxRan = false;
        ctx.onstatechange = () => { if (ctx && ctx.state === 'running') ctxRan = true; };
    } catch (e) { ctx = null; }
    return ctx;
};

// Decode + cache a single clip. Safe while the context is suspended.
const decodeName = (name) => {
    if (buffers.has(name)) return Promise.resolve(buffers.get(name));
    if (decoding.has(name)) return decoding.get(name);
    const c = getCtx();
    if (!c) return Promise.resolve(null);
    // `r.status === 0` is a SUCCESS on iOS: Capacitor's WebViewAssetHandler
    // serves media extensions (.mp3) with a plain URLResponse, so there is no
    // HTTP status line and `ok` is false despite a complete body. Requiring
    // `ok` dropped every name to the HTMLAudio fallback, which the iOS autoplay
    // policy blocks on the auto-advancing study card — i.e. silence, the exact
    // failure this module exists to avoid. Web/Android get a real 200 and are
    // unaffected; a missing file fails the scheme task and rejects the fetch.
    const p = fetch(urlFor(name))
        .then((r) => ((r.ok || r.status === 0) ? r.arrayBuffer() : Promise.reject(new Error('fetch failed'))))
        .then((buf) => (buf && buf.byteLength > 0 ? c.decodeAudioData(buf) : Promise.reject(new Error('empty audio'))))
        .then((decoded) => { buffers.set(name, decoded); decoding.delete(name); return decoded; })
        .catch(() => { decoding.delete(name); return null; });
    decoding.set(name, p);
    return p;
};

// Tear down a context stuck in iOS `interrupted`/`suspended` and build a fresh
// one. The decoded buffers were bound to the dead context, so drop them and
// re-warm the known clips against the new context. MUST be called from a user
// gesture (a non-gesture-created context starts suspended and can't be unlocked).
const recreateCtx = () => {
    const old = ctx;
    ctx = null;
    buffers.clear();
    decoding.clear();
    if (old) { try { old.close(); } catch (e) { /* ignore */ } }
    const c = getCtx();
    if (c) knownNames.forEach((n) => decodeName(n));
    return c;
};

// Play a decoded buffer via a fresh single-use BufferSource. Returns success.
const playBuffer = (buffer) => {
    const c = getCtx();
    if (!c || !buffer) return false;
    try {
        const src = c.createBufferSource();
        src.buffer = buffer;
        src.connect(c.destination);
        src.start(0);
        return true;
    } catch (e) { return false; }
};

// Fallback for no-Web-Audio environments. Blocked by iOS autoplay policy on
// auto-advance, but works for desktop/Android and for tap-driven replays.
const htmlPlay = (name) => {
    let a = htmlCache.get(name);
    if (!a) {
        try { a = new Audio(urlFor(name)); a.preload = 'auto'; htmlCache.set(name, a); } catch (e) { return; }
    }
    try {
        a.currentTime = 0;
        const p = a.play();
        if (p && typeof p.catch === 'function') p.catch(() => { /* blocked — Web Audio is primary */ });
    } catch (e) { /* ignore */ }
};

/**
 * Unlock / recover the audio context from inside a user gesture. Idempotent.
 * - Fresh context (never ran): resume() + silent buffer → running.
 * - Context that RAN and is now stuck (iOS interrupted after losing audio focus):
 *   recreate it, then resume() + silent buffer. resume() alone can't recover an
 *   interrupted WebKit context, which is why the speaker button went dead.
 * The `ctxRan` guard means tapping again during a fresh context's resume window
 * won't thrash (a just-created context hasn't run yet, so it isn't recreated).
 */
export const unlockNameAudio = () => {
    let c = getCtx();
    if (!c) return;
    if (c.state === 'running') return;
    if (ctxRan && c.state !== 'running') {
        c = recreateCtx();            // ran before, now stuck → rebuild inside this gesture
        if (!c) return;
    }
    try { c.resume(); } catch (e) { /* ignore */ }
    try {
        const s = c.createBufferSource();
        s.buffer = c.createBuffer(1, 1, 22050);
        s.connect(c.destination);
        s.start(0);                   // start() in a gesture is itself an unlock trigger
    } catch (e) { /* ignore */ }
};

// One-shot, self-removing capture listener: the next interaction anywhere unlocks
// (or recovers) audio. Re-armable — it resets its own flag on fire so a later
// visibilitychange can re-arm it after an interruption.
const onGesture = () => {
    gestureArmed = false;
    GESTURE_EVENTS.forEach((e) => document.removeEventListener(e, onGesture, true));
    unlockNameAudio();
};
const armGestureUnlock = () => {
    if (gestureArmed || typeof document === 'undefined') return;
    gestureArmed = true;
    GESTURE_EVENTS.forEach((e) => document.addEventListener(e, onGesture, { capture: true, passive: true }));
};

// iOS drops the context to suspended/interrupted on tab-switch / backgrounding /
// another app taking audio focus. On return: best-effort resume (covers a plain
// suspend) AND re-arm the one-shot unlock so the next tap recovers (recreates) a
// truly-stuck context — resume() from a non-gesture can't.
const armVisibility = () => {
    if (visibilityArmed || typeof document === 'undefined') return;
    visibilityArmed = true;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (ctx && ctx.state !== 'running') {
            try { ctx.resume(); } catch (e) { /* ignore */ }
            armGestureUnlock();
        }
    });
};

const armNameAudio = () => { armGestureUnlock(); armVisibility(); };

// Arm at module load so the entry gesture (which happens on the summary/panel
// screen, before the study card mounts) is caught.
armNameAudio();

/**
 * Preload (decode) the spoken-name clips so playback is instant on the study
 * card; also primes the HTMLAudio fallback. Signature unchanged.
 */
export const preloadNames = (names = []) => {
    armNameAudio();
    for (const name of names) {
        if (!name) continue;
        knownNames.add(name);
        decodeName(name);
        if (!htmlCache.has(name)) {
            try { const a = new Audio(urlFor(name)); a.preload = 'auto'; htmlCache.set(name, a); } catch (e) { /* ignore */ }
        }
    }
};

/**
 * Speak a name. Prefers Web Audio (the only path that works under iOS
 * auto-advance once unlocked); falls back to HTMLAudio when Web Audio is
 * unavailable. Never recreates the context itself (that needs a gesture — the
 * speaker button / unlockNameAudio handle recovery). Signature unchanged.
 */
export const playName = (name) => {
    if (!name) return;
    const c = getCtx();
    if (!c) { htmlPlay(name); return; }

    const playReady = () => {
        if (!ctx || ctx.state !== 'running') { htmlPlay(name); return; }
        const buffer = buffers.get(name);
        if (buffer) { if (!playBuffer(buffer)) htmlPlay(name); return; }
        decodeName(name).then((b) => {
            if (b && ctx && ctx.state === 'running') { if (!playBuffer(b)) htmlPlay(name); }
            else htmlPlay(name);
        });
    };

    if (c.state === 'running') { playReady(); return; }

    // Not running. resume() succeeds if we're inside a gesture (e.g. the speaker
    // button, which also calls unlockNameAudio to recover a stuck context first).
    try {
        const r = c.resume();
        if (r && typeof r.then === 'function') {
            r.then(playReady).catch(() => htmlPlay(name));
            return;
        }
    } catch (e) { /* ignore */ }
    htmlPlay(name);
};

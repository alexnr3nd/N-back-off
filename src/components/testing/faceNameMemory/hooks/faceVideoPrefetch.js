/* src/components/testing/faceNameMemory/hooks/faceVideoPrefetch.js */
/**
 * Best-effort one-ahead prefetch for the animated face-portrait clips, so the
 * NEXT clip is already loaded while the current one is on screen and the
 * transition feels instant.
 *
 * Two paths, both no-throw and idempotent (a per-session `warmed` set means
 * re-requesting a clip is free):
 *   - A Workbox service worker controls the page (web, returning visit): ask it
 *     to cache.add() each clip into the 'face-videos' cache. cache.add sends a
 *     FULL (non-Range) GET → a 200 the SW can store; the video route's
 *     RangeRequestsPlugin then serves the <video> element's range requests from
 *     that cached full response (a 206 range request would NOT self-populate the
 *     cache, which is why warming goes through the SW, not the <video> tag).
 *   - No controlling SW (first web load, or the Capacitor WebView where clips
 *     are bundled and SWs are unsupported): a plain fetch() warms the HTTP
 *     cache; for already-local bundled assets it's a harmless near-no-op.
 *
 * Stills are unaffected — callers pass video URLs only when the rollout flag put
 * `video` on the pairs; with the flag off there are no URLs and this never runs.
 */
const warmed = new Set();

export const prefetchFaceVideos = (urls = []) => {
    const fresh = [];
    for (const u of urls) {
        if (!u || typeof u !== 'string' || warmed.has(u)) continue;
        warmed.add(u);
        fresh.push(u);
    }
    if (!fresh.length) return;

    try {
        const sw = (typeof navigator !== 'undefined') ? navigator.serviceWorker : null;
        if (sw && sw.controller) {
            sw.controller.postMessage({ type: 'WARM_FACE_VIDEOS', urls: fresh });
            return;
        }
    } catch (e) { /* fall through to a direct fetch */ }

    for (const u of fresh) {
        try {
            const p = fetch(u, { cache: 'force-cache' });
            if (p && typeof p.catch === 'function') p.catch(() => { /* png fallback covers misses */ });
        } catch (e) { /* ignore */ }
    }
};

/**
 * Resolve once the clip at `url` has buffered enough to display (its first frame
 * is decoded), or after `timeoutMs` as a hard cap — used to hold the "Preparing
 * assessment" screen until the OPENING clip is ready, so the first memorize card
 * never buffers on screen. A detached, muted <video> does the loading; it is
 * torn down on resolve. Never rejects (missing url / no DOM / error / timeout
 * all resolve), so a slow or absent clip can only delay the cap, never hang.
 */
export const waitForFirstVideo = (url, timeoutMs = 2500) => new Promise((resolve) => {
    if (!url || typeof document === 'undefined') { resolve(); return; }
    // Warm the SW / HTTP cache in parallel with the readiness probe below.
    prefetchFaceVideos([url]);

    let v = null;
    let done = false;
    let timer = null;
    const cleanup = () => {
        if (timer) clearTimeout(timer);
        if (v) {
            v.removeEventListener('loadeddata', finish);
            v.removeEventListener('canplaythrough', finish);
            v.removeEventListener('error', finish);
            try { v.removeAttribute('src'); v.load(); } catch (e) { /* ignore */ }
        }
    };
    function finish() { if (done) return; done = true; cleanup(); resolve(); }

    timer = setTimeout(finish, timeoutMs);
    try {
        v = document.createElement('video');
        v.muted = true;
        v.preload = 'auto';
        v.addEventListener('loadeddata', finish, { once: true });
        v.addEventListener('canplaythrough', finish, { once: true });
        v.addEventListener('error', finish, { once: true });
        v.src = url;
        if (typeof v.load === 'function') v.load();
    } catch (e) { finish(); }
});

// Test-only: clear the per-session dedupe set.
export const __resetFaceVideoPrefetch = () => warmed.clear();

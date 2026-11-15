/* src/utils/iosViewportGuard.js */
/**
 * iOS native viewport guard - recovery net + field diagnostics.
 *
 * Background. Capacitor's iOS "disable zooming" never prevents a zoom and never
 * restores zoomScale; WebViewDelegationHandler.scrollViewWillBeginZooming simply
 * disables the pinch gesture recognizer the first time a zoom begins. So the
 * first zoom from ANY source leaves the WebView permanently zoomed with pinch-out
 * already dead. While the visual viewport is offset or scaled relative to the
 * layout viewport, position:fixed overlays render at one place and hit-test at
 * another - their buttons simply stop responding, and a force-quit is the only
 * way out. That has now bitten the onboarding modal after email/password signup
 * twice.
 *
 * index.html locks the scale for the iOS WebView at parse time, which removes the
 * trigger for every zoom path (focus-zoom, double-tap, zoom-to-focused-element).
 * This module is the layer BELOW that: it watches the visual viewport, tries to
 * recover if it is ever left offset or scaled anyway, and - because the failure is
 * intermittent, only reproduces on a real device, and release builds are not
 * Safari-inspectable (Capacitor sets isInspectable only for debug builds) -
 * reports what it saw, so the next occurrence produces evidence instead of a guess.
 *
 * A separate known cause of a stuck offset is a WebKit regression where
 * visualViewport.offsetTop is left at ~24px after the software keyboard is
 * dismissed (WebKit 297779 -> rdar://159439271, "a bug in a system component";
 * largely addressed in iOS 26.1, with residual reports after). The keyboard is
 * also why this only shows up on the email/password path - Google sign-in never
 * raises one.
 *
 * Native iOS only. Web and Android never install it.
 */

import { isIOS } from './platform';

/** Locked viewport string - must stay in sync with the script in public/index.html. */
export const LOCKED_VIEWPORT =
    'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover';

/** Sub-pixel noise is normal; these are the thresholds that mean something is wrong. */
export const SCALE_TOLERANCE = 1.01;
export const OFFSET_TOLERANCE = 1;

/** Keyboard dismissal animates for ~250-300ms; sample after it settles. */
const SETTLE_MS = 400;

/** Cap reports so a pathological device cannot flood analytics. */
const MAX_REPORTS_PER_SESSION = 3;

let reportCount = 0;
let settleTimer = null;
let installed = false;

/**
 * Pure predicate: do these visual-viewport metrics indicate the broken state?
 * Split out from the DOM wiring so it can be unit-tested directly.
 *
 * @param {{scale?: number, offsetTop?: number, offsetLeft?: number}} metrics
 * @returns {{anomalous: boolean, reasons: string[]}}
 */
export const detectViewportAnomaly = (metrics = {}) => {
    const reasons = [];
    const { scale, offsetTop, offsetLeft } = metrics;

    if (typeof scale === 'number' && Number.isFinite(scale) && scale > SCALE_TOLERANCE) {
        reasons.push('scale');
    }
    if (typeof offsetTop === 'number' && Number.isFinite(offsetTop) && Math.abs(offsetTop) > OFFSET_TOLERANCE) {
        reasons.push('offsetTop');
    }
    if (typeof offsetLeft === 'number' && Number.isFinite(offsetLeft) && Math.abs(offsetLeft) > OFFSET_TOLERANCE) {
        reasons.push('offsetLeft');
    }

    return { anomalous: reasons.length > 0, reasons };
};

/** Snapshot the visual viewport. Returns null where the API is unavailable. */
export const readViewportMetrics = () => {
    if (typeof window === 'undefined' || !window.visualViewport) return null;
    const vv = window.visualViewport;
    return {
        scale: vv.scale,
        offsetTop: vv.offsetTop,
        offsetLeft: vv.offsetLeft,
        vvHeight: Math.round(vv.height),
        innerHeight: window.innerHeight,
    };
};

/**
 * Force WebKit to re-evaluate the viewport by replacing the meta element outright.
 * Rewriting the content attribute in place is not always enough; removing and
 * re-inserting the node is. This is the lever that still works when the page
 * cannot scroll, which matters because open modals set body overflow:hidden.
 */
const reassertViewportMeta = () => {
    try {
        const head = document.head;
        const existing = document.querySelector('meta[name="viewport"]');
        if (!head || !existing) return;
        existing.parentNode.removeChild(existing);
        const fresh = document.createElement('meta');
        fresh.setAttribute('name', 'viewport');
        fresh.setAttribute('content', LOCKED_VIEWPORT);
        head.appendChild(fresh);
    } catch (e) { /* recovery is best-effort */ }
};

/**
 * Nudge the scroll position so WebKit recomputes visualViewport.offsetTop. This is
 * the documented workaround for the stuck-offset regression, and a harmless no-op
 * when the document cannot scroll.
 */
const nudgeScroll = () => {
    try {
        window.scrollBy(0, -1);
        window.scrollBy(0, 1);
    } catch (e) { /* recovery is best-effort */ }
};

/**
 * Report through whatever telemetry exists. Imported lazily so neither analytics
 * nor Sentry is pulled into app startup on account of this guard, and so a failure
 * here can never break boot.
 */
const report = async (payload) => {
    try {
        const { trackEvent } = await import('./analyticsTracker');
        trackEvent('ios_viewport_anomaly', payload);
    } catch (e) { /* analytics unavailable */ }

    try {
        const Sentry = await import('@sentry/react');
        Sentry.captureMessage('iOS viewport anomaly', {
            level: 'warning',
            tags: { context: 'ios_viewport_guard' },
            extra: payload,
        });
    } catch (e) { /* Sentry unavailable */ }
};

/**
 * Sample the viewport; if it is in the broken state, attempt recovery, re-sample,
 * and report both sides so we learn whether the recovery actually worked.
 */
const checkAndRecover = (source) => {
    const before = readViewportMetrics();
    if (!before) return;

    const { anomalous, reasons } = detectViewportAnomaly(before);
    if (!anomalous) return;

    if (reasons.includes('scale')) reassertViewportMeta();
    nudgeScroll();

    // Re-sample on the next frame, once the recovery has been laid out.
    const finish = () => {
        const after = readViewportMetrics() || {};
        const recovered = !detectViewportAnomaly(after).anomalous;

        if (reportCount < MAX_REPORTS_PER_SESSION) {
            reportCount += 1;
            report({
                source,
                reasons: reasons.join(','),
                scale_before: Number((before.scale || 0).toFixed(3)),
                offset_top_before: Math.round(before.offsetTop || 0),
                vv_height_before: before.vvHeight,
                inner_height_before: before.innerHeight,
                scale_after: Number((after.scale || 0).toFixed(3)),
                offset_top_after: Math.round(after.offsetTop || 0),
                recovered,
                // Whether a modal was on screen tells us if this actually cost the
                // user anything - a fixed overlay is what turns an offset into
                // untappable buttons.
                dialog_open: !!document.querySelector('[role="dialog"]'),
                path: (window.location && window.location.pathname) || '',
            });
        }
    };

    if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(finish);
    } else {
        finish();
    }
};

/** Debounce so a burst of viewport events produces one check after things settle. */
const scheduleCheck = (source) => {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
        settleTimer = null;
        checkAndRecover(source);
    }, SETTLE_MS);
};

/**
 * Install the guard. Idempotent, and a no-op off native iOS.
 */
export const initIOSViewportGuard = () => {
    if (installed) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!isIOS()) return;
    installed = true;

    // Keyboard dismissal is the trigger that matters most: it is the difference
    // between the email/password signup path (broken) and Google sign-in (fine).
    document.addEventListener('focusout', () => scheduleCheck('focusout'), true);

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => scheduleCheck('vv-resize'));
        window.visualViewport.addEventListener('scroll', () => scheduleCheck('vv-scroll'));
    }

    // Returning from the background is the other point where iOS has been seen to
    // leave the viewport in a stale state.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') scheduleCheck('visible');
    });
};

/** Test seam: drop installed/report state between cases. */
export const __resetIOSViewportGuard = () => {
    installed = false;
    reportCount = 0;
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
};

export default { initIOSViewportGuard, detectViewportAnomaly, readViewportMetrics };

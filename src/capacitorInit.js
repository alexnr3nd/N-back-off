/* src/capacitorInit.js */
/* Capacitor native plugin initialization and lifecycle management */

import { isNative, isIOS, isAndroid } from './utils/platform';
import audioManager from './utils/audioManager';
import { initIOSViewportGuard } from './utils/iosViewportGuard';

/**
 * Initialize Capacitor plugins and configure native platform behavior.
 * Called once at app startup before React renders.
 */
export async function initCapacitor() {
    if (!isNative()) return;

    // iOS viewport guard - installed FIRST and synchronously, before any await, so
    // it is already listening before the first screen can raise a keyboard. Its own
    // try/catch keeps a failure here from skipping the plugin init below, matching
    // the Android audio block. See src/utils/iosViewportGuard.js: once the WebView
    // is left zoomed or offset, Capacitor has already killed the pinch-out gesture,
    // every position:fixed overlay mis-hit-tests, and force-quit is the only escape.
    if (isIOS()) {
        try {
            initIOSViewportGuard();
        } catch (err) {
            console.warn('[Capacitor] Failed to install iOS viewport guard:', err);
        }
    }

    // Android Bluetooth audio-routing fix — registered FIRST, in its own
    // try/catch, so a failure anywhere in the later plugin init (e.g. the
    // StatusBar dynamic import) can never silently disable it — and a failure
    // HERE (e.g. the @capacitor/app import) can never skip the later init or
    // reject initCapacitor() (index.js calls it without .catch()).
    // See memory/project_bluetooth_audio_routing_bug.md.
    if (isAndroid()) {
        try {
            // (1) Cold-start arming. Capacitor drops the initial appStateChange
            // (fired before JS listeners register), so "headphones connected
            // BEFORE app launch" would otherwise never arm the flag — and BT
            // A2DP activation can lag phone unlock by seconds, letting the
            // AudioContext's output stream open on the speaker first. Arming
            // here makes the FIRST session of every app run rebuild the
            // AudioContext inside the start gesture, on the then-current output
            // device. Synchronous, before any await: survives import failures.
            audioManager.markOutputDeviceStale('cold-start');

            // (2) Native AudioDeviceCallback relay (MainActivity.java fires this
            // window event whenever an audio OUTPUT device is added or removed).
            // Covers "headphones connected while the app is foregrounded", which
            // produces no appStateChange — and Android WebView has no devicechange
            // event. Plain Event, no payload; the firing itself is the signal.
            window.addEventListener('dnb-audio-devices-changed', () => {
                try {
                    audioManager.markOutputDeviceStale('native-device-change');
                } catch (err) {
                    console.warn('[Capacitor] audio device-change handler failed:', err);
                }
            });

            // (3) Foreground re-arm (belt and suspenders; the flag is idempotent
            // and consumed once per session start): the output device may have
            // changed while backgrounded even if the native event was missed.
            const { App } = await import('@capacitor/app');
            App.addListener('appStateChange', (state) => {
                try {
                    if (state.isActive) {
                        audioManager.markOutputDeviceStale('app-foreground');
                    }
                } catch (err) {
                    console.warn('[Capacitor] appStateChange audio handler failed:', err);
                }
            });
        } catch (err) {
            console.warn('[Capacitor] Failed to register Android audio listeners:', err);
        }
    }

    try {
        // Status bar icon style. On Android 15/16 edge-to-edge, setOverlaysWebView
        // and setBackgroundColor are no-ops (handled by the built-in SystemBars
        // plugin + safe-area CSS, see capacitor.config.ts / src/utils/safeArea.js),
        // so only the icon style is set here.
        if (isIOS() || isAndroid()) {
            const { StatusBar, Style } = await import('@capacitor/status-bar');
            await StatusBar.setStyle({ style: Style.Dark });
        }

        // The cookie-consent banner is web-only (gated in App.js). Inside the native
        // app, treat analytics as first-party (covered by the Privacy Policy + Play
        // Data Safety declaration) and grant analytics consent, so Firebase/GA4 is
        // not stuck in the 'denied' default set in index.html. Ad signals stay denied
        // (ads removed).
        try {
            if (typeof window.gtag === 'function') {
                window.gtag('consent', 'update', { analytics_storage: 'granted' });
            }
        } catch (err) {
            console.warn('[Capacitor] Failed to set native analytics consent:', err);
        }

        // Handle Android hardware back button
        if (isAndroid()) {
            const { App } = await import('@capacitor/app');
            App.addListener('backButton', ({ canGoBack }) => {
                if (canGoBack) {
                    window.history.back();
                } else {
                    App.minimizeApp();
                }
            });
        }

        // Listen for deep links (appUrlOpen)
        const { App } = await import('@capacitor/app');
        App.addListener('appUrlOpen', (event) => {
            try {
                const url = new URL(event.url);
                const path = url.pathname + url.search + url.hash;
                if (path) {
                    window.history.pushState({}, '', path);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }
            } catch (err) {
                console.warn('[Capacitor] Failed to parse deep link URL:', event.url, err);
            }
        });

        // Native initialization complete
    } catch (error) {
        console.error('[Capacitor] Initialization error:', error);
    }
}

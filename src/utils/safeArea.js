/* src/utils/safeArea.js */
/*
 * Safe-area inset CSS expressions for system bars (status bar, gesture/nav bar).
 *
 * On Android 15/16 the app is forced edge-to-edge; Capacitor 8's built-in
 * SystemBars plugin (insetsHandling: 'css' in capacitor.config.ts) injects the
 * `--safe-area-inset-*` custom properties with correct values (including on
 * older Android WebView where the native `env()` values are unreliable).
 *
 * The fallback chain covers every platform with a single expression:
 *   var(--safe-area-inset-*)  -> Capacitor 8 SystemBars (native Android)
 *   env(safe-area-inset-*)    -> native fallback (iOS PWA, mobile web browsers)
 *   0px                       -> default before SystemBars injects / desktop web
 *
 * Use these as inline-style values (e.g. style={{ paddingTop: SAFE_AREA_TOP }}).
 */
export const SAFE_AREA_TOP = 'var(--safe-area-inset-top, env(safe-area-inset-top, 0px))';
export const SAFE_AREA_BOTTOM = 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))';
export const SAFE_AREA_LEFT = 'var(--safe-area-inset-left, env(safe-area-inset-left, 0px))';
export const SAFE_AREA_RIGHT = 'var(--safe-area-inset-right, env(safe-area-inset-right, 0px))';

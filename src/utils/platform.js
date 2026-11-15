/* src/utils/platform.js */
/* Central platform detection utility for Capacitor native vs web */

import { Capacitor } from '@capacitor/core';

/**
 * Returns true when running inside a native iOS or Android app (Capacitor WebView).
 */
export const isNative = () => Capacitor.isNativePlatform();

/**
 * Returns true when running on iOS (native app).
 */
export const isIOS = () => Capacitor.getPlatform() === 'ios';

/**
 * Returns true when running on Android (native app).
 */
export const isAndroid = () => Capacitor.getPlatform() === 'android';

/**
 * Returns true when running on web (browser, not inside a native WebView).
 */
export const isWeb = () => Capacitor.getPlatform() === 'web';

/**
 * Returns the current platform string: 'web', 'android', or 'ios'.
 */
export const getPlatform = () => Capacitor.getPlatform();

/**
 * Returns true when the user is on an Android mobile browser (not the native app).
 * Used to show the app download prompt.
 */
export const isMobileAndroidBrowser = () => {
    if (isNative()) return false;
    return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
};

/**
 * Returns true when the app should connect to Firebase emulators.
 * On native, always returns false (Capacitor serves from localhost but
 * should never connect to emulators in a real app).
 * On web, checks for localhost/127.0.0.1 hostname.
 */
export const isEmulatorEnv = () => {
    if (isNative()) return false;
    return (
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    );
};

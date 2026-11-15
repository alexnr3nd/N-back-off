/* src/services/authService.js */
/* Unified Google Sign-In and native Apple Sign-In abstractions */

import { signInWithPopup, GoogleAuthProvider, OAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, ensureAppCheckToken } from '../firebaseConfig';
import { isNative, isIOS } from '../utils/platform';

/**
 * Sign in with Google.
 * On native: Uses @capacitor-firebase/authentication (Credential Manager) for the native OAuth flow.
 * On web: Uses Firebase signInWithPopup (existing behavior).
 *
 * @returns {Promise<import('firebase/auth').UserCredential>} Firebase user credential
 */
export async function signInWithGoogle() {
    if (isNative()) {
        return signInWithGoogleNative();
    }
    return signInWithGoogleWeb();
}

/**
 * Native Google Sign-In via @capacitor-firebase/authentication (Capawesome).
 * With `skipNativeAuth: true` (set in capacitor.config.ts) the plugin only opens
 * the native Android Credential Manager account picker and returns a Google
 * idToken; we exchange that for a Firebase credential and sign into the Firebase
 * JS SDK. The rest of the app (Firestore/Functions/App Check) keeps using the
 * web SDK auth instance unchanged.
 */
async function signInWithGoogleNative() {
    try {
        // Code-split dynamic import (no webpackIgnore): webpack emits this as an
        // async chunk fetched only on the native path, so the plugin never enters
        // the web bundle and the web branch stays on signInWithPopup.
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');

        // Native account picker (Credential Manager). Returns a Google idToken.
        const result = await FirebaseAuthentication.signInWithGoogle();

        const idToken = result?.credential?.idToken;
        if (!idToken) {
            throw new Error('Google sign-in failed: No ID token received.');
        }

        // Exchange the Google idToken for a Firebase credential and sign into the
        // same Firebase JS SDK auth instance the whole app already uses.
        const credential = GoogleAuthProvider.credential(idToken);
        return signInWithCredential(auth, credential);
    } catch (error) {
        // Map common native errors to user-friendly messages
        if (error.message?.includes('canceled') || error.message?.includes('cancelled')) {
            const cancelError = new Error('Sign-in cancelled. Please try again.');
            cancelError.code = 'auth/popup-closed-by-user';
            throw cancelError;
        }
        if (error.message?.includes('network')) {
            const networkError = new Error('Network error during Google sign-in. Please check your connection.');
            networkError.code = 'auth/network-request-failed';
            throw networkError;
        }
        throw error;
    }
}

/**
 * Sign in with Apple on native iOS.
 *
 * @returns {Promise<import('firebase/auth').UserCredential>} Firebase user credential
 */
export async function signInWithApple() {
    if (!isIOS()) {
        const platformError = new Error('Apple sign-in is only available on iOS.');
        platformError.code = 'auth/operation-not-supported-in-this-environment';
        throw platformError;
    }
    return signInWithAppleNative();
}

async function signInWithAppleNative() {
    try {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');

        const result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({
            idToken: result.credential?.idToken,
            rawNonce: result.credential?.nonce,
        });
        return signInWithCredential(auth, credential);
    } catch (error) {
        // Map common native errors to user-friendly messages
        if (error.message?.includes('canceled') || error.message?.includes('cancelled')) {
            const cancelError = new Error('Sign-in cancelled. Please try again.');
            cancelError.code = 'auth/popup-closed-by-user';
            throw cancelError;
        }
        if (error.message?.includes('network')) {
            const networkError = new Error('Network error during Apple sign-in. Please check your connection.');
            networkError.code = 'auth/network-request-failed';
            throw networkError;
        }
        throw error;
    }
}

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Web Google Sign-In via Firebase popup.
 * Includes App Check token pre-fetch for reliability.
 */
async function signInWithGoogleWeb() {
    // Ensure App Check token is ready before Google sign-in
    try {
        const tokenResult = await Promise.race([
            ensureAppCheckToken(true),
            delay(5000).then(() => null) // 5s timeout returns null
        ]);
        if (!tokenResult) {
            console.warn('[AuthService] App Check token pre-fetch timed out or returned null');
        }
    } catch (appCheckErr) {
        console.warn('[AuthService] App Check pre-fetch failed for Google sign-in:', appCheckErr);
    }

    // Small delay to allow SDK state to sync
    await delay(200);

    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
}

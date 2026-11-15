/* src/contexts/user/userAuth.js */
import { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, ensureAppCheckToken } from '../../firebaseConfig'; // Adjust path if needed
import { withDeadline, isDeadlineError } from '../../utils/promiseDeadline';

// validateAuthToken forces an ID-token refresh, which waits on App Check first — and a
// wedged App Check SDK never answers. Bound it so the game-start error path can't hang.
const VALIDATE_TOKEN_DEADLINE_MS = 10000;

/**
 * Custom hook to listen for Firebase auth state changes.
 * Provides the authenticated user object, a flag indicating if the initial
 * auth state has been resolved, and a flag indicating if the user ID changed.
 *
 * @returns {{
 *  authUser: object | null,       // The Firebase user object or null
 *  isAuthResolved: boolean,      // True once the listener has fired at least once
 *  authUserIdChanged: boolean,  // True if the UID changed from the previous state
 * }}
 */
export const useAuthStateListener = () => {
    // Initialize authUser to null, rely on listener for the definite state
    const [authUser, setAuthUser] = useState(null);
    // NEW STATE: Track if the listener has run at least once to resolve initial state
    const [isAuthResolved, setIsAuthResolved] = useState(false);
    // Flag to signal when the UID specifically changes (login/logout)
    const [authUserIdChanged, setAuthUserIdChanged] = useState(false);
    // Flag to track if auth token is stale (failed to refresh)
    const [isAuthStale, setIsAuthStale] = useState(false);
    // Ref to store the previous UID for comparison
    const previousUidRef = useRef(null);
    // Ref to prevent setting resolved state multiple times unnecessarily
    const resolvedStateSet = useRef(false);

    useEffect(() => {
        // console.log("[useAuthStateListener] Setting up Firebase auth listener."); // Optional debug log

        // Reset resolved state flag when the effect re-runs (though it shouldn't with empty deps)
        resolvedStateSet.current = false;

        const listener = onAuthStateChanged(auth, (user) => {
            const currentUid = user?.uid || null;
            // console.log(`[useAuthStateListener] Auth state changed. User: ${user ? user.uid : 'null'}. Previous UID: ${previousUidRef.current}`); // Optional debug log

            // Check if the User ID itself has changed (login/logout)
            if (currentUid !== previousUidRef.current) {
                // console.log(`[useAuthStateListener] Auth ID changed: ${previousUidRef.current || 'none'} -> ${currentUid || 'none'}`); // Optional debug log
                setAuthUserIdChanged(true); // Signal the change for context resets
            } else {
                setAuthUserIdChanged(false); // Reset if ID is the same (e.g., token refresh)
            }

            setAuthUser(user); // Update the user state
            previousUidRef.current = currentUid; // Update the ref for the *next* comparison

            // Mark auth as resolved *after* the first callback runs.
            // Use the ref to ensure it only happens once per listener setup.
            if (!resolvedStateSet.current) {
                // console.log("[useAuthStateListener] Auth state has been resolved."); // Optional debug log
                setIsAuthResolved(true);
                resolvedStateSet.current = true; // Mark as set
            }
        });

        // Cleanup function to unsubscribe the listener
        return () => {
            // console.log("[useAuthStateListener] Cleaning up Firebase auth listener."); // Optional debug log
            listener(); // Unsubscribe
            // Optionally reset state on cleanup if needed, although re-mount will re-initialize
            // setIsAuthResolved(false);
            // setAuthUser(null);
            // previousUidRef.current = null;
        };
    }, []); // Empty dependency array: run only once on mount

    // Proactive token refresh to prevent expiration during long idle periods
    // Firebase ID tokens expire after ~1 hour; refresh every 45 minutes to stay ahead
    // Also refreshes when user returns to tab or network reconnects
    useEffect(() => {
        if (!authUser) return; // No user, no need to refresh

        const REFRESH_INTERVAL = 45 * 60 * 1000; // 45 minutes in milliseconds

        const refreshToken = async () => {
            try {
                await auth.currentUser?.getIdToken(true);
                setIsAuthStale(false);
            } catch (error) {
                console.warn('[Auth] Proactive token refresh failed:', error.message);
                // Don't sign out - let the existing error handling deal with actual failures
                // Just mark auth as potentially stale so we know to be careful
                setIsAuthStale(true);
            }
            // Also refresh App Check token (fire-and-forget)
            // Browsers throttle timers in background tabs, so App Check auto-refresh
            // may not keep up — this ensures it stays fresh alongside the auth token
            ensureAppCheckToken(true).catch(err =>
                console.warn('[Auth] App Check token refresh failed:', err.message)
            );
        };

        // Handler for when user returns to the tab (browsers throttle timers in background tabs)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshToken();
            }
        };

        // Handler for when browser thinks network is back (useful after sleep/disconnect)
        const handleOnline = () => {
            refreshToken();
        };

        // Set up interval for periodic refresh (fallback for when tab stays active)
        const intervalId = setInterval(refreshToken, REFRESH_INTERVAL);

        // Add event listeners for visibility and network changes
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('online', handleOnline);

        // Also refresh immediately on mount if user is logged in
        // This handles the case where the app was in a background tab for a while
        refreshToken();

        // Cleanup: remove interval and event listeners
        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('online', handleOnline);
        };
    }, [authUser]);

    /**
     * Validates that the current auth token is still valid.
     * Call this before critical operations (starting a game, saving results).
     * Forces a token refresh - if the refresh fails, auth is stale and user needs to re-login.
     *
     * @returns {Promise<boolean>} True if auth is valid, false if stale
     */
    const validateAuthToken = useCallback(async () => {
        if (!auth.currentUser) {
            return false;
        }

        try {
            // Force token refresh - if this fails, the refresh token is invalid/expired
            await withDeadline(auth.currentUser.getIdToken(true), VALIDATE_TOKEN_DEADLINE_MS, {
                label: 'Auth token validation',
                code: 'idtoken-validate-deadline',
            });
            setIsAuthStale(false);
            return true;
        } catch (error) {
            // A network failure or a hung refresh says nothing about the session's validity.
            // Returning false here would sign the user out on a flaky/VPN network — the
            // worse failure — so treat it as inconclusive (mirrors Firebase's own
            // _logoutIfInvalidated, which only logs out on explicit invalid-token codes).
            if (isDeadlineError(error) || error?.code === 'auth/network-request-failed') {
                console.warn('[Auth] Token validation inconclusive (network):', error.message);
                return true;
            }
            console.error('[Auth] Token validation failed:', error.message);
            setIsAuthStale(true);
            return false;
        }
    }, []);

    // Return the auth user, the resolved status, the change flag, and auth validation
    return { authUser, isAuthResolved, authUserIdChanged, isAuthStale, validateAuthToken };
};
/* File: src/components/auth/LoginScreen.js */
/* Cognitive Lab Theme - Scientific Authentication Interface */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider
} from 'firebase/auth';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import * as Sentry from '@sentry/react';
import { auth, ensureAppCheckToken } from '../../firebaseConfig';
import { trackEvent } from '../../utils/analyticsTracker';
import ButtonSpinner from '../ui/ButtonSpinner';
import { signInWithGoogle, signInWithApple } from '../../services/authService';
import { isNative, isIOS } from '../../utils/platform';

const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
const VERIFY_RECAPTCHA_URL = process.env.REACT_APP_VERIFY_LOGIN_URL;

// Maximum number of retry attempts for App Check errors
const MAX_APP_CHECK_RETRIES = 3;
// Base delay between retries (ms) - will be multiplied by attempt number
const RETRY_BASE_DELAY_MS = 500;
// Delay after token refresh before auth attempt (ms)
const POST_TOKEN_REFRESH_DELAY_MS = 200;

/**
 * Check if an error is related to App Check token issues
 */
const isAppCheckError = (err) => {
    if (!err) return false;
    return (
        err.code === 'auth/firebase-app-check-token-is-invalid.' ||
        err.code === 'auth/app-check-token-is-invalid' ||
        err.message?.includes('App Check token is invalid') ||
        err.message?.includes('app-check-token-is-invalid')
    );
};

/**
 * Get browser and environment info for diagnostics
 */
const getBrowserInfo = () => {
    const ua = navigator.userAgent || '';
    const isFirefox = ua.includes('Firefox');
    const isSafari = ua.includes('Safari') && !ua.includes('Chrome');
    const isChrome = ua.includes('Chrome') && !ua.includes('Edg');
    const isEdge = ua.includes('Edg');

    // Attempt to detect private browsing (not 100% reliable)
    let possiblePrivateMode = false;
    try {
        // Firefox private mode has limited storage
        if (isFirefox && !navigator.serviceWorker) {
            possiblePrivateMode = true;
        }
        // Check if storage is restricted (common in private mode)
        const testKey = '__storage_test__';
        localStorage.setItem(testKey, testKey);
        localStorage.removeItem(testKey);
    } catch (e) {
        possiblePrivateMode = true;
    }

    return {
        browser: isFirefox ? 'Firefox' : isSafari ? 'Safari' : isChrome ? 'Chrome' : isEdge ? 'Edge' : 'Other',
        userAgent: ua.substring(0, 200), // Truncate for Sentry
        possiblePrivateMode,
        cookiesEnabled: navigator.cookieEnabled,
    };
};

/**
 * Simple delay helper
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getFriendlyErrorMessage = (errorCode) => {
    switch (errorCode) {
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/user-disabled':
            return 'This account has been disabled.';
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return 'Incorrect email or password. Please try again.';
        case 'auth/too-many-requests':
            return 'Access temporarily disabled due to too many failed login attempts. Please reset your password or try again later.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection and try again.';
        case 'auth/firebase-app-check-token-is-invalid.':
        case 'auth/app-check-token-is-invalid':
            return 'Security verification failed. Please try again, or if the issue persists, try using a regular browser window instead of private/incognito mode.';
        case 'auth/internal-error':
            return 'Login temporarily unavailable. Please refresh the page and try again.';
        case 'auth/missing-password':
            return 'Please enter your password.';
        case 'auth/operation-not-allowed':
            return 'This sign-in method is not enabled. Please contact support.';
        default:
            console.error("Unhandled Firebase Login Error Code:", errorCode);
            return 'An unexpected error occurred during login. Please try again.';
    }
};

const isNonRetryableError = (code) => [
    'auth/invalid-email',
    'auth/user-disabled',
    'auth/invalid-credential',
    'auth/user-not-found',
    'auth/wrong-password',
    'auth/missing-password',
    'auth/too-many-requests',
    'auth/network-request-failed',
    'auth/operation-not-allowed',
].includes(code);

const getOAuthSignInErrorMessage = (errorCode, providerName) => {
    switch (errorCode) {
        case 'auth/popup-closed-by-user':
            return 'Sign-in cancelled. Please try again.';
        case 'auth/cancelled-popup-request':
            return 'Sign-in cancelled. Only one sign-in window can be open at a time.';
        case 'auth/popup-blocked':
            return 'Sign-in popup blocked by browser. Please enable popups for this site and try again.';
        case 'auth/account-exists-with-different-credential':
            return 'An account already exists with this email address using Email/Password. Please sign in using your password, or reset it if needed.';
        case 'auth/network-request-failed':
            return `Network error during ${providerName} sign-in. Please check your connection.`;
        default:
            console.error(`Unhandled Firebase ${providerName} Sign-In Error Code:`, errorCode);
            return `An unexpected error occurred during ${providerName} sign-in. Please try again.`;
    }
};

// Echo Mark Logo Component
const EchoMarkLogo = () => (
    <svg width="56" height="56" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="44" y="44" width="48" height="48" rx="8" fill="none" stroke="#E4B85C" strokeWidth="3" opacity="0.4" />
        <rect x="28" y="28" width="48" height="48" rx="8" fill="#E4B85C" />
    </svg>
);

const LoginScreen = ({ onSwitchToReset }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);
    const [googleError, setGoogleError] = useState(null);
    const [appleError, setAppleError] = useState(null);
    const [configError, setConfigError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        let errorMsg = null;
        if (!RECAPTCHA_SITE_KEY) {
            console.error("CRITICAL: REACT_APP_RECAPTCHA_SITE_KEY environment variable is not set.");
            errorMsg = "Configuration error (RCK_SK). ";
        }
        if (!VERIFY_RECAPTCHA_URL) {
            console.error("CRITICAL: REACT_APP_VERIFY_LOGIN_URL environment variable is not set.");
            errorMsg = (errorMsg || "") + "Configuration error (RCK_URL).";
        }
        if (errorMsg) {
            setConfigError(errorMsg + " Please contact support.");
        }
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Proactively refresh App Check token on mount and visibility change.
    // When AuthGuard redirects here from an expired session, the App Check token
    // is likely stale (browsers throttle auto-refresh in background tabs).
    // Starting the refresh early gives the provider time to obtain a fresh token
    // before the user submits the form.
    useEffect(() => {
        ensureAppCheckToken(true).catch(() => {});

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                ensureAppCheckToken(true).catch(() => {});
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        // Clear reload flag on fresh mount so a prior reload attempt doesn't
        // persist across separate login sessions
        sessionStorage.removeItem('appcheck_reload_attempted');

        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);
        setGoogleError(null);
        setAppleError(null);
        if (configError && !isNative()) {
            setError(configError);
            return;
        }

        // On native, skip reCAPTCHA entirely (App Check provides protection)
        if (!isNative()) {
            if (typeof window.grecaptcha === 'undefined' || typeof window.grecaptcha.enterprise === 'undefined') {
                console.error("reCAPTCHA script not loaded or ready.");
                setError("Security system failed to load. Please refresh and try again.");
                return;
            }
        }

        setIsLoading(true);

        // Native login flow: skip reCAPTCHA, go straight to Firebase Auth
        if (isNative()) {
            try {
                // Ensure App Check token is ready
                try {
                    const tokenResult = await Promise.race([
                        ensureAppCheckToken(true),
                        delay(5000).then(() => null)
                    ]);
                    if (!tokenResult) {
                        console.warn('[Login] Native: App Check token pre-fetch timed out or returned null');
                    }
                } catch (appCheckErr) {
                    console.warn('[Login] Native: App Check pre-fetch failed:', appCheckErr);
                }
                if (!isMountedRef.current) return;

                // Small delay after token refresh
                await delay(POST_TOKEN_REFRESH_DELAY_MS);
                if (!isMountedRef.current) return;

                await signInWithEmailAndPassword(auth, email, password);
                trackEvent('login', { method: 'email' });
                // Auth state change will redirect
            } catch (err) {
                let displayError = err;
                let retryCount = 0;

                // Retry for App Check errors on native
                if (isAppCheckError(err)) {
                    while (retryCount < MAX_APP_CHECK_RETRIES) {
                        retryCount++;
                        try {
                            await ensureAppCheckToken(true);
                            await delay(RETRY_BASE_DELAY_MS * retryCount);
                            if (!isMountedRef.current) return;
                            await signInWithEmailAndPassword(auth, email, password);
                            return;
                        } catch (retryErr) {
                            displayError = retryErr;
                            if (!isAppCheckError(retryErr)) break;
                        }
                    }
                }

                console.error("[Login] Native login error:", displayError);
                Sentry.captureException(displayError, {
                    tags: {
                        context: 'login',
                        method: 'email_password',
                        platform: 'native',
                        retryCount: String(retryCount),
                    },
                    extra: {
                        errorCode: displayError.code,
                        errorMessage: displayError.message,
                        originalErrorCode: retryCount > 0 ? err.code : undefined,
                    }
                });
                if (isMountedRef.current) {
                    const friendlyError = displayError.code?.startsWith('auth/')
                        ? getFriendlyErrorMessage(displayError.code)
                        : (displayError.message || 'An unexpected error occurred during login.');
                    setError(friendlyError);
                    setIsLoading(false);
                }
            }
            return;
        }

        // Web login flow: reCAPTCHA verification first
        try {
            window.grecaptcha.enterprise.ready(async () => {
                if (!isMountedRef.current) return;

                // Declared before try/catch so it's accessible in the catch block for Sentry diagnostics
                let initialTokenObtained = false;

                try {
                    const token = await window.grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, { action: 'LOGIN' });
                    if (!isMountedRef.current) return;

                    const verifyResponse = await fetch(VERIFY_RECAPTCHA_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ recaptchaToken: token }),
                    });
                    if (!isMountedRef.current) return;

                    if (!verifyResponse.ok) {
                        let backendErrorMsg = 'Security verification failed.';
                        try {
                            const errorData = await verifyResponse.json();
                            backendErrorMsg = errorData.error || backendErrorMsg;
                        } catch (parseError) {
                            backendErrorMsg = `Security check failed (Status: ${verifyResponse.status})`;
                        }
                        throw new Error(backendErrorMsg);
                    }

                    // Ensure App Check token is ready before Firebase Auth
                    // Force-refresh to prevent stale/degraded tokens in privacy browsers
                    try {
                        const tokenResult = await Promise.race([
                            ensureAppCheckToken(true),
                            delay(5000).then(() => null) // 5s timeout returns null
                        ]);
                        initialTokenObtained = !!tokenResult;
                        if (!tokenResult) {
                            console.warn('[Login] App Check token pre-fetch timed out or returned null');
                        }
                    } catch (appCheckErr) {
                        console.warn('[Login] App Check pre-fetch failed:', appCheckErr);
                        // Continue anyway - Firebase may have the token cached
                    }
                    if (!isMountedRef.current) return;

                    // Small delay after token refresh to allow SDK state to sync
                    await delay(POST_TOKEN_REFRESH_DELAY_MS);
                    if (!isMountedRef.current) return;

                    await signInWithEmailAndPassword(auth, email, password);
                    trackEvent('login', { method: 'email' });
                    // Auth state change will redirect - no need to setIsLoading(false)

                } catch (err) {
                    let displayError = err;
                    let retryCount = 0;
                    const browserInfo = getBrowserInfo();

                    // Determine if we should retry based on error type
                    const isRetryableAppCheckError = isAppCheckError(err);
                    const isOtherRetryableAuthError = err.code?.startsWith('auth/') && !isNonRetryableError(err.code) && !isAppCheckError(err);
                    const shouldRetry = isRetryableAppCheckError || isOtherRetryableAuthError;

                    // Retry loop with exponential backoff for App Check errors
                    if (shouldRetry) {
                        const maxRetries = isRetryableAppCheckError ? MAX_APP_CHECK_RETRIES : 1;

                        while (retryCount < maxRetries) {
                            retryCount++;
                            const retryDelay = RETRY_BASE_DELAY_MS * retryCount;

                            try {
                                // Force refresh App Check token
                                const retryToken = await ensureAppCheckToken(true);
                                if (!retryToken) {
                                    console.warn('[Login] Retry %d: Token refresh returned null', retryCount);
                                }

                                // Wait with exponential backoff
                                await delay(retryDelay);
                                if (!isMountedRef.current) return;

                                // Attempt login again
                                await signInWithEmailAndPassword(auth, email, password);
                                // Success - exit function
                                return;
                            } catch (retryErr) {
                                console.error('[Login] Retry %d failed:', retryCount, retryErr.code || retryErr.message);
                                displayError = retryErr;

                                // If this retry error is not an App Check error, stop retrying
                                if (!isAppCheckError(retryErr)) {
                                    break;
                                }
                            }
                        }
                    }

                    // If App Check error persists after all retries, try a one-time
                    // hard reload to completely reinitialize reCAPTCHA + App Check SDK
                    if (isAppCheckError(displayError)) {
                        const alreadyReloaded = sessionStorage.getItem('appcheck_reload_attempted');
                        if (!alreadyReloaded) {
                            sessionStorage.setItem('appcheck_reload_attempted', 'true');
                            window.location.reload();
                            return;
                        }
                        // Already reloaded once — clear flag and show error as usual
                        sessionStorage.removeItem('appcheck_reload_attempted');
                    }

                    console.error("[Login] Error during login process:", displayError);
                    Sentry.captureException(displayError, {
                        tags: {
                            context: 'login',
                            method: 'email_password',
                            errorCode: displayError.code || 'unknown',
                            retryCount: String(retryCount),
                            browser: browserInfo.browser,
                            possiblePrivateMode: String(browserInfo.possiblePrivateMode),
                        },
                        extra: {
                            errorCode: displayError.code,
                            errorMessage: displayError.message,
                            originalErrorCode: retryCount > 0 ? err.code : undefined,
                            originalErrorMessage: retryCount > 0 ? err.message : undefined,
                            browserInfo,
                            maxRetriesAttempted: retryCount,
                            initialTokenObtained,
                        }
                    });
                    if (isMountedRef.current) {
                        let friendlyError;
                        if (isAppCheckError(displayError)) {
                            // More helpful message for App Check errors, especially for Firefox/private browsing
                            if (browserInfo.possiblePrivateMode || browserInfo.browser === 'Firefox') {
                                friendlyError = 'Security verification failed. This can happen in private/incognito browsing. Please try using a regular browser window.';
                            } else {
                                friendlyError = 'Security verification failed. Please refresh the page and try again.';
                            }
                        } else if (displayError.message && (displayError.message.startsWith('Security check failed') || displayError.message.startsWith('Security verification failed'))) {
                            friendlyError = displayError.message;
                        } else if (displayError.code && displayError.code.startsWith('auth/')) {
                            friendlyError = getFriendlyErrorMessage(displayError.code);
                        } else if (displayError instanceof TypeError && displayError.message === 'Failed to fetch') {
                            friendlyError = "Network error verifying security. Please check connection.";
                        } else if (displayError.message && displayError.message.includes('grecaptcha')) {
                            friendlyError = "Error during security check. Please refresh and try again.";
                        } else {
                            friendlyError = displayError.message || 'An unexpected error occurred during login.';
                        }
                        setError(friendlyError);
                        setIsLoading(false);
                    }
                }
            });

        } catch (outerError) {
            console.error("[Login] Pre-reCAPTCHA error:", outerError);
            Sentry.captureException(outerError, {
                tags: { context: 'login', method: 'email_password', stage: 'pre_recaptcha' }
            });
            if (isMountedRef.current) {
                setError(outerError.message || "Failed to initiate secure login.");
                setIsLoading(false);
            }
        }
    };

    const handleGoogleLogin = async () => {
        setError(null);
        setGoogleError(null);
        setAppleError(null);
        setIsLoading(true);

        try {
            // Use unified auth service (handles native vs web automatically)
            await signInWithGoogle();
            trackEvent('login', { method: 'google' });
            // Auth state change will redirect - no need to setIsLoading(false)
        } catch (firebaseError) {
            console.error("[Login] Google Sign-In Error:", firebaseError.code, firebaseError.message);
            Sentry.captureException(firebaseError, {
                tags: { context: 'login', method: 'google', platform: isNative() ? 'native' : 'web' },
                extra: { errorCode: firebaseError.code, errorMessage: firebaseError.message }
            });
            if (isMountedRef.current) {
                // Handle App Check token invalid error specifically
                if (firebaseError.code === 'auth/firebase-app-check-token-is-invalid.' ||
                    firebaseError.code === 'auth/app-check-token-is-invalid' ||
                    firebaseError.message?.includes('App Check token is invalid')) {
                    setGoogleError('Security verification expired. Please refresh the page and try again.');
                } else {
                    setGoogleError(getOAuthSignInErrorMessage(firebaseError.code, 'Google'));
                }
                setIsLoading(false);
            }
        }
    };

    const handleAppleLogin = async () => {
        setError(null);
        setGoogleError(null);
        setAppleError(null);
        setIsLoading(true);

        try {
            await signInWithApple();
            trackEvent('login', { method: 'apple' });
            // Auth state change will redirect - no need to setIsLoading(false)
        } catch (firebaseError) {
            console.error("[Login] Apple Sign-In Error:", firebaseError.code, firebaseError.message);
            Sentry.captureException(firebaseError, {
                tags: { context: 'login', method: 'apple', platform: isNative() ? 'native' : 'web' },
                extra: { errorCode: firebaseError.code, errorMessage: firebaseError.message }
            });
            if (isMountedRef.current) {
                // Handle App Check token invalid error specifically
                if (firebaseError.code === 'auth/firebase-app-check-token-is-invalid.' ||
                    firebaseError.code === 'auth/app-check-token-is-invalid' ||
                    firebaseError.message?.includes('App Check token is invalid')) {
                    setAppleError('Security verification expired. Please refresh the page and try again.');
                } else {
                    setAppleError(getOAuthSignInErrorMessage(firebaseError.code, 'Apple'));
                }
                setIsLoading(false);
            }
        }
    };

    const navigateToReset = useCallback(() => {
        if (onSwitchToReset && typeof onSwitchToReset === 'function') {
            onSwitchToReset();
        } else {
            console.error("LoginScreen: onSwitchToReset prop missing or not a function!");
            alert("Password reset navigation error. Please contact support if needed.");
        }
    }, [onSwitchToReset]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-theme-bg px-4">
            <div className={`bg-theme-bg-secondary border border-theme-line p-8 rounded-lg shadow-lab w-full max-w-sm transition-opacity duration-200 ${isLoading ? 'opacity-80' : 'opacity-100'}`}>
                {/* Logo and Title */}
                <div className="flex flex-col items-center mb-6">
                    <div className="mb-3">
                        <EchoMarkLogo />
                    </div>
                    <h1 className="text-xl font-bold text-center text-theme-text font-sans">Dual N-Back</h1>
                    <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted mt-1 font-mono uppercase tracking-wider">Subject Authentication</p>
                </div>

                {/* Configuration Error Display */}
                {configError && (
                    <p className="mb-4 text-sm text-neural-synapse bg-neural-synapse/10 p-3 rounded border border-neural-synapse/30 text-center" role="alert">
                        {configError}
                    </p>
                )}

                {/* Primary: Continue with Google */}
                <button type="button" onClick={handleGoogleLogin}
                    disabled={isLoading || !!configError}
                    className="py-3 px-4 border border-theme-accent/50 rounded text-sm font-mono text-theme-text bg-theme-bg-elevated hover:bg-theme-bg-surface hover:border-theme-accent glow-amber-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal-surface focus:ring-theme-accent w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    aria-label="Continue with Google"
                >
                    {isLoading ? (
                        <>
                            <ButtonSpinner color="amber" />
                            <span className="ml-2">Processing...</span>
                        </>
                    ) : (
                        <>
                            <i className="fa-brands fa-google mr-2.5 text-base text-theme-accent" aria-hidden="true"></i>
                            Continue with Google
                        </>
                    )}
                </button>

                {/* Google Sign-in Error Message Area */}
                {googleError && (
                    <p className="mt-3 text-sm text-neural-synapse bg-neural-synapse/10 p-3 rounded border border-neural-synapse/30 text-center" role="alert">
                        {googleError}
                    </p>
                )}

                {isIOS() && (
                    <>
                        <button type="button" onClick={handleAppleLogin}
                            disabled={isLoading || !!configError}
                            className="mt-3 py-3 px-4 border border-theme-line rounded text-sm font-mono text-theme-text bg-theme-bg-elevated hover:bg-theme-bg-surface hover:border-theme-accent/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal-surface focus:ring-theme-accent w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all group"
                            aria-label="Continue with Apple"
                        >
                            {isLoading ? (
                                <>
                                    <ButtonSpinner color="amber" />
                                    <span className="ml-2">Processing...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fa-brands fa-apple mr-2.5 text-base text-theme-accent" aria-hidden="true"></i>
                                    Continue with Apple
                                </>
                            )}
                        </button>

                        {appleError && (
                            <p className="mt-3 text-sm text-neural-synapse bg-neural-synapse/10 p-3 rounded border border-neural-synapse/30 text-center" role="alert">
                                {appleError}
                            </p>
                        )}
                    </>
                )}

                {/* Divider */}
                <div className="my-5 flex items-center">
                    <div className="flex-grow border-t border-theme-line"></div>
                    <span className="flex-shrink mx-4 text-theme-text-muted text-[0.6875rem] font-mono uppercase tracking-[0.22em]">or</span>
                    <div className="flex-grow border-t border-theme-line"></div>
                </div>

                {/* Email/Password Login Form */}
                <form onSubmit={handleLogin} noValidate>
                    <div className="mb-4">
                        <label htmlFor="login-email" className="block text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider text-theme-text-muted mb-2">Email Address</label>
                        <input
                            type="email" id="login-email" value={email} onChange={(e) => setEmail(e.target.value)} required
                            disabled={isLoading || !!configError}
                            className="w-full px-3 py-2.5 bg-theme-bg-elevated border border-theme-line rounded text-theme-text placeholder-warm-muted/50 focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-theme-accent font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="you@example.com" aria-label="Email Address" autoComplete="email"
                        />
                    </div>
                    <div className="mb-3">
                        <div className="flex justify-between items-center mb-2">
                            <label htmlFor="login-password" className="block text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider text-theme-text-muted">Password</label>
                            <button type="button" onClick={navigateToReset}
                                disabled={isLoading || !!configError}
                                className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-accent hover:text-amber-highlight disabled:text-theme-text-muted disabled:cursor-not-allowed">
                                Forgot password?
                            </button>
                        </div>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} required
                                disabled={isLoading || !!configError}
                                className="w-full px-3 py-2.5 pr-10 bg-theme-bg-elevated border border-theme-line rounded text-theme-text placeholder-warm-muted/50 focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-theme-accent font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="••••••••" aria-label="Password" autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(s => !s)}
                                tabIndex={-1}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                className="absolute inset-y-0 right-0 px-3 flex items-center text-theme-text-muted hover:text-theme-accent focus:outline-none transition-colors"
                            >
                                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="text-sm" />
                            </button>
                        </div>
                    </div>

                    {/* General Error Message Area */}
                    {error && !configError && (
                        <p className="mb-4 text-sm text-neural-synapse bg-neural-synapse/10 p-3 rounded border border-neural-synapse/30 text-center" role="alert">
                            {error}
                        </p>
                    )}

                    {/* Email Login Submit Button */}
                    <button type="submit"
                        disabled={isLoading || !!configError}
                        className="py-2.5 px-4 rounded text-sm font-mono uppercase tracking-wider text-theme-bg bg-theme-accent hover:bg-amber-highlight focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal-surface focus:ring-theme-accent w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                        {isLoading ? (
                            <>
                                <ButtonSpinner color="charcoal" />
                                <span className="ml-2">Authenticating...</span>
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>

                {/* Link to Sign Up */}
                <div className="mt-6 text-sm text-center">
                    <span className="text-theme-text-muted font-mono text-xs">New subject?</span>{' '}
                    {/* react-router Link, not a raw <a href>: an anchor triggers a full
                        document reload, which on native flashes the WebView's default
                        white background and re-parses the whole bundle. Link still
                        renders a real <a href>, so open-in-new-tab keeps working on web. */}
                    <Link
                        to={`/signup${window.location.search}`}
                        onClick={() => trackEvent('signup_cta_click', { cta_location: 'login_link' })}
                        className="font-mono text-xs text-theme-accent hover:text-amber-highlight"
                    >
                        Create Account
                    </Link>
                </div>

                {/* reCAPTCHA Branding (hidden on native since reCAPTCHA is not used) */}
                {/* Per Google's April 2026 reCAPTCHA policy update: only the branding line is required;
                    references to Google's Privacy Policy and Terms of Use have been removed. */}
                {!isNative() && (
                    <div className="mt-6 text-center text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted/60 font-mono" style={{ visibility: 'visible' }}>
                        Protected by reCAPTCHA.
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoginScreen;

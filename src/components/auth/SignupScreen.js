/* File: src/components/auth/SignupScreen.js */
/* Cognitive Lab Theme - Subject Registration Interface */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    updateProfile
} from 'firebase/auth';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faChevronDown, faQuoteLeft } from '@fortawesome/free-solid-svg-icons';
import { functions as functionsInstance, isEmulatorEnv, ensureAppCheckToken } from '../../firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { trackEvent } from '../../utils/analyticsTracker';
import { auth } from '../../firebaseConfig';
import { PRICE_IDS } from '../../constants/stripeConstants';
import LoadingSpinner from '../ui/LoadingSpinner';
import ButtonSpinner from '../ui/ButtonSpinner';
import { useUser } from '../../contexts/UserContext';
import { validateName, NAME_MAX_LENGTH } from '../../utils/nameValidation';
import { signInWithGoogle, signInWithApple } from '../../services/authService';
import { startNativeCheckoutFlow } from '../../services/paymentService';
import { isNative, isIOS } from '../../utils/platform';

const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
const VERIFY_SIGNUP_URL = process.env.REACT_APP_VERIFY_SIGNUP_URL;

// Echo Mark Logo Component
const EchoMarkLogo = () => (
    <svg width="56" height="56" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="44" y="44" width="48" height="48" rx="8" fill="none" stroke="#E4B85C" strokeWidth="3" opacity="0.4" />
        <rect x="28" y="28" width="48" height="48" rx="8" fill="#E4B85C" />
    </svg>
);

// DOM-based overlay for checkout redirect
const createFullscreenOverlay = () => {
    if (document.getElementById('immediate-checkout-overlay')) {
        return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'immediate-checkout-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = '#0D0B09';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';

    const logo = document.createElement('div');
    logo.innerHTML = `<svg width="56" height="56" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="44" y="44" width="48" height="48" rx="8" fill="none" stroke="#E4B85C" stroke-width="3" opacity="0.4"/>
        <rect x="28" y="28" width="48" height="48" rx="8" fill="#E4B85C"/>
    </svg>`;
    logo.style.marginBottom = '24px';

    const message = document.createElement('h2');
    message.style.fontSize = '16px';
    message.style.fontFamily = 'monospace';
    message.style.textTransform = 'uppercase';
    message.style.letterSpacing = '0.1em';
    message.style.color = '#F0ECE6';
    message.style.marginBottom = '8px';
    message.innerText = 'Redirecting to Secure Checkout';

    const spinner = document.createElement('div');
    spinner.style.width = '32px';
    spinner.style.height = '32px';
    spinner.style.border = '2px solid rgba(228, 184, 92, 0.2)';
    spinner.style.borderRadius = '50%';
    spinner.style.borderTopColor = '#E4B85C';
    spinner.style.marginTop = '24px';
    spinner.style.animation = 'spin 1s linear infinite';

    const style = document.createElement('style');
    style.innerHTML = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);

    overlay.appendChild(logo);
    overlay.appendChild(message);
    overlay.appendChild(spinner);
    document.body.appendChild(overlay);
    overlay.getBoundingClientRect();

    return overlay;
};

const performRedirect = (checkoutUrl) => {
    localStorage.setItem('pendingCheckoutUrl', checkoutUrl);
    createFullscreenOverlay();
    setTimeout(() => {
        window.location.href = '/checkout-redirect.html';
    }, 100);
};

let initiateSubscriptionCheckout = null;
let initializeFreeUser = null;
try {
    if (functionsInstance) {
        initiateSubscriptionCheckout = httpsCallable(functionsInstance, 'initiateSubscriptionCheckout');
        initializeFreeUser = httpsCallable(functionsInstance, 'initializeFreeUser');
    }
} catch (error) {
    console.error("SignupScreen: Error getting Firebase Functions reference:", error);
}

const getFriendlySignupErrorMessage = (errorCode) => {
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return 'This email address is already registered. Please try logging in.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/weak-password':
            return 'Password is too weak. Please choose a stronger password (at least 6 characters).';
        default:
            return 'An unexpected error occurred during signup. Please try again.';
    }
};

const getOAuthSignInErrorMessage = (errorCode, providerName) => {
    switch (errorCode) {
        case 'auth/popup-closed-by-user':
            return 'Sign-up cancelled. Please try again.';
        case 'auth/cancelled-popup-request':
            return 'Sign-up cancelled. Only one sign-up window can be open at a time.';
        case 'auth/popup-blocked':
            return 'Sign-up popup blocked by browser. Please enable popups for this site.';
        case 'auth/account-exists-with-different-credential':
            return 'An account already exists with this email using Email/Password. Please sign in with your password.';
        case 'auth/network-request-failed':
            return `Network error during ${providerName} sign-up. Please check your connection.`;
        default:
            return `An unexpected error occurred during ${providerName} sign-up. Please try again.`;
    }
};

const SignupScreen = ({ onSwitchToLogin }) => {
    const navigate = useNavigate();
    const [displayName, setDisplayName] = useState('');
    const [nameError, setNameError] = useState(null);
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState(null);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState(null);
    const [marketingOptIn, setMarketingOptIn] = useState(false);
    // Progressive-disclosure state: email fields hidden until user clicks "Continue with email"
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);
    const [googleError, setGoogleError] = useState(null);
    const [appleError, setAppleError] = useState(null);
    const [selectedPriceId, setSelectedPriceId] = useState(null);
    const [planError, setPlanError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isVerifyingPlan, setIsVerifyingPlan] = useState(true);
    const [configError, setConfigError] = useState(null);
    const [isFreeSignup, setIsFreeSignup] = useState(false);

    // Refs for focusing on invalid fields
    const nameInputRef = useRef(null);
    const emailInputRef = useRef(null);
    const passwordInputRef = useRef(null);

    const {
        authUser, isAuthLoading, refreshUserData,
        setSubscriptionPlatform, setUserSubscriptionStatus, setSubscriptionTier,
    } = useUser();

    const isMountedRef = useRef(true);
    const componentInstanceId = useRef(`SignupScreen-${Date.now()}`).current;
    const redirectInProgressRef = useRef(false);

    useEffect(() => {
        let errorMsg = null;
        if (!RECAPTCHA_SITE_KEY) errorMsg = "Config error (RCK_SK). ";
        if (!VERIFY_SIGNUP_URL) errorMsg = (errorMsg || "") + "Config error (RCK_URL_S).";
        if (!initiateSubscriptionCheckout) errorMsg = (errorMsg || "") + "Config error (INIT_SUB).";
        if (errorMsg) setConfigError(errorMsg + " Please contact support.");
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        const existingOverlay = document.getElementById('immediate-checkout-overlay');
        if (existingOverlay?.parentNode) existingOverlay.parentNode.removeChild(existingOverlay);
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (isAuthLoading) {
            setIsVerifyingPlan(true);
            return;
        }
        setIsVerifyingPlan(true);
        setSelectedPriceId(null);
        setPlanError(null);

        const pendingRedirect = localStorage.getItem('pendingCheckoutUrl');
        if (pendingRedirect && !isNative()) {
            createFullscreenOverlay();
            redirectInProgressRef.current = true;
            setTimeout(() => { window.location.href = '/checkout-redirect.html'; }, 100);
            return;
        }

        try {
            const params = new URLSearchParams(window.location.search);
            const planId = params.get('plan');
            if (planId && (planId === PRICE_IDS.monthly || planId === PRICE_IDS.yearly)) {
                if (isMountedRef.current) setSelectedPriceId(planId);
            }
        } catch (e) {
            console.error("Error parsing URL params:", e);
        }

        if (isMountedRef.current) setIsVerifyingPlan(false);
    }, [authUser, isAuthLoading]);

    const callInitiateCheckout = useCallback(async (priceId, userId) => {
        // --- Native IAP path: skip Stripe entirely ---
        if (isNative()) {
            const plan = priceId === PRICE_IDS.yearly ? 'yearly' : 'monthly';
            const result = await startNativeCheckoutFlow({ selectedPlan: plan });
            if (result.success) {
                // Set subscription state directly — RevenueCat SDK confirmed the
                // entitlement is active, but the webhook hasn't updated Firestore yet
                setSubscriptionPlatform(isIOS() ? 'ios_iap' : 'android_iap');
                setUserSubscriptionStatus('active');
                setSubscriptionTier('premium');
                navigate('/dashboard');
                return true;
            } else {
                throw new Error(result.error || 'Purchase failed.');
            }
        }

        // --- Web Stripe path ---
        if (!initiateSubscriptionCheckout) throw new Error("Subscription service unavailable.");
        if (!priceId) throw new Error("No plan selected.");
        createFullscreenOverlay();
        redirectInProgressRef.current = true;
        try {
            const result = await initiateSubscriptionCheckout({ priceId, clientVersion: 2 });
            const checkoutUrl = result?.data?.checkoutUrl;
            if (checkoutUrl) {
                performRedirect(checkoutUrl);
                return true;
            } else {
                if (isMountedRef.current) {
                    const overlay = document.getElementById('immediate-checkout-overlay');
                    if (overlay?.parentNode) document.body.removeChild(overlay);
                    redirectInProgressRef.current = false;
                    throw new Error("Could not start the subscription process.");
                }
            }
        } catch (err) {
            if (isMountedRef.current) {
                const overlay = document.getElementById('immediate-checkout-overlay');
                if (overlay?.parentNode) document.body.removeChild(overlay);
                redirectInProgressRef.current = false;
                throw new Error(err.message || "Failed to initiate checkout.");
            }
        }
        return false;
    }, [navigate]);

    const handleEmailAuth = useCallback(() => {
        if (password.length < 6) throw new Error("Password must be at least 6 characters long.");
        return createUserWithEmailAndPassword(auth, email, password);
    }, [email, password]);

    const handleGoogleAuth = useCallback(async () => {
        // Use unified auth service (handles native vs web automatically)
        return signInWithGoogle();
    }, []);

    const handleAppleAuth = useCallback(async () => {
        return signInWithApple();
    }, []);

    const startSignupProcess = useCallback(async (authProvider, preAuthenticatedUser = null) => {
        if (isProcessing || !selectedPriceId || isVerifyingPlan || configError || redirectInProgressRef.current) {
            if (configError && isMountedRef.current) setError(configError);
            return;
        }
        if (!isMountedRef.current) return;

        const isEmailAuth = authProvider === handleEmailAuth;

        // Skip reCAPTCHA check in local development and on native
        if (!isEmulatorEnv && !isNative() && !preAuthenticatedUser && isEmailAuth && (typeof window.grecaptcha === 'undefined' || typeof window.grecaptcha.enterprise === 'undefined')) {
            if (isMountedRef.current) setError("Security system failed to load. Please refresh and try again.");
            return;
        }

        setIsProcessing(true);
        setError(null);
        setGoogleError(null);
        setAppleError(null);

        try {
            let userIdForCheckout = null;

            if (preAuthenticatedUser) {
                userIdForCheckout = preAuthenticatedUser.uid;
            } else {
                // Skip reCAPTCHA verification in local development and on native
                if (isEmailAuth && !isEmulatorEnv && !isNative()) {
                    await new Promise((resolve, reject) => {
                        window.grecaptcha.enterprise.ready(async () => {
                            if (!isMountedRef.current) return reject(new Error("Component unmounted."));
                            try {
                                const token = await window.grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, { action: 'SIGNUP' });
                                if (!isMountedRef.current) return reject(new Error("Component unmounted."));
                                const verifyResponse = await fetch(VERIFY_SIGNUP_URL, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ recaptchaToken: token }),
                                });
                                if (!isMountedRef.current) return reject(new Error("Component unmounted."));
                                if (!verifyResponse.ok) {
                                    let backendErrorMsg = 'Security verification failed.';
                                    try { const errorData = await verifyResponse.json(); backendErrorMsg = errorData.error || backendErrorMsg; }
                                    catch (parseError) { backendErrorMsg = `Security check failed (Status: ${verifyResponse.status})`; }
                                    return reject(new Error(backendErrorMsg));
                                }
                                resolve();
                            } catch (recaptchaError) { reject(recaptchaError); }
                        });
                    });
                } else if (isEmailAuth && (isEmulatorEnv || isNative())) {
                    // Skip reCAPTCHA in native/local dev
                }
                const userCredential = await authProvider();
                if (!userCredential?.user?.uid) throw new Error("Failed to authenticate.");
                userIdForCheckout = userCredential.user.uid;
            }
            createFullscreenOverlay();
            await callInitiateCheckout(selectedPriceId, userIdForCheckout);

        } catch (error) {
            redirectInProgressRef.current = false;
            const overlay = document.getElementById('immediate-checkout-overlay');
            if (overlay?.parentNode) document.body.removeChild(overlay);

            if (isMountedRef.current) {
                let friendlyError = "An unexpected error occurred. Please try again.";
                if (error.code === 'auth/firebase-app-check-token-is-invalid.' ||
                    error.code === 'auth/app-check-token-is-invalid' ||
                    error.message?.includes('App Check token is invalid')) {
                    friendlyError = 'Security verification failed. Please try again, or use a regular browser window instead of private/incognito mode.';
                    if (authProvider !== handleEmailAuth) { setGoogleError(friendlyError); friendlyError = null; }
                } else if (error.message?.startsWith('Security')) friendlyError = error.message;
                else if (error.code?.startsWith('auth/')) {
                    friendlyError = (authProvider === handleEmailAuth) ? getFriendlySignupErrorMessage(error.code) : getOAuthSignInErrorMessage(error.code, 'Google');
                    if (authProvider !== handleEmailAuth) { setGoogleError(friendlyError); friendlyError = null; }
                }
                else friendlyError = error.message || friendlyError;
                if (friendlyError) setError(friendlyError);
                setIsProcessing(false);
            }
        }
    }, [isProcessing, selectedPriceId, isVerifyingPlan, configError, callInitiateCheckout, handleEmailAuth]);

    const handleEmailSubmit = useCallback((e) => {
        e.preventDefault();
        startSignupProcess(handleEmailAuth);
    }, [startSignupProcess, handleEmailAuth]);

    const handleAuthenticatedCheckout = useCallback(() => {
        if (!authUser || !selectedPriceId) {
            setError("Please select a plan first.");
            return;
        }
        startSignupProcess(null, authUser);
    }, [authUser, selectedPriceId, startSignupProcess]);

    const startFreeSignupProcess = useCallback(async (authProvider) => {
        if (isProcessing || configError || redirectInProgressRef.current) {
            if (configError && isMountedRef.current) setError(configError);
            return;
        }
        if (!isMountedRef.current) return;

        const isEmailAuth = authProvider === handleEmailAuth;
        const isAppleAuth = authProvider === handleAppleAuth;

        // Skip reCAPTCHA check in local development and on native
        if (!isEmulatorEnv && !isNative() && isEmailAuth && (typeof window.grecaptcha === 'undefined' || typeof window.grecaptcha.enterprise === 'undefined')) {
            if (isMountedRef.current) setError("Security system failed to load. Please refresh and try again.");
            return;
        }

        setIsProcessing(true);
        setIsFreeSignup(true);
        setError(null);
        setGoogleError(null);
        setAppleError(null);

        // Set the flag BEFORE auth is created so any intermediate screens show the right message
        sessionStorage.setItem('isNewSignup', 'true');

        try {
            // Skip reCAPTCHA verification in local development and on native
            if (isEmailAuth && !isEmulatorEnv && !isNative()) {
                await new Promise((resolve, reject) => {
                    window.grecaptcha.enterprise.ready(async () => {
                        if (!isMountedRef.current) return reject(new Error("Component unmounted."));
                        try {
                            const token = await window.grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, { action: 'SIGNUP' });
                            if (!isMountedRef.current) return reject(new Error("Component unmounted."));
                            const verifyResponse = await fetch(VERIFY_SIGNUP_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ recaptchaToken: token }),
                            });
                            if (!isMountedRef.current) return reject(new Error("Component unmounted."));
                            if (!verifyResponse.ok) {
                                let backendErrorMsg = 'Security verification failed.';
                                try { const errorData = await verifyResponse.json(); backendErrorMsg = errorData.error || backendErrorMsg; }
                                catch (parseError) { backendErrorMsg = `Security check failed (Status: ${verifyResponse.status})`; }
                                return reject(new Error(backendErrorMsg));
                            }
                            resolve();
                        } catch (recaptchaError) { reject(recaptchaError); }
                    });
                });
            }

            const userCredential = await authProvider();
            if (!userCredential?.user?.uid) throw new Error("Failed to authenticate.");

            if (!initializeFreeUser) throw new Error("Free account initialization service unavailable.");

            // For OAuth sign-up, use the display name from the provider profile
            // For email sign-up, use the name entered in the form
            const nameToUse = isEmailAuth
                ? displayName.trim() || null
                : userCredential.user.displayName || null;

            // Set displayName on Firebase Auth profile for email signups (defense in depth)
            if (isEmailAuth && nameToUse) {
                await updateProfile(userCredential.user, { displayName: nameToUse });
            }

            await initializeFreeUser({ displayName: nameToUse, marketingEmailOptIn: marketingOptIn });
            trackEvent('sign_up', { method: isEmailAuth ? 'email' : isAppleAuth ? 'apple' : 'google', marketing_opted_in: marketingOptIn });

            // Clear signup flag and trigger fresh data load with the correct user data
            sessionStorage.removeItem('isNewSignup');
            if (refreshUserData) refreshUserData();

            // Check for pending redirect (e.g., coach signup flow)
            const redirectParam = new URLSearchParams(window.location.search).get('redirect');
            const postSignupUrl = (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//'))
                ? redirectParam : '/dashboard';

            if (isNative()) {
                navigate(postSignupUrl, { replace: true });
            } else {
                window.location.href = postSignupUrl;
            }

        } catch (error) {
            // Clear the pre-set flag on error
            sessionStorage.removeItem('isNewSignup');

            if (isMountedRef.current) {
                let friendlyError = "An unexpected error occurred. Please try again.";
                if (error.code === 'auth/firebase-app-check-token-is-invalid.' ||
                    error.code === 'auth/app-check-token-is-invalid' ||
                    error.message?.includes('App Check token is invalid')) {
                    friendlyError = 'Security verification failed. Please try again, or use a regular browser window instead of private/incognito mode.';
                    if (authProvider !== handleEmailAuth) {
                        if (isAppleAuth) setAppleError(friendlyError);
                        else setGoogleError(friendlyError);
                        friendlyError = null;
                    }
                } else if (error.message?.startsWith('Security')) friendlyError = error.message;
                else if (error.code?.startsWith('auth/')) {
                    friendlyError = (authProvider === handleEmailAuth) ? getFriendlySignupErrorMessage(error.code) : getOAuthSignInErrorMessage(error.code, isAppleAuth ? 'Apple' : 'Google');
                    if (authProvider !== handleEmailAuth) {
                        if (isAppleAuth) setAppleError(friendlyError);
                        else setGoogleError(friendlyError);
                        friendlyError = null;
                    }
                }
                else friendlyError = error.message || friendlyError;
                if (friendlyError) {
                    if (isAppleAuth) setAppleError(friendlyError);
                    else if (authProvider !== handleEmailAuth) setGoogleError(friendlyError);
                    else setError(friendlyError);
                }
                setIsProcessing(false);
                setIsFreeSignup(false);
            }
        }
    }, [isProcessing, configError, handleEmailAuth, handleAppleAuth, displayName, navigate, refreshUserData, marketingOptIn]);

    const handleFreeEmailSubmit = useCallback((e) => {
        e.preventDefault();

        // Clear previous field errors
        setNameError(null);
        setEmailError(null);
        setPasswordError(null);

        // Validate fields and focus on first invalid one
        if (!displayName.trim()) {
            setNameError("Please enter your name");
            nameInputRef.current?.focus();
            return;
        }

        const nameValidation = validateName(displayName);
        if (!nameValidation.isValid) {
            setNameError(nameValidation.error);
            nameInputRef.current?.focus();
            return;
        }

        if (!email.trim()) {
            setEmailError("Please enter your email");
            emailInputRef.current?.focus();
            return;
        }

        // Basic email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setEmailError("Please enter a valid email address");
            emailInputRef.current?.focus();
            return;
        }

        if (!password) {
            setPasswordError("Please enter a password");
            passwordInputRef.current?.focus();
            return;
        }

        if (password.length < 6) {
            setPasswordError("Password must be at least 6 characters");
            passwordInputRef.current?.focus();
            return;
        }

        // All validations passed, proceed with signup
        startFreeSignupProcess(handleEmailAuth);
    }, [startFreeSignupProcess, handleEmailAuth, displayName, email, password]);

    const handleFreeGoogleSubmit = useCallback(() => {
        startFreeSignupProcess(handleGoogleAuth);
    }, [startFreeSignupProcess, handleGoogleAuth]);

    const handleFreeAppleSubmit = useCallback(() => {
        startFreeSignupProcess(handleAppleAuth);
    }, [startFreeSignupProcess, handleAppleAuth]);

    const navigateToLogin = useCallback(() => {
        if (onSwitchToLogin) onSwitchToLogin();
    }, [onSwitchToLogin]);

    // Handle input changes - clear errors when user starts typing
    const handleNameChange = useCallback((e) => {
        setDisplayName(e.target.value);
        if (nameError) setNameError(null);
    }, [nameError]);

    const handleEmailChange = useCallback((e) => {
        setEmail(e.target.value);
        if (emailError) setEmailError(null);
    }, [emailError]);

    const handlePasswordChange = useCallback((e) => {
        setPassword(e.target.value);
        if (passwordError) setPasswordError(null);
    }, [passwordError]);

    // Focus the name input when the user expands the email form
    useEffect(() => {
        if (showEmailForm) {
            const timer = setTimeout(() => nameInputRef.current?.focus(), 60);
            return () => clearTimeout(timer);
        }
    }, [showEmailForm]);

    if (isAuthLoading || isVerifyingPlan) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-theme-bg">
                <LoadingSpinner message="Verifying..." theme="auto" />
            </div>
        );
    }

    const getSubscribeButtonText = () => {
        return "Subscribe";
    };

    const getPlanSubtitleText = (currentSelectedPriceId) => {
        const isChoosePlanPage = authUser && window.location.pathname === '/choose-plan';
        if (currentSelectedPriceId === PRICE_IDS.monthly) {
            return "Monthly Plan - $5/month";
        }
        if (currentSelectedPriceId === PRICE_IDS.yearly) {
            return "Yearly Plan - $39.99/year (Save 33%)";
        }
        if (isChoosePlanPage && !isVerifyingPlan) {
            return 'Choose a plan to subscribe.';
        }
        // Anonymous free-signup: render no subtitle (value-prop element renders separately below)
        if (!authUser && !isVerifyingPlan) return '';
        return 'Select a plan';
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-theme-bg px-4 py-8 relative">
            <div className="flex flex-col items-center gap-5 w-full max-w-sm">
            <div className={`bg-theme-bg-secondary border border-theme-line p-8 rounded-lg shadow-lab w-full max-w-sm transition-opacity duration-200 ${isProcessing ? 'opacity-80' : 'opacity-100'}`}>
                {/* Logo and Title */}
                <div className="flex flex-col items-center mb-6">
                    <div className="mb-3">
                        <EchoMarkLogo />
                    </div>
                    <h1 className="text-xl font-bold text-center text-theme-text font-sans">Dual N-Back</h1>
                    {getPlanSubtitleText(selectedPriceId) && (
                        <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted mt-1 font-mono uppercase tracking-wider">
                            {getPlanSubtitleText(selectedPriceId)}
                        </p>
                    )}
                    {/* Anonymous free-signup value prop */}
                    {!authUser && !isVerifyingPlan && (
                        <div className="mt-3 text-center">
                            <p className="text-[0.8125rem] font-sans text-theme-text/90 leading-relaxed">
                                Train working memory. See your progress.
                            </p>
                            <p className="mt-1.5 text-theme-accent font-mono text-[0.6875rem]">
                                10 sessions per day. No credit card required.
                            </p>
                        </div>
                    )}
                </div>

                {configError && (
                    <p className="mb-4 text-sm text-neural-synapse bg-neural-synapse/10 p-3 rounded border border-neural-synapse/30 text-center" role="alert">
                        {configError}
                    </p>
                )}
                {planError && (
                    <p className="mb-4 text-sm text-theme-accent bg-theme-accent/10 p-3 rounded border border-theme-accent/30 text-center" role="alert">
                        {planError}
                    </p>
                )}

                {authUser ? (
                    <>
                        {/* Plan Selection for Authenticated Users */}
                        {!selectedPriceId && !isVerifyingPlan && (
                            <div className="mb-6 p-4 border border-theme-line rounded bg-theme-bg-elevated">
                                <h2 className="text-sm font-mono uppercase tracking-wider text-theme-text mb-4 text-center">
                                    Select Plan
                                </h2>
                                <div className="space-y-3">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPriceId(PRICE_IDS.monthly)}
                                        className={`w-full flex flex-col items-center p-4 border rounded transition-all
                                            ${selectedPriceId === PRICE_IDS.monthly
                                                ? 'border-theme-accent bg-theme-accent/10'
                                                : 'border-theme-line hover:border-theme-accent/50 hover:bg-theme-bg-surface'}
                                        `}
                                        disabled={isProcessing}
                                    >
                                        <span className="text-sm font-mono text-theme-accent">Monthly - $5/month</span>
                                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted mt-1 font-mono">
                                            Flexible monthly billing
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPriceId(PRICE_IDS.yearly)}
                                        className={`w-full flex flex-col items-center p-4 border rounded transition-all
                                            ${selectedPriceId === PRICE_IDS.yearly
                                                ? 'border-theme-accent bg-theme-accent/10'
                                                : 'border-theme-line hover:border-theme-accent/50 hover:bg-theme-bg-surface'}
                                        `}
                                        disabled={isProcessing}
                                    >
                                        <span className="text-sm font-mono text-theme-accent">Yearly - $39.99/year (Save 33%)</span>
                                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted mt-1 font-mono">
                                            Best value, billed annually
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {selectedPriceId && (
                            <button
                                type="button"
                                onClick={handleAuthenticatedCheckout}
                                disabled={isProcessing || !selectedPriceId || !!configError}
                                className="py-2.5 px-4 mt-4 rounded text-sm font-mono uppercase tracking-wider text-theme-bg bg-neural-dendrite hover:bg-neural-dendrite/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal-surface focus:ring-neural-dendrite disabled:opacity-50 disabled:cursor-not-allowed w-full transition-colors"
                            >
                                {isProcessing ? 'Processing...' : getSubscribeButtonText()}
                            </button>
                        )}

                        {error && !configError && (
                            <p className="mt-4 text-sm text-neural-synapse bg-neural-synapse/10 p-3 rounded border border-neural-synapse/30 text-center" role="alert">{error}</p>
                        )}

                        <div className="mt-6 text-sm text-center">
                            <button
                                type="button"
                                onClick={() => window.history.back()}
                                className="font-mono text-xs text-theme-accent hover:text-amber-highlight disabled:opacity-70 disabled:cursor-not-allowed"
                                disabled={isProcessing}
                            >
                                Cancel / Back
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Primary: Continue with Google */}
                        <button
                            type="button"
                            onClick={handleFreeGoogleSubmit}
                            disabled={isProcessing || !!configError}
                            className="py-3 px-4 border border-theme-accent/50 rounded text-sm font-mono text-theme-text bg-theme-bg-elevated hover:bg-theme-bg-surface hover:border-theme-accent glow-amber-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal-surface focus:ring-theme-accent w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {isProcessing ? (
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

                        {googleError && (
                            <p className="mt-3 text-sm text-neural-synapse bg-neural-synapse/10 p-3 rounded border border-neural-synapse/30 text-center" role="alert">
                                {googleError}
                            </p>
                        )}

                        {isIOS() && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleFreeAppleSubmit}
                                    disabled={isProcessing || !!configError}
                                    className="mt-3 py-3 px-4 border border-theme-line rounded text-sm font-mono text-theme-text bg-theme-bg-elevated hover:bg-theme-bg-surface hover:border-theme-accent/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal-surface focus:ring-theme-accent w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all group"
                                    aria-label="Continue with Apple"
                                >
                                    {isProcessing ? (
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

                        {/* Progressive disclosure: collapsed CTA or expanded email form */}
                        {!showEmailForm ? (
                            <button
                                type="button"
                                onClick={() => setShowEmailForm(true)}
                                disabled={isProcessing || !!configError}
                                className="py-3 px-4 border border-theme-line rounded text-sm font-mono text-theme-text bg-theme-bg-elevated hover:bg-theme-bg-surface hover:border-theme-accent/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal-surface focus:ring-theme-accent w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all group"
                                aria-expanded={showEmailForm}
                            >
                                <span>Continue with email</span>
                                <FontAwesomeIcon
                                    icon={faChevronDown}
                                    className="ml-2.5 text-[0.6875rem] text-theme-text-muted group-hover:text-theme-accent group-hover:translate-y-[1px] transition-all duration-200"
                                />
                            </button>
                        ) : (
                            <form onSubmit={handleFreeEmailSubmit} noValidate>
                                {/* Name */}
                                <div className="mb-4" style={{ animation: 'fadeIn 0.35s ease-out 0ms both' }}>
                                    <label htmlFor="signup-name" className="block text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider text-theme-text-muted mb-2">
                                        <span className="text-theme-accent/80">01</span>
                                        <span className="text-theme-text-muted/40 mx-1.5">·</span>
                                        Name
                                    </label>
                                    <input
                                        ref={nameInputRef}
                                        type="text"
                                        id="signup-name"
                                        value={displayName}
                                        onChange={handleNameChange}
                                        className={`w-full px-3 py-2.5 bg-theme-bg-elevated border rounded text-theme-text placeholder-warm-muted/50 focus:outline-none focus:ring-1 font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                                            nameError
                                                ? 'border-neural-synapse focus:ring-neural-synapse focus:border-neural-synapse'
                                                : 'border-theme-line focus:ring-theme-accent focus:border-theme-accent'
                                        }`}
                                        placeholder="How should we address you?"
                                        autoComplete="name"
                                        maxLength={NAME_MAX_LENGTH}
                                        disabled={isProcessing || !!configError}
                                    />
                                    {nameError && (<p className="mt-1 text-xs text-neural-synapse font-mono">{nameError}</p>)}
                                </div>

                                {/* Email */}
                                <div className="mb-4" style={{ animation: 'fadeIn 0.35s ease-out 70ms both' }}>
                                    <label htmlFor="signup-email" className="block text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider text-theme-text-muted mb-2">
                                        <span className="text-theme-accent/80">02</span>
                                        <span className="text-theme-text-muted/40 mx-1.5">·</span>
                                        Email Address
                                    </label>
                                    <input
                                        ref={emailInputRef}
                                        type="email"
                                        id="signup-email"
                                        value={email}
                                        onChange={handleEmailChange}
                                        className={`w-full px-3 py-2.5 bg-theme-bg-elevated border rounded text-theme-text placeholder-warm-muted/50 focus:outline-none focus:ring-1 font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                                            emailError
                                                ? 'border-neural-synapse focus:ring-neural-synapse focus:border-neural-synapse'
                                                : 'border-theme-line focus:ring-theme-accent focus:border-theme-accent'
                                        }`}
                                        placeholder="you@example.com"
                                        autoComplete="email"
                                        disabled={isProcessing || !!configError}
                                    />
                                    {emailError && (<p className="mt-1 text-xs text-neural-synapse font-mono">{emailError}</p>)}
                                </div>

                                {/* Password with show/hide toggle */}
                                <div className="mb-4" style={{ animation: 'fadeIn 0.35s ease-out 140ms both' }}>
                                    <label htmlFor="signup-password" className="block text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider text-theme-text-muted mb-2">
                                        <span className="text-theme-accent/80">03</span>
                                        <span className="text-theme-text-muted/40 mx-1.5">·</span>
                                        Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            ref={passwordInputRef}
                                            type={showPassword ? 'text' : 'password'}
                                            id="signup-password"
                                            value={password}
                                            onChange={handlePasswordChange}
                                            className={`w-full px-3 py-2.5 pr-10 bg-theme-bg-elevated border rounded text-theme-text placeholder-warm-muted/50 focus:outline-none focus:ring-1 font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                                                passwordError
                                                    ? 'border-neural-synapse focus:ring-neural-synapse focus:border-neural-synapse'
                                                    : 'border-theme-line focus:ring-theme-accent focus:border-theme-accent'
                                            }`}
                                            placeholder="Min. 6 characters"
                                            autoComplete="new-password"
                                            disabled={isProcessing || !!configError}
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
                                    {passwordError && (<p className="mt-1 text-xs text-neural-synapse font-mono">{passwordError}</p>)}
                                </div>

                                {/* Marketing email opt-in (unchecked by default — GDPR compliance) */}
                                <div className="mb-5" style={{ animation: 'fadeIn 0.35s ease-out 210ms both' }}>
                                    <label className="flex items-start gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={marketingOptIn}
                                            onChange={(e) => setMarketingOptIn(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 rounded border-theme-line bg-theme-bg-elevated text-theme-accent focus:ring-theme-accent focus:ring-offset-0 cursor-pointer"
                                            disabled={isProcessing}
                                        />
                                        <span className="text-xs font-mono text-theme-text-muted">
                                            Send me occasional product updates. Unsubscribe anytime.
                                        </span>
                                    </label>
                                </div>

                                {error && !configError && (
                                    <p className="mb-4 text-sm text-neural-synapse bg-neural-synapse/10 p-3 rounded border border-neural-synapse/30 text-center" role="alert">
                                        {error}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={isProcessing || !!configError}
                                    style={{ animation: 'fadeIn 0.35s ease-out 280ms both' }}
                                    className="py-2.5 px-4 rounded text-sm font-mono uppercase tracking-wider text-theme-bg bg-theme-accent hover:bg-amber-highlight glow-amber-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal-surface focus:ring-theme-accent disabled:opacity-50 disabled:cursor-not-allowed w-full transition-all"
                                >
                                    {isProcessing ? 'Creating Account...' : 'Create Free Account'}
                                </button>
                            </form>
                        )}

                        {/* Sign-in wrap: terms + privacy agreement notice (applies to both Google and email paths) */}
                        <p className="mt-5 text-center text-[0.6875rem] text-theme-text-muted/80 leading-snug px-2">
                            By signing up, you agree to our{' '}
                            <a
                                href="https://dualnback.com/terms"
                                target="_blank"
                                rel="noreferrer"
                                className="underline underline-offset-2 decoration-theme-text-muted/40 hover:text-theme-text hover:decoration-theme-accent transition-colors"
                            >
                                Terms
                            </a>
                            {' '}and{' '}
                            <a
                                href="https://dualnback.com/privacy"
                                target="_blank"
                                rel="noreferrer"
                                className="underline underline-offset-2 decoration-theme-text-muted/40 hover:text-theme-text hover:decoration-theme-accent transition-colors"
                            >
                                Privacy Policy
                            </a>
                            .
                        </p>

                        {/* Footer: sign-in link */}
                        <div className="mt-5 text-sm text-center">
                            <span className="text-theme-text-muted font-mono text-xs">Already a subject?</span>{' '}
                            <button
                                type="button"
                                onClick={navigateToLogin}
                                disabled={isProcessing || !!configError}
                                className="font-mono text-xs text-theme-accent hover:text-amber-highlight disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                Sign In
                            </button>
                        </div>
                    </>
                )}

                {/* reCAPTCHA Branding (hidden on native since reCAPTCHA is not used) */}
                {/* Per Google's April 2026 reCAPTCHA policy update: only the branding line is required;
                    references to Google's Privacy Policy and Terms of Use have been removed. */}
                {!isNative() && (
                    <div className="mt-6 text-center text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted/60 font-mono" style={{ visibility: 'visible' }}>
                        Protected by reCAPTCHA.
                    </div>
                )}
            </div>

            {/* Testimonial — peripheral field note, below the signup card */}
            {!authUser && !isVerifyingPlan && (
                <aside className="specimen-card rounded-lab p-4 w-full animate-fadeIn" aria-label="User testimonial">
                    {/* Header: "FIELD NOTE" label + quote icon */}
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[0.5625rem] font-mono uppercase tracking-[0.22em] text-theme-accent/80 whitespace-nowrap">Field Note</span>
                        <FontAwesomeIcon
                            icon={faQuoteLeft}
                            className="text-theme-accent/30 text-base"
                            aria-hidden="true"
                        />
                    </div>
                    {/* The quote */}
                    <p className="text-[0.8125rem] text-theme-text/90 leading-[1.55]">
                        I really loved this, especially after trying a lot of the other options out there. I don't think I've seen anything so high quality. Subscribed within a few minutes of trying to support this.
                    </p>
                    {/* Attribution */}
                    <div className="mt-3 text-[0.625rem] font-mono uppercase tracking-[0.18em] text-theme-text-muted">
                        — Dualnback.com User
                    </div>
                </aside>
            )}
            </div>
        </div>
    );
};

export default SignupScreen;

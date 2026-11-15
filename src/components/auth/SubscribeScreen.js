/* src/components/auth/SubscribeScreen.js */
/* Subscribe page with Cognitive Lab theme */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';

// Firebase and Stripe
import { functions as functionsInstance } from '../../firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { PRICE_IDS } from '../../constants/stripeConstants';
import { trackEvent } from '../../utils/analyticsTracker';

// Native IAP
import { isNative, isIOS } from '../../utils/platform';
import { initializePurchases, getOfferings, getActiveProductId, getActivePlanType, startNativeCheckoutFlow } from '../../services/paymentService';

// Contexts
import { useUser } from '../../contexts/UserContext';
import { useLoading } from '../../contexts/LoadingContext';
import { usePresence } from '../../contexts/PresenceContext';

// Icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCheck,
    faArrowLeft,
    faExclamationCircle,
    faInfinity,
    faBan,
    faClipboardCheck,
    faChartLine,
    faExchangeAlt,
} from '@fortawesome/free-solid-svg-icons';

// --- Initialize Cloud Function References ---
let initiateSubscriptionCheckout = null;
let updateSubscriptionPlanFn = null;
try {
    if (functionsInstance) {
        initiateSubscriptionCheckout = httpsCallable(functionsInstance, 'initiateSubscriptionCheckout');
        updateSubscriptionPlanFn = httpsCallable(functionsInstance, 'updateSubscriptionPlan');
    } else {
        console.error("SubscribeScreen: Firebase Functions instance is missing.");
    }
} catch (error) {
    console.error("SubscribeScreen: Error getting Firebase Functions reference:", error);
}

// Backend guards (existing active subscription, already on this plan) throw
// failed-precondition with a message meant for the user — surface it verbatim.
// Raw 'internal' codes carry no useful message, so those fall back to the caller's copy.
const isFailedPrecondition = (err) =>
    err?.code === 'failed-precondition' || err?.code === 'functions/failed-precondition';

const getBillingErrorMessage = (err, fallback) => {
    if (isFailedPrecondition(err)) return err?.message || fallback;
    if (err?.code === 'internal' || err?.code === 'functions/internal') return fallback;
    return err?.message || err?.data?.message || fallback;
};

const formatRenewalDate = (date) => {
    if (!date) return "";
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return "";
    return dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

// --- Feature list for display ---
const PRO_FEATURES = [
    { icon: faInfinity, text: 'Unlimited daily sessions — no 10/day cap' },
    { icon: faClipboardCheck, text: 'All Pro assessments (Counting Span, Digit Span & more)' },
    { icon: faChartLine, text: 'Advanced Insights — d′, response patterns & more' },
];

const SubscribeScreen = () => {
    const navigate = useNavigate();
    const {
        authUser,
        isAuthLoading,
        userSubscriptionStatus,
        isSubscriptionLoading,
        checkSubscription,
        subscriptionPlatform,
        setSubscriptionPlatform,
        setUserSubscriptionStatus,
        setSubscriptionTier,
        isInFreeTrial,
        freeTrialDeclined,
        subscriptionType,
        userSubscriptionPriceId,
        userSubscriptionEndDate,
        userSubscriptionCancelAtPeriodEnd,
        userHadTrial,
        subscriptionTier,
        isInLifetimeTrial,
        lifetimeTrialDaysRemaining,
    } = useUser();
    const { showLoading, hideLoading, updateMessage } = useLoading();
    const { markCheckoutStarted } = usePresence() || {};

    // Show trial messaging for any free user who hasn't had a trial yet (gifted or Stripe).
    // Backend trial gate at functions/stripe.js:initiateSubscriptionCheckout keeps the legacy
    // clientVersion=2 path AND the new beta-cohort path — so messaging here matches actual eligibility
    // for both. (Native users go through RevenueCat — separate trial config.)
    const showTrialMessaging = !userHadTrial && subscriptionTier === 'free';

    const [selectedPlan, setSelectedPlan] = useState('yearly'); // 'monthly', 'yearly', or 'lifetime'
    const [error, setError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [configError, setConfigError] = useState(null);
    const [nativeOfferings, setNativeOfferings] = useState(null);
    const [currentNativeProductId, setCurrentNativeProductId] = useState(null);
    const [currentNativePlanType, setCurrentNativePlanType] = useState(null); // 'monthly' | 'yearly' | null
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const isMountedRef = useRef(true);

    // --- Config Checks ---
    useEffect(() => {
        if (!isNative() && !initiateSubscriptionCheckout) {
            setConfigError("Subscription service unavailable. Please contact support.");
        }
    }, []);

    // --- Native IAP Initialization ---
    useEffect(() => {
        if (!isNative() || !authUser) return;
        const init = async () => {
            await initializePurchases(authUser.uid);
            const [offerings, activeProduct, planType] = await Promise.all([
                getOfferings(),
                getActiveProductId(),
                getActivePlanType(),
            ]);
            if (isMountedRef.current) {
                if (offerings) setNativeOfferings(offerings);
                if (activeProduct) setCurrentNativeProductId(activeProduct);
                if (planType) setCurrentNativePlanType(planType);
            }
        };
        init();
    }, [authUser]);

    // --- Mount/Unmount ---
    useEffect(() => {
        isMountedRef.current = true;
        trackEvent('paywall_view');
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // --- Redirect if not applicable ---
    // IAP and Stripe subscribers can stay on this page to change plans.
    // Only redirect lifetime users (nothing to upgrade to).
    const isNativeIAPSubscriber = subscriptionPlatform === 'android_iap' || subscriptionPlatform === 'ios_iap';
    useEffect(() => {
        if (!isAuthLoading && !authUser) {
            navigate('/login');
            return;
        }
        if (!isAuthLoading && authUser && !isSubscriptionLoading) {
            // Lifetime users (purchased OR mid-trial) have nothing to upgrade to → redirect.
            // Including 'trialing' here prevents trialing-lifetime users from re-purchasing.
            const activeStatuses = ['active', 'trialing'];
            const isActiveSubscriber = activeStatuses.includes(userSubscriptionStatus);
            const isLifetimeUser = subscriptionType === 'lifetime';
            if (isActiveSubscriber && isLifetimeUser) {
                navigate('/dashboard');
            }
        }
    }, [isAuthLoading, authUser, isSubscriptionLoading, userSubscriptionStatus, isNativeIAPSubscriber, subscriptionType, navigate]);

    // Trial offer auto-show removed — trial now handled via Stripe checkout (14-day card-required)

    // --- Subscribe / Plan Change Action ---
    const handleSubscribe = useCallback(async () => {
        if (isProcessing || configError) {
            if (configError) setError(configError);
            return;
        }
        if (!authUser) {
            setError("You must be logged in to subscribe.");
            return;
        }
        if (!isMountedRef.current) return;

        setIsProcessing(true);
        setError(null);
        trackEvent('subscribe_click', { plan: selectedPlan });

        // --- Native IAP path (iOS / Android) ---
        if (isNative()) {
            try {
                showLoading("Processing purchase...");
                const result = await startNativeCheckoutFlow({ selectedPlan });
                if (result.success) {
                    setSubscriptionPlatform(isIOS() ? 'ios_iap' : 'android_iap');
                    setUserSubscriptionStatus('active');
                    setSubscriptionTier('premium');
                    const wasChangingPlan = !!currentNativeProductId;
                    updateMessage(wasChangingPlan ? "Plan changed successfully!" : "Subscription activated!");
                    if (wasChangingPlan) {
                        const [newProductId, newPlanType] = await Promise.all([
                            getActiveProductId(),
                            getActivePlanType(),
                        ]);
                        if (isMountedRef.current) {
                            setCurrentNativeProductId(newProductId);
                            setCurrentNativePlanType(newPlanType);
                        }
                    }
                    hideLoading();
                    sessionStorage.setItem('subscriptionJustCompleted', 'true');
                    navigate('/dashboard');
                } else {
                    throw new Error(result.error || 'Purchase failed.');
                }
            } catch (err) {
                if (isMountedRef.current) {
                    setError(err.message || "An unexpected error occurred.");
                    hideLoading();
                    setIsProcessing(false);
                }
            }
            return;
        }

        // --- Web Stripe: plan switch (monthly ↔ yearly) for existing subscribers ---
        // App-managed and lifetime trials also report 'trialing' without a Stripe
        // subscription behind them — those still belong on the checkout path.
        const isStripeSubscriber = !isNativeIAPSubscriber && !isInFreeTrial && !isInLifetimeTrial &&
            ['active', 'trialing'].includes(userSubscriptionStatus);
        // Route every Stripe subscriber to the update path, including those whose current
        // price ID is unknown/legacy — a fresh checkout would create a second subscription.
        if (isStripeSubscriber && selectedPlan !== 'lifetime') {
            // Monthly ↔ Yearly switch via Stripe subscription update
            const newPriceId = selectedPlan === 'yearly' ? PRICE_IDS.yearly : PRICE_IDS.monthly;
            showLoading("Switching plan...");
            try {
                updateMessage("Updating your subscription...");
                const result = await updateSubscriptionPlanFn({ newPriceId });
                if (result?.data?.success) {
                    updateMessage("Plan updated successfully!");
                    // Refresh subscription status from backend
                    await checkSubscription();
                    hideLoading();
                    sessionStorage.setItem('subscriptionJustCompleted', 'true');
                    navigate('/dashboard');
                } else {
                    throw new Error("Plan switch failed.");
                }
            } catch (err) {
                if (isMountedRef.current) {
                    setError(getBillingErrorMessage(err, "Could not switch plans."));
                    hideLoading();
                    setIsProcessing(false);
                }
            }
            return;
        }

        // --- Web Stripe: new subscription or lifetime upgrade ---
        const priceId = selectedPlan === 'lifetime' ? PRICE_IDS.lifetime
            : selectedPlan === 'yearly' ? PRICE_IDS.yearly
            : PRICE_IDS.monthly;
        if (!priceId) {
            setError("Invalid plan selected.");
            setIsProcessing(false);
            return;
        }

        showLoading("Preparing checkout...");

        try {
            updateMessage("Connecting to payment processor...");
            const result = await initiateSubscriptionCheckout({ priceId, clientVersion: 2 });
            const checkoutUrl = result?.data?.checkoutUrl;

            if (checkoutUrl) {
                updateMessage("Redirecting to secure checkout...");
                if (markCheckoutStarted) {
                    await markCheckoutStarted(selectedPlan);
                }
                setTimeout(() => {
                    window.location.href = checkoutUrl;
                }, 300);
            } else {
                throw new Error("Could not start the subscription process.");
            }
        } catch (err) {
            if (isMountedRef.current) {
                setError(getBillingErrorMessage(err, "An unexpected error occurred."));
                hideLoading();
                setIsProcessing(false);
            }
        }
    }, [isProcessing, configError, authUser, selectedPlan, currentNativeProductId, isNativeIAPSubscriber, isInFreeTrial, isInLifetimeTrial, userSubscriptionStatus, showLoading, hideLoading, updateMessage, markCheckoutStarted, checkSubscription, setSubscriptionPlatform, navigate]);

    // --- CTA click: show confirmation for Stripe plan changes, otherwise proceed directly ---
    const handleCTAClick = useCallback(() => {
        if (isProcessing || configError) {
            if (configError) setError(configError);
            return;
        }
        // For Stripe subscribers changing plans, show confirmation modal first
        const isStripeSubscriber = !isNativeIAPSubscriber && !isInFreeTrial && !isInLifetimeTrial &&
            ['active', 'trialing'].includes(userSubscriptionStatus);
        if (isStripeSubscriber && !isNative()) {
            setShowConfirmModal(true);
            return;
        }
        // Otherwise proceed directly (native IAP or new subscriber)
        handleSubscribe();
    }, [isProcessing, configError, isNativeIAPSubscriber, isInFreeTrial, isInLifetimeTrial, userSubscriptionStatus, handleSubscribe]);

    // --- Loading State ---
    if (isAuthLoading || isSubscriptionLoading) {
        return (
            <div className="min-h-screen bg-theme-bg lab-grid lab-grid-radial flex items-center justify-center">
                <div className="text-center">
                    <div className="relative inline-block">
                        <div className="h-16 w-16 rounded-full border-2 border-theme-line"></div>
                        <div className="absolute inset-0 h-16 w-16 rounded-full border-2 border-transparent border-t-amber-accent animate-spin"></div>
                    </div>
                    <p className="mt-4 text-theme-text-muted font-mono text-sm uppercase tracking-wider">Loading...</p>
                </div>
            </div>
        );
    }

    // Use native store pricing when available, otherwise hardcoded defaults
    const monthlyPrice = nativeOfferings?.monthly?.product?.priceString || '$4.99';
    const yearlyPrice = nativeOfferings?.annual?.product?.priceString || '$39.99';
    const yearlyMonthlyPrice = nativeOfferings?.annual?.product?.price
        ? `$${(nativeOfferings.annual.product.price / 12).toFixed(2)}`
        : '$3.33';
    const yearlySavings = Math.round((1 - (39.99 / (4.99 * 12))) * 100);
    const lifetimePrice = nativeOfferings?.lifetime?.product?.priceString || '$119.99';

    // Lifetime is Stripe-only today: the RevenueCat `default` offering has no
    // lifetime package on either store, so on native the card would advertise a
    // plan that cannot actually be purchased (App Review Guideline 2.1 risk).
    // Gate on the package existing rather than hardcoding the platform, so the
    // card reappears by itself if a lifetime IAP is configured later.
    const showLifetimePlan = !isNative() || !!nativeOfferings?.lifetime;

    // Plan-change state (native IAP or Stripe subscribers changing plans)
    const isStripeSubscriberForUI = !isNativeIAPSubscriber && !isInFreeTrial && !isInLifetimeTrial &&
        ['active', 'trialing'].includes(userSubscriptionStatus);
    const currentStripePlanForUI = isStripeSubscriberForUI
        ? (userSubscriptionPriceId === PRICE_IDS.yearly ? 'yearly'
           : userSubscriptionPriceId === PRICE_IDS.monthly ? 'monthly'
           : null)
        : null;
    const currentPlan = currentNativePlanType || currentStripePlanForUI; // 'monthly', 'yearly', 'lifetime', or null
    const isChangingPlan = !!currentNativeProductId || !!currentStripePlanForUI;
    const isSamePlanSelected = isChangingPlan && selectedPlan === currentPlan;

    const renewalDateStr = formatRenewalDate(userSubscriptionEndDate);
    const renewalSuffix = renewalDateStr
        ? ` ${userSubscriptionCancelAtPeriodEnd ? 'Access until' : 'Renews'} ${renewalDateStr}.`
        : '';

    return (
        <div className="min-h-screen bg-theme-bg lab-grid lab-grid-radial">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                {/* Back navigation */}
                <div className="mb-8">
                    <Link
                        to="/dashboard"
                        className="group inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-accent transition-colors"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                        <span className="text-xs font-mono uppercase tracking-wider">Back to Dashboard</span>
                    </Link>
                </div>

                {/* Header */}
                <header className="text-center mb-10">
                    <div className="inline-flex items-center justify-center h-16 w-16 mb-4 relative">
                        <div className="absolute inset-0 bg-theme-accent/20 rounded-sm rotate-3"></div>
                        <div className="absolute inset-0 bg-theme-bg-secondary border border-theme-accent flex items-center justify-center">
                            <FontAwesomeIcon icon={isChangingPlan ? faExchangeAlt : faInfinity} className="h-7 w-7 text-theme-accent" />
                        </div>
                    </div>
                    <h1 className="text-2xl sm:text-3xl text-theme-text font-serif italic mb-2">
                        {isChangingPlan ? 'Change Your Plan' : 'Upgrade to Pro'}
                    </h1>
                    <p className="text-theme-text-muted font-mono text-sm max-w-md mx-auto">
                        {isChangingPlan
                            ? (isInLifetimeTrial
                                ? `Lifetime trial active — ${lifetimeTrialDaysRemaining} day${lifetimeTrialDaysRemaining === 1 ? '' : 's'} remaining`
                                : `You're currently on the ${currentPlan} plan.${renewalSuffix}`)
                            : 'Unlimited sessions, every assessment, and advanced Insights'}
                    </p>
                </header>

                {/* Free trial banner */}
                {!isChangingPlan && showTrialMessaging && (
                    <div className="mb-8 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-theme-accent/10 border border-theme-accent/30 text-theme-accent font-mono text-sm">
                            <span className="text-lg">14</span>
                            <span className="text-xs uppercase tracking-wider">day free trial — cancel anytime</span>
                        </div>
                    </div>
                )}

                {/* Error display */}
                {(error || configError) && (
                    <div className="mb-6 bg-neural-synapse/10 border border-neural-synapse/30 rounded-lab p-4 flex items-start max-w-lg mx-auto">
                        <FontAwesomeIcon icon={faExclamationCircle} className="text-neural-synapse mr-3 h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-neural-synapse font-mono">{error || configError}</span>
                    </div>
                )}

                {/* Pricing Cards */}
                <div className={`grid grid-cols-1 gap-4 sm:gap-5 mb-8 max-w-3xl mx-auto ${showLifetimePlan ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                    {/* Monthly Plan */}
                    <button
                        type="button"
                        onClick={() => setSelectedPlan('monthly')}
                        disabled={isProcessing || !!configError || currentPlan === 'monthly'}
                        className={`
                            relative p-5 rounded-lab border-2 text-left transition-all duration-200
                            ${selectedPlan === 'monthly'
                                ? 'border-theme-accent bg-theme-bg-elevated'
                                : 'border-theme-line bg-theme-bg-secondary hover:border-theme-border'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        {currentPlan === 'monthly' && (
                            <div className="absolute -top-3 left-4 px-3 py-1 bg-theme-text-muted text-theme-bg text-xs font-mono uppercase tracking-wider rounded-full">
                                Current
                            </div>
                        )}
                        {selectedPlan === 'monthly' && (
                            <div className="absolute top-4 right-4 h-6 w-6 bg-theme-accent rounded-full flex items-center justify-center">
                                <FontAwesomeIcon icon={faCheck} className="h-3 w-3 text-theme-bg" />
                            </div>
                        )}
                        <div className={`mb-3 ${currentPlan === 'monthly' ? 'mt-1' : ''}`}>
                            <h3 className="text-lg font-serif text-theme-text mb-1">Monthly</h3>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-serif text-theme-text">{monthlyPrice}</span>
                            <span className="text-theme-text-muted font-mono text-sm">/mo</span>
                        </div>
                        {showTrialMessaging && <p className="text-xs text-theme-text-muted font-mono mt-2">14-day free trial</p>}
                    </button>

                    {/* Yearly Plan */}
                    <button
                        type="button"
                        onClick={() => setSelectedPlan('yearly')}
                        disabled={isProcessing || !!configError || currentPlan === 'yearly'}
                        className={`
                            relative p-5 rounded-lab border-2 text-left transition-all duration-200
                            ${selectedPlan === 'yearly'
                                ? 'border-theme-accent bg-theme-bg-elevated'
                                : 'border-theme-line bg-theme-bg-secondary hover:border-theme-border'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        <div className={`absolute -top-3 left-4 px-3 py-1 text-theme-bg text-xs font-mono uppercase tracking-wider rounded-full ${
                            currentPlan === 'yearly' ? 'bg-theme-text-muted' : 'bg-neural-dendrite'
                        }`}>
                            {currentPlan === 'yearly' ? 'Current' : `Save ${yearlySavings}%`}
                        </div>
                        {selectedPlan === 'yearly' && (
                            <div className="absolute top-4 right-4 h-6 w-6 bg-theme-accent rounded-full flex items-center justify-center">
                                <FontAwesomeIcon icon={faCheck} className="h-3 w-3 text-theme-bg" />
                            </div>
                        )}
                        <div className="mb-3 mt-1">
                            <h3 className="text-lg font-serif text-theme-text mb-1">Annual</h3>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-serif text-theme-text">{yearlyMonthlyPrice}</span>
                            <span className="text-theme-text-muted font-mono text-sm">/mo</span>
                        </div>
                        <p className="text-xs text-theme-text-muted font-mono mt-2">{yearlyPrice}/yr{showTrialMessaging ? ' — 14-day free trial' : ''}</p>
                    </button>

                    {/* Lifetime Plan — hidden on native when no lifetime package exists */}
                    {showLifetimePlan && (
                    <button
                        type="button"
                        onClick={() => setSelectedPlan('lifetime')}
                        disabled={isProcessing || !!configError || currentPlan === 'lifetime'}
                        className={`
                            relative p-5 rounded-lab border-2 text-left transition-all duration-200
                            ${selectedPlan === 'lifetime'
                                ? 'border-theme-accent bg-theme-bg-elevated'
                                : 'border-theme-line bg-theme-bg-secondary hover:border-theme-border'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        <div className={`absolute -top-3 left-4 px-3 py-1 text-theme-bg text-xs font-mono uppercase tracking-wider rounded-full ${
                            currentPlan === 'lifetime' ? 'bg-theme-text-muted' : 'bg-theme-accent'
                        }`}>
                            {currentPlan === 'lifetime' ? 'Current' : 'Best Value'}
                        </div>
                        {selectedPlan === 'lifetime' && (
                            <div className="absolute top-4 right-4 h-6 w-6 bg-theme-accent rounded-full flex items-center justify-center">
                                <FontAwesomeIcon icon={faCheck} className="h-3 w-3 text-theme-bg" />
                            </div>
                        )}
                        <div className="mb-3 mt-1">
                            <h3 className="text-lg font-serif text-theme-text mb-1">Lifetime</h3>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-serif text-theme-text">{lifetimePrice}</span>
                        </div>
                        <p className="text-xs text-theme-text-muted font-mono mt-2">
                            {isChangingPlan && currentPlan !== 'lifetime'
                                ? currentPlan === 'monthly'
                                    ? 'One-time — pays for itself in ~24 months'
                                    : 'One-time — pays for itself in ~3 years'
                                : showTrialMessaging
                                    ? `14-day free trial, then ${lifetimePrice} charged once`
                                    : 'One-time payment — forever'}
                        </p>
                    </button>
                    )}
                </div>

                {/* Subscribe / Change Plan Button */}
                <div className="max-w-md mx-auto mb-8">
                    <button
                        type="button"
                        onClick={handleCTAClick}
                        disabled={isProcessing || !!configError || isSamePlanSelected}
                        className={`
                            w-full py-4 px-6 rounded-lab font-mono text-sm uppercase tracking-wider
                            transition-all duration-200
                            ${isProcessing
                                ? 'bg-theme-bg-elevated text-theme-text-muted cursor-wait'
                                : isSamePlanSelected
                                    ? 'bg-theme-bg-elevated text-theme-text-muted cursor-not-allowed'
                                    : 'bg-theme-accent hover:bg-amber-highlight text-theme-bg'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        {isProcessing ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="h-4 w-4 border-2 border-warm-muted/30 border-t-warm-muted rounded-full animate-spin"></div>
                                Processing...
                            </span>
                        ) : isSamePlanSelected ? (
                            'Current Plan'
                        ) : isChangingPlan ? (
                            selectedPlan === 'lifetime' ? 'Upgrade to Lifetime' : `Switch to ${selectedPlan === 'yearly' ? 'Annual' : 'Monthly'}`
                        ) : selectedPlan === 'lifetime' ? (
                            showTrialMessaging ? 'Start 14-day Trial' : 'Purchase Lifetime'
                        ) : (
                            'Subscribe Now'
                        )}
                    </button>
                </div>

                {/* Features List */}
                <div className="max-w-md mx-auto">
                    <div className="bg-theme-bg-secondary border border-theme-line rounded-lab p-6">
                        <h4 className="text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-4 text-center">
                            Pro includes
                        </h4>
                        <ul className="space-y-3">
                            {PRO_FEATURES.map((feature, index) => (
                                <li key={index} className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lab bg-theme-bg-elevated flex items-center justify-center flex-shrink-0">
                                        <FontAwesomeIcon icon={feature.icon} className="h-4 w-4 text-theme-accent" />
                                    </div>
                                    <span className="text-sm text-theme-text-secondary font-mono">{feature.text}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Footer note */}
                <p className="text-center text-xs text-theme-text-muted font-mono mt-8">
                    {isChangingPlan
                        ? selectedPlan === 'lifetime'
                            ? 'One-time payment. Current subscription auto-cancelled.'
                            : isNative()
                                ? isIOS()
                                    ? 'The App Store applies its plan change policy, including any credit for remaining time.'
                                    : 'Google Play applies its plan change policy, including any credit for remaining time.'
                                : 'The difference for remaining time is prorated and billed or credited immediately.'
                        : selectedPlan === 'lifetime'
                            ? showTrialMessaging
                                ? `14-day free trial, then ${lifetimePrice} charged once. Cancel anytime.`
                                : 'One-time payment. No recurring charges.'
                            : showTrialMessaging
                                ? '14-day free trial, then auto-renews. Cancel anytime.'
                                : 'Auto-renews. Cancel anytime.'}
                </p>
            </div>

            {/* Plan Change Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => { if (!isProcessing) setShowConfirmModal(false); }}
                    />
                    {/* Modal */}
                    <div className="relative bg-theme-bg-secondary border border-theme-line rounded-lab p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-lg font-serif italic text-theme-text mb-3">
                            {selectedPlan === 'lifetime' ? 'Upgrade to Lifetime' : `Switch to ${selectedPlan === 'yearly' ? 'Annual' : 'Monthly'}`}
                        </h3>
                        <p className="text-sm text-theme-text-secondary font-mono mb-6 leading-relaxed">
                            {selectedPlan === 'lifetime'
                                ? `Your current ${currentPlan} subscription will be automatically cancelled when your lifetime purchase is complete. A prorated credit for unused time will be applied.`
                                : `Your plan changes immediately. The prorated difference for the remaining time on your current plan is ${
                                    selectedPlan === 'yearly' ? 'charged' : 'credited'
                                } right away.`
                            }
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(false)}
                                disabled={isProcessing}
                                className="flex-1 py-3 px-4 rounded-lab border border-theme-line text-theme-text-muted font-mono text-xs uppercase tracking-wider hover:bg-theme-bg-elevated transition-colors disabled:opacity-50"
                            >
                                Keep Current Plan
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowConfirmModal(false); handleSubscribe(); }}
                                disabled={isProcessing}
                                className="flex-1 py-3 px-4 rounded-lab bg-theme-accent hover:bg-amber-highlight text-theme-bg font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                            >
                                {selectedPlan === 'lifetime' ? 'Continue to Checkout' : 'Confirm Switch'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubscribeScreen;

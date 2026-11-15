/* src/components/ui/AssessmentPaywallModal.js */
/* Cognitive Lab Aesthetic - Assessment Paywall Modal */
/* Shown when free users try to access assessments without grandfathering */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFlask, faChartLine, faCalendarAlt, faInfinity } from '@fortawesome/free-solid-svg-icons';

// Firebase
import { functions as functionsInstance } from '../../firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { PRICE_IDS } from '../../constants/stripeConstants';

// Native IAP
import { isNative } from '../../utils/platform';
import { startNativeCheckoutFlow } from '../../services/paymentService';

// Presence tracking
import { usePresence } from '../../contexts/PresenceContext';

// Funnel instrumentation
import { trackEvent } from '../../utils/analyticsTracker';
import {
    recordUpgradeModalImpressionFn,
    recordUpgradeModalDismissFn,
    recordUpgradeModalAcceptFn,
} from '../../contexts/user/userCloudFunctions';

// Marks an in-flight Stripe checkout so the ?showUpgrade=true return re-open is
// recorded as checkout_abandoned rather than a fresh impression.
const CHECKOUT_PENDING_KEY = 'assessmentCheckoutPending';
const CHECKOUT_PENDING_MAX_AGE_MS = 2 * 60 * 60 * 1000;

// Initialize checkout function
let initiateSubscriptionCheckout = null;
try {
    if (functionsInstance) {
        initiateSubscriptionCheckout = httpsCallable(functionsInstance, 'initiateSubscriptionCheckout');
    }
} catch (error) {
    console.error("AssessmentPaywallModal: Error getting Firebase Functions reference:", error);
}

/**
 * Modal shown when a free tier user attempts to start an assessment
 * without being grandfathered in.
 * Includes plan selection and direct checkout.
 */
const AssessmentPaywallModal = ({
    isOpen,
    onClose,
    onSubscriptionComplete,
    returnPath = '/testing/counting-span',
}) => {
    const [selectedPlan, setSelectedPlan] = useState('yearly');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const isMountedRef = useRef(true);
    const impressionRef = useRef(false); // one impression per open

    // Presence tracking for checkout/declined states
    const { markCheckoutStarted, markUpgradeDeclined } = usePresence() || {};

    // Which assessment this paywall guarded (last segment of the return path)
    const assessmentId = useMemo(() => {
        const segments = String(returnPath || '').split('?')[0].split('/').filter(Boolean);
        return segments[segments.length - 1] || 'unknown';
    }, [returnPath]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (!isOpen) return undefined;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Impression — this modal is its own opener, so it records its own.
    // Exception: when this open is the ?showUpgrade=true return from a canceled
    // Stripe checkout (marker set in handleStartTrial), it is the same intent as
    // the original open — record the abandon instead of a second impression.
    useEffect(() => {
        if (!isOpen) {
            impressionRef.current = false;
            return;
        }
        if (impressionRef.current) return;
        impressionRef.current = true;

        let pendingCheckout = null;
        try {
            const raw = sessionStorage.getItem(CHECKOUT_PENDING_KEY);
            if (raw) pendingCheckout = JSON.parse(raw);
        } catch { /* ignore malformed marker */ }

        const isCheckoutReturn = pendingCheckout
            && pendingCheckout.assessment === assessmentId
            && (Date.now() - pendingCheckout.ts) < CHECKOUT_PENDING_MAX_AGE_MS;
        if (isCheckoutReturn) {
            try { sessionStorage.removeItem(CHECKOUT_PENDING_KEY); } catch { /* ignore */ }
            if (recordUpgradeModalDismissFn) {
                recordUpgradeModalDismissFn({ trigger: 'assessment_locked', dismissType: 'checkout_abandoned', context: assessmentId }).catch(err => {
                    console.warn('[AssessmentPaywallModal] recordUpgradeModalDismiss failed:', err?.message);
                });
            }
            trackEvent('checkout_abandoned', { trigger: 'assessment_locked', assessment: assessmentId });
            return;
        }

        if (recordUpgradeModalImpressionFn) {
            recordUpgradeModalImpressionFn({ trigger: 'assessment_locked', context: assessmentId }).catch(err => {
                console.warn('[AssessmentPaywallModal] recordUpgradeModalImpression failed:', err?.message);
            });
        }
        trackEvent('assessment_paywall_shown', { assessment: assessmentId });
    }, [isOpen, assessmentId]);

    if (!isOpen) return null;

    const handleStartTrial = async () => {
        if (isProcessing) return;

        setIsProcessing(true);
        setError(null);

        // Accept = checkout actually initiated (fire-and-forget; never blocks).
        const recordAccept = () => {
            if (recordUpgradeModalAcceptFn) {
                recordUpgradeModalAcceptFn({ trigger: 'assessment_locked', selectedPlan, context: assessmentId }).catch(err => {
                    console.warn('[AssessmentPaywallModal] recordUpgradeModalAccept failed:', err?.message);
                });
            }
            trackEvent('assessment_paywall_accepted', { assessment: assessmentId, plan: selectedPlan });
        };

        // --- Native IAP path ---
        if (isNative()) {
            try {
                recordAccept(); // purchase sheet is about to open
                const result = await startNativeCheckoutFlow({ selectedPlan });
                if (result.success) {
                    onClose();
                    if (onSubscriptionComplete) onSubscriptionComplete();
                } else {
                    throw new Error(result.error || 'Purchase failed.');
                }
            } catch (err) {
                if (isMountedRef.current) {
                    setError(err.message || "An error occurred. Please try again.");
                    setIsProcessing(false);
                }
            }
            return;
        }

        // --- Web Stripe path ---
        if (!initiateSubscriptionCheckout) {
            setError("Checkout unavailable. Please try again later.");
            setIsProcessing(false);
            return;
        }

        const priceId = selectedPlan === 'yearly' ? PRICE_IDS.yearly : PRICE_IDS.monthly;
        if (!priceId) {
            setError("Invalid plan selected.");
            setIsProcessing(false);
            return;
        }

        try {
            const result = await initiateSubscriptionCheckout({ priceId, cancelUrl: `${returnPath}?showUpgrade=true`, clientVersion: 2 });
            const checkoutUrl = result?.data?.checkoutUrl;

            if (checkoutUrl) {
                recordAccept(); // Stripe session created — user is reaching checkout
                // Marker so the ?showUpgrade=true re-open records the abandon
                // instead of a duplicate impression.
                try {
                    sessionStorage.setItem(CHECKOUT_PENDING_KEY, JSON.stringify({ assessment: assessmentId, ts: Date.now() }));
                } catch { /* ignore */ }
                // Mark checkout started in presence before redirecting
                if (markCheckoutStarted) {
                    await markCheckoutStarted(selectedPlan);
                }
                window.location.href = checkoutUrl;
            } else {
                throw new Error("Could not start checkout.");
            }
        } catch (err) {
            if (isMountedRef.current) {
                setError(err.message || "An error occurred. Please try again.");
                setIsProcessing(false);
            }
        }
    };

    const handleContinueWithout = () => {
        if (recordUpgradeModalDismissFn) {
            recordUpgradeModalDismissFn({ trigger: 'assessment_locked', dismissType: 'maybe_later', context: assessmentId }).catch(err => {
                console.warn('[AssessmentPaywallModal] recordUpgradeModalDismiss failed:', err?.message);
            });
        }
        trackEvent('assessment_paywall_dismissed', { assessment: assessmentId, dismissType: 'maybe_later' });
        // Mark upgrade declined in presence before closing
        if (markUpgradeDeclined) {
            markUpgradeDeclined();
        }
        onClose();
    };

    return ReactDOM.createPortal(
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99999,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '1rem',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
            }}
            aria-labelledby="assessment-paywall-modal-title"
            role="dialog"
            aria-modal="true"
        >
            {/* Backdrop */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(4px)',
                }}
                onClick={onClose}
            >
                {/* Subtle scan line effect */}
                <div
                    className="absolute inset-0 opacity-5"
                    style={{
                        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(228, 184, 92, 0.1) 2px, rgba(228, 184, 92, 0.1) 4px)',
                    }}
                />
            </div>

            {/* Modal Container */}
            <div
                className="w-full max-w-md animate-slide-up"
                style={{
                    position: 'relative',
                    backgroundColor: 'rgb(var(--color-bg-secondary))',
                    border: '1px solid rgb(var(--color-line))',
                    marginTop: 'auto',
                    marginBottom: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="border-b border-theme-line px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Premium indicator */}
                        <div className="relative">
                            <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                            <div className="absolute inset-0 w-2 h-2 bg-theme-accent rounded-full animate-ping opacity-40"></div>
                        </div>
                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                            Premium Feature
                        </span>
                    </div>

                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="text-theme-text-muted hover:text-theme-text transition-colors p-1 -m-1"
                        aria-label="Close"
                        disabled={isProcessing}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="square" strokeLinejoin="miter" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="px-5 py-6">
                    {/* Title */}
                    <h3
                        className="text-xl font-serif text-theme-text mb-2 text-center"
                        id="assessment-paywall-modal-title"
                    >
                        Unlock Cognitive Assessments
                    </h3>
                    <p className="text-sm text-theme-text-secondary text-center mb-6">
                        Track your cognitive progress with scientific benchmarks.
                    </p>

                    {/* Feature Highlights */}
                    <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-6">
                        <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-3">
                            What You Get
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-theme-bg border border-theme-line flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <FontAwesomeIcon icon={faFlask} className="w-3 h-3 text-theme-accent" />
                                </div>
                                <div>
                                    <div className="text-sm font-mono text-theme-text">Research-Grade Testing</div>
                                    <div className="text-xs text-theme-text-muted">Counting Span, Digit Span, Visual Arrays, Symmetry Span &amp; Antisaccade</div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-theme-bg border border-theme-line flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <FontAwesomeIcon icon={faCalendarAlt} className="w-3 h-3 text-theme-accent" />
                                </div>
                                <div>
                                    <div className="text-sm font-mono text-theme-text">Monthly Benchmarks</div>
                                    <div className="text-xs text-theme-text-muted">Track improvements over time</div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-theme-bg border border-theme-line flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <FontAwesomeIcon icon={faChartLine} className="w-3 h-3 text-theme-accent" />
                                </div>
                                <div>
                                    <div className="text-sm font-mono text-theme-text">Scientific Scoring</div>
                                    <div className="text-xs text-theme-text-muted">Validated scores benchmark your cognitive performance</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Premium upgrade section with plan selection */}
                    <div className="bg-theme-bg-elevated border border-theme-accent/30 p-4">
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 bg-theme-bg border border-theme-line flex items-center justify-center">
                                <FontAwesomeIcon icon={faInfinity} className="w-4 h-4 text-theme-accent" />
                            </div>
                            <div>
                                <div className="text-sm font-serif text-theme-accent">Upgrade to Pro</div>
                                <div className="text-xs font-mono text-theme-text-muted uppercase tracking-wider">
                                    Subscribe Now
                                </div>
                            </div>
                        </div>

                        {/* Plan Selection */}
                        <div className="space-y-2 mb-3">
                            {/* Yearly Plan */}
                            <label
                                className={`flex items-center justify-between p-3 border cursor-pointer transition-all duration-200 ${
                                    selectedPlan === 'yearly'
                                        ? 'border-theme-accent bg-theme-accent/10'
                                        : 'border-theme-line hover:border-theme-border'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                        selectedPlan === 'yearly'
                                            ? 'border-theme-accent'
                                            : 'border-theme-line'
                                    }`}>
                                        {selectedPlan === 'yearly' && (
                                            <div className="w-2 h-2 rounded-full bg-theme-accent"></div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-sm font-mono text-theme-text">Yearly</div>
                                        <div className={`text-xs font-mono ${selectedPlan === 'yearly' ? 'text-theme-text-secondary' : 'text-theme-text-muted'}`}>$39.99/year</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-mono text-theme-text">$3.33<span className={selectedPlan === 'yearly' ? 'text-theme-text-secondary' : 'text-theme-text-muted'}>/mo</span></div>
                                    <div className="px-1.5 py-0.5 bg-theme-accent/20 text-[0.6875rem] font-mono text-theme-accent uppercase">
                                        Save 33%
                                    </div>
                                </div>
                                <input
                                    type="radio"
                                    name="plan"
                                    value="yearly"
                                    checked={selectedPlan === 'yearly'}
                                    onChange={() => setSelectedPlan('yearly')}
                                    className="sr-only"
                                />
                            </label>

                            {/* Monthly Plan */}
                            <label
                                className={`flex items-center justify-between p-3 border cursor-pointer transition-all duration-200 ${
                                    selectedPlan === 'monthly'
                                        ? 'border-theme-accent bg-theme-accent/10'
                                        : 'border-theme-line hover:border-theme-border'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                        selectedPlan === 'monthly'
                                            ? 'border-theme-accent'
                                            : 'border-theme-line'
                                    }`}>
                                        {selectedPlan === 'monthly' && (
                                            <div className="w-2 h-2 rounded-full bg-theme-accent"></div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-sm font-mono text-theme-text">Monthly</div>
                                        <div className={`text-xs font-mono ${selectedPlan === 'monthly' ? 'text-theme-text-secondary' : 'text-theme-text-muted'}`}>$4.99/month</div>
                                    </div>
                                </div>
                                <div className="text-sm font-mono text-theme-text">
                                    $4.99<span className={selectedPlan === 'monthly' ? 'text-theme-text-secondary' : 'text-theme-text-muted'}>/mo</span>
                                </div>
                                <input
                                    type="radio"
                                    name="plan"
                                    value="monthly"
                                    checked={selectedPlan === 'monthly'}
                                    onChange={() => setSelectedPlan('monthly')}
                                    className="sr-only"
                                />
                            </label>
                        </div>

                        {/* Feature list */}
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-mono text-theme-text-secondary">
                                <span className="w-1 h-1 bg-theme-accent flex-shrink-0"></span>
                                Unlimited daily sessions (no 10/day cap)
                            </div>
                            <div className="flex items-center gap-2 text-xs font-mono text-theme-text-secondary">
                                <span className="w-1 h-1 bg-theme-accent flex-shrink-0"></span>
                                Every Pro assessment unlocked
                            </div>
                            <div className="flex items-center gap-2 text-xs font-mono text-theme-text-secondary">
                                <span className="w-1 h-1 bg-theme-accent flex-shrink-0"></span>
                                Advanced Insights (d′, response patterns)
                            </div>
                        </div>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="mt-4 p-3 bg-neural-synapse/10 border border-neural-synapse/30 text-xs font-mono text-neural-synapse">
                            {error}
                        </div>
                    )}
                </div>

                {/* Actions Footer */}
                <div className="border-t border-theme-line px-5 py-4">
                    {/* Trust signal */}
                    <p className="text-xs font-mono text-theme-text-muted text-center mb-4">
                        Cancel anytime
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-col-reverse sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={handleContinueWithout}
                            disabled={isProcessing}
                            className="flex-1 px-5 py-2.5 text-sm font-mono uppercase tracking-wider
                                     text-theme-text-secondary hover:text-theme-text
                                     border border-theme-line hover:border-warm-muted
                                     bg-theme-bg-elevated hover:bg-theme-bg-surface
                                     transition-all duration-200
                                     disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Maybe Later
                        </button>
                        <button
                            type="button"
                            onClick={handleStartTrial}
                            disabled={isProcessing}
                            className="flex-1 px-5 py-2.5 text-sm font-mono uppercase tracking-wider
                                     text-theme-bg bg-theme-accent hover:bg-amber-highlight
                                     transition-all duration-200
                                     flex items-center justify-center gap-2
                                     disabled:opacity-70 disabled:cursor-not-allowed"
                            style={{
                                animation: isProcessing ? 'none' : 'pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                            }}
                        >
                            {isProcessing ? (
                                <>
                                    <div className="h-4 w-4 border-2 border-charcoal/30 border-t-charcoal rounded-full animate-spin"></div>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <FontAwesomeIcon icon={faInfinity} className="w-4 h-4 sm:hidden" />
                                    Subscribe Now
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Pulse animation styles */}
                <style>{`
                    @keyframes pulse-subtle {
                        0%, 100% {
                            box-shadow: 0 0 0 0 rgba(228, 184, 92, 0.4);
                        }
                        50% {
                            box-shadow: 0 0 0 4px rgba(228, 184, 92, 0);
                        }
                    }
                `}</style>
            </div>
        </div>,
        document.body
    );
};

AssessmentPaywallModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSubscriptionComplete: PropTypes.func,
    returnPath: PropTypes.string,
};

export default AssessmentPaywallModal;

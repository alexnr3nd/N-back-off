/* src/components/ui/ProTrialUpgradeModal.js */
/* Chess.com-style onboarding upgrade modal for the new credit-card-required Pro trial.
 * Shown after game 1 (onboarding interrupt), recurring on Very-Good+ sessions (7-day cooldown),
 * dashboard re-engagement after 14+ day gap, the inline modal for the chart paywall,
 * and the Adaptive Training card CTAs ("Start Session" / "Start Continuous") on the dashboard.
 *
 * On accept: calls recordUpgradeModalAccept → initiateSubscriptionCheckout → redirect to Stripe.
 * On dismiss: calls recordUpgradeModalDismiss with appropriate dismissType.
 *
 * Lifts plan-toggle UI + checkout invocation from AssessmentPaywallModal.js.
 * Lifts portal/backdrop/animation from FreeTrialOfferModal.js.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFlask, faChartLine, faInfinity } from '@fortawesome/free-solid-svg-icons';

// Firebase
import { functions as functionsInstance } from '../../firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { PRICE_IDS } from '../../constants/stripeConstants';

// Native IAP
import { isNative } from '../../utils/platform';
import { startNativeCheckoutFlow } from '../../services/paymentService';

// Presence tracking
import { usePresence } from '../../contexts/PresenceContext';
import { useUser } from '../../contexts/UserContext';
import {
    recordUpgradeModalDismissFn,
    recordUpgradeModalAcceptFn,
} from '../../contexts/user/userCloudFunctions';

let initiateSubscriptionCheckout = null;
try {
    if (functionsInstance) {
        initiateSubscriptionCheckout = httpsCallable(functionsInstance, 'initiateSubscriptionCheckout');
    }
} catch (error) {
    console.error('ProTrialUpgradeModal: Error initializing checkout function:', error);
}

const TRIAL_DAYS = 14;

function formatTrialEndDate() {
    const d = new Date();
    d.setDate(d.getDate() + TRIAL_DAYS);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ProTrialUpgradeModal = ({ isOpen, onClose, trigger, onAccept }) => {
    const [selectedPlan, setSelectedPlan] = useState('yearly');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const isMountedRef = useRef(true);
    const dismissedRef = useRef(false); // prevents double-firing dismiss callbacks (e.g., backdrop + escape)

    const { markCheckoutStarted, markUpgradeDeclined } = usePresence() || {};
    const { userHadTrial } = useUser();

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Prevent body scroll while modal is open
    useEffect(() => {
        if (!isOpen) return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, [isOpen]);

    // Reset dismissedRef each time the modal is reopened
    useEffect(() => {
        if (isOpen) dismissedRef.current = false;
    }, [isOpen]);

    // Escape key closes (counts as dismiss)
    useEffect(() => {
        if (!isOpen) return undefined;
        const handler = (e) => {
            if (e.key === 'Escape' && !isProcessing) {
                handleDismiss('escape');
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, isProcessing]);

    const trialEndStr = useMemo(formatTrialEndDate, [isOpen]);

    if (!isOpen) return null;

    const recordDismiss = (dismissType) => {
        if (dismissedRef.current) return;
        dismissedRef.current = true;
        if (recordUpgradeModalDismissFn) {
            recordUpgradeModalDismissFn({ trigger, dismissType }).catch(err => {
                console.warn('[ProTrialUpgradeModal] recordUpgradeModalDismiss failed:', err?.message);
            });
        }
    };

    const handleDismiss = (dismissType) => {
        recordDismiss(dismissType);
        if (markUpgradeDeclined) markUpgradeDeclined();
        onClose();
    };

    const handleStartTrial = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        setError(null);

        // Accept = checkout actually initiated (fire-and-forget; never blocks).
        // Recording at CTA-click inflated accepts on failure paths.
        const recordAccept = () => {
            if (recordUpgradeModalAcceptFn) {
                recordUpgradeModalAcceptFn({ trigger, selectedPlan }).catch(err => {
                    console.warn('[ProTrialUpgradeModal] recordUpgradeModalAccept failed:', err?.message);
                });
            }
        };

        // --- Native IAP path (RevenueCat / Google Play / App Store) ---
        if (isNative()) {
            try {
                recordAccept(); // purchase sheet is about to open
                const result = await startNativeCheckoutFlow({ selectedPlan });
                if (result.success) {
                    if (onAccept) onAccept();
                    onClose();
                } else {
                    throw new Error(result.error || 'Purchase failed.');
                }
            } catch (err) {
                if (isMountedRef.current) {
                    setError(err.message || 'An error occurred. Please try again.');
                    setIsProcessing(false);
                }
            }
            return;
        }

        // --- Web Stripe Checkout path ---
        if (!initiateSubscriptionCheckout) {
            setError('Checkout unavailable. Please try again later.');
            setIsProcessing(false);
            return;
        }

        const priceId = selectedPlan === 'yearly' ? PRICE_IDS.yearly : PRICE_IDS.monthly;
        if (!priceId) {
            setError('Invalid plan selected.');
            setIsProcessing(false);
            return;
        }

        try {
            const result = await initiateSubscriptionCheckout({
                priceId,
                cancelUrl: `/dashboard?upgrade_cancelled=1&uc_trigger=${encodeURIComponent(trigger)}`,
                clientVersion: 2,
            });
            const checkoutUrl = result?.data?.checkoutUrl;
            if (!checkoutUrl) throw new Error('Could not start checkout.');
            recordAccept(); // Stripe session created — user is reaching checkout
            if (markCheckoutStarted) await markCheckoutStarted(selectedPlan);
            window.location.href = checkoutUrl;
        } catch (err) {
            if (isMountedRef.current) {
                setError(err.message || 'An error occurred. Please try again.');
                setIsProcessing(false);
            }
        }
    };

    // CTA copy depends on whether user has had a trial before (Stripe rejects double trials)
    const ctaPrimary = userHadTrial ? 'Subscribe to Pro' : 'Start my 14-day free trial';
    const ctaSubline = userHadTrial
        ? `${selectedPlan === 'yearly' ? '$39.99 today, billed annually' : '$4.99 today, billed monthly'}. Cancel anytime in Settings.`
        : `$0 today. Cancel anytime in Settings before ${trialEndStr}.`;

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
            aria-labelledby="pro-trial-upgrade-modal-title"
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
                onClick={() => !isProcessing && handleDismiss('backdrop')}
            />

            {/* Modal Panel */}
            <div
                className="w-full max-w-md animate-fadeIn"
                style={{
                    position: 'relative',
                    backgroundColor: 'rgb(var(--color-bg-secondary))',
                    border: '1px solid rgb(var(--color-line))',
                    marginTop: 'auto',
                    marginBottom: 'auto',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="border-b border-theme-line px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                            <div className="absolute inset-0 w-2 h-2 bg-theme-accent rounded-full animate-ping opacity-40"></div>
                        </div>
                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                            {userHadTrial ? 'Upgrade to Pro' : 'Try Pro Free'}
                        </span>
                    </div>
                    <button
                        onClick={() => handleDismiss('x_button')}
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
                        id="pro-trial-upgrade-modal-title"
                    >
                        Train your working memory faster
                    </h3>
                    <p className="text-sm text-theme-text-secondary text-center mb-6">
                        {userHadTrial
                            ? 'Keep unlimited sessions, Pro assessments, and advanced Insights.'
                            : 'Pro members reach N=6 about 4× more often than free users.'}
                    </p>

                    {/* Feature Highlights */}
                    <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-6">
                        <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-3">
                            What changes with Pro
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-theme-bg border border-theme-line flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <FontAwesomeIcon icon={faInfinity} className="w-3 h-3 text-theme-accent" />
                                </div>
                                <div>
                                    <div className="text-sm font-mono text-theme-text">Train without the daily cap</div>
                                    <div className="text-xs text-theme-text-muted">Unlimited sessions (free: 10/day)</div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-theme-bg border border-theme-line flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <FontAwesomeIcon icon={faFlask} className="w-3 h-3 text-theme-accent" />
                                </div>
                                <div>
                                    <div className="text-sm font-mono text-theme-text">Measure your gains with science-backed tests</div>
                                    <div className="text-xs text-theme-text-muted">Counting Span, Digit Span, Visual Arrays &amp; more</div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-theme-bg border border-theme-line flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <FontAwesomeIcon icon={faChartLine} className="w-3 h-3 text-theme-accent" />
                                </div>
                                <div>
                                    <div className="text-sm font-mono text-theme-text">See exactly which sessions move the needle</div>
                                    <div className="text-xs text-theme-text-muted">Insights with d-prime, response patterns, and more</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Plan Selection */}
                    <div className="bg-theme-bg-elevated border border-theme-accent/30 p-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 bg-theme-bg border border-theme-line flex items-center justify-center">
                                <FontAwesomeIcon icon={faInfinity} className="w-4 h-4 text-theme-accent" />
                            </div>
                            <div>
                                <div className="text-sm font-serif text-theme-accent">
                                    {userHadTrial ? 'Choose Your Plan' : 'Start with Pro Free'}
                                </div>
                                <div className="text-xs font-mono text-theme-text-muted uppercase tracking-wider">
                                    {userHadTrial ? 'Subscribe Now' : '14-Day Free Trial'}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 mb-1">
                            {/* Yearly */}
                            <label
                                className={`flex items-center justify-between p-3 border cursor-pointer transition-all duration-200 ${
                                    selectedPlan === 'yearly'
                                        ? 'border-theme-accent bg-theme-accent/10'
                                        : 'border-theme-line hover:border-theme-border'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                        selectedPlan === 'yearly' ? 'border-theme-accent' : 'border-theme-line'
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

                            {/* Monthly */}
                            <label
                                className={`flex items-center justify-between p-3 border cursor-pointer transition-all duration-200 ${
                                    selectedPlan === 'monthly'
                                        ? 'border-theme-accent bg-theme-accent/10'
                                        : 'border-theme-line hover:border-theme-border'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                        selectedPlan === 'monthly' ? 'border-theme-accent' : 'border-theme-line'
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
                    <p className="text-xs font-mono text-theme-text-muted text-center mb-4">
                        {ctaSubline}
                    </p>

                    <div className="flex flex-col-reverse sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={() => handleDismiss('maybe_later')}
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
                                animation: isProcessing ? 'none' : 'pulse-subtle-pro 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                            }}
                        >
                            {isProcessing ? (
                                <>
                                    <div className="h-4 w-4 border-2 border-charcoal/30 border-t-charcoal rounded-full animate-spin"></div>
                                    Processing...
                                </>
                            ) : (
                                <>{ctaPrimary}</>
                            )}
                        </button>
                    </div>
                </div>

                <style>{`
                    @keyframes pulse-subtle-pro {
                        0%, 100% { box-shadow: 0 0 0 0 rgba(228, 184, 92, 0.4); }
                        50%      { box-shadow: 0 0 0 4px rgba(228, 184, 92, 0); }
                    }
                `}</style>
            </div>
        </div>,
        document.body
    );
};

ProTrialUpgradeModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    trigger: PropTypes.oneOf(['game_1', 'recurring', 'reengagement', 'chart_paywall', 'try_it_free', 'daily_cap', 'continuous_locked', 'sidebar_counter', 'start_card_counter', 'assessment_locked', 'checkout_recovery']).isRequired,
    onAccept: PropTypes.func,
};

export default ProTrialUpgradeModal;

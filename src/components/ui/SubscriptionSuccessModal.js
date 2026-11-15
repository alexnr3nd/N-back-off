/* src/components/ui/SubscriptionSuccessModal.js */
/* Post-subscription confirmation modal */

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfinity, faBrain, faChartLine } from '@fortawesome/free-solid-svg-icons';
import { PRICE_IDS } from '../../constants/stripeConstants';
import { trackEvent } from '../../utils/analyticsTracker';

const FEATURES_UNLOCKED = [
    { icon: faInfinity, label: 'Unlimited Sessions', desc: 'No 10/day cap' },
    { icon: faBrain, label: 'Pro Assessments', desc: 'Counting Span, Digit Span & more' },
    { icon: faChartLine, label: 'Advanced Insights', desc: 'd′, response patterns & more' },
];

const SubscriptionSuccessModal = ({ isOpen, onClose, subscriptionStatus, priceId }) => {
    const isTrial = subscriptionStatus === 'trialing';
    const isYearly = priceId === PRICE_IDS.yearly;
    const planName = isYearly ? 'Yearly' : 'Monthly';

    // Track confirmation view
    useEffect(() => {
        if (isOpen) {
            trackEvent('subscription_confirmation_viewed', {
                plan: isYearly ? 'yearly' : 'monthly',
                is_trial: isTrial,
            });
        }
    }, [isOpen, isYearly, isTrial]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Handle keyboard events
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleCTAClick = () => {
        trackEvent('subscription_confirmation_cta_clicked', {
            plan: isYearly ? 'yearly' : 'monthly',
            is_trial: isTrial,
        });
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
            aria-labelledby="subscription-success-modal-title"
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
                        <div className="relative">
                            <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                            <div className="absolute inset-0 w-2 h-2 bg-theme-accent rounded-full animate-ping opacity-40"></div>
                        </div>
                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                            Subscription Active
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-theme-text-muted hover:text-theme-text transition-colors p-1 -m-1"
                        aria-label="Close"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="square" strokeLinejoin="miter" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="px-5 py-6">
                    <h3
                        className="text-2xl font-serif text-theme-text mb-2 text-center"
                        id="subscription-success-modal-title"
                    >
                        {isTrial ? 'Your Free Trial Has Started' : 'Welcome to Pro'}
                    </h3>
                    <p className="text-base text-theme-text-secondary text-center mb-6">
                        {isTrial
                            ? 'Enjoy 14 days of full Pro access.'
                            : 'Your premium subscription is active.'
                        }
                    </p>

                    {/* Plan confirmation box */}
                    <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-6">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-mono uppercase tracking-wide text-theme-text-muted">
                                {planName} Plan
                            </span>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                                <span className="text-sm font-mono text-theme-accent">
                                    {isTrial ? 'Trial Active' : 'Active'}
                                </span>
                            </div>
                        </div>
                        {!isTrial && (
                            <div className="text-xs font-mono text-theme-text-muted mt-2">
                                {isYearly ? '$39.99/year' : '$4.99/month'}
                            </div>
                        )}
                    </div>

                    {/* Features unlocked */}
                    <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-6">
                        <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-3">
                            Now Unlocked
                        </div>

                        <div className="space-y-3">
                            {FEATURES_UNLOCKED.map((feature) => (
                                <div key={feature.label} className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-theme-bg border border-theme-line flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <FontAwesomeIcon icon={feature.icon} className="w-3 h-3 text-theme-accent" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-mono text-theme-text">{feature.label}</div>
                                        <div className="text-xs text-theme-text-muted">{feature.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Footer CTA */}
                <div className="border-t border-theme-line px-5 py-4">
                    <button
                        type="button"
                        onClick={handleCTAClick}
                        className="w-full px-5 py-2.5 text-sm font-mono uppercase tracking-wider
                                 text-theme-bg bg-theme-accent hover:bg-amber-highlight
                                 transition-all duration-200
                                 flex items-center justify-center gap-2"
                    >
                        Start Training
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

SubscriptionSuccessModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    subscriptionStatus: PropTypes.string,
    priceId: PropTypes.string,
};

export default SubscriptionSuccessModal;

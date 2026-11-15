/* src/components/ui/FreeTrialEndedModal.js */
/* Modal shown when a user's 14-day gifted Pro access has ended */

import React, { useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFlask, faChartLine, faInfinity } from '@fortawesome/free-solid-svg-icons';

const FreeTrialEndedModal = ({ isOpen, onSubscribe, onDismiss }) => {
    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Handle escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onDismiss();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onDismiss]);

    // Handle backdrop click
    const handleBackdropClick = useCallback(() => {
        onDismiss();
    }, [onDismiss]);

    if (!isOpen) return null;

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
            onClick={handleBackdropClick}
        >
            {/* Background overlay */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(4px)',
                    pointerEvents: 'none',
                }}
            />

            {/* Modal panel */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '28rem',
                    marginTop: 'auto',
                    marginBottom: 'auto',
                    backgroundColor: 'rgb(var(--color-bg-secondary))',
                    border: '1px solid rgb(var(--color-line))',
                    borderRadius: '2px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="free-trial-ended-title"
                onClick={(e) => e.stopPropagation()}
                className="animate-fadeIn"
            >
                {/* Header bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-theme-line">
                    <span className="text-xs font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                        Pro Access Ended
                    </span>
                    <button
                        onClick={onDismiss}
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
                    {/* Title */}
                    <h2
                        id="free-trial-ended-title"
                        className="text-xl font-serif text-theme-text mb-2 text-center"
                    >
                        Thanks for Trying Pro
                    </h2>
                    <p className="text-sm text-theme-text-secondary text-center mb-6">
                        Your 14 days of Pro are over. Subscribe to keep unlimited sessions and Pro features, or continue free with 10 sessions a day.
                    </p>

                    {/* What you keep vs what's Pro */}
                    <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-4">
                        <div className="text-xs font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-3">
                            Subscribe to keep
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-theme-bg border border-theme-line flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <FontAwesomeIcon icon={faFlask} className="w-3 h-3 text-theme-accent" />
                                </div>
                                <div>
                                    <div className="text-sm font-mono text-theme-text">Cognitive Assessments</div>
                                    <div className="text-xs text-theme-text-muted">Standardized cognitive benchmarks</div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-theme-bg border border-theme-line flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <FontAwesomeIcon icon={faChartLine} className="w-3 h-3 text-theme-accent" />
                                </div>
                                <div>
                                    <div className="text-sm font-mono text-theme-text">Advanced Analytics</div>
                                    <div className="text-xs text-theme-text-muted">Performance trends and comparisons</div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-theme-bg border border-theme-line flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <FontAwesomeIcon icon={faInfinity} className="w-3 h-3 text-theme-accent" />
                                </div>
                                <div>
                                    <div className="text-sm font-mono text-theme-text">Unlimited Sessions</div>
                                    <div className="text-xs text-theme-text-muted">No 10/day session cap</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pricing */}
                    <div className="flex gap-3 mb-2">
                        <div className="flex-1 border border-theme-line p-3 text-center">
                            <div className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-1">Monthly</div>
                            <div className="text-lg font-serif text-theme-text">$4.99</div>
                            <div className="text-[0.625rem] font-mono text-theme-text-muted">/month</div>
                        </div>
                        <div className="flex-1 border border-theme-accent/50 bg-theme-accent/5 p-3 text-center">
                            <div className="text-xs font-mono text-theme-accent uppercase tracking-wider mb-1">Yearly</div>
                            <div className="text-lg font-serif text-theme-text">$3.33</div>
                            <div className="text-[0.625rem] font-mono text-theme-text-muted">/month — $39.99/year</div>
                        </div>
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="border-t border-theme-line px-5 py-4">
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={onSubscribe}
                            className="w-full px-5 py-2.5 text-sm font-mono uppercase tracking-wider
                                bg-theme-accent hover:bg-amber-highlight text-theme-bg border border-theme-accent
                                transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            Subscribe
                        </button>
                        <p className="text-xs font-mono text-theme-text-muted text-center">
                            Cancel anytime
                        </p>

                        <button
                            type="button"
                            onClick={onDismiss}
                            className="w-full px-5 py-2.5 text-sm font-mono uppercase tracking-wider
                                text-theme-text-secondary hover:text-theme-text
                                border border-theme-line hover:border-warm-muted
                                bg-theme-bg-elevated hover:bg-theme-bg-surface
                                transition-all duration-200"
                        >
                            Continue with Classic
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default FreeTrialEndedModal;

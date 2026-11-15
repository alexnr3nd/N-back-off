/* src/components/ui/FreeTrialOfferModal.js */
/* Modal gifting 14 days of Pro access to free-tier users after 30 sessions */

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFlask, faChartLine, faInfinity } from '@fortawesome/free-solid-svg-icons';

const FreeTrialOfferModal = ({ isOpen, onAccept, onDecline, onDismiss, isLoading }) => {
    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Escape and backdrop just close the modal — they do NOT permanently decline
    // Only the explicit "No Thanks" button calls onDecline (which is permanent)

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
                aria-labelledby="free-trial-offer-title"
                onClick={(e) => e.stopPropagation()}
                className="animate-fadeIn"
            >
                {/* Header bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-theme-line">
                    <div className="flex items-center gap-2">
                        <div className="relative w-2 h-2">
                            <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full"></div>
                            <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping opacity-40"></div>
                        </div>
                        <span className="text-xs font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                            A Gift for You
                        </span>
                    </div>
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
                    {/* Gift icon */}
                    <div className="text-center mb-3">
                        <span className="text-4xl" role="img" aria-label="gift">&#x1F381;</span>
                    </div>

                    {/* Title */}
                    <h2
                        id="free-trial-offer-title"
                        className="text-xl font-serif text-theme-text mb-2 text-center"
                    >
                        14 Days of Pro — On Us
                    </h2>
                    <p className="text-sm text-theme-text-secondary text-center mb-6">
                        Just tap Activate. No card. No signup. Nothing else.
                    </p>

                    {/* Feature Highlights */}
                    <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-4">
                        <div className="text-xs font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-3">
                            What You Get
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

                    {/* Post-trial note */}
                    <p className="text-xs font-mono text-theme-text-muted text-center">
                        After 14 days, you'll continue training in Classic mode. No charges, ever. You won't lose any progress.
                    </p>
                </div>

                {/* Actions Footer */}
                <div className="border-t border-theme-line px-5 py-4 space-y-3">
                    <button
                        type="button"
                        onClick={onAccept}
                        disabled={isLoading}
                        className="w-full px-5 py-2.5 text-sm font-mono uppercase tracking-wider
                            bg-theme-accent hover:bg-amber-highlight text-theme-bg border border-theme-accent
                            transition-all duration-200 flex items-center justify-center gap-2
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <span>Activating...</span>
                        ) : (
                            <span>Activate Pro</span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={onDecline}
                        disabled={isLoading}
                        className="w-full px-5 py-2.5 text-sm font-mono uppercase tracking-wider
                            text-theme-text-secondary hover:text-theme-text
                            border border-theme-line hover:border-warm-muted
                            bg-theme-bg-elevated hover:bg-theme-bg-surface
                            transition-all duration-200
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        No Thanks
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default FreeTrialOfferModal;

/* src/components/ui/DailyCapModal.js */
/* Daily Adaptive cap paywall — surfaced when a non-Pro user hits the daily cap. */
/* Restored from src/components/ui/SessionLimitModal.js (commit 3125e7d~1)   */
/* and rewired to feed into the CC-required Pro trial flow (May 12 2026).   */

import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfinity, faCheck } from '@fortawesome/free-solid-svg-icons';
import { useUpgradeModal } from '../../hooks/useUpgradeModal';
import { trackEvent } from '../../utils/analyticsTracker';
import { DAILY_ADAPTIVE_CAP } from '../../constants/gameConstants';

/**
 * Modal shown when a non-Pro user hits the daily Adaptive cap.
 * Does NOT initiate checkout directly — the CTA hands off to ProTrialUpgradeModal
 * with trigger='daily_cap', which owns the unified CC-required trial flow.
 */
const DailyCapModal = ({ isOpen, onClose, dailyCapInfo }) => {
    const { openUpgradeModal } = useUpgradeModal();
    const isMountedRef = useRef(true);
    const shownRef = useRef(false);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Prevent body scroll while open
    useEffect(() => {
        if (!isOpen) return;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Log the impression once per open (the modal stays mounted between opens)
    const capSource = dailyCapInfo?.source;
    const hasCapInfo = !!dailyCapInfo;
    useEffect(() => {
        if (!isOpen || !hasCapInfo) {
            shownRef.current = false;
            return;
        }
        if (shownRef.current) return;
        shownRef.current = true;
        trackEvent('daily_cap_modal_shown', { source: capSource || 'unknown' });
    }, [isOpen, hasCapInfo, capSource]);

    if (!isOpen || !dailyCapInfo) return null;

    const { sessionsUsed, dailyCap, source } = dailyCapInfo;
    const safeSessionsUsed = typeof sessionsUsed === 'number' ? sessionsUsed : (dailyCap ?? DAILY_ADAPTIVE_CAP);
    const safeDailyCap = typeof dailyCap === 'number' ? dailyCap : DAILY_ADAPTIVE_CAP;
    const progressPercentage = Math.min(100, (safeSessionsUsed / safeDailyCap) * 100);

    const handleStartTrial = () => {
        trackEvent('daily_cap_modal_cta_clicked', { trigger: 'daily_cap' });
        onClose();
        openUpgradeModal('daily_cap');
    };

    const handleDismiss = () => {
        trackEvent('daily_cap_modal_dismissed', {});
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
            aria-labelledby="daily-cap-modal-title"
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
                onClick={handleDismiss}
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
                        <div className="relative">
                            <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                            <div className="absolute inset-0 w-2 h-2 bg-theme-accent rounded-full animate-ping opacity-40"></div>
                        </div>
                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                            Daily Cap Reached
                        </span>
                    </div>

                    <button
                        onClick={handleDismiss}
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
                        className="text-xl font-serif text-theme-text mb-2 text-center"
                        id="daily-cap-modal-title"
                    >
                        {safeSessionsUsed} Adaptive Sessions Completed Today
                    </h3>
                    <p className="text-sm text-theme-text-secondary text-center mb-2">
                        That's the free daily cap. Strong work today — back at it tomorrow.
                    </p>
                    {source === 'post_save' && (
                        <p className="text-xs font-mono text-theme-text-muted text-center mb-6">
                            This session was scored but not saved.
                        </p>
                    )}

                    {/* Progress gauge */}
                    <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted">
                                Today's Adaptive
                            </span>
                            <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted">
                                {safeSessionsUsed} / {safeDailyCap}
                            </span>
                        </div>

                        <div className="relative h-6 bg-theme-bg border border-theme-line overflow-hidden mb-2">
                            <div
                                className="absolute inset-0 opacity-30"
                                style={{
                                    backgroundImage: 'linear-gradient(90deg, transparent 0%, transparent calc(100% - 1px), rgba(58, 53, 47, 0.5) 100%)',
                                    backgroundSize: '10% 100%'
                                }}
                            />
                            <div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-accent/50 to-amber-accent transition-all duration-500"
                                style={{ width: `${progressPercentage}%` }}
                            >
                                <div className="absolute right-0 top-0 bottom-0 w-2 bg-theme-accent"></div>
                            </div>
                            {[25, 50, 75].map((pos) => (
                                <div
                                    key={pos}
                                    className="absolute top-0 bottom-0 w-px bg-theme-bg-line"
                                    style={{ left: `${pos}%` }}
                                />
                            ))}
                        </div>

                        <div className="flex items-center justify-center gap-2">
                            <FontAwesomeIcon icon={faCheck} className="w-3 h-3 text-theme-accent" />
                            <span className="text-xs font-mono text-theme-accent uppercase tracking-wider">
                                Cap Reached — Resets at Midnight
                            </span>
                        </div>
                    </div>

                    {/* Upgrade pitch */}
                    <div className="bg-theme-bg-elevated border border-theme-accent/30 p-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 bg-theme-bg border border-theme-line flex items-center justify-center">
                                <FontAwesomeIcon icon={faInfinity} className="w-4 h-4 text-theme-accent" />
                            </div>
                            <div>
                                <div className="text-sm font-serif text-theme-accent">Go Unlimited with Pro</div>
                                <div className="text-xs font-mono text-theme-text-muted uppercase tracking-wider">
                                    14-Day Free Trial — Credit Card Required
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-mono text-theme-text-secondary">
                                <span className="w-1 h-1 bg-theme-accent flex-shrink-0"></span>
                                Unlimited Adaptive sessions
                            </div>
                            <div className="flex items-center gap-2 text-xs font-mono text-theme-text-secondary">
                                <span className="w-1 h-1 bg-theme-accent flex-shrink-0"></span>
                                Full analytics + Insights
                            </div>
                            <div className="flex items-center gap-2 text-xs font-mono text-theme-text-secondary">
                                <span className="w-1 h-1 bg-theme-accent flex-shrink-0"></span>
                                Working memory assessments
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer actions */}
                <div className="border-t border-theme-line px-5 py-4">
                    <p className="text-xs font-mono text-theme-text-muted text-center mb-4">
                        Cancel anytime during the trial
                    </p>
                    <div className="flex flex-col-reverse sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={handleDismiss}
                            className="flex-1 px-5 py-2.5 text-sm font-mono uppercase tracking-wider
                                     text-theme-text-secondary hover:text-theme-text
                                     border border-theme-line hover:border-warm-muted
                                     bg-theme-bg-elevated hover:bg-theme-bg-surface
                                     transition-all duration-200"
                        >
                            Continue Tomorrow
                        </button>
                        <button
                            type="button"
                            onClick={handleStartTrial}
                            className="flex-1 px-5 py-2.5 text-sm font-mono uppercase tracking-wider
                                     text-theme-bg bg-theme-accent hover:bg-amber-highlight
                                     transition-all duration-200
                                     flex items-center justify-center gap-2"
                            style={{
                                animation: 'pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                            }}
                        >
                            <FontAwesomeIcon icon={faInfinity} className="w-4 h-4 sm:hidden" />
                            Start Free Trial
                        </button>
                    </div>
                </div>

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

DailyCapModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    dailyCapInfo: PropTypes.shape({
        sessionsUsed: PropTypes.number,
        dailyCap: PropTypes.number,
        // 'chain_end' = a Continuous chain stopped at the cap between blocks.
        source: PropTypes.oneOf(['pre_start', 'post_save', 'offline_retry', 'chain_end']),
    }),
};

export default DailyCapModal;

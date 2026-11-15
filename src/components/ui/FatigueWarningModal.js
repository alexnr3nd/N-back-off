/* src/components/ui/FatigueWarningModal.js */
/* Cognitive Lab Aesthetic - Performance Fatigue Alert */

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

/**
 * Modal shown when a user shows signs of cognitive fatigue after extended play.
 * Suggests taking a break based on declining d-prime performance.
 */
const FatigueWarningModal = ({
    isOpen,
    onContinue,
    onTakeBreak,
    consecutiveCount,
    declineData,
}) => {
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
                onContinue();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onContinue]);

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
            aria-labelledby="fatigue-warning-modal-title"
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
                onClick={onContinue}
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
                {/* Header with alert indicator */}
                <div className="border-b border-theme-line px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Warning indicator - amber for caution */}
                        <div className="relative">
                            <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                            <div className="absolute inset-0 w-2 h-2 bg-theme-accent rounded-full animate-ping opacity-50"></div>
                        </div>
                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                            Performance Notice
                        </span>
                    </div>

                    {/* Close button */}
                    <button
                        onClick={onContinue}
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
                    <h3
                        className="text-2xl font-serif text-theme-text mb-3 text-center"
                        id="fatigue-warning-modal-title"
                    >
                        Diminishing Returns Detected
                    </h3>
                    <p className="text-base text-theme-text-secondary text-center mb-6">
                        Your performance is declining compared to earlier sessions.
                    </p>

                    {/* Performance Trajectory Data - Show when available */}
                    {declineData && (
                        <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-6">
                            {/* Header with session count and game mode */}
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-mono uppercase tracking-wide text-theme-text-muted">
                                    Performance Trend
                                    {declineData.gameMode && declineData.gameMode !== 'dual' && (
                                        <span className="ml-2 text-theme-accent">
                                            ({declineData.gameMode})
                                        </span>
                                    )}
                                </span>
                                <span className="text-sm font-mono font-medium text-theme-text">
                                    {declineData.totalSessions} sessions
                                </span>
                            </div>

                            {/* Level range context */}
                            <div className="text-xs font-mono text-theme-text-muted mb-4">
                                Levels: {declineData.levelRangeMin} – {declineData.levelRangeMax}
                            </div>

                            {/* Early sessions stats */}
                            <div className="mb-3">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-sm text-theme-text-secondary">
                                        Early ({declineData.earlySessions} sessions)
                                    </span>
                                    <div className="flex items-center gap-3">
                                        {declineData.earlyAvgLevel && (
                                            <span className="text-sm font-mono font-medium text-theme-text-muted">
                                                {declineData.earlyAvgLevel}
                                            </span>
                                        )}
                                        <span className="text-sm font-mono font-medium text-neural-pulse">
                                            {declineData.earlyAvgDprime.toFixed(2)} d′
                                        </span>
                                    </div>
                                </div>
                                <div className="relative h-4 bg-theme-bg border border-theme-line overflow-hidden">
                                    <div
                                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-neural-pulse/40 to-neural-pulse transition-all duration-500"
                                        style={{ width: `${Math.min(100, (declineData.earlyAvgDprime / 4) * 100)}%` }}
                                    >
                                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-neural-pulse"></div>
                                    </div>
                                </div>
                            </div>

                            {/* Recent sessions stats */}
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-sm text-theme-text-secondary">
                                        Recent ({declineData.recentSessions} sessions)
                                    </span>
                                    <div className="flex items-center gap-3">
                                        {declineData.recentAvgLevel && (
                                            <span className="text-sm font-mono font-medium text-theme-text-muted">
                                                {declineData.recentAvgLevel}
                                            </span>
                                        )}
                                        <span className="text-sm font-mono font-medium text-theme-accent">
                                            {declineData.recentAvgDprime.toFixed(2)} d′
                                        </span>
                                    </div>
                                </div>
                                <div className="relative h-4 bg-theme-bg border border-theme-line overflow-hidden">
                                    <div
                                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-accent/40 to-amber-accent transition-all duration-500"
                                        style={{ width: `${Math.min(100, (declineData.recentAvgDprime / 4) * 100)}%` }}
                                    >
                                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-theme-accent"></div>
                                    </div>
                                </div>
                            </div>

                            {/* Decline indicator */}
                            <div className="flex items-center justify-center gap-2 pt-2 border-t border-theme-line">
                                <svg className="w-4 h-4 text-theme-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                </svg>
                                <span className="text-sm font-mono text-theme-accent">
                                    Decline: {declineData.declineAmount.toFixed(2)} d′
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Session Count Display - Show when no decline data */}
                    {!declineData && (
                        <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-mono uppercase tracking-wide text-theme-text-muted">
                                    Consecutive Sessions
                                </span>
                                <span className="text-sm font-mono font-medium text-theme-accent">
                                    {consecutiveCount} sessions
                                </span>
                            </div>

                            {/* Visual indicator bar */}
                            <div className="relative h-5 bg-theme-bg border border-theme-line overflow-hidden mb-3">
                                {/* Background grid */}
                                <div
                                    className="absolute inset-0 opacity-30"
                                    style={{
                                        backgroundImage: 'linear-gradient(90deg, transparent 0%, transparent calc(100% - 1px), rgba(58, 53, 47, 0.5) 100%)',
                                        backgroundSize: '10% 100%'
                                    }}
                                />

                                {/* Fill bar - shows intensity of session count */}
                                <div
                                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-accent/40 to-amber-accent transition-all duration-500"
                                    style={{ width: `${Math.min(100, (consecutiveCount / 60) * 100)}%` }}
                                >
                                    <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-theme-accent"></div>
                                </div>
                            </div>

                            {/* Status text */}
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                                <span className="text-sm font-mono text-theme-accent uppercase tracking-wide">
                                    Extended Session
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Break recommendation section */}
                    <div className="bg-theme-bg-elevated border border-neural-pulse/30 p-4">
                        <div className="flex items-start gap-3 mb-3">
                            {/* Brain/rest icon */}
                            <div className="w-10 h-10 bg-theme-bg border border-theme-line flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-neural-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-base font-serif text-neural-pulse">Take a Break</div>
                                <div className="text-sm font-mono text-theme-text-muted">
                                    Recommended: 20-30 minutes
                                </div>
                            </div>
                        </div>

                        <p className="text-sm text-theme-text-secondary ml-13 leading-relaxed">
                            Research suggests that cognitive training benefits from rest periods.
                            Taking a short break can help consolidate learning and restore focus.
                        </p>
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="border-t border-theme-line px-5 py-4 flex flex-col-reverse sm:flex-row gap-3">
                    <button
                        type="button"
                        onClick={onContinue}
                        className="flex-1 px-5 py-2.5 text-sm font-mono uppercase tracking-wider
                                 text-theme-text-secondary hover:text-theme-text
                                 border border-theme-line hover:border-warm-muted
                                 bg-theme-bg-elevated hover:bg-theme-bg-surface
                                 transition-all duration-200"
                    >
                        Continue Anyway
                    </button>
                    <button
                        type="button"
                        onClick={onTakeBreak}
                        className="flex-1 px-5 py-2.5 text-sm font-mono uppercase tracking-wider
                                 text-theme-bg bg-theme-accent hover:bg-amber-highlight
                                 transition-all duration-200
                                 flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Take a Break
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

FatigueWarningModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onContinue: PropTypes.func.isRequired,
    onTakeBreak: PropTypes.func.isRequired,
    consecutiveCount: PropTypes.number.isRequired,
    declineData: PropTypes.shape({
        totalSessions: PropTypes.number,
        gameMode: PropTypes.string,
        levelRangeMin: PropTypes.string,
        levelRangeMax: PropTypes.string,
        earlyAvgDprime: PropTypes.number,
        recentAvgDprime: PropTypes.number,
        earlyAvgLevel: PropTypes.string,
        recentAvgLevel: PropTypes.string,
        declineAmount: PropTypes.number,
        earlySessions: PropTypes.number,
        recentSessions: PropTypes.number,
    }),
};

export default FatigueWarningModal;

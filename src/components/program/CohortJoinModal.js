/* src/components/program/CohortJoinModal.js */

/**
 * Modal for joining a cohort — two modes:
 * 1. If savedDisplayName is set: simplified confirmation (no input needed)
 * 2. If no savedDisplayName: display name input + join button
 *
 * Design: Matches ConfirmationModal / WelcomeModal Cognitive Lab pattern.
 * Uses React Portal to render at document body level.
 */

import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers } from '@fortawesome/free-solid-svg-icons';
import { useCohort } from '../../contexts/CohortContext';

const CohortJoinModal = ({ programId, defaultName, savedDisplayName, skipRejoin = false, onClose }) => {
    const { joinCohort } = useCohort();
    const [displayName, setDisplayName] = useState(defaultName || '');
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState(null);

    // Prevent body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    // Escape key to close
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !isJoining) onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, isJoining]);

    const handleJoin = useCallback(async () => {
        // Use saved name if available, otherwise use input
        const nameToUse = savedDisplayName || displayName.trim();

        if (!savedDisplayName) {
            if (nameToUse.length < 3) {
                setError('Name must be at least 3 characters.');
                return;
            }
            if (nameToUse.length > 25) {
                setError('Name must be 25 characters or fewer.');
                return;
            }
        }

        setIsJoining(true);
        setError(null);

        try {
            await joinCohort(programId, nameToUse, skipRejoin);
            onClose();
        } catch (err) {
            const message = err?.message || err?.code || 'Failed to join cohort. Please try again.';
            const cleanMessage = message.includes('HttpsError')
                ? message.split(': ').pop()
                : message;
            setError(cleanMessage);
        }
        setIsJoining(false);
    }, [displayName, savedDisplayName, programId, joinCohort, skipRejoin, onClose]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !isJoining) {
            if (savedDisplayName || displayName.trim().length >= 3) handleJoin();
        }
    }, [handleJoin, isJoining, displayName, savedDisplayName]);

    const canJoin = savedDisplayName
        ? !isJoining
        : displayName.trim().length >= 3 && !isJoining;

    const modalContent = (
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
                }}
                onClick={!isJoining ? onClose : undefined}
            />

            {/* Modal panel */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '28rem',
                    backgroundColor: 'rgb(var(--color-bg-secondary))',
                    border: '1px solid rgb(var(--color-line))',
                    borderRadius: '2px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    marginTop: 'auto',
                    marginBottom: 'auto',
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="join-cohort-title"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Body */}
                <div className="px-6 pt-6 pb-4">
                    <div className="sm:flex sm:items-start">
                        {/* Icon */}
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-theme-accent/20 sm:mx-0 sm:h-10 sm:w-10">
                            <FontAwesomeIcon icon={faUsers} className="h-5 w-5 text-theme-accent" aria-hidden="true" />
                        </div>
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                            {/* Title */}
                            <h3 className="text-lg font-serif text-theme-text" id="join-cohort-title">
                                Join Cohort
                            </h3>

                            {savedDisplayName ? (
                                /* Simplified confirmation mode */
                                <div className="mt-2">
                                    <p className="text-sm text-theme-text-secondary font-mono">
                                        You'll appear as <span className="text-theme-text font-semibold">{savedDisplayName}</span>.
                                    </p>
                                    <p className="mt-2 text-xs text-theme-text-muted font-mono">
                                        You can change this in Settings.
                                    </p>
                                </div>
                            ) : (
                                /* Full name input mode */
                                <>
                                    <div className="mt-2 text-sm text-theme-text-secondary font-mono">
                                        Choose a display name for your cohort. This is how other members will see you.
                                    </div>
                                    <div className="mt-5">
                                        <label htmlFor="cohort-display-name" className="block text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-2">
                                            Display Name
                                        </label>
                                        <input
                                            type="text"
                                            id="cohort-display-name"
                                            value={displayName}
                                            onChange={(e) => { setDisplayName(e.target.value); setError(null); }}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Enter your name"
                                            maxLength={25}
                                            className="block w-full px-4 py-3 bg-theme-bg-elevated border border-theme-line rounded-lab
                                                text-theme-text font-mono text-sm placeholder-warm-muted/50
                                                focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-theme-accent
                                                transition-colors duration-200"
                                            autoFocus
                                            autoComplete="off"
                                        />
                                        <p className="text-xs text-theme-text-muted mt-1.5 font-mono">
                                            3-25 characters. Visible to your cohort members.
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* Error */}
                            {error && (
                                <p className="mt-3 text-sm text-neural-synapse font-mono">{error}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="bg-theme-bg-elevated px-6 py-4 border-t border-theme-line sm:flex sm:flex-row-reverse gap-3">
                    {/* Join Button */}
                    <button
                        type="button"
                        onClick={handleJoin}
                        disabled={!canJoin}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-lab text-sm font-mono uppercase tracking-wider
                            bg-theme-accent hover:bg-amber-highlight text-theme-bg border border-theme-accent
                            transition-all duration-200 inline-flex items-center justify-center gap-2
                            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-theme-bg-secondary focus:ring-theme-accent
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isJoining ? (
                            <>
                                <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
                                Joining...
                            </>
                        ) : (
                            'Join Cohort'
                        )}
                    </button>

                    {/* Cancel Button */}
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isJoining}
                        className="w-full sm:w-auto mt-3 sm:mt-0 px-5 py-2.5 rounded-lab text-sm font-mono uppercase tracking-wider
                            bg-theme-bg-secondary hover:bg-theme-bg-surface text-theme-text-secondary hover:text-theme-text
                            border border-theme-line transition-all duration-200
                            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-theme-bg-secondary focus:ring-theme-accent
                            disabled:opacity-50"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default CohortJoinModal;

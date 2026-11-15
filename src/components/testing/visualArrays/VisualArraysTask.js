/* src/components/testing/visualArrays/VisualArraysTask.js */
import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';
import useVisualArraysLogic from './hooks/useVisualArraysLogic';
import { VISUAL_ARRAYS_PHASES } from '../../../constants/visualArraysConstants';

import ArrayDisplay from './ArrayDisplay';
import ResponseButtons from './ResponseButtons';
import VisualArraysResults from './VisualArraysResults';
import LoadingSpinner from '../../ui/LoadingSpinner';
import ConfirmationModal from '../../ui/ConfirmationModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faForward, faTimes, faVectorSquare, faRotateRight, faMugHot } from '@fortawesome/free-solid-svg-icons';
import FeedbackButton from '../../feedback/FeedbackButton';

const P = VISUAL_ARRAYS_PHASES;

// Phases rendered inside the gray stimulus field
const STIMULUS_PHASES = [P.FIXATION, P.CUE, P.CUE_GAP, P.ARRAY, P.RETENTION, P.PROBE, P.TRIAL_FEEDBACK];

const computeContainerSize = () =>
    Math.round(Math.min(window.innerWidth * 0.85, window.innerHeight * 0.55));

const VisualArraysTask = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { refreshUserData } = useUser();
    const isDevelopment = process.env.NODE_ENV === 'development';
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const [containerSize, setContainerSize] = useState(computeContainerSize);
    const earlyRetake = location.state?.earlyRetake || false;

    const {
        currentPhase, currentTrialSpec, isPractice, practiceNumber, practiceTotal,
        trialNumber, totalTrials, completedTrialCount, canSavePartial,
        lastFeedbackCorrect, isFamiliarization, hasScoredData,
        notEligibleMessage, finalScores, isLoading, error,
        initializeSession, startScoredBlock, continueFromBreak, skipPractice,
        handleRespond, handleExitAssessment, handleDevSkipTask,
    } = useVisualArraysLogic({
        earlyRetake,
        onExit: () => navigate('/testing/visual-arrays'),
    });

    // Initialize session on mount (idempotent via didInitRef in the logic hook)
    useEffect(() => {
        if (currentPhase === P.INSTRUCTIONS) {
            initializeSession();
        }
    }, [initializeSession, currentPhase]);

    useEffect(() => {
        const onResize = () => setContainerSize(computeContainerSize());
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const openExitModal = useCallback(() => setIsExitModalOpen(true), []);
    const closeExitModal = useCallback(() => setIsExitModalOpen(false), []);
    const confirmExit = useCallback(() => { closeExitModal(); handleExitAssessment(); }, [closeExitModal, handleExitAssessment]);

    const handleDone = useCallback(() => {
        // Refresh AFTER the task is finished (Done press), never at save-success
        // — refreshing earlier unmounts the in-task results screen.
        refreshUserData();
        navigate('/testing/visual-arrays', { state: { justUpdatedVisualArrays: true } });
    }, [refreshUserData, navigate]);

    // --- Render ---
    const renderContent = () => {
        if (isLoading && currentPhase !== P.RESULTS) {
            const message = currentPhase === P.SAVING ? 'Saving results...' : 'Loading assessment...';
            return <LoadingSpinner message={message} theme="auto" />;
        }

        if (error && currentPhase !== P.RESULTS) {
            return (
                <div className="text-center p-6">
                    <div className="h-12 w-12 mx-auto mb-4 bg-status-error/20 border border-status-error flex items-center justify-center">
                        <FontAwesomeIcon icon={faTimes} className="h-5 w-5 text-status-error" />
                    </div>
                    <p className="font-serif italic text-theme-text mb-2">An Error Occurred</p>
                    <p className="text-sm text-theme-text-secondary mb-6">{error}</p>
                    <button onClick={() => navigate('/testing/visual-arrays')} className="px-6 py-2 bg-theme-bg-elevated border border-theme-line text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent transition-colors text-sm font-mono uppercase tracking-wider">
                        Return to Summary
                    </button>
                </div>
            );
        }

        if (STIMULUS_PHASES.includes(currentPhase)) {
            return (
                <div className="w-full flex flex-col items-center gap-4">
                    <ArrayDisplay
                        phase={currentPhase}
                        trialSpec={currentTrialSpec}
                        containerSize={containerSize}
                        feedbackCorrect={lastFeedbackCorrect}
                    />
                    {/* Mounted through all stimulus phases so probe onset causes
                        no layout shift; interactive only during PROBE */}
                    <div style={{ visibility: currentPhase === P.PROBE ? 'visible' : 'hidden' }} className="w-full">
                        <ResponseButtons
                            onRespond={handleRespond}
                            disabled={currentPhase !== P.PROBE || isExitModalOpen}
                        />
                    </div>
                </div>
            );
        }

        switch (currentPhase) {
            case P.READY:
                return (
                    <div className="text-center py-8">
                        <p className="text-xl font-serif italic text-theme-text mb-4">Practice Complete</p>
                        <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">
                            The {totalTrials} scored trials start now, with a short break at the
                            halfway point. No more feedback after each trial — that's normal.
                        </p>
                        <button
                            onClick={startScoredBlock}
                            className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
                        >
                            Begin Scored Trials
                        </button>
                    </div>
                );

            case P.BREAK:
                return (
                    <div className="text-center py-8">
                        <div className="h-12 w-12 mx-auto mb-4 bg-theme-accent/10 border border-theme-accent flex items-center justify-center">
                            <FontAwesomeIcon icon={faMugHot} className="h-5 w-5 text-theme-accent" />
                        </div>
                        <p className="text-xl font-serif italic text-theme-text mb-4">Halfway There</p>
                        <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">
                            Take a short break. Continue whenever you're ready — the remaining
                            {' '}{totalTrials - completedTrialCount} trials work exactly the same way.
                        </p>
                        <button
                            onClick={continueFromBreak}
                            className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
                        >
                            Continue
                        </button>
                    </div>
                );

            case P.INTERRUPTED:
                return (
                    <div className="h-80 flex flex-col items-center justify-center text-center">
                        <div className="h-12 w-12 mb-4 bg-theme-accent/10 border border-theme-accent flex items-center justify-center">
                            <FontAwesomeIcon icon={faRotateRight} className="h-5 w-5 text-theme-accent" />
                        </div>
                        <p className="font-serif italic text-theme-text mb-2">Trial Interrupted</p>
                        <p className="text-sm text-theme-text-secondary max-w-xs">
                            The tab lost focus. This trial will be redone with a fresh array.
                            Keep the tab visible while the rectangles are flashing.
                        </p>
                    </div>
                );

            case P.SAVING:
                return <LoadingSpinner message="Saving results..." theme="auto" />;

            case P.RESULTS:
                if (notEligibleMessage && !error) {
                    return (
                        <div className="text-center p-6">
                            <div className="h-12 w-12 mx-auto mb-4 bg-theme-bg-elevated border border-theme-line flex items-center justify-center">
                                <FontAwesomeIcon icon={faTimes} className="h-5 w-5 text-theme-text-muted" />
                            </div>
                            <p className="font-serif italic text-lg text-theme-text mb-2">Not Eligible Yet</p>
                            <p className="text-sm text-theme-text-secondary mb-6">Next available: {notEligibleMessage}</p>
                            <button onClick={() => navigate('/testing/visual-arrays')} className="btn-primary-lab px-6 py-2 text-sm font-mono uppercase tracking-wider">
                                Return to Summary
                            </button>
                        </div>
                    );
                }
                return (
                    <VisualArraysResults
                        results={{
                            ...(finalScores || {}),
                            isFamiliarization,
                            error,
                            completedTrialCount,
                            totalTrials,
                        }}
                        onDone={handleDone}
                    />
                );

            default:
                return (
                    <div className="text-center py-8">
                        <p className="text-theme-text-muted mb-4">Initializing Task...</p>
                        <LoadingSpinner theme="auto" />
                    </div>
                );
        }
    };

    const showExitButton = !isLoading
        && currentPhase !== P.RESULTS
        && currentPhase !== P.SAVING
        && currentPhase !== P.INSTRUCTIONS;

    const isActiveAssessment = currentPhase !== P.RESULTS && currentPhase !== P.INSTRUCTIONS;

    const showProgressStrip = STIMULUS_PHASES.includes(currentPhase) || currentPhase === P.INTERRUPTED;
    // Keep the strip's layout space but blank it during the memory array and
    // retention interval so nothing competes with the stimulus.
    const progressStripBlanked = currentPhase === P.ARRAY || currentPhase === P.RETENTION;

    const headerLabel = isPractice
        ? 'Practice'
        : (isFamiliarization ? 'Familiarization' : 'Monthly Assessment');

    return (
        <>
            <div data-game-active={isActiveAssessment} className="min-h-screen bg-theme-bg-base py-6 px-4 lab-grid lab-grid-radial">
                <div className="w-full max-w-3xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 bg-theme-bg-secondary border flex items-center justify-center ${isFamiliarization || isPractice ? 'border-theme-accent text-theme-accent' : 'border-warm-muted text-theme-text-muted'}`}>
                                <FontAwesomeIcon icon={faVectorSquare} className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">
                                    {headerLabel}
                                </p>
                                <h1 className="text-lg font-serif italic text-theme-text">Visual Arrays</h1>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* showExitButton excludes RESULTS/SAVING/INSTRUCTIONS — isPractice
                                initializes true and persists on terminal init paths (not-eligible,
                                init-error), where skipping would corrupt the session */}
                            {isPractice && !isFamiliarization && showExitButton && (
                                <button
                                    onClick={skipPractice}
                                    className="font-mono text-xs uppercase tracking-wider text-theme-text-secondary hover:text-theme-accent transition-colors"
                                >
                                    Skip practice →
                                </button>
                            )}
                            {showExitButton && (
                                <button onClick={openExitModal} title="Exit Assessment Early" className="h-10 w-10 bg-theme-bg-secondary border border-theme-line hover:border-status-error text-theme-text-muted hover:text-status-error flex items-center justify-center transition-colors">
                                    <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Main Card */}
                    <div className="bg-theme-bg-secondary border border-theme-line overflow-hidden">
                        {/* Progress Strip */}
                        {showProgressStrip && (
                            <div
                                className="px-6 py-3 bg-theme-bg-elevated border-b border-theme-line flex items-center justify-between"
                                style={{ visibility: progressStripBlanked ? 'hidden' : 'visible' }}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">
                                        {isPractice ? 'Practice' : 'Trial'}
                                    </span>
                                    <span className="text-sm font-mono text-theme-text">
                                        {isPractice ? `${practiceNumber}/${practiceTotal}` : `${trialNumber}/${totalTrials}`}
                                    </span>
                                </div>
                                {currentPhase === P.PROBE && (
                                    <span className="hidden sm:inline text-xs font-mono text-theme-accent uppercase tracking-wider">
                                        Did the dotted rectangle change?
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Content Area */}
                        <div className="p-6 min-h-[450px] flex flex-col justify-center items-center">
                            {renderContent()}
                        </div>
                    </div>

                    {/* Dev Skip */}
                    {isDevelopment && showExitButton && (
                        <div className="mt-4 flex justify-center">
                            <button onClick={handleDevSkipTask} disabled={isLoading} className="px-4 py-2 bg-status-error text-white text-xs font-mono uppercase tracking-wider hover:bg-status-error/80 disabled:opacity-50 flex items-center gap-2">
                                <FontAwesomeIcon icon={faForward} />
                                Skip to Results (DEV)
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <FeedbackButton />

            <ConfirmationModal
                isOpen={isExitModalOpen}
                onClose={closeExitModal}
                onConfirm={confirmExit}
                title="Confirm Exit"
                confirmText="Confirm Exit"
                cancelText="Cancel"
                confirmColor="danger"
                isDestructive={true}
                requiredInputText={null}
            >
                <div className="space-y-3">
                    <p className="text-sm text-theme-text-secondary">Are you sure you want to exit?</p>
                    {(isFamiliarization || !canSavePartial) ? (
                        <p className="text-sm text-theme-text-muted">
                            {isFamiliarization
                                ? <>This <span className="text-theme-text">familiarization session</span> will be discarded. You can retake it anytime.</>
                                : <>Not enough trials are completed to produce a score, so your progress will be discarded. You can start the assessment again whenever you're ready.</>
                            }
                        </p>
                    ) : (
                        <>
                            <p className="text-sm text-status-error font-medium">Your progress so far will be saved as your final score.</p>
                            <p className="text-sm text-theme-text-muted">This is your <span className="text-theme-text">monthly assessment</span>. Waiting 30 days before retaking is recommended for reliable tracking.</p>
                        </>
                    )}
                </div>
            </ConfirmationModal>
        </>
    );
};

export default VisualArraysTask;

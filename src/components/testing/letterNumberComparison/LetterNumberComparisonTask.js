/* src/components/testing/letterNumberComparison/LetterNumberComparisonTask.js */
import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';
import useLetterNumberComparisonLogic from './hooks/useLetterNumberComparisonLogic';
import { LNC_PHASES } from '../../../constants/letterNumberComparisonConstants';

import StringPairDisplay from './StringPairDisplay';
import ResponseButtons from './ResponseButtons';
import BlockTimerBar from './BlockTimerBar';
import LetterNumberComparisonResults from './LetterNumberComparisonResults';
import LoadingSpinner from '../../ui/LoadingSpinner';
import ConfirmationModal from '../../ui/ConfirmationModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faForward, faTimes, faStopwatch, faMugHot, faCheck, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import FeedbackButton from '../../feedback/FeedbackButton';

const P = LNC_PHASES;

const LetterNumberComparisonTask = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { refreshUserData } = useUser();
    const isDevelopment = process.env.NODE_ENV === 'development';
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const earlyRetake = location.state?.earlyRetake || false;

    const {
        currentPhase, currentItem, blink, isPractice,
        practiceNumber, practiceTotal, lastFeedbackCorrect,
        blockNumber, totalBlocks, currentTask, itemsAnswered,
        isFamiliarization, notEligibleMessage, abortMessage,
        finalScores, isLoading, error, blockRunKey, blockDurationMs,
        initializeSession, proceedToBlock, handleRespond,
        handleExitAssessment, handleDevSkipTask, notifyOverlayOpened,
    } = useLetterNumberComparisonLogic({
        earlyRetake,
        onExit: () => navigate('/testing/letter-number-comparison'),
    });

    const taskLabel = currentTask === 'letter' ? 'Letters' : 'Numbers';

    // Initialize session on mount (idempotent via didInitRef in the logic hook)
    useEffect(() => {
        if (currentPhase === P.INSTRUCTIONS) {
            initializeSession();
        }
    }, [initializeSession, currentPhase]);

    // Opening the exit modal is an overlay over a running block — void it so the
    // clock can't keep counting against a user looking at the modal.
    useEffect(() => {
        if (isExitModalOpen) notifyOverlayOpened();
    }, [isExitModalOpen, notifyOverlayOpened]);

    // If the session finishes while the exit modal is open, the modal must not
    // sit on top of the results/saving screen.
    useEffect(() => {
        if ((currentPhase === P.SAVING || currentPhase === P.RESULTS) && isExitModalOpen) {
            setIsExitModalOpen(false);
        }
    }, [currentPhase, isExitModalOpen]);

    const openExitModal = useCallback(() => setIsExitModalOpen(true), []);
    const closeExitModal = useCallback(() => setIsExitModalOpen(false), []);
    const confirmExit = useCallback(() => { closeExitModal(); handleExitAssessment(); }, [closeExitModal, handleExitAssessment]);

    const handleDone = useCallback(() => {
        // Refresh AFTER the task is finished (Done press), never at save-success
        // — refreshing earlier unmounts the in-task results screen.
        refreshUserData();
        navigate('/testing/letter-number-comparison', { state: { justUpdatedLetterNumberComparison: true } });
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
                    <button onClick={() => navigate('/testing/letter-number-comparison')} className="px-6 py-2 bg-theme-bg-elevated border border-theme-line text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent transition-colors text-sm font-mono uppercase tracking-wider">
                        Return to Summary
                    </button>
                </div>
            );
        }

        switch (currentPhase) {
            case P.PRACTICE:
                return (
                    <div className="w-full flex flex-col items-center gap-5">
                        <StringPairDisplay item={currentItem} blink={false} />
                        <div className="h-6 flex items-center justify-center">
                            {lastFeedbackCorrect !== null && (
                                <span className={`font-mono text-sm uppercase tracking-wider flex items-center gap-2 ${lastFeedbackCorrect ? 'text-status-success' : 'text-status-error'}`}>
                                    <FontAwesomeIcon icon={lastFeedbackCorrect ? faCheck : faTimes} />
                                    {lastFeedbackCorrect ? 'Correct' : 'Not quite'}
                                </span>
                            )}
                        </div>
                        <ResponseButtons onRespond={handleRespond} disabled={lastFeedbackCorrect !== null} />
                    </div>
                );

            case P.READY:
                return (
                    <div className="text-center py-8">
                        <p className="text-xl font-serif italic text-theme-text mb-2">Practice Complete</p>
                        <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">
                            Block {blockNumber} of {totalBlocks}: <span className="text-theme-text">{taskLabel}</span>.
                            You'll have 30 seconds to judge as many pairs as you can — tap
                            SAME or DIFFERENT and the next pair appears immediately. Accuracy
                            matters: a wrong answer counts against you.
                        </p>
                        <button
                            onClick={proceedToBlock}
                            className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
                        >
                            Begin Block {blockNumber}
                        </button>
                    </div>
                );

            case P.GO:
                return (
                    <div className="text-center py-12">
                        <p className="text-5xl font-serif italic text-theme-accent">Go!</p>
                    </div>
                );

            case P.BLOCK:
                return (
                    <div className="w-full flex flex-col items-center gap-5">
                        <BlockTimerBar durationMs={blockDurationMs} runKey={blockRunKey} />
                        <StringPairDisplay item={currentItem} blink={blink} />
                        <ResponseButtons onRespond={handleRespond} disabled={blink} />
                    </div>
                );

            case P.INTERRUPTED:
                return (
                    <div className="text-center py-8">
                        <div className="h-12 w-12 mx-auto mb-4 bg-status-warning/10 border border-status-warning flex items-center justify-center">
                            <FontAwesomeIcon icon={faTriangleExclamation} className="h-5 w-5 text-status-warning" />
                        </div>
                        <p className="text-xl font-serif italic text-theme-text mb-2">Block Interrupted</p>
                        <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">
                            The timer can't pause, so that block was voided. Redo it with
                            fresh items when you're ready — one redo is allowed per block.
                        </p>
                        <button
                            onClick={proceedToBlock}
                            className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
                        >
                            Redo Block {blockNumber}
                        </button>
                    </div>
                );

            case P.BREAK:
                return (
                    <div className="text-center py-8">
                        <div className="h-12 w-12 mx-auto mb-4 bg-theme-accent/10 border border-theme-accent flex items-center justify-center">
                            <FontAwesomeIcon icon={faMugHot} className="h-5 w-5 text-theme-accent" />
                        </div>
                        <p className="text-xl font-serif italic text-theme-text mb-4">Block {blockNumber - 1} of {totalBlocks} Complete</p>
                        <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">
                            Take a short break. Continue whenever you're ready — the next
                            block works exactly the same way.
                        </p>
                        <button
                            onClick={proceedToBlock}
                            className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
                        >
                            Begin Block {blockNumber}
                        </button>
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
                            <button onClick={() => navigate('/testing/letter-number-comparison')} className="btn-primary-lab px-6 py-2 text-sm font-mono uppercase tracking-wider">
                                Return to Summary
                            </button>
                        </div>
                    );
                }
                return (
                    <LetterNumberComparisonResults
                        results={{
                            ...(finalScores || {}),
                            isFamiliarization,
                            error,
                            abortMessage,
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

    const showProgressStrip = currentPhase === P.PRACTICE || currentPhase === P.BLOCK;

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
                                <FontAwesomeIcon icon={faStopwatch} className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">
                                    {headerLabel}
                                </p>
                                <h1 className="text-lg font-serif italic text-theme-text">Letter &amp; Number Comparison Speed</h1>
                            </div>
                        </div>

                        {showExitButton && (
                            <button onClick={openExitModal} title="Exit Assessment Early" className="h-10 w-10 bg-theme-bg-secondary border border-theme-line hover:border-status-error text-theme-text-muted hover:text-status-error flex items-center justify-center transition-colors">
                                <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Main Card */}
                    <div className="bg-theme-bg-secondary border border-theme-line overflow-hidden">
                        {/* Progress Strip */}
                        {showProgressStrip && (
                            <div className="px-6 py-3 bg-theme-bg-elevated border-b border-theme-line flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">
                                        {currentPhase === P.PRACTICE ? `Practice · ${taskLabel}` : `Block ${blockNumber}/${totalBlocks} · ${taskLabel}`}
                                    </span>
                                    <span className="text-sm font-mono text-theme-text">
                                        {currentPhase === P.PRACTICE ? `${practiceNumber}/${practiceTotal}` : `${itemsAnswered} answered`}
                                    </span>
                                </div>
                                <span className="hidden sm:inline text-xs font-mono text-theme-accent uppercase tracking-wider">
                                    Same or different?
                                </span>
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
                    <p className="text-sm text-theme-text-muted">
                        {isFamiliarization
                            ? <>This <span className="text-theme-text">familiarization session</span> will be discarded. You can retake it anytime.</>
                            : <>Progress will be discarded — partial sessions cannot be scored. Nothing will count against the monthly cooldown.</>
                        }
                    </p>
                </div>
            </ConfirmationModal>
        </>
    );
};

export default LetterNumberComparisonTask;

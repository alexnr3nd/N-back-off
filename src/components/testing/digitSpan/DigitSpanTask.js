/* src/components/testing/digitSpan/DigitSpanTask.js */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';
import useDigitSpanLogic from './hooks/useDigitSpanLogic';
import useDigitSpanTimer from './hooks/useDigitSpanTimer';
import { DIGIT_SPAN_PHASES, DIGIT_SPAN_BLOCKS, DIGIT_SPAN_DEFAULTS } from '../../../constants/digitSpanConstants';

import DigitDisplay from './DigitDisplay';
import DigitRecallPad from './DigitRecallPad';
import BlockIntroScreen from './BlockIntroScreen';
import TrialFeedbackDisplay from './TrialFeedbackDisplay';
import DigitSpanResults from './DigitSpanResults';
import LoadingSpinner from '../../ui/LoadingSpinner';
import ConfirmationModal from '../../ui/ConfirmationModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faForward, faTimes, faListOl, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import FeedbackButton from '../../feedback/FeedbackButton';

const PRESENTATION_PHASES = [
    DIGIT_SPAN_PHASES.FIXATION,
    DIGIT_SPAN_PHASES.DIGIT_SHOW,
    DIGIT_SPAN_PHASES.DIGIT_BLANK,
    DIGIT_SPAN_PHASES.RECALL_CUE,
];

const DigitSpanTask = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { refreshUserData } = useUser();
    const isDevelopment = process.env.NODE_ENV === 'development';
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const earlyRetake = location.state?.earlyRetake || false;

    // Single timer instance; controls are handed to the logic hook via this ref.
    const timerControlsRef = useRef({ cancelPresentation: () => {}, clearPhaseTimer: () => {} });

    const {
        currentPhase, block, isPractice, practiceIndex, trialNumber,
        currentTargetDigits, currentDigitIndex,
        responseDigits, presentationTrialKey, lastTrialFeedback,
        isFamiliarization, hasScoredData, notEligibleMessage, finalScores,
        isLoading, error,
        initializeSession, startBlockPractice, continuePractice,
        skipPractice, startScoredBlock, startBackwardBlock,
        handleResponseChange, submitRecall, handleTimerEvent,
        handleExitAssessment, handleDevSkipTask,
    } = useDigitSpanLogic(
        () => { refreshUserData(); },
        timerControlsRef,
        { earlyRetake, onExit: () => navigate('/testing/digit-span') }
    );

    useDigitSpanTimer({
        currentPhase,
        presentationTrialKey,
        digitCount: currentTargetDigits.length,
        onTimerEvent: handleTimerEvent,
        controlsRef: timerControlsRef,
    });

    // Initialize session on mount (idempotent via didInitRef in the logic hook)
    useEffect(() => {
        if (currentPhase === DIGIT_SPAN_PHASES.INSTRUCTIONS) {
            initializeSession();
        }
    }, [initializeSession, currentPhase]);

    const openExitModal = useCallback(() => setIsExitModalOpen(true), []);
    const closeExitModal = useCallback(() => setIsExitModalOpen(false), []);
    const confirmExit = useCallback(() => { closeExitModal(); handleExitAssessment(); }, [closeExitModal, handleExitAssessment]);

    const isBackward = block === DIGIT_SPAN_BLOCKS.BACKWARD;
    const blockLabel = isBackward ? 'Backward' : 'Forward';

    // --- Render ---
    const renderContent = () => {
        if (isLoading && currentPhase !== DIGIT_SPAN_PHASES.RESULTS) {
            const message = currentPhase === DIGIT_SPAN_PHASES.SAVING ? 'Saving results...' : 'Loading assessment...';
            return <LoadingSpinner message={message} theme="auto" />;
        }

        if (error && currentPhase !== DIGIT_SPAN_PHASES.RESULTS) {
            return (
                <div className="text-center p-6">
                    <div className="h-12 w-12 mx-auto mb-4 bg-status-error/20 border border-status-error flex items-center justify-center">
                        <FontAwesomeIcon icon={faTimes} className="h-5 w-5 text-status-error" />
                    </div>
                    <p className="font-serif italic text-theme-text mb-2">An Error Occurred</p>
                    <p className="text-sm text-theme-text-secondary mb-6">{error}</p>
                    <button onClick={() => navigate('/testing/digit-span')} className="px-6 py-2 bg-theme-bg-elevated border border-theme-line text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent transition-colors text-sm font-mono uppercase tracking-wider">
                        Return to Summary
                    </button>
                </div>
            );
        }

        switch (currentPhase) {
            case DIGIT_SPAN_PHASES.BLOCK_INTRO:
                return <BlockIntroScreen block={block} onStartPractice={startBlockPractice} />;

            case DIGIT_SPAN_PHASES.PRACTICE_FEEDBACK:
                return (
                    <TrialFeedbackDisplay
                        feedback={lastTrialFeedback}
                        isPractice={true}
                        direction={block}
                        onContinue={continuePractice}
                    />
                );

            case DIGIT_SPAN_PHASES.READY_BLOCK:
                return (
                    <div className="text-center py-8">
                        <p className="text-xl font-serif italic text-theme-text mb-4">Practice Complete</p>
                        <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">
                            The {DIGIT_SPAN_DEFAULTS.TRIALS_PER_BLOCK} scored {blockLabel.toLowerCase()}-span rounds
                            start now. The sequence length adapts to your performance.
                        </p>
                        <button
                            onClick={startScoredBlock}
                            className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
                        >
                            Begin Scored Rounds
                        </button>
                    </div>
                );

            case DIGIT_SPAN_PHASES.FIXATION:
            case DIGIT_SPAN_PHASES.DIGIT_SHOW:
            case DIGIT_SPAN_PHASES.DIGIT_BLANK:
            case DIGIT_SPAN_PHASES.RECALL_CUE:
                return (
                    <DigitDisplay
                        phase={currentPhase}
                        digit={currentDigitIndex >= 0 ? currentTargetDigits[currentDigitIndex] : null}
                    />
                );

            case DIGIT_SPAN_PHASES.RECALL:
                return (
                    <DigitRecallPad
                        expectedLength={currentTargetDigits.length}
                        direction={block}
                        onSubmit={submitRecall}
                        value={responseDigits}
                        onChange={handleResponseChange}
                        inputDisabled={isExitModalOpen}
                    />
                );

            case DIGIT_SPAN_PHASES.TRIAL_FEEDBACK:
                return (
                    <TrialFeedbackDisplay
                        feedback={lastTrialFeedback}
                        isPractice={false}
                        direction={block}
                    />
                );

            case DIGIT_SPAN_PHASES.INTERRUPTED:
                return (
                    <div className="h-80 flex flex-col items-center justify-center text-center">
                        <div className="h-12 w-12 mb-4 bg-theme-accent/10 border border-theme-accent flex items-center justify-center">
                            <FontAwesomeIcon icon={faRotateRight} className="h-5 w-5 text-theme-accent" />
                        </div>
                        <p className="font-serif italic text-theme-text mb-2">Round Interrupted</p>
                        <p className="text-sm text-theme-text-secondary max-w-xs">
                            The tab lost focus. This round will start over with digits you haven't seen.
                            Keep the tab visible while digits are showing.
                        </p>
                    </div>
                );

            case DIGIT_SPAN_PHASES.BLOCK_TRANSITION:
                return (
                    <div className="text-center py-8">
                        <p className="text-xl font-serif italic text-theme-text mb-4">Forward Block Complete</p>
                        <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">
                            Halfway there. Next is the backward block: same digit streams, recalled in reverse order.
                        </p>
                        <button
                            onClick={startBackwardBlock}
                            className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
                        >
                            Continue
                        </button>
                    </div>
                );

            case DIGIT_SPAN_PHASES.SAVING:
                return <LoadingSpinner message="Saving results..." theme="auto" />;

            case DIGIT_SPAN_PHASES.RESULTS:
                if (notEligibleMessage && !error) {
                    return (
                        <div className="text-center p-6">
                            <div className="h-12 w-12 mx-auto mb-4 bg-theme-bg-elevated border border-theme-line flex items-center justify-center">
                                <FontAwesomeIcon icon={faTimes} className="h-5 w-5 text-theme-text-muted" />
                            </div>
                            <p className="font-serif italic text-lg text-theme-text mb-2">Not Eligible Yet</p>
                            <p className="text-sm text-theme-text-secondary mb-6">Next available: {notEligibleMessage}</p>
                            <button onClick={() => navigate('/testing/digit-span')} className="btn-primary-lab px-6 py-2 text-sm font-mono uppercase tracking-wider">
                                Return to Summary
                            </button>
                        </div>
                    );
                }
                return (
                    <DigitSpanResults
                        results={{ ...(finalScores || {}), isFamiliarization, error }}
                        onDone={() => navigate('/testing/digit-span', { state: { justUpdated: true } })}
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
        && currentPhase !== DIGIT_SPAN_PHASES.RESULTS
        && currentPhase !== DIGIT_SPAN_PHASES.SAVING
        && currentPhase !== DIGIT_SPAN_PHASES.INSTRUCTIONS;

    const isActiveAssessment = currentPhase !== DIGIT_SPAN_PHASES.RESULTS && currentPhase !== DIGIT_SPAN_PHASES.INSTRUCTIONS;

    const showProgressStrip = !isPractice
        && (PRESENTATION_PHASES.includes(currentPhase)
            || currentPhase === DIGIT_SPAN_PHASES.RECALL
            || currentPhase === DIGIT_SPAN_PHASES.TRIAL_FEEDBACK
            || currentPhase === DIGIT_SPAN_PHASES.INTERRUPTED);

    const headerLabel = isPractice
        ? `${blockLabel} Practice`
        : (isFamiliarization ? 'Familiarization' : 'Monthly Assessment');

    // Scored sessions only; shown through each block's practice trials and
    // feedback (the backward block offers its own skip independently).
    const showSkipPractice = isPractice
        && !isFamiliarization
        && !isLoading
        && (PRESENTATION_PHASES.includes(currentPhase)
            || currentPhase === DIGIT_SPAN_PHASES.RECALL
            || currentPhase === DIGIT_SPAN_PHASES.PRACTICE_FEEDBACK);

    return (
        <>
            <div data-game-active={isActiveAssessment} className="min-h-screen bg-theme-bg-base py-6 px-4 lab-grid lab-grid-radial">
                <div className="w-full max-w-3xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 bg-theme-bg-secondary border flex items-center justify-center ${isFamiliarization || isPractice ? 'border-theme-accent text-theme-accent' : 'border-warm-muted text-theme-text-muted'}`}>
                                <FontAwesomeIcon icon={faListOl} className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">
                                    {headerLabel}
                                </p>
                                <h1 className="text-lg font-serif italic text-theme-text">Digit Span</h1>
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
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Block</span>
                                        <span className="text-sm font-mono text-theme-text">{isBackward ? '2/2' : '1/2'} {blockLabel}</span>
                                    </div>
                                    <div className="flex items-center gap-2 pl-4 border-l border-theme-line">
                                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Trial</span>
                                        <span className="text-sm font-mono text-theme-text">{trialNumber + 1}/{DIGIT_SPAN_DEFAULTS.TRIALS_PER_BLOCK}</span>
                                    </div>
                                    <div className="flex items-center gap-2 pl-4 border-l border-theme-line">
                                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Digits</span>
                                        <span className="text-sm font-mono text-theme-text">{currentTargetDigits.length}</span>
                                    </div>
                                </div>
                                {currentPhase === DIGIT_SPAN_PHASES.RECALL && (
                                    <span className="hidden sm:inline text-xs font-mono text-theme-accent uppercase tracking-wider">
                                        {isBackward ? 'Reverse order' : 'Same order'}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Content Area */}
                        <div className="p-6 min-h-[450px] flex flex-col justify-center items-center">
                            {renderContent()}
                            {showSkipPractice && (
                                <button
                                    onClick={skipPractice}
                                    className="mt-6 font-mono text-xs uppercase tracking-wider text-theme-text-secondary hover:text-theme-accent transition-colors"
                                >
                                    Skip practice →
                                </button>
                            )}
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
                    {(isFamiliarization || !hasScoredData) ? (
                        <p className="text-sm text-theme-text-muted">
                            {isFamiliarization
                                ? <>This <span className="text-theme-text">familiarization session</span> will be discarded. You can retake it anytime.</>
                                : <>No rounds have been scored yet, so your progress will be discarded. You can start the assessment again whenever you're ready.</>
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

export default DigitSpanTask;

/* src/components/testing/operationSpan/OperationSpanTask.js */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';
import useOperationSpanLogic from './hooks/useOperationSpanLogic';
import useOperationSpanTimer from './hooks/useOperationSpanTimer';
import { OSPAN_PHASES, OSPAN_DEFAULTS } from '../../../constants/ospanConstants';

import MathProblemDisplay from './MathProblemDisplay';
import MathVerificationDisplay from './MathVerificationDisplay';
import LetterDisplay from './LetterDisplay';
import LetterRecallGrid from './LetterRecallGrid';
import SetFeedbackDisplay from './SetFeedbackDisplay';
import OperationSpanResults from './OperationSpanResults';
import LoadingSpinner from '../../ui/LoadingSpinner';
import ConfirmationModal from '../../ui/ConfirmationModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faForward, faTimes, faSuperscript } from '@fortawesome/free-solid-svg-icons';
import FeedbackButton from '../../feedback/FeedbackButton';

const OperationSpanTask = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { refreshUserData } = useUser();
    const isDevelopment = process.env.NODE_ENV === 'development';
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const earlyRetake = location.state?.earlyRetake || false;

    const advancePhaseRef = useRef(() => {});

    // Timer hook (initial call for clearMathTimer/clearRecallTimer refs)
    const { clearMathTimer, clearRecallTimer } = useOperationSpanTimer(null, (...args) => advancePhaseRef.current(...args), null);

    // Logic hook
    const {
        currentPhase, currentSet, currentTrialIndexInSet,
        currentMathProblem, currentLetter,
        isLoading, error, isPractice, practicePhase, setSize,
        testStructure, currentSetIndex, feedback, intermediateRecallSequence,
        mathDeadlineMs, storedDeadline,
        cumulativeMathCorrect, cumulativeMathTotal,
        lastSetFeedback,
        finalScorePCU, finalScoreEditDistance, finalProcessingAccuracy,
        flaggedLowAccuracy, isFamiliarization, notEligibleMessage,
        initializeSession, startAssessment, continuePractice, skipPractice,
        recordMathSolved, recordMathVerification,
        submitRecall, advancePhase: actualAdvancePhase,
        handleRecallChange, handleDevSkipTask, handleExitAssessment,
    } = useOperationSpanLogic(
        () => { refreshUserData(); },
        clearMathTimer,
        clearRecallTimer,
        { earlyRetake, onExit: () => navigate('/testing/operation-span') }
    );

    // Initialize session on mount (fetches eligibility + structure before practice)
    useEffect(() => {
        if (currentPhase === OSPAN_PHASES.INSTRUCTIONS) {
            initializeSession();
        }
    }, [initializeSession, currentPhase]);

    // Keep advancePhaseRef in sync
    useEffect(() => {
        advancePhaseRef.current = actualAdvancePhase;
    }, [actualAdvancePhase]);

    // Active timer hook
    useOperationSpanTimer(currentPhase, actualAdvancePhase, mathDeadlineMs);

    // --- Handlers ---
    const handleRecallSubmit = useCallback(() => {
        if (currentPhase !== OSPAN_PHASES.RECALL) return;
        submitRecall();
    }, [currentPhase, submitRecall]);

    const openExitModal = useCallback(() => setIsExitModalOpen(true), []);
    const closeExitModal = useCallback(() => setIsExitModalOpen(false), []);
    const confirmExit = useCallback(() => { closeExitModal(); handleExitAssessment(); }, [closeExitModal, handleExitAssessment]);

    // --- Render ---
    const renderContent = () => {
        if (isLoading && currentPhase !== OSPAN_PHASES.RESULTS) {
            const message = currentPhase === OSPAN_PHASES.SAVING ? 'Saving results...' : 'Loading assessment...';
            return <LoadingSpinner message={message} theme="auto" />;
        }

        if (error && currentPhase !== OSPAN_PHASES.RESULTS) {
            return (
                <div className="text-center p-6">
                    <div className="h-12 w-12 mx-auto mb-4 bg-status-error/20 border border-status-error flex items-center justify-center">
                        <FontAwesomeIcon icon={faTimes} className="h-5 w-5 text-status-error" />
                    </div>
                    <p className="font-serif italic text-theme-text mb-2">An Error Occurred</p>
                    <p className="text-sm text-theme-text-secondary mb-6">{error}</p>
                    <button onClick={() => navigate('/testing/operation-span')} className="px-6 py-2 bg-theme-bg-elevated border border-theme-line text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent transition-colors text-sm font-mono uppercase tracking-wider">
                        Return to Summary
                    </button>
                </div>
            );
        }

        switch (currentPhase) {
            case OSPAN_PHASES.READY_ASSESSMENT:
                return (
                    <div className="text-center py-8">
                        <p className="text-xl font-serif italic text-theme-text mb-4">Practice Complete</p>
                        <p className="text-sm text-theme-text-secondary mb-4">
                            You are about to begin the scored assessment. This will take approximately 15-20 minutes.
                        </p>
                        {mathDeadlineMs && (
                            <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-6 max-w-sm mx-auto">
                                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-1">Math Time Limit</p>
                                <p className="text-sm text-theme-text-secondary">
                                    Math problems will auto-advance after <span className="text-theme-accent font-mono font-medium">{(mathDeadlineMs / 1000).toFixed(1)}s</span> if not answered.
                                </p>
                            </div>
                        )}
                        <button
                            onClick={startAssessment}
                            className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
                        >
                            Begin Scored Assessment
                        </button>
                    </div>
                );

            case OSPAN_PHASES.PRACTICE_FEEDBACK:
                return (
                    <div className="text-center py-8">
                        <p className="text-lg font-serif italic text-theme-text mb-3">
                            {practicePhase === 'math' ? 'Calibration Complete' : 'Practice Feedback'}
                        </p>
                        {feedback && <p className="text-sm text-theme-text-secondary mb-4">{feedback}</p>}
                        {mathDeadlineMs && practicePhase === 'math' && (
                            <p className="text-sm text-theme-text-muted mb-4">
                                Your math time limit: <span className="text-theme-accent font-mono">{(mathDeadlineMs / 1000).toFixed(1)}s</span>
                            </p>
                        )}
                        <button
                            onClick={continuePractice}
                            className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
                        >
                            Continue
                        </button>
                    </div>
                );

            case OSPAN_PHASES.FIXATION:
                return (
                    <div className="h-80 flex items-center justify-center">
                        <span className="text-5xl font-mono text-theme-accent animate-pulse">+</span>
                    </div>
                );

            case OSPAN_PHASES.MATH_PROBLEM:
                return <MathProblemDisplay problem={currentMathProblem} onSolved={recordMathSolved} />;

            case OSPAN_PHASES.MATH_VERIFICATION:
                return <MathVerificationDisplay problem={currentMathProblem} onVerify={recordMathVerification} />;

            case OSPAN_PHASES.LETTER_DISPLAY:
                return <LetterDisplay letter={currentLetter} />;

            case OSPAN_PHASES.RECALL:
                if (setSize > 0) {
                    return (
                        <LetterRecallGrid
                            setSize={setSize}
                            onSubmit={handleRecallSubmit}
                            value={intermediateRecallSequence}
                            onChange={handleRecallChange}
                        />
                    );
                }
                return <p className="text-status-error">Error: Cannot display recall interface.</p>;

            case OSPAN_PHASES.SET_FEEDBACK:
                return (
                    <SetFeedbackDisplay
                        recallCorrect={lastSetFeedback.correct}
                        recallTotal={lastSetFeedback.total}
                        mathCorrect={cumulativeMathCorrect}
                        mathTotal={cumulativeMathTotal}
                    />
                );

            case OSPAN_PHASES.SAVING:
                return <LoadingSpinner message="Saving results..." theme="auto" />;

            case OSPAN_PHASES.RESULTS:
                // Not-eligible bail-out
                if (notEligibleMessage && !error) {
                    return (
                        <div className="text-center p-6">
                            <div className="h-12 w-12 mx-auto mb-4 bg-theme-bg-elevated border border-theme-line flex items-center justify-center">
                                <FontAwesomeIcon icon={faTimes} className="h-5 w-5 text-theme-text-muted" />
                            </div>
                            <p className="font-serif italic text-lg text-theme-text mb-2">Not Eligible Yet</p>
                            <p className="text-sm text-theme-text-secondary mb-6">Next available: {notEligibleMessage}</p>
                            <button onClick={() => navigate('/testing/operation-span')} className="btn-primary-lab px-6 py-2 text-sm font-mono uppercase tracking-wider">
                                Return to Summary
                            </button>
                        </div>
                    );
                }
                return (
                    <OperationSpanResults
                        results={{
                            scorePCU: finalScorePCU,
                            scoreEditDistance: finalScoreEditDistance,
                            maxScorePCU: OSPAN_DEFAULTS.MAX_SCORE,
                            processingAccuracy: finalProcessingAccuracy,
                            flaggedLowAccuracy,
                            isFamiliarization,
                            error,
                        }}
                        onDone={() => navigate('/testing/operation-span', { state: { justUpdated: true } })}
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
        && currentPhase !== OSPAN_PHASES.RESULTS
        && currentPhase !== OSPAN_PHASES.SAVING
        && currentPhase !== OSPAN_PHASES.INSTRUCTIONS
        && currentPhase !== OSPAN_PHASES.READY_ASSESSMENT;

    const isActiveAssessment = currentPhase !== OSPAN_PHASES.RESULTS && currentPhase !== OSPAN_PHASES.INSTRUCTIONS;

    const practiceLabel = isPractice
        ? (practicePhase === 'letter' ? 'Letter Practice' : practicePhase === 'math' ? 'Math Calibration' : 'Combined Practice')
        : null;

    // Scored sessions only; shown through all three practice stages and their
    // feedback screens. Requires a math deadline source — fresh calibration
    // from this session, or the most recent stored one when skipping earlier.
    const showSkipPractice = isPractice
        && !isFamiliarization
        && !isLoading
        && (mathDeadlineMs !== null || storedDeadline !== null)
        && (currentPhase === OSPAN_PHASES.FIXATION
            || currentPhase === OSPAN_PHASES.MATH_PROBLEM
            || currentPhase === OSPAN_PHASES.MATH_VERIFICATION
            || currentPhase === OSPAN_PHASES.LETTER_DISPLAY
            || currentPhase === OSPAN_PHASES.RECALL
            || currentPhase === OSPAN_PHASES.PRACTICE_FEEDBACK);

    return (
        <>
            <div data-game-active={isActiveAssessment} className="min-h-screen bg-theme-bg-base py-6 px-4 lab-grid lab-grid-radial">
                <div className="w-full max-w-3xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 bg-theme-bg-secondary border flex items-center justify-center ${isFamiliarization || isPractice ? 'border-theme-accent text-theme-accent' : 'border-warm-muted text-theme-text-muted'}`}>
                                <FontAwesomeIcon icon={faSuperscript} className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">
                                    {isPractice ? practiceLabel : (isFamiliarization ? 'Familiarization' : 'Monthly Assessment')}
                                </p>
                                <h1 className="text-lg font-serif italic text-theme-text">Operation Span</h1>
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
                        {/* Progress Header */}
                        {!isPractice && currentPhase !== OSPAN_PHASES.READY_ASSESSMENT && currentPhase !== OSPAN_PHASES.RESULTS && currentPhase !== OSPAN_PHASES.SAVING && (
                            <div className="px-6 py-3 bg-theme-bg-elevated border-b border-theme-line flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {testStructure.length > 0 && currentSetIndex >= 0 && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Set</span>
                                            <span className="text-sm font-mono text-theme-text">{currentSetIndex + 1}/{testStructure.length}</span>
                                        </div>
                                    )}
                                    {setSize > 0 && currentTrialIndexInSet >= 0 && (currentPhase === OSPAN_PHASES.MATH_PROBLEM || currentPhase === OSPAN_PHASES.MATH_VERIFICATION || currentPhase === OSPAN_PHASES.LETTER_DISPLAY || currentPhase === OSPAN_PHASES.FIXATION) && (
                                        <div className="flex items-center gap-2 pl-4 border-l border-theme-line">
                                            <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Trial</span>
                                            <span className="text-sm font-mono text-theme-text">{currentTrialIndexInSet + 1}/{setSize}</span>
                                        </div>
                                    )}
                                    {currentPhase === OSPAN_PHASES.RECALL && (
                                        <span className="text-sm sm:text-xs font-mono text-theme-accent uppercase tracking-wider">Recall {setSize} letters</span>
                                    )}
                                </div>
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
                    {(isFamiliarization || currentSetIndex < 1) ? (
                        <p className="text-sm text-theme-text-muted">
                            {isFamiliarization
                                ? <>This <span className="text-theme-text">familiarization session</span> will be discarded. You can retake it anytime.</>
                                : <>No sets have been scored yet, so your progress will be discarded. You can start the assessment again whenever you're ready.</>
                            }
                        </p>
                    ) : (
                        <>
                            <p className="text-sm text-status-error font-medium">Your progress so far will be saved as your final score.</p>
                            <p className="text-sm text-theme-text-muted">This is your <span className="text-theme-text">monthly assessment</span> &mdash; we recommend waiting 30 days before retaking for reliable tracking.</p>
                        </>
                    )}
                </div>
            </ConfirmationModal>
        </>
    );
};

export default OperationSpanTask;

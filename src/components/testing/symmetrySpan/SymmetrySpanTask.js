/* src/components/testing/symmetrySpan/SymmetrySpanTask.js */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';
import useSymmetrySpanLogic from './hooks/useSymmetrySpanLogic';
import useSymmetrySpanTimer from './hooks/useSymmetrySpanTimer';
import { SYMSPAN_PHASES, SYMSPAN_PRACTICE_STAGES, SYMSPAN_DEFAULTS } from '../../../constants/symmetrySpanConstants';

import SymmetryMatrix from './SymmetryMatrix';
import RedSquareGrid from './RedSquareGrid';
import GridRecallInterface from './GridRecallInterface';
import SetFeedbackPanel from './SetFeedbackPanel';
import SymmetrySpanResults from './SymmetrySpanResults';
import LoadingSpinner from '../../ui/LoadingSpinner';
import ConfirmationModal from '../../ui/ConfirmationModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faForward, faTimes, faTableCells, faCheck } from '@fortawesome/free-solid-svg-icons';
import FeedbackButton from '../../feedback/FeedbackButton';

const PRACTICE_STAGE_LABELS = {
    [SYMSPAN_PRACTICE_STAGES.STORAGE]: 'Square Practice',
    [SYMSPAN_PRACTICE_STAGES.SYMMETRY]: 'Symmetry Practice',
    [SYMSPAN_PRACTICE_STAGES.COMBINED]: 'Combined Practice',
};

const PRACTICE_NEXT_STAGE_HINTS = {
    [SYMSPAN_PRACTICE_STAGES.STORAGE]: 'Squares only — watch the positions and recall them in order.',
    [SYMSPAN_PRACTICE_STAGES.SYMMETRY]: 'Next: judge patterns while squares appear between them.',
    [SYMSPAN_PRACTICE_STAGES.COMBINED]: null,
};

const SymmetrySpanTask = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { refreshUserData } = useUser();
    const isDevelopment = process.env.NODE_ENV === 'development';
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const earlyRetake = location.state?.earlyRetake || false;

    // Single timer instance; controls are handed to the logic hook via this ref.
    const timerControlsRef = useRef({ clearJudgmentTimer: () => {}, clearRecallTimer: () => {} });

    const {
        currentPhase, currentSetIndex, currentElement, symmetryPracticePattern,
        isLoading, error, isPractice, practiceStage, practiceSetNum, setSize,
        testStructure, feedback, recalledCells,
        symmetryDeadlineMs, storedDeadline, activeJudgmentDeadlineMs, notEligibleMessage,
        cumulativeSymCorrect, cumulativeSymTotal,
        lastSetFeedback, lastJudgmentFeedback, symmetryCalibrationCount, completedSetCount,
        finalResults, isFamiliarization,
        initializeSession, startAssessment, continuePractice, skipPractice,
        recordSymmetryResponse, submitRecall, advancePhase, handleRecallChange,
        handleDevSkipTask, handleExitAssessment,
    } = useSymmetrySpanLogic(
        () => { refreshUserData(); },
        timerControlsRef,
        { earlyRetake, onExit: () => navigate('/testing/symmetry-span') }
    );

    useSymmetrySpanTimer(currentPhase, advancePhase, activeJudgmentDeadlineMs, timerControlsRef);

    // Initialize session on mount
    useEffect(() => {
        if (currentPhase === SYMSPAN_PHASES.INSTRUCTIONS) {
            initializeSession();
        }
    }, [initializeSession, currentPhase]);

    const openExitModal = useCallback(() => setIsExitModalOpen(true), []);
    const closeExitModal = useCallback(() => setIsExitModalOpen(false), []);
    const confirmExit = useCallback(() => { closeExitModal(); handleExitAssessment(); }, [closeExitModal, handleExitAssessment]);

    const isSymmetryOnlyPractice = isPractice && practiceStage === SYMSPAN_PRACTICE_STAGES.SYMMETRY;
    const activePattern = isSymmetryOnlyPractice ? symmetryPracticePattern : currentElement?.pattern;
    const hasScoredData = completedSetCount > 0;

    // --- Render ---
    const renderContent = () => {
        if (isLoading && currentPhase !== SYMSPAN_PHASES.RESULTS) {
            const message = currentPhase === SYMSPAN_PHASES.SAVING ? 'Saving results...' : 'Loading assessment...';
            return <LoadingSpinner message={message} theme="auto" />;
        }

        if (error && currentPhase !== SYMSPAN_PHASES.RESULTS) {
            return (
                <div className="text-center p-6">
                    <div className="h-12 w-12 mx-auto mb-4 bg-status-error/20 border border-status-error flex items-center justify-center">
                        <FontAwesomeIcon icon={faTimes} className="h-5 w-5 text-status-error" />
                    </div>
                    <p className="font-serif italic text-theme-text mb-2">An Error Occurred</p>
                    <p className="text-sm text-theme-text-secondary mb-6">{error}</p>
                    <button onClick={() => navigate('/testing/symmetry-span')} className="px-6 py-2 bg-theme-bg-elevated border border-theme-line text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent transition-colors text-sm font-mono uppercase tracking-wider">
                        Return to Summary
                    </button>
                </div>
            );
        }

        switch (currentPhase) {
            case SYMSPAN_PHASES.FIXATION:
                return (
                    <div aria-hidden="true" className="h-80 flex items-center justify-center select-none">
                        <span className="text-5xl font-mono text-theme-accent animate-pulse">+</span>
                    </div>
                );

            case SYMSPAN_PHASES.SYMMETRY_JUDGMENT:
                return (
                    <SymmetryMatrix
                        pattern={activePattern}
                        onJudge={recordSymmetryResponse}
                        disabled={isExitModalOpen}
                    />
                );

            case SYMSPAN_PHASES.JUDGMENT_FEEDBACK:
                return (
                    <div className="h-80 flex flex-col items-center justify-center select-none">
                        <div className={`h-14 w-14 mb-4 border flex items-center justify-center ${lastJudgmentFeedback?.wasCorrect ? 'bg-status-success/20 border-status-success' : 'bg-status-error/20 border-status-error'}`}>
                            <FontAwesomeIcon
                                icon={lastJudgmentFeedback?.wasCorrect ? faCheck : faTimes}
                                className={`h-6 w-6 ${lastJudgmentFeedback?.wasCorrect ? 'text-status-success' : 'text-status-error'}`}
                            />
                        </div>
                        <p className={`font-mono text-sm uppercase tracking-wider ${lastJudgmentFeedback?.wasCorrect ? 'text-status-success' : 'text-status-error'}`}>
                            {lastJudgmentFeedback?.wasCorrect ? 'Correct' : 'Incorrect'}
                        </p>
                        <p className="text-xs font-mono text-theme-text-muted mt-2 uppercase tracking-wider">
                            Judgment {symmetryCalibrationCount}/{SYMSPAN_DEFAULTS.SYMMETRY_PRACTICE_COUNT}
                        </p>
                    </div>
                );

            case SYMSPAN_PHASES.PRE_SQUARE_BLANK:
            case SYMSPAN_PHASES.POST_SQUARE_BLANK:
                return (
                    <div className="h-80 flex items-center justify-center">
                        <RedSquareGrid squareCell={null} />
                    </div>
                );

            case SYMSPAN_PHASES.SQUARE_DISPLAY:
                return (
                    <div className="h-80 flex items-center justify-center">
                        <RedSquareGrid squareCell={currentElement?.squareCell ?? null} />
                    </div>
                );

            case SYMSPAN_PHASES.RECALL:
                return (
                    <GridRecallInterface
                        setSize={setSize}
                        value={recalledCells}
                        onChange={handleRecallChange}
                        onSubmit={submitRecall}
                        cumulativeCorrect={cumulativeSymCorrect}
                        cumulativeTotal={cumulativeSymTotal}
                        showAccuracy={!isPractice || practiceStage === SYMSPAN_PRACTICE_STAGES.COMBINED}
                    />
                );

            case SYMSPAN_PHASES.PRACTICE_FEEDBACK: {
                const nextHint = practiceStage === SYMSPAN_PRACTICE_STAGES.STORAGE && practiceSetNum >= SYMSPAN_DEFAULTS.STORAGE_PRACTICE_SET_SIZES.length - 1
                    ? PRACTICE_NEXT_STAGE_HINTS[SYMSPAN_PRACTICE_STAGES.SYMMETRY]
                    : null;
                return (
                    <div className="text-center py-8">
                        <p className="text-xl font-serif italic text-theme-text mb-4">
                            {PRACTICE_STAGE_LABELS[practiceStage] || 'Practice'}
                        </p>
                        <p className="text-sm text-theme-text-secondary mb-2 max-w-sm mx-auto">{feedback}</p>
                        {practiceStage === SYMSPAN_PRACTICE_STAGES.SYMMETRY && symmetryDeadlineMs && (
                            <p className="text-sm text-theme-text-muted mb-2 max-w-sm mx-auto">
                                Time limit per judgment from here on: <span className="font-mono text-theme-text">{(symmetryDeadlineMs / 1000).toFixed(1)}s</span>
                            </p>
                        )}
                        {nextHint && (
                            <p className="text-xs text-theme-text-muted mb-4 max-w-sm mx-auto">{nextHint}</p>
                        )}
                        <button
                            onClick={continuePractice}
                            className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider mt-4"
                        >
                            Continue
                        </button>
                    </div>
                );
            }

            case SYMSPAN_PHASES.READY_ASSESSMENT:
                return (
                    <div className="text-center py-8">
                        <p className="text-xl font-serif italic text-theme-text mb-4">Practice Complete</p>
                        <p className="text-sm text-theme-text-secondary mb-2 max-w-sm mx-auto">
                            The {testStructure.length} scored sets start now. Judge each pattern, remember each
                            red square, then recall the positions in order.
                        </p>
                        {symmetryDeadlineMs && (
                            <p className="text-sm text-theme-text-muted mb-6 max-w-sm mx-auto">
                                Your calibrated judgment time limit: <span className="font-mono text-theme-text">{(symmetryDeadlineMs / 1000).toFixed(1)}s</span>
                            </p>
                        )}
                        <button
                            onClick={startAssessment}
                            className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
                        >
                            Begin Scored Sets
                        </button>
                    </div>
                );

            case SYMSPAN_PHASES.SET_FEEDBACK:
                return (
                    <SetFeedbackPanel
                        recallCorrect={lastSetFeedback.correct}
                        recallTotal={lastSetFeedback.total}
                        setSymmetryErrors={lastSetFeedback.symmetryErrors}
                        cumulativeCorrect={cumulativeSymCorrect}
                        cumulativeTotal={cumulativeSymTotal}
                    />
                );

            case SYMSPAN_PHASES.SAVING:
                return <LoadingSpinner message="Saving results..." theme="auto" />;

            case SYMSPAN_PHASES.RESULTS:
                if (notEligibleMessage && !error) {
                    return (
                        <div className="text-center p-6">
                            <div className="h-12 w-12 mx-auto mb-4 bg-theme-bg-elevated border border-theme-line flex items-center justify-center">
                                <FontAwesomeIcon icon={faTimes} className="h-5 w-5 text-theme-text-muted" />
                            </div>
                            <p className="font-serif italic text-lg text-theme-text mb-2">Not Eligible Yet</p>
                            <p className="text-sm text-theme-text-secondary mb-6">Next available: {notEligibleMessage}</p>
                            <button onClick={() => navigate('/testing/symmetry-span')} className="btn-primary-lab px-6 py-2 text-sm font-mono uppercase tracking-wider">
                                Return to Summary
                            </button>
                        </div>
                    );
                }
                return (
                    <SymmetrySpanResults
                        results={{ ...(finalResults || {}), isFamiliarization, error, feedback }}
                        onDone={() => navigate('/testing/symmetry-span', { state: { justUpdated: true } })}
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
        && currentPhase !== SYMSPAN_PHASES.RESULTS
        && currentPhase !== SYMSPAN_PHASES.SAVING
        && currentPhase !== SYMSPAN_PHASES.INSTRUCTIONS;

    const isActiveAssessment = currentPhase !== SYMSPAN_PHASES.RESULTS && currentPhase !== SYMSPAN_PHASES.INSTRUCTIONS;

    const showProgressStrip = !isPractice && currentSetIndex >= 0 && (
        currentPhase === SYMSPAN_PHASES.FIXATION
        || currentPhase === SYMSPAN_PHASES.SYMMETRY_JUDGMENT
        || currentPhase === SYMSPAN_PHASES.PRE_SQUARE_BLANK
        || currentPhase === SYMSPAN_PHASES.SQUARE_DISPLAY
        || currentPhase === SYMSPAN_PHASES.POST_SQUARE_BLANK
        || currentPhase === SYMSPAN_PHASES.RECALL
        || currentPhase === SYMSPAN_PHASES.SET_FEEDBACK
    );

    const headerLabel = isPractice
        ? (PRACTICE_STAGE_LABELS[practiceStage] || 'Practice')
        : (isFamiliarization ? 'Familiarization' : 'Monthly Assessment');

    // Scored sessions only; shown through every practice stage and feedback
    // screen. Requires a judgment-deadline source — fresh calibration from this
    // session, or the most recent stored one when skipping before it completes.
    const showSkipPractice = isPractice
        && !isFamiliarization
        && !isLoading
        && (symmetryDeadlineMs !== null || storedDeadline !== null)
        && (currentPhase === SYMSPAN_PHASES.FIXATION
            || currentPhase === SYMSPAN_PHASES.SYMMETRY_JUDGMENT
            || currentPhase === SYMSPAN_PHASES.JUDGMENT_FEEDBACK
            || currentPhase === SYMSPAN_PHASES.PRE_SQUARE_BLANK
            || currentPhase === SYMSPAN_PHASES.SQUARE_DISPLAY
            || currentPhase === SYMSPAN_PHASES.POST_SQUARE_BLANK
            || currentPhase === SYMSPAN_PHASES.RECALL
            || currentPhase === SYMSPAN_PHASES.PRACTICE_FEEDBACK);

    return (
        <>
            <div data-game-active={isActiveAssessment} className="min-h-screen bg-theme-bg-base py-6 px-4 lab-grid lab-grid-radial">
                <div className="w-full max-w-3xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 bg-theme-bg-secondary border flex items-center justify-center ${isFamiliarization || isPractice ? 'border-theme-accent text-theme-accent' : 'border-warm-muted text-theme-text-muted'}`}>
                                <FontAwesomeIcon icon={faTableCells} className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">
                                    {headerLabel}
                                </p>
                                <h1 className="text-lg font-serif italic text-theme-text">Symmetry Span</h1>
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
                                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Set</span>
                                        <span className="text-sm font-mono text-theme-text">{currentSetIndex + 1}/{testStructure.length}</span>
                                    </div>
                                    <div className="flex items-center gap-2 pl-4 border-l border-theme-line">
                                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Squares</span>
                                        <span className="text-sm font-mono text-theme-text">{setSize}</span>
                                    </div>
                                </div>
                                {currentPhase === SYMSPAN_PHASES.RECALL && (
                                    <span className="hidden sm:inline text-xs font-mono text-theme-accent uppercase tracking-wider">
                                        Tap in order shown
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
                                : <>No sets have been completed yet, so your progress will be discarded. You can start the assessment again whenever you're ready.</>
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

export default SymmetrySpanTask;

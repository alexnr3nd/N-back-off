/* src/components/testing/operationSpan/trainer/OperationSpanTrainerTask.js */
/**
 * Full-screen player for one Operation Span Trainer session. Reuses the
 * assessment's MathProblemDisplay / MathVerificationDisplay / LetterDisplay /
 * LetterRecallGrid / SetFeedbackDisplay / useOperationSpanTimer UNTOUCHED; the
 * set-size staircase + session flow live in useOperationSpanTrainerLogic.
 * "Play Again" remounts the inner round (fresh hook) via a key bump.
 */
import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useOperationSpanTrainerLogic from './hooks/useOperationSpanTrainerLogic';
import useOperationSpanTimer from '../hooks/useOperationSpanTimer';
import MathProblemDisplay from '../MathProblemDisplay';
import MathVerificationDisplay from '../MathVerificationDisplay';
import LetterDisplay from '../LetterDisplay';
import LetterRecallGrid from '../LetterRecallGrid';
import SetFeedbackDisplay from '../SetFeedbackDisplay';
import TrainerResults from '../../trainer/TrainerResults';
import LoadingSpinner from '../../../ui/LoadingSpinner';
import ConfirmationModal from '../../../ui/ConfirmationModal';
import FeedbackButton from '../../../feedback/FeedbackButton';
import {
    OSPAN_PHASES as P,
    OSPAN_TRAINER as T,
    OSPAN_TRAINER_PHASES as TP,
} from '../../../../constants/ospanTrainerConstants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSuperscript, faFire, faCheck, faRotateRight } from '@fortawesome/free-solid-svg-icons';

const ITEM_PHASES = [P.FIXATION, P.MATH_PROBLEM, P.MATH_VERIFICATION, P.LETTER_DISPLAY];

const TrainerRound = ({ autoStart, onExit, onPlayAgain }) => {
    // Timer hook (initial call for clearMathTimer/clearRecallTimer refs) —
    // same two-call wiring the assessment's OperationSpanTask uses.
    const advancePhaseRef = useRef(() => {});
    const stableAdvance = useCallback((...args) => advancePhaseRef.current(...args), []);
    const { clearMathTimer, clearRecallTimer } = useOperationSpanTimer(null, stableAdvance, null);

    const {
        currentPhase, currentMathProblem, currentLetter,
        currentTrialIndexInSet, currentSetSize, recallValue,
        setNumber, totalSets,
        currentLevel, roundStreak,
        lastSetFeedback, lastSetCorrect,
        cumulativeMathCorrect, cumulativeMathTotal,
        mathDeadlineMs,
        isReadyToStart, isLoading, error, finalResults,
        initializeSession, startSession, advancePhase,
        recordMathSolved, recordMathVerification,
        handleRecallChange, submitRecall, handleExitTrainer,
    } = useOperationSpanTrainerLogic({ onExit, clearMathTimer, clearRecallTimer });

    // Keep advancePhaseRef in sync
    useEffect(() => {
        advancePhaseRef.current = advancePhase;
    }, [advancePhase]);

    // Active timer hook. The trainer-only INTERRUPTED phase is not part of
    // OSPAN_PHASES, so pass null there (the timer handles null gracefully).
    const timerPhase = currentPhase === TP.INTERRUPTED ? null : currentPhase;
    useOperationSpanTimer(timerPhase, advancePhase, mathDeadlineMs);

    const [isExitOpen, setIsExitOpen] = useState(false);

    useEffect(() => {
        if (currentPhase === P.INSTRUCTIONS) initializeSession();
    }, [initializeSession, currentPhase]);

    const autoStartedRef = useRef(false);
    useEffect(() => {
        if (isReadyToStart && autoStart && !autoStartedRef.current) {
            autoStartedRef.current = true;
            startSession();
        }
    }, [isReadyToStart, autoStart, startSession]);

    const openExit = useCallback(() => setIsExitOpen(true), []);
    const closeExit = useCallback(() => setIsExitOpen(false), []);
    const confirmExit = useCallback(() => { closeExit(); handleExitTrainer(); }, [closeExit, handleExitTrainer]);

    const handleRecallSubmit = useCallback(() => {
        if (isExitOpen) return;
        submitRecall();
    }, [isExitOpen, submitRecall]);

    const isTrialPhase = ITEM_PHASES.includes(currentPhase)
        || currentPhase === P.RECALL || currentPhase === P.SET_FEEDBACK;
    const isActive = isTrialPhase || currentPhase === P.SAVING || currentPhase === TP.INTERRUPTED;
    const showProgress = isTrialPhase;
    const showExit = currentPhase !== P.RESULTS && currentPhase !== P.SAVING && !isReadyToStart;

    const resultsProps = useMemo(() => ({
        results: finalResults,
        onPlayAgain,
        onDone: onExit,
        icon: faSuperscript,
        levelLabel: 'Set Size',
        maxLevel: T.MAX_SET_SIZE,
        showMaxBadge: true,
    }), [finalResults, onPlayAgain, onExit]);

    const renderContent = () => {
        if (isLoading && currentPhase !== P.RESULTS) {
            return <LoadingSpinner message={currentPhase === P.SAVING ? 'Saving session...' : 'Loading trainer...'} theme="auto" />;
        }
        if (error && currentPhase !== P.RESULTS) {
            return (
                <div className="text-center p-6">
                    <div className="h-12 w-12 mx-auto mb-4 bg-status-error/20 border border-status-error flex items-center justify-center">
                        <FontAwesomeIcon icon={faTimes} className="h-5 w-5 text-status-error" />
                    </div>
                    <p className="font-serif italic text-theme-text mb-2">Can't Start the Trainer</p>
                    <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">{error}</p>
                    <button onClick={onExit} className="btn-primary-lab px-6 py-2 text-sm font-mono uppercase tracking-wider">Back</button>
                </div>
            );
        }
        if (isReadyToStart) {
            if (autoStart) return <LoadingSpinner message="Loading trainer..." theme="auto" />;
            return (
                <div className="text-center py-8">
                    <p className="text-xl font-serif italic text-theme-text mb-4">Operation Span Trainer</p>
                    <p className="text-sm text-theme-text-secondary mb-4 max-w-sm mx-auto">
                        Solve each equation, then remember the letter that follows. After the last letter,
                        recall the set in order. The set size adjusts to keep you near your edge.
                    </p>
                    {mathDeadlineMs && (
                        <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-6 max-w-sm mx-auto">
                            <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-1">Math Time Limit</p>
                            <p className="text-sm text-theme-text-secondary">
                                Math problems will auto-advance after <span className="text-theme-accent font-mono font-medium">{(mathDeadlineMs / 1000).toFixed(1)}s</span> if not answered.
                            </p>
                        </div>
                    )}
                    <button onClick={startSession} className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider">Start Session</button>
                </div>
            );
        }
        if (currentPhase === TP.INTERRUPTED) {
            return (
                <div className="h-80 flex flex-col items-center justify-center text-center">
                    <div className="h-12 w-12 mb-4 bg-theme-accent/10 border border-theme-accent flex items-center justify-center">
                        <FontAwesomeIcon icon={faRotateRight} className="h-5 w-5 text-theme-accent" />
                    </div>
                    <p className="font-serif italic text-theme-text mb-2">Set Interrupted</p>
                    <p className="text-sm text-theme-text-secondary max-w-xs">The tab lost focus. This set will start over. Keep the tab visible while equations and letters are showing.</p>
                </div>
            );
        }
        if (currentPhase === P.RESULTS) {
            return <TrainerResults {...resultsProps} />;
        }
        if (currentPhase === P.FIXATION) {
            return (
                <div className="h-80 flex items-center justify-center">
                    <span className="text-5xl font-mono text-theme-accent animate-pulse">+</span>
                </div>
            );
        }
        if (currentPhase === P.MATH_PROBLEM) {
            return <MathProblemDisplay problem={currentMathProblem} onSolved={recordMathSolved} />;
        }
        if (currentPhase === P.MATH_VERIFICATION) {
            return <MathVerificationDisplay problem={currentMathProblem} onVerify={recordMathVerification} />;
        }
        if (currentPhase === P.LETTER_DISPLAY) {
            return <LetterDisplay letter={currentLetter} />;
        }
        if (currentPhase === P.RECALL) {
            return (
                <LetterRecallGrid
                    setSize={currentSetSize}
                    onSubmit={handleRecallSubmit}
                    value={recallValue}
                    onChange={handleRecallChange}
                />
            );
        }
        if (currentPhase === P.SET_FEEDBACK) {
            return (
                <div className="flex flex-col items-center">
                    <div className={`h-14 w-14 mb-1 border flex items-center justify-center ${lastSetCorrect ? 'bg-status-success/20 border-status-success text-status-success' : 'bg-status-error/20 border-status-error text-status-error'}`}>
                        <FontAwesomeIcon icon={lastSetCorrect ? faCheck : faTimes} className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-mono uppercase tracking-wider text-theme-text-muted">{lastSetCorrect ? 'Correct' : 'Missed'}</p>
                    <SetFeedbackDisplay
                        recallCorrect={lastSetFeedback.correct}
                        recallTotal={lastSetFeedback.total}
                        mathCorrect={cumulativeMathCorrect}
                        mathTotal={cumulativeMathTotal}
                    />
                </div>
            );
        }
        return <LoadingSpinner theme="auto" />;
    };

    return (
        <>
            <div data-game-active={isActive} className="min-h-screen bg-theme-bg-base py-6 px-4 lab-grid lab-grid-radial">
                <div className="w-full max-w-3xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-theme-bg-secondary border border-theme-accent text-theme-accent flex items-center justify-center">
                                <FontAwesomeIcon icon={faSuperscript} className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">Trainer</p>
                                <h1 className="text-lg font-serif italic text-theme-text">Operation Span</h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <p className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider">Size {currentLevel}{currentLevel >= T.MAX_SET_SIZE ? ' · MAX' : ` / ${T.MAX_SET_SIZE}`}</p>
                                <p className="text-xs font-mono text-theme-accent flex items-center justify-end gap-1" title="Correct in a row">
                                    <FontAwesomeIcon icon={faFire} className="h-2.5 w-2.5" />{roundStreak}
                                </p>
                            </div>
                            {showExit && (
                                <button onClick={openExit} title="Exit Session" className="h-10 w-10 bg-theme-bg-secondary border border-theme-line hover:border-status-error text-theme-text-muted hover:text-status-error flex items-center justify-center transition-colors">
                                    <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Main Card */}
                    <div className="bg-theme-bg-secondary border border-theme-line overflow-hidden">
                        {showProgress && (
                            <div className="px-6 py-3 bg-theme-bg-elevated border-b border-theme-line flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Set</span>
                                        <span className="text-sm font-mono text-theme-text">{setNumber}/{totalSets}</span>
                                    </div>
                                    {ITEM_PHASES.includes(currentPhase) && (
                                        <div className="flex items-center gap-2 pl-4 border-l border-theme-line">
                                            <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Trial</span>
                                            <span className="text-sm font-mono text-theme-text">{currentTrialIndexInSet + 1}/{currentSetSize}</span>
                                        </div>
                                    )}
                                </div>
                                {currentPhase === P.RECALL && (
                                    <span className="hidden sm:inline text-xs font-mono text-theme-accent uppercase tracking-wider">
                                        Recall {currentSetSize} letters
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="p-6 min-h-[450px] flex flex-col justify-center items-center">{renderContent()}</div>
                    </div>
                </div>
            </div>

            <FeedbackButton />

            <ConfirmationModal
                isOpen={isExitOpen}
                onClose={closeExit}
                onConfirm={confirmExit}
                title="Exit Session"
                confirmText="Exit"
                cancelText="Keep Going"
                confirmColor="amber"
                isDestructive={false}
            >
                <p className="text-sm text-theme-text-secondary">Exit this session? It won't be saved and your set size stays where it is. You can start a new session anytime.</p>
            </ConfirmationModal>
        </>
    );
};

const OperationSpanTrainerTask = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [roundKey, setRoundKey] = useState(0);
    const autoStart = location.state?.autoStart === true || roundKey > 0;

    const handleExit = useCallback(() => {
        navigate('/testing/operation-span', { state: { mode: 'trainer' } });
    }, [navigate]);

    return (
        <TrainerRound
            key={roundKey}
            autoStart={autoStart}
            onExit={handleExit}
            onPlayAgain={() => setRoundKey((k) => k + 1)}
        />
    );
};

export default OperationSpanTrainerTask;

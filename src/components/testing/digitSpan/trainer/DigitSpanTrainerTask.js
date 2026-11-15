/* src/components/testing/digitSpan/trainer/DigitSpanTrainerTask.js */
/**
 * Full-screen player for one Digit Span Trainer session. Reuses the assessment's
 * DigitDisplay / DigitRecallPad / useDigitSpanTimer UNTOUCHED; the span staircase
 * + session flow live in useDigitSpanTrainerLogic. "Play Again" remounts the
 * inner round (fresh hook) via a key bump. Direction (forward/backward) comes
 * from the navigation state set by the panel.
 */
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useDigitSpanTrainerLogic from './hooks/useDigitSpanTrainerLogic';
import useDigitSpanTimer from '../hooks/useDigitSpanTimer';
import DigitSpanTrainerResults from './DigitSpanTrainerResults';
import DigitDisplay from '../DigitDisplay';
import DigitRecallPad from '../DigitRecallPad';
import LoadingSpinner from '../../../ui/LoadingSpinner';
import ConfirmationModal from '../../../ui/ConfirmationModal';
import FeedbackButton from '../../../feedback/FeedbackButton';
import { DIGIT_SPAN_PHASES as P, DIGIT_SPAN_BLOCKS, boundsFor } from '../../../../constants/digitSpanTrainerConstants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faListOl, faFire, faCheck, faRotateRight } from '@fortawesome/free-solid-svg-icons';

const PRESENTATION_PHASES = [P.FIXATION, P.DIGIT_SHOW, P.DIGIT_BLANK, P.RECALL_CUE];

const TrainerRound = ({ direction, autoStart, onExit, onPlayAgain }) => {
    const timerControlsRef = useRef({ cancelPresentation: () => {}, clearPhaseTimer: () => {} });
    const {
        currentPhase, currentTargetDigits, currentDigitIndex, responseDigits,
        presentationTrialKey, lastFeedbackCorrect, listNumber, totalLists,
        currentLevel, roundStreak, isReadyToStart, isLoading, error, finalResults,
        initializeSession, startSession, handleTimerEvent, handleResponseChange, submitRecall, handleExitTrainer,
    } = useDigitSpanTrainerLogic({ direction, onExit, timerControlsRef });

    useDigitSpanTimer({
        currentPhase,
        presentationTrialKey,
        digitCount: currentTargetDigits.length,
        onTimerEvent: handleTimerEvent,
        controlsRef: timerControlsRef,
    });

    const [isExitOpen, setIsExitOpen] = useState(false);
    const maxSpan = boundsFor(direction).MAX_SPAN;
    const dirLabel = direction === DIGIT_SPAN_BLOCKS.BACKWARD ? 'Backward' : 'Forward';

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

    const isTrialPhase = PRESENTATION_PHASES.includes(currentPhase)
        || currentPhase === P.RECALL || currentPhase === P.TRIAL_FEEDBACK;
    const isActive = isTrialPhase || currentPhase === P.SAVING || currentPhase === P.INTERRUPTED;
    const showProgress = isTrialPhase;
    const showExit = currentPhase !== P.RESULTS && currentPhase !== P.SAVING && !isReadyToStart;

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
                    <p className="text-xl font-serif italic text-theme-text mb-4">Digit Span Trainer</p>
                    <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">
                        Digits flash one per second. Recall each sequence {direction === DIGIT_SPAN_BLOCKS.BACKWARD ? 'in reverse order' : 'in the same order'}.
                        The span adjusts to keep you near your edge.
                    </p>
                    <button onClick={startSession} className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider">Start Session</button>
                </div>
            );
        }
        if (currentPhase === P.INTERRUPTED) {
            return (
                <div className="h-80 flex flex-col items-center justify-center text-center">
                    <div className="h-12 w-12 mb-4 bg-theme-accent/10 border border-theme-accent flex items-center justify-center">
                        <FontAwesomeIcon icon={faRotateRight} className="h-5 w-5 text-theme-accent" />
                    </div>
                    <p className="font-serif italic text-theme-text mb-2">List Interrupted</p>
                    <p className="text-sm text-theme-text-secondary max-w-xs">The tab lost focus. This list will start over. Keep the tab visible while digits are showing.</p>
                </div>
            );
        }
        if (currentPhase === P.RESULTS) {
            return <DigitSpanTrainerResults results={finalResults} direction={direction} onPlayAgain={onPlayAgain} onDone={onExit} />;
        }
        if (PRESENTATION_PHASES.includes(currentPhase)) {
            return (
                <DigitDisplay
                    phase={currentPhase}
                    digit={currentDigitIndex >= 0 ? currentTargetDigits[currentDigitIndex] : null}
                />
            );
        }
        if (currentPhase === P.RECALL) {
            return (
                <DigitRecallPad
                    expectedLength={currentTargetDigits.length}
                    direction={direction}
                    onSubmit={submitRecall}
                    value={responseDigits}
                    onChange={handleResponseChange}
                    inputDisabled={isExitOpen}
                />
            );
        }
        if (currentPhase === P.TRIAL_FEEDBACK) {
            return (
                <div className="h-80 flex flex-col items-center justify-center text-center">
                    <div className={`h-14 w-14 mb-3 border flex items-center justify-center ${lastFeedbackCorrect ? 'bg-status-success/20 border-status-success text-status-success' : 'bg-status-error/20 border-status-error text-status-error'}`}>
                        <FontAwesomeIcon icon={lastFeedbackCorrect ? faCheck : faTimes} className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-mono uppercase tracking-wider text-theme-text-muted">{lastFeedbackCorrect ? 'Correct' : 'Missed'}</p>
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
                                <FontAwesomeIcon icon={faListOl} className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">Trainer · {dirLabel}</p>
                                <h1 className="text-lg font-serif italic text-theme-text">Digit Span</h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <p className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider">Span {currentLevel}{currentLevel >= maxSpan ? ' · MAX' : ` / ${maxSpan}`}</p>
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
                                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">List</span>
                                        <span className="text-sm font-mono text-theme-text">{listNumber}/{totalLists}</span>
                                    </div>
                                    <div className="flex items-center gap-2 pl-4 border-l border-theme-line">
                                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Digits</span>
                                        <span className="text-sm font-mono text-theme-text">{currentTargetDigits.length}</span>
                                    </div>
                                </div>
                                {currentPhase === P.RECALL && (
                                    <span className="hidden sm:inline text-xs font-mono text-theme-accent uppercase tracking-wider">
                                        {direction === DIGIT_SPAN_BLOCKS.BACKWARD ? 'Reverse order' : 'Same order'}
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
                <p className="text-sm text-theme-text-secondary">Exit this session? It won't be saved and your span stays where it is. You can start a new session anytime.</p>
            </ConfirmationModal>
        </>
    );
};

const DigitSpanTrainerTask = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [roundKey, setRoundKey] = useState(0);
    const direction = location.state?.direction === DIGIT_SPAN_BLOCKS.BACKWARD ? DIGIT_SPAN_BLOCKS.BACKWARD : DIGIT_SPAN_BLOCKS.FORWARD;
    const autoStart = location.state?.autoStart === true || roundKey > 0;

    const handleExit = useCallback(() => {
        navigate('/testing/digit-span', { state: { mode: 'trainer' } });
    }, [navigate]);

    return (
        <TrainerRound
            key={roundKey}
            direction={direction}
            autoStart={autoStart}
            onExit={handleExit}
            onPlayAgain={() => setRoundKey((k) => k + 1)}
        />
    );
};

export default DigitSpanTrainerTask;

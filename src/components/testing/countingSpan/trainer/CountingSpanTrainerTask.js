/* src/components/testing/countingSpan/trainer/CountingSpanTrainerTask.js */
/**
 * Full-screen player for one Counting Span Trainer session. Reuses the
 * assessment's StimulusDisplay / RecallInterface UNTOUCHED and copies its
 * odd/even prompt and button styling verbatim, so a card here is
 * indistinguishable from a card in the Assessment — that is the point: trainer
 * practice is literally assessment practice. Only the trainer-only screens
 * (ready, interrupted, per-set feedback, results) carry trainer identity.
 *
 * The set-size staircase, phase timer and session flow live in
 * useCountingSpanTrainerLogic. "Play Again" remounts the inner round (fresh
 * hook, fresh clientSessionId) via a key bump.
 */
import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useCountingSpanTrainerLogic from './hooks/useCountingSpanTrainerLogic';
import CountingSpanSetFeedback from './CountingSpanSetFeedback';
import StimulusDisplay from '../StimulusDisplay';
import RecallInterface from '../RecallInterface';
import TrainerResults from '../../trainer/TrainerResults';
import LoadingSpinner from '../../../ui/LoadingSpinner';
import ConfirmationModal from '../../../ui/ConfirmationModal';
import FeedbackButton from '../../../feedback/FeedbackButton';
import {
    TASK_PHASES as P,
    CST_TRAINER as T,
    CST_TRAINER_TIMING as TIMING,
    CST_TRAINER_PHASES as TP,
} from '../../../../constants/countingSpanTrainerConstants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faShapes, faFire, faCheck, faRotateRight } from '@fortawesome/free-solid-svg-icons';

const CARD_PHASES = [P.FIXATION, P.ODD_EVEN_JUDGMENT, P.PROCESSING_TRANSITION];

// The recall pad submits on Enter. Without an arming delay, the reflexive second
// Enter that follows a submit would skip the feedback screen before it is read —
// the exact complaint the user-paced feedback exists to fix. Component-level, not
// a shared constant: it is an input-debounce detail, not a task parameter.
const FEEDBACK_HOTKEY_ARM_MS = 500;

// Window-level hotkeys must never fire under an overlay. FeedbackButton is always
// mounted here, and its modal is a plain div with no key handling — without this
// an Enter typed into the feedback form advanced the set behind it.
const isDialogOpen = () => !!document.querySelector('[role="dialog"]');

// Copied verbatim from the assessment's CountingSpanTask so a trainer card is
// visually identical to an assessment card.
const JUDGMENT_BUTTON_CLASS = `px-8 py-3 text-lg font-mono uppercase tracking-wider
    bg-theme-bg-elevated border border-theme-line text-theme-text
    hover:border-theme-accent hover:text-theme-accent
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-colors duration-150`;

const TrainerRound = ({ autoStart, onExit, onPlayAgain }) => {
    const {
        currentPhase, currentCard,
        currentTrialIndexInSet, currentSetSize, recallValue,
        setNumber, totalSets, setsCompleted,
        currentLevel, roundStreak,
        lastSetFeedback, lastSetCorrect,
        cumulativeJudgmentCorrect, cumulativeJudgmentTotal,
        isReadyToStart, isLoading, error, finalResults,
        initializeSession, startSession,
        recordJudgment, handleRecallChange, submitRecall, continueAfterFeedback, handleExitTrainer,
    } = useCountingSpanTrainerLogic({ onExit });

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

    // Key hints only where there is a keyboard (matches the antisaccade pattern).
    const showKeyHints = useMemo(() => {
        try {
            return window.matchMedia('(pointer: fine)').matches;
        } catch (e) {
            return false;
        }
    }, []);

    // O / E hotkeys — live only while a card is on screen and the exit modal is
    // closed, so they never coexist with RecallInterface's own key listener.
    useEffect(() => {
        if (currentPhase !== P.ODD_EVEN_JUDGMENT || isExitOpen) return undefined;
        const handleKeyDown = (event) => {
            if (event.defaultPrevented || event.repeat) return;
            if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
            if (isDialogOpen()) return;
            const target = event.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
            const key = event.key.toLowerCase();
            if (key === 'o') { event.preventDefault(); recordJudgment(true); }
            else if (key === 'e') { event.preventDefault(); recordJudgment(false); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPhase, isExitOpen, recordJudgment]);

    // Enter advances off the user-paced feedback screen. RecallInterface's own key
    // listener is unmounted by now, so there is no overlap. Enter only, never
    // Space: a size-10 table is taller than a phone viewport and Space is the
    // browser's scroll key — reading the bottom of the table must not skip the set.
    useEffect(() => {
        if (currentPhase !== TP.SET_FEEDBACK || isExitOpen || error) return undefined;
        const armedAt = Date.now();
        const handleKeyDown = (event) => {
            if (event.defaultPrevented || event.repeat) return;
            if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
            if (isDialogOpen()) return;
            if (Date.now() - armedAt < FEEDBACK_HOTKEY_ARM_MS) return;
            const target = event.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
            if (event.key !== 'Enter') return;
            event.preventDefault();
            continueAfterFeedback();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
        // `error` guard: prepareSet can bail on an empty pool bucket WITHOUT
        // changing the phase, so the error screen renders under SET_FEEDBACK and
        // this would otherwise swallow the Back button's Enter.
    }, [currentPhase, isExitOpen, error, continueAfterFeedback]);

    const isFinalSet = setsCompleted >= totalSets;

    const isTrialPhase = CARD_PHASES.includes(currentPhase)
        || currentPhase === P.RECALL || currentPhase === TP.SET_FEEDBACK;
    const isActive = isTrialPhase || currentPhase === P.SAVING || currentPhase === TP.INTERRUPTED;
    const showProgress = isTrialPhase;
    const showExit = currentPhase !== P.RESULTS && currentPhase !== P.SAVING && !isReadyToStart;

    const resultsProps = useMemo(() => ({
        results: finalResults,
        onPlayAgain,
        onDone: onExit,
        icon: faShapes,
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
                    <p className="text-xl font-serif italic text-theme-text mb-4">Counting Span Trainer</p>
                    <p className="text-sm text-theme-text-secondary mb-4 max-w-sm mx-auto">
                        Count the blue circles on each card and answer odd or even. After the last card,
                        recall every count in order. The set size adjusts to keep you near your edge.
                    </p>
                    <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-6 max-w-sm mx-auto">
                        <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-1">Card Time Limit</p>
                        <p className="text-sm text-theme-text-secondary">
                            Each card auto-advances after <span className="text-theme-accent font-mono font-medium">{(TIMING.JUDGMENT_WINDOW_MS / 1000).toFixed(0)}s</span> if not answered.
                        </p>
                    </div>
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
                    <p className="text-sm text-theme-text-secondary max-w-xs">The tab lost focus. This set will start over. Keep the tab visible while cards are showing.</p>
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
        if (currentPhase === P.ODD_EVEN_JUDGMENT) {
            return (
                <div className="flex flex-col items-center w-full">
                    <div className="w-full min-h-[300px] mb-6 flex items-center justify-center">
                        {currentCard?.items ? (
                            <StimulusDisplay items={currentCard.items} />
                        ) : (
                            <LoadingSpinner message="Loading stimulus..." theme="auto" />
                        )}
                    </div>
                    <p className="mb-4 text-sm font-mono text-theme-text-muted uppercase tracking-wider">
                        Is the count of <span className="text-theme-accent font-medium">BLUE CIRCLES</span> Odd or Even?
                    </p>
                    <div className="flex gap-4">
                        <button
                            onClick={() => recordJudgment(true)}
                            aria-keyshortcuts="o"
                            className={JUDGMENT_BUTTON_CLASS}
                        >
                            Odd
                        </button>
                        <button
                            onClick={() => recordJudgment(false)}
                            aria-keyshortcuts="e"
                            className={JUDGMENT_BUTTON_CLASS}
                        >
                            Even
                        </button>
                    </div>
                    {showKeyHints && (
                        <p className="mt-3 text-xs font-mono text-theme-text-muted">[O] Odd &nbsp; [E] Even</p>
                    )}
                </div>
            );
        }
        if (currentPhase === P.PROCESSING_TRANSITION) {
            return <div className="h-80 w-full"></div>;
        }
        if (currentPhase === P.RECALL) {
            return (
                <RecallInterface
                    setSize={currentSetSize}
                    onSubmit={handleRecallSubmit}
                    value={recallValue}
                    onChange={handleRecallChange}
                    wrapSlots
                />
            );
        }
        if (currentPhase === TP.SET_FEEDBACK) {
            return (
                <div className="flex flex-col items-center w-full">
                    <div className={`h-14 w-14 mb-1 border flex items-center justify-center ${lastSetCorrect ? 'bg-status-success/20 border-status-success text-status-success' : 'bg-status-error/20 border-status-error text-status-error'}`}>
                        <FontAwesomeIcon icon={lastSetCorrect ? faCheck : faTimes} className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-mono uppercase tracking-wider text-theme-text-muted">{lastSetCorrect ? 'Correct' : 'Missed'}</p>
                    <CountingSpanSetFeedback
                        presentedCounts={lastSetFeedback.presentedCounts}
                        recalledCounts={lastSetFeedback.recalledCounts}
                        recallCorrect={lastSetFeedback.recallCorrect}
                        setJudgmentCorrect={lastSetFeedback.judgmentCorrect}
                        judgmentCorrect={cumulativeJudgmentCorrect}
                        judgmentTotal={cumulativeJudgmentTotal}
                    />
                    {/* No autoFocus: it would double-fire with the window hotkey
                        below. Pointer users click; keyboard users press Enter. */}
                    <button
                        type="button"
                        onClick={continueAfterFeedback}
                        className="mt-6 btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
                    >
                        {isFinalSet ? 'See Results' : 'Next Set'}
                    </button>
                    {showKeyHints && (
                        <p className="mt-3 text-xs font-mono text-theme-text-muted">
                            [Enter] {isFinalSet ? 'Results' : 'Next set'}
                        </p>
                    )}
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
                                <FontAwesomeIcon icon={faShapes} className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">Trainer</p>
                                <h1 className="text-lg font-serif italic text-theme-text">Counting Span</h1>
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
                                    {CARD_PHASES.includes(currentPhase) && (
                                        <div className="flex items-center gap-2 pl-4 border-l border-theme-line">
                                            <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Card</span>
                                            <span className="text-sm font-mono text-theme-text">{currentTrialIndexInSet + 1}/{currentSetSize}</span>
                                        </div>
                                    )}
                                </div>
                                {currentPhase === P.RECALL && (
                                    <span className="hidden sm:inline text-xs font-mono text-theme-accent uppercase tracking-wider">
                                        Recall {currentSetSize} counts
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

const CountingSpanTrainerTask = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [roundKey, setRoundKey] = useState(0);
    const autoStart = location.state?.autoStart === true || roundKey > 0;

    const handleExit = useCallback(() => {
        navigate('/testing/counting-span', { state: { mode: 'trainer' } });
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

export default CountingSpanTrainerTask;

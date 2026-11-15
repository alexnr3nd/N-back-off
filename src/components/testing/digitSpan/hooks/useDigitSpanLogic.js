/* src/components/testing/digitSpan/hooks/useDigitSpanLogic.js */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser } from '../../../../contexts/UserContext';
import { DIGIT_SPAN_PHASES, DIGIT_SPAN_BLOCKS, DIGIT_SPAN_DEFAULTS } from '../../../../constants/digitSpanConstants';
import { functions, httpsCallable } from '../../../../firebaseConfig';
import {
    applyStaircase,
    generateLocalDigitSequence,
    compareResponse,
    validateDigitSpanPools,
    savePendingResults,
    getPendingResults,
    clearPendingResults,
} from './digitSpanHelpers';

const PRESENTATION_PHASES = [
    DIGIT_SPAN_PHASES.FIXATION,
    DIGIT_SPAN_PHASES.DIGIT_SHOW,
    DIGIT_SPAN_PHASES.DIGIT_BLANK,
    DIGIT_SPAN_PHASES.RECALL_CUE,
];

const blockConfig = (block) => (block === DIGIT_SPAN_BLOCKS.BACKWARD
    ? DIGIT_SPAN_DEFAULTS.BLOCK_CONFIG.BACKWARD
    : DIGIT_SPAN_DEFAULTS.BLOCK_CONFIG.FORWARD);

/**
 * Core logic hook for the Digit Span assessment.
 *
 * Session structure (identical for familiarization and scored sessions):
 *   forward intro -> forward practice -> 14 scored staircase trials ->
 *   block transition -> backward intro -> backward practice -> 14 scored trials -> save
 *
 * @param {function} onTaskComplete - Called after a successful submit (refresh user data).
 * @param {object} timerControlsRef - Populated by useDigitSpanTimer ({ cancelPresentation, clearPhaseTimer }).
 * @param {object} [options] - { earlyRetake, onExit }
 */
const useDigitSpanLogic = (onTaskComplete, timerControlsRef, options = {}) => {
    const { earlyRetake = false, onExit } = options;
    const { userId } = useUser();

    // --- Core State ---
    const [currentPhase, setCurrentPhase] = useState(DIGIT_SPAN_PHASES.INSTRUCTIONS);
    const [block, setBlock] = useState(DIGIT_SPAN_BLOCKS.FORWARD);
    const [isPractice, setIsPractice] = useState(false);
    const [practiceIndex, setPracticeIndex] = useState(0);
    const [trialNumber, setTrialNumber] = useState(0);          // scored trial index (0-based)
    const [currentLength, setCurrentLength] = useState(DIGIT_SPAN_DEFAULTS.BLOCK_CONFIG.FORWARD.startLength);
    const [currentTargetDigits, setCurrentTargetDigits] = useState([]);
    const [currentDigitIndex, setCurrentDigitIndex] = useState(-1);
    const [responseDigits, setResponseDigits] = useState([]);
    const [presentationTrialKey, setPresentationTrialKey] = useState(0);
    const [lastTrialFeedback, setLastTrialFeedback] = useState(null);
    const [isFamiliarization, setIsFamiliarization] = useState(false);
    const [hasScoredData, setHasScoredData] = useState(false); // >= 1 recorded scored trial (drives exit messaging)
    const [notEligibleMessage, setNotEligibleMessage] = useState(null);
    const [finalScores, setFinalScores] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // --- Refs (mutated without re-render) ---
    const phaseRef = useRef(currentPhase);
    const didInitRef = useRef(false);                   // init idempotence
    const isSubmittingRef = useRef(false);              // double-submit guard
    const trialScoredRef = useRef(false);               // submit-vs-timeout race guard
    const errorStreakRef = useRef(0);
    const currentLengthRef = useRef(DIGIT_SPAN_DEFAULTS.BLOCK_CONFIG.FORWARD.startLength);
    const responseRef = useRef([]);
    const poolsRef = useRef(null);
    const poolCursorsRef = useRef({ forward: {}, backward: {} });
    const clientSeqCounterRef = useRef(0);
    const forwardTrialsRef = useRef([]);
    const backwardTrialsRef = useRef([]);
    const currentTrialRef = useRef(null);               // { digits, sequenceId, clientGenerated }
    const trialMetaRef = useRef({});                    // per-trial validity metadata
    const pendingNextTrialRef = useRef(null);           // pre-prepared next scored sequence
    const nextAfterFeedbackRef = useRef('NEXT_TRIAL');  // 'NEXT_TRIAL' | 'BLOCK_TRANSITION' | 'SAVE'
    const redosRef = useRef({ forward: 0, backward: 0 });
    const pendingRestartRef = useRef(false);            // interrupted while still hidden
    const pendingTrialRef = useRef(null);               // trial whose start was deferred (tab hidden)

    useEffect(() => {
        phaseRef.current = currentPhase;
    }, [currentPhase]);

    // --- Pool Draw ---
    const drawSequenceFromPool = useCallback((blockKey, length) => {
        const pool = blockKey === DIGIT_SPAN_BLOCKS.BACKWARD
            ? poolsRef.current?.backwardPool
            : poolsRef.current?.forwardPool;
        const bucket = pool?.[String(length)];
        const cursors = poolCursorsRef.current[blockKey];
        const cursor = cursors[length] || 0;
        if (bucket && cursor < bucket.length) {
            cursors[length] = cursor + 1;
            return { digits: bucket[cursor].digits, sequenceId: bucket[cursor].id, clientGenerated: false };
        }
        // Pool depth covers all 14 trials parked at one length plus the full
        // redo budget (SEQUENCES_PER_LENGTH = 17), so this is unreachable with
        // valid pools — but never strand the user.
        console.warn(`[DigitSpan] Pool dry for ${blockKey} length ${length}; generating client-side.`);
        clientSeqCounterRef.current++;
        return {
            digits: generateLocalDigitSequence(length),
            sequenceId: `client_${blockKey}_${length}_${clientSeqCounterRef.current}`,
            clientGenerated: true,
        };
    }, []);

    // --- Single Trial Reset Point (practice AND scored) ---
    const prepareTrial = useCallback((trialSource) => {
        // The visibilitychange protection only sees hidden TRANSITIONS, so a
        // trial that would START while the tab is already hidden (e.g. the user
        // tabbed away during feedback or the recall window) must be deferred
        // here, or its presentation would run throttled and unseen. No redo is
        // consumed: nothing was presented yet.
        if (document.hidden) {
            pendingTrialRef.current = trialSource;
            setCurrentPhase(DIGIT_SPAN_PHASES.INTERRUPTED);
            return;
        }
        pendingTrialRef.current = null;
        currentTrialRef.current = trialSource;
        trialMetaRef.current = {
            recallCueAt: null,
            firstKeyLatencyMs: null,
            blurredDuringRecall: false,
            interrupted: false,
            measuredDigitOnMs: null,
        };
        trialScoredRef.current = false;
        responseRef.current = [];
        setResponseDigits([]);
        setCurrentTargetDigits(trialSource.digits);
        setCurrentDigitIndex(-1);
        setLastTrialFeedback(null);
        setCurrentPhase(DIGIT_SPAN_PHASES.FIXATION);
        setPresentationTrialKey(prev => prev + 1); // triggers the timer's presentation runner
    }, []);

    // Redo the in-flight trial with a FRESH sequence at the same length
    // (after a tab-hidden interruption; the aborted trial does not count).
    const restartCurrentTrial = useCallback(() => {
        const length = currentTrialRef.current?.digits?.length
            || (isPractice ? blockConfig(block).practiceLengths[practiceIndex] : currentLengthRef.current);
        if (isPractice) {
            clientSeqCounterRef.current++;
            prepareTrial({
                digits: generateLocalDigitSequence(length),
                sequenceId: `practice_${block}_${practiceIndex}_${clientSeqCounterRef.current}`,
                clientGenerated: true,
            });
        } else {
            prepareTrial(drawSequenceFromPool(block, length));
        }
    }, [isPractice, block, practiceIndex, prepareTrial, drawSequenceFromPool]);

    // Leave the INTERRUPTED phase: present the deferred (never-shown) trial if
    // one is stashed, otherwise redo the aborted trial with a fresh sequence.
    const resumeInterruptedTrial = useCallback(() => {
        const pending = pendingTrialRef.current;
        pendingTrialRef.current = null;
        if (pending) {
            prepareTrial(pending);
        } else {
            restartCurrentTrial();
        }
    }, [prepareTrial, restartCurrentTrial]);

    // --- Initialize Session (idempotent; called on mount) ---
    const initializeSession = useCallback(async () => {
        if (didInitRef.current) return;
        didInitRef.current = true;
        console.log('[DigitSpan] Initializing session...');
        setIsLoading(true);
        setError(null);

        try {
            const checkElig = httpsCallable(functions, 'checkDigitSpanEligibility');
            const eligResult = await checkElig({});
            const data = eligResult.data;
            const isFamiliar = !data.familiarizationComplete;
            setIsFamiliarization(isFamiliar);
            console.log(`[DigitSpan] Session type: ${isFamiliar ? 'familiarization' : 'scored'}. Eligible: ${data.isEligible}`);

            if (data.familiarizationComplete && !data.isEligible && !earlyRetake) {
                // Not eligible AND not an explicitly-confirmed early retake — bail out.
                // When earlyRetake is true the user confirmed the prompt on the summary
                // page; getDigitSpanStructure(forceStart) and submitDigitSpanResults
                // (forceSubmit) carry the bypass, which the backend honors.
                setNotEligibleMessage(data.nextAvailableDateString || 'You are not eligible for a new assessment yet.');
                setIsLoading(false);
                setCurrentPhase(DIGIT_SPAN_PHASES.RESULTS);
                return;
            }

            // Familiarization runs the identical full session, so pools are always needed.
            const getStructure = httpsCallable(functions, 'getDigitSpanStructure');
            const structResult = await getStructure({ forceStart: earlyRetake });
            const { forwardPool, backwardPool } = structResult.data || {};
            if (!validateDigitSpanPools(forwardPool, backwardPool)) {
                throw new Error('Invalid sequence pools received.');
            }
            poolsRef.current = { forwardPool, backwardPool };
            poolCursorsRef.current = { forward: {}, backward: {} };
            console.log('[DigitSpan] Pools validated and cached.');

            setIsLoading(false);
            setBlock(DIGIT_SPAN_BLOCKS.FORWARD);
            setCurrentPhase(DIGIT_SPAN_PHASES.BLOCK_INTRO);
        } catch (err) {
            console.error('[DigitSpan] Init error:', err);
            setError(`Failed to initialize: ${err.message}`);
            setIsLoading(false);
            setCurrentPhase(DIGIT_SPAN_PHASES.RESULTS);
        }
    }, [earlyRetake]);

    // --- Block Flow ---
    const startBlockPractice = useCallback(() => {
        const config = blockConfig(block);
        setIsPractice(true);
        setPracticeIndex(0);
        prepareTrial({
            digits: generateLocalDigitSequence(config.practiceLengths[0]),
            sequenceId: `practice_${block}_0`,
            clientGenerated: true,
        });
    }, [block, prepareTrial]);

    const continuePractice = useCallback(() => {
        const config = blockConfig(block);
        const nextIndex = practiceIndex + 1;
        if (nextIndex < config.practiceLengths.length) {
            setPracticeIndex(nextIndex);
            prepareTrial({
                digits: generateLocalDigitSequence(config.practiceLengths[nextIndex]),
                sequenceId: `practice_${block}_${nextIndex}`,
                clientGenerated: true,
            });
        } else {
            setIsPractice(false);
            setCurrentPhase(DIGIT_SPAN_PHASES.READY_BLOCK);
        }
    }, [block, practiceIndex, prepareTrial]);

    // Skip the rest of the CURRENT block's practice (button shown on scored
    // sessions only). Each block offers its own skip — no remembered state.
    // Scored blocks always start at the fixed startLength, so skipping cannot
    // affect scoring. Mirrors handleExitAssessment's timer teardown.
    const skipPractice = useCallback(() => {
        if (!isPractice) return;
        if (timerControlsRef?.current?.cancelPresentation) timerControlsRef.current.cancelPresentation();
        if (timerControlsRef?.current?.clearPhaseTimer) timerControlsRef.current.clearPhaseTimer();
        pendingTrialRef.current = null;
        responseRef.current = [];
        setResponseDigits([]);
        setCurrentTargetDigits([]);
        setCurrentDigitIndex(-1);
        setLastTrialFeedback(null);
        setIsPractice(false);
        // Sync BEFORE setCurrentPhase: stale timer events (recall_timeout,
        // feedback_done) and submitRecall guard on phaseRef synchronously.
        phaseRef.current = DIGIT_SPAN_PHASES.READY_BLOCK;
        setCurrentPhase(DIGIT_SPAN_PHASES.READY_BLOCK);
    }, [isPractice, timerControlsRef]);

    const startScoredBlock = useCallback(() => {
        const config = blockConfig(block);
        setIsPractice(false);
        setTrialNumber(0);
        currentLengthRef.current = config.startLength;
        setCurrentLength(config.startLength);
        errorStreakRef.current = 0;
        pendingNextTrialRef.current = null;
        prepareTrial(drawSequenceFromPool(block, config.startLength));
    }, [block, prepareTrial, drawSequenceFromPool]);

    const startBackwardBlock = useCallback(() => {
        setBlock(DIGIT_SPAN_BLOCKS.BACKWARD);
        setCurrentPhase(DIGIT_SPAN_PHASES.BLOCK_INTRO);
    }, []);

    // --- Submit Results ---
    const submitResults = useCallback(async () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setIsLoading(true);
        setError(null);
        setCurrentPhase(DIGIT_SPAN_PHASES.SAVING);

        if (!userId) {
            setError('No user ID.');
            setIsLoading(false);
            isSubmittingRef.current = false;
            setCurrentPhase(DIGIT_SPAN_PHASES.RESULTS);
            return;
        }

        const payload = {
            isFamiliarization,
            forwardTrials: forwardTrialsRef.current,
            backwardTrials: backwardTrialsRef.current,
            ...(earlyRetake && { forceSubmit: true }),
        };

        try {
            const submitFunc = httpsCallable(functions, 'submitDigitSpanResults');
            const result = await submitFunc(payload);
            if (result.data?.success) {
                setFinalScores({
                    meanSpanForward: result.data.meanSpanForward ?? null,
                    meanSpanBackward: result.data.meanSpanBackward ?? null,
                    maxLengthForward: result.data.maxLengthForward ?? null,
                    maxLengthBackward: result.data.maxLengthBackward ?? null,
                });
                clearPendingResults(userId);
                if (onTaskComplete) onTaskComplete();
            } else {
                throw new Error(result.data?.message || 'Submission failed.');
            }
        } catch (err) {
            console.error('[DigitSpan] Submit error:', err);
            if (err.code !== 'functions/invalid-argument' && err.code !== 'functions/permission-denied') {
                savePendingResults(userId, payload);
                setError('Results saved locally. They will be submitted when you return to the assessment page.');
            } else {
                setError(`Failed to save results: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
            isSubmittingRef.current = false;
            setCurrentPhase(DIGIT_SPAN_PHASES.RESULTS);
        }
    }, [userId, isFamiliarization, earlyRetake, onTaskComplete]);

    // --- Trial Scoring ---
    const scoreTrial = useCallback((timedOut) => {
        const target = currentTrialRef.current?.digits || [];
        const response = [...responseRef.current];
        const meta = trialMetaRef.current;
        const wasCorrect = !timedOut && compareResponse(target, response, block);

        if (isPractice) {
            setLastTrialFeedback({ wasCorrect, timedOut, targetDigits: target, responseDigits: response });
            setCurrentPhase(DIGIT_SPAN_PHASES.PRACTICE_FEEDBACK);
            return;
        }

        // Record the scored trial
        const recallTimeMs = timedOut
            ? DIGIT_SPAN_DEFAULTS.RECALL_TIMEOUT_MS
            : (meta.recallCueAt != null ? Math.round(performance.now() - meta.recallCueAt) : null);
        const trialRecord = {
            sequenceId: currentTrialRef.current?.sequenceId || 'unknown',
            length: target.length,
            targetDigits: [...target],
            responseDigits: response,
            recallTimedOut: timedOut,
            recallTimeMs,
            firstKeyLatencyMs: meta.firstKeyLatencyMs,
            interrupted: meta.interrupted,
            blurredDuringRecall: meta.blurredDuringRecall,
            clientGenerated: currentTrialRef.current?.clientGenerated === true,
            ...(meta.measuredDigitOnMs && { measuredDigitOnMs: meta.measuredDigitOnMs }),
        };
        if (block === DIGIT_SPAN_BLOCKS.BACKWARD) {
            backwardTrialsRef.current.push(trialRecord);
        } else {
            forwardTrialsRef.current.push(trialRecord);
        }
        setHasScoredData(true);

        // Staircase update
        const config = blockConfig(block);
        const { nextLength, nextErrorStreak } = applyStaircase({
            currentLength: currentLengthRef.current,
            wasCorrect,
            errorStreak: errorStreakRef.current,
            floor: config.floor,
            cap: config.cap,
        });
        currentLengthRef.current = nextLength;
        setCurrentLength(nextLength);
        errorStreakRef.current = nextErrorStreak;

        // Decide what follows the feedback flash, pre-preparing the next sequence
        if (trialNumber + 1 < DIGIT_SPAN_DEFAULTS.TRIALS_PER_BLOCK) {
            nextAfterFeedbackRef.current = 'NEXT_TRIAL';
            pendingNextTrialRef.current = drawSequenceFromPool(block, nextLength);
        } else if (block === DIGIT_SPAN_BLOCKS.FORWARD) {
            nextAfterFeedbackRef.current = 'BLOCK_TRANSITION';
            pendingNextTrialRef.current = null;
        } else {
            nextAfterFeedbackRef.current = 'SAVE';
            pendingNextTrialRef.current = null;
        }

        setLastTrialFeedback({ wasCorrect, timedOut });
        setCurrentPhase(DIGIT_SPAN_PHASES.TRIAL_FEEDBACK);
    }, [block, isPractice, trialNumber, drawSequenceFromPool]);

    // --- Recall Handlers ---
    const handleResponseChange = useCallback((newDigits) => {
        if (trialMetaRef.current.firstKeyLatencyMs == null
            && newDigits.length > 0
            && trialMetaRef.current.recallCueAt != null) {
            trialMetaRef.current.firstKeyLatencyMs = Math.round(performance.now() - trialMetaRef.current.recallCueAt);
        }
        responseRef.current = newDigits;
        setResponseDigits(newDigits);
    }, []);

    const submitRecall = useCallback(() => {
        // isSubmittingRef catches the exit-modal Enter double-fire: the modal's
        // document-level Enter handler confirms the exit (starting submitResults
        // synchronously) before this window-level path runs in the same event
        // dispatch, while phaseRef is still stale.
        if (phaseRef.current !== DIGIT_SPAN_PHASES.RECALL || trialScoredRef.current || isSubmittingRef.current) return;
        trialScoredRef.current = true;
        if (timerControlsRef?.current?.clearPhaseTimer) timerControlsRef.current.clearPhaseTimer();
        scoreTrial(false);
    }, [scoreTrial, timerControlsRef]);

    // --- Timer Event Dispatch ---
    const handleTimerEvent = useCallback((type, payload = {}) => {
        if (isSubmittingRef.current) return; // no trial flow once a submit is in flight
        switch (type) {
            case 'digit_show':
                setCurrentDigitIndex(payload.index);
                setCurrentPhase(DIGIT_SPAN_PHASES.DIGIT_SHOW);
                break;
            case 'digit_blank':
                setCurrentPhase(DIGIT_SPAN_PHASES.DIGIT_BLANK);
                break;
            case 'recall_cue':
                setCurrentPhase(DIGIT_SPAN_PHASES.RECALL_CUE);
                break;
            case 'recall_start':
                trialMetaRef.current.measuredDigitOnMs = payload.measuredDigitOnMs || null;
                trialMetaRef.current.recallCueAt = performance.now();
                setCurrentPhase(DIGIT_SPAN_PHASES.RECALL);
                break;
            case 'recall_timeout':
                if (phaseRef.current !== DIGIT_SPAN_PHASES.RECALL || trialScoredRef.current) return;
                trialScoredRef.current = true;
                scoreTrial(true);
                break;
            case 'feedback_done':
                if (phaseRef.current !== DIGIT_SPAN_PHASES.TRIAL_FEEDBACK) return;
                if (nextAfterFeedbackRef.current === 'NEXT_TRIAL') {
                    setTrialNumber(prev => prev + 1);
                    const next = pendingNextTrialRef.current || drawSequenceFromPool(block, currentLengthRef.current);
                    pendingNextTrialRef.current = null;
                    prepareTrial(next);
                } else if (nextAfterFeedbackRef.current === 'BLOCK_TRANSITION') {
                    setCurrentPhase(DIGIT_SPAN_PHASES.BLOCK_TRANSITION);
                } else {
                    submitResults();
                }
                break;
            case 'interrupted_done':
                if (phaseRef.current !== DIGIT_SPAN_PHASES.INTERRUPTED) return;
                if (document.hidden) {
                    pendingRestartRef.current = true; // restart when the tab returns
                } else {
                    resumeInterruptedTrial();
                }
                break;
            default:
                break;
        }
    }, [block, scoreTrial, prepareTrial, drawSequenceFromPool, submitResults, resumeInterruptedTrial]);

    // --- Background-Tab Throttling Handling ---
    // Browsers throttle hidden-tab timers to >= 1 s, which corrupts the
    // 800/200 ms presentation. Hidden during presentation -> abort + redo with
    // a fresh sequence (max MAX_TRIAL_REDOS_PER_BLOCK per block, then proceed
    // flagged). Hidden during recall -> flag only (no timing-critical display).
    const visibilityDepsRef = useRef({});
    visibilityDepsRef.current = { block, resumeInterruptedTrial };
    useEffect(() => {
        const handler = () => {
            const phase = phaseRef.current;
            if (!document.hidden) {
                if (phase === DIGIT_SPAN_PHASES.INTERRUPTED && pendingRestartRef.current) {
                    pendingRestartRef.current = false;
                    visibilityDepsRef.current.resumeInterruptedTrial();
                }
                return;
            }
            if (PRESENTATION_PHASES.includes(phase)) {
                const blockKey = visibilityDepsRef.current.block;
                if (redosRef.current[blockKey] >= DIGIT_SPAN_DEFAULTS.MAX_TRIAL_REDOS_PER_BLOCK) {
                    trialMetaRef.current.interrupted = true; // budget spent: proceed, flagged
                    return;
                }
                redosRef.current[blockKey]++;
                if (timerControlsRef?.current?.cancelPresentation) timerControlsRef.current.cancelPresentation();
                pendingTrialRef.current = null; // partially shown: resume must draw a FRESH sequence
                setCurrentPhase(DIGIT_SPAN_PHASES.INTERRUPTED);
            } else if (phase === DIGIT_SPAN_PHASES.RECALL) {
                trialMetaRef.current.blurredDuringRecall = true;
            }
        };
        document.addEventListener('visibilitychange', handler);
        return () => document.removeEventListener('visibilitychange', handler);
    }, [timerControlsRef]);

    // --- Early Exit ---
    const handleExitAssessment = useCallback(async () => {
        if (timerControlsRef?.current?.cancelPresentation) timerControlsRef.current.cancelPresentation();
        if (timerControlsRef?.current?.clearPhaseTimer) timerControlsRef.current.clearPhaseTimer();

        if (isFamiliarization || forwardTrialsRef.current.length === 0) {
            // Familiarization, or scored exit before any completed forward trial: discard.
            if (onExit) onExit();
        } else {
            // Scored exit with partial results: submit what we have (backward may be empty).
            await submitResults();
        }
    }, [isFamiliarization, submitResults, onExit, timerControlsRef]);

    // --- Dev Skip ---
    const handleDevSkipTask = useCallback(async () => {
        if (process.env.NODE_ENV !== 'development') return;
        const fakeBlock = (blockKey) => {
            const config = blockConfig(blockKey);
            return Array.from({ length: DIGIT_SPAN_DEFAULTS.TRIALS_PER_BLOCK }, (_, i) => {
                const digits = generateLocalDigitSequence(config.startLength);
                const correct = Math.random() < 0.6;
                const expected = blockKey === DIGIT_SPAN_BLOCKS.BACKWARD ? [...digits].reverse() : [...digits];
                return {
                    sequenceId: `dev_${blockKey}_${i}`,
                    length: digits.length,
                    targetDigits: digits,
                    responseDigits: correct ? expected : [...expected].reverse(),
                    recallTimedOut: false,
                };
            });
        };
        forwardTrialsRef.current = fakeBlock(DIGIT_SPAN_BLOCKS.FORWARD);
        backwardTrialsRef.current = fakeBlock(DIGIT_SPAN_BLOCKS.BACKWARD);
        await submitResults();
    }, [submitResults]);

    return {
        // State
        currentPhase, block, isPractice, practiceIndex, trialNumber,
        currentLength, currentTargetDigits, currentDigitIndex,
        responseDigits, presentationTrialKey, lastTrialFeedback,
        isFamiliarization, hasScoredData, notEligibleMessage, finalScores,
        isLoading, error,
        // Actions
        initializeSession, startBlockPractice, continuePractice,
        skipPractice, startScoredBlock, startBackwardBlock,
        handleResponseChange, submitRecall, handleTimerEvent,
        handleExitAssessment, handleDevSkipTask,
    };
};

// Export for use by summary page recovery
export { getPendingResults, clearPendingResults };
export default useDigitSpanLogic;

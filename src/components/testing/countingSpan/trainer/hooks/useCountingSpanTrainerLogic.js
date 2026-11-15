/* src/components/testing/countingSpan/trainer/hooks/useCountingSpanTrainerLogic.js */
/**
 * Session runner + client-side set-level staircase for the Counting Span
 * TRAINER. Reuses the assessment's StimulusDisplay / RecallInterface UNTOUCHED;
 * a trial == one recalled set (cards counted one at a time, then all counts
 * recalled in order). A 2-down-1-up staircase walks the set size (advance after
 * 2 consecutive correct sets, drop after 1 miss) with an odd/even gate: a set
 * only counts correct with perfect serial recall AND >= 75% of its odd/even
 * answers right, so recall can't be bought by skipping the counting. On finish
 * it submits the full set record; the server re-scores and replays the staircase
 * authoritatively from the STORED size.
 *
 * Distinct from the assessment hook: no practice / familiarization / cooldown;
 * the server sends card COUNTS only and the layout is built client-side
 * (cardLayout.js); user-paced feedback after each set (the feedback screen has no
 * timeout — it sits until the user presses Next Set, so a 71-year-old reading the
 * comparison table is never raced); and this hook owns its own phase
 * timer rather than using useCountingSpanTimer — the assessment's timer hook is
 * instantiated twice there (its clear callbacks are no-ops) and routes through
 * an advancePhase switchboard with implicit pair semantics that the trainer's
 * interruption/redo flow can't safely reuse.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
    TASK_PHASES as P,
    CST_TRAINER as T,
    CST_TRAINER_TIMING as TIMING,
    CST_TRAINER_PHASES as TP,
    nextSetSize, isSetCorrect, calculateCountPCU, countJudgmentsCorrect,
} from '../../../../../constants/countingSpanTrainerConstants';
import { buildCardItems } from '../cardLayout';
import { functions, httpsCallable } from '../../../../../firebaseConfig';

// Phases during which a hidden tab voids the in-flight set (recall and the
// feedback screen are not interruptible — nothing is being presented, and the
// feedback screen has no timeout at all, so sitting on it is harmless).
const PRESENTATION_PHASES = [P.FIXATION, P.ODD_EVEN_JUDGMENT, P.PROCESSING_TRANSITION];

const makeSessionId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `cs_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const TRIAL_CAP = T.SETS_PER_SESSION + T.SPARE_SETS;

/** Server-sent start size, coerced to an in-range integer set size. */
const clampSetSize = (v) => (Number.isFinite(v)
    ? Math.max(T.MIN_SET_SIZE, Math.min(T.MAX_SET_SIZE, Math.round(v)))
    : T.START_SET_SIZE);

const useCountingSpanTrainerLogic = ({ onExit }) => {
    const [currentPhase, setCurrentPhase] = useState(P.INSTRUCTIONS);
    const [currentCard, setCurrentCard] = useState(null); // { targetCount, distractor1Count, distractor2Count, items }
    const [currentTrialIndexInSet, setCurrentTrialIndexInSet] = useState(-1);
    const [currentSetSize, setCurrentSetSize] = useState(T.START_SET_SIZE);
    const [recallValue, setRecallValue] = useState([]);
    const [setNumber, setSetNumber] = useState(0);
    const [setsCompleted, setSetsCompleted] = useState(0); // scored sets finished (drives the "See Results" label)
    const [currentLevel, setCurrentLevel] = useState(T.START_SET_SIZE); // current set size
    const [bestLevel, setBestLevel] = useState(T.START_SET_SIZE);
    const [roundStreak, setRoundStreak] = useState(0);
    const [lastSetFeedback, setLastSetFeedback] = useState({ presentedCounts: [], recalledCounts: [], recallCorrect: 0, judgmentCorrect: 0, total: 0 });
    const [lastSetCorrect, setLastSetCorrect] = useState(null);
    const [cumulativeJudgmentCorrect, setCumulativeJudgmentCorrect] = useState(0);
    const [cumulativeJudgmentTotal, setCumulativeJudgmentTotal] = useState(0);
    const [isReadyToStart, setIsReadyToStart] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [finalResults, setFinalResults] = useState(null);

    const phaseRef = useRef(P.INSTRUCTIONS);
    const timerRef = useRef(null);
    const didInitRef = useRef(false);
    const poolRef = useRef({});
    const drawCountRef = useRef({});
    const sizeRef = useRef(T.START_SET_SIZE);
    const consecutiveCorrectRef = useRef(0);
    const currentSetRef = useRef(null);       // { setSize, cards, id }
    const currentTrialIndexRef = useRef(0);
    const judgmentsRef = useRef([]);          // current set's [{ correct, timedOut }]
    const judgedRef = useRef(false);          // current card already answered
    const recallRef = useRef([]);
    const trialsRef = useRef([]);
    const completedRef = useRef(0);           // scored sets finished
    const redoCountRef = useRef(0);
    const pendingRedoRef = useRef(false);     // a set was actually voided (vs a benign between-set gap)
    const setScoredRef = useRef(false);
    const roundStreakRef = useRef(0);
    const bestRunRef = useRef(0);             // longest correct-set streak this session
    const sessionIdRef = useRef(null);
    const sessionStartRef = useRef(0);
    const isSubmittingRef = useRef(false);

    const setPhase = useCallback((p) => { phaseRef.current = p; setCurrentPhase(p); }, []);

    // --- Present one set at the current staircase size ---
    const prepareSet = useCallback(() => {
        if (document.hidden) { setPhase(TP.INTERRUPTED); return; }
        const size = sizeRef.current;
        const bucket = poolRef.current[String(size)] || [];
        if (bucket.length === 0) { setError('Ran out of sets for this session.'); return; }
        const idx = (drawCountRef.current[size] || 0) % bucket.length;
        drawCountRef.current[size] = (drawCountRef.current[size] || 0) + 1;
        // The bucket index wraps once a size is drawn more than SETS_PER_SIZE
        // times (interruption redos can do that), so the id uses the running
        // per-size draw number instead — ids stay unique within a session.
        const drawNumber = drawCountRef.current[size];
        const drawn = bucket[idx];
        // The server sends counts only; the card layout is built here (see
        // cardLayout.js) so a fresh random arrangement is drawn every set.
        const cards = (Array.isArray(drawn.cards) ? drawn.cards : []).map((c) => ({
            targetCount: c.t,
            distractor1Count: c.d1,
            distractor2Count: c.d2,
            items: buildCardItems(c),
        }));
        currentSetRef.current = {
            setSize: size,
            cards,
            id: `cst_tr_${completedRef.current + 1}_${size}_${drawNumber}`,
        };
        judgmentsRef.current = [];
        judgedRef.current = false;
        setScoredRef.current = false;
        currentTrialIndexRef.current = 0;
        recallRef.current = [];
        setRecallValue([]);
        setCurrentSetSize(size);
        setCurrentTrialIndexInSet(0);
        setCurrentCard(cards[0] || null);
        setLastSetCorrect(null);
        setSetNumber(Math.min(completedRef.current + 1, T.SETS_PER_SESSION));
        setPhase(P.FIXATION); // the local phase timer drives FIXATION -> ODD_EVEN_JUDGMENT
    }, [setPhase]);

    // --- Submission ---
    const submitResults = useCallback(async () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        setIsLoading(true);
        setPhase(P.SAVING);
        try {
            const submit = httpsCallable(functions, 'submitCountingSpanTrainerResults');
            const dt = new Date();
            const localDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            const res = await submit({
                trials: trialsRef.current,
                clientSessionId: sessionIdRef.current,
                durationMs: Date.now() - sessionStartRef.current,
                localDate,
            });
            const data = res.data || {};
            if (typeof data.newLevel === 'number') setCurrentLevel(data.newLevel);
            if (typeof data.bestLevel === 'number') setBestLevel(data.bestLevel);
            setFinalResults({
                accuracy: data.accuracy ?? null,
                prevLevel: data.prevLevel ?? null,
                newLevel: data.newLevel ?? null,
                bestRun: bestRunRef.current,
                bestLevel: data.bestLevel ?? null,
                sessionCount: data.sessionCount ?? null,
            });
        } catch (err) {
            console.error('[CountingSpanTrainer] submit failed:', err);
            setError(err?.message || 'Could not save this session. Your set size is unchanged.');
            setFinalResults({ error: true });
        } finally {
            setIsLoading(false);
            setPhase(P.RESULTS);
        }
    }, [setPhase]);

    const advanceAfterSet = useCallback(() => {
        if (completedRef.current >= T.SETS_PER_SESSION) submitResults();
        else prepareSet();
    }, [prepareSet, submitResults]);

    // --- Score one set (recall submit or recall timeout) ---
    const scoreSet = useCallback((timedOut) => {
        if (setScoredRef.current || isSubmittingRef.current) return;
        const set = currentSetRef.current;
        if (!set) return;
        setScoredRef.current = true;
        // Preserve whatever was typed even on recall timeout (the assessment
        // does the same; recallTimedOut alone makes the set incorrect). The
        // recall pad yields number|null — normalize to integers 0-9 or null so
        // the server validator never sees a stray type.
        const recalled = [...recallRef.current]
            .map((v) => (Number.isInteger(v) && v >= T.RECALL_DIGIT_MIN && v <= T.RECALL_DIGIT_MAX ? v : null));
        while (recalled.length < set.setSize) recalled.push(null);
        recalled.length = set.setSize;
        // Length invariant: judgments always padded to setSize (the timeout path
        // records inline, but guard against an early recall submit).
        const judgments = [...judgmentsRef.current]
            .map((j) => ({ correct: j?.correct === true, timedOut: j?.timedOut === true }));
        while (judgments.length < set.setSize) judgments.push({ correct: false, timedOut: false });
        judgments.length = set.setSize;

        const presented = set.cards.map((c) => c.targetCount);
        const correct = isSetCorrect(presented, recalled, judgments, timedOut);
        const recallCorrectCount = calculateCountPCU(presented, recalled);
        const judgmentCorrectCount = countJudgmentsCorrect(judgments);

        if (trialsRef.current.length < TRIAL_CAP) {
            trialsRef.current.push({
                id: set.id,
                setSize: set.setSize,
                presentedCounts: presented,
                recalledCounts: recalled,
                judgments,
                recallTimedOut: !!timedOut,
            });
        }
        completedRef.current += 1;
        setSetsCompleted(completedRef.current);

        if (correct) {
            roundStreakRef.current += 1;
            if (roundStreakRef.current > bestRunRef.current) bestRunRef.current = roundStreakRef.current;
        } else {
            roundStreakRef.current = 0;
        }
        setRoundStreak(roundStreakRef.current);

        const step = nextSetSize(sizeRef.current, consecutiveCorrectRef.current, correct, T.MIN_SET_SIZE, T.MAX_SET_SIZE);
        sizeRef.current = step.size;
        consecutiveCorrectRef.current = step.consecutiveCorrect;
        setCurrentLevel(step.size);

        setLastSetFeedback({
            presentedCounts: presented,
            recalledCounts: recalled,
            recallCorrect: recallCorrectCount,
            judgmentCorrect: judgmentCorrectCount,
            total: set.setSize,
        });
        setLastSetCorrect(correct);
        setPhase(TP.SET_FEEDBACK); // no timer here — the user presses Next Set
    }, [setPhase]);

    /**
     * The ONLY way off the feedback screen. Guarded on the phase so a stray
     * Enter (or a click landing after the phase already moved) can't skip a set,
     * and on isSubmittingRef so an exit-in-flight stays frozen.
     */
    const continueAfterFeedback = useCallback(() => {
        if (phaseRef.current !== TP.SET_FEEDBACK || isSubmittingRef.current) return;
        advanceAfterSet();
    }, [advanceAfterSet]);

    // --- Interruption: void the in-flight set, redo it at the same size ---
    const voidCurrentSet = useCallback(() => {
        if (setScoredRef.current || isSubmittingRef.current || !currentSetRef.current) return;
        setScoredRef.current = true;
        pendingRedoRef.current = true;
        const set = currentSetRef.current;
        // Cap interrupted records at the spare budget so all SETS_PER_SESSION
        // scored sets always fit inside the submission cap
        // (SETS_PER_SESSION + SPARE_SETS).
        const interruptedCount = trialsRef.current.filter((t) => t.interrupted).length;
        if (interruptedCount < T.SPARE_SETS) {
            const judgments = [...judgmentsRef.current]
                .map((j) => ({ correct: j?.correct === true, timedOut: j?.timedOut === true }));
            while (judgments.length < set.setSize) judgments.push({ correct: false, timedOut: false });
            judgments.length = set.setSize;
            trialsRef.current.push({
                id: set.id,
                setSize: set.setSize,
                presentedCounts: set.cards.map((c) => c.targetCount),
                recalledCounts: Array(set.setSize).fill(null),
                judgments,
                recallTimedOut: false,
                interrupted: true,
            });
        }
        setPhase(TP.INTERRUPTED); // the phase change tears down the pending timer
    }, [setPhase]);

    // Note on the spare budget: SPARE_SETS caps how many interrupted records are
    // STORED (so all SETS_PER_SESSION scored sets always fit under the TRIAL_CAP
    // submission cap), not how many redos a user gets. A void never advances
    // completedRef, so past the budget the `advanceAfterSet` branch still lands
    // on prepareSet — a voided set is always re-presented, just no longer
    // recorded, and a session always completes its SETS_PER_SESSION scored sets
    // no matter how often the tab is hidden.
    const resumeInterrupted = useCallback(() => {
        if (document.hidden) return; // wait for the tab to return
        if (!pendingRedoRef.current) {
            prepareSet(); // benign between-set gap — nothing was voided, spend no spare
            return;
        }
        pendingRedoRef.current = false;
        if (redoCountRef.current < T.SPARE_SETS) {
            redoCountRef.current += 1;
            prepareSet();
        } else {
            advanceAfterSet(); // out of redo budget — continue the session
        }
    }, [prepareSet, advanceAfterSet]);

    // --- Card presentation steps driven by the local timer ---
    const beginJudgment = useCallback(() => {
        judgedRef.current = false;
        setPhase(P.ODD_EVEN_JUDGMENT);
    }, [setPhase]);

    const timeOutJudgment = useCallback(() => {
        if (!judgedRef.current) {
            judgedRef.current = true;
            judgmentsRef.current.push({ correct: false, timedOut: true });
            setCumulativeJudgmentTotal((v) => v + 1);
        }
        setPhase(P.PROCESSING_TRANSITION);
    }, [setPhase]);

    const advanceCard = useCallback(() => {
        const set = currentSetRef.current;
        if (!set) return;
        const nextTrial = currentTrialIndexRef.current + 1;
        if (nextTrial < set.setSize) {
            currentTrialIndexRef.current = nextTrial;
            judgedRef.current = false;
            setCurrentTrialIndexInSet(nextTrial);
            setCurrentCard(set.cards[nextTrial] || null);
            setPhase(P.FIXATION);
        } else {
            const init = Array(set.setSize).fill(null);
            recallRef.current = init;
            setRecallValue(init);
            setPhase(P.RECALL);
        }
    }, [setPhase]);

    // --- Local phase timer (one live timeout; torn down on every phase change) ---
    useEffect(() => {
        if (isSubmittingRef.current) return undefined;
        let ms = null;
        let action = null;
        switch (currentPhase) {
            case P.FIXATION:
                ms = TIMING.FIXATION_MS; action = beginJudgment; break;
            case P.ODD_EVEN_JUDGMENT:
                ms = TIMING.JUDGMENT_WINDOW_MS; action = timeOutJudgment; break;
            case P.PROCESSING_TRANSITION:
                ms = TIMING.ITI_MS; action = advanceCard; break;
            case P.RECALL:
                ms = TIMING.RECALL_TIMEOUT_MS; action = () => scoreSet(true); break;
            // TP.SET_FEEDBACK deliberately has NO case: the feedback screen is
            // user-paced (continueAfterFeedback), never timed out.
            default:
                break;
        }
        if (ms === null) return undefined;
        const id = setTimeout(() => {
            timerRef.current = null;
            if (isSubmittingRef.current) return;
            action();
        }, ms);
        timerRef.current = id;
        return () => {
            clearTimeout(id);
            if (timerRef.current === id) timerRef.current = null;
        };
        // currentTrialIndexInSet / setNumber restart the timer for each new card
        // and each new set even when the phase name repeats.
    }, [currentPhase, currentTrialIndexInSet, setNumber, beginJudgment, timeOutJudgment, advanceCard, scoreSet]);

    // --- User odd/even response ---
    const recordJudgment = useCallback((userSaidOdd) => {
        if (phaseRef.current !== P.ODD_EVEN_JUDGMENT || judgedRef.current) return;
        if (isSubmittingRef.current) return;
        const set = currentSetRef.current;
        const card = set?.cards?.[currentTrialIndexRef.current];
        if (!card) return;
        judgedRef.current = true;
        const correct = (card.targetCount % 2 !== 0) === userSaidOdd;
        judgmentsRef.current.push({ correct, timedOut: false });
        setCumulativeJudgmentCorrect((v) => v + (correct ? 1 : 0));
        setCumulativeJudgmentTotal((v) => v + 1);
        setPhase(P.PROCESSING_TRANSITION);
    }, [setPhase]);

    // --- Recall ---
    const handleRecallChange = useCallback((newSequence) => {
        recallRef.current = newSequence;
        setRecallValue(newSequence);
    }, []);

    const submitRecall = useCallback(() => {
        if (phaseRef.current !== P.RECALL || setScoredRef.current || isSubmittingRef.current) return;
        scoreSet(false);
    }, [scoreSet]);

    // --- Public actions ---
    const initializeSession = useCallback(async () => {
        if (didInitRef.current) return;
        didInitRef.current = true;
        setIsLoading(true);
        setError(null);
        try {
            const getStructure = httpsCallable(functions, 'getCountingSpanTrainerStructure');
            const res = await getStructure({});
            const data = res.data || {};
            poolRef.current = (data.pool && typeof data.pool === 'object') ? data.pool : {};
            sizeRef.current = clampSetSize(data.startDifficulty);
            consecutiveCorrectRef.current = 0;
            completedRef.current = 0;
            setSetsCompleted(0);
            redoCountRef.current = 0;
            drawCountRef.current = {};
            trialsRef.current = [];
            sessionIdRef.current = makeSessionId();
            setCurrentLevel(Number.isFinite(data.level) ? data.level : sizeRef.current);
            setBestLevel(Number.isFinite(data.bestLevel) ? data.bestLevel : sizeRef.current);
            setCurrentSetSize(sizeRef.current);
            setIsReadyToStart(true);
        } catch (err) {
            console.error('[CountingSpanTrainer] init failed:', err);
            setError(err?.message || 'Could not start the trainer.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const startSession = useCallback(() => {
        if (!isReadyToStart) return;
        roundStreakRef.current = 0;
        bestRunRef.current = 0;
        pendingRedoRef.current = false;
        setRoundStreak(0);
        setCumulativeJudgmentCorrect(0);
        setCumulativeJudgmentTotal(0);
        sessionStartRef.current = Date.now();
        setIsReadyToStart(false);
        prepareSet();
    }, [isReadyToStart, prepareSet]);

    const handleExitTrainer = useCallback(() => {
        isSubmittingRef.current = true; // freeze the loop
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        if (onExit) onExit();
    }, [onExit]);

    // --- Interruption listener: tab hidden mid-presentation voids + redoes the set ---
    useEffect(() => {
        const onVis = () => {
            if (isSubmittingRef.current) return;
            if (document.hidden) {
                if (PRESENTATION_PHASES.includes(phaseRef.current)) voidCurrentSet();
            } else if (phaseRef.current === TP.INTERRUPTED) {
                resumeInterrupted();
            }
        };
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, [voidCurrentSet, resumeInterrupted]);

    // Belt-and-braces: never leave a timeout running after unmount.
    useEffect(() => () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    }, []);

    return {
        currentPhase, currentCard,
        currentTrialIndexInSet, currentSetSize, recallValue,
        setNumber, totalSets: T.SETS_PER_SESSION, setsCompleted,
        currentLevel, bestLevel, roundStreak,
        lastSetFeedback, lastSetCorrect,
        cumulativeJudgmentCorrect, cumulativeJudgmentTotal,
        isReadyToStart, isLoading, error, finalResults,
        initializeSession, startSession,
        recordJudgment, handleRecallChange, submitRecall, continueAfterFeedback, handleExitTrainer,
    };
};

export default useCountingSpanTrainerLogic;

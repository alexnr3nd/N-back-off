/* src/components/testing/operationSpan/trainer/hooks/useOperationSpanTrainerLogic.js */
/**
 * Session runner + client-side set-level staircase for the Operation Span
 * TRAINER. Reuses the shared useOperationSpanTimer (phase-driven, dynamic math
 * deadline) and the assessment's MathProblemDisplay / MathVerificationDisplay /
 * LetterDisplay / LetterRecallGrid UNTOUCHED. A trial == one recalled set
 * (equations interleaved with letters); a 2-down-1-up staircase walks the set
 * size (advance after 2 consecutive correct sets, drop after 1 miss) with a math
 * gate: a set only counts correct with perfect serial recall AND >= 75% of its
 * equations right, so recall can't be bought by skipping the math. On finish it
 * submits the full set record; the server re-scores and replays the staircase
 * authoritatively.
 *
 * Distinct from the assessment hook: no practice / calibration / cooldown; the
 * math deadline arrives pre-resolved from the server (last assessment
 * calibration, or a generous default); feedback after each set.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
    OSPAN_PHASES as P,
    OSPAN_TRAINER as T,
    OSPAN_TRAINER_PHASES as TP,
    nextSetSize, isSetCorrect,
} from '../../../../../constants/ospanTrainerConstants';
import { functions, httpsCallable } from '../../../../../firebaseConfig';

const PRESENTATION_PHASES = [P.FIXATION, P.MATH_PROBLEM, P.MATH_VERIFICATION, P.LETTER_DISPLAY];

const makeSessionId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `os_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const useOperationSpanTrainerLogic = ({ onExit, clearMathTimer, clearRecallTimer }) => {
    const [currentPhase, setCurrentPhase] = useState(P.INSTRUCTIONS);
    const [currentMathProblem, setCurrentMathProblem] = useState(null);
    const [currentLetter, setCurrentLetter] = useState(null);
    const [currentTrialIndexInSet, setCurrentTrialIndexInSet] = useState(-1);
    const [currentSetSize, setCurrentSetSize] = useState(T.START_SET_SIZE);
    const [recallValue, setRecallValue] = useState([]);
    const [setNumber, setSetNumber] = useState(0);
    const [currentLevel, setCurrentLevel] = useState(T.START_SET_SIZE); // current set size
    const [bestLevel, setBestLevel] = useState(T.START_SET_SIZE);
    const [roundStreak, setRoundStreak] = useState(0);
    const [lastSetFeedback, setLastSetFeedback] = useState({ correct: 0, total: 0 });
    const [lastSetCorrect, setLastSetCorrect] = useState(null);
    const [cumulativeMathCorrect, setCumulativeMathCorrect] = useState(0);
    const [cumulativeMathTotal, setCumulativeMathTotal] = useState(0);
    const [mathDeadlineMs, setMathDeadlineMs] = useState(null);
    const [isReadyToStart, setIsReadyToStart] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [finalResults, setFinalResults] = useState(null);

    const phaseRef = useRef(P.INSTRUCTIONS);
    const didInitRef = useRef(false);
    const poolRef = useRef({});
    const drawCountRef = useRef({});
    const sizeRef = useRef(T.START_SET_SIZE);
    const consecutiveCorrectRef = useRef(0);
    const currentSetRef = useRef(null);       // { setSize, letters, mathProblems, id }
    const currentTrialIndexRef = useRef(0);
    const mathTrialsRef = useRef([]);         // current set's [{ wasCorrect, timedOut }]
    const mathAnsweredRef = useRef(false);    // current equation already resolved
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
        const drawn = bucket[idx];
        currentSetRef.current = {
            setSize: size,
            letters: drawn.letters,
            mathProblems: drawn.mathProblems,
            id: `ospan_tr_${completedRef.current + 1}_${size}_${idx}`,
        };
        mathTrialsRef.current = [];
        mathAnsweredRef.current = false;
        setScoredRef.current = false;
        currentTrialIndexRef.current = 0;
        recallRef.current = [];
        setRecallValue([]);
        setCurrentSetSize(size);
        setCurrentTrialIndexInSet(0);
        setCurrentMathProblem(drawn.mathProblems[0]);
        setCurrentLetter(drawn.letters[0]);
        setLastSetCorrect(null);
        setSetNumber(Math.min(completedRef.current + 1, T.SETS_PER_SESSION));
        setPhase(P.FIXATION); // timer drives FIXATION -> MATH_PROBLEM
    }, [setPhase]);

    // --- Submission ---
    const submitResults = useCallback(async () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        if (clearMathTimer) clearMathTimer();
        if (clearRecallTimer) clearRecallTimer();
        setIsLoading(true);
        setPhase(P.SAVING);
        try {
            const submit = httpsCallable(functions, 'submitOspanTrainerResults');
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
            console.error('[OspanTrainer] submit failed:', err);
            setError(err?.message || 'Could not save this session. Your set size is unchanged.');
            setFinalResults({ error: true });
        } finally {
            setIsLoading(false);
            setPhase(P.RESULTS);
        }
    }, [setPhase, clearMathTimer, clearRecallTimer]);

    const advanceAfterSet = useCallback(() => {
        if (completedRef.current >= T.SETS_PER_SESSION) submitResults();
        else prepareSet();
    }, [prepareSet, submitResults]);

    // --- Score one set (recall submit or timeout) ---
    const scoreSet = useCallback((timedOut) => {
        if (setScoredRef.current || isSubmittingRef.current) return;
        setScoredRef.current = true;
        if (clearRecallTimer) clearRecallTimer();
        const set = currentSetRef.current;
        if (!set) return;
        // Preserve whatever was typed even on recall timeout (the assessment
        // does the same; recallTimedOut alone makes the set incorrect). The
        // recall grid uses a '_BLANK_' sentinel for forgotten positions — the
        // server only accepts single chars or null, so normalize here.
        const recalled = [...recallRef.current].map((l) => (typeof l === 'string' && l.length === 1 ? l : null));
        while (recalled.length < set.setSize) recalled.push(null);
        // Length invariant: mathTrials always padded to setSize (timeout path
        // records inline, but guard against any early recall entry).
        const mathTrials = [...mathTrialsRef.current];
        while (mathTrials.length < set.setSize) mathTrials.push({ wasCorrect: false, timedOut: false });
        const correct = isSetCorrect(set.letters, recalled, mathTrials, timedOut);

        let recallCorrectCount = 0;
        for (let i = 0; i < set.letters.length; i++) {
            if (recalled[i] === set.letters[i]) recallCorrectCount++;
        }

        if (trialsRef.current.length < T.SETS_PER_SESSION + T.SPARE_SETS) {
            trialsRef.current.push({
                id: set.id,
                setSize: set.setSize,
                targetLetters: [...set.letters],
                recalledLetters: recalled,
                mathTrials,
                recallTimedOut: !!timedOut,
            });
        }
        completedRef.current += 1;

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

        setLastSetFeedback({ correct: recallCorrectCount, total: set.setSize });
        setLastSetCorrect(correct);
        setPhase(P.SET_FEEDBACK); // timer advances after SET_FEEDBACK_MS
    }, [setPhase, clearRecallTimer]);

    // --- Interruption: void the in-flight set, redo at the same size ---
    const voidCurrentSet = useCallback(() => {
        if (setScoredRef.current || isSubmittingRef.current || !currentSetRef.current) return;
        setScoredRef.current = true;
        pendingRedoRef.current = true;
        const set = currentSetRef.current;
        // Cap interrupted records at the spare budget so all SETS_PER_SESSION
        // scored sets always fit inside the submission cap (8 + 3 = 11).
        const interruptedCount = trialsRef.current.filter((t) => t.interrupted).length;
        if (interruptedCount < T.SPARE_SETS) {
            const mathTrials = [...mathTrialsRef.current];
            while (mathTrials.length < set.setSize) mathTrials.push({ wasCorrect: false, timedOut: false });
            trialsRef.current.push({
                id: set.id,
                setSize: set.setSize,
                targetLetters: [...set.letters],
                recalledLetters: Array(set.setSize).fill(null),
                mathTrials,
                recallTimedOut: false,
                interrupted: true,
            });
        }
        setPhase(TP.INTERRUPTED); // phase change tears down any pending timer
    }, [setPhase]);

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

    // --- Timer-driven phase transitions (from useOperationSpanTimer) ---
    const advancePhase = useCallback((requestedNextPhase) => {
        if (isSubmittingRef.current) return;
        const current = phaseRef.current;

        // FIXATION finished -> show the equation (deadline starts)
        if (current === P.FIXATION && requestedNextPhase === P.MATH_PROBLEM) {
            mathAnsweredRef.current = false;
            setPhase(P.MATH_PROBLEM);
            return;
        }

        // Math deadline hit -> record a speed miss, show the letter
        if (current === P.MATH_PROBLEM && requestedNextPhase === P.LETTER_DISPLAY) {
            if (!mathAnsweredRef.current) {
                mathAnsweredRef.current = true;
                mathTrialsRef.current.push({ wasCorrect: false, timedOut: true });
                setCumulativeMathTotal((v) => v + 1);
            }
            setPhase(P.LETTER_DISPLAY);
            return;
        }

        // LETTER_DISPLAY finished -> next equation-letter pair or recall
        if (current === P.LETTER_DISPLAY && requestedNextPhase === P.FIXATION) {
            const set = currentSetRef.current;
            if (!set) return;
            const nextTrial = currentTrialIndexRef.current + 1;
            if (nextTrial < set.setSize) {
                currentTrialIndexRef.current = nextTrial;
                mathAnsweredRef.current = false;
                setCurrentTrialIndexInSet(nextTrial);
                setCurrentMathProblem(set.mathProblems[nextTrial]);
                setCurrentLetter(set.letters[nextTrial]);
                setPhase(P.FIXATION);
            } else {
                const init = Array(set.setSize).fill(null);
                recallRef.current = init;
                setRecallValue(init);
                setPhase(P.RECALL);
            }
            return;
        }

        // SET_FEEDBACK finished -> next set or submit
        if (current === P.SET_FEEDBACK && requestedNextPhase === P.FIXATION) {
            advanceAfterSet();
            return;
        }

        // Recall timed out -> score as a miss
        if (current === P.RECALL && requestedNextPhase === P.RECALL_TIMEOUT) {
            scoreSet(true);
            return;
        }
    }, [setPhase, advanceAfterSet, scoreSet]);

    // --- User math responses (reuse the assessment's two-step interaction) ---
    const recordMathSolved = useCallback(() => {
        if (phaseRef.current !== P.MATH_PROBLEM || mathAnsweredRef.current) return;
        if (clearMathTimer) clearMathTimer();
        setPhase(P.MATH_VERIFICATION); // untimed True/False judgment
    }, [setPhase, clearMathTimer]);

    const recordMathVerification = useCallback((userSaidTrue) => {
        if (phaseRef.current !== P.MATH_VERIFICATION || mathAnsweredRef.current) return;
        mathAnsweredRef.current = true;
        const problem = currentSetRef.current?.mathProblems?.[currentTrialIndexRef.current];
        const wasCorrect = userSaidTrue === (problem?.isCorrect === true);
        mathTrialsRef.current.push({ wasCorrect, timedOut: false });
        setCumulativeMathCorrect((v) => v + (wasCorrect ? 1 : 0));
        setCumulativeMathTotal((v) => v + 1);
        setPhase(P.LETTER_DISPLAY);
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
            const getStructure = httpsCallable(functions, 'getOspanTrainerStructure');
            const res = await getStructure({});
            const data = res.data || {};
            poolRef.current = (data.pool && typeof data.pool === 'object') ? data.pool : {};
            sizeRef.current = Number.isFinite(data.startDifficulty) ? data.startDifficulty : T.START_SET_SIZE;
            setMathDeadlineMs(
                (Number.isFinite(data.mathDeadlineMs) && data.mathDeadlineMs > 0)
                    ? data.mathDeadlineMs
                    : T.DEFAULT_MATH_DEADLINE_MS
            );
            consecutiveCorrectRef.current = 0;
            completedRef.current = 0;
            redoCountRef.current = 0;
            drawCountRef.current = {};
            trialsRef.current = [];
            sessionIdRef.current = makeSessionId();
            setCurrentLevel(Number.isFinite(data.level) ? data.level : sizeRef.current);
            setBestLevel(Number.isFinite(data.bestLevel) ? data.bestLevel : sizeRef.current);
            setCurrentSetSize(sizeRef.current);
            setIsReadyToStart(true);
        } catch (err) {
            console.error('[OspanTrainer] init failed:', err);
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
        setCumulativeMathCorrect(0);
        setCumulativeMathTotal(0);
        sessionStartRef.current = Date.now();
        setIsReadyToStart(false);
        prepareSet();
    }, [isReadyToStart, prepareSet]);

    const handleExitTrainer = useCallback(() => {
        isSubmittingRef.current = true; // freeze the loop
        if (clearMathTimer) clearMathTimer();
        if (clearRecallTimer) clearRecallTimer();
        if (onExit) onExit();
    }, [onExit, clearMathTimer, clearRecallTimer]);

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

    return {
        currentPhase, currentMathProblem, currentLetter,
        currentTrialIndexInSet, currentSetSize, recallValue,
        setNumber, totalSets: T.SETS_PER_SESSION,
        currentLevel, bestLevel, roundStreak,
        lastSetFeedback, lastSetCorrect,
        cumulativeMathCorrect, cumulativeMathTotal,
        mathDeadlineMs,
        isReadyToStart, isLoading, error, finalResults,
        initializeSession, startSession, advancePhase,
        recordMathSolved, recordMathVerification,
        handleRecallChange, submitRecall, handleExitTrainer,
    };
};

export default useOperationSpanTrainerLogic;

/* src/components/testing/operationSpan/hooks/useOperationSpanLogic.js */
import { useState, useCallback, useMemo, useRef } from 'react';
import { useUser } from '../../../../contexts/UserContext';
import { OSPAN_PHASES, OSPAN_DEFAULTS } from '../../../../constants/ospanConstants';
import { CST_TEST_TYPES } from '../../../../constants/cstConstants';
import { getLastCalibrationDeadline } from '../../../../utils/assessmentCalibration';
import { functions, httpsCallable } from '../../../../firebaseConfig';

// --- Client-side math problem generation (for practice only) ---
const VALID_DIV_PAIRS = (() => {
    const pairs = [];
    for (let b = 1; b <= 9; b++) {
        for (let a = b; a <= 9; a += b) pairs.push({ a, b });
    }
    return pairs;
})();

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateLocalMathProblem = (showCorrect) => {
    for (let attempt = 0; attempt < 50; attempt++) {
        const useMul = Math.random() < 0.5;
        let a, b, firstResult;
        if (useMul) {
            a = randInt(1, 9); b = randInt(1, 9); firstResult = a * b;
        } else {
            const pair = VALID_DIV_PAIRS[Math.floor(Math.random() * VALID_DIV_PAIRS.length)];
            a = pair.a; b = pair.b; firstResult = a / b;
        }
        const useAdd = Math.random() < 0.5;
        const c = randInt(1, 9);
        const result = useAdd ? firstResult + c : firstResult - c;
        if (result < 0 || result > 9) continue;

        const op1 = useMul ? '\u00d7' : '\u00f7';
        const op2 = useAdd ? '+' : '\u2212';
        const displayText = `(${a} ${op1} ${b}) ${op2} ${c}`;

        let proposedAnswer = result;
        if (!showCorrect) {
            const offset = randInt(1, 4) * (Math.random() < 0.5 ? 1 : -1);
            proposedAnswer = result + offset;
            if (proposedAnswer === result) proposedAnswer = result + 1;
            if (proposedAnswer < 0) proposedAnswer = result + Math.abs(offset);
        }

        return { displayText, correctAnswer: result, proposedAnswer, isCorrect: showCorrect };
    }
    return { displayText: '(2 \u00d7 3) + 1', correctAnswer: 7, proposedAnswer: showCorrect ? 7 : 9, isCorrect: showCorrect };
};

const generateLocalLetterSequence = (size) => {
    const pool = [...OSPAN_DEFAULTS.LETTER_POOL];
    const selected = [];
    for (let i = 0; i < size && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        selected.push(pool.splice(idx, 1)[0]);
    }
    return selected;
};

// --- localStorage helpers for offline resilience ---
const PENDING_KEY_PREFIX = 'ospan_pending_results_';
const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const savePendingResults = (userId, payload) => {
    try {
        const key = `${PENDING_KEY_PREFIX}${userId}`;
        localStorage.setItem(key, JSON.stringify({ ...payload, savedAt: Date.now() }));
        console.log('[OSPAN] Saved pending results to localStorage');
    } catch (e) {
        console.warn('[OSPAN] Failed to save pending results to localStorage:', e);
    }
};

const getPendingResults = (userId) => {
    try {
        const key = `${PENDING_KEY_PREFIX}${userId}`;
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (Date.now() - data.savedAt > PENDING_MAX_AGE_MS) {
            localStorage.removeItem(key);
            return null;
        }
        return data;
    } catch (e) {
        return null;
    }
};

const clearPendingResults = (userId) => {
    try {
        localStorage.removeItem(`${PENDING_KEY_PREFIX}${userId}`);
    } catch (e) { /* ignore */ }
};

/**
 * Core logic hook for the Operation Span assessment.
 *
 * Session types:
 * - Familiarization: practice phases only → submit practice data → results
 * - Scored: practice phases → READY_ASSESSMENT → 15-set assessment → results
 */
const useOperationSpanLogic = (onTaskComplete, clearMathTimer, clearRecallTimer, options = {}) => {
    const { earlyRetake = false, onExit } = options;
    const { userId, userData } = useUser();

    // --- Core State ---
    const [currentPhase, setCurrentPhase] = useState(OSPAN_PHASES.INSTRUCTIONS);
    const [testStructure, setTestStructure] = useState([]);
    const [currentSetIndex, setCurrentSetIndex] = useState(-1);
    const [currentTrialIndexInSet, setCurrentTrialIndexInSet] = useState(-1);

    // --- Practice State ---
    const [isPractice, setIsPractice] = useState(false);
    const [practicePhase, setPracticePhase] = useState(null);
    const [practiceSetNum, setPracticeSetNum] = useState(0);
    const [practiceMathProblems, setPracticeMathProblems] = useState([]);
    const [practiceLetters, setPracticeLetters] = useState([]);

    // --- Practice Data Collection (for familiarization diagnostics) ---
    const practiceLetterResultsRef = useRef([]);
    const practiceCombinedResultsRef = useRef([]);
    const practiceMathAccuracyRef = useRef({ correct: 0, total: 0 });

    // --- Math Calibration ---
    const [mathCalibrationRTs, setMathCalibrationRTs] = useState([]);
    const [mathDeadlineMs, setMathDeadlineMs] = useState(null);
    // Most recent stored deadline from prior sessions (familiarization included);
    // used when practice is skipped before this session's calibration block runs.
    const storedDeadline = useMemo(
        () => getLastCalibrationDeadline(userData?.cstHistory, CST_TEST_TYPES.OPERATION_SPAN, 'mathCalibrationDeadlineMs'),
        [userData]
    );

    // --- Current Trial Data ---
    const [currentMathProblem, setCurrentMathProblem] = useState(null);
    const [currentLetter, setCurrentLetter] = useState(null);
    const mathStartTimeRef = useRef(null);
    const mathResponseRecordedRef = useRef(false);

    // --- Set-Level Data ---
    const [targetLettersForSet, setTargetLettersForSet] = useState([]);
    const [mathTrialsForSet, setMathTrialsForSet] = useState([]);
    const [intermediateRecallSequence, setIntermediateRecallSequence] = useState([]);
    const intermediateRecallSequenceRef = useRef([]);

    // --- Cumulative Math Accuracy ---
    const [cumulativeMathCorrect, setCumulativeMathCorrect] = useState(0);
    const [cumulativeMathTotal, setCumulativeMathTotal] = useState(0);

    // --- Per-Set Feedback (just-completed set's recall accuracy) ---
    const [lastSetFeedback, setLastSetFeedback] = useState({ correct: 0, total: 0 });

    // --- Results ---
    const allSetResultsRef = useRef([]);
    const [finalScorePCU, setFinalScorePCU] = useState(0);
    const [finalScoreEditDistance, setFinalScoreEditDistance] = useState(0);
    const [finalProcessingAccuracy, setFinalProcessingAccuracy] = useState(0);
    const [flaggedLowAccuracy, setFlaggedLowAccuracy] = useState(false);
    const [isFamiliarization, setIsFamiliarization] = useState(false);
    const [notEligibleMessage, setNotEligibleMessage] = useState(null);

    // --- Utility ---
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [feedback, setFeedback] = useState('');

    // --- Derived State ---
    const currentSet = useMemo(() => {
        if (currentSetIndex >= 0 && currentSetIndex < testStructure.length) {
            return testStructure[currentSetIndex];
        }
        return null;
    }, [testStructure, currentSetIndex]);

    const currentSetSize = useMemo(() => {
        if (isPractice) {
            if (practicePhase === 'letter') return OSPAN_DEFAULTS.PRACTICE_LETTER_SET_SIZES[practiceSetNum] || 2;
            if (practicePhase === 'combined') return OSPAN_DEFAULTS.PRACTICE_COMBINED_SET_SIZE;
            if (practicePhase === 'math') return 1;
            return 0;
        }
        return currentSet?.setSize || 0;
    }, [isPractice, practicePhase, practiceSetNum, currentSet]);

    // --- Prepare Set Data ---
    const prepareNextSet = useCallback((setIndex, opts = {}) => {
        const mode = opts.mode || (isPractice ? 'practice' : 'assessment');
        const phase = opts.phase || practicePhase;
        const structure = opts.structure || testStructure;

        if (mode === 'practice') {
            if (phase === 'letter') {
                const size = OSPAN_DEFAULTS.PRACTICE_LETTER_SET_SIZES[setIndex] || 2;
                const letters = generateLocalLetterSequence(size);
                setPracticeLetters(letters);
                setTargetLettersForSet(letters);
                const initSeq = Array(size).fill(null);
                setIntermediateRecallSequence(initSeq);
                intermediateRecallSequenceRef.current = initSeq;
                setCurrentTrialIndexInSet(0);
                setMathTrialsForSet([]);
                setCurrentLetter(letters[0]);
                return true;
            }
            if (phase === 'combined') {
                const size = OSPAN_DEFAULTS.PRACTICE_COMBINED_SET_SIZE;
                const letters = generateLocalLetterSequence(size);
                const problems = Array.from({ length: size }, () => generateLocalMathProblem(Math.random() < 0.5));
                setPracticeLetters(letters);
                setPracticeMathProblems(problems);
                setTargetLettersForSet(letters);
                const initSeq2 = Array(size).fill(null);
                setIntermediateRecallSequence(initSeq2);
                intermediateRecallSequenceRef.current = initSeq2;
                setMathTrialsForSet([]);
                setCurrentTrialIndexInSet(0);
                setCurrentMathProblem(problems[0]);
                setCurrentLetter(letters[0]);
                mathStartTimeRef.current = null;
                mathResponseRecordedRef.current = false;
                return true;
            }
            return true;
        }

        // Assessment: read from cached structure
        if (setIndex < 0 || setIndex >= structure.length) {
            setError('Invalid set index.');
            return false;
        }
        const setData = structure[setIndex];
        setTargetLettersForSet(setData.letters);
        const initSeqAssess = Array(setData.setSize).fill(null);
        setIntermediateRecallSequence(initSeqAssess);
        intermediateRecallSequenceRef.current = initSeqAssess;
        setMathTrialsForSet([]);
        setCurrentTrialIndexInSet(0);
        setCurrentMathProblem(setData.mathProblems[0]);
        setCurrentLetter(setData.letters[0]);
        mathStartTimeRef.current = null;
        mathResponseRecordedRef.current = false;
        return true;
    }, [isPractice, practicePhase, testStructure]);

    // --- Initialize Session (called on mount) ---
    // Fetches eligibility + structure BEFORE practice starts (fresh App Check tokens).
    const initializeSession = useCallback(async () => {
        console.log('[OSPAN] Initializing session...');
        setIsLoading(true);
        setError(null);

        try {
            const checkElig = httpsCallable(functions, 'checkOspanEligibility');
            const eligResult = await checkElig({});
            const data = eligResult.data;
            const isFamiliar = !data.familiarizationComplete;
            setIsFamiliarization(isFamiliar);
            console.log(`[OSPAN] Session type: ${isFamiliar ? 'familiarization' : 'scored'}. Eligible: ${data.isEligible}`);

            if (data.familiarizationComplete && !data.isEligible && !earlyRetake) {
                // Not eligible AND not an explicitly-confirmed early retake — bail out, don't start practice.
                // When earlyRetake is true the user confirmed the early-retake prompt on the summary page, so we
                // proceed normally; getOspanStructure(forceStart) and submitOspanResults(forceSubmit) below
                // carry the bypass, which the backend already honors.
                setNotEligibleMessage(data.nextAvailableDateString || 'You are not eligible for a new assessment yet.');
                setIsLoading(false);
                setCurrentPhase(OSPAN_PHASES.RESULTS);
                return;
            }

            // For scored sessions, pre-fetch structure (stimuli for all 15 sets)
            if (!isFamiliar) {
                const getStructure = httpsCallable(functions, 'getOspanStructure');
                const structResult = await getStructure({ forceStart: earlyRetake });
                if (!structResult.data?.sets?.length) throw new Error('Invalid test structure received.');
                setTestStructure(structResult.data.sets);
                console.log(`[OSPAN] Pre-fetched ${structResult.data.sets.length} sets`);
            }

            // Start practice
            setIsLoading(false);
            setIsPractice(true);
            setPracticePhase('letter');
            setPracticeSetNum(0);
            practiceLetterResultsRef.current = [];
            practiceCombinedResultsRef.current = [];
            practiceMathAccuracyRef.current = { correct: 0, total: 0 };
            prepareNextSet(0, { mode: 'practice', phase: 'letter' });
            setCurrentPhase(OSPAN_PHASES.FIXATION);

        } catch (err) {
            console.error('[OSPAN] Init error:', err);
            setError(`Failed to initialize: ${err.message}`);
            setIsLoading(false);
            setCurrentPhase(OSPAN_PHASES.RESULTS);
        }
    }, [prepareNextSet, earlyRetake]);

    // --- Start Scored Assessment (uses cached structure, no backend calls) ---
    const startAssessment = useCallback(() => {
        console.log('[OSPAN] Starting scored assessment with cached structure...');
        setIsPractice(false);
        setPracticePhase(null);
        allSetResultsRef.current = [];
        setError(null);
        setFeedback('');
        setCumulativeMathCorrect(0);
        setCumulativeMathTotal(0);

        setCurrentSetIndex(0);
        const ok = prepareNextSet(0, { mode: 'assessment' });
        if (!ok) {
            setError('Failed to prepare first set.');
            setCurrentPhase(OSPAN_PHASES.RESULTS);
            return;
        }
        setCurrentPhase(OSPAN_PHASES.FIXATION);
    }, [prepareNextSet]);

    // --- Submit Familiarization (practice-only, no scored sets) ---
    const submitFamiliarization = useCallback(async () => {
        console.log('[OSPAN] Submitting familiarization record...');
        setIsLoading(true);
        setCurrentPhase(OSPAN_PHASES.SAVING);

        if (!userId) {
            setError('No user ID.'); setIsLoading(false); setCurrentPhase(OSPAN_PHASES.RESULTS); return;
        }

        const practiceData = {
            mathRTs: mathCalibrationRTs,
            mathAccuracy: practiceMathAccuracyRef.current.total > 0
                ? (practiceMathAccuracyRef.current.correct / practiceMathAccuracyRef.current.total)
                : null,
            letterRecallResults: practiceLetterResultsRef.current,
            combinedRecallResults: practiceCombinedResultsRef.current,
        };

        try {
            const submitFunc = httpsCallable(functions, 'submitOspanResults');
            const result = await submitFunc({
                isFamiliarization: true,
                setResults: [],
                mathCalibrationDeadlineMs: mathDeadlineMs,
                practiceData,
            });
            if (result.data?.success) {
                setFeedback('Familiarization complete! You can now take the scored assessment.');
                if (onTaskComplete) onTaskComplete();
            } else {
                throw new Error(result.data?.message || 'Submission failed.');
            }
        } catch (err) {
            console.error('[OSPAN] Familiarization submit error:', err);
            setError(`Failed to save: ${err.message}`);
        } finally {
            setIsLoading(false);
            setCurrentPhase(OSPAN_PHASES.RESULTS);
        }
    }, [userId, mathDeadlineMs, mathCalibrationRTs, onTaskComplete]);

    // --- Record Math Response ---
    const recordMathSolved = useCallback(() => {
        if (currentPhase !== OSPAN_PHASES.MATH_PROBLEM || mathResponseRecordedRef.current) return;
        mathResponseRecordedRef.current = true;
        if (clearMathTimer) clearMathTimer();

        const rt = mathStartTimeRef.current ? performance.now() - mathStartTimeRef.current : 0;

        if (isPractice && practicePhase === 'math') {
            setMathCalibrationRTs(prev => [...prev, rt]);
        }

        setMathTrialsForSet(prev => [...prev, {
            problemText: currentMathProblem?.displayText || '',
            correctAnswer: currentMathProblem?.correctAnswer,
            proposedAnswer: currentMathProblem?.proposedAnswer,
            isCorrect: currentMathProblem?.isCorrect,
            reactionTimeMs: Math.round(rt),
            timedOut: false,
            userSaidTrue: null,
            wasCorrect: null,
        }]);

        setCurrentPhase(OSPAN_PHASES.MATH_VERIFICATION);
    }, [currentPhase, isPractice, practicePhase, currentMathProblem, clearMathTimer]);

    // --- Record Math Verification ---
    const recordMathVerification = useCallback((userSaidTrue) => {
        if (currentPhase !== OSPAN_PHASES.MATH_VERIFICATION) return;

        const wasCorrect = userSaidTrue === currentMathProblem?.isCorrect;
        setCumulativeMathCorrect(prev => prev + (wasCorrect ? 1 : 0));
        setCumulativeMathTotal(prev => prev + 1);

        // Track practice math accuracy for diagnostics
        if (isPractice && (practicePhase === 'math' || practicePhase === 'combined')) {
            practiceMathAccuracyRef.current.total++;
            if (wasCorrect) practiceMathAccuracyRef.current.correct++;
        }

        setMathTrialsForSet(prev => {
            const updated = [...prev];
            if (updated.length > 0) {
                updated[updated.length - 1] = { ...updated[updated.length - 1], userSaidTrue, wasCorrect };
            }
            return updated;
        });

        // Math-only practice: next problem or finish calibration
        if (isPractice && practicePhase === 'math') {
            const nextProblemIndex = mathCalibrationRTs.length;
            if (nextProblemIndex < OSPAN_DEFAULTS.PRACTICE_MATH_COUNT) {
                const problem = generateLocalMathProblem(Math.random() < 0.5);
                setCurrentMathProblem(problem);
                mathStartTimeRef.current = null;
                mathResponseRecordedRef.current = false;
                setCurrentPhase(OSPAN_PHASES.FIXATION);
            } else {
                // Calibration complete
                const rts = mathCalibrationRTs;
                if (rts.length > 0) {
                    const mean = rts.reduce((s, v) => s + v, 0) / rts.length;
                    const variance = rts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / rts.length;
                    const sd = Math.sqrt(variance);
                    let deadline = mean + OSPAN_DEFAULTS.MATH_CALIBRATION_SD_MULTIPLIER * sd;
                    deadline = Math.max(OSPAN_DEFAULTS.MATH_DEADLINE_FLOOR_MS, deadline);
                    deadline = Math.min(OSPAN_DEFAULTS.MATH_DEADLINE_CEILING_MS, deadline);
                    setMathDeadlineMs(Math.round(deadline));
                    console.log(`[OSPAN] Calibrated deadline: ${Math.round(deadline)}ms (mean=${Math.round(mean)}, sd=${Math.round(sd)})`);
                } else {
                    setMathDeadlineMs(OSPAN_DEFAULTS.MATH_DEADLINE_CEILING_MS);
                }
                setFeedback('Math practice complete. Your time limit has been calibrated.');
                setCurrentPhase(OSPAN_PHASES.PRACTICE_FEEDBACK);
            }
            return;
        }

        // Normal flow: show letter
        setCurrentPhase(OSPAN_PHASES.LETTER_DISPLAY);
    }, [currentPhase, currentMathProblem, isPractice, practicePhase, mathCalibrationRTs]);

    // --- Handle Math Timeout ---
    const handleMathTimeout = useCallback(() => {
        if (currentPhase !== OSPAN_PHASES.MATH_PROBLEM) return;
        mathResponseRecordedRef.current = true;

        const rt = mathStartTimeRef.current ? performance.now() - mathStartTimeRef.current : 0;
        setCumulativeMathTotal(prev => prev + 1);

        if (isPractice && (practicePhase === 'math' || practicePhase === 'combined')) {
            practiceMathAccuracyRef.current.total++;
        }

        setMathTrialsForSet(prev => [...prev, {
            problemText: currentMathProblem?.displayText || '',
            correctAnswer: currentMathProblem?.correctAnswer,
            proposedAnswer: currentMathProblem?.proposedAnswer,
            isCorrect: currentMathProblem?.isCorrect,
            reactionTimeMs: Math.round(rt),
            timedOut: true,
            userSaidTrue: null,
            wasCorrect: false,
        }]);
    }, [currentPhase, currentMathProblem, isPractice, practicePhase]);

    // --- Submit Final Results (scored assessment) ---
    const submitFinalResults = useCallback(async (resultsData, familiarizationStatus) => {
        const dataToSubmit = resultsData ?? allSetResultsRef.current;
        console.log(`[OSPAN] Submitting ${dataToSubmit.length} sets. Familiarization: ${familiarizationStatus}`);
        setIsLoading(true);
        setError(null);

        if (!userId) {
            setError('No user ID.'); setIsLoading(false); setCurrentPhase(OSPAN_PHASES.RESULTS); return;
        }

        const payload = {
            isFamiliarization: familiarizationStatus,
            setResults: dataToSubmit,
            mathCalibrationDeadlineMs: mathDeadlineMs,
            ...(earlyRetake && { forceSubmit: true }),
        };

        try {
            const submitFunc = httpsCallable(functions, 'submitOspanResults');
            const result = await submitFunc(payload);

            if (result.data?.success) {
                setFinalScorePCU(result.data.finalScorePCU ?? 0);
                setFinalScoreEditDistance(result.data.finalScoreEditDistance ?? 0);
                setFinalProcessingAccuracy(result.data.finalProcessingAccuracy ?? 0);
                setFlaggedLowAccuracy(result.data.flaggedLowAccuracy ?? false);
                clearPendingResults(userId);
                if (onTaskComplete) onTaskComplete();
            } else {
                throw new Error(result.data?.message || 'Submission failed.');
            }
        } catch (err) {
            console.error('[OSPAN] Submit error:', err);
            if (err.code !== 'functions/invalid-argument' && err.code !== 'functions/permission-denied') {
                savePendingResults(userId, payload);
                setError('Results saved locally. They will be submitted when you return to the assessment page.');
            } else {
                setError(`Failed to save results: ${err.message}`);
            }
            setFinalScorePCU(0); setFinalScoreEditDistance(0);
            setFinalProcessingAccuracy(0); setFlaggedLowAccuracy(false);
        } finally {
            setIsLoading(false);
            setCurrentPhase(OSPAN_PHASES.RESULTS);
        }
    }, [userId, mathDeadlineMs, onTaskComplete, earlyRetake]);

    // --- Process Set and Advance ---
    const processAndAdvanceSet = useCallback(async (recallTimedOut = false) => {
        // Read from ref to avoid stale closure issues with recall sequence
        const recalled = [...intermediateRecallSequenceRef.current];

        if (isPractice) {
            const target = targetLettersForSet;
            let correctCount = 0;
            for (let i = 0; i < target.length; i++) {
                if (recalled[i] === target[i]) correctCount++;
            }

            if (practicePhase === 'letter') {
                practiceLetterResultsRef.current.push({ setSize: target.length, correct: correctCount });
            } else if (practicePhase === 'combined') {
                practiceCombinedResultsRef.current.push({ setSize: target.length, correct: correctCount });
            }

            setFeedback(`Recall: ${correctCount}/${target.length} correct. ${recallTimedOut ? '(Timed out)' : ''}`);
            setCurrentPhase(OSPAN_PHASES.PRACTICE_FEEDBACK);
            return;
        }

        // Assessment: compute per-set recall accuracy (mirrors backend PCU) before advancing
        const target = targetLettersForSet;
        let correctCount = 0;
        for (let i = 0; i < target.length; i++) {
            if (recalled[i] === target[i]) correctCount++;
        }
        setLastSetFeedback({ correct: correctCount, total: target.length });

        const resultSetData = {
            setId: currentSet?.id,
            setSize: currentSet?.setSize,
            targetLetters: [...targetLettersForSet],
            recalledLetters: recalled,
            mathTrials: [...mathTrialsForSet],
            recallTimedOut,
        };
        allSetResultsRef.current.push(resultSetData);

        const nextSetIndex = currentSetIndex + 1;
        if (nextSetIndex < testStructure.length) {
            setCurrentSetIndex(nextSetIndex);
            prepareNextSet(nextSetIndex);
            setCurrentPhase(OSPAN_PHASES.SET_FEEDBACK);
        } else {
            setCurrentPhase(OSPAN_PHASES.SAVING);
            await submitFinalResults(null, isFamiliarization);
        }
    }, [isPractice, practicePhase, targetLettersForSet, mathTrialsForSet, currentSet, currentSetIndex, testStructure, prepareNextSet, isFamiliarization, submitFinalResults]);

    // --- Submit Recall ---
    const submitRecall = useCallback(() => {
        if (currentPhase !== OSPAN_PHASES.RECALL) return;
        if (clearRecallTimer) clearRecallTimer();
        processAndAdvanceSet(false);
    }, [currentPhase, clearRecallTimer, processAndAdvanceSet]);

    // --- Recall Change Handler ---
    const handleRecallChange = useCallback((newSequence) => {
        setIntermediateRecallSequence(newSequence);
        intermediateRecallSequenceRef.current = newSequence;
    }, []);

    // --- Phase Transition Logic ---
    const advancePhase = useCallback((requestedNextPhase) => {
        const current = currentPhase;

        // LETTER_DISPLAY finished -> next trial or recall
        if (current === OSPAN_PHASES.LETTER_DISPLAY && requestedNextPhase === OSPAN_PHASES.FIXATION) {
            const nextTrial = currentTrialIndexInSet + 1;
            const setSize = isPractice
                ? (practicePhase === 'combined' ? OSPAN_DEFAULTS.PRACTICE_COMBINED_SET_SIZE : targetLettersForSet.length)
                : (currentSet?.setSize || 0);

            if (nextTrial < setSize) {
                setCurrentTrialIndexInSet(nextTrial);
                mathResponseRecordedRef.current = false;
                if (isPractice && practicePhase === 'combined') {
                    setCurrentMathProblem(practiceMathProblems[nextTrial]);
                    setCurrentLetter(practiceLetters[nextTrial]);
                } else if (!isPractice && currentSet) {
                    setCurrentMathProblem(currentSet.mathProblems[nextTrial]);
                    setCurrentLetter(currentSet.letters[nextTrial]);
                }
                mathStartTimeRef.current = null;
                setCurrentPhase(OSPAN_PHASES.FIXATION);
            } else {
                setCurrentPhase(OSPAN_PHASES.RECALL);
            }
            return;
        }

        // FIXATION finished -> show math or letter
        if (current === OSPAN_PHASES.FIXATION && requestedNextPhase === OSPAN_PHASES.MATH_PROBLEM) {
            if (isPractice && practicePhase === 'letter') {
                setCurrentLetter(practiceLetters[currentTrialIndexInSet]);
                setCurrentPhase(OSPAN_PHASES.LETTER_DISPLAY);
                return;
            }
            if (isPractice && practicePhase === 'math') {
                mathStartTimeRef.current = performance.now();
                mathResponseRecordedRef.current = false;
                setCurrentPhase(OSPAN_PHASES.MATH_PROBLEM);
                return;
            }
            mathStartTimeRef.current = performance.now();
            mathResponseRecordedRef.current = false;
            setCurrentPhase(OSPAN_PHASES.MATH_PROBLEM);
            return;
        }

        if (current === OSPAN_PHASES.MATH_PROBLEM && requestedNextPhase === OSPAN_PHASES.LETTER_DISPLAY) {
            handleMathTimeout();
            setCurrentPhase(OSPAN_PHASES.LETTER_DISPLAY);
            return;
        }

        if (current === OSPAN_PHASES.SET_FEEDBACK && requestedNextPhase === OSPAN_PHASES.FIXATION) {
            setCurrentPhase(OSPAN_PHASES.FIXATION);
            return;
        }

        if (current === OSPAN_PHASES.RECALL && requestedNextPhase === OSPAN_PHASES.RECALL_TIMEOUT) {
            processAndAdvanceSet(true);
            return;
        }

        if (current !== requestedNextPhase) {
            setCurrentPhase(requestedNextPhase);
        }
    }, [currentPhase, currentTrialIndexInSet, isPractice, practicePhase, currentSet, targetLettersForSet, practiceMathProblems, practiceLetters, handleMathTimeout, processAndAdvanceSet]);

    // --- Practice Flow ---
    const startMathPractice = useCallback(() => {
        setIsPractice(true);
        setPracticePhase('math');
        setMathCalibrationRTs([]);
        setError(null);
        setFeedback('');
        const problem = generateLocalMathProblem(Math.random() < 0.5);
        setCurrentMathProblem(problem);
        mathStartTimeRef.current = null;
        mathResponseRecordedRef.current = false;
        setCurrentPhase(OSPAN_PHASES.FIXATION);
    }, []);

    const startCombinedPractice = useCallback(() => {
        setIsPractice(true);
        setPracticePhase('combined');
        setPracticeSetNum(0);
        setError(null);
        setFeedback('');
        prepareNextSet(0, { mode: 'practice', phase: 'combined' });
        setCurrentPhase(OSPAN_PHASES.FIXATION);
    }, [prepareNextSet]);

    const continuePractice = useCallback(() => {
        if (practicePhase === 'letter') {
            const nextSet = practiceSetNum + 1;
            if (nextSet < OSPAN_DEFAULTS.PRACTICE_LETTER_SET_SIZES.length) {
                setPracticeSetNum(nextSet);
                prepareNextSet(nextSet, { mode: 'practice', phase: 'letter' });
                setCurrentPhase(OSPAN_PHASES.FIXATION);
            } else {
                startMathPractice();
            }
        } else if (practicePhase === 'math') {
            startCombinedPractice();
        } else if (practicePhase === 'combined') {
            const nextSet = practiceSetNum + 1;
            if (nextSet < OSPAN_DEFAULTS.PRACTICE_COMBINED_SETS) {
                setPracticeSetNum(nextSet);
                prepareNextSet(nextSet, { mode: 'practice', phase: 'combined' });
                setCurrentPhase(OSPAN_PHASES.FIXATION);
            } else {
                // Practice complete
                setIsPractice(false);
                setPracticePhase(null);
                if (isFamiliarization) {
                    // Familiarization: submit practice data and finish
                    submitFamiliarization();
                } else {
                    // Scored: show ready screen before assessment
                    setCurrentPhase(OSPAN_PHASES.READY_ASSESSMENT);
                }
            }
        }
    }, [practicePhase, practiceSetNum, prepareNextSet, startMathPractice, startCombinedPractice, isFamiliarization, submitFamiliarization]);

    // Skip the rest of practice (button shown on scored sessions only, and only
    // when a math deadline source exists). The deadline is the one piece of
    // session state practice produces: keep the fresh calibration if the math
    // block completed this session, otherwise fall back to the most recent
    // stored one. Mirrors handleExitAssessment's timer teardown; testStructure
    // and allSetResultsRef are session-scoped and must survive.
    const skipPractice = useCallback(() => {
        if (!isPractice || isFamiliarization) return;
        if (clearMathTimer) clearMathTimer();
        if (clearRecallTimer) clearRecallTimer();
        if (mathDeadlineMs === null && storedDeadline !== null) {
            setMathDeadlineMs(storedDeadline);
        }
        setMathCalibrationRTs([]);
        mathStartTimeRef.current = null;
        mathResponseRecordedRef.current = false;
        setCurrentMathProblem(null);
        setCurrentLetter(null);
        setIsPractice(false);
        setPracticePhase(null);
        setCurrentPhase(OSPAN_PHASES.READY_ASSESSMENT);
    }, [isPractice, isFamiliarization, mathDeadlineMs, storedDeadline, clearMathTimer, clearRecallTimer]);

    // --- Dev Skip ---
    const handleDevSkipTask = useCallback(async () => {
        if (process.env.NODE_ENV !== 'development') return;
        setIsLoading(true);
        setError(null);
        try {
            // Use cached isFamiliarization from initializeSession
            if (isFamiliarization) {
                await submitFamiliarization();
            } else {
                const fakeResults = (testStructure.length > 0 ? testStructure : [
                    { id: 'dev_1', setSize: 3 }, { id: 'dev_2', setSize: 4 }, { id: 'dev_3', setSize: 5 },
                ]).map((setInfo) => {
                    const size = setInfo.setSize || 3;
                    const letters = generateLocalLetterSequence(size);
                    const recalled = letters.map(l => Math.random() < 0.8 ? l : OSPAN_DEFAULTS.LETTER_POOL[0]);
                    const mathTrials = Array.from({ length: size }, () => ({
                        problemText: '(2 \u00d7 3) + 1', correctAnswer: 7, proposedAnswer: 7,
                        isCorrect: true, userSaidTrue: true, wasCorrect: true,
                        reactionTimeMs: Math.floor(Math.random() * 2000) + 1000, timedOut: false,
                    }));
                    return { setId: setInfo.id, setSize: size, targetLetters: letters, recalledLetters: recalled, mathTrials, recallTimedOut: false };
                });
                setCurrentPhase(OSPAN_PHASES.SAVING);
                await submitFinalResults(fakeResults, false);
            }
        } catch (err) {
            setError(`Skip failed: ${err.message}`);
            setIsLoading(false);
            setCurrentPhase(OSPAN_PHASES.RESULTS);
        }
    }, [testStructure, submitFinalResults, submitFamiliarization, isFamiliarization]);

    // --- Early Exit ---
    const handleExitAssessment = useCallback(async () => {
        if (clearMathTimer) clearMathTimer();
        if (clearRecallTimer) clearRecallTimer();

        if (isFamiliarization) {
            // Familiarization exit: navigate back without submitting (no scored data to save)
            if (onExit) onExit();
        } else if (allSetResultsRef.current.length === 0) {
            // Scored exit with no completed sets: skip submission, just navigate back
            if (onExit) onExit();
        } else {
            // Scored exit with partial results: submit what we have
            setIsLoading(true);
            setError(null);
            setCurrentPhase(OSPAN_PHASES.SAVING);
            await submitFinalResults(allSetResultsRef.current, false);
        }
    }, [submitFinalResults, isFamiliarization, clearMathTimer, clearRecallTimer, onExit]);

    return {
        // State
        currentPhase, currentSet, currentTrialIndexInSet,
        currentMathProblem, currentLetter,
        isLoading, error, isPractice, practicePhase, setSize: currentSetSize,
        testStructure, currentSetIndex, feedback, intermediateRecallSequence,
        mathDeadlineMs, storedDeadline, notEligibleMessage,
        cumulativeMathCorrect, cumulativeMathTotal,
        lastSetFeedback,
        // Results
        finalScorePCU, finalScoreEditDistance, finalProcessingAccuracy,
        flaggedLowAccuracy, isFamiliarization,
        // Actions
        initializeSession, startAssessment, continuePractice, skipPractice,
        recordMathSolved, recordMathVerification,
        submitRecall, advancePhase, handleRecallChange,
        handleDevSkipTask, handleExitAssessment,
    };
};

// Export for use by summary page recovery
export { getPendingResults, clearPendingResults };
export default useOperationSpanLogic;

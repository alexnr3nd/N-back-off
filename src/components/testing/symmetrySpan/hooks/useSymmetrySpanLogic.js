/* src/components/testing/symmetrySpan/hooks/useSymmetrySpanLogic.js */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useUser } from '../../../../contexts/UserContext';
import { SYMSPAN_PHASES, SYMSPAN_PRACTICE_STAGES, SYMSPAN_DEFAULTS } from '../../../../constants/symmetrySpanConstants';
import { CST_TEST_TYPES } from '../../../../constants/cstConstants';
import { getLastCalibrationDeadline } from '../../../../utils/assessmentCalibration';
import { functions, httpsCallable } from '../../../../firebaseConfig';
import {
    generateLocalPattern,
    generateLocalSquareSequence,
    compareRecall,
    computeCalibratedDeadline,
    savePendingResults,
    clearPendingResults,
} from './symmetrySpanHelpers';

// Phases where a hidden tab corrupts presentation timing (assessment sets are
// flagged `interrupted` rather than redone — a complex-span set cannot be
// re-shown without invalidating it)
const TIMING_CRITICAL_PHASES = new Set([
    SYMSPAN_PHASES.SYMMETRY_JUDGMENT,
    SYMSPAN_PHASES.PRE_SQUARE_BLANK,
    SYMSPAN_PHASES.SQUARE_DISPLAY,
    SYMSPAN_PHASES.POST_SQUARE_BLANK,
]);

/**
 * Core logic hook for the Symmetry Span assessment.
 *
 * Session types:
 * - Familiarization: practice stages only → submit practice data → results
 * - Scored: practice stages → READY_ASSESSMENT → 12-set assessment → results
 *
 * @param {function} onTaskComplete - called after a successful submit
 * @param {object} timerControlsRef - ref populated by useSymmetrySpanTimer
 * @param {{ earlyRetake?: boolean, onExit?: function }} options
 */
const useSymmetrySpanLogic = (onTaskComplete, timerControlsRef, options = {}) => {
    const { earlyRetake = false, onExit } = options;
    const { userId, userData } = useUser();

    // --- Core State ---
    const [currentPhase, setCurrentPhase] = useState(SYMSPAN_PHASES.INSTRUCTIONS);
    const [testStructure, setTestStructure] = useState([]);
    const [currentSetIndex, setCurrentSetIndex] = useState(-1);
    const [currentElementIndex, setCurrentElementIndex] = useState(-1);

    // --- Practice State ---
    const [isPractice, setIsPractice] = useState(false);
    const [practiceStage, setPracticeStage] = useState(null);
    const [practiceSetNum, setPracticeSetNum] = useState(0);

    // --- Practice Data Collection (familiarization diagnostics) ---
    const practiceStorageResultsRef = useRef([]);
    const practiceCombinedResultsRef = useRef([]);
    const practiceSymmetryAccuracyRef = useRef({ correct: 0, total: 0 });

    // --- Judgment-Deadline Calibration ---
    // RTs are mirrored in a ref so advancePhase can read the latest count
    // without depending on the state array (keeps its identity stable and
    // avoids stale-closure hazards with the timer effect).
    const [symmetryCalibrationRTs, setSymmetryCalibrationRTs] = useState([]);
    const symmetryCalibrationRTsRef = useRef([]);
    const [symmetryDeadlineMs, setSymmetryDeadlineMs] = useState(null);
    // Most recent stored deadline from prior sessions (familiarization included);
    // used when practice is skipped before this session's calibration block runs.
    const storedDeadline = useMemo(
        () => getLastCalibrationDeadline(userData?.cstHistory, CST_TEST_TYPES.SYMMETRY_SPAN, 'symmetryCalibrationDeadlineMs'),
        [userData]
    );

    // --- Symmetry-Only Practice (deadline calibration) ---
    const currentSymmetryPracticePatternRef = useRef(null);
    const [symmetryPracticePattern, setSymmetryPracticePattern] = useState(null);

    // --- Current Set / Element Data ---
    const [elementsForSet, setElementsForSet] = useState([]); // [{ pattern|null, squareCell }]
    const [targetCellsForSet, setTargetCellsForSet] = useState([]);
    // Trials mirrored in a ref so processAndAdvanceSet always sees the final
    // trial of a set even if React defers the last state commit.
    const [symmetryTrialsForSet, setSymmetryTrialsForSet] = useState([]);
    const symmetryTrialsForSetRef = useRef([]);
    const [recalledCells, setRecalledCells] = useState([]);
    const recalledCellsRef = useRef([]);
    const judgmentStartRef = useRef(null);
    const judgmentRecordedRef = useRef(false);
    const recallProcessedRef = useRef(false); // guards double-submit (double-tap or submit/timeout race)

    // --- Cumulative Symmetry Accuracy (live 85% display) ---
    const [cumulativeSymCorrect, setCumulativeSymCorrect] = useState(0);
    const [cumulativeSymTotal, setCumulativeSymTotal] = useState(0);

    // --- Feedback State ---
    const [lastSetFeedback, setLastSetFeedback] = useState({ correct: 0, total: 0, symmetryErrors: 0 });
    const [lastJudgmentFeedback, setLastJudgmentFeedback] = useState(null);

    // --- Results (from server response) ---
    const allSetResultsRef = useRef([]);
    const [completedSetCount, setCompletedSetCount] = useState(0);
    const [finalResults, setFinalResults] = useState(null);
    const [isFamiliarization, setIsFamiliarization] = useState(false);
    const [notEligibleMessage, setNotEligibleMessage] = useState(null);

    // --- Utility ---
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [feedback, setFeedback] = useState('');

    // --- Tab-visibility interruption flagging ---
    const interruptedRef = useRef(false);
    const phaseRef = useRef(currentPhase);
    const isPracticeRef = useRef(isPractice);
    phaseRef.current = currentPhase;
    isPracticeRef.current = isPractice;

    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.hidden && !isPracticeRef.current && TIMING_CRITICAL_PHASES.has(phaseRef.current)) {
                interruptedRef.current = true;
                console.warn('[SymSpan] Tab hidden during presentation; set flagged as interrupted.');
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, []);

    // --- Derived State ---
    const currentSet = useMemo(() => {
        if (currentSetIndex >= 0 && currentSetIndex < testStructure.length) {
            return testStructure[currentSetIndex];
        }
        return null;
    }, [testStructure, currentSetIndex]);

    const currentElement = useMemo(() => {
        if (currentElementIndex >= 0 && currentElementIndex < elementsForSet.length) {
            return elementsForSet[currentElementIndex];
        }
        return null;
    }, [elementsForSet, currentElementIndex]);

    const setSize = elementsForSet.length;

    // Deadline is active in combined practice + assessment; symmetry-only
    // practice is participant-paced (it IS the calibration source)
    const activeJudgmentDeadlineMs = (isPractice && practiceStage === SYMSPAN_PRACTICE_STAGES.SYMMETRY)
        ? null
        : symmetryDeadlineMs;

    const clearJudgmentTimer = useCallback(() => {
        timerControlsRef?.current?.clearJudgmentTimer?.();
    }, [timerControlsRef]);

    const clearRecallTimer = useCallback(() => {
        timerControlsRef?.current?.clearRecallTimer?.();
    }, [timerControlsRef]);

    // --- Prepare Set Data ---
    const prepareNextSet = useCallback((setIndex, opts = {}) => {
        const mode = opts.mode || (isPractice ? 'practice' : 'assessment');
        const stage = opts.stage || practiceStage;
        const structure = opts.structure || testStructure;

        let elements;
        if (mode === 'practice') {
            if (stage === SYMSPAN_PRACTICE_STAGES.STORAGE) {
                const size = SYMSPAN_DEFAULTS.STORAGE_PRACTICE_SET_SIZES[setIndex] || 2;
                elements = generateLocalSquareSequence(size).map(squareCell => ({ pattern: null, squareCell }));
            } else if (stage === SYMSPAN_PRACTICE_STAGES.COMBINED) {
                const size = SYMSPAN_DEFAULTS.COMBINED_PRACTICE_SIZE;
                elements = generateLocalSquareSequence(size).map(squareCell => ({
                    pattern: generateLocalPattern(Math.random() < 0.5),
                    squareCell,
                }));
            } else {
                return true; // symmetry-only practice has no sets
            }
        } else {
            if (setIndex < 0 || setIndex >= structure.length) {
                setError('Invalid set index.');
                return false;
            }
            elements = structure[setIndex].elements;
        }

        setElementsForSet(elements);
        setTargetCellsForSet(elements.map(el => el.squareCell));
        setSymmetryTrialsForSet([]);
        symmetryTrialsForSetRef.current = [];
        setRecalledCells([]);
        recalledCellsRef.current = [];
        setCurrentElementIndex(0);
        judgmentStartRef.current = null;
        judgmentRecordedRef.current = false;
        recallProcessedRef.current = false;
        return true;
    }, [isPractice, practiceStage, testStructure]);

    // --- Initialize Session (called on mount; idempotent via didInitRef) ---
    const didInitRef = useRef(false);
    const initializeSession = useCallback(async () => {
        if (didInitRef.current) return;
        didInitRef.current = true;
        console.log('[SymSpan] Initializing session...');
        setIsLoading(true);
        setError(null);

        try {
            const checkElig = httpsCallable(functions, 'checkSymmetrySpanEligibility');
            const eligResult = await checkElig({});
            const data = eligResult.data;
            const isFamiliar = !data.familiarizationComplete;
            setIsFamiliarization(isFamiliar);
            console.log(`[SymSpan] Session type: ${isFamiliar ? 'familiarization' : 'scored'}. Eligible: ${data.isEligible}`);

            if (data.familiarizationComplete && !data.isEligible && !earlyRetake) {
                // Not eligible AND not an explicitly-confirmed early retake — bail out.
                setNotEligibleMessage(data.nextAvailableDateString || 'You are not eligible for a new assessment yet.');
                setIsLoading(false);
                setCurrentPhase(SYMSPAN_PHASES.RESULTS);
                return;
            }

            // For scored sessions, pre-fetch the full 12-set structure
            if (!isFamiliar) {
                const getStructure = httpsCallable(functions, 'getSymmetrySpanStructure');
                const structResult = await getStructure({ forceStart: earlyRetake });
                if (!structResult.data?.sets?.length) throw new Error('Invalid test structure received.');
                setTestStructure(structResult.data.sets);
                console.log(`[SymSpan] Pre-fetched ${structResult.data.sets.length} sets`);
            }

            // Start storage-only practice
            setIsLoading(false);
            setIsPractice(true);
            setPracticeStage(SYMSPAN_PRACTICE_STAGES.STORAGE);
            setPracticeSetNum(0);
            practiceStorageResultsRef.current = [];
            practiceCombinedResultsRef.current = [];
            practiceSymmetryAccuracyRef.current = { correct: 0, total: 0 };
            prepareNextSet(0, { mode: 'practice', stage: SYMSPAN_PRACTICE_STAGES.STORAGE });
            setCurrentPhase(SYMSPAN_PHASES.FIXATION);

        } catch (err) {
            console.error('[SymSpan] Init error:', err);
            setError(`Failed to initialize: ${err.message}`);
            setIsLoading(false);
            setCurrentPhase(SYMSPAN_PHASES.RESULTS);
        }
    }, [prepareNextSet, earlyRetake]);

    // --- Submit Familiarization (practice-only) ---
    const submitFamiliarization = useCallback(async () => {
        console.log('[SymSpan] Submitting familiarization record...');
        setIsLoading(true);
        setCurrentPhase(SYMSPAN_PHASES.SAVING);

        if (!userId) {
            setError('No user ID.'); setIsLoading(false); setCurrentPhase(SYMSPAN_PHASES.RESULTS); return;
        }

        const practiceData = {
            symmetryRTs: symmetryCalibrationRTs.map(rt => Math.round(rt)),
            symmetryAccuracy: practiceSymmetryAccuracyRef.current.total > 0
                ? (practiceSymmetryAccuracyRef.current.correct / practiceSymmetryAccuracyRef.current.total)
                : null,
            storageRecallResults: practiceStorageResultsRef.current,
            combinedRecallResults: practiceCombinedResultsRef.current,
        };

        try {
            const submitFunc = httpsCallable(functions, 'submitSymmetrySpanResults');
            const result = await submitFunc({
                isFamiliarization: true,
                setResults: [],
                symmetryCalibrationDeadlineMs: symmetryDeadlineMs,
                practiceData,
            });
            if (result.data?.success) {
                setFeedback('Familiarization complete! You can now take the scored assessment.');
                if (onTaskComplete) onTaskComplete();
            } else {
                throw new Error(result.data?.message || 'Submission failed.');
            }
        } catch (err) {
            console.error('[SymSpan] Familiarization submit error:', err);
            setError(`Failed to save: ${err.message}`);
        } finally {
            setIsLoading(false);
            setCurrentPhase(SYMSPAN_PHASES.RESULTS);
        }
    }, [userId, symmetryDeadlineMs, symmetryCalibrationRTs, onTaskComplete]);

    // --- Submit Final Results (scored assessment, possibly partial) ---
    const submitFinalResults = useCallback(async (resultsData, familiarizationStatus) => {
        const dataToSubmit = resultsData ?? allSetResultsRef.current;
        console.log(`[SymSpan] Submitting ${dataToSubmit.length} sets. Familiarization: ${familiarizationStatus}`);
        setIsLoading(true);
        setError(null);

        if (!userId) {
            setError('No user ID.'); setIsLoading(false); setCurrentPhase(SYMSPAN_PHASES.RESULTS); return;
        }

        const payload = {
            isFamiliarization: familiarizationStatus,
            setResults: dataToSubmit,
            symmetryCalibrationDeadlineMs: symmetryDeadlineMs,
            ...(earlyRetake && { forceSubmit: true }),
        };

        try {
            const submitFunc = httpsCallable(functions, 'submitSymmetrySpanResults');
            const result = await submitFunc(payload);

            if (result.data?.success) {
                setFinalResults(result.data);
                clearPendingResults(userId);
                if (onTaskComplete) onTaskComplete();
            } else {
                throw new Error(result.data?.message || 'Submission failed.');
            }
        } catch (err) {
            console.error('[SymSpan] Submit error:', err);
            if (err.code !== 'functions/invalid-argument' && err.code !== 'functions/permission-denied') {
                savePendingResults(userId, payload);
                setError('Results saved locally. They will be submitted when you return to the assessment page.');
            } else {
                setError(`Failed to save results: ${err.message}`);
            }
            setFinalResults(null);
        } finally {
            setIsLoading(false);
            setCurrentPhase(SYMSPAN_PHASES.RESULTS);
        }
    }, [userId, symmetryDeadlineMs, onTaskComplete, earlyRetake]);

    // --- Start Scored Assessment (cached structure, no backend calls) ---
    const startAssessment = useCallback(() => {
        console.log('[SymSpan] Starting scored assessment with cached structure...');
        setIsPractice(false);
        setPracticeStage(null);
        allSetResultsRef.current = [];
        setCompletedSetCount(0);
        interruptedRef.current = false;
        setError(null);
        setFeedback('');
        setCumulativeSymCorrect(0);
        setCumulativeSymTotal(0);

        setCurrentSetIndex(0);
        const ok = prepareNextSet(0, { mode: 'assessment' });
        if (!ok) {
            setError('Failed to prepare first set.');
            setCurrentPhase(SYMSPAN_PHASES.RESULTS);
            return;
        }
        setCurrentPhase(SYMSPAN_PHASES.FIXATION);
    }, [prepareNextSet]);

    // --- Record Symmetry Judgment ---
    const recordSymmetryResponse = useCallback((userSaidSymmetric) => {
        if (currentPhase !== SYMSPAN_PHASES.SYMMETRY_JUDGMENT || judgmentRecordedRef.current) return;
        const pattern = (isPractice && practiceStage === SYMSPAN_PRACTICE_STAGES.SYMMETRY)
            ? currentSymmetryPracticePatternRef.current
            : currentElement?.pattern;
        if (!pattern) return;

        judgmentRecordedRef.current = true;
        clearJudgmentTimer();

        const rt = judgmentStartRef.current ? performance.now() - judgmentStartRef.current : 0;
        const wasCorrect = userSaidSymmetric === pattern.isSymmetric;

        setCumulativeSymCorrect(prev => prev + (wasCorrect ? 1 : 0));
        setCumulativeSymTotal(prev => prev + 1);

        if (isPractice && practiceStage === SYMSPAN_PRACTICE_STAGES.SYMMETRY) {
            practiceSymmetryAccuracyRef.current.total++;
            if (wasCorrect) practiceSymmetryAccuracyRef.current.correct++;
            symmetryCalibrationRTsRef.current = [...symmetryCalibrationRTsRef.current, rt];
            setSymmetryCalibrationRTs(symmetryCalibrationRTsRef.current);
            setLastJudgmentFeedback({ wasCorrect });
            setCurrentPhase(SYMSPAN_PHASES.JUDGMENT_FEEDBACK);
            return;
        }

        if (isPractice && practiceStage === SYMSPAN_PRACTICE_STAGES.COMBINED) {
            practiceSymmetryAccuracyRef.current.total++;
            if (wasCorrect) practiceSymmetryAccuracyRef.current.correct++;
        }

        const trial = {
            patternId: pattern.id,
            isSymmetric: pattern.isSymmetric,
            userSaidSymmetric,
            wasCorrect,
            reactionTimeMs: Math.round(rt),
            timedOut: false,
        };
        symmetryTrialsForSetRef.current = [...symmetryTrialsForSetRef.current, trial];
        setSymmetryTrialsForSet(symmetryTrialsForSetRef.current);
        setCurrentPhase(SYMSPAN_PHASES.PRE_SQUARE_BLANK);
    }, [currentPhase, isPractice, practiceStage, currentElement, clearJudgmentTimer]);

    // --- Handle Judgment Timeout (speed error; the square is still shown) ---
    const handleJudgmentTimeout = useCallback(() => {
        if (judgmentRecordedRef.current) return;
        judgmentRecordedRef.current = true;

        const pattern = currentElement?.pattern;
        setCumulativeSymTotal(prev => prev + 1);
        if (isPractice && practiceStage === SYMSPAN_PRACTICE_STAGES.COMBINED) {
            practiceSymmetryAccuracyRef.current.total++;
        }

        const trial = {
            patternId: pattern?.id || null,
            isSymmetric: pattern?.isSymmetric ?? false,
            userSaidSymmetric: null,
            wasCorrect: false,
            reactionTimeMs: null,
            timedOut: true,
        };
        symmetryTrialsForSetRef.current = [...symmetryTrialsForSetRef.current, trial];
        setSymmetryTrialsForSet(symmetryTrialsForSetRef.current);
    }, [currentElement, isPractice, practiceStage]);

    const nextSymmetryPracticePattern = useCallback(() => {
        const pattern = generateLocalPattern(Math.random() < 0.5);
        currentSymmetryPracticePatternRef.current = pattern;
        setSymmetryPracticePattern(pattern);
        judgmentStartRef.current = performance.now();
        judgmentRecordedRef.current = false;
        setCurrentPhase(SYMSPAN_PHASES.SYMMETRY_JUDGMENT);
    }, []);

    const startSymmetryPractice = useCallback(() => {
        setPracticeStage(SYMSPAN_PRACTICE_STAGES.SYMMETRY);
        symmetryCalibrationRTsRef.current = [];
        setSymmetryCalibrationRTs([]);
        setError(null);
        setFeedback('');
        setLastJudgmentFeedback(null);
        nextSymmetryPracticePattern();
    }, [nextSymmetryPracticePattern]);

    const startCombinedPractice = useCallback(() => {
        setPracticeStage(SYMSPAN_PRACTICE_STAGES.COMBINED);
        setPracticeSetNum(0);
        setError(null);
        setFeedback('');
        prepareNextSet(0, { mode: 'practice', stage: SYMSPAN_PRACTICE_STAGES.COMBINED });
        setCurrentPhase(SYMSPAN_PHASES.FIXATION);
    }, [prepareNextSet]);

    // --- Process Set and Advance ---
    const processAndAdvanceSet = useCallback(async (recallTimedOut = false) => {
        // One processing per recall — guards double-tap and the submit/timeout race
        if (recallProcessedRef.current) return;
        recallProcessedRef.current = true;

        const recalled = [...recalledCellsRef.current];
        const target = targetCellsForSet;
        const correctCount = compareRecall(target, recalled);

        if (isPractice) {
            if (practiceStage === SYMSPAN_PRACTICE_STAGES.STORAGE) {
                practiceStorageResultsRef.current.push({ setSize: target.length, correct: correctCount });
            } else if (practiceStage === SYMSPAN_PRACTICE_STAGES.COMBINED) {
                practiceCombinedResultsRef.current.push({ setSize: target.length, correct: correctCount });
            }
            setFeedback(`Recall: ${correctCount}/${target.length} correct. ${recallTimedOut ? '(Timed out)' : ''}`);
            setCurrentPhase(SYMSPAN_PHASES.PRACTICE_FEEDBACK);
            return;
        }

        const symmetryTrials = [...symmetryTrialsForSetRef.current];
        const symmetryErrors = symmetryTrials.filter(t => !t.wasCorrect).length;
        setLastSetFeedback({ correct: correctCount, total: target.length, symmetryErrors });

        allSetResultsRef.current.push({
            setId: currentSet?.id,
            setSize: currentSet?.setSize,
            targetCells: [...target],
            recalledCells: recalled,
            symmetryTrials,
            recallTimedOut,
            interrupted: interruptedRef.current,
        });
        setCompletedSetCount(allSetResultsRef.current.length);
        interruptedRef.current = false;

        const nextSetIndex = currentSetIndex + 1;
        if (nextSetIndex < testStructure.length) {
            setCurrentSetIndex(nextSetIndex);
            prepareNextSet(nextSetIndex);
            setCurrentPhase(SYMSPAN_PHASES.SET_FEEDBACK);
        } else {
            setCurrentPhase(SYMSPAN_PHASES.SAVING);
            await submitFinalResults(null, isFamiliarization);
        }
    }, [isPractice, practiceStage, targetCellsForSet, currentSet, currentSetIndex, testStructure, prepareNextSet, isFamiliarization, submitFinalResults]);

    // --- Submit Recall ---
    const submitRecall = useCallback(() => {
        if (currentPhase !== SYMSPAN_PHASES.RECALL) return;
        clearRecallTimer();
        processAndAdvanceSet(false);
    }, [currentPhase, clearRecallTimer, processAndAdvanceSet]);

    // --- Recall Change Handler ---
    const handleRecallChange = useCallback((newCells) => {
        setRecalledCells(newCells);
        recalledCellsRef.current = newCells;
    }, []);

    // --- Phase Transition Logic (driven by the timer hook) ---
    const advancePhase = useCallback((requestedNextPhase) => {
        const current = currentPhase;

        // FIXATION finished -> first judgment (or first square in storage practice)
        if (current === SYMSPAN_PHASES.FIXATION && requestedNextPhase === SYMSPAN_PHASES.SYMMETRY_JUDGMENT) {
            if (isPractice && practiceStage === SYMSPAN_PRACTICE_STAGES.STORAGE) {
                setCurrentPhase(SYMSPAN_PHASES.SQUARE_DISPLAY);
                return;
            }
            judgmentStartRef.current = performance.now();
            judgmentRecordedRef.current = false;
            setCurrentPhase(SYMSPAN_PHASES.SYMMETRY_JUDGMENT);
            return;
        }

        // Judgment deadline expired -> speed error, square still shown
        if (current === SYMSPAN_PHASES.SYMMETRY_JUDGMENT && requestedNextPhase === SYMSPAN_PHASES.PRE_SQUARE_BLANK) {
            handleJudgmentTimeout();
            setCurrentPhase(SYMSPAN_PHASES.PRE_SQUARE_BLANK);
            return;
        }

        // Practice judgment feedback finished -> next practice judgment or stage end
        if (current === SYMSPAN_PHASES.JUDGMENT_FEEDBACK && requestedNextPhase === SYMSPAN_PHASES.SYMMETRY_JUDGMENT) {
            if (symmetryCalibrationRTsRef.current.length < SYMSPAN_DEFAULTS.SYMMETRY_PRACTICE_COUNT) {
                nextSymmetryPracticePattern();
            } else {
                const deadline = computeCalibratedDeadline(symmetryCalibrationRTsRef.current);
                setSymmetryDeadlineMs(deadline);
                console.log(`[SymSpan] Calibrated judgment deadline: ${deadline}ms`);
                setFeedback('Symmetry practice complete. Your time limit has been calibrated.');
                setCurrentPhase(SYMSPAN_PHASES.PRACTICE_FEEDBACK);
            }
            return;
        }

        // Square hidden -> post-square blank
        if (current === SYMSPAN_PHASES.SQUARE_DISPLAY && requestedNextPhase === SYMSPAN_PHASES.POST_SQUARE_BLANK) {
            setCurrentPhase(SYMSPAN_PHASES.POST_SQUARE_BLANK);
            return;
        }

        // Post-square blank finished -> next element or recall
        if (current === SYMSPAN_PHASES.POST_SQUARE_BLANK && requestedNextPhase === SYMSPAN_PHASES.FIXATION) {
            const nextElement = currentElementIndex + 1;
            if (nextElement < elementsForSet.length) {
                setCurrentElementIndex(nextElement);
                if (isPractice && practiceStage === SYMSPAN_PRACTICE_STAGES.STORAGE) {
                    setCurrentPhase(SYMSPAN_PHASES.SQUARE_DISPLAY);
                } else {
                    judgmentStartRef.current = performance.now();
                    judgmentRecordedRef.current = false;
                    setCurrentPhase(SYMSPAN_PHASES.SYMMETRY_JUDGMENT);
                }
            } else {
                setCurrentPhase(SYMSPAN_PHASES.RECALL);
            }
            return;
        }

        // Set feedback finished -> next set (already prepared)
        if (current === SYMSPAN_PHASES.SET_FEEDBACK && requestedNextPhase === SYMSPAN_PHASES.FIXATION) {
            setCurrentPhase(SYMSPAN_PHASES.FIXATION);
            return;
        }

        // Recall timer expired
        if (current === SYMSPAN_PHASES.RECALL && requestedNextPhase === SYMSPAN_PHASES.RECALL_TIMEOUT) {
            processAndAdvanceSet(true);
            return;
        }

        if (current !== requestedNextPhase) {
            setCurrentPhase(requestedNextPhase);
        }
    }, [currentPhase, currentElementIndex, elementsForSet, isPractice, practiceStage,
        nextSymmetryPracticePattern, handleJudgmentTimeout, processAndAdvanceSet]);

    // --- Practice Flow (PRACTICE_FEEDBACK continue button) ---
    const continuePractice = useCallback(() => {
        if (practiceStage === SYMSPAN_PRACTICE_STAGES.STORAGE) {
            const nextSet = practiceSetNum + 1;
            if (nextSet < SYMSPAN_DEFAULTS.STORAGE_PRACTICE_SET_SIZES.length) {
                setPracticeSetNum(nextSet);
                prepareNextSet(nextSet, { mode: 'practice', stage: SYMSPAN_PRACTICE_STAGES.STORAGE });
                setCurrentPhase(SYMSPAN_PHASES.FIXATION);
            } else {
                startSymmetryPractice();
            }
        } else if (practiceStage === SYMSPAN_PRACTICE_STAGES.SYMMETRY) {
            startCombinedPractice();
        } else if (practiceStage === SYMSPAN_PRACTICE_STAGES.COMBINED) {
            const nextSet = practiceSetNum + 1;
            if (nextSet < SYMSPAN_DEFAULTS.COMBINED_PRACTICE_SETS) {
                setPracticeSetNum(nextSet);
                prepareNextSet(nextSet, { mode: 'practice', stage: SYMSPAN_PRACTICE_STAGES.COMBINED });
                setCurrentPhase(SYMSPAN_PHASES.FIXATION);
            } else {
                setIsPractice(false);
                setPracticeStage(null);
                if (isFamiliarization) {
                    submitFamiliarization();
                } else {
                    setCurrentPhase(SYMSPAN_PHASES.READY_ASSESSMENT);
                }
            }
        }
    }, [practiceStage, practiceSetNum, prepareNextSet, startSymmetryPractice, startCombinedPractice, isFamiliarization, submitFamiliarization]);

    // Skip the rest of practice (button shown on scored sessions only, and only
    // when a judgment-deadline source exists). The deadline is the one piece of
    // session state practice produces: keep the fresh calibration if the symmetry
    // block completed this session, otherwise fall back to the most recent stored
    // one. Mirrors handleExitAssessment's timer teardown; testStructure and
    // allSetResultsRef are session-scoped and must survive.
    const skipPractice = useCallback(() => {
        if (!isPractice || isFamiliarization) return;
        clearJudgmentTimer();
        clearRecallTimer();
        if (symmetryDeadlineMs === null && storedDeadline !== null) {
            setSymmetryDeadlineMs(storedDeadline);
        }
        // Reset calibration + trial-local practice state; preserve testStructure.
        symmetryCalibrationRTsRef.current = [];
        setSymmetryCalibrationRTs([]);
        currentSymmetryPracticePatternRef.current = null;
        setSymmetryPracticePattern(null);
        judgmentStartRef.current = null;
        judgmentRecordedRef.current = false;
        recallProcessedRef.current = false;
        symmetryTrialsForSetRef.current = [];
        setSymmetryTrialsForSet([]);
        recalledCellsRef.current = [];
        setRecalledCells([]);
        setElementsForSet([]);
        setTargetCellsForSet([]);
        setCurrentElementIndex(-1);
        setLastJudgmentFeedback(null);
        setIsPractice(false);
        setPracticeStage(null);
        setCurrentPhase(SYMSPAN_PHASES.READY_ASSESSMENT);
    }, [isPractice, isFamiliarization, symmetryDeadlineMs, storedDeadline, clearJudgmentTimer, clearRecallTimer]);

    // --- Dev Skip ---
    const handleDevSkipTask = useCallback(async () => {
        if (process.env.NODE_ENV !== 'development') return;
        setIsLoading(true);
        setError(null);
        try {
            if (isFamiliarization) {
                await submitFamiliarization();
            } else {
                const structure = testStructure.length > 0 ? testStructure : null;
                const sizes = structure ? structure.map(s => s.setSize) : [2, 3, 4, 5];
                const fakeResults = sizes.map((size, i) => {
                    const targetCells = generateLocalSquareSequence(size);
                    const recalledCells = targetCells.map(c => (Math.random() < 0.8 ? c : null));
                    const symmetryTrials = Array.from({ length: size }, (_, t) => ({
                        patternId: `dev_pat_${i}_${t}`,
                        isSymmetric: true,
                        userSaidSymmetric: true,
                        wasCorrect: true,
                        reactionTimeMs: Math.floor(Math.random() * 2000) + 1000,
                        timedOut: false,
                    }));
                    return {
                        setId: structure ? structure[i].id : `dev_set_${i}`,
                        setSize: size,
                        targetCells,
                        recalledCells,
                        symmetryTrials,
                        recallTimedOut: false,
                        interrupted: false,
                    };
                });
                setCurrentPhase(SYMSPAN_PHASES.SAVING);
                await submitFinalResults(fakeResults, false);
            }
        } catch (err) {
            setError(`Skip failed: ${err.message}`);
            setIsLoading(false);
            setCurrentPhase(SYMSPAN_PHASES.RESULTS);
        }
    }, [testStructure, submitFinalResults, submitFamiliarization, isFamiliarization]);

    // --- Early Exit ---
    const handleExitAssessment = useCallback(async () => {
        clearJudgmentTimer();
        clearRecallTimer();

        if (isFamiliarization) {
            if (onExit) onExit();
        } else if (allSetResultsRef.current.length === 0) {
            if (onExit) onExit();
        } else {
            setIsLoading(true);
            setError(null);
            setCurrentPhase(SYMSPAN_PHASES.SAVING);
            await submitFinalResults(allSetResultsRef.current, false);
        }
    }, [submitFinalResults, isFamiliarization, clearJudgmentTimer, clearRecallTimer, onExit]);

    return {
        // State
        currentPhase, currentSet, currentSetIndex, currentElementIndex,
        currentElement, symmetryPracticePattern,
        isLoading, error, isPractice, practiceStage, practiceSetNum, setSize,
        testStructure, feedback, recalledCells,
        symmetryDeadlineMs, storedDeadline, activeJudgmentDeadlineMs, notEligibleMessage,
        cumulativeSymCorrect, cumulativeSymTotal,
        lastSetFeedback, lastJudgmentFeedback,
        symmetryCalibrationCount: symmetryCalibrationRTs.length,
        completedSetCount,
        // Results
        finalResults, isFamiliarization,
        // Actions
        initializeSession, startAssessment, continuePractice, skipPractice,
        recordSymmetryResponse, submitRecall, advancePhase, handleRecallChange,
        handleDevSkipTask, handleExitAssessment,
    };
};

export default useSymmetrySpanLogic;

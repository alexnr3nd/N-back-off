/* src/components/testing/countingSpan/hooks/useCountingSpanLogic.js */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUser } from '../../../../contexts/UserContext';
import { TASK_PHASES, CST_TEST_TYPES, COUNTING_SPAN_DEFAULTS } from '../../../../constants/cstConstants';
import { functions, httpsCallable } from '../../../../firebaseConfig'; // Ensure httpsCallable is imported

// --- Practice Setup ---
// ... (practice setup code remains the same) ...
// --- End Practice Setup ---


/**
 * Hook to manage the state, logic, and flow of the Counting Span task.
 * Interacts with backend functions for assessment structure, stimuli, and results.
 * Handles client-side logic for practice steps.
 * Includes a development-only skip function that correctly determines familiarization status.
 * Includes an early exit function.
 *
 * @param {function} onTaskComplete - Callback function when the task sequence finishes saving results.
 * @param {function} clearStimulusJudgmentTimer - Function from timer hook to clear judgment timeout.
 * @param {function} clearRecallTimer - Function from timer hook to clear recall timeout.
 */
const useCountingSpanLogic = (onTaskComplete, clearStimulusJudgmentTimer, clearRecallTimer, options = {}) => {
    const { earlyRetake = false } = options;
    const { userId } = useUser();

    // --- Core State ---
    const [currentPhase, setCurrentPhase] = useState(TASK_PHASES.INSTRUCTIONS);
    const [testStructure, setTestStructure] = useState([]); // Fetched from backend { setSize, id }[]
    const [currentSetIndex, setCurrentSetIndex] = useState(-1);
    const [currentTrialIndexInSet, setCurrentTrialIndexInSet] = useState(-1);

    // --- Practice State ---
    const [isPractice, setIsPractice] = useState(false);
    const [practiceStep, setPracticeStep] = useState(null); // e.g., 'processing', 'integrated'
    const [practiceSetNum, setPracticeSetNum] = useState(0); // For multi-set practice types

    // --- Data Storage (Current Set) ---
    const [stimuliForCurrentSet, setStimuliForCurrentSet] = useState([]); // Stimulus data (local for practice, fetched for assessment)
    const [presentedCountsForCurrentSet, setPresentedCountsForCurrentSet] = useState([]); // Correct counts (local for practice, fetched for assessment)
    const [userResponsesForCurrentSet, setUserResponsesForCurrentSet] = useState({ judgments: [], userRecallSequence: [], recallTimedOut: false });
    const [intermediateRecallSequence, setIntermediateRecallSequence] = useState([]);
    const judgmentRecordedForCurrentTrial = useRef(false); // Track if judgment/timeout handled for the current trial

    // --- Results Accumulation (For Assessment Submission) ---
    const allSetResultsForSubmission = useRef([]); // Format: [{ setId, setSize, presentedCounts, judgments: [...], userRecallSequence: [...], recallTimedOut: bool }]
    const [finalScorePCU, setFinalScorePCU] = useState(0);
    const [finalProcessingAccuracy, setFinalProcessingAccuracy] = useState(0);
    const [flaggedLowAccuracy, setFlaggedLowAccuracy] = useState(false);
    const [isFamiliarization, setIsFamiliarization] = useState(false); // State set by startAssessment for NORMAL flow

    // --- Utility State ---
    const [isLoading, setIsLoading] = useState(false); // Tracks backend calls
    const [error, setError] = useState(null);
    const [feedback, setFeedback] = useState(''); // Primarily for practice feedback

    // --- Memoized Derived State ---
    // ... (memoized state remains the same) ...
    const currentSet = useMemo(() => {
        if (isPractice) {
            if (practiceStep === 'integrated') return { setSize: PRACTICE_CONFIG.INTEGRATED_SET_SIZE, id: `practice_integrated_${practiceSetNum}` };
            if (practiceStep === 'processing') return { setSize: PRACTICE_CONFIG.PROCESSING_TRIALS, id: 'practice_processing' };
            return null;
        }
        return testStructure && currentSetIndex >= 0 && currentSetIndex < testStructure.length
            ? testStructure[currentSetIndex]
            : null;
    }, [testStructure, currentSetIndex, isPractice, practiceStep, practiceSetNum]);

    const currentStimulus = useMemo(() => {
        return stimuliForCurrentSet && currentTrialIndexInSet >= 0 && currentTrialIndexInSet < stimuliForCurrentSet.length
            ? stimuliForCurrentSet[currentTrialIndexInSet]
            : null;
    }, [stimuliForCurrentSet, currentTrialIndexInSet]);

    const currentSetSize = useMemo(() => {
        if (isPractice) {
            if (practiceStep === 'integrated') return PRACTICE_CONFIG.INTEGRATED_SET_SIZE;
            if (practiceStep === 'processing') return PRACTICE_CONFIG.PROCESSING_TRIALS;
            return 0;
        }
        return currentSet?.setSize || 0;
    }, [isPractice, practiceStep, currentSet]);

    // --- Prepare Set Data ---
    const prepareNextSet = useCallback(async (targetSetIndexOrPracticeNum, structureOverride = null) => {
        // ... (prepareNextSet logic remains the same, including error logging) ...
        setError(null);
        const targetIndex = isPractice ? 0 : targetSetIndexOrPracticeNum;

        // Handle Practice Locally (remains the same)
        if (isPractice) {
             // ... (practice generation logic) ...
             try {
                 const newStimuli = Array.from({ length: (practiceStep === 'integrated' ? PRACTICE_CONFIG.INTEGRATED_SET_SIZE : PRACTICE_CONFIG.PROCESSING_TRIALS) }, generateLocalStimulusDisplayForPractice);
                 const newCounts = newStimuli.map(s => s.targetCount);
                 setStimuliForCurrentSet(newStimuli);
                 setPresentedCountsForCurrentSet(newCounts);
                 setIntermediateRecallSequence(Array(newStimuli.length).fill(null));
                 setUserResponsesForCurrentSet({ judgments: [], userRecallSequence: [], recallTimedOut: false });
                 setCurrentTrialIndexInSet(0);
                 judgmentRecordedForCurrentTrial.current = false;
                 return { success: true };
             } catch (genError) {
                 console.error("[Prepare Set - Practice] Error generating local stimuli:", genError);
                 setError("Error generating practice task stimuli."); return { success: false };
             }
        }

        // Assessment: Fetch from Backend (remains the same)
        const structureToUse = structureOverride || testStructure;
        if (targetIndex < 0 || targetIndex >= structureToUse.length) {
            setError("Invalid set index for assessment preparation.");
            console.error(`[Prepare Set - Assessment] Invalid index: ${targetIndex} for structure length ${structureToUse.length}`);
            return { success: false };
        }
        const setInfo = structureToUse[targetIndex];
        const setSizeToPrepare = setInfo.setSize;

        setIsLoading(true);
        try {
            const getStimulusSetFunc = httpsCallable(functions, 'getCstStimulusSet');
            const result = await getStimulusSetFunc({ setSize: setSizeToPrepare, testType: CST_TEST_TYPES.COUNTING_SPAN });

            if (!result.data?.stimuli || !result.data?.presentedCounts || result.data.stimuli.length !== setSizeToPrepare) {
                throw new Error("Invalid or incomplete stimulus data received from server.");
            }
            setStimuliForCurrentSet(result.data.stimuli);
            setPresentedCountsForCurrentSet(result.data.presentedCounts);
            setIntermediateRecallSequence(Array(setSizeToPrepare).fill(null));
            setUserResponsesForCurrentSet({ judgments: [], userRecallSequence: [], recallTimedOut: false });
            setCurrentTrialIndexInSet(0);
            judgmentRecordedForCurrentTrial.current = false;
            setIsLoading(false);
            return { success: true };
        } catch (error) {
            // Added detailed error logging
            console.error("[Prepare Set - Assessment] Error fetching stimulus set.");
            console.error("[Prepare Set - Assessment] Error Code:", error.code); // e.g., 'internal', 'unavailable'
            console.error("[Prepare Set - Assessment] Error Message:", error.message);
            console.error("[Prepare Set - Assessment] Error Details:", error.details); // Might contain custom details
            console.error("[Prepare Set - Assessment] Raw Error Object:", error); // Log the raw object too, might provide clues in dev tools

            const userMessage = `Failed to load stimuli for Set ${targetIndex + 1}. Code: ${error.code || 'UNKNOWN'}. Message: ${error.message || 'Network error or internal issue.'}`;
            setError(userMessage);
            // <<< --- END CHANGE --- >>>
            setIsLoading(false);
            return { success: false };
        }
    }, [isPractice, practiceStep, testStructure, setIsLoading, setError, setStimuliForCurrentSet, setPresentedCountsForCurrentSet, setIntermediateRecallSequence, setUserResponsesForCurrentSet, setCurrentTrialIndexInSet]);

    // --- Practice Control (remains the same) ---
    // ... (startPractice, finishPractice logic remains the same) ...
    const startPractice = useCallback(async (step) => {
        setIsPractice(true);
        setPracticeStep(step);
        allSetResultsForSubmission.current = []; // Clear results
        setError(null);
        setFeedback('');
        setCurrentSetIndex(-1); // Reset indices
        setCurrentTrialIndexInSet(-1);
        if (step === 'processing' || step === 'integrated') {
            setPracticeSetNum(0); // Reset practice set number
            const prepResult = await prepareNextSet(0); // Prepare first practice set/block
            if (prepResult.success) setCurrentPhase(TASK_PHASES.FIXATION);
            else setCurrentPhase(TASK_PHASES.RESULTS); // Go to results on error
        } else {
            // Handle other potential practice steps if added
            setCurrentPhase(TASK_PHASES.INSTRUCTIONS);
        }
    }, [prepareNextSet, setIsPractice, setPracticeStep, setCurrentSetIndex, setCurrentTrialIndexInSet, setFeedback, setError, setCurrentPhase, setPracticeSetNum]); // Dependencies

    const finishPractice = useCallback(() => {
        setIsPractice(false);
        setPracticeStep(null);
        setPracticeSetNum(0);
        setStimuliForCurrentSet([]);
        setPresentedCountsForCurrentSet([]);
        setIntermediateRecallSequence([]);
        setUserResponsesForCurrentSet({ judgments: [], userRecallSequence: [], recallTimedOut: false });
        allSetResultsForSubmission.current = [];
        setFeedback('');
        setError(null);
        setCurrentPhase(TASK_PHASES.READY_ASSESSMENT); // Move to the screen before starting the real assessment
    }, [setIsPractice, setPracticeStep, setStimuliForCurrentSet, setPresentedCountsForCurrentSet, setIntermediateRecallSequence, setUserResponsesForCurrentSet, setFeedback, setError, setCurrentPhase, setPracticeSetNum]); // Dependencies


    // --- Assessment Control (remains the same) ---
    const startAssessment = useCallback(async () => {
        // ... (reset states) ...
        setIsLoading(true);
        setIsPractice(false); // Ensure not in practice mode
        setPracticeStep(null);
        allSetResultsForSubmission.current = []; // Clear any previous results
        setError(null);
        setFeedback('');
        setCurrentTrialIndexInSet(-1);

        try {
            // 1. Fetch Structure
            const getStructureFunc = httpsCallable(functions, 'getCstStructure');
            const result = await getStructureFunc({ testType: CST_TEST_TYPES.COUNTING_SPAN, forceStart: earlyRetake });
            if (!result.data?.structure?.length) throw new Error(result.data?.error?.message || "Received invalid or empty test structure.");
            const fetchedStructure = result.data.structure;
            setTestStructure(fetchedStructure);

            // 2. Determine Familiarization Status from getCstStructure response
            const isFamiliar = !result.data.familiarizationComplete;
            setIsFamiliarization(isFamiliar);

            // 3. Prepare the first assessment set
            const firstSetIndex = 0;
            setCurrentSetIndex(firstSetIndex);
            const prepResult = await prepareNextSet(firstSetIndex, fetchedStructure);
            if (!prepResult.success) throw new Error("Failed to prepare the first assessment set.");

            setIsLoading(false);
            setCurrentPhase(TASK_PHASES.FIXATION);
        } catch (error) {
            console.error("[Assessment Flow] Error starting assessment:", error);
            if (error.code === 'functions/permission-denied') {
                // Server-side 30-day cooldown re-check (the authoritative gate)
                // rejected the start — e.g. the page's client-computed status
                // was stale. getCstStructure includes the next date in details.
                const nextDate = error.details?.nextAvailableDateString;
                setError(nextDate
                    ? `Monthly assessment not yet available. Next available: ${nextDate}.`
                    : 'Monthly assessment not yet available — assessments require 30 days between attempts.');
            } else {
                setError(`Failed to start assessment: ${error.message || 'Network error or eligibility issue.'}`);
            }
            setIsLoading(false);
            setCurrentPhase(TASK_PHASES.RESULTS);
        }
    }, [prepareNextSet, setIsLoading, setError, setTestStructure, setCurrentSetIndex, setIsFamiliarization, setCurrentPhase, setIsPractice, setPracticeStep, setCurrentTrialIndexInSet, setFeedback, earlyRetake]);

    // --- In-Task Actions (remains the same) ---
    // ... (recordJudgment, handleJudgmentTimeout logic remains the same) ...
    const recordJudgment = useCallback((isCorrect, responseTime) => {
        if (currentPhase !== TASK_PHASES.ODD_EVEN_JUDGMENT || judgmentRecordedForCurrentTrial.current) return;
        judgmentRecordedForCurrentTrial.current = true;
        if (clearStimulusJudgmentTimer) clearStimulusJudgmentTimer();
        setUserResponsesForCurrentSet(prev => ({
            ...prev, judgments: [...prev.judgments, { trialIndex: currentTrialIndexInSet, correct: isCorrect, responseTime, timedOut: false }]
        }));
        setCurrentPhase(TASK_PHASES.PROCESSING_TRANSITION);
    }, [currentPhase, currentTrialIndexInSet, clearStimulusJudgmentTimer, setCurrentPhase, setUserResponsesForCurrentSet]);

    const handleJudgmentTimeout = useCallback(() => {
        // This function will be called by advancePhase when the timer signal indicates a timeout.
        if (currentPhase === TASK_PHASES.ODD_EVEN_JUDGMENT && !judgmentRecordedForCurrentTrial.current) {
            judgmentRecordedForCurrentTrial.current = true; // Mark as handled
            setUserResponsesForCurrentSet(prev => ({
                ...prev, judgments: [...prev.judgments, { trialIndex: currentTrialIndexInSet, correct: false, responseTime: COUNTING_SPAN_DEFAULTS.STIMULUS_JUDGMENT_WINDOW_MS, timedOut: true }]
            }));
            return true; // Indicate timeout was successfully recorded
        }
        // If judgment already recorded, do nothing and return false
        return false;
    }, [currentPhase, currentTrialIndexInSet, setUserResponsesForCurrentSet]);


    // --- Result Submission ---
    // Updated to handle partial results more explicitly
    const submitFinalResultsToBackend = useCallback(async (resultsData = null, familiarizationStatus) => {
        // If resultsData is null, use the accumulated results (normal completion)
        // If resultsData is provided (e.g., from skip or early exit), use that.
        const dataToSubmit = resultsData ?? allSetResultsForSubmission.current;
        const submissionType = resultsData === null ? "normal" : (resultsData.length === allSetResultsForSubmission.current.length ? "normal (explicit data)" : "partial/skipped");

        setIsLoading(true);
        setError(null);

        if (!userId) {
             setError("Cannot save results: No user ID."); setIsLoading(false); setCurrentPhase(TASK_PHASES.RESULTS); return;
        }
         // Allow submitting empty results for early exit before first set is complete
        // if (submissionType === 'normal' && dataToSubmit.length === 0) {
        //      setError("No assessment data was recorded to save."); setIsLoading(false); setCurrentPhase(TASK_PHASES.RESULTS); return;
        // }

        const submissionData = {
            testType: CST_TEST_TYPES.COUNTING_SPAN,
            isFamiliarization: familiarizationStatus, // Use determined status
            setResults: dataToSubmit, // Submit the potentially partial data
            ...(earlyRetake && { forceSubmit: true }),
        };

        try {
            const submitFunc = httpsCallable(functions, 'submitCstResults');
            const result = await submitFunc(submissionData);

            if (result.data?.success) {
                setFinalScorePCU(result.data.finalScorePCU ?? 0);
                setFinalProcessingAccuracy(result.data.finalProcessingAccuracy ?? 0);
                setFlaggedLowAccuracy(result.data.flaggedLowAccuracy ?? false);
                if (onTaskComplete) onTaskComplete();
            } else {
                throw new Error(result.data?.message || "Backend reported submission failed.");
            }
        } catch (error) {
            console.error("[Results Flow] Error submitting results:", error);
            const message = error.details?.message || error.message || 'Unknown error during submission.';
            // If the error includes 'permission-denied', mention possible duplicate submission
             if (error.code === 'functions/permission-denied') {
                 setError(`Failed to save results: ${message}. This might happen if a result for this month already exists.`);
             } else {
                 setError(`Failed to save results: ${message}`);
             }
            setFinalScorePCU(0); setFinalProcessingAccuracy(0); setFlaggedLowAccuracy(false);
        } finally {
            setIsLoading(false);
            setCurrentPhase(TASK_PHASES.RESULTS); // Always go to results screen after attempt
        }
    }, [userId, onTaskComplete, isPractice, setIsLoading, setError, setCurrentPhase, setFinalScorePCU, setFinalProcessingAccuracy, setFlaggedLowAccuracy, earlyRetake]);


    // --- Internal Set Processing & Advancement ---
    const _processAndAdvanceSet = useCallback(async (timedOut = false) => {
        // Handle Practice (remains the same)
        if (isPractice) {
            // ... (practice feedback and advancement logic) ...
             const setSizeForPractice = currentSetSize;
             const presentedForPractice = presentedCountsForCurrentSet;
             const recalledForPractice = [...intermediateRecallSequence];
             const judgmentsForPractice = userResponsesForCurrentSet.judgments;
             const localScore = calculateLocalPracticeScore(presentedForPractice, recalledForPractice);
             const processingCorrect = judgmentsForPractice.filter(j => j.correct).length;
             const processingTotal = judgmentsForPractice.length;
             const feedbackMsg = `Practice Feedback: Score ${localScore}/${setSizeForPractice}. Judgments: ${processingCorrect}/${processingTotal}. ${timedOut ? '(Recall Timed Out)' : ''}`;
             setFeedback(feedbackMsg);
             if (practiceStep === 'integrated') {
                 const nextPracticeSet = practiceSetNum + 1;
                 if (nextPracticeSet < PRACTICE_CONFIG.INTEGRATED_SETS) {
                     setPracticeSetNum(nextPracticeSet);
                     const prepResult = await prepareNextSet(nextPracticeSet);
                     if (prepResult.success) setCurrentPhase(TASK_PHASES.FIXATION);
                     else setCurrentPhase(TASK_PHASES.RESULTS);
                 } else {
                     finishPractice(); // All integrated practice sets done
                 }
             } else { // e.g., processing practice or others only have one block
                 finishPractice();
             }
            return;
        }

        // Assessment Set Processing (remains the same)
        const currentSetInfo = testStructure[currentSetIndex];
        if (!currentSetInfo) {
            setError("Internal error processing set: Set data missing.");
            setCurrentPhase(TASK_PHASES.RESULTS); return;
        }

        // Collate data for this completed set
        const resultSetData = {
            setId: currentSetInfo.id, setSize: currentSetInfo.setSize,
            presentedCounts: [...presentedCountsForCurrentSet], judgments: [...userResponsesForCurrentSet.judgments],
            userRecallSequence: [...intermediateRecallSequence], recallTimedOut: timedOut
        };
        allSetResultsForSubmission.current.push(resultSetData);

        // Advance to Next Set or Finish
        const nextSetIndex = currentSetIndex + 1;
        if (nextSetIndex < testStructure.length) {
            setCurrentSetIndex(nextSetIndex);
            const prepResult = await prepareNextSet(nextSetIndex); // Will use state structure
            if (prepResult.success) setCurrentPhase(TASK_PHASES.FIXATION);
            else setCurrentPhase(TASK_PHASES.RESULTS); // Go to results if next set prep fails
        } else {
            // Last assessment set finished, submit collected results normally
            setCurrentPhase(TASK_PHASES.SAVING);
            // Call submission with null results (use accumulated) and current isFamiliarization state
            await submitFinalResultsToBackend(null, isFamiliarization);
        }
    }, [ isPractice, practiceStep, practiceSetNum, currentSetSize, presentedCountsForCurrentSet, intermediateRecallSequence, userResponsesForCurrentSet.judgments, testStructure, currentSetIndex, prepareNextSet, finishPractice, submitFinalResultsToBackend, setCurrentPhase, setError, setFeedback, setCurrentSetIndex, setPracticeSetNum, isFamiliarization ]);

    // --- Recall Handlers (remains the same) ---
    const handleRecallChange = useCallback((newSequence) => { setIntermediateRecallSequence(newSequence); }, [setIntermediateRecallSequence]);

    const submitRecall = useCallback(() => {
        if (currentPhase !== TASK_PHASES.RECALL) return;
        if (clearRecallTimer) clearRecallTimer();
        // Clear recall timer first, then process the set and advance
        _processAndAdvanceSet(false); // Process with timedOut = false
    }, [currentPhase, clearRecallTimer, _processAndAdvanceSet]);


    // --- Phase Transition Logic (Corrected & Expanded) ---
    // *** NO CHANGES NEEDED HERE FOR EXIT LOGIC ***
    // The timer will trigger transitions; exit logic is handled separately.
    const advancePhase = useCallback((requestedNextPhase) => {
        const currentPhaseSnapshot = currentPhase; // Capture phase before potential updates
        let actualNextPhase = requestedNextPhase; // Start with the requested phase


        // Handle advancing AFTER the Inter-Trial Interval
        if (currentPhaseSnapshot === TASK_PHASES.PROCESSING_TRANSITION) {
            if (requestedNextPhase === TASK_PHASES.FIXATION) { // Timer requests FIXATION after ITI
                const nextTrialIndex = currentTrialIndexInSet + 1;
                if (nextTrialIndex < currentSetSize) { // More trials in this set
                    setCurrentTrialIndexInSet(nextTrialIndex);
                    actualNextPhase = TASK_PHASES.FIXATION;
                    judgmentRecordedForCurrentTrial.current = false; // Reset for new trial
                } else { // Last trial finished, move to Recall
                    actualNextPhase = TASK_PHASES.RECALL;
                }
            } else {
                console.warn(`[Logic AdvancePhase] Unexpected request (${requestedNextPhase}) after PROCESSING_TRANSITION.`);
            }
        }
        // Handle Judgment Timeout signal from timer
        else if (currentPhaseSnapshot === TASK_PHASES.ODD_EVEN_JUDGMENT && requestedNextPhase === TASK_PHASES.PROCESSING_TRANSITION) {
             // The timer directly requests PROCESSING_TRANSITION on timeout
             const timeoutRecorded = handleJudgmentTimeout(); // Attempt to record the timeout
             if (timeoutRecorded) {
                 // If timeout was successfully recorded, the next phase is the ITI
                 actualNextPhase = TASK_PHASES.PROCESSING_TRANSITION;
             } else {
                 // Judgment was recorded just before timeout signal.
                 console.warn(`[Logic AdvancePhase] Judgment Timeout requested, but already handled. Current phase should already be PROCESSING_TRANSITION.`);
                 // Phase should have already been set by recordJudgment, so no change needed here.
                 return; // Exit early
             }
         }
        // Handle advancing FROM Fixation
        else if (currentPhaseSnapshot === TASK_PHASES.FIXATION && requestedNextPhase === TASK_PHASES.ODD_EVEN_JUDGMENT) {
            actualNextPhase = TASK_PHASES.ODD_EVEN_JUDGMENT;
            judgmentRecordedForCurrentTrial.current = false; // Reset before showing stimulus
        }
        // Handle advancing FROM Recall Timeout
        else if (currentPhaseSnapshot === TASK_PHASES.RECALL && requestedNextPhase === TASK_PHASES.RECALL_TIMEOUT) {
             console.log(`[Logic AdvancePhase] Recall timed out. Processing set with timeout flag.`);
             // Don't set phase here, _processAndAdvanceSet handles it after processing/saving
             _processAndAdvanceSet(true); // Process the set, marking recall as timed out
             return; // Exit early, phase managed by _processAndAdvanceSet
        }

        // Apply the determined phase change
        if (currentPhase !== actualNextPhase) {
             console.log(`[Logic AdvancePhase] Updating Phase State: ${currentPhase} -> ${actualNextPhase}`);
            setCurrentPhase(actualNextPhase);
        } else {
            console.log(`[Logic AdvancePhase] No phase change needed. Phase remains: ${currentPhase}`);
        }
    }, [ currentPhase, currentTrialIndexInSet, currentSetSize, setCurrentPhase, setCurrentTrialIndexInSet, handleJudgmentTimeout, _processAndAdvanceSet ]);


    // --- Development Skip Task Handler ---
    const handleDevSkipTask = useCallback(async () => {
        console.log('--- Dev Skip button clicked! ---');
        // ... (skip logic remains the same) ...
        if (process.env.NODE_ENV !== 'development') {
            console.warn("Attempted to skip task outside development environment.");
            return;
        }

        setIsLoading(true);
        setError(null);
        let fetchedIsFamiliar = false; // Default assumption

        try {
            // 1. Determine Familiarization Status by calling backend
            console.log("[DEV SKIP] Checking current eligibility status...");
            const checkEligibilityFunc = httpsCallable(functions, 'checkCstEligibility');
            const eligResult = await checkEligibilityFunc({ testType: CST_TEST_TYPES.COUNTING_SPAN });

            if (!eligResult?.data) throw new Error("Invalid response from eligibility check.");

            // Session IS familiarization if backend says familiarization is NOT complete
            fetchedIsFamiliar = !eligResult.data.familiarizationComplete;
            console.log(`[DEV SKIP] Determined session should be Familiarization: ${fetchedIsFamiliar} (Complete: ${eligResult.data.familiarizationComplete}, Count: ${eligResult.data.familiarizationCount})`);

            // 2. Generate Fake Results Structure
            const structureToUse = testStructure.length > 0 ? testStructure : [
                { id: 'dev_set_1', setSize: 3 }, { id: 'dev_set_2', setSize: 4 }, { id: 'dev_set_3', setSize: 5 }
            ];
            const fakeResults = structureToUse.map((setInfo) => {
                const setSize = setInfo.setSize;
                const presented = Array.from({ length: setSize }, () => Math.floor(Math.random() * 7) + 3);
                const recalled = presented.map(count => (Math.random() < 0.8 ? count : Math.floor(Math.random() * 7) + 3));
                const judgments = Array.from({ length: setSize }, (_, idx) => ({
                    trialIndex: idx, correct: Math.random() < 0.9,
                    responseTime: Math.floor(Math.random() * 1500) + 500, timedOut: false
                }));
                return { setId: setInfo.id, setSize: setSize, presentedCounts: presented, judgments: judgments, userRecallSequence: recalled, recallTimedOut: Math.random() < 0.05 };
            });
            console.log("[DEV SKIP] Generated fake results:", fakeResults.length);
            console.log(`[DEV SKIP] Calling submitFinalResultsToBackend with Familiarization: ${fetchedIsFamiliar}`);

            // 3. Set SAVING phase and call submission function WITH fake data AND determined status
            setCurrentPhase(TASK_PHASES.SAVING);
            // Pass fake results and determined familiarization status
            await submitFinalResultsToBackend(fakeResults, fetchedIsFamiliar);

        } catch (skipError) {
            console.error("[DEV SKIP] Error during skip process:", skipError);
            setError(`Skip failed: ${skipError.message || 'Could not determine status or submit.'}`);
            setIsLoading(false);
            setCurrentPhase(TASK_PHASES.RESULTS); // Show error on results screen
        }

    }, [testStructure, submitFinalResultsToBackend, setCurrentPhase, setIsLoading, setError]); // Dependencies


    // --- >>> NEW: Early Exit Handler <<< ---
    const handleExitAssessment = useCallback(async () => {
        console.log("[Exit Flow] User confirmed exit. Submitting current results...");
        // Clear any active timers immediately
        if (clearStimulusJudgmentTimer) clearStimulusJudgmentTimer();
        if (clearRecallTimer) clearRecallTimer();

        // Set loading/saving state
        setIsLoading(true);
        setError(null);
        setCurrentPhase(TASK_PHASES.SAVING); // Indicate saving

        // Submit the results accumulated *so far*. Pass the correct familiarization status.
        await submitFinalResultsToBackend(allSetResultsForSubmission.current, isFamiliarization);

        // submitFinalResultsToBackend will handle setting isLoading=false and phase=RESULTS
    }, [
        submitFinalResultsToBackend,
        isFamiliarization,
        setCurrentPhase,
        setIsLoading,
        setError,
        clearStimulusJudgmentTimer,
        clearRecallTimer
    ]);
    // --- >>> END NEW: Early Exit Handler <<< ---


    // --- Public Interface ---
    return {
        // State
        currentPhase, currentSet, currentTrialIndexInSet, currentStimulus,
        isLoading, error, isPractice, practiceStep, setSize: currentSetSize,
        testStructure, currentSetIndex, feedback, intermediateRecallSequence,

        // Results
        finalScorePCU, finalProcessingAccuracy, flaggedLowAccuracy, isFamiliarization,

        // Actions / Handlers
        // startPractice, finishPractice, // Keep if needed elsewhere, but not triggered from task screen
        startAssessment, recordJudgment,
        submitRecall,
        advancePhase,
        handleRecallChange,
        handleDevSkipTask, // Dev skip function
        handleExitAssessment, // <<< Export the new exit function
    };
};

export default useCountingSpanLogic;
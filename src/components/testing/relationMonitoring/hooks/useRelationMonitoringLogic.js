/* src/components/testing/relationMonitoring/hooks/useRelationMonitoringLogic.js */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser } from '../../../../contexts/UserContext';
import { RELATION_MONITORING_PHASES, RELATION_MONITORING_DEFAULTS } from '../../../../constants/relationMonitoringConstants';
import { functions, httpsCallable } from '../../../../firebaseConfig';
import { useRelationMonitoringTimer } from './useRelationMonitoringTimer';
import {
    generatePracticeTrials,
    isResponseCorrect,
    savePendingResults,
    getPendingResults,
    clearPendingResults,
} from './relationMonitoringHelpers';

const D = RELATION_MONITORING_DEFAULTS;
const P = RELATION_MONITORING_PHASES;

const TOTAL_TRIALS = D.BLOCKS * D.TRIALS_PER_BLOCK;

/**
 * Core logic hook for the Relation Monitoring assessment.
 *
 * Session structure (identical for familiarization and scored sessions):
 *   practice (5 arrays with feedback) -> READY -> 3 blocks of 36 continuous
 *   arrays (5.5s each, 100ms blink) with self-paced breaks between blocks ->
 *   save -> results.
 *
 * Unlike Visual Arrays there is no per-trial redo machinery: the stream is
 * continuous, so a trial corrupted by tab-hiding or frame stalls is flagged
 * by the timer's measured-duration check and excluded from scoring
 * server-side; heavy interruption simply yields a partial session.
 *
 * Stale-closure rule (VA convention): every value the stable timer callbacks
 * need at call time lives in a ref, never in captured state.
 *
 * NOTE: refreshUserData() is deliberately NOT called at save-success (known
 * CST/OSpan results-unmount bug) — the Task component's Done handler does it.
 */
const useRelationMonitoringLogic = (options = {}) => {
    const { earlyRetake = false, onExit } = options;
    const { userId } = useUser();

    // --- Core State ---
    const [currentPhase, setCurrentPhase] = useState(P.INSTRUCTIONS); // pre-init/loading
    const [currentTrialSpec, setCurrentTrialSpec] = useState(null);
    const [isPractice, setIsPractice] = useState(true);
    const [practiceNumber, setPracticeNumber] = useState(0);   // 1-based for display
    const [trialNumber, setTrialNumber] = useState(0);         // scored, 1-based global position
    const [blockNumber, setBlockNumber] = useState(0);         // 1-based for display
    const [respondedCurrent, setRespondedCurrent] = useState(false); // MATCH pressed for the on-screen array
    const [lastFeedbackCorrect, setLastFeedbackCorrect] = useState(null);
    const [isFamiliarization, setIsFamiliarization] = useState(false);
    const [hasScoredData, setHasScoredData] = useState(false);
    const [completedTrialCount, setCompletedTrialCount] = useState(0);
    const [canSavePartial, setCanSavePartial] = useState(false);
    const [notEligibleMessage, setNotEligibleMessage] = useState(null);
    const [finalScores, setFinalScores] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // --- Refs (mutated without re-render / read by stable closures) ---
    const phaseRef = useRef(currentPhase);
    const didInitRef = useRef(false);
    const isSubmittingRef = useRef(false);
    const isPracticeRef = useRef(true);
    const isFamiliarizationRef = useRef(false);
    const userIdRef = useRef(userId);
    const structureRef = useRef([]);          // all 108 server trial specs
    const recordsRef = useRef([]);            // finalized scored trial records (index-ordered)
    const practiceTrialsRef = useRef([]);
    const blockRef = useRef(0);               // current scored block, 0-based
    const displayedIndexRef = useRef(null);   // global index of the on-screen scored array
    const respondedRef = useRef(false);       // MATCH pressed for the on-screen array
    const completedCountRef = useRef(0);      // finalized, non-flagged scored trials
    const responseBlockedRef = useRef(false); // an overlay (exit modal) is blocking responses
    const obstructedRef = useRef(false);      // on-screen array was hidden/blocked at some point

    useEffect(() => {
        phaseRef.current = currentPhase;
    }, [currentPhase]);
    useEffect(() => {
        isPracticeRef.current = isPractice;
    }, [isPractice]);
    useEffect(() => {
        userIdRef.current = userId;
    }, [userId]);

    // The rAF timer can't see a brief tab-hide that starts and ends inside
    // one 5.5s array window — frame timestamps still measure ~5500ms — so
    // the trial must be flagged here: the user couldn't see the stimulus.
    useEffect(() => {
        const handler = () => {
            if (document.hidden && phaseRef.current === P.ARRAY && !isPracticeRef.current) {
                obstructedRef.current = true;
            }
        };
        document.addEventListener('visibilitychange', handler);
        return () => document.removeEventListener('visibilitychange', handler);
    }, []);

    // The Task reports overlay state (exit-confirm modal). The stream keeps
    // its protocol pace while the overlay is up, but a scored array the user
    // could not respond to must not be scored as a deliberate non-response.
    const setResponseBlocked = useCallback((blocked) => {
        responseBlockedRef.current = blocked;
        if (blocked && phaseRef.current === P.ARRAY && !isPracticeRef.current) {
            obstructedRef.current = true;
        }
    }, []);

    // True when the recorded trials can produce a score: the per-type floor
    // is met for BOTH match and non-match trials among unflagged records.
    // Mirrors the backend scoreRelationMonitoringSession null conditions.
    const computeCanSavePartial = () => {
        const scorable = recordsRef.current.filter(t => !t.presentationFlagged && !t.interrupted);
        return scorable.filter(t => t.isMatch).length >= D.MIN_TRIALS_PER_TYPE_FOR_SCORE
            && scorable.filter(t => !t.isMatch).length >= D.MIN_TRIALS_PER_TYPE_FOR_SCORE;
    };

    // --- Submission ---
    const cancelStreamRef = useRef(null); // assigned after the timer hook below
    const submitResults = useCallback(async () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        if (cancelStreamRef.current) cancelStreamRef.current();
        setIsLoading(true);
        setError(null);
        setCurrentPhase(P.SAVING);

        const uid = userIdRef.current;
        if (!uid) {
            setError('No user ID.');
            setIsLoading(false);
            isSubmittingRef.current = false;
            setCurrentPhase(P.RESULTS);
            return;
        }

        const payload = {
            isFamiliarization: isFamiliarizationRef.current,
            trials: recordsRef.current,
            ...(earlyRetake && { forceSubmit: true }),
        };

        try {
            const submitFunc = httpsCallable(functions, 'submitRelationMonitoringResults');
            const result = await submitFunc(payload);
            if (result.data?.success) {
                setFinalScores({
                    score: result.data.score ?? null,
                    hitRate: result.data.hitRate ?? null,
                    faRate: result.data.faRate ?? null,
                    blockScores: result.data.blockScores ?? null,
                    flaggedLowValidity: result.data.flaggedLowValidity === true,
                });
                clearPendingResults(uid);
                // refreshUserData() intentionally NOT called here (results-unmount
                // bug); the Done handler refreshes on navigation.
            } else {
                throw new Error(result.data?.message || 'Submission failed.');
            }
        } catch (err) {
            console.error('[RelationMonitoring] Submit error:', err);
            if (err.code !== 'functions/invalid-argument' && err.code !== 'functions/permission-denied') {
                savePendingResults(uid, payload);
                setError('Results saved locally. They will be submitted when you return to the assessment page.');
            } else {
                setError(`Failed to save results: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
            isSubmittingRef.current = false;
            setCurrentPhase(P.RESULTS);
        }
    }, [earlyRetake]);

    // --- Timer callbacks (stable; values they need live in refs) ---
    const handleArrayStart = useCallback((slotIndex) => {
        if (isSubmittingRef.current) return;
        respondedRef.current = false;
        // An array starting while the overlay is still up is obstructed from
        // its first frame. (Tab-hidden starts can't happen — rAF is paused.)
        obstructedRef.current = responseBlockedRef.current && !isPracticeRef.current;
        setRespondedCurrent(false);
        setLastFeedbackCorrect(null);
        if (isPracticeRef.current) {
            setCurrentTrialSpec(practiceTrialsRef.current[slotIndex]);
            setPracticeNumber(slotIndex + 1);
        } else {
            const globalIndex = blockRef.current * D.TRIALS_PER_BLOCK + slotIndex;
            displayedIndexRef.current = globalIndex;
            setCurrentTrialSpec(structureRef.current[globalIndex]);
            setTrialNumber(globalIndex + 1);
        }
        phaseRef.current = P.ARRAY;
        setCurrentPhase(P.ARRAY);
    }, []);

    const handleArrayEnd = useCallback((slotIndex, measuredMs, presentationValid) => {
        if (isSubmittingRef.current) return;

        if (isPracticeRef.current) {
            // Practice: right/wrong feedback in the inter-array gap. Validity
            // flags are irrelevant — nothing is recorded.
            const spec = practiceTrialsRef.current[slotIndex];
            setLastFeedbackCorrect(isResponseCorrect(spec, respondedRef.current));
            phaseRef.current = P.TRIAL_FEEDBACK;
            setCurrentPhase(P.TRIAL_FEEDBACK);
            return;
        }

        const globalIndex = blockRef.current * D.TRIALS_PER_BLOCK + slotIndex;
        const spec = structureRef.current[globalIndex];
        if (!spec) return;
        // A slot finalized without ever being displayed (rAF suspended) is a
        // skipped trial: no response was possible.
        const wasDisplayed = displayedIndexRef.current === globalIndex;
        const record = {
            index: spec.index,
            isMatch: spec.isMatch,
            targetLine: spec.targetLine,
            grid: spec.grid,
            responded: wasDisplayed ? respondedRef.current : false,
        };
        const obstructed = wasDisplayed && obstructedRef.current;
        if (!presentationValid || obstructed) {
            record.presentationFlagged = true;
            console.warn(`[RelationMonitoring] Trial ${globalIndex} flagged (${obstructed ? 'hidden/blocked during array' : `measured ${measuredMs}ms`})`);
        } else {
            completedCountRef.current += 1;
        }
        recordsRef.current.push(record);
        displayedIndexRef.current = null;
        setCompletedTrialCount(completedCountRef.current);
        setHasScoredData(true);
        setCanSavePartial(computeCanSavePartial());
        phaseRef.current = P.BLINK;
        setCurrentPhase(P.BLINK);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleStreamEnd = useCallback(() => {
        if (isSubmittingRef.current) return;
        if (isPracticeRef.current) {
            setIsPractice(false);
            isPracticeRef.current = false;
            setCurrentTrialSpec(null);
            phaseRef.current = P.READY;
            setCurrentPhase(P.READY); // post-practice "scored blocks start now"
            return;
        }
        setCurrentTrialSpec(null);
        if (blockRef.current < D.BLOCKS - 1) {
            phaseRef.current = P.BREAK;
            setCurrentPhase(P.BREAK); // self-paced; continueFromBreak resumes
        } else {
            submitResults();
        }
    }, [submitResults]);

    const { startStream, cancelStream } = useRelationMonitoringTimer({
        onArrayStart: handleArrayStart,
        onArrayEnd: handleArrayEnd,
        onStreamEnd: handleStreamEnd,
    });
    useEffect(() => {
        cancelStreamRef.current = cancelStream;
    }, [cancelStream]);

    // --- Response (single MATCH button / Space) ---
    const handleRespond = useCallback(() => {
        // Only the on-screen array window accepts responses; the first press
        // counts and later presses are ignored (no un-pressing).
        if (phaseRef.current !== P.ARRAY || respondedRef.current || isSubmittingRef.current) return;
        respondedRef.current = true;
        setRespondedCurrent(true);
    }, []);

    // --- Initialize Session (idempotent; called on mount) ---
    const initializeSession = useCallback(async () => {
        if (didInitRef.current) return;
        didInitRef.current = true;
        console.log('[RelationMonitoring] Initializing session...');
        setIsLoading(true);
        setError(null);

        try {
            const checkElig = httpsCallable(functions, 'checkRelationMonitoringEligibility');
            const eligResult = await checkElig({});
            const data = eligResult.data;
            const isFamiliar = !data.familiarizationComplete;
            setIsFamiliarization(isFamiliar);
            isFamiliarizationRef.current = isFamiliar;
            console.log(`[RelationMonitoring] Session type: ${isFamiliar ? 'familiarization' : 'scored'}. Eligible: ${data.isEligible}`);

            if (data.familiarizationComplete && !data.isEligible && !earlyRetake) {
                // Not eligible AND not an explicitly-confirmed early retake.
                setNotEligibleMessage(data.nextAvailableDateString || 'You are not eligible for a new assessment yet.');
                setIsLoading(false);
                setCurrentPhase(P.RESULTS);
                return;
            }

            const getStructure = httpsCallable(functions, 'getRelationMonitoringStructure');
            const structResult = await getStructure({ forceStart: earlyRetake });
            const { trials } = structResult.data || {};
            if (!Array.isArray(trials) || trials.length !== TOTAL_TRIALS) {
                throw new Error('Invalid trial structure received.');
            }
            structureRef.current = trials;
            recordsRef.current = [];
            completedCountRef.current = 0;
            blockRef.current = 0;
            console.log(`[RelationMonitoring] Structure cached: ${trials.length} trials.`);

            setIsLoading(false);
            // Start-flow convention: begin with practice directly (no in-task
            // READY before practice — the summary-page confirm was press 2).
            practiceTrialsRef.current = generatePracticeTrials();
            setIsPractice(true);
            isPracticeRef.current = true;
            phaseRef.current = P.ARRAY;
            startStream(practiceTrialsRef.current.length, D.TRIAL_FEEDBACK_MS);
        } catch (err) {
            console.error('[RelationMonitoring] Init error:', err);
            setError(`Failed to initialize: ${err.message}`);
            setIsLoading(false);
            setCurrentPhase(P.RESULTS);
        }
    }, [earlyRetake, startStream]);

    // --- READY / BREAK continuations ---
    const startScoredBlock = useCallback(() => {
        if (phaseRef.current !== P.READY) return;
        blockRef.current = 0;
        setBlockNumber(1);
        // Synchronous phase assignment guards a double-activated READY button
        // (the timer's first array tick is ~2 frames away).
        phaseRef.current = P.BLINK;
        setCurrentPhase(P.BLINK);
        startStream(D.TRIALS_PER_BLOCK, D.BLINK_MS);
    }, [startStream]);

    const continueFromBreak = useCallback(() => {
        if (phaseRef.current !== P.BREAK) return;
        blockRef.current += 1;
        setBlockNumber(blockRef.current + 1);
        phaseRef.current = P.BLINK;
        setCurrentPhase(P.BLINK);
        startStream(D.TRIALS_PER_BLOCK, D.BLINK_MS);
    }, [startStream]);

    // --- Skip Practice (scored sessions only; button hidden otherwise) ---
    // Jumps from any practice moment straight to the READY interstitial. RM
    // is a continuous rAF stream with no timeouts, so cancelling the stream
    // is the whole teardown (mirrors handleExitAssessment). Scored structure
    // (structureRef, recordsRef, blockRef, completedCountRef) is untouched;
    // practice records were never destined for the payload.
    const skipPractice = useCallback(() => {
        if (!isPracticeRef.current) return;
        // isPractice initializes true and persists when init lands directly on
        // RESULTS (not-eligible / init-error) — never skip from those screens.
        if (phaseRef.current === P.RESULTS
            || phaseRef.current === P.SAVING
            || phaseRef.current === P.INSTRUCTIONS) return;
        cancelStreamRef.current?.();
        respondedRef.current = false;
        displayedIndexRef.current = null;
        setRespondedCurrent(false);
        setCurrentTrialSpec(null);
        setIsPractice(false);
        isPracticeRef.current = false;
        phaseRef.current = P.READY; // sync BEFORE setCurrentPhase — startScoredBlock guards on it
        setCurrentPhase(P.READY);
    }, []);

    // --- Early Exit ---
    const handleExitAssessment = useCallback(async () => {
        // The session may have finished while the exit-confirm modal was
        // open (block 3 ended -> auto-submit). A second submit would store a
        // duplicate cstHistory entry on earlyRetake, or paint a spurious
        // cooldown error over real results otherwise.
        if (isSubmittingRef.current || phaseRef.current === P.SAVING || phaseRef.current === P.RESULTS) return;
        cancelStream();
        // Submit only when a score is actually computable (per-type floor met
        // for both match and non-match trials) — otherwise the backend would
        // reject the partial. Familiarization exits are always discarded.
        if (isFamiliarizationRef.current || !computeCanSavePartial()) {
            if (onExit) onExit();
        } else {
            await submitResults();
        }
    }, [submitResults, onExit, cancelStream]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Dev Skip (development builds only) ---
    const handleDevSkipTask = useCallback(async () => {
        if (process.env.NODE_ENV !== 'development') return;
        cancelStream();
        const lastIndex = recordsRef.current.length > 0
            ? recordsRef.current[recordsRef.current.length - 1].index
            : -1;
        for (const spec of structureRef.current.filter(t => t.index > lastIndex)) {
            const correct = Math.random() < 0.85;
            recordsRef.current.push({
                index: spec.index,
                isMatch: spec.isMatch,
                targetLine: spec.targetLine,
                grid: spec.grid,
                responded: correct ? spec.isMatch : !spec.isMatch,
            });
            completedCountRef.current += 1;
        }
        setCompletedTrialCount(completedCountRef.current);
        setHasScoredData(recordsRef.current.length > 0);
        await submitResults();
    }, [submitResults, cancelStream]);

    return {
        // State
        currentPhase, currentTrialSpec, isPractice, practiceNumber,
        practiceTotal: practiceTrialsRef.current.length || D.PRACTICE_TRIALS,
        trialNumber, totalTrials: TOTAL_TRIALS, blockNumber, totalBlocks: D.BLOCKS,
        respondedCurrent, completedTrialCount, canSavePartial,
        lastFeedbackCorrect, isFamiliarization, hasScoredData,
        notEligibleMessage, finalScores, isLoading, error,
        // Actions
        initializeSession, startScoredBlock, continueFromBreak, skipPractice,
        handleRespond, handleExitAssessment, handleDevSkipTask,
        setResponseBlocked,
    };
};

// Re-exported for the summary page pending-results recovery
export { getPendingResults, clearPendingResults };
export default useRelationMonitoringLogic;

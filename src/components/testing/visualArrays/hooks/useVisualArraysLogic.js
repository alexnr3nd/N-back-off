/* src/components/testing/visualArrays/hooks/useVisualArraysLogic.js */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser } from '../../../../contexts/UserContext';
import { VISUAL_ARRAYS_PHASES, VISUAL_ARRAYS_DEFAULTS } from '../../../../constants/visualArraysConstants';
import { functions, httpsCallable } from '../../../../firebaseConfig';
import { useVisualArraysTimer } from './useVisualArraysTimer';
import {
    generatePracticeTrials,
    generateLocalTrialSpec,
    isResponseCorrect,
    savePendingResults,
    getPendingResults,
    clearPendingResults,
} from './visualArraysHelpers';

const D = VISUAL_ARRAYS_DEFAULTS;
const P = VISUAL_ARRAYS_PHASES;

// Phases where browser tab-hiding corrupts the timed presentation
const PRESENTATION_PHASES = [P.FIXATION, P.CUE, P.CUE_GAP, P.ARRAY, P.RETENTION];

const TOTAL_TRIALS = D.SET_SIZES.length * D.TRIALS_PER_SET_SIZE;

/**
 * Core logic hook for the Visual Arrays assessment.
 *
 * Session structure (identical for familiarization and scored sessions):
 *   practice (8 trials, feedback) -> READY -> 120 scored trials with a
 *   self-paced break after trial 60 -> save -> results.
 *
 * Per the start-flow convention the task begins with practice directly on
 * mount (no in-task READY before practice); READY is only the post-practice
 * "scored block starts now" interstitial.
 *
 * Stale-closure rule: the presentation/advance callback chain is built from
 * stable (deps-free or stable-dep) useCallbacks, so every cross-callback
 * value they need at call time lives in a ref (isFamiliarizationRef,
 * userIdRef, timeoutHandlerRef, queueRef, ...), never in captured state.
 *
 * NOTE: refreshUserData() is deliberately NOT called at save-success (known
 * CST/OSpan results-unmount bug) — the Task component's Done handler does it.
 */
const useVisualArraysLogic = (options = {}) => {
    const { earlyRetake = false, onExit } = options;
    const { userId } = useUser();

    // --- Core State ---
    const [currentPhase, setCurrentPhase] = useState(P.INSTRUCTIONS); // pre-init/loading
    const [currentTrialSpec, setCurrentTrialSpec] = useState(null);
    const [isPractice, setIsPractice] = useState(true);
    const [practiceNumber, setPracticeNumber] = useState(0);   // 1-based for display
    const [trialNumber, setTrialNumber] = useState(0);         // scored, 1-based for display
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
    const trialRespondedRef = useRef(false);  // response/timeout/void race guard
    const queueRef = useRef([]);              // remaining scored trial specs
    const sparesRef = useRef({});             // per-set-size spare pools
    const trialsRef = useRef([]);             // recorded scored trial records
    const practiceTrialsRef = useRef([]);
    const practiceIndexRef = useRef(0);
    const currentTrialRef = useRef(null);     // in-flight trial spec
    const trialMetaRef = useRef({ blurredDuringResponse: false, measuredArrayOnMs: null });
    const completedCountRef = useRef(0);      // completed (non-voided) scored trials
    const redoCountRef = useRef(0);
    const breakTakenRef = useRef(false);
    const probeOnsetRef = useRef(null);
    const responseTimeoutRef = useRef(null);
    const itiTimeoutRef = useRef(null);
    const feedbackTimeoutRef = useRef(null);
    const interruptedTimeoutRef = useRef(null);
    const timeoutHandlerRef = useRef(null);   // fresh response-timeout handler
    const pendingTrialRef = useRef(null);     // trial whose start was deferred / redo spare
    const pendingRestartRef = useRef(false);  // interrupted notice elapsed while still hidden

    useEffect(() => {
        phaseRef.current = currentPhase;
    }, [currentPhase]);
    useEffect(() => {
        isPracticeRef.current = isPractice;
    }, [isPractice]);
    useEffect(() => {
        userIdRef.current = userId;
    }, [userId]);

    const clearAllTimeouts = useCallback(() => {
        [responseTimeoutRef, itiTimeoutRef, feedbackTimeoutRef, interruptedTimeoutRef].forEach((ref) => {
            if (ref.current) {
                clearTimeout(ref.current);
                ref.current = null;
            }
        });
    }, []);

    // --- Timer callbacks (stable; values they need live in refs) ---
    const handlePresentationPhase = useCallback((phase) => {
        if (isSubmittingRef.current) return;
        setCurrentPhase(phase);
    }, []);

    const voidTrialRef = useRef(null);        // fresh voidAndRedoCurrentTrial

    const handleProbeOnset = useCallback((measuredArrayOnMs, presentationValid) => {
        if (isSubmittingRef.current) return;
        if (!presentationValid) {
            // A long frame stall jumped over the cue or array window — the
            // stimulus was never (or only partially) painted. Void + redo,
            // exactly like a tab-hidden interruption.
            console.warn(`[VisualArrays] Invalid presentation (measured ${measuredArrayOnMs}ms) — voiding trial`);
            if (voidTrialRef.current) voidTrialRef.current();
            return;
        }
        trialMetaRef.current.measuredArrayOnMs = measuredArrayOnMs;
        probeOnsetRef.current = performance.now();
        if (measuredArrayOnMs !== null) {
            console.log(`[VisualArrays] measuredArrayOnMs: ${measuredArrayOnMs}`);
        }
        // Response collection is not stimulus presentation; setTimeout is fine.
        responseTimeoutRef.current = setTimeout(() => {
            if (timeoutHandlerRef.current) timeoutHandlerRef.current();
        }, D.RESPONSE_TIMEOUT_MS);
    }, []);

    const { startTrialPresentation, cancelPresentation } = useVisualArraysTimer({
        onPhaseChange: handlePresentationPhase,
        onProbe: handleProbeOnset,
    });

    // --- Interrupted notice scheduling ---
    // Declared before its users; resumeRef carries the fresh resume callback.
    const resumeRef = useRef(null);
    const scheduleInterruptedNotice = useCallback(() => {
        if (interruptedTimeoutRef.current) clearTimeout(interruptedTimeoutRef.current);
        interruptedTimeoutRef.current = setTimeout(() => {
            interruptedTimeoutRef.current = null;
            if (document.hidden) {
                pendingRestartRef.current = true; // resume when the tab returns
            } else if (resumeRef.current) {
                resumeRef.current();
            }
        }, D.INTERRUPTED_NOTICE_MS);
    }, []);

    // --- Single Trial Reset Point (practice AND scored) ---
    const prepareTrial = useCallback((spec) => {
        // A trial that would START while the tab is hidden must be deferred or
        // its presentation would run throttled and unseen. No redo is consumed:
        // nothing was presented yet.
        if (document.hidden) {
            pendingTrialRef.current = spec;
            phaseRef.current = P.INTERRUPTED; // synchronous: see below
            setCurrentPhase(P.INTERRUPTED);
            scheduleInterruptedNotice();
            return;
        }
        pendingTrialRef.current = null;
        currentTrialRef.current = spec;
        trialMetaRef.current = { blurredDuringResponse: false, measuredArrayOnMs: null };
        trialRespondedRef.current = false;
        probeOnsetRef.current = null;
        // Assign phaseRef synchronously: the timer's first FIXATION tick is
        // ~2 frames away and the React effect that syncs phaseRef runs even
        // later, so without this a double-activation of the READY/BREAK
        // button would pass the phase guard twice and silently drop a queued
        // trial from the 120-trial deck.
        phaseRef.current = P.FIXATION;
        setLastFeedbackCorrect(null);
        setCurrentTrialSpec(spec);
        if (isPracticeRef.current) {
            setPracticeNumber(practiceIndexRef.current + 1);
        } else {
            setTrialNumber(completedCountRef.current + 1);
        }
        startTrialPresentation();
    }, [startTrialPresentation, scheduleInterruptedNotice]);

    // --- Submission ---
    const submitResults = useCallback(async () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        clearAllTimeouts();
        cancelPresentation();
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
            trials: trialsRef.current,
            ...(earlyRetake && { forceSubmit: true }),
        };

        try {
            const submitFunc = httpsCallable(functions, 'submitVisualArraysResults');
            const result = await submitFunc(payload);
            if (result.data?.success) {
                setFinalScores({
                    scoreK: result.data.scoreK ?? null,
                    kBySetSize: result.data.kBySetSize ?? null,
                    overallAccuracy: result.data.overallAccuracy ?? null,
                    flaggedLowAccuracy: result.data.flaggedLowAccuracy === true,
                });
                clearPendingResults(uid);
                // refreshUserData() intentionally NOT called here (results-unmount
                // bug); the Done handler refreshes on navigation.
            } else {
                throw new Error(result.data?.message || 'Submission failed.');
            }
        } catch (err) {
            console.error('[VisualArrays] Submit error:', err);
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
    }, [earlyRetake, clearAllTimeouts, cancelPresentation]);

    // --- Scored flow advancement ---
    const proceedToNextScoredTrial = useCallback(() => {
        if (isSubmittingRef.current) return;
        if (queueRef.current.length === 0) {
            submitResults();
            return;
        }
        prepareTrial(queueRef.current.shift());
    }, [prepareTrial, submitResults]);

    const advanceAfterScoredTrial = useCallback(() => {
        if (completedCountRef.current === D.BREAK_AFTER_TRIAL
            && !breakTakenRef.current
            && queueRef.current.length > 0) {
            breakTakenRef.current = true;
            setCurrentPhase(P.BREAK); // self-paced; continueFromBreak resumes
            return;
        }
        // Blank field during the inter-trial interval
        setCurrentPhase(P.CUE_GAP);
        itiTimeoutRef.current = setTimeout(() => {
            itiTimeoutRef.current = null;
            proceedToNextScoredTrial();
        }, D.ITI_MS);
    }, [proceedToNextScoredTrial]);

    // --- Practice flow advancement ---
    const advancePractice = useCallback(() => {
        const nextIndex = practiceIndexRef.current + 1;
        if (nextIndex < practiceTrialsRef.current.length) {
            practiceIndexRef.current = nextIndex;
            prepareTrial(practiceTrialsRef.current[nextIndex]);
        } else {
            setIsPractice(false);
            isPracticeRef.current = false;
            setCurrentTrialSpec(null);
            setCurrentPhase(P.READY); // post-practice "scored block starts now"
        }
    }, [prepareTrial]);

    // True when the recorded trials can produce a k: some set size has
    // reached the per-set-size floor with both trial classes present.
    // Mirrors the backend scoreVisualArraysSession null conditions — a
    // TOTAL count is not enough, because the deck interleaves set sizes.
    const computeCanSavePartial = () => D.SET_SIZES.some((setSize) => {
        const subset = trialsRef.current.filter(t => !t.interrupted && t.setSize === setSize);
        return subset.length >= D.MIN_TRIALS_PER_SET_SIZE_FOR_K
            && subset.some(t => t.changed)
            && subset.some(t => !t.changed);
    });

    // --- Trial completion (response or timeout) ---
    const finishTrial = useCallback((response, rtMs, timedOut) => {
        const spec = currentTrialRef.current;
        if (!spec) return;

        if (isPracticeRef.current) {
            setLastFeedbackCorrect(!timedOut && isResponseCorrect(spec, response));
            setCurrentPhase(P.TRIAL_FEEDBACK);
            feedbackTimeoutRef.current = setTimeout(() => {
                feedbackTimeoutRef.current = null;
                advancePractice();
            }, D.TRIAL_FEEDBACK_MS);
            return;
        }

        trialsRef.current.push({
            trialId: spec.trialId,
            setSize: spec.setSize,
            cueColor: spec.cueColor,
            changed: spec.changed,
            probeIndex: spec.probeIndex,
            response,
            rtMs,
            timedOut,
            interrupted: false,
            redo: spec.redo === true,
            measuredArrayOnMs: trialMetaRef.current.measuredArrayOnMs,
            blurredDuringResponse: trialMetaRef.current.blurredDuringResponse,
        });
        completedCountRef.current += 1;
        setCompletedTrialCount(completedCountRef.current);
        setHasScoredData(true);
        setCanSavePartial(computeCanSavePartial());
        advanceAfterScoredTrial();
    }, [advancePractice, advanceAfterScoredTrial]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRespond = useCallback((response) => {
        if (phaseRef.current !== P.PROBE || trialRespondedRef.current || isSubmittingRef.current) return;
        trialRespondedRef.current = true;
        if (responseTimeoutRef.current) {
            clearTimeout(responseTimeoutRef.current);
            responseTimeoutRef.current = null;
        }
        const rtMs = probeOnsetRef.current != null
            ? Math.round(performance.now() - probeOnsetRef.current)
            : null;
        finishTrial(response, rtMs, false);
    }, [finishTrial]);

    const handleResponseTimeout = useCallback(() => {
        if (phaseRef.current !== P.PROBE || trialRespondedRef.current || isSubmittingRef.current) return;
        trialRespondedRef.current = true;
        responseTimeoutRef.current = null;
        finishTrial(null, null, true);
    }, [finishTrial]);

    // Keep the scheduled timeout pointing at the fresh handler
    useEffect(() => {
        timeoutHandlerRef.current = handleResponseTimeout;
    }, [handleResponseTimeout]);

    // --- Interruption recovery ---
    const resumeInterruptedTrial = useCallback(() => {
        const pending = pendingTrialRef.current;
        pendingTrialRef.current = null;
        if (pending) {
            prepareTrial(pending);
        } else if (!isPracticeRef.current) {
            proceedToNextScoredTrial(); // redo budget/spares exhausted: skip ahead
        }
    }, [prepareTrial, proceedToNextScoredTrial]);

    useEffect(() => {
        resumeRef.current = resumeInterruptedTrial;
    }, [resumeInterruptedTrial]);

    // Void the in-flight trial and route it through the spare-redo machinery.
    // Shared by the tab-hidden interruption path and the invalid-presentation
    // path (frame stall skipped the cue/array window).
    const voidAndRedoCurrentTrial = useCallback(() => {
        if (!currentTrialRef.current || trialRespondedRef.current || isSubmittingRef.current) return;
        trialRespondedRef.current = true;
        cancelPresentation();
        if (responseTimeoutRef.current) {
            clearTimeout(responseTimeoutRef.current);
            responseTimeoutRef.current = null;
        }
        const spec = currentTrialRef.current;
        if (isPracticeRef.current) {
            // Practice is local: redo with a fresh layout, nothing recorded
            pendingTrialRef.current = {
                ...generateLocalTrialSpec(spec.setSize, spec.changed, spec.cueColor),
                trialId: `${spec.trialId}r`,
            };
        } else {
            trialsRef.current.push({
                trialId: spec.trialId,
                setSize: spec.setSize,
                cueColor: spec.cueColor,
                changed: spec.changed,
                probeIndex: spec.probeIndex,
                response: null,
                rtMs: null,
                timedOut: false,
                interrupted: true,
                redo: spec.redo === true,
                measuredArrayOnMs: null,
                blurredDuringResponse: false,
            });
            if (redoCountRef.current < D.MAX_TRIAL_REDOS) {
                const spare = sparesRef.current?.[spec.setSize]?.shift();
                if (spare) {
                    redoCountRef.current += 1;
                    pendingTrialRef.current = { ...spare, redo: true };
                }
            }
        }
        phaseRef.current = P.INTERRUPTED;
        setCurrentPhase(P.INTERRUPTED);
        scheduleInterruptedNotice();
    }, [cancelPresentation, scheduleInterruptedNotice]);

    useEffect(() => {
        voidTrialRef.current = voidAndRedoCurrentTrial;
    }, [voidAndRedoCurrentTrial]);

    // Refs so the single visibility listener always sees fresh callbacks
    const visibilityDepsRef = useRef({});
    visibilityDepsRef.current = { resumeInterruptedTrial, voidAndRedoCurrentTrial };

    useEffect(() => {
        const handler = () => {
            const phase = phaseRef.current;
            if (!document.hidden) {
                if (phase === P.INTERRUPTED && pendingRestartRef.current) {
                    pendingRestartRef.current = false;
                    visibilityDepsRef.current.resumeInterruptedTrial();
                }
                return;
            }
            // Tab just hid. trialRespondedRef distinguishes mid-presentation
            // (void + redo) from the ITI window, where the deferred-start path
            // in prepareTrial takes over instead.
            if (PRESENTATION_PHASES.includes(phase)
                && currentTrialRef.current
                && !trialRespondedRef.current
                && !isSubmittingRef.current) {
                visibilityDepsRef.current.voidAndRedoCurrentTrial();
            } else if (phase === P.PROBE && !trialRespondedRef.current) {
                // Stimulus already gone; flag, don't void
                trialMetaRef.current.blurredDuringResponse = true;
            }
        };
        document.addEventListener('visibilitychange', handler);
        return () => document.removeEventListener('visibilitychange', handler);
    }, []);

    // --- Initialize Session (idempotent; called on mount) ---
    const initializeSession = useCallback(async () => {
        if (didInitRef.current) return;
        didInitRef.current = true;
        console.log('[VisualArrays] Initializing session...');
        setIsLoading(true);
        setError(null);

        try {
            const checkElig = httpsCallable(functions, 'checkVisualArraysEligibility');
            const eligResult = await checkElig({});
            const data = eligResult.data;
            const isFamiliar = !data.familiarizationComplete;
            setIsFamiliarization(isFamiliar);
            isFamiliarizationRef.current = isFamiliar;
            console.log(`[VisualArrays] Session type: ${isFamiliar ? 'familiarization' : 'scored'}. Eligible: ${data.isEligible}`);

            if (data.familiarizationComplete && !data.isEligible && !earlyRetake) {
                // Not eligible AND not an explicitly-confirmed early retake.
                setNotEligibleMessage(data.nextAvailableDateString || 'You are not eligible for a new assessment yet.');
                setIsLoading(false);
                setCurrentPhase(P.RESULTS);
                return;
            }

            const getStructure = httpsCallable(functions, 'getVisualArraysStructure');
            const structResult = await getStructure({ forceStart: earlyRetake });
            const { trials, spares } = structResult.data || {};
            if (!Array.isArray(trials) || trials.length === 0 || !spares) {
                throw new Error('Invalid trial structure received.');
            }
            queueRef.current = trials;
            sparesRef.current = spares;
            trialsRef.current = [];
            completedCountRef.current = 0;
            redoCountRef.current = 0;
            breakTakenRef.current = false;
            console.log(`[VisualArrays] Structure cached: ${trials.length} trials.`);

            setIsLoading(false);
            // Start-flow convention: begin with practice directly (no in-task
            // READY before practice — the summary-page confirm was press 2).
            practiceTrialsRef.current = generatePracticeTrials();
            practiceIndexRef.current = 0;
            setIsPractice(true);
            isPracticeRef.current = true;
            prepareTrial(practiceTrialsRef.current[0]);
        } catch (err) {
            console.error('[VisualArrays] Init error:', err);
            setError(`Failed to initialize: ${err.message}`);
            setIsLoading(false);
            setCurrentPhase(P.RESULTS);
        }
    }, [earlyRetake, prepareTrial]);

    // --- READY / BREAK continuations ---
    const startScoredBlock = useCallback(() => {
        if (phaseRef.current !== P.READY) return;
        proceedToNextScoredTrial();
    }, [proceedToNextScoredTrial]);

    const continueFromBreak = useCallback(() => {
        if (phaseRef.current !== P.BREAK) return;
        proceedToNextScoredTrial();
    }, [proceedToNextScoredTrial]);

    // --- Skip Practice (scored sessions only; button hidden otherwise) ---
    // Jumps from any practice moment straight to the READY interstitial.
    // Mirrors handleExitAssessment's teardown; scored structure (queueRef,
    // sparesRef, trialsRef, counters) is untouched.
    const skipPractice = useCallback(() => {
        if (!isPracticeRef.current) return;
        // isPractice initializes true and persists when init lands directly on
        // RESULTS (not-eligible / init-error) — skipping from those screens
        // would drain an empty queueRef straight into submitResults.
        if (phaseRef.current === P.RESULTS
            || phaseRef.current === P.SAVING
            || phaseRef.current === P.INSTRUCTIONS) return;
        cancelPresentation();
        clearAllTimeouts();
        trialRespondedRef.current = true; // gates the visibilitychange void-and-redo handler
        pendingTrialRef.current = null;
        setCurrentTrialSpec(null);
        setLastFeedbackCorrect(null);
        setIsPractice(false);
        isPracticeRef.current = false;
        phaseRef.current = P.READY; // sync BEFORE setCurrentPhase — startScoredBlock guards on it
        setCurrentPhase(P.READY);
    }, [cancelPresentation, clearAllTimeouts]);

    // --- Early Exit ---
    const handleExitAssessment = useCallback(async () => {
        cancelPresentation();
        clearAllTimeouts();
        // Submit only when a k is actually computable (per-set-size floor met
        // in at least one set size) — otherwise the backend would reject the
        // partial, or worse, store a scoreK:null entry that burns the 30-day
        // cooldown. Familiarization exits are always discarded.
        if (isFamiliarizationRef.current || !computeCanSavePartial()) {
            if (onExit) onExit();
        } else {
            await submitResults();
        }
    }, [submitResults, onExit, cancelPresentation, clearAllTimeouts]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Dev Skip (development builds only) ---
    const handleDevSkipTask = useCallback(async () => {
        if (process.env.NODE_ENV !== 'development') return;
        cancelPresentation();
        clearAllTimeouts();
        const remaining = [...queueRef.current];
        queueRef.current = [];
        for (const spec of remaining) {
            const correct = Math.random() < 0.85;
            const correctResponse = spec.changed ? 'different' : 'same';
            const wrongResponse = spec.changed ? 'same' : 'different';
            trialsRef.current.push({
                trialId: spec.trialId,
                setSize: spec.setSize,
                cueColor: spec.cueColor,
                changed: spec.changed,
                probeIndex: spec.probeIndex,
                response: correct ? correctResponse : wrongResponse,
                rtMs: 500 + Math.round(Math.random() * 1000),
                timedOut: false,
                interrupted: false,
                redo: false,
                measuredArrayOnMs: 250,
                blurredDuringResponse: false,
            });
            completedCountRef.current += 1;
        }
        setCompletedTrialCount(completedCountRef.current);
        setHasScoredData(trialsRef.current.length > 0);
        await submitResults();
    }, [submitResults, cancelPresentation, clearAllTimeouts]);

    // --- Unmount cleanup ---
    useEffect(() => () => {
        clearAllTimeouts();
    }, [clearAllTimeouts]);

    return {
        // State
        currentPhase, currentTrialSpec, isPractice, practiceNumber,
        practiceTotal: practiceTrialsRef.current.length || 8,
        trialNumber, totalTrials: TOTAL_TRIALS, completedTrialCount, canSavePartial,
        lastFeedbackCorrect, isFamiliarization, hasScoredData,
        notEligibleMessage, finalScores, isLoading, error,
        // Actions
        initializeSession, startScoredBlock, continueFromBreak, skipPractice,
        handleRespond, handleExitAssessment, handleDevSkipTask,
    };
};

// Re-exported for the summary page pending-results recovery
export { getPendingResults, clearPendingResults };
export default useVisualArraysLogic;

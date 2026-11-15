/* src/components/testing/antisaccade/hooks/useAntisaccadeLogic.js */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser } from '../../../../contexts/UserContext';
import {
    ANTISACCADE_PHASES,
    ANTISACCADE_TIMING,
    ANTISACCADE_CONFIG,
} from '../../../../constants/antisaccadeConstants';
import { functions, httpsCallable } from '../../../../firebaseConfig';
import audioManager from '../../../../utils/audioManager';
import { useAntisaccadeTimer } from './useAntisaccadeTimer';
import {
    generatePracticeTrials,
    buildTrialRecord,
    makeRedoPracticeSpec,
    resolveInputModality,
    mapFinalScores,
    unlockAudio,
    scheduleBeep,
    savePendingResults,
    getPendingResults,
    clearPendingResults,
} from './antisaccadeHelpers';

const P = ANTISACCADE_PHASES;
const T = ANTISACCADE_TIMING;
const C = ANTISACCADE_CONFIG;

// Phases where browser tab-hiding corrupts the timed presentation. The
// response window opens at MASK onset, so — matching VA's rule that a hide
// during the response window is NOT a presentation corruption — MASK and
// RESPONSE are excluded (they get the blurredDuringResponse flag instead);
// deliberately narrower than the full presentation set.
const VOID_ON_HIDE_PHASES = [P.FIXATION, P.TONE, P.CUE, P.TARGET];

/**
 * Core logic hook for the Antisaccade assessment (clone of
 * useVisualArraysLogic — every load-bearing pattern preserved).
 *
 * Session structure (identical for familiarization and scored sessions):
 *   initializeSession() (eligibility + server structure) -> isReadyToStart ->
 *   startSession() (user gesture: audio route refresh + unlock) ->
 *   16 practice trials (client deck, 300ms target, feedback) -> READY ->
 *   72 scored trials (100ms target, feedback kept per protocol) with a
 *   self-paced BREAK after scored trial 36 -> save -> RESULTS.
 *
 * Response window (design-doc reconciliation): responding opens at MASK
 * ONSET; responseOnsetRef anchors RT there. Because the timer's validity
 * verdict only arrives at the RESPONSE boundary, a MASK-phase response is
 * captured into pendingResponseRef (claiming the trialRespondedRef
 * once-guard) and the trial finishes — or, if the presentation turns out
 * invalid, is voided and the guess discarded — when onResponseReady fires.
 *
 * Stale-closure rule: the presentation/advance callback chain is built from
 * stable (deps-free or stable-dep) useCallbacks, so every cross-callback
 * value they need at call time lives in a ref, never in captured state.
 *
 * NOTE: refreshUserData() is deliberately NOT called at save-success (known
 * CST/OSpan results-unmount bug) — the Task component's Done handler does it.
 */
const useAntisaccadeLogic = (options = {}) => {
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
    const [isReadyToStart, setIsReadyToStart] = useState(false); // structure loaded, awaiting start gesture
    const [error, setError] = useState(null);

    // --- Refs (mutated without re-render / read by stable closures) ---
    const phaseRef = useRef(currentPhase);
    const didInitRef = useRef(false);
    const didStartRef = useRef(false);
    const isSubmittingRef = useRef(false);
    const isPracticeRef = useRef(true);
    const isFamiliarizationRef = useRef(false);
    const userIdRef = useRef(userId);
    const trialRespondedRef = useRef(false);  // response/timeout/void race guard
    const queueRef = useRef([]);              // remaining scored trial specs
    const sparesRef = useRef([]);             // flat spare pool (server-generated)
    const trialsRef = useRef([]);             // recorded scored trial records
    const practiceTrialsRef = useRef([]);
    const practiceIndexRef = useRef(0);
    const currentTrialRef = useRef(null);     // in-flight trial spec
    const trialMetaRef = useRef({ blurredDuringResponse: false, measuredTargetMs: null });
    const completedCountRef = useRef(0);      // completed (non-voided) scored trials
    const redoCountRef = useRef(0);
    const breakTakenRef = useRef(false);
    const responseOnsetRef = useRef(null);    // mask onset — RT anchor
    const pendingResponseRef = useRef(null);  // MASK-phase response awaiting the validity verdict
    const keyCountRef = useRef(0);            // scored-block modality tally
    const touchCountRef = useRef(0);
    const lastModalityRef = useRef(null);     // tie-breaker: last response's modality
    const responseTimeoutRef = useRef(null);
    const itiTimeoutRef = useRef(null);
    const feedbackTimeoutRef = useRef(null);
    const interruptedTimeoutRef = useRef(null);
    const timeoutHandlerRef = useRef(null);   // fresh response-timeout handler
    const pendingTrialRef = useRef(null);     // trial whose start was deferred / redo spare
    const pendingRestartRef = useRef(false);  // interrupted notice elapsed while still hidden/blocked
    const orientationBlockedRef = useRef(false); // C6 portrait overlay up — defer trial starts

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
    const voidTrialRef = useRef(null);        // fresh voidAndRedoCurrentTrial
    const finishTrialRef = useRef(null);      // fresh finishTrial (for the deferred MASK finish)

    const handlePresentationPhase = useCallback((phase) => {
        if (isSubmittingRef.current) return;
        if (phase === P.MASK && !trialRespondedRef.current) {
            // Mask onset opens the response window (protocol reconciliation):
            // RT anchors here and the safety timeout starts here. Response
            // collection is not stimulus presentation; setTimeout is fine.
            responseOnsetRef.current = performance.now();
            responseTimeoutRef.current = setTimeout(() => {
                if (timeoutHandlerRef.current) timeoutHandlerRef.current();
            }, T.RESPONSE_TIMEOUT_MS);
        }
        setCurrentPhase(phase);
    }, []);

    const handleTone = useCallback(() => {
        // Fire-and-forget: scheduleBeep traps all audio errors internally;
        // the visual trial proceeds regardless.
        scheduleBeep();
    }, []);

    const handleResponseReady = useCallback((measuredTargetMs, presentationValid) => {
        if (isSubmittingRef.current) return;
        trialMetaRef.current.measuredTargetMs = measuredTargetMs;
        if (presentationValid === false) {
            // A frame stall corrupted the tone/cue/target window: void + redo
            // like a tab-hidden interruption. A pending MASK-phase response is
            // a guess at a corrupted presentation — discard it and release its
            // once-guard claim so the void can take the trial. (Safe: every
            // other claimant cancels the presentation loop, so this callback
            // can't fire after them.)
            console.warn(`[Antisaccade] Invalid presentation (measured ${measuredTargetMs}ms) — voiding trial`);
            pendingResponseRef.current = null;
            trialRespondedRef.current = false;
            if (voidTrialRef.current) voidTrialRef.current();
            return;
        }
        const pending = pendingResponseRef.current;
        if (pending) {
            pendingResponseRef.current = null;
            if (finishTrialRef.current) finishTrialRef.current(pending.letter, pending.rtMs, false);
        }
        // No pending response: the window stays open; the timeout started at
        // mask onset keeps running.
    }, []);

    const { startTrialPresentation, cancelPresentation } = useAntisaccadeTimer({
        onPhaseChange: handlePresentationPhase,
        onTone: handleTone,
        onResponseReady: handleResponseReady,
    });

    // --- Interrupted notice scheduling ---
    // Declared before its users; resumeRef carries the fresh resume callback.
    const resumeRef = useRef(null);
    const scheduleInterruptedNotice = useCallback(() => {
        if (interruptedTimeoutRef.current) clearTimeout(interruptedTimeoutRef.current);
        interruptedTimeoutRef.current = setTimeout(() => {
            interruptedTimeoutRef.current = null;
            if (document.hidden || orientationBlockedRef.current) {
                pendingRestartRef.current = true; // resume when the tab/orientation returns
            } else if (resumeRef.current) {
                resumeRef.current();
            }
        }, T.INTERRUPTED_NOTICE_MS);
    }, []);

    // --- Single Trial Reset Point (practice AND scored) ---
    const prepareTrial = useCallback((spec) => {
        // A trial that would START while the tab is hidden (or the portrait
        // overlay is up) must be deferred or its presentation would run
        // unseen. No redo is consumed: nothing was presented yet.
        if (document.hidden || orientationBlockedRef.current) {
            pendingTrialRef.current = spec;
            phaseRef.current = P.INTERRUPTED; // synchronous: see below
            setCurrentPhase(P.INTERRUPTED);
            scheduleInterruptedNotice();
            return;
        }
        pendingTrialRef.current = null;
        currentTrialRef.current = spec;
        trialMetaRef.current = { blurredDuringResponse: false, measuredTargetMs: null };
        trialRespondedRef.current = false;
        pendingResponseRef.current = null;
        responseOnsetRef.current = null;
        // Assign phaseRef synchronously: the timer's first FIXATION tick is
        // ~2 frames away and the React effect that syncs phaseRef runs even
        // later, so without this a double-activation of the READY/BREAK
        // button would pass the phase guard twice and silently drop a queued
        // trial from the 72-trial deck.
        phaseRef.current = P.FIXATION;
        setLastFeedbackCorrect(null);
        setCurrentTrialSpec(spec);
        if (isPracticeRef.current) {
            setPracticeNumber(practiceIndexRef.current + 1);
        } else {
            setTrialNumber(completedCountRef.current + 1);
        }
        startTrialPresentation(spec.fixationMs, spec.practice ? T.PRACTICE_TARGET_MS : T.TARGET_MS);
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
            voidCount: trialsRef.current.filter((t) => t.interrupted).length,
            inputModality: resolveInputModality(
                keyCountRef.current, touchCountRef.current, lastModalityRef.current),
            ...(earlyRetake && { forceSubmit: true }),
        };

        try {
            const submitFunc = httpsCallable(functions, 'submitAntisaccadeResults');
            const result = await submitFunc(payload);
            if (result.data?.success) {
                setFinalScores(mapFinalScores(result.data));
                clearPendingResults(uid);
                // refreshUserData() intentionally NOT called here (results-unmount
                // bug); the Done handler refreshes on navigation.
            } else {
                throw new Error(result.data?.message || 'Submission failed.');
            }
        } catch (err) {
            console.error('[Antisaccade] Submit error:', err);
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
        if (completedCountRef.current === C.BREAK_AFTER_TRIAL
            && !breakTakenRef.current
            && queueRef.current.length > 0) {
            breakTakenRef.current = true;
            setCurrentPhase(P.BREAK); // self-paced; continueFromBreak resumes
            return;
        }
        // ITI: bare fixation cross (the stimulus shows `+` for FIXATION; VA's
        // CUE_GAP-as-ITI equivalent — same visibility-handler semantics, since
        // trialRespondedRef is true here and the deferred-start path covers a
        // hide during the interval).
        setCurrentPhase(P.FIXATION);
        itiTimeoutRef.current = setTimeout(() => {
            itiTimeoutRef.current = null;
            proceedToNextScoredTrial();
        }, T.ITI_MS);
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

    // True when the recorded trials can produce a score: the backend nulls
    // (and rejects) scored sessions below the valid-trial floor.
    const computeCanSavePartial = () =>
        trialsRef.current.filter((t) => !t.interrupted).length >= C.MIN_VALID_TRIALS_FOR_SCORE;

    // --- Trial completion (response or timeout) ---
    const finishTrial = useCallback((response, rtMs, timedOut) => {
        const spec = currentTrialRef.current;
        if (!spec) return;
        const correct = !timedOut && response === spec.letter;

        if (isPracticeRef.current) {
            setLastFeedbackCorrect(correct);
            setCurrentPhase(P.TRIAL_FEEDBACK);
            feedbackTimeoutRef.current = setTimeout(() => {
                feedbackTimeoutRef.current = null;
                advancePractice();
            }, T.FEEDBACK_MS);
            return;
        }

        trialsRef.current.push(buildTrialRecord(spec, {
            response,
            rtMs,
            timedOut,
            measuredTargetMs: trialMetaRef.current.measuredTargetMs,
            blurredDuringResponse: trialMetaRef.current.blurredDuringResponse,
        }));
        completedCountRef.current += 1;
        setCompletedTrialCount(completedCountRef.current);
        setHasScoredData(true);
        setCanSavePartial(computeCanSavePartial());
        // Scored trials keep the 500ms accuracy feedback (protocol) before the ITI.
        setLastFeedbackCorrect(correct);
        setCurrentPhase(P.TRIAL_FEEDBACK);
        feedbackTimeoutRef.current = setTimeout(() => {
            feedbackTimeoutRef.current = null;
            advanceAfterScoredTrial();
        }, T.FEEDBACK_MS);
    }, [advancePractice, advanceAfterScoredTrial]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        finishTrialRef.current = finishTrial;
    }, [finishTrial]);

    const handleRespond = useCallback((letter, modality) => {
        const phase = phaseRef.current;
        // Mask-onset response window: MASK and RESPONSE both accept input.
        // The once-guard is mandatory — the buttons don't filter key auto-repeat.
        if ((phase !== P.MASK && phase !== P.RESPONSE)
            || trialRespondedRef.current || isSubmittingRef.current) return;
        trialRespondedRef.current = true;
        if (responseTimeoutRef.current) {
            clearTimeout(responseTimeoutRef.current);
            responseTimeoutRef.current = null;
        }
        const rtMs = responseOnsetRef.current != null
            ? Math.round(performance.now() - responseOnsetRef.current)
            : null;
        if (!isPracticeRef.current) {
            const m = modality === 'key' ? 'key' : 'touch';
            if (m === 'key') keyCountRef.current += 1; else touchCountRef.current += 1;
            lastModalityRef.current = m;
        }
        if (phase === P.MASK) {
            // Deferred finish: the measured/valid verdict arrives at the
            // RESPONSE boundary (onResponseReady), <= MASK_MS away.
            pendingResponseRef.current = { letter, rtMs };
            return;
        }
        finishTrial(letter, rtMs, false);
    }, [finishTrial]);

    const handleResponseTimeout = useCallback(() => {
        if ((phaseRef.current !== P.MASK && phaseRef.current !== P.RESPONSE)
            || trialRespondedRef.current || isSubmittingRef.current) return;
        trialRespondedRef.current = true;
        responseTimeoutRef.current = null;
        // A MASK-phase timeout is only reachable with a stalled/hidden tab;
        // kill the still-running presentation loop so its late
        // onResponseReady can't fire against the NEXT trial.
        cancelPresentation();
        finishTrial(null, null, true);
    }, [finishTrial, cancelPresentation]);

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
    // Shared by the tab-hidden interruption path, the orientation void, and
    // the invalid-presentation path (frame stall corrupted the target window).
    const voidAndRedoCurrentTrial = useCallback(() => {
        if (!currentTrialRef.current || trialRespondedRef.current || isSubmittingRef.current) return;
        trialRespondedRef.current = true;
        cancelPresentation();
        pendingResponseRef.current = null;
        if (responseTimeoutRef.current) {
            clearTimeout(responseTimeoutRef.current);
            responseTimeoutRef.current = null;
        }
        const spec = currentTrialRef.current;
        if (isPracticeRef.current) {
            // Practice is local: redo the same cell, nothing recorded
            pendingTrialRef.current = makeRedoPracticeSpec(spec);
        } else {
            // Voided scored trials are still pushed (interrupted: true) for
            // audit; the backend excludes them from scoring.
            trialsRef.current.push(buildTrialRecord(spec, {
                interrupted: true,
                measuredTargetMs: trialMetaRef.current.measuredTargetMs,
            }));
            if (redoCountRef.current < C.MAX_TRIAL_REDOS) {
                const spare = sparesRef.current.shift();
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

    // Shared interruption rule for tab-hide AND the C6 portrait rotation:
    // void during the presentation phases; during the open response window
    // (target already shown) flag, don't void. trialRespondedRef
    // distinguishes mid-presentation from the ITI window, where the
    // deferred-start path in prepareTrial takes over instead.
    const interruptCurrentTrial = useCallback(() => {
        const phase = phaseRef.current;
        if (VOID_ON_HIDE_PHASES.includes(phase)
            && currentTrialRef.current
            && !trialRespondedRef.current
            && !isSubmittingRef.current) {
            voidAndRedoCurrentTrial();
        } else if ((phase === P.MASK || phase === P.RESPONSE) && !trialRespondedRef.current) {
            trialMetaRef.current.blurredDuringResponse = true;
        }
    }, [voidAndRedoCurrentTrial]);

    // Exposed for the task's orientation overlay (rotate-to-portrait
    // mid-trial). Contract: during MASK/RESPONSE it FLAGS the trial
    // (blurredDuringResponse) rather than voiding — the target was already
    // shown, so the response stands. Task usage: call this on the transition
    // INTO portrait and wrap the overlay with setOrientationBlocked(true/false);
    // the two calls are order-insensitive.
    const voidCurrentTrialForOrientation = interruptCurrentTrial;

    // Refs so the single visibility listener always sees fresh callbacks
    const visibilityDepsRef = useRef({});
    visibilityDepsRef.current = { resumeInterruptedTrial, interruptCurrentTrial };

    useEffect(() => {
        const handler = () => {
            if (!document.hidden) {
                if (phaseRef.current === P.INTERRUPTED && pendingRestartRef.current
                    && !orientationBlockedRef.current) {
                    pendingRestartRef.current = false;
                    visibilityDepsRef.current.resumeInterruptedTrial();
                }
                return;
            }
            visibilityDepsRef.current.interruptCurrentTrial();
        };
        document.addEventListener('visibilitychange', handler);
        return () => document.removeEventListener('visibilitychange', handler);
    }, []);

    // While blocked, prepareTrial defers new trials (like document.hidden) so
    // a sustained portrait overlay can't burn the redo budget on trials the
    // user can't see. Unblocking resumes a deferred restart.
    const setOrientationBlocked = useCallback((blocked) => {
        orientationBlockedRef.current = blocked === true;
        if (!orientationBlockedRef.current
            && phaseRef.current === P.INTERRUPTED
            && pendingRestartRef.current
            && !document.hidden) {
            pendingRestartRef.current = false;
            if (resumeRef.current) resumeRef.current();
        }
    }, []);

    // --- Initialize Session (idempotent; called on mount) ---
    const initializeSession = useCallback(async () => {
        if (didInitRef.current) return;
        didInitRef.current = true;
        console.log('[Antisaccade] Initializing session...');
        setIsLoading(true);
        setError(null);

        try {
            const checkElig = httpsCallable(functions, 'checkAntisaccadeEligibility');
            const eligResult = await checkElig({});
            const data = eligResult.data;
            const isFamiliar = !data.familiarizationComplete;
            setIsFamiliarization(isFamiliar);
            isFamiliarizationRef.current = isFamiliar;
            console.log(`[Antisaccade] Session type: ${isFamiliar ? 'familiarization' : 'scored'}. Eligible: ${data.isEligible}`);

            if (data.familiarizationComplete && !data.isEligible && !earlyRetake) {
                // Not eligible AND not an explicitly-confirmed early retake.
                setNotEligibleMessage(data.nextAvailableDateString || 'You are not eligible for a new assessment yet.');
                setIsLoading(false);
                setCurrentPhase(P.RESULTS);
                return;
            }

            const getStructure = httpsCallable(functions, 'getAntisaccadeStructure');
            const structResult = await getStructure({ forceStart: earlyRetake });
            const { trials, spares } = structResult.data || {};
            if (!Array.isArray(trials) || trials.length === 0 || !Array.isArray(spares)) {
                throw new Error('Invalid trial structure received.');
            }
            queueRef.current = trials;
            sparesRef.current = spares;
            trialsRef.current = [];
            completedCountRef.current = 0;
            redoCountRef.current = 0;
            breakTakenRef.current = false;
            keyCountRef.current = 0;
            touchCountRef.current = 0;
            lastModalityRef.current = null;
            console.log(`[Antisaccade] Structure cached: ${trials.length} trials, ${spares.length} spares.`);

            practiceTrialsRef.current = generatePracticeTrials();
            practiceIndexRef.current = 0;
            setIsPractice(true);
            isPracticeRef.current = true;
            setIsLoading(false);
            // Unlike VA, the first trial does NOT start here: the alerting
            // beep needs an audio unlock inside a user gesture, so the task
            // screen shows a start control and startSession() begins practice.
            setIsReadyToStart(true);
        } catch (err) {
            console.error('[Antisaccade] Init error:', err);
            setError(`Failed to initialize: ${err.message}`);
            setIsLoading(false);
            setCurrentPhase(P.RESULTS);
        }
    }, [earlyRetake]);

    // --- Start gesture (audio unlock) ---
    const startSession = useCallback(async () => {
        if (didStartRef.current || practiceTrialsRef.current.length === 0) return;
        didStartRef.current = true;
        setIsReadyToStart(false);
        // Android Bluetooth sequence (mirrors the main game's session start):
        // recreate the AudioContext if the OS output device changed, THEN
        // unlock inside this same user gesture. Audio failure never blocks.
        try {
            audioManager.recreateForOutputChange();
        } catch (e) {
            console.warn('[Antisaccade] Audio route refresh failed:', e);
        }
        try {
            // Race against a 500ms timeout (mirrors the summary page's start
            // handler): unlockAudio awaits AudioContext.resume(), which stays
            // pending FOREVER when no user gesture has occurred on the page —
            // e.g. a reload/tab-restore re-triggering autoStart from persisted
            // history state. Audio is best-effort; practice starts regardless.
            await Promise.race([
                unlockAudio(), // already swallows internally; belt-and-suspenders
                new Promise((resolve) => setTimeout(resolve, 500)),
            ]);
        } catch (e) { /* non-fatal */ }
        prepareTrial(practiceTrialsRef.current[0]);
    }, [prepareTrial]);

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
    // sparesRef, trialsRef, modality tallies, counters) is untouched. The
    // in-flight alerting beep is fire-and-forget inside scheduleBeep — no
    // cancellation needed.
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
        pendingResponseRef.current = null; // a MASK-phase guess must not finish post-skip
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
        // Submit only when the backend can actually score the partial (valid
        // trials >= floor) — otherwise it would reject the submission, or
        // worse, a null-score entry would burn the 30-day cooldown.
        // Familiarization exits are always discarded.
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
            trialsRef.current.push(buildTrialRecord(spec, {
                response: correct ? spec.letter : (spec.letter === 'Q' ? 'O' : 'Q'),
                rtMs: 300 + Math.round(Math.random() * 700),
                measuredTargetMs: T.TARGET_MS,
            }));
            completedCountRef.current += 1;
        }
        setCompletedTrialCount(completedCountRef.current);
        setHasScoredData(trialsRef.current.length > 0);
        await submitResults();
    }, [submitResults, cancelPresentation, clearAllTimeouts]);

    // --- Unmount cleanup --- (the timer hook cancels its own rAF loop)
    useEffect(() => () => {
        clearAllTimeouts();
    }, [clearAllTimeouts]);

    // Buttons accept input from mask onset through the response phase; C6
    // additionally gates this on its own overlay/modal state.
    const responseEnabled = currentPhase === P.MASK || currentPhase === P.RESPONSE;

    return {
        // State
        currentPhase, currentTrialSpec, isPractice, practiceNumber,
        practiceTotal: practiceTrialsRef.current.length || C.PRACTICE_TRIALS,
        trialNumber, totalTrials: C.SCORED_TRIALS, completedTrialCount, canSavePartial,
        lastFeedbackCorrect, isFamiliarization, hasScoredData, responseEnabled,
        notEligibleMessage, finalScores, isLoading, isReadyToStart, error,
        // Actions
        initializeSession, startSession, startScoredBlock, continueFromBreak,
        skipPractice, handleRespond, handleExitAssessment, handleDevSkipTask,
        voidCurrentTrialForOrientation, setOrientationBlocked,
    };
};

// Re-exported for the summary page pending-results recovery
export { getPendingResults, clearPendingResults };
export default useAntisaccadeLogic;

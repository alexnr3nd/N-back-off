/* src/components/testing/antisaccade/trainer/hooks/useAntisaccadeTrainerLogic.js */
/**
 * Session runner + client-side trial-level staircase for the Antisaccade
 * TRAINER. Reuses the shared useAntisaccadeTimer (rAF + measured-exposure
 * validation) and antisaccadeHelpers (beep, audio unlock) UNTOUCHED; layers a
 * 3-down-1-up staircase that walks `difficulty` per scorable trial and presents
 * each trial at difficultyToLevers(difficulty). On finish it submits the full
 * trial record; the server re-scores and replays the staircase authoritatively.
 *
 * Distinct from the assessment hook: no practice / break / familiarization /
 * eligibility; ~1-min round; feedback after every trial.
 */
import { useState, useRef, useCallback } from 'react';
import { useAntisaccadeTimer } from '../../hooks/useAntisaccadeTimer';
import { ANTISACCADE_TIMING } from '../../../../../constants/antisaccadeConstants';
import {
    ANTISACCADE_PHASES as P,
    ANTISACCADE_TRAINER as A,
    difficultyToLevers,
    computeTrainerLevel,
    nextDifficulty,
} from '../../../../../constants/antisaccadeTrainerConstants';
import { buildTrialRecord, scheduleBeep, unlockAudio } from '../../hooks/antisaccadeHelpers';
import { functions, httpsCallable } from '../../../../../firebaseConfig';

const T = ANTISACCADE_TIMING;
const MAX_REDOS = A.SPARE_TRIALS;

const makeSessionId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `cs_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const useAntisaccadeTrainerLogic = ({ onExit }) => {
    const [currentPhase, setCurrentPhase] = useState(P.INSTRUCTIONS);
    const [currentTrialSpec, setCurrentTrialSpec] = useState(null);
    const [currentLevers, setCurrentLevers] = useState(difficultyToLevers(A.START_DIFFICULTY));
    const [lastFeedbackCorrect, setLastFeedbackCorrect] = useState(null);
    const [trialNumber, setTrialNumber] = useState(0);
    const [currentLevel, setCurrentLevel] = useState(computeTrainerLevel(0, A.START_DIFFICULTY));
    const [roundStreak, setRoundStreak] = useState(0); // live consecutive correct responses
    const [bestLevel, setBestLevel] = useState(computeTrainerLevel(0, A.START_DIFFICULTY));
    const [isReadyToStart, setIsReadyToStart] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [finalResults, setFinalResults] = useState(null);

    // Engine refs (fresh values without re-binding the stable timer callbacks)
    const phaseRef = useRef(P.INSTRUCTIONS);
    const didInitRef = useRef(false);
    const queueRef = useRef([]);            // remaining content specs
    const sparesRef = useRef([]);
    const pendingTrialRef = useRef(null);   // deferred / redo spec to present next
    const trialsRef = useRef([]);           // recorded trial records (submission)
    const currentTrialRef = useRef(null);
    const completedRef = useRef(0);         // scorable trials finished
    const redoCountRef = useRef(0);
    const tierRef = useRef(0);
    const difficultyRef = useRef(A.START_DIFFICULTY);   // running staircase difficulty
    const consecutiveCorrectRef = useRef(0);
    const presentedDifficultyRef = useRef(A.START_DIFFICULTY);
    const roundStreakRef = useRef(0);   // live consecutive correct responses (display only)
    const bestRunRef = useRef(0);       // longest correct run this round
    const measuredRef = useRef(null);
    const trialRespondedRef = useRef(false);
    const pendingResponseRef = useRef(null);
    const responseOnsetRef = useRef(null);
    const responseTimeoutRef = useRef(null);
    const itiTimeoutRef = useRef(null);
    const feedbackTimeoutRef = useRef(null);
    const interruptedTimeoutRef = useRef(null);
    const timeoutHandlerRef = useRef(null);
    const voidTrialRef = useRef(null);
    const finishTrialRef = useRef(null);
    const resumeRef = useRef(null);
    const isSubmittingRef = useRef(false);
    const orientationBlockedRef = useRef(false);
    const sessionIdRef = useRef(null);
    const sessionStartRef = useRef(0);

    const clearAllTimeouts = useCallback(() => {
        [responseTimeoutRef, itiTimeoutRef, feedbackTimeoutRef, interruptedTimeoutRef].forEach((ref) => {
            if (ref.current) { clearTimeout(ref.current); ref.current = null; }
        });
    }, []);

    // --- Timer callbacks (stable) ---
    const handlePresentationPhase = useCallback((phase) => {
        if (isSubmittingRef.current) return;
        if (phase === P.MASK && !trialRespondedRef.current) {
            responseOnsetRef.current = performance.now();
            responseTimeoutRef.current = setTimeout(() => {
                if (timeoutHandlerRef.current) timeoutHandlerRef.current();
            }, T.RESPONSE_TIMEOUT_MS);
        }
        phaseRef.current = phase;
        setCurrentPhase(phase);
    }, []);

    const handleTone = useCallback(() => { scheduleBeep(); }, []);

    const handleResponseReady = useCallback((measuredTargetMs, presentationValid) => {
        if (isSubmittingRef.current) return;
        measuredRef.current = measuredTargetMs;
        if (presentationValid === false) {
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
    }, []);

    const { startTrialPresentation, cancelPresentation } = useAntisaccadeTimer({
        onPhaseChange: handlePresentationPhase,
        onTone: handleTone,
        onResponseReady: handleResponseReady,
    });

    const scheduleInterruptedNotice = useCallback(() => {
        if (interruptedTimeoutRef.current) clearTimeout(interruptedTimeoutRef.current);
        interruptedTimeoutRef.current = setTimeout(() => {
            interruptedTimeoutRef.current = null;
            if (document.hidden || orientationBlockedRef.current) {
                pendingTrialRef.current = pendingTrialRef.current; // wait for return
            } else if (resumeRef.current) {
                resumeRef.current();
            }
        }, T.INTERRUPTED_NOTICE_MS);
    }, []);

    // --- Present one trial at the current staircase difficulty ---
    const prepareTrial = useCallback((spec) => {
        if (document.hidden || orientationBlockedRef.current) {
            pendingTrialRef.current = spec;
            phaseRef.current = P.INTERRUPTED;
            setCurrentPhase(P.INTERRUPTED);
            scheduleInterruptedNotice();
            return;
        }
        const levers = difficultyToLevers(difficultyRef.current);
        presentedDifficultyRef.current = difficultyRef.current;
        currentTrialRef.current = spec;
        measuredRef.current = null;
        trialRespondedRef.current = false;
        pendingResponseRef.current = null;
        responseOnsetRef.current = null;
        phaseRef.current = P.FIXATION;
        setLastFeedbackCorrect(null);
        setCurrentLevers(levers);
        setCurrentTrialSpec(spec);
        setTrialNumber(Math.min(completedRef.current + 1, A.TRIALS_PER_ROUND));
        startTrialPresentation(spec.fixationMs, levers.targetMs, { cueMs: levers.cueMs });
    }, [startTrialPresentation, scheduleInterruptedNotice]);

    // --- Submission ---
    const submitResults = useCallback(async () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        clearAllTimeouts();
        cancelPresentation();
        setIsLoading(true);
        setCurrentPhase(P.SAVING);
        phaseRef.current = P.SAVING;
        try {
            const submit = httpsCallable(functions, 'submitAntisaccadeTrainerResults');
            const d = new Date();
            const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
            console.error('[AntisaccadeTrainer] submit failed:', err);
            setError(err?.message || 'Could not save this session. Your level is unchanged.');
            setFinalResults({ error: true });
        } finally {
            setIsLoading(false);
            setCurrentPhase(P.RESULTS);
            phaseRef.current = P.RESULTS;
        }
    }, [clearAllTimeouts, cancelPresentation]);

    // --- Advance to the next content trial (or submit) ---
    const proceedToNext = useCallback(() => {
        if (pendingTrialRef.current) {
            const spec = pendingTrialRef.current;
            pendingTrialRef.current = null;
            prepareTrial(spec);
            return;
        }
        if (queueRef.current.length > 0) {
            prepareTrial(queueRef.current.shift());
            return;
        }
        submitResults();
    }, [prepareTrial, submitResults]);

    const advanceAfterTrial = useCallback(() => {
        setCurrentPhase(P.FIXATION); // bare ITI fixation
        phaseRef.current = P.FIXATION;
        itiTimeoutRef.current = setTimeout(() => {
            itiTimeoutRef.current = null;
            proceedToNext();
        }, A.ITI_MS);
    }, [proceedToNext]);

    // --- Trial completion (response or timeout) ---
    const finishTrial = useCallback((response, rtMs, timedOut) => {
        const spec = currentTrialRef.current;
        if (!spec) return;
        const correct = !timedOut && response === spec.letter;

        // Live in-round streak: +1 per correct response, reset on any miss.
        // Independent of the staircase's 3-down-1-up step counter.
        if (correct) {
            roundStreakRef.current += 1;
            if (roundStreakRef.current > bestRunRef.current) bestRunRef.current = roundStreakRef.current;
        } else {
            roundStreakRef.current = 0;
        }
        setRoundStreak(roundStreakRef.current);

        trialsRef.current.push(buildTrialRecord(spec, {
            response, rtMs, timedOut,
            measuredTargetMs: measuredRef.current,
            difficulty: presentedDifficultyRef.current,
        }));
        completedRef.current += 1;

        // Trial-level 3-down-1-up: advance the running difficulty for the NEXT trial.
        const step = nextDifficulty(difficultyRef.current, consecutiveCorrectRef.current, correct);
        difficultyRef.current = step.difficulty;
        consecutiveCorrectRef.current = step.consecutiveCorrect;
        setCurrentLevel(computeTrainerLevel(tierRef.current, step.difficulty));

        setLastFeedbackCorrect(correct);
        setCurrentPhase(P.TRIAL_FEEDBACK);
        phaseRef.current = P.TRIAL_FEEDBACK;
        feedbackTimeoutRef.current = setTimeout(() => {
            feedbackTimeoutRef.current = null;
            advanceAfterTrial();
        }, A.FEEDBACK_MS);
    }, [advanceAfterTrial]);
    finishTrialRef.current = finishTrial;

    const handleRespond = useCallback((letter) => {
        const phase = phaseRef.current;
        if ((phase !== P.MASK && phase !== P.RESPONSE) || trialRespondedRef.current || isSubmittingRef.current) return;
        trialRespondedRef.current = true;
        if (responseTimeoutRef.current) { clearTimeout(responseTimeoutRef.current); responseTimeoutRef.current = null; }
        const rtMs = responseOnsetRef.current != null
            ? Math.round(performance.now() - responseOnsetRef.current) : null;
        if (phase === P.MASK) {
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
        cancelPresentation();
        finishTrial(null, null, true);
    }, [finishTrial, cancelPresentation]);
    timeoutHandlerRef.current = handleResponseTimeout;

    // --- Interruption: void in-flight trial, redo with a spare (no staircase move) ---
    const voidAndRedoCurrentTrial = useCallback(() => {
        if (!currentTrialRef.current || trialRespondedRef.current || isSubmittingRef.current) return;
        trialRespondedRef.current = true;
        cancelPresentation();
        pendingResponseRef.current = null;
        if (responseTimeoutRef.current) { clearTimeout(responseTimeoutRef.current); responseTimeoutRef.current = null; }
        const spec = currentTrialRef.current;
        trialsRef.current.push(buildTrialRecord(spec, { interrupted: true, measuredTargetMs: measuredRef.current }));
        if (redoCountRef.current < MAX_REDOS) {
            const spare = sparesRef.current.shift();
            if (spare) { redoCountRef.current += 1; pendingTrialRef.current = { ...spare, redo: true }; }
        }
        phaseRef.current = P.INTERRUPTED;
        setCurrentPhase(P.INTERRUPTED);
        scheduleInterruptedNotice();
    }, [cancelPresentation, scheduleInterruptedNotice]);
    voidTrialRef.current = voidAndRedoCurrentTrial;

    const resumeInterrupted = useCallback(() => {
        const pending = pendingTrialRef.current;
        pendingTrialRef.current = null;
        if (pending) prepareTrial(pending);
        else proceedToNext();
    }, [prepareTrial, proceedToNext]);
    resumeRef.current = resumeInterrupted;

    // --- Public actions ---
    const initializeSession = useCallback(async () => {
        if (didInitRef.current) return;
        didInitRef.current = true;
        setIsLoading(true);
        setError(null);
        try {
            const getStructure = httpsCallable(functions, 'getAntisaccadeTrainerStructure');
            const res = await getStructure({});
            const data = res.data || {};
            queueRef.current = Array.isArray(data.trials) ? [...data.trials] : [];
            sparesRef.current = Array.isArray(data.spares) ? [...data.spares] : [];
            tierRef.current = Number.isFinite(data.tier) ? data.tier : 0;
            difficultyRef.current = Number.isFinite(data.startDifficulty) ? data.startDifficulty : A.START_DIFFICULTY;
            consecutiveCorrectRef.current = 0;
            completedRef.current = 0;
            redoCountRef.current = 0;
            trialsRef.current = [];
            sessionIdRef.current = makeSessionId();
            setCurrentLevel(Number.isFinite(data.level) ? data.level : computeTrainerLevel(tierRef.current, difficultyRef.current));
            setBestLevel(Number.isFinite(data.bestLevel) ? data.bestLevel : computeTrainerLevel(tierRef.current, difficultyRef.current));
            setCurrentLevers(difficultyToLevers(difficultyRef.current));
            setIsReadyToStart(true);
        } catch (err) {
            console.error('[AntisaccadeTrainer] init failed:', err);
            setError(err?.code === 'functions/permission-denied'
                ? 'The Antisaccade Trainer requires a Pro subscription.'
                : (err?.message || 'Could not start the trainer.'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const startSession = useCallback(() => {
        if (!isReadyToStart || queueRef.current.length === 0) return;
        unlockAudio();
        roundStreakRef.current = 0;
        bestRunRef.current = 0;
        setRoundStreak(0);
        sessionStartRef.current = Date.now();
        setIsReadyToStart(false);
        proceedToNext();
    }, [isReadyToStart, proceedToNext]);

    const handleExitTrainer = useCallback(() => {
        clearAllTimeouts();
        cancelPresentation();
        isSubmittingRef.current = true; // freeze the loop
        if (onExit) onExit();
    }, [clearAllTimeouts, cancelPresentation, onExit]);

    const setOrientationBlocked = useCallback((blocked) => {
        orientationBlockedRef.current = blocked;
    }, []);

    const voidCurrentTrialForOrientation = useCallback(() => {
        const phase = phaseRef.current;
        const inTrial = [P.FIXATION, P.TONE, P.CUE, P.TARGET, P.MASK, P.RESPONSE].includes(phase);
        if (inTrial && voidTrialRef.current) voidTrialRef.current();
    }, []);

    const responseEnabled = currentPhase === P.MASK || currentPhase === P.RESPONSE;

    return {
        currentPhase, currentTrialSpec, currentLevers, responseEnabled, lastFeedbackCorrect,
        trialNumber, totalTrials: A.TRIALS_PER_ROUND,
        currentLevel, roundStreak, bestLevel,
        isReadyToStart, isLoading, error, finalResults,
        initializeSession, startSession, handleRespond, handleExitTrainer,
        voidCurrentTrialForOrientation, setOrientationBlocked,
    };
};

export default useAntisaccadeTrainerLogic;

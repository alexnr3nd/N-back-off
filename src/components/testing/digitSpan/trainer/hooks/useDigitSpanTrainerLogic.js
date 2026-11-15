/* src/components/testing/digitSpan/trainer/hooks/useDigitSpanTrainerLogic.js */
/**
 * Session runner + client-side list-level span staircase for the Digit Span
 * TRAINER. Reuses the shared useDigitSpanTimer (absolute-deadline presentation)
 * and the assessment's DigitDisplay / DigitRecallPad UNTOUCHED. A trial == one
 * recalled list; a 2-down-1-up staircase walks the span (advance after 2
 * consecutive correct lists, drop after 1 error) and presents each list at the
 * current span. On finish it submits the full list record; the server re-scores
 * and replays the span staircase authoritatively.
 *
 * Distinct from the assessment hook: no practice / block alternation / cooldown;
 * a single direction (forward OR backward) per session; feedback after each list.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
    DIGIT_SPAN_PHASES as P,
    DIGIT_SPAN_TRAINER as D,
    boundsFor, nextSpan, isListCorrect,
} from '../../../../../constants/digitSpanTrainerConstants';
import { functions, httpsCallable } from '../../../../../firebaseConfig';

const PRESENTATION_PHASES = [P.FIXATION, P.DIGIT_SHOW, P.DIGIT_BLANK, P.RECALL_CUE];

const makeSessionId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `cs_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const useDigitSpanTrainerLogic = ({ direction, onExit, timerControlsRef }) => {
    const bounds = boundsFor(direction);

    const [currentPhase, setCurrentPhase] = useState(P.INSTRUCTIONS);
    const [currentTargetDigits, setCurrentTargetDigits] = useState([]);
    const [currentDigitIndex, setCurrentDigitIndex] = useState(-1);
    const [responseDigits, setResponseDigits] = useState([]);
    const [presentationTrialKey, setPresentationTrialKey] = useState(0);
    const [lastFeedbackCorrect, setLastFeedbackCorrect] = useState(null);
    const [listNumber, setListNumber] = useState(0);
    const [currentLevel, setCurrentLevel] = useState(bounds.START_SPAN); // current span
    const [bestLevel, setBestLevel] = useState(bounds.START_SPAN);
    const [roundStreak, setRoundStreak] = useState(0);
    const [isReadyToStart, setIsReadyToStart] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [finalResults, setFinalResults] = useState(null);

    const phaseRef = useRef(P.INSTRUCTIONS);
    const didInitRef = useRef(false);
    const poolRef = useRef({});
    const drawCountRef = useRef({});
    const spanRef = useRef(bounds.START_SPAN);
    const consecutiveCorrectRef = useRef(0);
    const currentListRef = useRef(null);   // { length, targetDigits, id }
    const responseDigitsRef = useRef([]);
    const measuredRef = useRef(null);
    const trialsRef = useRef([]);
    const completedRef = useRef(0);        // scored lists finished
    const redoCountRef = useRef(0);
    const listScoredRef = useRef(false);
    const roundStreakRef = useRef(0);
    const bestRunRef = useRef(0);
    const sessionIdRef = useRef(null);
    const sessionStartRef = useRef(0);
    const isSubmittingRef = useRef(false);

    const setPhase = useCallback((p) => { phaseRef.current = p; setCurrentPhase(p); }, []);

    const drawSequence = useCallback((span) => {
        const bucket = poolRef.current[String(span)] || [];
        if (bucket.length === 0) return null;
        const idx = (drawCountRef.current[span] || 0) % bucket.length;
        drawCountRef.current[span] = (drawCountRef.current[span] || 0) + 1;
        return bucket[idx];
    }, []);

    // --- Present one list at the current staircase span ---
    const prepareList = useCallback(() => {
        if (document.hidden) { setPhase(P.INTERRUPTED); return; }
        const span = spanRef.current;
        const seq = drawSequence(span);
        if (!seq) { setError('Ran out of sequences for this session.'); return; }
        currentListRef.current = { length: span, targetDigits: seq.digits, id: seq.id };
        responseDigitsRef.current = [];
        measuredRef.current = null;
        listScoredRef.current = false;
        setCurrentDigitIndex(-1);
        setResponseDigits([]);
        setCurrentTargetDigits(seq.digits);
        setLastFeedbackCorrect(null);
        setListNumber(Math.min(completedRef.current + 1, D.LISTS_PER_SESSION));
        setPhase(P.FIXATION);
        setPresentationTrialKey((k) => k + 1); // triggers the timer presentation runner
    }, [drawSequence, setPhase]);

    // --- Submission ---
    const submitResults = useCallback(async () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        timerControlsRef.current.cancelPresentation();
        timerControlsRef.current.clearPhaseTimer();
        setIsLoading(true);
        setPhase(P.SAVING);
        try {
            const submit = httpsCallable(functions, 'submitDigitSpanTrainerResults');
            const dt = new Date();
            const localDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            const res = await submit({
                trials: trialsRef.current,
                clientSessionId: sessionIdRef.current,
                durationMs: Date.now() - sessionStartRef.current,
                localDate,
                direction,
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
            console.error('[DigitSpanTrainer] submit failed:', err);
            setError(err?.message || 'Could not save this session. Your span is unchanged.');
            setFinalResults({ error: true });
        } finally {
            setIsLoading(false);
            setPhase(P.RESULTS);
        }
    }, [direction, setPhase, timerControlsRef]);

    const advanceAfterList = useCallback(() => {
        if (completedRef.current >= D.LISTS_PER_SESSION) submitResults();
        else prepareList();
    }, [prepareList, submitResults]);

    // --- Score one list (recall submit or timeout) ---
    const scoreList = useCallback((timedOut) => {
        if (listScoredRef.current || isSubmittingRef.current) return;
        listScoredRef.current = true;
        timerControlsRef.current.clearPhaseTimer();
        const list = currentListRef.current;
        if (!list) return;
        const resp = timedOut ? [] : responseDigitsRef.current;
        const correct = isListCorrect(list.targetDigits, resp, direction, timedOut);

        trialsRef.current.push({
            length: list.length,
            targetDigits: list.targetDigits,
            responseDigits: resp,
            recallTimedOut: timedOut,
            id: list.id,
            measuredDigitOnMs: measuredRef.current,
        });
        completedRef.current += 1;

        if (correct) {
            roundStreakRef.current += 1;
            if (roundStreakRef.current > bestRunRef.current) bestRunRef.current = roundStreakRef.current;
        } else {
            roundStreakRef.current = 0;
        }
        setRoundStreak(roundStreakRef.current);

        const step = nextSpan(spanRef.current, consecutiveCorrectRef.current, correct, bounds.MIN_SPAN, bounds.MAX_SPAN);
        spanRef.current = step.span;
        consecutiveCorrectRef.current = step.consecutiveCorrect;
        setCurrentLevel(step.span);

        setLastFeedbackCorrect(correct);
        setPhase(P.TRIAL_FEEDBACK); // timer fires 'feedback_done' after TRIAL_FEEDBACK_MS
    }, [direction, bounds.MIN_SPAN, bounds.MAX_SPAN, setPhase, timerControlsRef]);

    // --- Interruption: void the in-flight list, redo at the same span ---
    const voidCurrentList = useCallback(() => {
        if (listScoredRef.current || isSubmittingRef.current || !currentListRef.current) return;
        listScoredRef.current = true;
        timerControlsRef.current.cancelPresentation();
        timerControlsRef.current.clearPhaseTimer();
        const list = currentListRef.current;
        trialsRef.current.push({
            length: list.length,
            targetDigits: list.targetDigits,
            responseDigits: [],
            recallTimedOut: false,
            interrupted: true,
            id: list.id,
        });
        setPhase(P.INTERRUPTED);
    }, [setPhase, timerControlsRef]);

    const resumeInterrupted = useCallback(() => {
        if (document.hidden) return; // wait for the tab to return
        if (redoCountRef.current < D.SPARE_LISTS) {
            redoCountRef.current += 1;
            prepareList();
        } else {
            advanceAfterList(); // out of redo budget — continue the session
        }
    }, [prepareList, advanceAfterList]);

    // --- Timer event dispatch ---
    const handleTimerEvent = useCallback((type, payload) => {
        if (isSubmittingRef.current) return;
        switch (type) {
            case 'digit_show':
                setCurrentDigitIndex(payload.index);
                setPhase(P.DIGIT_SHOW);
                break;
            case 'digit_blank':
                setCurrentDigitIndex(-1);
                setPhase(P.DIGIT_BLANK);
                break;
            case 'recall_cue':
                setPhase(P.RECALL_CUE);
                break;
            case 'recall_start':
                measuredRef.current = payload?.measuredDigitOnMs ?? null;
                responseDigitsRef.current = [];
                setResponseDigits([]);
                setPhase(P.RECALL);
                break;
            case 'recall_timeout':
                scoreList(true);
                break;
            case 'feedback_done':
                advanceAfterList();
                break;
            case 'interrupted_done':
                resumeInterrupted();
                break;
            default:
                break;
        }
    }, [setPhase, scoreList, advanceAfterList, resumeInterrupted]);

    const handleResponseChange = useCallback((newDigits) => {
        responseDigitsRef.current = newDigits;
        setResponseDigits(newDigits);
    }, []);

    const submitRecall = useCallback(() => {
        if (phaseRef.current !== P.RECALL || listScoredRef.current || isSubmittingRef.current) return;
        scoreList(false);
    }, [scoreList]);

    // --- Public actions ---
    const initializeSession = useCallback(async () => {
        if (didInitRef.current) return;
        didInitRef.current = true;
        setIsLoading(true);
        setError(null);
        try {
            const getStructure = httpsCallable(functions, 'getDigitSpanTrainerStructure');
            const res = await getStructure({ direction });
            const data = res.data || {};
            poolRef.current = (data.pool && typeof data.pool === 'object') ? data.pool : {};
            spanRef.current = Number.isFinite(data.startDifficulty) ? data.startDifficulty : bounds.START_SPAN;
            consecutiveCorrectRef.current = 0;
            completedRef.current = 0;
            redoCountRef.current = 0;
            drawCountRef.current = {};
            trialsRef.current = [];
            sessionIdRef.current = makeSessionId();
            setCurrentLevel(Number.isFinite(data.level) ? data.level : spanRef.current);
            setBestLevel(Number.isFinite(data.bestLevel) ? data.bestLevel : spanRef.current);
            setIsReadyToStart(true);
        } catch (err) {
            console.error('[DigitSpanTrainer] init failed:', err);
            setError(err?.code === 'functions/permission-denied'
                ? 'The Digit Span Trainer requires a Pro subscription.'
                : (err?.message || 'Could not start the trainer.'));
        } finally {
            setIsLoading(false);
        }
    }, [direction, bounds.START_SPAN]);

    const startSession = useCallback(() => {
        if (!isReadyToStart) return;
        roundStreakRef.current = 0;
        bestRunRef.current = 0;
        setRoundStreak(0);
        sessionStartRef.current = Date.now();
        setIsReadyToStart(false);
        prepareList();
    }, [isReadyToStart, prepareList]);

    const handleExitTrainer = useCallback(() => {
        isSubmittingRef.current = true; // freeze the loop
        timerControlsRef.current.cancelPresentation();
        timerControlsRef.current.clearPhaseTimer();
        if (onExit) onExit();
    }, [onExit, timerControlsRef]);

    // --- Interruption listener: tab hidden mid-stream voids + redoes the list ---
    useEffect(() => {
        const onVis = () => {
            if (isSubmittingRef.current) return;
            if (document.hidden) {
                if (PRESENTATION_PHASES.includes(phaseRef.current)) voidCurrentList();
            } else if (phaseRef.current === P.INTERRUPTED) {
                resumeInterrupted();
            }
        };
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, [voidCurrentList, resumeInterrupted]);

    return {
        currentPhase, currentTargetDigits, currentDigitIndex, responseDigits,
        presentationTrialKey, lastFeedbackCorrect,
        listNumber, totalLists: D.LISTS_PER_SESSION,
        currentLevel, bestLevel, roundStreak,
        isReadyToStart, isLoading, error, finalResults,
        initializeSession, startSession,
        handleTimerEvent, handleResponseChange, submitRecall, handleExitTrainer,
    };
};

export default useDigitSpanTrainerLogic;

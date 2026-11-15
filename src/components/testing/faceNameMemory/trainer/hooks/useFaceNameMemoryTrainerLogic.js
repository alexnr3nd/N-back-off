/* src/components/testing/faceNameMemory/trainer/hooks/useFaceNameMemoryTrainerLogic.js */
/**
 * Session runner for the Face-Name Memory TRAINER (adaptive, repeatable practice).
 * SPACED CROSS-SESSION model: each session first RECALLS the batch studied LAST session
 * (the scored delayed test — the inter-session gap is the delay), then STUDIES a NEW
 * batch for next time. The FIRST session is study-only (nothing pending to recall).
 *
 * Reuses the assessment's FaceNameStudyCard / FaceNameRecallGrid / nameAudio UNTOUCHED
 * and its study/recall timing; the per-item "consumed" guards (studyAdvancingRef /
 * recallAnsweringRef, reset only when the next item displays) block the same-tick
 * timer/tap race exactly as the assessment hook does. There is NO arithmetic delay and
 * NO in-session staircase (set size is a cross-session lever). On finish it submits the
 * recall responses + the just-studied faceIds; the server re-scores and replays the
 * set-size staircase authoritatively.
 */
import { useState, useRef, useCallback } from 'react';
import { FACE_NAME_TRAINER_PHASES as P, FACE_NAME_TRAINER as T } from '../../../../../constants/faceNameMemoryTrainerConstants';
import { functions, httpsCallable } from '../../../../../firebaseConfig';
import { shuffle } from '../../hooks/faceNameMemoryHelpers';
import { preloadNames } from '../../hooks/nameAudio';

const makeSessionId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `cs_${Date.now()}_${Math.random().toString(36).slice(2)}`;

/** Warm the browser image cache so the study card's decode-gated audio fires promptly. */
const preloadImages = (files = []) => {
    for (const f of files) {
        if (!f) continue;
        try { const im = new Image(); im.src = f; } catch (e) { /* ignore */ }
    }
};

const useFaceNameMemoryTrainerLogic = ({ onExit }) => {
    const [currentPhase, setCurrentPhase] = useState(P.INSTRUCTIONS);
    const [studyView, setStudyView] = useState(null);   // { pair, index, total, pass, totalPasses }
    const [recallView, setRecallView] = useState(null); // { face, options, index, total, phase }
    const [currentLevel, setCurrentLevel] = useState(T.START_SET);
    const [bestLevel, setBestLevel] = useState(T.START_SET);
    const [isReadyToStart, setIsReadyToStart] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [finalResults, setFinalResults] = useState(null);

    const phaseRef = useRef(P.INSTRUCTIONS);
    const didInitRef = useRef(false);
    const isSubmittingRef = useRef(false);
    const structureRef = useRef(null);          // { recall:{items}, study:{pairs,faceIds,setSize} }
    const isFirstSessionRef = useRef(false);
    const recallTrialsRef = useRef([]);         // [{ faceId, selectedName, timedOut }]
    const studyRef = useRef({ order: [], index: 0 });
    const recallRef = useRef({ order: [], index: 0 });
    const studyTimerRef = useRef(null);
    const recallTimerRef = useRef(null);
    const studyAdvancingRef = useRef(false);
    const recallAnsweringRef = useRef(false);
    const advanceStudyRef = useRef(null);
    const recallSelectRef = useRef(null);
    const sessionIdRef = useRef(null);
    const sessionStartRef = useRef(0);

    const setPhase = useCallback((p) => { phaseRef.current = p; setCurrentPhase(p); }, []);
    const clearTimers = useCallback(() => {
        if (studyTimerRef.current) { clearTimeout(studyTimerRef.current); studyTimerRef.current = null; }
        if (recallTimerRef.current) { clearTimeout(recallTimerRef.current); recallTimerRef.current = null; }
    }, []);

    // --- Submission ---
    const submitResults = useCallback(async () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        clearTimers();
        setStudyView(null);
        setRecallView(null);
        setIsLoading(true);
        setPhase(P.SAVING);
        const struct = structureRef.current;
        try {
            const submit = httpsCallable(functions, 'submitFaceNameMemoryTrainerResults');
            const dt = new Date();
            const localDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            const res = await submit({
                trials: recallTrialsRef.current,
                studiedFaceIds: struct.study.faceIds,
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
                bestRun: null,                       // no in-session run concept for set-size recall
                bestLevel: data.bestLevel ?? null,
                sessionCount: data.sessionCount ?? null,
                studiedCount: struct.study.faceIds.length,
                isFirstSession: isFirstSessionRef.current,
            });
        } catch (err) {
            console.error('[FaceNameMemoryTrainer] submit failed:', err);
            setError(err?.message || 'Could not save this session. Your set size is unchanged.');
            setFinalResults({ error: true });
        } finally {
            isSubmittingRef.current = false;
            setIsLoading(false);
            setPhase(P.RESULTS);
        }
    }, [clearTimers, setPhase]);

    // --- Study display (a NEW batch for next session; audio-only) ---
    const showStudyItem = useCallback(() => {
        const s = studyRef.current;
        studyAdvancingRef.current = false;
        const pair = s.order[s.index];
        setStudyView({ pair, index: s.index, total: s.order.length, pass: 1, totalPasses: T.STUDY_PASSES });
        if (studyTimerRef.current) clearTimeout(studyTimerRef.current);
        studyTimerRef.current = setTimeout(() => { if (advanceStudyRef.current) advanceStudyRef.current(); }, T.STUDY_MS);
    }, []);

    const advanceStudy = useCallback(() => {
        if (phaseRef.current !== P.STUDY || studyAdvancingRef.current) return;
        studyAdvancingRef.current = true;
        if (studyTimerRef.current) { clearTimeout(studyTimerRef.current); studyTimerRef.current = null; }
        const s = studyRef.current;
        if (s.index + 1 < s.order.length) {
            s.index += 1;
            // Hold the card through the gap (no null) so the framed portrait doesn't
            // flash to the page background between faces; showStudyItem swaps the pair
            // in place. Guard reset still happens there, so race protection is unchanged.
            studyTimerRef.current = setTimeout(() => showStudyItem(), T.INTER_ITEM_MS);
        } else {
            setStudyView(null);
            submitResults();
        }
    }, [showStudyItem, submitResults]);
    advanceStudyRef.current = advanceStudy;

    const startStudy = useCallback(() => {
        const struct = structureRef.current;
        studyRef.current = { order: shuffle([...struct.study.pairs]), index: 0 };
        setPhase(P.STUDY);
        showStudyItem();
    }, [setPhase, showStudyItem]);

    // --- Recall display (delayed recall of LAST session's batch) ---
    const showRecallItem = useCallback(() => {
        const r = recallRef.current;
        recallAnsweringRef.current = false;
        const item = r.order[r.index];
        setRecallView({
            face: { file: item.file },
            options: item.options,        // server-built: 6 same-gender names, shuffled, no key
            index: r.index,
            total: r.order.length,
            phase: 'delayed',
        });
        if (recallTimerRef.current) clearTimeout(recallTimerRef.current);
        recallTimerRef.current = setTimeout(() => {
            if (recallSelectRef.current) recallSelectRef.current(null, true);
        }, T.RECALL_TIMEOUT_MS);
    }, []);

    const advanceRecall = useCallback(() => {
        const r = recallRef.current;
        if (r.index + 1 < r.order.length) {
            r.index += 1;
            showRecallItem();
        } else {
            startStudy();   // recall done -> study the new batch
        }
    }, [showRecallItem, startStudy]);

    const handleRecallSelect = useCallback((name, timedOut = false) => {
        if (phaseRef.current !== P.RECALL || recallAnsweringRef.current) return;
        recallAnsweringRef.current = true;
        if (recallTimerRef.current) { clearTimeout(recallTimerRef.current); recallTimerRef.current = null; }
        const r = recallRef.current;
        const item = r.order[r.index];
        recallTrialsRef.current.push({
            faceId: item.faceId,
            selectedName: timedOut ? null : name,
            ...(timedOut && { timedOut: true }),
        });
        setRecallView(null);    // brief blank between items
        recallTimerRef.current = setTimeout(() => advanceRecall(), T.INTER_ITEM_MS);
    }, [advanceRecall]);
    recallSelectRef.current = handleRecallSelect;

    const startRecall = useCallback(() => {
        const struct = structureRef.current;
        recallRef.current = { order: shuffle([...struct.recall.items]), index: 0 };
        setPhase(P.RECALL);
        showRecallItem();
    }, [setPhase, showRecallItem]);

    // --- Public actions ---
    const initializeSession = useCallback(async () => {
        if (didInitRef.current) return;
        didInitRef.current = true;
        setIsLoading(true);
        setError(null);
        try {
            const getStructure = httpsCallable(functions, 'getFaceNameMemoryTrainerStructure');
            const res = await getStructure({});
            const data = res.data || {};
            const recall = (data.recall && Array.isArray(data.recall.items)) ? data.recall : { items: [] };
            const study = (data.study && Array.isArray(data.study.pairs)) ? data.study : { pairs: [], faceIds: [], setSize: T.START_SET };
            if (!study.pairs.length) throw new Error('Invalid trainer structure received.');
            structureRef.current = { recall, study };
            isFirstSessionRef.current = recall.items.length === 0;
            recallTrialsRef.current = [];
            sessionIdRef.current = makeSessionId();
            preloadNames(study.pairs.map((p) => p.name));
            preloadImages([...recall.items.map((i) => i.file), ...study.pairs.map((p) => p.file)]);
            setCurrentLevel(Number.isFinite(data.level) ? data.level : (study.setSize || T.START_SET));
            setBestLevel(Number.isFinite(data.bestLevel) ? data.bestLevel : (study.setSize || T.START_SET));
            setIsReadyToStart(true);
        } catch (err) {
            console.error('[FaceNameMemoryTrainer] init failed:', err);
            setError(err?.code === 'functions/permission-denied'
                ? 'The Face-Name Memory Trainer requires a Pro subscription.'
                : (err?.message || 'Could not start the trainer.'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const startSession = useCallback(() => {
        if (!isReadyToStart) return;
        sessionStartRef.current = Date.now();
        setIsReadyToStart(false);
        if (isFirstSessionRef.current) startStudy();
        else startRecall();
    }, [isReadyToStart, startStudy, startRecall]);

    const handleExitTrainer = useCallback(() => {
        isSubmittingRef.current = true;   // freeze the loop; abandoning leaves pendingRecall unchanged server-side
        clearTimers();
        if (onExit) onExit();
    }, [onExit, clearTimers]);

    return {
        currentPhase, studyView, recallView,
        currentLevel, bestLevel,
        isFirstSession: isFirstSessionRef.current,
        isReadyToStart, isLoading, error, finalResults,
        initializeSession, startSession, handleRecallSelect, handleExitTrainer,
    };
};

export default useFaceNameMemoryTrainerLogic;

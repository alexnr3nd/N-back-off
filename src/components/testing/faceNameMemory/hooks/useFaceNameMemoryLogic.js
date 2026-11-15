/* src/components/testing/faceNameMemory/hooks/useFaceNameMemoryLogic.js */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser } from '../../../../contexts/UserContext';
import { FACE_NAME_MEMORY_PHASES, FACE_NAME_MEMORY_DEFAULTS } from '../../../../constants/faceNameMemoryConstants';
import { functions, httpsCallable } from '../../../../firebaseConfig';
import { savePendingResults, getPendingResults, clearPendingResults, shuffle } from './faceNameMemoryHelpers';
import { preloadNames } from './nameAudio';
import { prefetchFaceVideos, waitForFirstVideo } from './faceVideoPrefetch';

const P = FACE_NAME_MEMORY_PHASES;
const D = FACE_NAME_MEMORY_DEFAULTS;

/**
 * Core logic for the Face-Name Memory assessment. Flow (scored):
 *   study x2 (each pair ~6s, reshuffled per pass) -> immediate cued recall
 *   (tap the name) -> filled delay (arithmetic distractor) -> delayed recall
 *   -> submit -> results. Familiarization is a 1-pass 3-pair practice with
 *   immediate recall only (no delay), then a familiarization submit.
 *
 * Advancement is DEFERRED (a short INTER_ITEM_MS gap) and gated by a per-item
 * "consumed" flag (studyAdvancingRef / recallAnsweringRef) that is reset only
 * when the NEXT item actually displays. This blocks the same-tick race where
 * an auto-advance timer and a user tap both fire — which would otherwise record
 * a response for the wrong face or skip an item (mirrors the Visual Arrays
 * deferred-reset pattern). Unlike Visual Arrays this is not frame-timing
 * critical, so the heavier interruption/void machinery is unnecessary. The
 * summary page recovers a failed submission via getPendingResults.
 */
const useFaceNameMemoryLogic = (options = {}) => {
    const { earlyRetake = false, onExit } = options;
    const { userId } = useUser();

    const [currentPhase, setCurrentPhase] = useState(P.LOADING);
    const [isFamiliarization, setIsFamiliarization] = useState(false);
    const [studyView, setStudyView] = useState(null);   // { pair, index, total, pass, totalPasses }
    const [recallView, setRecallView] = useState(null); // { face, options, index, total, phase }
    const [finalScores, setFinalScores] = useState(null);
    const [notEligibleMessage, setNotEligibleMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const didInitRef = useRef(false);
    const isSubmittingRef = useRef(false);
    const userIdRef = useRef(userId);
    const phaseRef = useRef(currentPhase);
    const structureRef = useRef(null);   // { formId, pairs, options, isFamiliarization }
    const responsesRef = useRef([]);
    const distractorMetricsRef = useRef(null); // { correct, total } from the filled-delay task
    const studyRef = useRef({ order: [], index: 0, pass: 1, totalPasses: 2 });
    const recallRef = useRef({ order: [], index: 0, phase: 'immediate' });
    const studyTimerRef = useRef(null);
    const recallTimerRef = useRef(null);
    const recallOnsetRef = useRef(null);
    // Per-item consumed guards (reset only when the next item displays).
    const studyAdvancingRef = useRef(false);
    const recallAnsweringRef = useRef(false);
    // Forward refs for timer callbacks that reference later-defined callbacks.
    const advanceStudyRef = useRef(null);
    const recallSelectRef = useRef(null);

    useEffect(() => { userIdRef.current = userId; }, [userId]);
    useEffect(() => { phaseRef.current = currentPhase; }, [currentPhase]);

    const clearTimers = useCallback(() => {
        if (studyTimerRef.current) { clearTimeout(studyTimerRef.current); studyTimerRef.current = null; }
        if (recallTimerRef.current) { clearTimeout(recallTimerRef.current); recallTimerRef.current = null; }
    }, []);

    // --- Submission ---
    const submitResults = useCallback(async (isFamiliar) => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        clearTimers();
        setStudyView(null);
        setRecallView(null);
        setCurrentPhase(P.SAVING);

        const uid = userIdRef.current;
        const struct = structureRef.current;
        const payload = isFamiliar
            ? { isFamiliarization: true }
            : {
                isFamiliarization: false,
                formId: struct.formId,
                responses: responsesRef.current,
                ...(distractorMetricsRef.current && { distractorMetrics: distractorMetricsRef.current }),
                ...(earlyRetake && { forceSubmit: true }),
            };

        try {
            const submitFunc = httpsCallable(functions, 'submitFaceNameMemoryResults');
            const result = await submitFunc(payload);
            if (!result.data?.success) throw new Error(result.data?.message || 'Submission failed.');
            if (isFamiliar) {
                setFinalScores({ familiarizationComplete: true });
            } else {
                setFinalScores({
                    delayedHitRate: result.data.delayedHitRate ?? null,
                    immediateHitRate: result.data.immediateHitRate ?? null,
                    retention: result.data.retention ?? null,
                    distractorAccuracy: result.data.distractorAccuracy ?? null,
                    flaggedLowValidity: result.data.flaggedLowValidity === true,
                });
            }
            clearPendingResults(uid);
        } catch (err) {
            console.error('[FaceNameMemory] Submit error:', err);
            const code = err.code;
            if (!isFamiliar && code !== 'functions/invalid-argument' && code !== 'functions/permission-denied') {
                savePendingResults(uid, payload);
                setError('Results saved locally. They will be submitted when you return to the assessment page.');
            } else {
                setError(`Failed to save results: ${err.message}`);
            }
        } finally {
            isSubmittingRef.current = false;
            setCurrentPhase(P.RESULTS);
        }
    }, [earlyRetake, clearTimers]);

    // --- Recall display ---
    const showRecallItem = useCallback(() => {
        const r = recallRef.current;
        const struct = structureRef.current;
        recallAnsweringRef.current = false;  // this item is now answerable
        const face = r.order[r.index];
        // Prefer the per-face same-ethnicity grid (ethnicity-cue fix); fall back to
        // the per-gender studied pool for familiarization or an older structure.
        const pool = struct.isFamiliarization
            ? struct.options.all
            : (face.options || struct.options[face.gender]);
        const opts = shuffle([...(pool || [])]);
        recallOnsetRef.current = Date.now();
        setRecallView({ face, options: opts, index: r.index, total: r.order.length, phase: r.phase });
        // One-ahead: load the next recall clip while this one is on screen.
        const nextFace = r.order[r.index + 1];
        if (nextFace && nextFace.video) prefetchFaceVideos([nextFace.video]);
        if (recallTimerRef.current) clearTimeout(recallTimerRef.current);
        recallTimerRef.current = setTimeout(() => {
            if (recallSelectRef.current) recallSelectRef.current(null, true);
        }, D.RECALL_TIMEOUT_MS);
    }, []);

    const advanceRecall = useCallback(() => {
        const r = recallRef.current;
        const struct = structureRef.current;
        if (r.index + 1 < r.order.length) {
            r.index += 1;
            showRecallItem();
            return;
        }
        if (r.phase === 'immediate') {
            if (struct.isFamiliarization) {
                submitResults(true);
            } else {
                setRecallView(null);
                phaseRef.current = P.DELAY;
                setCurrentPhase(P.DELAY);
            }
        } else {
            submitResults(false);
        }
    }, [showRecallItem, submitResults]);

    const handleRecallSelect = useCallback((name, timedOut = false) => {
        if (phaseRef.current !== P.IMMEDIATE_RECALL && phaseRef.current !== P.DELAYED_RECALL) return;
        if (recallAnsweringRef.current) return;          // already answered this item
        recallAnsweringRef.current = true;
        if (recallTimerRef.current) { clearTimeout(recallTimerRef.current); recallTimerRef.current = null; }
        const r = recallRef.current;
        const face = r.order[r.index];
        const rtMs = recallOnsetRef.current ? Date.now() - recallOnsetRef.current : null;
        responsesRef.current.push({
            faceId: face.faceId,
            phase: r.phase,
            selectedName: timedOut ? null : name,
            rtMs,
            ...(timedOut && { timedOut: true }),
        });
        setRecallView(null);                              // brief blank
        recallTimerRef.current = setTimeout(() => advanceRecall(), D.INTER_ITEM_MS);
    }, [advanceRecall]);
    useEffect(() => { recallSelectRef.current = handleRecallSelect; }, [handleRecallSelect]);

    const startRecall = useCallback((phase) => {
        const struct = structureRef.current;
        recallRef.current = { order: shuffle([...struct.pairs]), index: 0, phase };
        // Warm the opening recall clip(s) (usually already cached from study).
        const o = recallRef.current.order;
        prefetchFaceVideos([o[0] && o[0].video, o[1] && o[1].video].filter(Boolean));
        const next = phase === 'immediate' ? P.IMMEDIATE_RECALL : P.DELAYED_RECALL;
        phaseRef.current = next;
        setCurrentPhase(next);
        showRecallItem();
    }, [showRecallItem]);

    // --- Study display ---
    const showStudyItem = useCallback(() => {
        const s = studyRef.current;
        studyAdvancingRef.current = false;  // this item is now advanceable
        const pair = s.order[s.index];
        setStudyView({ pair, index: s.index, total: s.order.length, pass: s.pass, totalPasses: s.totalPasses });
        // One-ahead: load the next memorize clip while this one is on screen.
        const nextPair = s.order[s.index + 1];
        if (nextPair && nextPair.video) prefetchFaceVideos([nextPair.video]);
        // On the FINAL memorize card, warm the whole form so the first recall
        // clip is already loaded by the time recall begins (recall reuses these).
        if (s.pass >= s.totalPasses && s.index === s.order.length - 1) {
            prefetchFaceVideos(s.order.map((p) => p.video).filter(Boolean));
        }
        if (studyTimerRef.current) clearTimeout(studyTimerRef.current);
        studyTimerRef.current = setTimeout(() => {
            if (advanceStudyRef.current) advanceStudyRef.current();
        }, D.STUDY_MS);
    }, []);

    const advanceStudy = useCallback(() => {
        if (phaseRef.current !== P.STUDY || studyAdvancingRef.current) return;
        studyAdvancingRef.current = true;
        if (studyTimerRef.current) { clearTimeout(studyTimerRef.current); studyTimerRef.current = null; }
        const s = studyRef.current;
        if (s.index + 1 < s.order.length) {
            s.index += 1;
        } else if (s.pass < s.totalPasses) {
            s.pass += 1;
            s.index = 0;
            s.order = shuffle([...structureRef.current.pairs]);
        } else {
            setStudyView(null);
            startRecall('immediate');
            return;
        }
        // Keep the current card mounted through the inter-item gap (do NOT null the
        // view) so the framed portrait doesn't flash to the page background between
        // faces — showStudyItem swaps the pair in place (the still posters the next
        // clip, so it's face→face, never blank). The per-item guard reset still
        // happens in showStudyItem, so INTER_ITEM_MS race protection is unchanged.
        studyTimerRef.current = setTimeout(() => showStudyItem(), D.INTER_ITEM_MS);
    }, [showStudyItem, startRecall]);
    useEffect(() => { advanceStudyRef.current = advanceStudy; }, [advanceStudy]);

    const startStudy = useCallback(() => {
        const struct = structureRef.current;
        // Reuse the order staged during init (so the opening clip could be warmed
        // on the "Preparing assessment" screen); otherwise shuffle now. The
        // flag-off / no-video path leaves studyRef empty → identical to before.
        if (!studyRef.current.order || studyRef.current.order.length === 0) {
            const totalPasses = struct.isFamiliarization ? 1 : D.STUDY_REPEATS;
            studyRef.current = { order: shuffle([...struct.pairs]), index: 0, pass: 1, totalPasses };
        }
        phaseRef.current = P.STUDY;
        setCurrentPhase(P.STUDY);
        showStudyItem();
    }, [showStudyItem]);

    // --- Filled delay complete ---
    const handleDelayComplete = useCallback((metrics) => {
        if (metrics && metrics.total > 0) distractorMetricsRef.current = metrics;
        if (phaseRef.current !== P.DELAY) return;
        startRecall('delayed');
    }, [startRecall]);

    // --- Initialize (idempotent) ---
    const initializeSession = useCallback(async () => {
        if (didInitRef.current) return;
        didInitRef.current = true;
        setIsLoading(true);
        setError(null);
        try {
            const checkElig = httpsCallable(functions, 'checkFaceNameMemoryEligibility');
            const eligResult = await checkElig({});
            const data = eligResult.data || {};
            const isFamiliar = !data.familiarizationComplete;
            setIsFamiliarization(isFamiliar);

            if (data.familiarizationComplete && !data.isEligible && !earlyRetake) {
                setNotEligibleMessage(data.nextAvailableDateString || 'You are not eligible for a new assessment yet.');
                setIsLoading(false);
                setCurrentPhase(P.RESULTS);
                return;
            }

            const getStructure = httpsCallable(functions, 'getFaceNameMemoryStructure');
            const structResult = await getStructure({ forceStart: earlyRetake });
            const s = structResult.data || {};
            if (!Array.isArray(s.pairs) || s.pairs.length === 0 || !s.options) {
                throw new Error('Invalid structure received.');
            }
            structureRef.current = {
                formId: s.formId,
                pairs: s.pairs,
                options: s.options,
                isFamiliarization: !!s.isFamiliarization,
            };
            responsesRef.current = [];
            preloadNames(s.pairs.map((p) => p.name));

            // Animated-portrait rollout: when the structure carries `video` URLs,
            // stage the study order now and hold "Preparing assessment" until the
            // OPENING clip has buffered (capped), so the first memorize card never
            // buffers on screen. No `video` (flag off / old client) → skip entirely
            // and let startStudy shuffle exactly as before (behaviour unchanged).
            const hasVideo = s.pairs.some((p) => p.video);
            if (hasVideo) {
                const totalPasses = s.isFamiliarization ? 1 : D.STUDY_REPEATS;
                const order = shuffle([...s.pairs]);
                studyRef.current = { order, index: 0, pass: 1, totalPasses };
                prefetchFaceVideos([order[0] && order[0].video, order[1] && order[1].video].filter(Boolean));
                if (order[0] && order[0].video) await waitForFirstVideo(order[0].video, 2500);
            }

            setIsLoading(false);
            startStudy();
        } catch (err) {
            console.error('[FaceNameMemory] Init error:', err);
            const reason = err?.details?.nextAvailableDateString;
            if (reason) setNotEligibleMessage(reason);
            else setError(`Failed to initialize: ${err.message}`);
            setIsLoading(false);
            setCurrentPhase(P.RESULTS);
        }
    }, [earlyRetake, startStudy]);

    const handleExit = useCallback(() => {
        clearTimers();
        if (onExit) onExit();
    }, [clearTimers, onExit]);

    useEffect(() => () => clearTimers(), [clearTimers]);

    return {
        currentPhase,
        isFamiliarization,
        studyView,
        recallView,
        finalScores,
        notEligibleMessage,
        isLoading,
        error,
        delayMs: D.DELAY_MS,
        initializeSession,
        handleRecallSelect,
        handleDelayComplete,
        handleExit,
    };
};

export { getPendingResults, clearPendingResults };
export default useFaceNameMemoryLogic;

/* src/components/testing/letterNumberComparison/hooks/useLetterNumberComparisonLogic.js */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser } from '../../../../contexts/UserContext';
import { LNC_PHASES, LNC_DEFAULTS } from '../../../../constants/letterNumberComparisonConstants';
import { functions, httpsCallable } from '../../../../firebaseConfig';
import { useBlockTimer } from './useBlockTimer';
import {
    generatePracticeItems,
    isResponseCorrect,
    savePendingResults,
    getPendingResults,
    clearPendingResults,
} from './letterNumberComparisonHelpers';

const D = LNC_DEFAULTS;
const P = LNC_PHASES;

const taskForBlock = (b) => (b < D.BLOCKS_PER_TASK ? 'letter' : 'number');

/**
 * Core logic hook for the Letter & Number Comparison Speed assessment.
 *
 * Session flow (identical for familiarization and scored sessions):
 *   letter PRACTICE (5, feedback) -> READY -> GO -> BLOCK 0 (30s) -> BREAK ->
 *   GO -> BLOCK 1 -> number PRACTICE -> READY -> GO -> BLOCK 2 -> BREAK -> GO
 *   -> BLOCK 3 -> SAVING -> RESULTS.
 *
 * Items are USER-paced; the only clock is the 30s block clock (useBlockTimer).
 * No partial saves: all four blocks must complete validly (<=1 redo each) or
 * the session aborts UNSAVED — a count-based total isn't comparable with a
 * missing block and a null score would burn the monthly cooldown.
 *
 * Stale-closure rule (RM/VA convention): every value the stable timer
 * callbacks need at call time lives in a ref, never in captured state.
 *
 * NOTE: refreshUserData() is deliberately NOT called at save-success (known
 * CST/OSpan results-unmount bug) — the Task component's Done handler does it.
 */
const useLetterNumberComparisonLogic = (options = {}) => {
    const { earlyRetake = false, onExit } = options;
    const { userId } = useUser();

    // --- Core State ---
    const [currentPhase, setCurrentPhase] = useState(P.INSTRUCTIONS);
    const [currentItem, setCurrentItem] = useState(null);
    const [blink, setBlink] = useState(false);
    const [isPractice, setIsPractice] = useState(false);
    const [practiceNumber, setPracticeNumber] = useState(0);     // 1-based for display
    const [practiceTotal, setPracticeTotal] = useState(D.PRACTICE_ITEMS_PER_TASK);
    const [lastFeedbackCorrect, setLastFeedbackCorrect] = useState(null);
    const [blockNumber, setBlockNumber] = useState(0);           // 1-based, upcoming/current block of 4
    const [currentTask, setCurrentTask] = useState('letter');    // 'letter' | 'number'
    const [itemsAnswered, setItemsAnswered] = useState(0);       // display count, this block
    const [isFamiliarization, setIsFamiliarization] = useState(false);
    const [notEligibleMessage, setNotEligibleMessage] = useState(null);
    const [abortMessage, setAbortMessage] = useState(null);
    const [finalScores, setFinalScores] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [blockRunKey, setBlockRunKey] = useState(0);           // increments per block start (BlockTimerBar)

    // --- Refs (mutated without re-render / read by stable closures) ---
    const phaseRef = useRef(currentPhase);
    const didInitRef = useRef(false);
    const isSubmittingRef = useRef(false);
    const isFamiliarizationRef = useRef(false);
    const userIdRef = useRef(userId);
    const structureRef = useRef(null);            // server structure: { letter:{blocks,spares}, number:{...} }
    const blockIndexRef = useRef(0);              // current block, 0-3
    const streamRef = useRef([]);                 // current block's item stream
    const itemPosRef = useRef(0);                 // position within the current stream
    const blockRecordsRef = useRef([]);           // current block's responses (discarded on void)
    const recordsRef = useRef([]);                // finalized responses across completed blocks
    const redoUsedRef = useRef([false, false, false, false]);
    const practiceListRef = useRef([]);
    const practicePosRef = useRef(0);
    const practiceFeedbackRef = useRef(false);    // feedback flash showing (blocks practice responses)
    const blockActiveRef = useRef(false);         // a timed block is accepting responses
    const blinkRef = useRef(false);               // inter-item blink in progress
    const blinkTimeoutRef = useRef(null);
    const feedbackTimeoutRef = useRef(null);
    const goTimeoutRef = useRef(null);

    useEffect(() => { phaseRef.current = currentPhase; }, [currentPhase]);
    useEffect(() => { userIdRef.current = userId; }, [userId]);

    // Clear any pending timeouts on unmount (useBlockTimer cleans up the rAF).
    useEffect(() => () => {
        clearTimeout(blinkTimeoutRef.current);
        clearTimeout(feedbackTimeoutRef.current);
        clearTimeout(goTimeoutRef.current);
    }, []);

    const streamFor = (b, redo) => {
        const task = taskForBlock(b);
        const within = b % D.BLOCKS_PER_TASK;
        return structureRef.current[task][redo ? 'spares' : 'blocks'][within];
    };

    // --- Submission ---
    const submitResults = useCallback(async () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setIsLoading(true);
        setError(null);
        phaseRef.current = P.SAVING;
        setCurrentPhase(P.SAVING);

        const uid = userIdRef.current;
        if (!uid) {
            setError('No user ID.');
            setIsLoading(false);
            isSubmittingRef.current = false;
            phaseRef.current = P.RESULTS;
            setCurrentPhase(P.RESULTS);
            return;
        }

        const payload = {
            isFamiliarization: isFamiliarizationRef.current,
            trials: recordsRef.current,
            blocksMeta: redoUsedRef.current.map((redoUsed, block) => ({ block, redoUsed })),
            ...(earlyRetake && { forceSubmit: true }),
        };

        try {
            const submitFunc = httpsCallable(functions, 'submitLetterNumberComparisonResults');
            const result = await submitFunc(payload);
            if (result.data?.success) {
                setFinalScores({
                    score: result.data.score ?? null,
                    letterCorrect: result.data.letterCorrect ?? null,
                    numberCorrect: result.data.numberCorrect ?? null,
                    blockScores: result.data.blockScores ?? null,
                    overallAccuracy: result.data.overallAccuracy ?? null,
                    flaggedLowValidity: result.data.flaggedLowValidity === true,
                });
                clearPendingResults(uid);
                // refreshUserData() intentionally NOT called here (results-unmount
                // bug); the Done handler refreshes on navigation.
            } else {
                throw new Error(result.data?.message || 'Submission failed.');
            }
        } catch (err) {
            console.error('[LetterNumberComparison] Submit error:', err);
            if (err.code !== 'functions/invalid-argument' && err.code !== 'functions/permission-denied') {
                savePendingResults(uid, payload);
                setError('Results saved locally. They will be submitted when you return to the assessment page.');
            } else {
                setError(`Failed to save results: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
            isSubmittingRef.current = false;
            phaseRef.current = P.RESULTS;
            setCurrentPhase(P.RESULTS);
        }
    }, [earlyRetake]);

    // --- Practice (untimed, with feedback) ---
    const startPractice = useCallback((kind) => {
        clearTimeout(feedbackTimeoutRef.current);
        practiceListRef.current = generatePracticeItems(kind);
        practicePosRef.current = 0;
        practiceFeedbackRef.current = false;
        setIsPractice(true);
        setCurrentTask(kind);
        setPracticeNumber(1);
        setPracticeTotal(practiceListRef.current.length);
        setLastFeedbackCorrect(null);
        setBlink(false);
        blinkRef.current = false;
        setCurrentItem(practiceListRef.current[0] || null);
        phaseRef.current = P.PRACTICE;
        setCurrentPhase(P.PRACTICE);
    }, []);

    const handlePracticeRespond = useCallback((response) => {
        if (practiceFeedbackRef.current) return; // feedback flash in progress
        const item = practiceListRef.current[practicePosRef.current];
        if (!item) return;
        practiceFeedbackRef.current = true;
        setLastFeedbackCorrect(isResponseCorrect(item, response));
        feedbackTimeoutRef.current = setTimeout(() => {
            practiceFeedbackRef.current = false;
            setLastFeedbackCorrect(null);
            const nextPos = practicePosRef.current + 1;
            if (nextPos >= practiceListRef.current.length) {
                // Practice done -> READY for the upcoming block.
                setIsPractice(false);
                setCurrentItem(null);
                setBlockNumber(blockIndexRef.current + 1);
                phaseRef.current = P.READY;
                setCurrentPhase(P.READY);
                return;
            }
            practicePosRef.current = nextPos;
            setPracticeNumber(nextPos + 1);
            setCurrentItem(practiceListRef.current[nextPos]);
        }, D.PRACTICE_FEEDBACK_MS);
    }, []);

    // --- Timed-block respond (the hot path) ---
    const handleRespond = useCallback((response) => {
        if (phaseRef.current === P.PRACTICE) { handlePracticeRespond(response); return; }
        if (phaseRef.current !== P.BLOCK || !blockActiveRef.current || blinkRef.current) return;
        const item = streamRef.current[itemPosRef.current];
        if (!item) return;
        blockRecordsRef.current.push({
            block: blockIndexRef.current,
            idx: item.idx,
            a: item.a,
            b: item.b,
            isSame: item.isSame,
            response,
        });
        setItemsAnswered(blockRecordsRef.current.length);
        // 100ms blink, then the next item — unless the clock expired meanwhile.
        blinkRef.current = true;
        setBlink(true);
        blinkTimeoutRef.current = setTimeout(() => {
            blinkRef.current = false;
            if (!blockActiveRef.current) return; // expired/voided during the blink
            itemPosRef.current += 1;
            setCurrentItem(streamRef.current[itemPosRef.current] || null);
            setBlink(false);
        }, D.BLINK_MS);
    }, [handlePracticeRespond]);

    // --- Block timer callbacks (stable; values they need live in refs) ---
    const handleExpire = useCallback(() => {
        blockActiveRef.current = false; // synchronous: a tap racing the deadline is discarded
        clearTimeout(blinkTimeoutRef.current);
        blinkRef.current = false;
        setBlink(false);
        recordsRef.current.push(...blockRecordsRef.current);
        blockRecordsRef.current = [];
        const b = blockIndexRef.current;
        setCurrentItem(null);
        if (b === D.TOTAL_BLOCKS - 1) { submitResults(); return; }
        blockIndexRef.current = b + 1;
        if (b === D.BLOCKS_PER_TASK - 1) {
            // Letter task done -> number practice before its blocks.
            startPractice('number');
        } else {
            setBlockNumber(blockIndexRef.current + 1);
            phaseRef.current = P.BREAK;
            setCurrentPhase(P.BREAK);
        }
    }, [submitResults, startPractice]);

    const handleVoid = useCallback((reason) => {
        if (phaseRef.current !== P.BLOCK) return; // voids only matter mid-block
        blockActiveRef.current = false;
        clearTimeout(blinkTimeoutRef.current);
        blinkRef.current = false;
        setBlink(false);
        blockRecordsRef.current = []; // the voided attempt is discarded wholesale
        setCurrentItem(null);
        const b = blockIndexRef.current;
        console.warn(`[LNC] Block ${b} voided (${reason})`);
        if (redoUsedRef.current[b]) {
            // Second interruption of the same block: the session cannot be
            // scored. Abort with nothing saved — never burn the cooldown.
            setAbortMessage('The assessment was interrupted again and cannot be scored. Nothing was saved and no cooldown was used — you can start over anytime.');
            phaseRef.current = P.RESULTS;
            setCurrentPhase(P.RESULTS);
            return;
        }
        redoUsedRef.current[b] = true;
        setBlockNumber(b + 1);
        phaseRef.current = P.INTERRUPTED;
        setCurrentPhase(P.INTERRUPTED);
    }, []);

    const { startBlock, stopBlock, voidBlock } = useBlockTimer({ onExpire: handleExpire, onVoid: handleVoid });

    // --- Block entry ---
    const enterBlock = useCallback(() => {
        const b = blockIndexRef.current;
        streamRef.current = streamFor(b, redoUsedRef.current[b]);
        itemPosRef.current = 0;
        blockRecordsRef.current = [];
        blockActiveRef.current = true;
        blinkRef.current = false;
        setBlink(false);
        setItemsAnswered(0);
        setCurrentItem(streamRef.current[0]);
        setBlockNumber(b + 1);
        setCurrentTask(taskForBlock(b));
        setBlockRunKey(k => k + 1);
        phaseRef.current = P.BLOCK;
        setCurrentPhase(P.BLOCK);
        startBlock(D.BLOCK_MS);
    }, [startBlock]);

    // From READY, BREAK, or INTERRUPTED (redo): 500ms GO lead-in, then the block.
    const proceedToBlock = useCallback(() => {
        if (phaseRef.current === P.GO) return; // double-tap guard
        phaseRef.current = P.GO;
        setCurrentPhase(P.GO);
        goTimeoutRef.current = setTimeout(enterBlock, D.GO_LEAD_MS);
    }, [enterBlock]);

    // The Task reports the exit modal opening; an overlay over a running block voids it.
    const notifyOverlayOpened = useCallback(() => {
        if (phaseRef.current === P.BLOCK) voidBlock('overlay');
    }, [voidBlock]);

    // --- Initialize Session (idempotent; called on mount) ---
    const initializeSession = useCallback(async () => {
        if (didInitRef.current) return;
        didInitRef.current = true;
        console.log('[LetterNumberComparison] Initializing session...');
        setIsLoading(true);
        setError(null);

        try {
            const checkElig = httpsCallable(functions, 'checkLetterNumberComparisonEligibility');
            const eligResult = await checkElig({});
            const data = eligResult.data;
            const isFamiliar = !data.familiarizationComplete;
            setIsFamiliarization(isFamiliar);
            isFamiliarizationRef.current = isFamiliar;
            console.log(`[LetterNumberComparison] Session type: ${isFamiliar ? 'familiarization' : 'scored'}. Eligible: ${data.isEligible}`);

            if (data.familiarizationComplete && !data.isEligible && !earlyRetake) {
                setNotEligibleMessage(data.nextAvailableDateString || 'You are not eligible for a new assessment yet.');
                setIsLoading(false);
                phaseRef.current = P.RESULTS;
                setCurrentPhase(P.RESULTS);
                return;
            }

            const getStructure = httpsCallable(functions, 'getLetterNumberComparisonStructure');
            const structResult = await getStructure({ forceStart: earlyRetake });
            const { structure } = structResult.data || {};
            const shapeOk = structure
                && structure.letter?.blocks?.length === D.BLOCKS_PER_TASK
                && structure.letter?.spares?.length === D.BLOCKS_PER_TASK
                && structure.number?.blocks?.length === D.BLOCKS_PER_TASK
                && structure.number?.spares?.length === D.BLOCKS_PER_TASK;
            if (!shapeOk) {
                throw new Error('Invalid assessment structure received.');
            }
            structureRef.current = structure;
            recordsRef.current = [];
            redoUsedRef.current = [false, false, false, false];
            blockIndexRef.current = 0;
            console.log('[LetterNumberComparison] Structure cached.');

            setIsLoading(false);
            // Start-flow convention: begin with letter practice directly (the
            // summary-page confirm was press 2 — no in-task READY before practice).
            startPractice('letter');
        } catch (err) {
            console.error('[LetterNumberComparison] Init error:', err);
            setError(`Failed to initialize: ${err.message}`);
            setIsLoading(false);
            phaseRef.current = P.RESULTS;
            setCurrentPhase(P.RESULTS);
        }
    }, [earlyRetake, startPractice]);

    // --- Early Exit (always discards — no partial saves) ---
    const handleExitAssessment = useCallback(() => {
        // The session may have finished while the exit-confirm modal was open
        // (block 3 ended -> auto-submit). Don't double-submit / overpaint results.
        if (isSubmittingRef.current || phaseRef.current === P.SAVING || phaseRef.current === P.RESULTS) return;
        stopBlock();
        clearTimeout(blinkTimeoutRef.current);
        clearTimeout(feedbackTimeoutRef.current);
        clearTimeout(goTimeoutRef.current);
        // Always discard — partial sessions are never scoreable. (Opening the
        // exit modal already voided any running block via notifyOverlayOpened.)
        if (onExit) onExit();
    }, [stopBlock, onExit]);

    // --- Dev Skip (development builds only) ---
    const handleDevSkipTask = useCallback(async () => {
        if (process.env.NODE_ENV !== 'development') return;
        stopBlock();
        blockActiveRef.current = false;
        clearTimeout(blinkTimeoutRef.current);
        clearTimeout(feedbackTimeoutRef.current);
        clearTimeout(goTimeoutRef.current);
        const struct = structureRef.current;
        if (!struct) return;
        // Fabricate a full, valid 4-block submission from the real streams
        // (consecutive idx from 0, coherent pairs) so the backend validator and
        // scorer accept it. Letter blocks: 12 responses; number blocks: 20.
        const records = [];
        for (let b = 0; b < D.TOTAL_BLOCKS; b++) {
            const task = taskForBlock(b);
            const within = b % D.BLOCKS_PER_TASK;
            const stream = struct[task].blocks[within];
            const count = task === 'letter' ? 12 : 20;
            for (let i = 0; i < count && i < stream.length; i++) {
                const item = stream[i];
                const correct = Math.random() < 0.9;
                const correctResponse = item.isSame ? 'same' : 'different';
                const wrongResponse = item.isSame ? 'different' : 'same';
                records.push({
                    block: b,
                    idx: item.idx,
                    a: item.a,
                    b: item.b,
                    isSame: item.isSame,
                    response: correct ? correctResponse : wrongResponse,
                });
            }
        }
        recordsRef.current = records;
        redoUsedRef.current = [false, false, false, false];
        await submitResults();
    }, [stopBlock, submitResults]);

    return {
        // State
        currentPhase, currentItem, blink, isPractice,
        practiceNumber, practiceTotal, lastFeedbackCorrect,
        blockNumber, totalBlocks: D.TOTAL_BLOCKS, currentTask, itemsAnswered,
        isFamiliarization, notEligibleMessage, abortMessage,
        finalScores, isLoading, error, blockRunKey,
        blockDurationMs: D.BLOCK_MS,
        // Actions
        initializeSession, proceedToBlock, handleRespond,
        handleExitAssessment, handleDevSkipTask, notifyOverlayOpened,
    };
};

// Re-exported for the summary page pending-results recovery
export { getPendingResults, clearPendingResults };
export default useLetterNumberComparisonLogic;

/* src/components/testing/icar16/hooks/useReasoningCheckLogic.js */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useUser } from '../../../../contexts/UserContext';
import { functions, httpsCallable } from '../../../../firebaseConfig';
import { TASK_PHASES, ICAR_TOTAL_ITEMS } from '../../../../constants/icarConstants';

// --- localStorage helpers for offline resilience (mirrors OSPAN pattern) ---
const PENDING_KEY_PREFIX = 'reasoningCheck_pending_results_';
const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const savePendingResults = (userId, payload) => {
    try {
        localStorage.setItem(
            `${PENDING_KEY_PREFIX}${userId}`,
            JSON.stringify({ ...payload, savedAt: Date.now() }),
        );
    } catch (_) { /* ignore quota errors */ }
};

export const getPendingResults = (userId) => {
    try {
        const raw = localStorage.getItem(`${PENDING_KEY_PREFIX}${userId}`);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (Date.now() - data.savedAt > PENDING_MAX_AGE_MS) {
            localStorage.removeItem(`${PENDING_KEY_PREFIX}${userId}`);
            return null;
        }
        return data;
    } catch (_) { return null; }
};

export const clearPendingResults = (userId) => {
    try { localStorage.removeItem(`${PENDING_KEY_PREFIX}${userId}`); } catch (_) { /* ignore */ }
};

// --- UUID helper with fallback for older browsers / capacitor webviews ---
const generateClientSessionId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // RFC4122-ish v4 fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

/**
 * Core state machine for the Reasoning Check (ICAR16-based).
 *
 * Phases:
 *   INSTRUCTIONS → (initializeSession) → READY → (startTask) → ITEM …
 *     ITEM (×16) → (auto-submit on last response) → SAVING → RESULTS
 */
const useReasoningCheckLogic = (options = {}) => {
    const { onExit } = options;
    const { userId } = useUser();

    const [currentPhase, setCurrentPhase] = useState(TASK_PHASES.INSTRUCTIONS);
    const [items, setItems] = useState([]);              // server-delivered, no answer keys
    const [itemSetVersion, setItemSetVersion] = useState(null);
    const [currentItemIndex, setCurrentItemIndex] = useState(0);
    const [responses, setResponses] = useState([]);      // [{itemId, response, rtMs}]
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [finalResults, setFinalResults] = useState(null);
    const [pendingSaveBanner, setPendingSaveBanner] = useState(false);

    const clientSessionIdRef = useRef(null);
    const sessionStartTimeRef = useRef(null);
    const itemStartTimeRef = useRef(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    /**
     * Fetches the 16 items from the server (randomized, no answer keys),
     * generates a clientSessionId, and transitions to READY.
     */
    const initializeSession = useCallback(async () => {
        if (!userId) {
            setError('You must be logged in to take this test.');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const fetchItems = httpsCallable(functions, 'getReasoningCheckItems');
            const result = await fetchItems({});
            const data = result.data || {};
            if (!Array.isArray(data.items) || data.items.length !== ICAR_TOTAL_ITEMS) {
                throw new Error(`Expected ${ICAR_TOTAL_ITEMS} items, got ${data.items?.length ?? 0}.`);
            }
            if (!isMountedRef.current) return;
            setItems(data.items);
            setItemSetVersion(data.itemSetVersion || null);
            clientSessionIdRef.current = generateClientSessionId();
            setCurrentPhase(TASK_PHASES.READY);
        } catch (err) {
            if (isMountedRef.current) {
                setError(`Failed to load test items: ${err.message}`);
            }
        } finally {
            if (isMountedRef.current) setIsLoading(false);
        }
    }, [userId]);

    /**
     * Transitions READY → ITEM (presents item 0). Records session-wide start
     * time and per-item start time for the first item.
     */
    const startTask = useCallback(() => {
        if (currentPhase !== TASK_PHASES.READY) return;
        const now = Date.now();
        sessionStartTimeRef.current = now;
        itemStartTimeRef.current = now;
        setCurrentItemIndex(0);
        setResponses([]);
        setCurrentPhase(TASK_PHASES.ITEM);
    }, [currentPhase]);

    /**
     * Submits the full responses array to the server. Server scores
     * canonically; client receives final score breakdown.
     */
    const submitResults = useCallback(async (allResponses) => {
        if (!userId || !clientSessionIdRef.current) {
            setError('Cannot submit: missing session context.');
            return;
        }
        const durationMs = sessionStartTimeRef.current
            ? Date.now() - sessionStartTimeRef.current
            : 0;

        const payload = {
            responses: allResponses,
            durationMs,
            clientSessionId: clientSessionIdRef.current,
        };

        // Save to localStorage BEFORE attempting submit, so offline failures
        // can be recovered next visit.
        savePendingResults(userId, payload);

        setCurrentPhase(TASK_PHASES.SAVING);
        setIsLoading(true);
        try {
            const submit = httpsCallable(functions, 'submitReasoningCheckResults');
            const result = await submit(payload);
            const data = result.data || {};
            if (!data.success) {
                throw new Error('Server reported submission failure.');
            }
            if (!isMountedRef.current) return;
            clearPendingResults(userId);
            setFinalResults({
                rawScore: data.rawScore,
                maxScore: data.maxScore || ICAR_TOTAL_ITEMS,
                subtestScores: data.subtestScores || { verbal: 0, series: 0, matrix: 0, rotation: 0 },
                isDuplicate: !!data.isDuplicate,
            });
            setCurrentPhase(TASK_PHASES.RESULTS);
        } catch (err) {
            if (!isMountedRef.current) return;
            // Keep pending payload in localStorage; show error so user knows.
            setError(`Failed to save results: ${err.message}. Your responses are saved locally and will retry next visit.`);
            setPendingSaveBanner(true);
            setCurrentPhase(TASK_PHASES.RESULTS); // Show results screen anyway with error
        } finally {
            if (isMountedRef.current) setIsLoading(false);
        }
    }, [userId]);

    /**
     * Records the response to the current item and advances. If this was
     * the final item, automatically triggers submission.
     *
     * @param response - 1-based choice index, or null for skipped.
     */
    const recordResponse = useCallback((response) => {
        if (currentPhase !== TASK_PHASES.ITEM) return;
        const item = items[currentItemIndex];
        if (!item) return;

        const now = Date.now();
        const rtMs = itemStartTimeRef.current ? now - itemStartTimeRef.current : 0;
        const entry = { itemId: item.id, response, rtMs };

        setResponses((prev) => {
            const next = [...prev, entry];
            // If this was the last item, submit. Otherwise advance.
            if (next.length >= ICAR_TOTAL_ITEMS) {
                // Submit asynchronously; we don't await here to keep UI responsive.
                submitResults(next);
            } else {
                setCurrentItemIndex((idx) => idx + 1);
                itemStartTimeRef.current = Date.now();
            }
            return next;
        });
    }, [currentPhase, items, currentItemIndex, submitResults]);

    /**
     * Skips the current item (records null response).
     */
    const skipItem = useCallback(() => {
        recordResponse(null);
    }, [recordResponse]);

    /**
     * Exits the test before completion. Discards in-progress responses.
     */
    const exitEarly = useCallback(() => {
        // Clear any pending save (in-progress responses not committed)
        if (userId) clearPendingResults(userId);
        if (typeof onExit === 'function') onExit();
    }, [userId, onExit]);

    /**
     * Dev-only: skip to results with all-correct dummy responses (uses index 1
     * since we don't have answer keys client-side; results come from server).
     * In real dev use, clicking through items is fast enough.
     */
    const devSkipToResults = useCallback(() => {
        if (process.env.NODE_ENV !== 'development') return;
        const dummy = items.map((it) => ({ itemId: it.id, response: 1, rtMs: 100 }));
        submitResults(dummy);
    }, [items, submitResults]);

    return {
        // State
        currentPhase,
        items,
        itemSetVersion,
        currentItemIndex,
        currentItem: items[currentItemIndex] || null,
        responses,
        totalItems: ICAR_TOTAL_ITEMS,
        isLoading,
        error,
        finalResults,
        pendingSaveBanner,
        // Actions
        initializeSession,
        startTask,
        recordResponse,
        skipItem,
        exitEarly,
        devSkipToResults,
    };
};

export default useReasoningCheckLogic;

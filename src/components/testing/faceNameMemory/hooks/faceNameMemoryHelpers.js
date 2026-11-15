/* src/components/testing/faceNameMemory/hooks/faceNameMemoryHelpers.js */
/**
 * Client helpers for the Face-Name Memory assessment: a Fisher-Yates shuffle
 * and localStorage offline-resilience for a submission that failed to reach
 * the backend (recovered by the summary page on next visit). Mirrors the
 * Visual Arrays pending-results pattern.
 */

// Fisher-Yates (returns the same array, shuffled in place).
export const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const PENDING_KEY_PREFIX = 'facenamememory_pending_results_';
const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const savePendingResults = (userId, payload) => {
    try {
        localStorage.setItem(`${PENDING_KEY_PREFIX}${userId}`, JSON.stringify({ ...payload, savedAt: Date.now() }));
        console.log('[FaceNameMemory] Saved pending results to localStorage');
    } catch (e) {
        console.warn('[FaceNameMemory] Failed to save pending results:', e);
    }
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
    } catch (e) {
        return null;
    }
};

export const clearPendingResults = (userId) => {
    try {
        localStorage.removeItem(`${PENDING_KEY_PREFIX}${userId}`);
    } catch (e) { /* ignore */ }
};

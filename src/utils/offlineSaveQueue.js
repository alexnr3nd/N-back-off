/* src/utils/offlineSaveQueue.js */
/* IndexedDB-backed queue for game sessions that failed to save due to network errors */

import { createStore, get, set, del, keys, values } from 'idb-keyval';

// Custom idb-keyval store to avoid collisions with other IndexedDB usage
const queueStore = createStore('dual-n-back-offline-queue', 'save-queue');

/** window event fired after a successful enqueue (consumed by OfflineSaveContext). */
export const OFFLINE_QUEUE_CHANGED_EVENT = 'offline-save-queue-changed';

export const MAX_QUEUE_SIZE = 20;
export const MAX_RETRY_COUNT = 5;

/**
 * Generate a unique client session ID for idempotent saves.
 * Uses crypto.randomUUID if available, falls back to timestamp + random.
 */
export const generateClientSessionId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `csid_${timestamp}_${random}`;
};

/**
 * Get all queue entries from IndexedDB.
 * @returns {Promise<Object[]>} Array of queue entries
 */
export const getQueue = async () => {
    try {
        const allValues = await values(queueStore);
        return allValues || [];
    } catch (error) {
        console.error('[offlineSaveQueue] Failed to read queue:', error);
        return [];
    }
};

/**
 * Add a game session payload to the offline save queue.
 * @param {Object} payload - The exact payload that would be sent to calculateAndSaveResultsHttp
 * @param {string} clientSessionId - The unique client session ID
 * @param {{ uid?: string|null }} [options] - `uid`: the signed-in user who played it. The
 *   backend keys the save on the AUTHENTICATED uid, not the payload, so the drain must
 *   only replay an entry while that same user is signed in (shared device: A plays
 *   offline, signs out, B signs in → without this A's session lands in B's account).
 *   Entries without a uid (queued by builds before this field) are treated as owned by
 *   whoever is signed in, as before.
 * @returns {Promise<Object|null>} The created queue entry, or null on failure
 */
export const enqueue = async (payload, clientSessionId, { uid = null } = {}) => {
    try {
        const queue = await getQueue();

        // If at capacity, remove the oldest failed entry (or oldest pending if no failed)
        if (queue.length >= MAX_QUEUE_SIZE) {
            const failed = queue.filter(e => e.status === 'failed').sort((a, b) => a.queuedAt - b.queuedAt);
            const toRemove = failed.length > 0
                ? failed[0]
                : queue.sort((a, b) => a.queuedAt - b.queuedAt)[0];
            if (toRemove) {
                await del(toRemove.clientSessionId, queueStore);
            }
        }

        const entry = {
            clientSessionId,
            uid: uid || null,
            queuedAt: Date.now(),
            retryCount: 0,
            status: 'pending',
            failureReason: null,
            payload,
        };

        await set(clientSessionId, entry, queueStore);
        console.info(`[offlineSaveQueue] Enqueued session ${clientSessionId}`);
        // Let OfflineSaveContext refresh its counts (dashboard "waiting to sync" banner)
        // without waiting for a remount or the next flush.
        try {
            window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_CHANGED_EVENT));
        } catch (_) { /* non-DOM environment */ }
        return entry;
    } catch (error) {
        console.error('[offlineSaveQueue] Failed to enqueue:', error);
        return null;
    }
};

/**
 * Remove a successfully saved entry from the queue.
 * @param {string} clientSessionId
 */
export const dequeue = async (clientSessionId) => {
    try {
        await del(clientSessionId, queueStore);
    } catch (error) {
        console.error('[offlineSaveQueue] Failed to dequeue:', error);
    }
};

/**
 * Increment retry count. If max retries exceeded, mark as failed.
 * @param {string} clientSessionId
 */
export const markRetried = async (clientSessionId) => {
    try {
        const entry = await get(clientSessionId, queueStore);
        if (!entry) return;

        entry.retryCount += 1;
        if (entry.retryCount >= MAX_RETRY_COUNT) {
            entry.status = 'failed';
            entry.failureReason = 'max_retries_exceeded';
        }
        await set(clientSessionId, entry, queueStore);
    } catch (error) {
        console.error('[offlineSaveQueue] Failed to mark retried:', error);
    }
};

/**
 * Mark an entry as permanently failed.
 * @param {string} clientSessionId
 * @param {string} reason - Why the save failed permanently
 */
export const markFailed = async (clientSessionId, reason) => {
    try {
        const entry = await get(clientSessionId, queueStore);
        if (!entry) return;

        entry.status = 'failed';
        entry.failureReason = reason;
        await set(clientSessionId, entry, queueStore);
    } catch (error) {
        console.error('[offlineSaveQueue] Failed to mark failed:', error);
    }
};

/**
 * Get all pending entries, sorted by queuedAt ascending (oldest first).
 * @returns {Promise<Object[]>}
 */
export const getPendingEntries = async () => {
    const queue = await getQueue();
    return queue
        .filter(e => e.status === 'pending')
        .sort((a, b) => a.queuedAt - b.queuedAt);
};

/**
 * Get queue size counts.
 * @returns {Promise<{pending: number, failed: number, total: number}>}
 */
export const getQueueSize = async () => {
    const queue = await getQueue();
    return {
        pending: queue.filter(e => e.status === 'pending').length,
        failed: queue.filter(e => e.status === 'failed').length,
        total: queue.length,
    };
};

/**
 * Reset a failed entry back to pending for manual retry.
 * @param {string} clientSessionId
 */
export const resetEntryForRetry = async (clientSessionId) => {
    try {
        const entry = await get(clientSessionId, queueStore);
        if (!entry) return;

        entry.status = 'pending';
        entry.retryCount = 0;
        entry.failureReason = null;
        // queuedAt stays immutable (it orders the drain and drives eviction); the drain's
        // stale rule reads max(queuedAt, manualRetryAt) so a manual Retry on a stale entry
        // gets a real attempt instead of being re-marked stale before the callable runs.
        entry.manualRetryAt = Date.now();
        await set(clientSessionId, entry, queueStore);
    } catch (error) {
        console.error('[offlineSaveQueue] Failed to reset entry:', error);
    }
};

/**
 * Clear the entire queue.
 */
export const clearQueue = async () => {
    try {
        const allKeys = await keys(queueStore);
        for (const key of allKeys) {
            await del(key, queueStore);
        }
    } catch (error) {
        console.error('[offlineSaveQueue] Failed to clear queue:', error);
    }
};

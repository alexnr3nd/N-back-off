/* src/utils/sequenceCache.js */
/* IndexedDB cache for pre-fetched game sequences, enabling offline play */

import { createStore, get, set, del, keys, values } from 'idb-keyval';

const cacheStore = createStore('dual-n-back-sequence-cache', 'sequences');

const MAX_CACHED_SEQUENCES = 5;

/**
 * Sequence generator version — bumped on any algorithm change that would make
 * cached sequences from a prior version semantically incompatible. Included in
 * cache keys so a version bump implicitly invalidates older cached entries.
 *   v2 (prior): spatial pool progression
 *   v3.0.0:     per-modality match rates + explicit overlap counts + depth scaling
 */
export const SEQUENCE_GENERATOR_VERSION = '3.0.0';

/**
 * Build a cache key from game parameters.
 */
const buildKey = (gameMode, nBack, difficulty, language) =>
    `v${SEQUENCE_GENERATOR_VERSION}-${gameMode}-${nBack}-${difficulty}-${language}`;

/**
 * Get a cached sequence matching the given parameters.
 * Returns the first match and removes it from cache (use-once pattern).
 * @returns {Promise<Object|null>} The cached sequence data or null
 */
export const getSequenceFromCache = async (gameMode, nBack, difficulty, language) => {
    try {
        const key = buildKey(gameMode, nBack, difficulty, language);
        const allEntries = await values(cacheStore);
        const match = allEntries.find(e => e.key === key);
        if (match) {
            // Remove from cache (use-once)
            await del(match.id, cacheStore);
            return match.data;
        }
        return null;
    } catch (error) {
        console.warn('[sequenceCache] Failed to read cache:', error);
        return null;
    }
};

/**
 * Add a sequence to the cache.
 * @param {string} gameMode
 * @param {number} nBack
 * @param {number} difficulty
 * @param {string} language
 * @param {Object} sequenceData - Full response from generateSequence
 */
export const addSequenceToCache = async (gameMode, nBack, difficulty, language, sequenceData) => {
    try {
        const key = buildKey(gameMode, nBack, difficulty, language);
        const id = `${key}-${Date.now()}`;

        await set(id, {
            id,
            key,
            gameMode,
            nBack,
            difficulty,
            language,
            data: sequenceData,
            createdAt: Date.now(),
        }, cacheStore);

        // Prune if over limit
        await pruneCache();
    } catch (error) {
        console.warn('[sequenceCache] Failed to add to cache:', error);
    }
};

/**
 * Remove oldest entries if cache exceeds max size.
 */
export const pruneCache = async (maxEntries = MAX_CACHED_SEQUENCES) => {
    try {
        const allEntries = await values(cacheStore);
        if (allEntries.length <= maxEntries) return;

        // Sort by createdAt ascending (oldest first)
        const sorted = allEntries.sort((a, b) => a.createdAt - b.createdAt);
        const toRemove = sorted.slice(0, sorted.length - maxEntries);
        for (const entry of toRemove) {
            await del(entry.id, cacheStore);
        }
    } catch (error) {
        console.warn('[sequenceCache] Failed to prune cache:', error);
    }
};

/**
 * Check how many sequences are cached for given parameters.
 */
export const getCacheCount = async (gameMode, nBack, difficulty, language) => {
    try {
        const key = buildKey(gameMode, nBack, difficulty, language);
        const allEntries = await values(cacheStore);
        return allEntries.filter(e => e.key === key).length;
    } catch (error) {
        return 0;
    }
};

/**
 * Clear all cached sequences.
 */
export const clearCache = async () => {
    try {
        const allKeys = await keys(cacheStore);
        for (const key of allKeys) {
            await del(key, cacheStore);
        }
    } catch (error) {
        console.warn('[sequenceCache] Failed to clear cache:', error);
    }
};

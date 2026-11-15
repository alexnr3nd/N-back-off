/* src/components/testing/digitSpan/hooks/digitSpanHelpers.js */
/**
 * Pure helpers for the Digit Span assessment frontend.
 * Staircase rule, local (practice/fallback) sequence generation, response
 * comparison, pool validation, and localStorage pending-results persistence.
 */
import { DIGIT_SPAN_DEFAULTS } from '../../../../constants/digitSpanConstants';

// --- Staircase (Woods 1:2 rule) ---

/**
 * Applies the Woods adaptive rule after a scored trial:
 * - correct -> length +1 (clamped at cap), error streak resets
 * - MAX_CONSECUTIVE_ERRORS consecutive errors at a length -> length -1
 *   (clamped at floor), streak resets
 * - single error -> same length, streak increments
 *
 * @returns {{ nextLength: number, nextErrorStreak: number }}
 */
export const applyStaircase = ({ currentLength, wasCorrect, errorStreak, floor, cap }) => {
    if (wasCorrect) {
        return { nextLength: Math.min(cap, currentLength + 1), nextErrorStreak: 0 };
    }
    const streak = errorStreak + 1;
    if (streak >= DIGIT_SPAN_DEFAULTS.MAX_CONSECUTIVE_ERRORS) {
        return { nextLength: Math.max(floor, currentLength - 1), nextErrorStreak: 0 };
    }
    return { nextLength: currentLength, nextErrorStreak: streak };
};

// --- Local Sequence Generation (practice + pool-dry fallback only) ---

// Woods adjacency constraint (mirrors functions/digitSpanUtils.js): no
// consecutive digits differing by 1 (runs) or 2 (odd/even runs).
const violatesAdjacency = (a, b) => {
    const diff = Math.abs(a - b);
    return diff === 1 || diff === 2;
};

const plainSample = (length) => {
    const pool = [...DIGIT_SPAN_DEFAULTS.DIGIT_POOL];
    const selected = [];
    for (let i = 0; i < length && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        selected.push(pool.splice(idx, 1)[0]);
    }
    return selected;
};

/**
 * Generates `length` digits from 1-9 without replacement, honoring the same
 * adjacency constraint as server sequences (randomized backtracking, which
 * always succeeds for lengths <= 9). Used for practice trials and the
 * pool-dry fallback; plain sampling only as a never-strand last resort.
 */
export const generateLocalDigitSequence = (length) => {
    const pool = DIGIT_SPAN_DEFAULTS.DIGIT_POOL;
    const path = [];
    const used = new Set();

    const dfs = () => {
        if (path.length === length) return true;
        const prev = path.length > 0 ? path[path.length - 1] : null;
        const candidates = pool.filter(d => !used.has(d) && (prev === null || !violatesAdjacency(prev, d)));
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        for (const digit of candidates) {
            path.push(digit);
            used.add(digit);
            if (dfs()) return true;
            path.pop();
            used.delete(digit);
        }
        return false;
    };

    if (length >= 1 && length <= pool.length && dfs()) return [...path];
    return plainSample(length);
};

// --- Response Comparison (client-side feedback + staircase decisions) ---

/**
 * All-or-nothing verbatim comparison. Backward responses must match the
 * reversed target. Mirrors the backend isTrialCorrect (minus timeout, which
 * the logic hook handles before calling this).
 */
export const compareResponse = (targetDigits, responseDigits, direction) => {
    if (!Array.isArray(targetDigits) || !Array.isArray(responseDigits)) return false;
    if (responseDigits.length !== targetDigits.length) return false;
    const expected = direction === 'backward' ? [...targetDigits].reverse() : targetDigits;
    return expected.every((digit, i) => responseDigits[i] === digit);
};

// --- Fetch-Time Pool Validation ---

/**
 * Verifies the server pools cover every length the staircase can reach
 * (forward floor..cap and backward floor..cap) with non-empty buckets.
 */
export const validateDigitSpanPools = (forwardPool, backwardPool) => {
    const { FORWARD, BACKWARD } = DIGIT_SPAN_DEFAULTS.BLOCK_CONFIG;
    const checkRange = (pool, floor, cap) => {
        for (let length = floor; length <= cap; length++) {
            const bucket = pool?.[String(length)];
            if (!Array.isArray(bucket) || bucket.length === 0) return false;
        }
        return true;
    };
    return checkRange(forwardPool, FORWARD.floor, FORWARD.cap)
        && checkRange(backwardPool, BACKWARD.floor, BACKWARD.cap);
};

// --- localStorage helpers for offline resilience ---
const PENDING_KEY_PREFIX = 'digitspan_pending_results_';
const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const savePendingResults = (userId, payload) => {
    try {
        const key = `${PENDING_KEY_PREFIX}${userId}`;
        localStorage.setItem(key, JSON.stringify({ ...payload, savedAt: Date.now() }));
        console.log('[DigitSpan] Saved pending results to localStorage');
    } catch (e) {
        console.warn('[DigitSpan] Failed to save pending results to localStorage:', e);
    }
};

export const getPendingResults = (userId) => {
    try {
        const key = `${PENDING_KEY_PREFIX}${userId}`;
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (Date.now() - data.savedAt > PENDING_MAX_AGE_MS) {
            localStorage.removeItem(key);
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

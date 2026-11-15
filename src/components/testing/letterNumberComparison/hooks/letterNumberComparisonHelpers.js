/* src/components/testing/letterNumberComparison/hooks/letterNumberComparisonHelpers.js */
/**
 * Pure helpers for the Letter & Number Comparison Speed assessment frontend.
 * Local item-spec generation (PRACTICE ONLY — scored streams always come from
 * the server), response comparison, and localStorage pending-results
 * persistence. Mirrors the shape of relationMonitoringHelpers.js; the item
 * generation mirrors functions/letterNumberComparisonUtils.js generateItemSpec.
 */
import { LNC_DEFAULTS } from '../../../../constants/letterNumberComparisonConstants';

const D = LNC_DEFAULTS;
const MAX_GENERATION_ATTEMPTS = 1000;
const BLOCKLIST = new Set(D.ACRONYM_BLOCKLIST);

const shuffleInPlace = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const alphabetFor = (kind) => (kind === 'letter' ? D.CONSONANTS : D.DIGITS);

const randomString = (alphabet, length) =>
    Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');

const isBlocklisted = (kind, s) => kind === 'letter' && s.length === 3 && BLOCKLIST.has(s);

/**
 * Client-side mirror of the server's generateItemSpec. Used ONLY for practice
 * items; scored item streams always come from getLetterNumberComparisonStructure.
 * Same pairs are identical strings; different pairs are the same string with
 * exactly one position changed to another character of the same alphabet.
 */
export const generateLocalItemSpec = (kind, length, isSame) => {
    const alphabet = alphabetFor(kind);
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
        const a = randomString(alphabet, length);
        if (isBlocklisted(kind, a)) continue;
        if (isSame) return { length, isSame: true, a, b: a };
        const pos = Math.floor(Math.random() * length);
        const replacement = alphabet[Math.floor(Math.random() * alphabet.length)];
        if (replacement === a[pos]) continue;
        const b = a.slice(0, pos) + replacement + a.slice(pos + 1);
        if (isBlocklisted(kind, b)) continue;
        return { length, isSame: false, a, b };
    }
    throw new Error('Practice item generation failed to converge.');
};

/**
 * Practice items for one task: one shuffled chunk of 6 (one same + one
 * different at each length), sliced to PRACTICE_ITEMS_PER_TASK.
 */
export const generatePracticeItems = (kind) => {
    const chunk = [];
    for (const len of D.SET_SIZES) {
        chunk.push(generateLocalItemSpec(kind, len, true));
        chunk.push(generateLocalItemSpec(kind, len, false));
    }
    shuffleInPlace(chunk);
    return chunk.slice(0, D.PRACTICE_ITEMS_PER_TASK).map((item, idx) => ({ idx, ...item }));
};

// --- Response Comparison (practice feedback only) ---

export const isResponseCorrect = (item, response) => (response === 'same') === item.isSame;

// --- localStorage helpers for offline resilience ---
const PENDING_KEY_PREFIX = 'lnc_pending_results_';
const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const savePendingResults = (userId, payload) => {
    try {
        const key = `${PENDING_KEY_PREFIX}${userId}`;
        localStorage.setItem(key, JSON.stringify({ ...payload, savedAt: Date.now() }));
        console.log('[LetterNumberComparison] Saved pending results to localStorage');
    } catch (e) {
        console.warn('[LetterNumberComparison] Failed to save pending results to localStorage:', e);
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

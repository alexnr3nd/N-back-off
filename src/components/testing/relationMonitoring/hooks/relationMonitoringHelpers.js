/* src/components/testing/relationMonitoring/hooks/relationMonitoringHelpers.js */
/**
 * Pure helpers for the Relation Monitoring assessment frontend.
 * Local trial-spec generation (PRACTICE ONLY — scored trials always come
 * from the server), response comparison, and localStorage pending-results
 * persistence.
 */
import { RELATION_MONITORING_DEFAULTS } from '../../../../constants/relationMonitoringConstants';

const D = RELATION_MONITORING_DEFAULTS;

const shuffleInPlace = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const randomDigit = () => Math.floor(Math.random() * 10);

// Cell indices of each scoring line: rows 0-2, then columns 0-2. Mirrors
// functions/relationMonitoringUtils.js LINES — no diagonals.
export const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
];

const findMatchingLines = (endings) => {
    const matching = [];
    LINES.forEach(([a, b, c], idx) => {
        if (endings[a] === endings[b] && endings[b] === endings[c]) matching.push(idx);
    });
    return matching;
};

const toGridStrings = (endings) => endings.map((ending) =>
    `${1 + Math.floor(Math.random() * 9)}${Math.floor(Math.random() * 10)}${ending}`
);

/**
 * Client-side mirror of the server's trial-spec generator. Used ONLY for
 * practice trials; scored trial specs always come from
 * getRelationMonitoringStructure.
 */
export const generateLocalTrialSpec = (isMatch) => {
    for (let attempt = 0; attempt < 1000; attempt++) {
        if (isMatch) {
            const targetLine = Math.floor(Math.random() * LINES.length);
            const targetDigit = randomDigit();
            const endings = new Array(9).fill(null);
            for (const cell of LINES[targetLine]) endings[cell] = targetDigit;
            for (let i = 0; i < 9; i++) {
                if (endings[i] === null) endings[i] = randomDigit();
            }
            const matching = findMatchingLines(endings);
            if (matching.length === 1 && matching[0] === targetLine) {
                return { isMatch: true, targetLine, grid: toGridStrings(endings) };
            }
        } else {
            const endings = Array.from({ length: 9 }, randomDigit);
            if (findMatchingLines(endings).length === 0) {
                return { isMatch: false, targetLine: null, grid: toGridStrings(endings) };
            }
        }
    }
    throw new Error('Practice trial generation failed to converge.');
};

/**
 * Builds the practice list: PRACTICE_TRIALS trials, roughly half match
 * (3 match / 2 non-match at the default 5), shuffled.
 */
export const generatePracticeTrials = () => {
    const matchCount = Math.ceil(D.PRACTICE_TRIALS * D.MATCH_PROPORTION);
    const trials = [];
    for (let i = 0; i < D.PRACTICE_TRIALS; i++) {
        trials.push(generateLocalTrialSpec(i < matchCount));
    }
    shuffleInPlace(trials);
    return trials.map((spec, index) => ({ ...spec, index }));
};

// --- Response Comparison (practice feedback only) ---

export const isResponseCorrect = (trialSpec, responded) =>
    trialSpec.isMatch === !!responded;

// --- localStorage helpers for offline resilience ---
const PENDING_KEY_PREFIX = 'relationmonitoring_pending_results_';
const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const savePendingResults = (userId, payload) => {
    try {
        const key = `${PENDING_KEY_PREFIX}${userId}`;
        localStorage.setItem(key, JSON.stringify({ ...payload, savedAt: Date.now() }));
        console.log('[RelationMonitoring] Saved pending results to localStorage');
    } catch (e) {
        console.warn('[RelationMonitoring] Failed to save pending results to localStorage:', e);
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

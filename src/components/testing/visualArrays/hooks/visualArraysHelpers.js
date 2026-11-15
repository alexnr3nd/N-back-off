/* src/components/testing/visualArrays/hooks/visualArraysHelpers.js */
/**
 * Pure helpers for the Visual Arrays assessment frontend.
 * Local trial-spec generation (PRACTICE ONLY — scored trials always come
 * from the server), practice-block assembly, response comparison, and
 * localStorage pending-results persistence.
 */
import { VISUAL_ARRAYS_DEFAULTS } from '../../../../constants/visualArraysConstants';

const D = VISUAL_ARRAYS_DEFAULTS;

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const shuffleInPlace = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

// --- Local Trial Generation (practice only) ---

// Client-side mirror of functions/visualArraysUtils.js generateNormalizedLayout.
// Coordinates are rounded BEFORE the separation check so the stored values
// satisfy the invariant.
const generateNormalizedLayout = (count) => {
    const pad = D.ITEM_LENGTH_NORM / 2 + 0.02;
    let separation = D.MIN_SEPARATION_NORM;
    let relaxed = false;
    const maxTries = 200;

    for (let attempt = 0; attempt < 5; attempt++) {
        const placed = [];
        let failed = false;
        for (let i = 0; i < count; i++) {
            let ok = false;
            for (let tries = 0; tries < maxTries; tries++) {
                const x = Math.round((pad + Math.random() * (1 - 2 * pad)) * 1000) / 1000;
                const y = Math.round((pad + Math.random() * (1 - 2 * pad)) * 1000) / 1000;
                const collides = placed.some(p => {
                    const dx = p.x - x;
                    const dy = p.y - y;
                    return (dx * dx + dy * dy) < separation * separation;
                });
                if (!collides) {
                    placed.push({ x, y });
                    ok = true;
                    break;
                }
            }
            if (!ok) { failed = true; break; }
        }
        if (!failed) return { positions: placed, layoutRelaxed: relaxed };
        separation *= 0.85;
        relaxed = true;
    }
    const positions = Array.from({ length: count }, () => ({
        x: Math.round((pad + Math.random() * (1 - 2 * pad)) * 1000) / 1000,
        y: Math.round((pad + Math.random() * (1 - 2 * pad)) * 1000) / 1000,
    }));
    return { positions, layoutRelaxed: true };
};

/**
 * Client-side mirror of the server's generateTrialSpec. Used ONLY for
 * practice trials; scored trial specs always come from
 * getVisualArraysStructure.
 */
export const generateLocalTrialSpec = (setSize, changed, cueColor) => {
    const { positions, layoutRelaxed } = generateNormalizedLayout(setSize * 2);
    const withOrientation = (p) => ({ ...p, orientation: randomFrom(D.ORIENTATIONS) });
    const targets = positions.slice(0, setSize).map(withOrientation);
    const distractors = positions.slice(setSize).map(withOrientation);
    const probeIndex = Math.floor(Math.random() * setSize);
    let probeOrientation = targets[probeIndex].orientation;
    if (changed) {
        probeOrientation = randomFrom(D.ORIENTATIONS.filter(o => o !== probeOrientation));
    }
    return { setSize, cueColor, changed, probeIndex, targets, distractors, probeOrientation, layoutRelaxed };
};

/**
 * Builds the practice list from PRACTICE_BLOCKS (4 at set size 2, then 4 at
 * set size 3). Within each block: half changed / half unchanged, shuffled;
 * cue colors random. Blocks stay in easy-to-harder order.
 */
export const generatePracticeTrials = () => {
    const trials = [];
    for (const block of D.PRACTICE_BLOCKS) {
        const blockTrials = [];
        for (let i = 0; i < block.count; i++) {
            blockTrials.push({
                trialId: `practice_${block.setSize}_${i}`,
                ...generateLocalTrialSpec(block.setSize, i % 2 === 0, randomFrom(D.CUE_COLORS)),
            });
        }
        shuffleInPlace(blockTrials);
        trials.push(...blockTrials);
    }
    return trials;
};

// --- Response Comparison (practice feedback only) ---

export const isResponseCorrect = (trialSpec, response) =>
    (response === 'different') === trialSpec.changed;

// --- localStorage helpers for offline resilience ---
const PENDING_KEY_PREFIX = 'visualarrays_pending_results_';
const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const savePendingResults = (userId, payload) => {
    try {
        const key = `${PENDING_KEY_PREFIX}${userId}`;
        localStorage.setItem(key, JSON.stringify({ ...payload, savedAt: Date.now() }));
        console.log('[VisualArrays] Saved pending results to localStorage');
    } catch (e) {
        console.warn('[VisualArrays] Failed to save pending results to localStorage:', e);
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

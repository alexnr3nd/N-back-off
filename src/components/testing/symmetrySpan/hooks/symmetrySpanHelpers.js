/* src/components/testing/symmetrySpan/hooks/symmetrySpanHelpers.js */
/**
 * Pure helpers for the Symmetry Span assessment frontend.
 * Pattern generation here is used for PRACTICE only — scored-test stimuli are
 * generated server-side (functions/symmetrySpanUtils.js); these are client
 * mirrors of the same algorithms.
 */
import { SYMSPAN_DEFAULTS } from '../../../../constants/symmetrySpanConstants';

const MATRIX_DIM = SYMSPAN_DEFAULTS.MATRIX_DIM;        // 8
const GRID_CELL_COUNT = SYMSPAN_DEFAULTS.GRID_DIM ** 2; // 16

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const sampleWithoutReplacement = (items, count) => {
    const pool = [...items];
    const selected = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        selected.push(pool.splice(idx, 1)[0]);
    }
    return selected;
};

const LEFT_HALF_CELLS = (() => {
    const cells = [];
    for (let row = 0; row < MATRIX_DIM; row++) {
        for (let col = 0; col < MATRIX_DIM / 2; col++) {
            cells.push(row * MATRIX_DIM + col);
        }
    }
    return cells;
})();

export const mirrorCell = (cell) => {
    const row = Math.floor(cell / MATRIX_DIM);
    const col = cell % MATRIX_DIM;
    return row * MATRIX_DIM + (MATRIX_DIM - 1 - col);
};

export const isPatternSymmetric = (filledCells) => {
    const cellSet = new Set(filledCells);
    for (const cell of cellSet) {
        if (!cellSet.has(mirrorCell(cell))) return false;
    }
    return true;
};

/**
 * Generates a practice symmetry pattern (mirror of the backend generators).
 * @param {boolean} isSymmetric
 * @returns {{ id: string, filledCells: number[], isSymmetric: boolean }}
 */
export const generateLocalPattern = (isSymmetric) => {
    const { PATTERN_FILL_MIN, PATTERN_FILL_MAX, FOIL_PERTURB_MIN, FOIL_PERTURB_MAX, MAX_FOIL_ATTEMPTS } =
        SYMSPAN_DEFAULTS;
    const id = `local_pat_${Math.random().toString(36).slice(2, 10)}`;

    if (isSymmetric) {
        const fill = randInt(PATTERN_FILL_MIN, PATTERN_FILL_MAX);
        const leftCells = sampleWithoutReplacement(LEFT_HALF_CELLS, fill);
        const filledCells = [...leftCells, ...leftCells.map(mirrorCell)].sort((a, b) => a - b);
        return { id, filledCells, isSymmetric: true };
    }

    // Near-symmetric foil: mirror an original left-half sample, perturb the left half
    for (let attempt = 0; attempt < MAX_FOIL_ATTEMPTS; attempt++) {
        const fill = randInt(PATTERN_FILL_MIN, PATTERN_FILL_MAX);
        const originalLeft = sampleWithoutReplacement(LEFT_HALF_CELLS, fill);
        const rightHalf = originalLeft.map(mirrorCell);
        const perturbCount = randInt(FOIL_PERTURB_MIN, FOIL_PERTURB_MAX);
        const kept = sampleWithoutReplacement(originalLeft, fill - perturbCount);
        const originalSet = new Set(originalLeft);
        const available = LEFT_HALF_CELLS.filter(c => !originalSet.has(c));
        const added = sampleWithoutReplacement(available, perturbCount);
        const filledCells = [...kept, ...added, ...rightHalf].sort((a, b) => a - b);
        if (!isPatternSymmetric(filledCells)) {
            return { id, filledCells, isSymmetric: false };
        }
    }

    // Unreachable by construction; drop one cell from a symmetric pattern
    const fallback = generateLocalPattern(true);
    return { id, filledCells: fallback.filledCells.slice(1), isSymmetric: false };
};

/**
 * Picks setSize unique storage cells (0..15) for a practice set.
 */
export const generateLocalSquareSequence = (setSize) => {
    const allCells = Array.from({ length: GRID_CELL_COUNT }, (_, i) => i);
    return sampleWithoutReplacement(allCells, setSize);
};

/**
 * Counts position-strict matches (client feedback only — the backend
 * recomputes all scores).
 */
export const compareRecall = (targetCells, recalledCells) => {
    let correct = 0;
    const size = Array.isArray(targetCells) ? targetCells.length : 0;
    for (let i = 0; i < size; i++) {
        if (recalledCells &&
            recalledCells[i] !== null &&
            recalledCells[i] !== undefined &&
            recalledCells[i] === targetCells[i]) {
            correct++;
        }
    }
    return correct;
};

/**
 * Canonical judgment deadline: practice mean RT + 2.5 SD, clamped
 * (Unsworth et al. 2005; Redick et al. 2012).
 */
export const computeCalibratedDeadline = (rts) => {
    const {
        SYMMETRY_CALIBRATION_SD_MULTIPLIER,
        SYMMETRY_DEADLINE_FLOOR_MS,
        SYMMETRY_DEADLINE_CEILING_MS,
    } = SYMSPAN_DEFAULTS;

    if (!Array.isArray(rts) || rts.length === 0) {
        return SYMMETRY_DEADLINE_CEILING_MS;
    }
    const mean = rts.reduce((s, v) => s + v, 0) / rts.length;
    const variance = rts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / rts.length;
    const sd = Math.sqrt(variance);
    let deadline = mean + SYMMETRY_CALIBRATION_SD_MULTIPLIER * sd;
    deadline = Math.max(SYMMETRY_DEADLINE_FLOOR_MS, deadline);
    deadline = Math.min(SYMMETRY_DEADLINE_CEILING_MS, deadline);
    return Math.round(deadline);
};

// --- localStorage helpers for offline resilience ---
const PENDING_KEY_PREFIX = 'symspan_pending_results_';
const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const savePendingResults = (userId, payload) => {
    try {
        const key = `${PENDING_KEY_PREFIX}${userId}`;
        localStorage.setItem(key, JSON.stringify({ ...payload, savedAt: Date.now() }));
        console.log('[SymSpan] Saved pending results to localStorage');
    } catch (e) {
        console.warn('[SymSpan] Failed to save pending results to localStorage:', e);
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

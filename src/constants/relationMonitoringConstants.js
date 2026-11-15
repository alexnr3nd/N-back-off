/* src/constants/relationMonitoringConstants.js */
/**
 * Constants for the Relation Monitoring assessment frontend.
 * Timing/protocol values are client copies of the canonical values in
 * functions/gameConstants.js RELATION_MONITORING_DEFAULTS — keep in sync.
 */

export const RELATION_MONITORING_PHASES = {
    INSTRUCTIONS: 'instructions',     // pre-init / loading
    READY: 'ready',                   // post-practice "scored blocks start now"
    ARRAY: 'array',                   // 3x3 grid visible (5500ms)
    BLINK: 'blink',                   // 100ms blank between scored arrays
    TRIAL_FEEDBACK: 'trial_feedback', // practice only (replaces the blink)
    BREAK: 'break',                   // self-paced rest between blocks
    SAVING: 'saving',
    RESULTS: 'results',
};

export const RELATION_MONITORING_TIMING = {
    ARRAY_MS: 5500,
    BLINK_MS: 100,
    TRIAL_FEEDBACK_MS: 1200,
};

export const RELATION_MONITORING_DEFAULTS = {
    ...RELATION_MONITORING_TIMING,
    BLOCKS: 3,
    TRIALS_PER_BLOCK: 36,
    MATCH_PROPORTION: 0.5,
    PRACTICE_TRIALS: 5,
    GRID_DIM: 3,
    // Data-quality guard: measured array-on duration deviating more than this
    // ratio from ARRAY_MS flags the trial (excluded from scoring server-side)
    MAX_ARRAY_DEVIATION_RATIO: 0.1,
    // Mirror of the backend scoring floor — needed for canSavePartial
    MIN_TRIALS_PER_TYPE_FOR_SCORE: 8,
    LOW_VALIDITY_FA_THRESHOLD: 50,
};

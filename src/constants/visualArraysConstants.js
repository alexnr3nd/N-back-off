/* src/constants/visualArraysConstants.js */
/**
 * Constants for the Visual Arrays assessment frontend.
 * Timing/layout values are client copies of the canonical values in
 * functions/gameConstants.js VISUAL_ARRAYS_DEFAULTS — keep in sync.
 */

export const VISUAL_ARRAYS_PHASES = {
    INSTRUCTIONS: 'instructions',
    READY: 'ready',                   // pre-block "Get Ready" screen
    FIXATION: 'fixation',
    CUE: 'cue',                       // RED / BLUE word
    CUE_GAP: 'cue_gap',
    ARRAY: 'array',                   // memory array visible (250ms)
    RETENTION: 'retention',           // blank delay (900ms)
    PROBE: 'probe',                   // probe display + response buttons
    TRIAL_FEEDBACK: 'trial_feedback', // practice only
    BREAK: 'break',                   // self-paced rest at halfway
    INTERRUPTED: 'interrupted',       // tab hidden mid-presentation
    SAVING: 'saving',
    RESULTS: 'results',
};

export const VISUAL_ARRAYS_TIMING = {
    FIXATION_MS: 800,
    CUE_MS: 250,
    CUE_GAP_MS: 100,
    ARRAY_MS: 250,
    RETENTION_MS: 900,
    ITI_MS: 500,
    RESPONSE_TIMEOUT_MS: 30000,
    TRIAL_FEEDBACK_MS: 1200,
    INTERRUPTED_NOTICE_MS: 1500,
};

export const VISUAL_ARRAYS_DEFAULTS = {
    ...VISUAL_ARRAYS_TIMING,
    SET_SIZES: [3, 5],
    TRIALS_PER_SET_SIZE: 60,
    MAX_TRIAL_REDOS: 6,
    BREAK_AFTER_TRIAL: 60,
    ORIENTATIONS: [0, 45, 90, 135],
    CUE_COLORS: ['RED', 'BLUE'],
    ITEM_LENGTH_NORM: 0.11,
    ITEM_WIDTH_RATIO: 0.36,
    MIN_SEPARATION_NORM: 0.16,
    MIN_TRIALS_PER_SET_SIZE_FOR_K: 8,
    PRACTICE_BLOCKS: [
        { setSize: 2, count: 4 },
        { setSize: 3, count: 4 },
    ],
};

// Rendered stimulus colors. Red/blue is the published cue pairing and is
// distinguishable under all common color-vision deficiencies (red/GREEN is
// the unsafe pair). Task background is neutral gray per the literature.
export const VISUAL_ARRAYS_COLORS = {
    RED: '#d62828',
    BLUE: '#1d6fd6',
    BACKGROUND: '#808080',
    PROBE_DOT: '#ffffff',
};

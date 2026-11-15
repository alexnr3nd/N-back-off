/* src/constants/symmetrySpanConstants.js */

/**
 * Constants for the Symmetry Span assessment frontend components
 * (canonical automated protocol: Unsworth, Redick, Heitz, Broadway & Engle
 * 2009; Redick et al. 2012).
 * Scoring and test-structure generation live on the backend
 * (`functions/symmetrySpanUtils.js`); values here are client copies of the
 * canonical values in `functions/gameConstants.js` SYMMETRY_SPAN_DEFAULTS.
 */

export const SYMSPAN_PHASES = {
    // Initial / setup
    INSTRUCTIONS: 'instructions',
    PRACTICE_FEEDBACK: 'practice_feedback',   // Detailed feedback between practice stages
    READY_ASSESSMENT: 'ready_assessment',     // Practice done, shows calibrated deadline

    // Active trial phases (one element = judgment -> blank -> square -> blank)
    FIXATION: 'fixation',                     // Fixation cross before a set
    SYMMETRY_JUDGMENT: 'symmetry_judgment',   // 8x8 pattern + Symmetric/Not-symmetric buttons (deadline-paced)
    JUDGMENT_FEEDBACK: 'judgment_feedback',   // Correct/incorrect flash (symmetry-only practice)
    PRE_SQUARE_BLANK: 'pre_square_blank',     // Blank between judgment and square
    SQUARE_DISPLAY: 'square_display',         // Red square in the 4x4 grid (650 ms)
    POST_SQUARE_BLANK: 'post_square_blank',   // Blank before the next judgment / recall

    // Recall + feedback
    RECALL: 'recall',                         // Empty 4x4 grid, tap in order
    RECALL_TIMEOUT: 'recall_timeout',         // Recall timer expired
    SET_FEEDBACK: 'set_feedback',             // "You recalled X of Y squares" panel

    // End
    SAVING: 'saving',
    RESULTS: 'results',
};

// Practice runs in three sequential stages (canonical order)
export const SYMSPAN_PRACTICE_STAGES = {
    STORAGE: 'storage',     // squares only, immediate recall
    SYMMETRY: 'symmetry',   // judgments only, with feedback; calibrates the deadline
    COMBINED: 'combined',   // full dual-task at set size 2
};

// Client copies of canonical backend timing (functions/gameConstants.js)
export const SYMSPAN_TIMING = {
    FIXATION_MS: 500,
    SQUARE_DISPLAY_MS: 650,
    PRE_SQUARE_BLANK_MS: 250,
    POST_SQUARE_BLANK_MS: 250,
    SET_FEEDBACK_MS: 2500,
    RECALL_TIMEOUT_MS: 90000,
    JUDGMENT_FEEDBACK_MS: 1000,   // correct/incorrect flash during symmetry-only practice
};

export const SYMSPAN_DEFAULTS = {
    ...SYMSPAN_TIMING,
    MATRIX_DIM: 8,
    GRID_DIM: 4,
    MAX_PARTIAL_SCORE: 42,
    TOTAL_SETS: 12,
    PROCESSING_ACCURACY_THRESHOLD: 85,
    // Practice structure
    STORAGE_PRACTICE_SET_SIZES: [2, 2, 3, 3],
    SYMMETRY_PRACTICE_COUNT: 15,
    COMBINED_PRACTICE_SETS: 3,
    COMBINED_PRACTICE_SIZE: 2,
    // Judgment-deadline calibration (mean practice RT + 2.5 SD, clamped)
    SYMMETRY_CALIBRATION_SD_MULTIPLIER: 2.5,
    SYMMETRY_DEADLINE_FLOOR_MS: 1500,
    SYMMETRY_DEADLINE_CEILING_MS: 10000,
    // Local practice-pattern generation (client mirrors of backend values)
    PATTERN_FILL_MIN: 17,
    PATTERN_FILL_MAX: 19,
    FOIL_PERTURB_MIN: 3,
    FOIL_PERTURB_MAX: 4,
    MAX_FOIL_ATTEMPTS: 10,
};

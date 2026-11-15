/* src/constants/ospanConstants.js */

/**
 * Constants for the Operation Span Task (OSPAN) frontend components.
 */

export const OSPAN_PHASES = {
    // Initial
    INSTRUCTIONS: 'instructions',
    // Practice phases (client-side)
    PRACTICE_LETTER_ONLY: 'practice_letter_only',
    PRACTICE_MATH_ONLY: 'practice_math_only',
    PRACTICE_COMBINED: 'practice_combined',
    PRACTICE_FEEDBACK: 'practice_feedback',
    // Assessment setup
    READY_ASSESSMENT: 'ready_assessment',
    // Active task phases
    FIXATION: 'fixation',
    MATH_PROBLEM: 'math_problem',
    MATH_VERIFICATION: 'math_verification',
    LETTER_DISPLAY: 'letter_display',
    RECALL: 'recall',
    SET_FEEDBACK: 'set_feedback',
    RECALL_TIMEOUT: 'recall_timeout',
    // End phases
    SAVING: 'saving',
    RESULTS: 'results',
};

export const OSPAN_TIMING = {
    FIXATION_DURATION_MS: 500,
    LETTER_DISPLAY_MS: 800,
    SET_FEEDBACK_MS: 2500,
    RECALL_TIMEOUT_MS: 90000,
};

export const OSPAN_DEFAULTS = {
    ...OSPAN_TIMING,
    // Letter pool
    LETTER_POOL: ['F', 'H', 'J', 'K', 'L', 'N', 'P', 'Q', 'R', 'S', 'T', 'Y'],
    // Score
    MAX_SCORE: 75,
    PROCESSING_ACCURACY_THRESHOLD: 85,
    // Practice configuration
    PRACTICE_LETTER_SET_SIZES: [2, 2, 3, 3],
    PRACTICE_MATH_COUNT: 15,
    PRACTICE_COMBINED_SET_SIZE: 2,
    PRACTICE_COMBINED_SETS: 3,
    // Calibration
    MATH_CALIBRATION_SD_MULTIPLIER: 2.5,
    MATH_DEADLINE_FLOOR_MS: 1500,
    MATH_DEADLINE_CEILING_MS: 10000,
};

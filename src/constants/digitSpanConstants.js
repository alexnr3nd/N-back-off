/* src/constants/digitSpanConstants.js */

/**
 * Constants for the Digit Span assessment frontend components
 * (Woods et al. 2011 adaptive digit span protocol).
 * Scoring and sequence generation live on the backend
 * (`functions/digitSpanUtils.js`); timing values here are client copies of
 * the canonical values in `functions/gameConstants.js` DIGIT_SPAN_DEFAULTS.
 */

export const DIGIT_SPAN_PHASES = {
    // Initial / setup
    INSTRUCTIONS: 'instructions',
    BLOCK_INTRO: 'block_intro',           // Forward/backward block explanation (precedes practice)
    PRACTICE_FEEDBACK: 'practice_feedback', // Detailed feedback after a practice trial
    READY_BLOCK: 'ready_block',           // After practice, before the block's scored trials

    // Active trial phases
    FIXATION: 'fixation',                 // Fixation cross before the digit stream
    DIGIT_SHOW: 'digit_show',             // A digit is on screen
    DIGIT_BLANK: 'digit_blank',           // Inter-digit blank
    RECALL_CUE: 'recall_cue',             // Go-signal between last digit and recall
    RECALL: 'recall',                     // Keypad input
    RECALL_TIMEOUT: 'recall_timeout',     // Recall timer expired
    TRIAL_FEEDBACK: 'trial_feedback',     // Brief check/X after a scored trial
    INTERRUPTED: 'interrupted',           // Tab was hidden mid-presentation; trial restarting

    // Between blocks / end
    BLOCK_TRANSITION: 'block_transition', // Forward block done, backward block next
    SAVING: 'saving',
    RESULTS: 'results',
};

export const DIGIT_SPAN_BLOCKS = {
    FORWARD: 'forward',
    BACKWARD: 'backward',
};

// Client copies of canonical backend timing (functions/gameConstants.js)
export const DIGIT_SPAN_TIMING = {
    FIXATION_DURATION_MS: 500,
    DIGIT_DISPLAY_MS: 800,
    DIGIT_BLANK_MS: 200,
    RECALL_CUE_MS: 500,
    TRIAL_FEEDBACK_MS: 1200,
    RECALL_TIMEOUT_MS: 90000,
    INTERRUPTED_NOTICE_MS: 1500,
};

export const DIGIT_SPAN_DEFAULTS = {
    ...DIGIT_SPAN_TIMING,
    TRIALS_PER_BLOCK: 14,
    DIGIT_POOL: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    // Staircase: 1 correct -> +1; MAX_CONSECUTIVE_ERRORS errors at a length -> -1
    MAX_CONSECUTIVE_ERRORS: 2,
    // Tab-hidden-during-presentation redo budget (per block). Canonical value
    // lives in functions/gameConstants.js (it sizes SEQUENCES_PER_LENGTH).
    MAX_TRIAL_REDOS_PER_BLOCK: 3,
    BLOCK_CONFIG: {
        FORWARD: { startLength: 3, cap: 9, floor: 3, practiceLengths: [2, 3] },
        BACKWARD: { startLength: 2, cap: 8, floor: 2, practiceLengths: [2, 2] },
    },
};

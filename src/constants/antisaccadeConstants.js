/* src/constants/antisaccadeConstants.js */
/**
 * Constants for the Antisaccade assessment frontend.
 * Timing/config values are a mirror of functions/gameConstants.js
 * ANTISACCADE_DEFAULTS — keep in sync.
 */

export const ANTISACCADE_PHASES = {
    INSTRUCTIONS: 'instructions',
    FIXATION: 'fixation',             // central "+" (jittered 2000–3000ms)
    TONE: 'tone',                     // alerting beep, fixation still on screen
    CUE: 'cue',                       // 300ms static asterisk * at cueSide (target appears opposite)
    TARGET: 'target',                 // Q/O letter (100ms scored, 300ms practice)
    MASK: 'mask',                     // backward mask over target location
    RESPONSE: 'response',             // awaiting Q/O response
    TRIAL_FEEDBACK: 'trial_feedback', // practice only
    READY: 'ready',                   // pre-block "Get Ready" screen
    BREAK: 'break',                   // self-paced rest at halfway
    INTERRUPTED: 'interrupted',       // tab hidden mid-presentation
    SAVING: 'saving',
    RESULTS: 'results',
};

export const ANTISACCADE_TIMING = {
    FIXATION_MIN_MS: 2000,
    FIXATION_MAX_MS: 3000,
    TONE_MS: 300,
    CUE_MS: 300,
    TARGET_MS: 100,
    PRACTICE_TARGET_MS: 300,          // slower target during practice (learnable)
    MASK_MS: 500,
    FEEDBACK_MS: 500,
    ITI_MS: 1000,
    RESPONSE_TIMEOUT_MS: 10000,       // untimed in protocol; generous safety cap
    // Measured-exposure validity window for the 100 ms target (~±2 frames @60Hz)
    TARGET_MIN_VALID_MS: 67,
    TARGET_MAX_VALID_MS: 167,
    // Client-only UX (no ANTISACCADE_DEFAULTS counterpart) — duration of the
    // "Trial Interrupted" notice. Matches VISUAL_ARRAYS_TIMING (shared UX).
    INTERRUPTED_NOTICE_MS: 1500,
};

export const ANTISACCADE_CONFIG = {
    LETTERS: ['Q', 'O'],              // 2-alternative; chance = 50%
    SIDES: ['left', 'right'],
    SCORED_TRIALS: 72,
    PRACTICE_TRIALS: 16,              // slower-paced, client-generated, never scored
    BREAK_AFTER_TRIAL: 36,            // self-paced rest break halfway
    MAX_TRIAL_REDOS: 8,               // per session
    // Lateral placement as fraction of viewport width (substitute for the
    // lab's 12.3° visual angle, which needs a controlled viewing distance)
    ECCENTRICITY_VW: 0.28,
    // Audio alerting beep
    BEEP_HZ: 880,
    BEEP_GAIN: 0.3,
    BEEP_ATTACK_MS: 12,
    BEEP_RELEASE_TC: 0.015,           // seconds; Web Audio setTargetAtTime time constant
    // Scoring
    AT_CHANCE_THRESHOLD: 0.50,        // proportion correct at/below this = invalid
    // Below this many valid (non-interrupted) trials the backend scores null
    // and rejects a scored submission — a partial exit under the floor must
    // be discarded instead of saved.
    MIN_VALID_TRIALS_FOR_SCORE: 36,
};

// localStorage key prefix for results pending save (offline/retry recovery).
export const PENDING_PREFIX = 'antisaccade_pending_results_';

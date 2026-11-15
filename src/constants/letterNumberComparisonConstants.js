/* src/constants/letterNumberComparisonConstants.js */
/**
 * Constants for the Letter & Number Comparison Speed assessment frontend.
 * Protocol values are client copies of the canonical values in
 * functions/gameConstants.js LETTER_NUMBER_COMPARISON_DEFAULTS — keep in sync.
 */

export const LNC_PHASES = {
    INSTRUCTIONS: 'instructions',   // pre-init / loading
    PRACTICE: 'practice',           // untimed items with feedback (per task)
    READY: 'ready',                 // post-practice "block N starts now"
    GO: 'go',                       // 500ms lead-in; clock starts at first item
    BLOCK: 'block',                 // 30s timed block
    INTERRUPTED: 'interrupted',     // block voided; redo offered (or abort)
    BREAK: 'break',                 // self-paced between same-task blocks
    SAVING: 'saving',
    RESULTS: 'results',
};

export const LNC_DEFAULTS = {
    TASKS: ['letter', 'number'],
    BLOCKS_PER_TASK: 2,
    TOTAL_BLOCKS: 4,
    BLOCK_MS: 30000,
    ITEMS_PER_BLOCK_POOL: 120,
    SET_SIZES: [3, 6, 9],
    SAME_PROPORTION: 0.5,
    PRACTICE_ITEMS_PER_TASK: 5,
    BLINK_MS: 100,
    GO_LEAD_MS: 500,
    PRACTICE_FEEDBACK_MS: 800,
    MIN_RESPONSES_FOR_SCORE: 8,
    LOW_ACCURACY_THRESHOLD: 75,
    MAX_BLOCK_REDOS: 1,
    RAF_STALL_VOID_MS: 2000,
    CONSONANTS: 'BCDFGHJKLMNPQRSTVWXZ',
    DIGITS: '0123456789',
    ACRONYM_BLOCKLIST: ['FBI', 'CIA', 'NFL', 'NBA', 'NHL', 'MLB', 'NBC', 'CNN',
        'BBC', 'KGB', 'DVD', 'TNT', 'LOL', 'WTF', 'BRB', 'FYI', 'SMH', 'TBH',
        'PHD', 'LCD', 'LSD', 'THC', 'CBD', 'GPS', 'PDF', 'XML', 'WWW', 'HTM'],
    REQUIRED_FAMILIARIZATION_COUNT: 1,
};

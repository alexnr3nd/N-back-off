/* src/constants/faceNameMemoryConstants.js */
/**
 * Frontend constants for the Face-Name Memory assessment. Timing is a client
 * copy; the backend (functions/faceNameMemoryUtils.js FACE_NAME_MEMORY_DEFAULTS
 * + faceNameManifest.json) is authoritative for structure and scoring.
 */

export const FACE_NAME_MEMORY_PHASES = {
    LOADING: 'loading',
    INSTRUCTIONS: 'instructions',
    STUDY: 'study',                   // face + name shown together
    IMMEDIATE_RECALL: 'immediate_recall',
    DELAY: 'delay',                   // filled distractor (arithmetic)
    DELAYED_RECALL: 'delayed_recall',
    SAVING: 'saving',
    RESULTS: 'results',
};

export const FACE_NAME_MEMORY_TIMING = {
    STUDY_MS: 6000,             // each face+name pair auto-advances after ~6s
    STUDY_MIN_VIEW_MS: 1500,    // earliest a tap-to-advance is allowed
    RECALL_TIMEOUT_MS: 20000,   // per-face recall window before it auto-skips
    DELAY_MS: 150000,           // ~2.5 min filled delay (rehearsal block)
    INTER_ITEM_MS: 400,         // brief blank between items; also defers the
                                // per-item guard reset so same-tick stale
                                // timer/tap calls can't double-advance
};

export const FACE_NAME_MEMORY_DEFAULTS = {
    ...FACE_NAME_MEMORY_TIMING,
    PAIRS_PER_FORM: 12,
    RECALL_OPTIONS: 6,          // 1 target + 5 same-gender studied foils
    STUDY_REPEATS: 2,           // scored sessions show each pair twice
};

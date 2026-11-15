/* src/constants/cstConstants.js */

/**
 * Constants specifically for the Counting Span Task (CST) frontend components.
 * Constants related to task generation (set sizes, item counts), scoring logic,
 * and eligibility rules (familiarization count, thresholds) have been moved
 * to the backend (`functions/gameConstants.js`).
 */

// Defines the different states or phases the task can be in,
// used by the UI logic (e.g., useCountingSpanLogic, CountingSpanTask).
export const TASK_PHASES = {
    // Initial/Setup Phases
    INSTRUCTIONS: 'instructions',
    READY_ASSESSMENT: 'ready_assessment', // After practice, before assessment starts

    // Active Task Phases (Assessment or Practice)
    SET_START: 'set_start',           // Brief phase while preparing next set (optional visual)
    FIXATION: 'fixation',             // Displaying fixation cross
    ODD_EVEN_JUDGMENT: 'odd_even_judgment', // Displaying stimulus + awaiting odd/even response
    PROCESSING_TRANSITION: 'processing_transition', // Blank screen between trials (ITI)
    RECALL: 'recall',                 // Displaying recall interface, awaiting input
    RECALL_TIMEOUT: 'recall_timeout',   // State reached if recall timer expires

    // End/Saving Phases
    SAVING: 'saving',                 // While submitting results to the backend
    RESULTS: 'results',               // Displaying the final results screen

    // Practice Specific Phases (If needed by Instructions/Practice logic)
    PRACTICE_PROCESSING: 'practice_processing', // Dedicated phase for processing-only practice step
    PRACTICE_RECALL: 'practice_recall',         // Dedicated phase for recall-only practice step
    PRACTICE_INTEGRATED: 'practice_integrated', // Dedicated phase for integrated practice step
};

// Timing constants used by the client-side timer hook (`useCountingSpanTimer.js`)
// to control the duration of different phases.
// Note: RECALL_TIMEOUT_MS might need dynamic adjustment based on max set size,
// which could potentially be fetched with the test structure. Hardcoding based
// on a known maximum (e.g., 7) is a simpler approach for now.
export const COUNTING_SPAN_TIMING = {
    FIXATION_DURATION_MS: 500,          // Duration of the fixation cross display
    STIMULUS_JUDGMENT_WINDOW_MS: 10000, // Maximum time allowed for counting AND judging odd/even
    ITI_DURATION_MS: 500,              // Duration of the blank screen between stimulus presentations
    RECALL_TIMEOUT_MS: 90000,       // Max time for recall (e.g., 5 seconds per item * max expected set size of 7)
};

// Test type identifiers, used when communicating with the backend
// or potentially filtering history on the client-side.
export const CST_TEST_TYPES = {
    COUNTING_SPAN: 'COUNTING_SPAN',
    OPERATION_SPAN: 'OPERATION_SPAN', // Example for future expansion
    READING_SPAN: 'READING_SPAN',     // Example for future expansion
    DIGIT_SPAN: 'DIGIT_SPAN',
    SYMMETRY_SPAN: 'SYMMETRY_SPAN',
    VISUAL_ARRAYS: 'VISUAL_ARRAYS',
    ANTISACCADE: 'ANTISACCADE',
    RELATION_MONITORING: 'RELATION_MONITORING',
    LETTER_NUMBER_COMPARISON: 'LETTER_NUMBER_COMPARISON',
    FACE_NAME_MEMORY: 'FACE_NAME_MEMORY',
};

// Combine necessary frontend defaults into one export for convenience.
// Primarily includes timing values needed by the client.
export const COUNTING_SPAN_DEFAULTS = {
    ...COUNTING_SPAN_TIMING,
    // Add any other purely *frontend* defaults here if needed.
    // MAX_SCORE_PCU and PROCESSING_ACCURACY_THRESHOLD are ideally fetched
    // from the backend or passed with results/structure for display purposes,
    // rather than duplicated here.
};
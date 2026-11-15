/* src/constants/countingSpanTrainerConstants.js */
/**
 * Constants + client staircase mirror for the Counting Span TRAINER (practice
 * mode). Reuses the assessment's phase / timing constants (the reused
 * StimulusDisplay + RecallInterface and the trainer's own phase timer switch on
 * these exact values) rather than redefining them. The set-size bounds + step
 * rule + set-correctness rule MIRROR functions/countingSpanTrainerUtils.js —
 * keep the two in sync.
 *
 * Difficulty == SET SIZE (cards per set), so the display is "Size N": this is
 * the pluggable level-formatter case. The card format (targets 4-9 among 2-5
 * green circles and 2-5 blue squares) and the 10 s judgment window stay fixed at
 * the assessment's values, so set size is the only adaptive lever — pacing is
 * the strongest load lever under TBRS (Barrouillet 2007/2011) and therefore the
 * worst adaptive lever, the same call the Operation Span Trainer made.
 */
import { TASK_PHASES, COUNTING_SPAN_TIMING } from './cstConstants';

export { TASK_PHASES };

// Mirror of functions/countingSpanTrainerUtils.js CST_TRAINER_DEFAULTS.
export const CST_TRAINER = {
    SETS_PER_SESSION: 5,           // ~2-4 min session at mid sizes
    SPARE_SETS: 3,                 // interruption-redo pool
    MIN_VALID_FOR_SCORE: 3,
    CORRECT_TO_STEP_UP: 2,         // set-level 2-down-1-up
    MIN_SET_SIZE: 2,
    MAX_SET_SIZE: 10,
    START_SET_SIZE: 3,
    JUDGMENT_GATE_ACCURACY: 0.75,  // a set can't count correct below this odd/even accuracy
    RECALL_DIGIT_MIN: 0,           // the recall pad's accepted digit range
    RECALL_DIGIT_MAX: 9,
};
const T = CST_TRAINER;

// Presentation timing == the assessment's (fixed; never a lever). The per-set
// feedback screen is deliberately absent: it is user-paced (Next Set), so there
// is no beat to configure.
export const CST_TRAINER_TIMING = {
    FIXATION_MS: COUNTING_SPAN_TIMING.FIXATION_DURATION_MS,
    JUDGMENT_WINDOW_MS: COUNTING_SPAN_TIMING.STIMULUS_JUDGMENT_WINDOW_MS,
    ITI_MS: COUNTING_SPAN_TIMING.ITI_DURATION_MS,
    RECALL_TIMEOUT_MS: COUNTING_SPAN_TIMING.RECALL_TIMEOUT_MS,
};

// Trainer-only phases (the assessment flow has no per-set feedback or
// interruption-void state). Kept OUT of TASK_PHASES so nothing that switches on
// the shared enum ever sees them.
export const CST_TRAINER_PHASES = {
    SET_FEEDBACK: 'trainer_set_feedback',
    INTERRUPTED: 'trainer_interrupted',
};

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

/** The displayed "level" IS the set size. */
export const formatSetSize = (n) => `Size ${n}`;

/**
 * Client mirror of one set-level 2-down-1-up step (advance after 2 consecutive
 * correct sets, drop after 1 miss). The client runs this live for presentation;
 * the server re-derives it authoritatively on submit. MUST match
 * replayCountingSpanStaircase in functions/countingSpanTrainerUtils.js.
 */
export const nextSetSize = (size, consecutiveCorrect, correct, min, max) => {
    if (correct) {
        const cc = consecutiveCorrect + 1;
        if (cc >= T.CORRECT_TO_STEP_UP) return { size: clampInt(size + 1, min, max), consecutiveCorrect: 0 };
        return { size, consecutiveCorrect: cc };
    }
    return { size: clampInt(size - 1, min, max), consecutiveCorrect: 0 };
};

/**
 * Position-strict partial-credit-unit count: +1 for every position whose
 * recalled value is a number equal to the presented count. Nulls (unfilled
 * slots) and strings never match. Mirrors cstUtils.calculatePCUScoreForSet.
 */
export const calculateCountPCU = (presentedCounts, recalledCounts) => {
    if (!Array.isArray(presentedCounts) || !Array.isArray(recalledCounts)) return 0;
    let score = 0;
    for (let i = 0; i < presentedCounts.length; i++) {
        const recalled = recalledCounts[i];
        if (typeof recalled === 'number' && recalled === presentedCounts[i]) score++;
    }
    return score;
};

/**
 * A judgment only counts toward the gate when it was answered correctly AND
 * inside the 10 s window — a card that runs past its limit counts as wrong.
 * Twin of countJudgmentsCorrect in functions/countingSpanTrainerUtils.js.
 */
export const countJudgmentsCorrect = (judgments) =>
    (Array.isArray(judgments) ? judgments : []).filter((j) => j && j.correct === true && !j.timedOut).length;

/**
 * Verbatim correctness for live feedback + the client staircase: perfect serial
 * recall AND >= JUDGMENT_GATE_ACCURACY of the set's odd/even answers correct
 * (timeouts count as incorrect) AND recall not timed out. Counting each card is
 * what makes this a working memory task, so recall can't be bought by skipping
 * the counting. The server re-scores authoritatively with its own
 * isCountingSpanTrialCorrect.
 */
export const isSetCorrect = (presentedCounts, recalledCounts, judgments, recallTimedOut) => {
    if (recallTimedOut) return false;
    if (!Array.isArray(presentedCounts) || !Array.isArray(recalledCounts)) return false;
    if (presentedCounts.length === 0) return false;
    if (recalledCounts.length !== presentedCounts.length) return false;
    if (calculateCountPCU(presentedCounts, recalledCounts) !== presentedCounts.length) return false;
    return (countJudgmentsCorrect(judgments) / presentedCounts.length) >= T.JUDGMENT_GATE_ACCURACY;
};

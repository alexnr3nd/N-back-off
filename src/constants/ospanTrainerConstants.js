/* src/constants/ospanTrainerConstants.js */
/**
 * Constants + client staircase mirror for the Operation Span TRAINER (practice
 * mode). Reuses the assessment's phase / timing constants (the shared
 * MathProblemDisplay / LetterDisplay / LetterRecallGrid / useOperationSpanTimer
 * switch on these exact values) rather than redefining them. The set-size bounds
 * + step rule MIRROR functions/ospanTrainerUtils.js — keep the two in sync.
 *
 * Difficulty == SET SIZE (letters per set), so the display is "Size N": this is
 * the pluggable level-formatter case. The math deadline stays at the user's
 * calibrated value (server-resolved) and presentation timing is fixed at the
 * assessment's, so set size is the only adaptive lever.
 */
import { OSPAN_PHASES } from './ospanConstants';

export { OSPAN_PHASES };

// Mirror of functions/ospanTrainerUtils.js OSPAN_TRAINER_DEFAULTS.
export const OSPAN_TRAINER = {
    SETS_PER_SESSION: 8,           // ~6-8 min session at mid sizes
    SPARE_SETS: 3,                 // interruption-redo pool
    MIN_VALID_FOR_SCORE: 4,
    CORRECT_TO_STEP_UP: 2,         // set-level 2-down-1-up
    MIN_SET_SIZE: 2,
    MAX_SET_SIZE: 10,
    START_SET_SIZE: 3,
    MATH_GATE_ACCURACY: 0.75,      // a set can't count correct below this math accuracy
    DEFAULT_MATH_DEADLINE_MS: 10000, // fallback when no assessment calibration exists
};
const T = OSPAN_TRAINER;

// Trainer-only phase (the assessment flow has no interruption-void state).
// Kept OUT of OSPAN_PHASES so useOperationSpanTimer never receives it.
export const OSPAN_TRAINER_PHASES = {
    INTERRUPTED: 'trainer_interrupted',
};

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

/** The displayed "level" IS the set size. */
export const formatSetSize = (n) => `Size ${n}`;

/**
 * Client mirror of one set-level 2-down-1-up step (advance after 2 consecutive
 * correct sets, drop after 1 miss). The client runs this live for presentation;
 * the server re-derives it authoritatively on submit. MUST match
 * replayOspanStaircase in functions/ospanTrainerUtils.js.
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
 * Verbatim correctness for live feedback + the client staircase: perfect serial
 * recall AND >= MATH_GATE_ACCURACY of the set's equations correct (timeouts
 * count as incorrect) AND recall not timed out. The server re-scores
 * authoritatively with its own isOspanTrialCorrect.
 */
export const isSetCorrect = (targetLetters, recalledLetters, mathTrials, recallTimedOut) => {
    if (recallTimedOut) return false;
    if (!Array.isArray(targetLetters) || !Array.isArray(recalledLetters)) return false;
    if (recalledLetters.length !== targetLetters.length) return false;
    if (!targetLetters.every((letter, i) => recalledLetters[i] === letter)) return false;
    const trials = Array.isArray(mathTrials) ? mathTrials : [];
    const mathCorrect = trials.filter((t) => t && t.wasCorrect === true).length;
    return targetLetters.length > 0 && (mathCorrect / targetLetters.length) >= T.MATH_GATE_ACCURACY;
};

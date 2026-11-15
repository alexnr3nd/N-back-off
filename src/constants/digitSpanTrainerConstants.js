/* src/constants/digitSpanTrainerConstants.js */
/**
 * Constants + client staircase mirror for the Digit Span TRAINER (practice mode).
 * Reuses the assessment's phase / block / timing constants (the shared
 * DigitDisplay + DigitRecallPad + useDigitSpanTimer switch on these exact values)
 * rather than redefining them. The span bounds + 2-down-1-up step MIRROR
 * functions/digitSpanTrainerUtils.js — keep the two in sync.
 *
 * Difficulty == SPAN LENGTH, so the display is "Span N" (not "Level N"): this is
 * the pluggable level-formatter case. Presentation timing is fixed at the
 * assessment's 1 digit/sec, so span is the only adaptive lever.
 */
import { DIGIT_SPAN_PHASES, DIGIT_SPAN_BLOCKS, DIGIT_SPAN_TIMING } from './digitSpanConstants';

export { DIGIT_SPAN_PHASES, DIGIT_SPAN_BLOCKS, DIGIT_SPAN_TIMING };

// Retained for reference only — the Assessment<->Trainer toggle is no longer
// owner-gated (visible to all, Pro-gated inside the panel). See DigitSpanSummaryPage.
export const TRAINER_OWNER_EMAIL = 'allen@dualnback.com';

// Mirror of functions/digitSpanTrainerUtils.js DIGIT_SPAN_TRAINER_DEFAULTS.
export const DIGIT_SPAN_TRAINER = {
    LISTS_PER_SESSION: 14,         // ~4-5 min session
    SPARE_LISTS: 4,                // interruption-redo pool
    MIN_VALID_FOR_SCORE: 6,
    CORRECT_TO_STEP_UP: 2,         // list-level 2-down-1-up
    FORWARD: { MIN_SPAN: 3, MAX_SPAN: 9, START_SPAN: 4 },
    BACKWARD: { MIN_SPAN: 2, MAX_SPAN: 8, START_SPAN: 3 },
};
const D = DIGIT_SPAN_TRAINER;

export const boundsFor = (direction) => (direction === DIGIT_SPAN_BLOCKS.BACKWARD ? D.BACKWARD : D.FORWARD);

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

/** The displayed "level" IS the span. */
export const computeSpanLevel = (span) => Math.round(Number.isFinite(span) ? span : 0);
export const formatSpan = (n) => `Span ${n}`;

/**
 * Client mirror of one list-level 2-down-1-up span step (advance after 2
 * consecutive correct lists, drop after 1 error). The client runs this live for
 * presentation; the server re-derives it authoritatively on submit. MUST match
 * replayDigitSpanStaircase in functions/digitSpanTrainerUtils.js.
 */
export const nextSpan = (span, consecutiveCorrect, correct, min, max) => {
    if (correct) {
        const cc = consecutiveCorrect + 1;
        if (cc >= D.CORRECT_TO_STEP_UP) return { span: clampInt(span + 1, min, max), consecutiveCorrect: 0 };
        return { span, consecutiveCorrect: cc };
    }
    return { span: clampInt(span - 1, min, max), consecutiveCorrect: 0 };
};

/** Verbatim correctness for live feedback + the client staircase (forward exact,
 *  backward reversed). The server re-scores authoritatively with isTrialCorrect. */
export const isListCorrect = (targetDigits, responseDigits, direction, recallTimedOut) => {
    if (recallTimedOut) return false;
    if (!Array.isArray(targetDigits) || !Array.isArray(responseDigits)) return false;
    if (responseDigits.length !== targetDigits.length) return false;
    const expected = direction === DIGIT_SPAN_BLOCKS.BACKWARD ? [...targetDigits].slice().reverse() : targetDigits;
    return expected.every((d, i) => responseDigits[i] === d);
};

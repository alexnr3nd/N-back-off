/* src/constants/antisaccadeTrainerConstants.js */
/**
 * Constants + adaptive schedule for the Antisaccade TRAINER (practice mode).
 * The lever schedule and staircase MIRROR functions/antisaccadeTrainerUtils.js
 * — keep the two in sync. The trainer reuses the assessment's phase constants
 * (the shared AntisaccadeStimulus switches on these exact strings) rather than
 * redefining them, to avoid drift.
 */
import { ANTISACCADE_PHASES } from './antisaccadeConstants';

export { ANTISACCADE_PHASES };

// Phase-1 soft-launch: the Assessment<->Trainer toggle is owner-gated.
export const TRAINER_OWNER_EMAIL = 'allen@dualnback.com';

export const ANTISACCADE_TRAINER = {
    TRIALS_PER_ROUND: 12,          // balanced 3 per side x letter cell (~1 min)
    SPARE_TRIALS: 4,               // interruption-redo pool
    ITI_MS: 600,                   // trimmed inter-trial interval (keeps a round near a minute)
    FEEDBACK_MS: 450,              // brief per-trial correct/incorrect chip (always on)
    // Exposure frame ladder (60 Hz). targetMs always snapped to a whole frame.
    FRAME_MS: 1000 / 60,
    FRAMES_EASY: 18,               // 300 ms (easiest)
    FRAMES_HARD: 6,                // 100 ms (hardest = assessment speed)
    // Trial-level 3-down-1-up staircase (Levitt 1971 -> ~79.4% accuracy).
    DIFFICULTY_STEP: 0.04,         // 1 step = 1 Level
    START_DIFFICULTY: 0.20,        // ~Level 6
    CORRECT_TO_STEP_UP: 3,
};
const A = ANTISACCADE_TRAINER;

// Ladder ceiling: top level a player can reach (trimmed to where all levers floor,
// so higher levels would feel identical). MAX_DIFFICULTY is the matching staircase cap.
export const MAX_LEVEL = 22;
export const MAX_DIFFICULTY = Math.round((MAX_LEVEL - 1) * A.DIFFICULTY_STEP * 100) / 100; // 0.84

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const band = (d, start, end) => clamp((d - start) / (end - start), 0, 1);
const round2 = (v) => Math.round(v * 100) / 100;

export const framesToTargetMs = (frames) => Math.round(frames * A.FRAME_MS);

/**
 * Maps difficulty [0,1] to the 6-lever vector via a staggered schedule.
 * MUST match difficultyToLevers in functions/antisaccadeTrainerUtils.js.
 */
export const difficultyToLevers = (difficulty) => {
    const d = clamp(typeof difficulty === 'number' && Number.isFinite(difficulty) ? difficulty : A.START_DIFFICULTY, 0, 1);
    const frames = Math.round(lerp(A.FRAMES_EASY, A.FRAMES_HARD, band(d, 0.35, 0.85)));
    // Font size + cue salience fixed at assessment defaults (not levers). KEEP IN
    // SYNC with functions/antisaccadeTrainerUtils.js. Four levers:
    return {
        // perceptual
        eccentricityVw: round2(lerp(0.16, 0.34, band(d, 0.0, 0.6))),  // widest at Level 16, held to 26
        targetMs: framesToTargetMs(frames),
        // inhibition / attention control
        cueMs: Math.round(lerp(450, 150, band(d, 0.1, 0.6))),
        fixationThroughTarget: d >= 0.7,
    };
};

/** Integer "Level N" for display (1-indexed within a tier; 2D-ready). */
export const computeTrainerLevel = (tier, difficulty) =>
    (tier || 0) * MAX_LEVEL + Math.round(clamp(difficulty, 0, MAX_DIFFICULTY) / A.DIFFICULTY_STEP) + 1;

/**
 * One trial-level 3-down-1-up move. Returns the NEXT {difficulty, consecutiveCorrect}.
 * MUST match the server's replay step. The client runs this live during a round
 * for presentation; the server re-derives it authoritatively on submit.
 */
export const nextDifficulty = (difficulty, consecutiveCorrect, correct) => {
    if (correct) {
        const cc = consecutiveCorrect + 1;
        if (cc >= A.CORRECT_TO_STEP_UP) {
            return { difficulty: clamp(difficulty + A.DIFFICULTY_STEP, 0, MAX_DIFFICULTY), consecutiveCorrect: 0 };
        }
        return { difficulty, consecutiveCorrect: cc };
    }
    return { difficulty: clamp(difficulty - A.DIFFICULTY_STEP, 0, MAX_DIFFICULTY), consecutiveCorrect: 0 };
};

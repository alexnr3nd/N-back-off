/* src/constants/faceNameMemoryTrainerConstants.js */
/**
 * Frontend constants for the Face-Name Memory TRAINER. Mirrors the backend engine
 * (functions/faceNameMemoryTrainerUtils.js FACE_NAME_TRAINER_DEFAULTS) for bounds + the
 * cross-session set-size staircase; the backend stays authoritative for structure and
 * scoring. Reuses the assessment's study/recall timing so the play feel matches.
 *
 * Phase-1 soft launch: the Assessment<->Trainer toggle is owner-gated — only
 * TRAINER_OWNER_EMAIL sees the toggle / can reach Trainer mode (the assessment is live
 * for everyone). The panel is also Pro-gated INSIDE (chassis locked card + backend Pro
 * gate on every callable). Mirrors the antisaccade soft-launch pattern.
 */
import { FACE_NAME_MEMORY_TIMING } from './faceNameMemoryConstants';

// Phase-1 soft-launch: the Assessment<->Trainer toggle is owner-gated.
export const TRAINER_OWNER_EMAIL = 'allen@dualnback.com';

export const FACE_NAME_TRAINER_PHASES = {
    INSTRUCTIONS: 'instructions',
    RECALL: 'recall',     // delayed recall of LAST session's batch (skipped on the first session)
    STUDY: 'study',       // study a NEW batch for next session
    SAVING: 'saving',
    RESULTS: 'results',
};

// Mirror of functions/faceNameMemoryTrainerUtils.js FACE_NAME_TRAINER_DEFAULTS.
export const FACE_NAME_TRAINER = {
    MIN_SET: 4,
    START_SET: 4,
    MAX_SET: 12,
    RECALL_OPTIONS_K: 6,
    ADVANCE_RATIO: 0.70,
    DROP_RATIO: 0.40,
    STUDY_PASSES: 1,            // one study pass per session (keeps it ~3-4 min)
    ...FACE_NAME_MEMORY_TIMING, // STUDY_MS, RECALL_TIMEOUT_MS, INTER_ITEM_MS, ...
};

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

/** "N faces" — the displayed level IS the set size. */
export const formatSetSize = (n) => `${n} ${n === 1 ? 'face' : 'faces'}`;

/**
 * Client mirror of the cross-session set-size step (the server is authoritative on
 * submit). Advance +1 if delayedCorrect >= round(0.70*recalledN); drop -1 if
 * <= floor(0.40*recalledN); else hold. Provided for parity/clarity — the set size does
 * NOT change within a session (it is a cross-session staircase).
 */
export const nextSetSize = (
    startN, delayedCorrect, recalledN,
    min = FACE_NAME_TRAINER.MIN_SET, max = FACE_NAME_TRAINER.MAX_SET,
) => {
    if (!recalledN) return clampInt(startN, min, max);
    const advanceAt = Math.round(FACE_NAME_TRAINER.ADVANCE_RATIO * recalledN);
    const dropAt = Math.floor(FACE_NAME_TRAINER.DROP_RATIO * recalledN);
    let step = 0;
    if (delayedCorrect >= advanceAt) step = 1;
    else if (delayedCorrect <= dropAt) step = -1;
    return clampInt(startN + step, min, max);
};

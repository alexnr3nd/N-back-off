/* File: src/contexts/settings/instantFeedbackMigration.js */
/**
 * Pure, dependency-free migration for the instant-feedback settings schema.
 *
 * INVARIANT: the per-type keys `instantFeedbackErrors` and `instantFeedbackMisses`
 * are the source of truth. `instantFeedbackNegative` is a WRITE-ONLY backward-compat
 * shadow — the new client writes `negative = errors || misses` so installed pre-split
 * Android APKs can still READ whether to play negative feedback. It must NEVER be read
 * back into the per-type keys once those exist. A bidirectional "reconciliation" pass
 * used to do exactly that and clobbered users' deliberate per-type choices every time an
 * old APK re-asserted the shadow (the daily "Errors/Misses turns itself back on" bug).
 *
 * IMPORTANT: run this on the RAW stored doc (localStorage / Firestore), BEFORE merging
 * onto getDefaultSettings(). Once merged onto full defaults, every key is present, the
 * `!hasOwnProperty(...)` guards below are always false, and the passes never fire.
 *
 * Historical schema:
 *   1. Original: single `instantFeedback` boolean.
 *   2. Split A: `instantFeedback` -> `instantFeedbackPositive` + `instantFeedbackNegative`.
 *   3. Split B (April 2026): `instantFeedbackNegative` -> `instantFeedbackErrors` + `instantFeedbackMisses`.
 *
 * Each pass only fires when its old key is present and its new keys are absent, so the
 * function is idempotent across reloads.
 *
 * CommonJS so this single source of truth is importable by both webpack (the app) and a
 * plain `node` regression test — no logic duplication / drift.
 */
const migrateInstantFeedbackSettings = (loadedSettings) => {
    let result = loadedSettings || {};

    // Pass 1: legacy `instantFeedback` -> `instantFeedbackPositive` + `instantFeedbackNegative`.
    if (result.hasOwnProperty('instantFeedback') &&
        !result.hasOwnProperty('instantFeedbackPositive') &&
        !result.hasOwnProperty('instantFeedbackNegative')) {
        const oldValue = result.instantFeedback === true;
        result = {
            ...result,
            instantFeedbackPositive: oldValue,
            instantFeedbackNegative: oldValue,
        };
    }

    // Pass 2: `instantFeedbackNegative` -> `instantFeedbackErrors` + `instantFeedbackMisses`.
    // This upgrades genuinely-old docs that only carry the shadow. Once the per-type keys
    // exist, this pass is skipped and the shadow is ignored on read (per the invariant above).
    if (result.hasOwnProperty('instantFeedbackNegative') &&
        !result.hasOwnProperty('instantFeedbackErrors') &&
        !result.hasOwnProperty('instantFeedbackMisses')) {
        const oldValue = result.instantFeedbackNegative === true;
        result = {
            ...result,
            instantFeedbackErrors: oldValue,
            instantFeedbackMisses: oldValue,
        };
    }

    return result;
};

module.exports = { migrateInstantFeedbackSettings };

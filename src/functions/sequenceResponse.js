/* functions/sequenceResponse.js */

// ============================================================================
// SHARED BETWEEN THE CLOUD FUNCTION AND THE WEB CLIENT BUNDLE
// ============================================================================
// This module is the single source of truth for the `generateSequence` callable's
// SINGLE-SEQUENCE response payload. It is ALSO imported directly by the web client
// (`src/utils/localSequenceGenerator.js` -> `../../functions/sequenceResponse`) so
// that the offline fallback produces a byte-for-byte identical contract instead of a
// hand-mirrored copy that can drift.
//
// THEREFORE: this file — and its transitive deps `./gameSequenceGenerator`,
// `./gameHelpers` and `./gameConstants` — must stay PURE CommonJS with NO node
// built-ins, NO firebase imports, NO logging via firebase-functions/logger and NO
// I/O. Anything added here gets bundled into the browser by webpack.
//
// Deliberately NOT here (the callable keeps them): input validation of
// nBack/difficulty/playgroundParams, HttpsError throwing, and logging.
// ============================================================================

const { generateSequence } = require('./gameSequenceGenerator');
const { calculateSessionParameters } = require('./gameHelpers');

/**
 * Game modes the sequence generator understands.
 *
 * 'singleColorRecall' is DELIBERATELY absent: a recall session requests its
 * sequence AS 'singleColor' by design. The two modes share an identical stimulus
 * contract (one color per trial from COLOR_STIMULI) and differ only in how the
 * player RESPONDS, so the generator has nothing to do differently — and asking
 * as 'singleColor' keeps recall sessions compatible with the prefetched
 * singleColor sequence cache.
 */
const VALID_GAME_MODES = ['dual', 'triple', 'quad', 'singleVisual', 'singleAudio', 'singleColor', 'singleShape'];

/**
 * Coerce an arbitrary gameMode value to a supported mode.
 * Anything unknown (including the legacy 'dynamic' sentinel that old bundled
 * Android clients still send) falls back to 'dual'.
 *
 * NOTE: callers that need to warn/telemetry on a coercion should compare the
 * input against the result themselves — this function is silent by design
 * (it runs in the browser too).
 *
 * @param {*} gameMode - Requested game mode.
 * @returns {string} A mode from VALID_GAME_MODES.
 */
const coerceGameMode = (gameMode) => (VALID_GAME_MODES.includes(gameMode) ? gameMode : 'dual');

/**
 * Apply Continuous-Mode prior context to a generated sequence.
 *
 * `priorStimuli` is the last N stimuli of the just-completed block. They are
 * prepended to the new sequence so n-back lookback works across the block
 * boundary (the user's mental n-back continuity matches algorithmic scoring),
 * and every match index shifts right by the number of prepended stimuli.
 *
 * Invalid / empty prior context is a no-op returning priorLen 0.
 *
 * @param {object} gen - Generated sequence data ({ sequence, visualMatches, audioMatches, colorMatches?, shapeMatches? }).
 * @param {Array<object>|null} priorStimuli - Prior stimuli to prepend (max 20).
 * @returns {object} `gen` plus adjusted sequence/match arrays and `priorLen`.
 */
const applyPriorContext = (gen, priorStimuli) => {
    const validatedPriorStimuli = (Array.isArray(priorStimuli) && priorStimuli.length > 0
        && priorStimuli.length <= 20 // sanity cap
        && priorStimuli.every((s) => s && typeof s === 'object'))
        ? priorStimuli
        : null;

    if (!validatedPriorStimuli) return { ...gen, priorLen: 0 };

    const priorLen = validatedPriorStimuli.length;
    const shifted = (arr) => (arr || []).map((i) => i + priorLen);
    return {
        ...gen,
        sequence: [...validatedPriorStimuli, ...gen.sequence],
        visualMatches: shifted(gen.visualMatches),
        audioMatches: shifted(gen.audioMatches),
        colorMatches: shifted(gen.colorMatches),
        shapeMatches: shifted(gen.shapeMatches),
        priorLen,
    };
};

/**
 * Build the full single-sequence response payload.
 *
 * Reproduces exactly what the `generateSequence` callable's
 * "--- 2. Generate Sequence ---" through "--- 4. Construct Response ---" block did
 * inline: generate, calculate session parameters, apply prior context, assemble.
 *
 * @param {object} params
 * @param {number} params.nBack - N-back level (already validated by the caller).
 * @param {number} params.difficultySeed - Difficulty seed 0.0-1.0 (already clamped by the caller).
 * @param {string} [params.gameMode] - Requested game mode (coerced here).
 * @param {string} [params.language='en'] - Audio language code for the letter set.
 * @param {number|null} [params.overrideTrials=null] - Playground trial-count override.
 * @param {number|null} [params.overrideISI=null] - Playground ISI override (seconds).
 * @param {number|null} [params.overrideStimDurationMs=null] - Playground stimulus duration override (ms).
 * @param {boolean} [params.isPlayground=false] - Flag echoed into `parameters`.
 * @param {Array<object>|null} [params.priorStimuli=null] - Continuous-Mode prior context.
 * @returns {object} { sequence, visualMatches, audioMatches, colorMatches, shapeMatches,
 *                     priorLen, gameMode, parameters }
 */
const buildSequenceResponse = ({
    nBack,
    difficultySeed,
    gameMode,
    language = 'en',
    overrideTrials = null,
    overrideISI = null,
    overrideStimDurationMs = null,
    isPlayground = false,
    priorStimuli = null,
}) => {
    const effectiveGameMode = coerceGameMode(gameMode);

    // --- Generate Sequence ---
    const {
        sequence,
        visualMatches,
        audioMatches,
        colorMatches,
        shapeMatches,
        trials, // Actual number of trials generated
        gameMode: generatedGameMode,
    } = generateSequence(
        nBack,
        difficultySeed,
        effectiveGameMode,
        overrideTrials,
        language,
    );

    // --- Calculate Session Parameters (playground overrides pass straight through) ---
    const sessionParams = calculateSessionParameters(
        nBack,
        difficultySeed,
        overrideISI,
        overrideStimDurationMs,
        trials, // the *actual* trials generated
    );

    // --- Construct Response (apply prior context if provided) ---
    const withPrior = applyPriorContext(
        { sequence, visualMatches, audioMatches, colorMatches, shapeMatches },
        priorStimuli,
    );

    return {
        sequence: withPrior.sequence,
        visualMatches: withPrior.visualMatches,
        audioMatches: withPrior.audioMatches,
        colorMatches: withPrior.colorMatches || [],
        shapeMatches: withPrior.shapeMatches || [],
        priorLen: withPrior.priorLen,
        gameMode: generatedGameMode,
        parameters: {
            ...sessionParams,
            totalTrials: trials, // count of NEW trials only
            isPlayground,
            gameMode: generatedGameMode,
        },
    };
};

// --- Export (CommonJS — consumed by both Cloud Functions and the webpack bundle) ---
module.exports = {
    coerceGameMode,
    applyPriorContext,
    buildSequenceResponse,
    VALID_GAME_MODES,
};

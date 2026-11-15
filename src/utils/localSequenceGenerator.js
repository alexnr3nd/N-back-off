/* src/utils/localSequenceGenerator.js */
/**
 * Offline sequence generation for the client.
 *
 * WHY THIS CROSSES THE src/ -> functions/ BOUNDARY
 * -----------------------------------------------
 * `functions/sequenceResponse.js` is the single source of truth for the
 * `generateSequence` callable's single-sequence payload. Importing it directly means a
 * locally generated sequence is byte-for-byte the same contract as a server one, and an
 * algorithm change lands on both sides at once. The alternative — mirroring the
 * ~680-line generator plus its helpers/constants into `src/` — would drift silently,
 * and the drift would only ever show up in sequences played offline.
 *
 * That module and its transitive deps (`gameSequenceGenerator`, `gameHelpers`,
 * `gameConstants`) are pure CommonJS with no node/firebase imports, so webpack and
 * babel-jest both bundle them. Keep them that way — see the banner in
 * `functions/sequenceResponse.js`.
 *
 * Scope: single sessions only. Continuous-chain blocks stay server-only (they need
 * `bufferTrials` / `priorStimuli` primers, which this entry point does not expose).
 */
import { buildSequenceResponse } from '../functions/sequenceResponse';

/**
 * Convert a CLIENT difficulty (0 - 0.99, the number stored on the profile and shown
 * as the `.DD` of a level) to the BACKEND difficulty seed (0.0 - 1.0).
 *
 * This is the conversion the server payload has always used; it lives here so the
 * local path, `gameSetup.js` and `sequencePrefetcher.js` cannot disagree about it
 * (they each carried their own inline copy of the expression before).
 *
 * @param {number} difficulty - Client difficulty, 0 - 0.99.
 * @returns {number} Seed in 0.0 - 1.0.
 */
export const toDifficultySeed = (difficulty) => (difficulty >= 0.99 ? 1.0 : (difficulty / 0.99));

/**
 * Generate a game sequence on-device, with the same contract the callable returns.
 *
 * @param {object} params
 * @param {number} params.nBack - N-back level.
 * @param {number} params.difficulty - CLIENT difficulty (0 - 0.99), converted here.
 * @param {string} params.gameMode - 'dual' | 'triple' | 'quad' | 'single*'; unknown
 *   values are coerced to 'dual' by the shared builder.
 * @param {string} [params.language='en'] - Sequence language code from `getSequenceLanguage()`.
 * @param {number|null} [params.overrideTrials=null] - Trial-count override (playground).
 * @returns {object} { sequence, visualMatches, audioMatches, colorMatches, shapeMatches,
 *                     priorLen, gameMode, parameters }
 */
export const generateLocalSequence = ({
    nBack,
    difficulty,
    gameMode,
    language = 'en',
    overrideTrials = null,
}) => buildSequenceResponse({
    nBack,
    difficultySeed: toDifficultySeed(difficulty),
    gameMode,
    language,
    overrideTrials,
    isPlayground: false,
});

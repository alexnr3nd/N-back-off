/* src/utils/sequencePrefetcher.js */
/* Background prefetching of game sequences for offline play */

import { generateSequenceHttp } from '../contexts/game/gameCloudFunctions';
import { addSequenceToCache, getCacheCount } from './sequenceCache';
import { withDeadline } from './promiseDeadline';
import { isAppCheckStuck } from './appCheckHealth';
import { getSequenceLanguage } from './sequenceLanguage';
import { toDifficultySeed } from './localSequenceGenerator';

// Background work must never hang silently: a wedged App Check SDK used to leave every
// prefetch pending forever (and the use-once cache drained to empty with no signal).
const PREFETCH_DEADLINE_MS = 45000;

/**
 * Prefetch a sequence for the given parameters and store in cache.
 * Fire-and-forget — silently fails on network errors.
 *
 * @param {Object} params
 * @param {string} params.gameMode - 'dual', 'triple', 'quad'
 * @param {number} params.nBack - N-back level
 * @param {number} params.difficulty - Difficulty (0.0-0.99)
 * @param {string} params.language - Sequence language code from `getSequenceLanguage()`
 *   (a LANGUAGE_AUDIO_LETTERS key, e.g. 'en'). It is part of the cache key, so it must
 *   match what the game start derives — never hand-derive it here.
 * @param {string} [params.profileId] - User profile ID
 */
export const prefetchSequence = async ({ gameMode, nBack, difficulty, language, profileId }) => {
    try {
        // Skip if already cached for these params
        const count = await getCacheCount(gameMode, nBack, difficulty, language);
        if (count >= 2) return; // Already have enough cached

        // A stuck App Check SDK cannot mint a token; the recovery reload will refill
        // the cache on the next dashboard mount. Don't burn a 20s probe in the background.
        if (isAppCheckStuck()) {
            console.debug('[sequencePrefetcher] Skipped: App Check SDK is stuck (awaiting recovery reload).');
            return;
        }

        // Convert difficulty to the backend seed format — shared helper, so a prefetched
        // sequence is generated with the exact same seed the live start would ask for.
        const difficultySeed = toDifficultySeed(difficulty);

        const payload = {
            nBack,
            difficulty: difficultySeed,
            isPlayground: false,
            profileId: profileId || null,
            gameMode: gameMode || 'dual',
            overrideTrials: null,
            language: language || 'en',
        };

        const response = await withDeadline(generateSequenceHttp(payload), PREFETCH_DEADLINE_MS, {
            label: 'Sequence prefetch',
            code: 'prefetch-deadline',
        });

        if (response?.sequence && response?.parameters) {
            await addSequenceToCache(gameMode, nBack, difficulty, language, response);
            console.info(`[sequencePrefetcher] Cached sequence for ${gameMode} ${nBack}-back @ ${difficulty} (${language})`);
        }
    } catch (error) {
        // Silent failure — this is a background optimization
        console.debug('[sequencePrefetcher] Prefetch failed (expected if offline):', error.message);
    }
};

/**
 * Convenience method: prefetch for the user's current game state.
 * Extracts parameters from activeProfile and settings.
 *
 * @param {Object} modeProgression - Current mode progression data (may carry
 *   `recallProgression`, the singleColorRecall track — see GameContext)
 * @param {Object} settings - User settings (for voice/language + response mode)
 * @param {string} activeGameMode - Current game mode
 * @param {string} [userId] - User ID for profile
 */
export const prefetchForCurrentState = async (modeProgression, settings, activeGameMode, userId) => {
    if (!modeProgression) return;

    // Sequence language: must be the SAME string the game start builds its cache key
    // from, or these entries are never read. One derivation for every site.
    const language = getSequenceLanguage(settings);

    // Recall Mode: gameSetup will start the session at the 'singleColorRecall' track's
    // level, so prefetch THAT level — otherwise every recall start misses the cache
    // whenever the two tracks have diverged, which breaks offline recall. gameMode
    // stays 'singleColor': identical stimulus contract, identical cache key.
    const isRecall = activeGameMode === 'singleColor' && settings?.responseModes?.singleColor === 'recall';
    const levelSource = isRecall ? (modeProgression.recallProgression || modeProgression) : modeProgression;

    await prefetchSequence({
        gameMode: activeGameMode || 'dual',
        nBack: levelSource.currentNBack ?? 2,
        difficulty: levelSource.currentDifficulty ?? 0.0,
        language,
        profileId: userId || null,
    });
};

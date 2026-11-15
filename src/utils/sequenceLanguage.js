/* src/utils/sequenceLanguage.js */
/**
 * The single source of truth for the sequence "language" code.
 *
 * This one string is used for TWO things that must agree exactly:
 *   1. The `language` field of the `generateSequence` payload — the backend
 *      (`functions/gameHelpers.js` `getStimuliSet`) uses it to pick the audio
 *      letter set out of `LANGUAGE_AUDIO_LETTERS`, falling back to English for
 *      any code it does not recognise.
 *   2. A component of the IndexedDB sequence-cache key
 *      (`src/utils/sequenceCache.js` `buildKey`).
 *
 * Because (2) is an exact string match, any site that derives the value
 * differently writes cache entries nobody ever reads. That is exactly what
 * happened before this helper existed: game start and the pre-game prefetch
 * derived `google-en` while the post-save prefetch derived `en`, so the entry
 * cached for the NEXT level was permanently invisible and offline play died
 * after one session (2026-09-16 incident).
 *
 * Every site that needs this value MUST call `getSequenceLanguage`:
 *   - `src/contexts/game/gameSetup.js`        (session start: payload + cache lookup + replenish)
 *   - `src/utils/sequencePrefetcher.js`       (`prefetchForCurrentState`, dashboard prefetch)
 *   - `src/contexts/game/gameEnd.js`          (post-save prefetch of the NEXT level,
 *                                              via the `sequenceLanguage` dependency)
 *   - `src/contexts/GameContext.js`           (continuous-chain start: `chain.language`,
 *                                              reused by every chain block fetch)
 *
 * Not in scope: which voice to PLAY. `audioManager` picks audio files by voice id;
 * that logic is independent of the letter-set key resolved here.
 */
import { LANGUAGE_AUDIO_LETTERS } from '../constants/gameConstants';

const DEFAULT_LANGUAGE = 'en';

/**
 * Resolve a voice id to a `LANGUAGE_AUDIO_LETTERS` key.
 *
 * Voice ids look like `google-<lang>-<region>-<voice>` (e.g.
 * `google-en-gb-wavenet-n`); ids without the `google-` prefix are parsed the
 * same way from their first two segments. Resolution order:
 *   `<lang>-<REGION>` → `<lang>` → `'en'`.
 * The region is upper-cased because the keys are BCP-47-ish (`pt-PT`, `cmn-TW`).
 *
 * The return value is always a real key of `LANGUAGE_AUDIO_LETTERS`.
 *
 * @param {string} voiceId - e.g. `settings.selectedVoiceId`.
 * @returns {string} A `LANGUAGE_AUDIO_LETTERS` key ('en' when nothing matches).
 */
export const resolveLanguageCode = (voiceId) => {
    if (typeof voiceId !== 'string' || !voiceId) return DEFAULT_LANGUAGE;

    const segments = voiceId.toLowerCase().split('-');
    // Drop the provider prefix so `google-en-gb-...` yields lang 'en', not 'google'.
    if (segments[0] === 'google') segments.shift();

    const lang = segments[0];
    const region = segments[1];
    if (!lang) return DEFAULT_LANGUAGE;

    const candidates = [];
    if (region) candidates.push(`${lang}-${region.toUpperCase()}`);
    candidates.push(lang);

    const match = candidates.find((code) => Boolean(LANGUAGE_AUDIO_LETTERS[code]));
    return match || DEFAULT_LANGUAGE;
};

/**
 * Derive the sequence language code from the user's settings.
 *
 * @param {object|null|undefined} settings - The app settings object (SettingsContext).
 * @returns {string} A `LANGUAGE_AUDIO_LETTERS` key ('en' when nothing matches).
 */
export const getSequenceLanguage = (settings) => resolveLanguageCode(settings?.selectedVoiceId);

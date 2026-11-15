/* src/utils/accuracy.js
 * Single source of truth for display accuracy across the app.
 *
 * Recomputes pooled Jaeggi accuracy from primary session fields (hits,
 * falseAlarms, targetCount, totalTrials, nBack). Works on any session doc
 * regardless of what trainingMode wrote it — Classic sessions store Jaeggi
 * accuracy, Adaptive (Phase 1) stores match-only, but we don't read the
 * stored value — we always recompute. This gives one consistent display
 * formula everywhere and handles mixed Classic + Adaptive history correctly.
 *
 * Jaeggi accuracy per modality = (hits + correct_rejections) / scorable
 *                              = 1 - (misses + false_alarms) / scorable
 *
 * Overall = pooled across active modality-trials. In our game every modality
 * has equal scorable counts, so pooled == arithmetic mean of per-modality.
 *
 * Mirror of functions/csvExport.js `computeJaeggiAccuracy` — keep in sync.
 */

import { GAME_MODES } from '../constants/gameConstants';

const activeModalitiesFor = (gameMode) => GAME_MODES[gameMode]?.modalities || ['visual', 'audio'];

/**
 * @param {object} session - session doc (may be partial; handles missing fields)
 * @param {object} [opts]
 * @param {string} [opts.gameMode] - override the session's gameMode
 * @returns {{ overall: number|null, visual: number|null, audio: number|null, color: number|null, shape: number|null }}
 */
export function getSessionAccuracy(session, opts = {}) {
    if (!session) {
        return { overall: null, visual: null, audio: null, color: null, shape: null };
    }
    const gameMode = opts.gameMode ?? session.gameMode;
    const activeMods = activeModalitiesFor(gameMode);

    const nBack = session.sessionNBack ?? session.nBack ?? 2;
    // Fallback: pre-Apr-24 Classic sessions don't persist totalTrials. Jaeggi
    // standard block is 20 + N trials; use that as an estimate so the formula
    // doesn't degrade to null for the small amount of legacy Classic data.
    const totalTrials = session.totalTrials ?? (20 + nBack);
    const possibleTargetTrials = Math.max(0, totalTrials - nBack);

    const jaeggiForModality = (m) => {
        const rawHits = session[`${m}Correct`] ?? session[`${m}Hits`];
        const rawTargets = session[`${m}TargetCount`];
        // If primary counts are missing (not stored), we cannot recompute — return null
        // rather than synthesize 0s that would falsely give 100% (errors=0 / scorable=20).
        if (rawHits == null && rawTargets == null) return null;
        const hits = rawHits ?? 0;
        const fas = session[`${m}FalseAlarms`] ?? 0;
        const targetCount = rawTargets ?? 0;
        const nonTargetCount = Math.max(0, possibleTargetTrials - targetCount);
        const scorable = targetCount + nonTargetCount;
        if (scorable <= 0) return null;
        const errors = Math.max(0, targetCount - hits) + fas;
        return ((scorable - errors) / scorable) * 100;
    };

    const per = {
        visual: activeMods.includes('visual') ? jaeggiForModality('visual') : null,
        audio:  activeMods.includes('audio')  ? jaeggiForModality('audio')  : null,
        color:  activeMods.includes('color')  ? jaeggiForModality('color')  : null,
        shape:  activeMods.includes('shape')  ? jaeggiForModality('shape')  : null,
    };

    // Pooled overall across active modality-trials (single denominator).
    // Skip modalities with missing primary counts — otherwise 0s synthesize a false 100%.
    let tHits = 0, tFAs = 0, tTargets = 0, tNonTargets = 0;
    let anyModalityHadData = false;
    activeMods.forEach((m) => {
        const rawHits = session[`${m}Correct`] ?? session[`${m}Hits`];
        const rawTargets = session[`${m}TargetCount`];
        if (rawHits == null && rawTargets == null) return;
        anyModalityHadData = true;
        const hits = rawHits ?? 0;
        const fas = session[`${m}FalseAlarms`] ?? 0;
        const targetCount = rawTargets ?? 0;
        const nonTargetCount = Math.max(0, possibleTargetTrials - targetCount);
        tHits += hits;
        tFAs += fas;
        tTargets += targetCount;
        tNonTargets += nonTargetCount;
    });
    const scorable = tTargets + tNonTargets;
    const overall = (anyModalityHadData && scorable > 0)
        ? ((scorable - (Math.max(0, tTargets - tHits) + tFAs)) / scorable) * 100
        : null;

    return { overall, ...per };
}

/**
 * Format a numeric accuracy value for display.
 * @param {number|null|undefined} value
 * @param {object} [opts]
 * @param {number} [opts.decimals=1]
 * @param {string} [opts.fallback='N/A']
 */
export const formatAccuracy = (value, { decimals = 1, fallback = 'N/A' } = {}) =>
    (typeof value === 'number' && Number.isFinite(value))
        ? `${value.toFixed(decimals)}%`
        : fallback;

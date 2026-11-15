/* src/utils/chainAggregate.js
 * Chain-aggregate stats for the Continuous ("chain") results screen.
 *
 * A chain is saved block-by-block; the client composes the results screen from the
 * FINAL per-block save response (GameContext.js endContinuousChainAndSave), so the
 * top-level per-modality counts / d′ are the LAST session's — not the chain's.
 * Feeding those final-block counts to getSessionAccuracy alongside the WHOLE-CHAIN
 * totalTrials manufactured phantom "correct rejections" and pinned accuracy near 100%
 * (the reported bug). This recomputes true chain-wide stats from the per-block data
 * already present in chainSummary.blocks.
 *
 * Mirror of the backend whole-chain aggregator (functions/game.js:1210-1271) and the
 * per-modality Jaeggi formula in src/utils/accuracy.js — keep in sync.
 *
 * Scorable convention (CONTINUOUS): a chain is one continuous sequence, so only the
 * first N trials of the WHOLE chain are unscorable. Sessions 2+ look back into the
 * previous session, so ALL their trials are scorable — and that is exactly how the
 * backend counted hits/targets/false-alarms for those blocks. Per block:
 *     scorable = (index === 0) ? trials - nBack : trials
 * Summed across the chain this is totalTrials - firstBlock.nBack.
 *
 * Jaeggi accuracy per modality = (scorable - (misses + falseAlarms)) / scorable.
 * Per-modality / overall d′ = trials-weighted average of per-block d′ (skip null/Classic).
 *
 * Median RT is intentionally NOT aggregated here: a true pooled median needs raw hit
 * latencies, which aren't carried per block (only each block's own precomputed median).
 * The chain "Channel" cards omit RT; the per-session rows still show each block's median.
 */

import { GAME_MODES } from '../constants/gameConstants';

const ALL_MODALITIES = ['visual', 'audio', 'color', 'shape'];

const finite = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * @param {Array<object>} blocks - chainSummary.blocks (per-block metrics; may include
 *   fallback/unsaved stubs that carry only nBack/trials/difficulty/duration).
 * @param {string} gameMode
 * @returns {{
 *   accuracy: { overall: number|null, visual: number|null, audio: number|null, color: number|null, shape: number|null },
 *   byModality: { [m: string]: { correct: number|null, targetCount: number|null, falseAlarms: number|null, dprime: number|null } | null },
 *   overallDprime: number|null
 * }}
 */
export function aggregateChainStats(blocks, gameMode) {
    const activeMods = GAME_MODES[gameMode]?.modalities || ['visual', 'audio'];
    const blockList = Array.isArray(blocks) ? blocks : [];

    const acc = {};
    for (const m of ALL_MODALITIES) {
        acc[m] = { scorable: 0, errors: 0, correct: 0, targets: 0, fa: 0, dpSum: 0, dpDenom: 0, hasData: false, hasDp: false };
    }
    let overallDpSum = 0;
    let overallDpDenom = 0;

    blockList.forEach((b, i) => {
        if (!b) return;
        const trials = finite(b.trials) ?? finite(b.totalTrials) ?? 0;
        const nBack = finite(b.nBack) ?? 0;
        // Continuous scorable: only the first block loses its N lead-in trials.
        const scorable = Math.max(0, i === 0 ? trials - nBack : trials);

        for (const m of activeMods) {
            const rawTargets = b[`${m}TargetCount`];
            const rawHits = b[`${m}Correct`];
            // Skip fallback / unsaved blocks for this modality — synthesizing 0s would
            // falsely read 100% (matches getSessionAccuracy's "skip missing" rule).
            if (rawTargets == null && rawHits == null) continue;
            const targets = finite(rawTargets) ?? 0;
            const hits = finite(rawHits) ?? 0;
            const fas = finite(b[`${m}FalseAlarms`]) ?? 0;
            const errors = Math.max(0, targets - hits) + fas;

            const a = acc[m];
            a.hasData = true;
            a.scorable += scorable;
            a.errors += errors;
            a.correct += hits;
            a.targets += targets;
            a.fa += fas;

            const dp = finite(b[`${m}Dprime`]);
            if (dp != null && trials > 0) {
                a.dpSum += dp * trials;
                a.dpDenom += trials;
                a.hasDp = true;
            }
        }

        const odp = finite(b.overallDprime);
        if (odp != null && trials > 0) {
            overallDpSum += odp * trials;
            overallDpDenom += trials;
        }
    });

    const accuracy = { overall: null, visual: null, audio: null, color: null, shape: null };
    const byModality = { visual: null, audio: null, color: null, shape: null };

    let poolScorable = 0;
    let poolErrors = 0;
    let poolHasData = false;

    for (const m of activeMods) {
        const a = acc[m];
        accuracy[m] = (a.hasData && a.scorable > 0) ? ((a.scorable - a.errors) / a.scorable) * 100 : null;
        byModality[m] = {
            correct: a.hasData ? a.correct : null,
            targetCount: a.hasData ? a.targets : null,
            falseAlarms: a.hasData ? a.fa : null,
            dprime: (a.hasDp && a.dpDenom > 0) ? a.dpSum / a.dpDenom : null,
        };
        if (a.hasData) {
            poolScorable += a.scorable;
            poolErrors += a.errors;
            poolHasData = true;
        }
    }

    accuracy.overall = (poolHasData && poolScorable > 0) ? ((poolScorable - poolErrors) / poolScorable) * 100 : null;
    const overallDprime = overallDpDenom > 0 ? overallDpSum / overallDpDenom : null;

    return { accuracy, byModality, overallDprime };
}

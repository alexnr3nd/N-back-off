/* src/components/insights/hooks/useInsightsData.js */
/* Central memoized data derivation hook for the Insights page.
 *
 * Pipeline:
 *   rawSessions (from UserContext or full-history fetch)
 *     → filteredSessions (period + trainingMode filter)
 *     → growth derivations (trajectory, personal bests, level-ups) per mode
 *     → strengths derivations (modality-by-bucket, RT stability, ceiling) for swGameMode
 *
 * Period = '30d' uses UserContext activeSessions (60-day cap suffices).
 * Period > 30d triggers a one-time full-history fetch via getSessionFARData,
 * cached at module scope so it survives navigation.
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useUser } from '../../../contexts/UserContext';
import { functions, httpsCallable } from '../../../firebaseConfig';
import {
    MODE_MODALITIES as SHARED_MODE_MODALITIES,
    SINGLE_MODE_KEYS,
} from '../../../constants/modeStyles';
import { getSessionAccuracy } from '../../../utils/accuracy';

const getSessionFARDataFn = httpsCallable(functions, 'getSessionFARData');

// Module-level cache — cleared on page refresh.
let _fullHistoryCache = null;

const PERIOD_DAYS = { '30d': 30, '90d': 90, '1y': 365, 'all': null };

const DIFFICULTY_BUCKETS = [
    { key: '0-24', min: 0, max: 0.2499 },
    { key: '25-49', min: 0.25, max: 0.4999 },
    { key: '50-74', min: 0.50, max: 0.7499 },
    { key: '75-99', min: 0.75, max: 0.99 },
];

// Modalities per game mode. Sourced from constants/modeStyles.js so the set
// stays in sync with the UI. Extended here with a 'single' aggregate (union of
// all 4 modalities) that the Growth multi-select and Strengths single-select
// use when the user picks the Single parent pill. See matchesMode() below for
// how 'single' filters sessions.
const MODE_MODALITIES = {
    ...SHARED_MODE_MODALITIES,
    single: ['visual', 'audio', 'color', 'shape'],
};

// Predicate: does this session belong in the bucket for `mode`?
// Classic modes (dual/triple/quad) match exactly on gameMode.
// Single-modality modes match exactly on gameMode.
// 'single' aggregate matches any of the 4 singleX modes.
const matchesMode = (session, mode) => {
    const sm = session.gameMode || 'dual';
    if (mode === 'single') return SINGLE_MODE_KEYS.includes(sm);
    return sm === mode;
};

const clampDifficulty = (d) => Math.max(0, Math.min(0.99, typeof d === 'number' ? d : 0));
const getSessionLevel = (s) => (s.nBack || 2) + clampDifficulty(s.difficulty);
const getSessionTs = (s) => {
    const v = s.timestamp || s.recordedAt || s.date;
    if (!v) return 0;
    const d = typeof v === 'number' ? new Date(v) : new Date(v);
    const t = d.getTime();
    return Number.isFinite(t) ? t : 0;
};

const bucketFor = (difficulty) => {
    const d = clampDifficulty(difficulty);
    for (const b of DIFFICULTY_BUCKETS) {
        if (d >= b.min && d <= b.max) return b.key;
    }
    return '0-24';
};

// 'dynamic' rotates adaptive sub-modes — treat as adaptive per plan.
// Legacy sessions missing trainingMode are assumed adaptive (the historical default).
const matchesTrainingMode = (session, mode) => {
    const tm = (session.trainingMode || 'adaptive').toString().toLowerCase();
    if (mode === 'adaptive') return tm === 'adaptive' || tm === 'dynamic' || tm === '';
    return tm === 'classic';
};

// ─── Derivations ────────────────────────────────────────────────────────────

// Period-adaptive time bucketing for the trajectory chart. Short periods get
// finer resolution; long periods widen the bucket so the line stays legible.
const BUCKET_FOR_PERIOD = {
    '30d': 'day',
    '90d': 'week',
    '1y': 'week',
    'all': 'month',
};

// Returns the start-of-bucket timestamp (local wall-clock) for the given ts.
// Weeks start Sunday to match date-fns default and the repo's FAR chart.
const bucketStartFor = (ts, kind) => {
    const d = new Date(ts);
    if (kind === 'day') {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    }
    if (kind === 'week') {
        const daysFromSunday = d.getDay();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysFromSunday).getTime();
    }
    // month
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
};

// Buckets available in the output. Mirrors the set of mode keys the Insights
// filter bar can emit: dual/triple/quad + 'single' aggregate + singleX.
// Dynamic is intentionally excluded — dynamic sessions save with their
// resolved sub-mode in gameMode, so a 'dynamic' bucket would always be empty.
const TRAJECTORY_MODES = ['dual', 'triple', 'quad', 'single', ...SINGLE_MODE_KEYS];

const deriveTrajectoryByMode = (sessions, selectedModes, period) => {
    const out = Object.fromEntries(TRAJECTORY_MODES.map(k => [k, []]));
    const runningMaxByMode = Object.fromEntries(TRAJECTORY_MODES.map(k => [k, -Infinity]));
    const bucketKind = BUCKET_FOR_PERIOD[period] || 'day';

    // One map per mode: bucket-start ms → { sum, count, maxLevel, pb }.
    const bucketsByMode = Object.fromEntries(TRAJECTORY_MODES.map(k => [k, new Map()]));

    // Ascending chronological order so PB flag is monotonic.
    const asc = [...sessions].sort((a, b) => getSessionTs(a) - getSessionTs(b));

    // A single session can populate multiple buckets: its own specific mode
    // plus the 'single' aggregate bucket if it's a singleX session. We only
    // populate a bucket if that mode is selected, to avoid wasted work.
    const selected = new Set(selectedModes);

    for (const s of asc) {
        const sessionMode = s.gameMode || 'dual';
        if (!TRAJECTORY_MODES.includes(sessionMode)) continue;
        const ts = getSessionTs(s);
        if (!ts) continue;
        const level = getSessionLevel(s);
        const bucketTs = bucketStartFor(ts, bucketKind);

        // Which buckets does this session contribute to?
        const targets = [];
        if (selected.has(sessionMode)) targets.push(sessionMode);
        if (SINGLE_MODE_KEYS.includes(sessionMode) && selected.has('single')) {
            targets.push('single');
        }

        for (const mode of targets) {
            const isPb = level > runningMaxByMode[mode];
            if (isPb) runningMaxByMode[mode] = level;

            const bucketMap = bucketsByMode[mode];
            let row = bucketMap.get(bucketTs);
            if (!row) {
                row = { ts: bucketTs, sum: 0, count: 0, maxLevel: -Infinity, pb: false };
                bucketMap.set(bucketTs, row);
            }
            row.sum += level;
            row.count += 1;
            if (level > row.maxLevel) row.maxLevel = level;
            if (isPb) row.pb = true;
        }
    }

    for (const mode of Object.keys(bucketsByMode)) {
        const rows = [...bucketsByMode[mode].values()].sort((a, b) => a.ts - b.ts);
        out[mode] = rows.map(row => ({
            ts: row.ts,
            level: row.sum / row.count,
            maxLevel: row.maxLevel,
            pb: row.pb,
            sessionCount: row.count,
        }));
    }
    return out;
};

const derivePersonalBests = (sessions) => {
    const out = {};
    for (const s of sessions) {
        const mode = s.gameMode || 'dual';
        const level = getSessionLevel(s);
        const ts = getSessionTs(s);
        const upsertPb = (key) => {
            if (!out[key] || level > out[key].level || (level === out[key].level && ts < out[key].ts)) {
                out[key] = { level, ts, date: ts ? new Date(ts).toISOString() : null };
            }
        };
        upsertPb(mode);
        // 'single' aggregate — any singleX session contributes.
        if (SINGLE_MODE_KEYS.includes(mode)) upsertPb('single');
    }
    return out;
};

const deriveLastPbDays = (personalBests) => {
    const out = {};
    const now = Date.now();
    for (const mode of Object.keys(personalBests)) {
        const ts = personalBests[mode]?.ts;
        if (!ts) { out[mode] = null; continue; }
        out[mode] = Math.max(0, Math.floor((now - ts) / 86400000));
    }
    return out;
};

// Detect N-back level-ups: the first session at a given (mode, nBack) where that
// nBack exceeds the maximum nBack seen so far for that mode.
const deriveRecentLevelUps = (sessions, maxItems = 5) => {
    const asc = [...sessions].sort((a, b) => getSessionTs(a) - getSessionTs(b));
    const maxNByMode = {};
    const events = [];

    for (const s of asc) {
        const mode = s.gameMode || 'dual';
        const n = s.nBack || 2;
        const prevMax = maxNByMode[mode];
        if (prevMax === undefined) {
            maxNByMode[mode] = n;
            continue;
        }
        if (n > prevMax) {
            events.push({
                mode,
                fromLevel: prevMax,
                toLevel: n,
                ts: getSessionTs(s),
                date: getSessionTs(s) ? new Date(getSessionTs(s)).toISOString() : null,
            });
            maxNByMode[mode] = n;
        }
    }
    // Most recent first.
    return events.sort((a, b) => b.ts - a.ts).slice(0, maxItems);
};

// ─── Modality metrics (Hit / Accuracy / FAR / d') ──────────────────────────
// All four live side-by-side on every session, so aggregate them together
// per view (by-N-back / N.DD drilldown / time-bucketed) and emit a single
// wide-array row shape that the MetricPanel primitive can branch on via
// `dataKeySuffix` ∈ { 'Hit', 'Accuracy', 'FAR', 'Dprime' }.
// Hit Rate = hits / targets (sensitivity component). Accuracy = pooled Jaeggi
// recomputed per session via getSessionAccuracy (penalizes FAs + misses
// equally, matches every other display surface).

const _accumulateModalityMetrics = (row, modalities) => {
    for (const mod of modalities) {
        row[`_${mod}HitSum`] = 0;   row[`_${mod}HitCount`] = 0;
        row[`_${mod}AccSum`] = 0;   row[`_${mod}AccCount`] = 0;
        row[`_${mod}FarSum`] = 0;   row[`_${mod}FarCount`] = 0;
        row[`_${mod}DpSum`] = 0;    row[`_${mod}DpCount`] = 0;
    }
};

const _addSessionMetrics = (row, s, modalities) => {
    const sessionAcc = getSessionAccuracy(s, { gameMode: s.gameMode });
    for (const mod of modalities) {
        const h = s[`${mod}HitRate`];
        const a = sessionAcc[mod];
        const f = s[`${mod}FAR`];
        const d = s[`${mod}Dprime`];
        if (h != null) { row[`_${mod}HitSum`] += h; row[`_${mod}HitCount`] += 1; }
        if (a != null && Number.isFinite(a)) { row[`_${mod}AccSum`] += a; row[`_${mod}AccCount`] += 1; }
        if (f != null) { row[`_${mod}FarSum`] += f; row[`_${mod}FarCount`] += 1; }
        if (d != null && Number.isFinite(d)) { row[`_${mod}DpSum`] += d; row[`_${mod}DpCount`] += 1; }
    }
};

const _finalizeModalityMetrics = (row, modalities, outBase) => {
    const out = { ...outBase };
    for (const mod of modalities) {
        out[`${mod}Hit`] = row[`_${mod}HitCount`] > 0 ? row[`_${mod}HitSum`] / row[`_${mod}HitCount`] : null;
        out[`${mod}Accuracy`] = row[`_${mod}AccCount`] > 0 ? row[`_${mod}AccSum`] / row[`_${mod}AccCount`] : null;
        out[`${mod}FAR`] = row[`_${mod}FarCount`] > 0 ? row[`_${mod}FarSum`] / row[`_${mod}FarCount`] : null;
        out[`${mod}Dprime`] = row[`_${mod}DpCount`] > 0 ? row[`_${mod}DpSum`] / row[`_${mod}DpCount`] : null;
        // Per-modality non-null counts, keyed so computeWeightedAverages can
        // find them via `${mod}${dataKeySuffix}Count` — ensures the byNBack
        // and overTime summary averages reduce to the same flat mean.
        out[`${mod}HitCount`] = row[`_${mod}HitCount`] || 0;
        out[`${mod}AccuracyCount`] = row[`_${mod}AccCount`] || 0;
        out[`${mod}FARCount`] = row[`_${mod}FarCount`] || 0;
        out[`${mod}DprimeCount`] = row[`_${mod}DpCount`] || 0;
    }
    for (const mod of ['visual', 'audio', 'color', 'shape']) {
        if (!modalities.includes(mod)) {
            out[`${mod}Hit`] = null;
            out[`${mod}Accuracy`] = null;
            out[`${mod}FAR`] = null;
            out[`${mod}Dprime`] = null;
            out[`${mod}HitCount`] = 0;
            out[`${mod}AccuracyCount`] = 0;
            out[`${mod}FARCount`] = 0;
            out[`${mod}DprimeCount`] = 0;
        }
    }
    return out;
};

// ─── Lure metrics (n-1 FAR / n+1 FAR) ─────────────────────────────────────
// Parallel aggregation to the Hit/FAR/Dprime pipeline above, but emits
// ${mod}N1Lure and ${mod}Np1Lure fields so the lure panel can toggle
// between the two via dataKeySuffix ∈ { 'N1Lure', 'Np1Lure' }.

const _accumulateLureMetrics = (row, modalities) => {
    for (const mod of modalities) {
        row[`_${mod}N1Sum`]  = 0; row[`_${mod}N1Count`]  = 0;
        row[`_${mod}Np1Sum`] = 0; row[`_${mod}Np1Count`] = 0;
    }
};

const _addSessionLureMetrics = (row, s, modalities) => {
    for (const mod of modalities) {
        const n1 = s[`${mod}N1LureFAR`];
        const np1 = s[`${mod}Np1LureFAR`];
        if (n1 != null && Number.isFinite(n1))  { row[`_${mod}N1Sum`]  += n1;  row[`_${mod}N1Count`]  += 1; }
        if (np1 != null && Number.isFinite(np1)) { row[`_${mod}Np1Sum`] += np1; row[`_${mod}Np1Count`] += 1; }
    }
};

const _finalizeLureMetrics = (row, modalities, outBase) => {
    const out = { ...outBase };
    for (const mod of modalities) {
        out[`${mod}N1Lure`]  = row[`_${mod}N1Count`]  > 0 ? row[`_${mod}N1Sum`]  / row[`_${mod}N1Count`]  : null;
        out[`${mod}Np1Lure`] = row[`_${mod}Np1Count`] > 0 ? row[`_${mod}Np1Sum`] / row[`_${mod}Np1Count`] : null;
        // Per-modality non-null counts for correct weighted averaging. Lure
        // FAR is null on sessions with no n±1 lures in that modality, so the
        // count frequently differs from sessionCount.
        out[`${mod}N1LureCount`]  = row[`_${mod}N1Count`]  || 0;
        out[`${mod}Np1LureCount`] = row[`_${mod}Np1Count`] || 0;
    }
    for (const mod of ['visual', 'audio', 'color', 'shape']) {
        if (!modalities.includes(mod)) {
            out[`${mod}N1Lure`] = null;
            out[`${mod}Np1Lure`] = null;
            out[`${mod}N1LureCount`] = 0;
            out[`${mod}Np1LureCount`] = 0;
        }
    }
    return out;
};

const deriveLureMetricsByNBack = (sessions, mode) => {
    const modalities = MODE_MODALITIES[mode] || MODE_MODALITIES.dual;
    const byLevel = new Map();
    for (const s of sessions) {
        if (!matchesMode(s, mode)) continue;
        const n = s.nBack || 2;
        let row = byLevel.get(n);
        if (!row) {
            row = { nBack: n, sessionCount: 0 };
            _accumulateLureMetrics(row, modalities);
            byLevel.set(n, row);
        }
        row.sessionCount += 1;
        _addSessionLureMetrics(row, s, modalities);
    }
    return [...byLevel.values()]
        .sort((a, b) => a.nBack - b.nBack)
        .map(row => _finalizeLureMetrics(row, modalities, {
            nBack: row.nBack, sessionCount: row.sessionCount,
        }));
};

const deriveLureMetricsDrilldown = (sessions, mode, nBack) => {
    if (nBack == null) return [];
    const modalities = MODE_MODALITIES[mode] || MODE_MODALITIES.dual;
    const byBucket = new Map();
    for (const s of sessions) {
        if (!matchesMode(s, mode)) continue;
        if ((s.nBack || 2) !== nBack) continue;
        if (!matchesTrainingMode(s, 'adaptive')) continue;
        const compound = nBack + clampDifficulty(s.difficulty);
        const bucket = Math.floor(compound * 100) / 100;
        let row = byBucket.get(bucket);
        if (!row) {
            row = { level: bucket, sessionCount: 0 };
            _accumulateLureMetrics(row, modalities);
            byBucket.set(bucket, row);
        }
        row.sessionCount += 1;
        _addSessionLureMetrics(row, s, modalities);
    }
    return [...byBucket.values()]
        .sort((a, b) => a.level - b.level)
        .map(row => _finalizeLureMetrics(row, modalities, {
            level: row.level, sessionCount: row.sessionCount,
        }));
};

const deriveLureMetricsOverTime = (sessions, mode, period, nBackFilter) => {
    const modalities = MODE_MODALITIES[mode] || MODE_MODALITIES.dual;
    const bucketKind = BUCKET_FOR_PERIOD[period] || 'day';
    const buckets = new Map();
    for (const s of sessions) {
        if (!matchesMode(s, mode)) continue;
        const n = s.nBack || 2;
        if (nBackFilter != null && n !== nBackFilter) continue;
        const ts = getSessionTs(s);
        if (!ts) continue;
        const bucketTs = bucketStartFor(ts, bucketKind);
        let row = buckets.get(bucketTs);
        if (!row) {
            row = { ts: bucketTs, sessionCount: 0, _levelSum: 0, _levelCount: 0 };
            _accumulateLureMetrics(row, modalities);
            buckets.set(bucketTs, row);
        }
        row.sessionCount += 1;
        row._levelSum += getSessionLevel(s);
        row._levelCount += 1;
        _addSessionLureMetrics(row, s, modalities);
    }
    return [...buckets.values()]
        .sort((a, b) => a.ts - b.ts)
        .map(row => _finalizeLureMetrics(row, modalities, {
            ts: row.ts,
            sessionCount: row.sessionCount,
            avgLevel: row._levelCount > 0 ? row._levelSum / row._levelCount : null,
        }));
};

const deriveModalityMetricsByNBack = (sessions, mode) => {
    const modalities = MODE_MODALITIES[mode] || MODE_MODALITIES.dual;
    const byLevel = new Map();
    for (const s of sessions) {
        if (!matchesMode(s, mode)) continue;
        const n = s.nBack || 2;
        let row = byLevel.get(n);
        if (!row) {
            row = { nBack: n, sessionCount: 0 };
            _accumulateModalityMetrics(row, modalities);
            byLevel.set(n, row);
        }
        row.sessionCount += 1;
        _addSessionMetrics(row, s, modalities);
    }
    return [...byLevel.values()]
        .sort((a, b) => a.nBack - b.nBack)
        .map(row => _finalizeModalityMetrics(row, modalities, {
            nBack: row.nBack, sessionCount: row.sessionCount,
        }));
};

const deriveModalityMetricsDrilldown = (sessions, mode, nBack) => {
    if (nBack == null) return [];
    const modalities = MODE_MODALITIES[mode] || MODE_MODALITIES.dual;
    const byBucket = new Map();
    for (const s of sessions) {
        if (!matchesMode(s, mode)) continue;
        if ((s.nBack || 2) !== nBack) continue;
        if (!matchesTrainingMode(s, 'adaptive')) continue;
        const compound = nBack + clampDifficulty(s.difficulty);
        const bucket = Math.floor(compound * 100) / 100;
        let row = byBucket.get(bucket);
        if (!row) {
            row = { level: bucket, sessionCount: 0 };
            _accumulateModalityMetrics(row, modalities);
            byBucket.set(bucket, row);
        }
        row.sessionCount += 1;
        _addSessionMetrics(row, s, modalities);
    }
    return [...byBucket.values()]
        .sort((a, b) => a.level - b.level)
        .map(row => _finalizeModalityMetrics(row, modalities, {
            level: row.level, sessionCount: row.sessionCount,
        }));
};

const deriveModalityMetricsOverTime = (sessions, mode, period, nBackFilter) => {
    const modalities = MODE_MODALITIES[mode] || MODE_MODALITIES.dual;
    const bucketKind = BUCKET_FOR_PERIOD[period] || 'day';
    const buckets = new Map();

    for (const s of sessions) {
        if (!matchesMode(s, mode)) continue;
        const n = s.nBack || 2;
        if (nBackFilter != null && n !== nBackFilter) continue;
        const ts = getSessionTs(s);
        if (!ts) continue;
        const bucketTs = bucketStartFor(ts, bucketKind);
        let row = buckets.get(bucketTs);
        if (!row) {
            row = { ts: bucketTs, sessionCount: 0, _levelSum: 0, _levelCount: 0 };
            _accumulateModalityMetrics(row, modalities);
            buckets.set(bucketTs, row);
        }
        row.sessionCount += 1;
        row._levelSum += getSessionLevel(s);
        row._levelCount += 1;
        _addSessionMetrics(row, s, modalities);
    }

    return [...buckets.values()]
        .sort((a, b) => a.ts - b.ts)
        .map(row => _finalizeModalityMetrics(row, modalities, {
            ts: row.ts,
            sessionCount: row.sessionCount,
            avgLevel: row._levelCount > 0 ? row._levelSum / row._levelCount : null,
        }));
};

// Per-N-back, per-modality aggregation. One row per N-back level the user
// has played in this game mode. Each modality reports mean RT, mean SD, and
// mean lapses-per-session across sessions at that level that have non-null
// values. Inactive modalities for the mode emit null across all fields.
const deriveRtStability = (sessions, mode) => {
    const modalities = MODE_MODALITIES[mode] || MODE_MODALITIES.dual;
    const byLevel = new Map();
    for (const s of sessions) {
        if (!matchesMode(s, mode)) continue;
        const n = s.nBack || 2;
        if (!byLevel.has(n)) byLevel.set(n, []);
        byLevel.get(n).push(s);
    }
    return [...byLevel.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([nBack, levelSessions]) => {
            const row = { nBack, sessionCount: levelSessions.length };
            for (const mod of modalities) {
                const means = levelSessions.map(s => s[`${mod}ResponseTimeMean`]).filter(v => v != null && v > 0);
                const sds = levelSessions.map(s => s[`${mod}ResponseTimeSD`]).filter(v => v != null && v >= 0);
                const lapses = levelSessions.map(s => s[`${mod}LapseCount`]).filter(v => v != null && v >= 0);
                row[`${mod}MeanRT`] = means.length ? means.reduce((a, b) => a + b, 0) / means.length : null;
                row[`${mod}SdRT`] = sds.length ? sds.reduce((a, b) => a + b, 0) / sds.length : null;
                row[`${mod}Lapses`] = lapses.length ? lapses.reduce((a, b) => a + b, 0) / lapses.length : null;
                row[`${mod}MeanRTCount`] = means.length;
                row[`${mod}SdRTCount`] = sds.length;
                row[`${mod}LapsesCount`] = lapses.length;
            }
            // Fill inactive modalities with explicit nulls so the chart can
            // branch cleanly regardless of mode.
            for (const mod of ['visual', 'audio', 'color', 'shape']) {
                if (!modalities.includes(mod)) {
                    row[`${mod}MeanRT`] = null;
                    row[`${mod}SdRT`] = null;
                    row[`${mod}Lapses`] = null;
                    row[`${mod}MeanRTCount`] = 0;
                    row[`${mod}SdRTCount`] = 0;
                    row[`${mod}LapsesCount`] = 0;
                }
            }
            return row;
        });
};

// Time-bucketed per-modality RT + lapses, plus avg compound level (N.DD) per
// bucket. Uses the same time-bucket pipeline as the modality metrics but yields the
// same per-modality RT/SD/lapses shape as deriveRtStability for visual
// consistency with the by-N-back view. `nBackFilter` (optional) restricts to
// sessions at that single N-back level.
const deriveRtOverTime = (sessions, mode, period, nBackFilter) => {
    const modalities = MODE_MODALITIES[mode] || MODE_MODALITIES.dual;
    const bucketKind = BUCKET_FOR_PERIOD[period] || 'day';
    const buckets = new Map();

    for (const s of sessions) {
        if (!matchesMode(s, mode)) continue;
        const n = s.nBack || 2;
        if (nBackFilter != null && n !== nBackFilter) continue;
        const ts = getSessionTs(s);
        if (!ts) continue;
        const bucketTs = bucketStartFor(ts, bucketKind);
        let row = buckets.get(bucketTs);
        if (!row) {
            row = { ts: bucketTs, sessionCount: 0, _levelSum: 0, _levelCount: 0 };
            for (const mod of modalities) {
                row[`_${mod}MeanSum`] = 0; row[`_${mod}MeanCount`] = 0;
                row[`_${mod}SdSum`] = 0;   row[`_${mod}SdCount`] = 0;
                row[`_${mod}LapseSum`] = 0; row[`_${mod}LapseCount`] = 0;
            }
            buckets.set(bucketTs, row);
        }
        row.sessionCount += 1;
        row._levelSum += getSessionLevel(s);
        row._levelCount += 1;
        for (const mod of modalities) {
            const mean = s[`${mod}ResponseTimeMean`];
            const sd = s[`${mod}ResponseTimeSD`];
            const lapses = s[`${mod}LapseCount`];
            if (mean != null && mean > 0) { row[`_${mod}MeanSum`] += mean; row[`_${mod}MeanCount`] += 1; }
            if (sd != null && sd >= 0)    { row[`_${mod}SdSum`] += sd;     row[`_${mod}SdCount`] += 1; }
            if (lapses != null && lapses >= 0) { row[`_${mod}LapseSum`] += lapses; row[`_${mod}LapseCount`] += 1; }
        }
    }

    return [...buckets.values()]
        .sort((a, b) => a.ts - b.ts)
        .map(row => {
            const out = {
                ts: row.ts,
                sessionCount: row.sessionCount,
                avgLevel: row._levelCount > 0 ? row._levelSum / row._levelCount : null,
            };
            for (const mod of modalities) {
                out[`${mod}MeanRT`] = row[`_${mod}MeanCount`] > 0 ? row[`_${mod}MeanSum`] / row[`_${mod}MeanCount`] : null;
                out[`${mod}SdRT`]   = row[`_${mod}SdCount`] > 0   ? row[`_${mod}SdSum`] / row[`_${mod}SdCount`]     : null;
                out[`${mod}Lapses`] = row[`_${mod}LapseCount`] > 0 ? row[`_${mod}LapseSum`] / row[`_${mod}LapseCount`] : null;
                out[`${mod}MeanRTCount`] = row[`_${mod}MeanCount`] || 0;
                out[`${mod}SdRTCount`]   = row[`_${mod}SdCount`]   || 0;
                out[`${mod}LapsesCount`] = row[`_${mod}LapseCount`] || 0;
            }
            for (const mod of ['visual', 'audio', 'color', 'shape']) {
                if (!modalities.includes(mod)) {
                    out[`${mod}MeanRT`] = null;
                    out[`${mod}SdRT`] = null;
                    out[`${mod}Lapses`] = null;
                    out[`${mod}MeanRTCount`] = 0;
                    out[`${mod}SdRTCount`] = 0;
                    out[`${mod}LapsesCount`] = 0;
                }
            }
            return out;
        });
};

// Per-N.DD-bucket, per-modality aggregation for a single N-back level in
// adaptive mode. Floors compound level to 0.01. Returns one row per populated
// bucket, sorted ascending.
const deriveRtStabilityDrilldown = (sessions, mode, nBack) => {
    if (nBack == null) return [];
    const modalities = MODE_MODALITIES[mode] || MODE_MODALITIES.dual;
    const byBucket = new Map();
    for (const s of sessions) {
        if (!matchesMode(s, mode)) continue;
        if ((s.nBack || 2) !== nBack) continue;
        if (!matchesTrainingMode(s, 'adaptive')) continue;
        // Floor compound level to 0.01 (e.g., 3.4732 → 3.47).
        const compound = nBack + clampDifficulty(s.difficulty);
        const bucket = Math.floor(compound * 100) / 100;
        if (!byBucket.has(bucket)) byBucket.set(bucket, []);
        byBucket.get(bucket).push(s);
    }
    return [...byBucket.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([level, levelSessions]) => {
            const row = { level, sessionCount: levelSessions.length };
            for (const mod of modalities) {
                const means = levelSessions.map(s => s[`${mod}ResponseTimeMean`]).filter(v => v != null && v > 0);
                const sds = levelSessions.map(s => s[`${mod}ResponseTimeSD`]).filter(v => v != null && v >= 0);
                const lapses = levelSessions.map(s => s[`${mod}LapseCount`]).filter(v => v != null && v >= 0);
                row[`${mod}MeanRT`] = means.length ? means.reduce((a, b) => a + b, 0) / means.length : null;
                row[`${mod}SdRT`] = sds.length ? sds.reduce((a, b) => a + b, 0) / sds.length : null;
                row[`${mod}Lapses`] = lapses.length ? lapses.reduce((a, b) => a + b, 0) / lapses.length : null;
                row[`${mod}MeanRTCount`] = means.length;
                row[`${mod}SdRTCount`] = sds.length;
                row[`${mod}LapsesCount`] = lapses.length;
            }
            for (const mod of ['visual', 'audio', 'color', 'shape']) {
                if (!modalities.includes(mod)) {
                    row[`${mod}MeanRT`] = null;
                    row[`${mod}SdRT`] = null;
                    row[`${mod}Lapses`] = null;
                    row[`${mod}MeanRTCount`] = 0;
                    row[`${mod}SdRTCount`] = 0;
                    row[`${mod}LapsesCount`] = 0;
                }
            }
            return row;
        });
};

// Scan every (N-back × modality) combination with ≥3 sessions in the filtered
// set. For each combo, compare hit rate / FAR against the same modality at
// (N-back − 1) — the user's own baseline. Surface the single biggest regression.
// Returns { kind, modality, nBack, value, baseline, baselineNBack } | null.
// kind ∈ { 'hitDrop', 'farClimb' }. value & baseline on 0–100 scale.
const deriveModalityDiagnostic = (sessions, mode) => {
    const modalities = MODE_MODALITIES[mode] || MODE_MODALITIES.dual;
    const MIN_SESSIONS = 3;

    // Group sessions by N-back level for the chosen mode.
    const byLevel = new Map();
    for (const s of sessions) {
        if (!matchesMode(s, mode)) continue;
        const n = s.nBack || 2;
        if (!byLevel.has(n)) byLevel.set(n, []);
        byLevel.get(n).push(s);
    }

    // Per-level per-modality average hit/FAR (only for levels meeting MIN_SESSIONS).
    const avgMap = new Map(); // n -> { mod -> { hit, far } }
    for (const [n, arr] of byLevel.entries()) {
        if (arr.length < MIN_SESSIONS) continue;
        const row = {};
        for (const mod of modalities) {
            const hitVals = arr.map(s => s[`${mod}HitRate`]).filter(v => v != null);
            const farVals = arr.map(s => s[`${mod}FAR`]).filter(v => v != null);
            row[mod] = {
                hit: hitVals.length ? hitVals.reduce((a, b) => a + b, 0) / hitVals.length : null,
                far: farVals.length ? farVals.reduce((a, b) => a + b, 0) / farVals.length : null,
            };
        }
        avgMap.set(n, row);
    }
    if (avgMap.size === 0) return null;

    // Find the worst regression. For each (n, mod), compare vs (n-1, mod).
    // Score = severity of regression. Hit drop: baseline - current (how much worse).
    // FAR climb: current - baseline. Positive = regression.
    let worst = null;
    for (const [n, row] of avgMap.entries()) {
        const prev = avgMap.get(n - 1);
        if (!prev) continue;
        for (const mod of modalities) {
            const curr = row[mod];
            const base = prev[mod];
            if (!curr || !base) continue;

            if (curr.hit != null && base.hit != null) {
                const drop = base.hit - curr.hit;
                if (drop > 0 && (!worst || drop > worst.score)) {
                    worst = { kind: 'hitDrop', modality: mod, nBack: n, value: curr.hit, baseline: base.hit, baselineNBack: n - 1, score: drop };
                }
            }
            if (curr.far != null && base.far != null) {
                const climb = curr.far - base.far;
                if (climb > 0 && (!worst || climb > worst.score)) {
                    worst = { kind: 'farClimb', modality: mod, nBack: n, value: curr.far, baseline: base.far, baselineNBack: n - 1, score: climb };
                }
            }
        }
    }

    if (!worst) return null;
    // Drop the internal score before returning.
    const { score, ...out } = worst;
    return out;
};

// ─── Hook ───────────────────────────────────────────────────────────────────

export const useInsightsData = (filters) => {
    const { activeSessions } = useUser();
    const [fullHistorySessions, setFullHistorySessions] = useState(_fullHistoryCache);
    const [isLoadingAllTime, setIsLoadingAllTime] = useState(false);

    const needsFullHistory = filters.period !== '30d';

    const fetchFullHistory = useCallback(async () => {
        if (_fullHistoryCache || isLoadingAllTime) return;
        setIsLoadingAllTime(true);
        try {
            const result = await getSessionFARDataFn({ fullHistory: true });
            const sessions = result.data?.sessions || [];
            // Cloud function returns millis — normalize to ISO to match activeSessions.
            const converted = sessions.map(s => ({
                ...s,
                date: s.date ? new Date(s.date).toISOString() : null,
                recordedAt: s.recordedAt ? new Date(s.recordedAt).toISOString() : null,
                timestamp: s.timestamp ? new Date(s.timestamp).toISOString() : null,
            }));
            _fullHistoryCache = converted;
            setFullHistorySessions(converted);
        } catch (err) {
            console.error('[useInsightsData] Full-history fetch failed:', err);
            setFullHistorySessions([]);
        } finally {
            setIsLoadingAllTime(false);
        }
    }, [isLoadingAllTime]);

    useEffect(() => {
        if (needsFullHistory && _fullHistoryCache === null) fetchFullHistory();
    }, [needsFullHistory, fetchFullHistory]);

    // Memoized key so derivations recompute only when inputs actually change.
    const rawSessions = useMemo(() => {
        if (needsFullHistory) return fullHistorySessions || [];
        return activeSessions || [];
    }, [needsFullHistory, fullHistorySessions, activeSessions]);

    const filteredSessions = useMemo(() => {
        const days = PERIOD_DAYS[filters.period];
        const cutoff = days === null ? null : Date.now() - days * 86400000;
        return rawSessions.filter(s => {
            if (cutoff !== null) {
                const ts = getSessionTs(s);
                if (ts === 0 || ts < cutoff) return false;
            }
            if (!matchesTrainingMode(s, filters.trainingMode)) return false;
            return true;
        });
    }, [rawSessions, filters.period, filters.trainingMode]);

    // Growth derivations use the full filtered set (respects game-mode pill selection per-chart).
    const growth = useMemo(() => {
        const personalBests = derivePersonalBests(filteredSessions);
        return {
            trajectoryByMode: deriveTrajectoryByMode(filteredSessions, filters.gameModes, filters.period),
            personalBests,
            lastPbDaysByMode: deriveLastPbDays(personalBests),
            recentLevelUps: deriveRecentLevelUps(filteredSessions, 5),
        };
    }, [filteredSessions, filters.gameModes, filters.period]);

    // Strengths derivations scope to the single swGameMode.
    const strengths = useMemo(() => ({
        modalityMetricsByNBack: deriveModalityMetricsByNBack(filteredSessions, filters.swGameMode),
        hitDrilldown: deriveModalityMetricsDrilldown(filteredSessions, filters.swGameMode, filters.hitDrillN),
        accuracyDrilldown: deriveModalityMetricsDrilldown(filteredSessions, filters.swGameMode, filters.accuracyDrillN),
        farDrilldown: deriveModalityMetricsDrilldown(filteredSessions, filters.swGameMode, filters.farDrillN),
        senseDrilldown: deriveModalityMetricsDrilldown(filteredSessions, filters.swGameMode, filters.senseDrillN),
        hitOverTime: deriveModalityMetricsOverTime(filteredSessions, filters.swGameMode, filters.period, filters.hitOverTimeNBack),
        accuracyOverTime: deriveModalityMetricsOverTime(filteredSessions, filters.swGameMode, filters.period, filters.accuracyOverTimeNBack),
        farOverTime: deriveModalityMetricsOverTime(filteredSessions, filters.swGameMode, filters.period, filters.farOverTimeNBack),
        senseOverTime: deriveModalityMetricsOverTime(filteredSessions, filters.swGameMode, filters.period, filters.senseOverTimeNBack),
        rtStability: deriveRtStability(filteredSessions, filters.swGameMode),
        rtStabilityDrilldown: deriveRtStabilityDrilldown(filteredSessions, filters.swGameMode, filters.rtDrillN),
        lapsesDrilldown: deriveRtStabilityDrilldown(filteredSessions, filters.swGameMode, filters.lapseDrillN),
        modalityDiagnostic: deriveModalityDiagnostic(filteredSessions, filters.swGameMode),
        rtOverTime: deriveRtOverTime(filteredSessions, filters.swGameMode, filters.period, filters.rtOverTimeNBack),
        lapsesOverTime: deriveRtOverTime(filteredSessions, filters.swGameMode, filters.period, filters.lapsesOverTimeNBack),
        lureMetricsByNBack: deriveLureMetricsByNBack(filteredSessions, filters.swGameMode),
        lureDrilldown: deriveLureMetricsDrilldown(filteredSessions, filters.swGameMode, filters.lureDrillN),
        lureOverTime: deriveLureMetricsOverTime(filteredSessions, filters.swGameMode, filters.period, filters.lureOverTimeNBack),
    }), [
        filteredSessions, filters.swGameMode, filters.period,
        filters.rtDrillN, filters.lapseDrillN,
        filters.rtOverTimeNBack, filters.lapsesOverTimeNBack,
        filters.hitDrillN, filters.accuracyDrillN, filters.farDrillN, filters.senseDrillN,
        filters.hitOverTimeNBack, filters.accuracyOverTimeNBack, filters.farOverTimeNBack, filters.senseOverTimeNBack,
        filters.lureDrillN, filters.lureOverTimeNBack,
    ]);

    return {
        growth,
        strengths,
        meta: {
            sessionCount: filteredSessions.length,
            rawSessionCount: rawSessions.length,
            isLoadingAllTime,
            needsFullHistory,
        },
    };
};

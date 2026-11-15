/* src/components/insights/strengths/metric/metricShared.js */
/* Shared helpers for the MetricPanel primitive. Re-exports per-modality
 * style tokens from responseTimeShared (single source of truth) plus the
 * time-bucket helpers and dot renderers used by all three chart variants
 * (Overview / Drill / OverTime).
 */

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
    MODE_MODALITIES, MODALITY_LABELS, MODALITY_COLORS, dotRadius,
} from '../responseTimeShared';

export { MODE_MODALITIES, MODALITY_LABELS, MODALITY_COLORS, dotRadius };

export const LOW_N_THRESHOLD = 5;
export const DRILL_LOW_N_THRESHOLD = 3;

export const AVG_LEVEL_COLOR = 'rgb(var(--color-text-muted))';

export const BUCKET_FOR_PERIOD = {
    '30d': 'day',
    '90d': 'week',
    '1y': 'week',
    'all': 'month',
};

const BUCKET_LABEL_FORMAT = {
    day: 'MMM d, yyyy',
    week: "'Week of' MMM d",
    month: 'MMMM yyyy',
};

export const formatBucketLabel = (ts, bucketKind) => {
    try {
        return format(new Date(ts), BUCKET_LABEL_FORMAT[bucketKind] || BUCKET_LABEL_FORMAT.day);
    } catch {
        return '';
    }
};

export const formatAxisTick = (ts, bucketKind) => {
    try {
        const d = new Date(ts);
        if (bucketKind === 'month') return format(d, 'MMM yy');
        return format(d, 'MMM d');
    } catch {
        return '';
    }
};

export const isOnGridline = (level) => Math.round(level * 100) % 10 === 0;

// Over-time view uses a uniform small dot at every bucket. Time buckets tend
// to have similar sample sizes across a period (a user plays at roughly
// consistent frequency), so the sessionCount encoding adds less value here
// than on by-N-back where sample sizes vary wildly across levels. On mobile
// the viewport is narrow and dots from different modalities can overlap, so
// shrink further there.
export const SMALL_DOT_RADIUS_DESKTOP = 2.5;
export const SMALL_DOT_RADIUS_MOBILE = 1.5;

// Tailwind's `sm` breakpoint. Matches our chart card responsive sizing.
const MOBILE_QUERY = '(max-width: 639px)';

export const useIsMobileChart = () => {
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(MOBILE_QUERY).matches;
    });
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const mq = window.matchMedia(MOBILE_QUERY);
        const handler = (e) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);
    return isMobile;
};

// Weighted mean of per-modality values across displayed rows.
// Each row's value at `${mod}${dataKeySuffix}` is itself a mean over only the
// sessions that had a non-null value for that modality/metric. The correct
// weight is therefore the per-modality non-null count (`${mod}${suffix}Count`)
// — weighting by `sessionCount` inflates buckets where some sessions contributed
// null for the modality, causing the summary to drift depending on how sessions
// are bucketed (time vs difficulty), and making byNBack and overTime summaries
// disagree for the same underlying sessions.
// Falls back to `sessionCount` then 1 so older callers still work.
export const computeWeightedAverages = (rows, modalities, dataKeySuffix) => {
    const out = {};
    for (const mod of modalities) {
        let sum = 0;
        let totalWeight = 0;
        for (const r of rows) {
            const v = r[`${mod}${dataKeySuffix}`];
            if (v == null) continue;
            const perModCount = r[`${mod}${dataKeySuffix}Count`];
            const w = (typeof perModCount === 'number' && perModCount > 0)
                ? perModCount
                : (r.sessionCount || 1);
            sum += v * w;
            totalWeight += w;
        }
        out[mod] = totalWeight > 0 ? sum / totalWeight : null;
    }
    return out;
};

// Small dashed-line glyph used as the "Avg level" icon in the averages row.
// Matches the dashed over-time overlay line so the row doubles as a legend.
const AvgLevelGlyph = () => (
    <svg width="14" height="3" aria-hidden="true" className="inline-block align-middle">
        <line
            x1="0" y1="1.5" x2="14" y2="1.5"
            stroke={AVG_LEVEL_COLOR}
            strokeWidth="1.25"
            strokeDasharray="3 2"
        />
    </svg>
);

// Renders a compact stats row beneath a chart. Serves as both legend
// (colored dot per modality) and summary (weighted average per modality).
// In over-time view, optionally appends an "Avg level" stat with a dashed
// glyph that mirrors the on-chart overlay line.
export const ChartAveragesRow = ({
    averages, modalities, valueFormat,
    label = 'Average',
    avgLevel,                // optional number — appended as a trailing entry
    avgLevelFormat = (v) => v.toFixed(2),
}) => {
    const anyValue = modalities.some(mod => averages[mod] != null);
    if (!anyValue && avgLevel == null) return null;
    return (
        <div className="mt-2 pt-2 border-t border-theme-line/40">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.6875rem] font-mono">
                <span className="text-[0.6875rem] font-semibold text-theme-text uppercase tracking-wider">{label}</span>
                {modalities.map(mod => {
                    const v = averages[mod];
                    return (
                        <span key={mod} className="flex items-center gap-1.5">
                            <span
                                className="w-1.5 h-1.5 rounded-full inline-block"
                                style={{ backgroundColor: MODALITY_COLORS[mod] }}
                            />
                            <span style={{ color: MODALITY_COLORS[mod] }}>
                                {MODALITY_LABELS[mod]}
                            </span>
                            <span className="text-theme-text">
                                {v != null ? valueFormat(v) : '—'}
                            </span>
                        </span>
                    );
                })}
                {avgLevel != null && (
                    <span className="flex items-center gap-1.5">
                        <AvgLevelGlyph />
                        <span style={{ color: AVG_LEVEL_COLOR }}>Avg level</span>
                        <span className="text-theme-text">{avgLevelFormat(avgLevel)}</span>
                    </span>
                )}
            </div>
        </div>
    );
};

export const makeSmallDot = (mod, radius = SMALL_DOT_RADIUS_DESKTOP) => (props) => (
    <circle
        key={props.key ?? `${mod}-${props.payload?.ts ?? props.payload?.nBack}`}
        cx={props.cx}
        cy={props.cy}
        r={radius}
        fill={MODALITY_COLORS[mod]}
        stroke={MODALITY_COLORS[mod]}
        strokeWidth={1}
    />
);

// Overview (by-N-back) charts size dots by sessionCount with a low-n opacity
// rule (<5 sessions = hollow) — sample size varies a lot across levels and
// is informative here.
export const makeOverviewDot = (mod) => (props) => {
    const count = props.payload?.sessionCount ?? 0;
    const lowN = count > 0 && count < LOW_N_THRESHOLD;
    return (
        <circle
            key={props.key ?? `${mod}-${props.payload?.nBack ?? props.payload?.ts}`}
            cx={props.cx}
            cy={props.cy}
            r={dotRadius(count)}
            fill={lowN ? 'none' : MODALITY_COLORS[mod]}
            fillOpacity={lowN ? 0 : 1}
            stroke={MODALITY_COLORS[mod]}
            strokeOpacity={lowN ? 0.55 : 1}
            strokeWidth={lowN ? 1.5 : 1}
        />
    );
};

// Drill charts prefer 0.10 gridlines but fall back to showing every populated
// dot when the user has <3 gridline points (sparse data).
export const makeDrillDot = (mod, renderAllDots) => (props) => {
    const level = props.payload?.level;
    if (level == null) return null;
    if (!renderAllDots && !isOnGridline(level)) return null;
    const count = props.payload?.sessionCount ?? 0;
    const lowN = count > 0 && count < DRILL_LOW_N_THRESHOLD;
    return (
        <circle
            key={props.key ?? `${mod}-${level}`}
            cx={props.cx}
            cy={props.cy}
            r={dotRadius(count)}
            fill={lowN ? 'none' : MODALITY_COLORS[mod]}
            fillOpacity={lowN ? 0 : 1}
            stroke={MODALITY_COLORS[mod]}
            strokeOpacity={lowN ? 0.55 : 1}
            strokeWidth={lowN ? 1.5 : 1}
        />
    );
};

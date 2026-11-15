/* src/components/insights/strengths/ResponseTimeOverTimeChart.js */
/* Time-series renderers for the Response Time + Lapses panels. Dual Y-axis
 * ComposedChart: left = metric (RT ms or lapses/session), right = avg
 * compound level (N.DD) rendered as a thin dashed muted line so it reads as
 * context for the modality lines, not a competing metric.
 *
 * Uses the same per-modality palette, dot sizing, and low-n opacity rules as
 * ResponseTimeStabilityChart so the two views feel like one chart family.
 */

import React from 'react';
import {
    ComposedChart, Line, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import {
    MODALITY_LABELS, MODALITY_COLORS,
} from './responseTimeShared';
import {
    useIsMobileChart, SMALL_DOT_RADIUS_DESKTOP, SMALL_DOT_RADIUS_MOBILE,
} from './metric/metricShared';

const BUCKET_LABEL_FORMAT = {
    day: 'MMM d, yyyy',
    week: "'Week of' MMM d",
    month: 'MMMM yyyy',
};

const formatBucketLabel = (ts, bucketKind) => {
    try {
        return format(new Date(ts), BUCKET_LABEL_FORMAT[bucketKind] || BUCKET_LABEL_FORMAT.day);
    } catch {
        return '';
    }
};

const formatAxisTick = (ts, bucketKind) => {
    try {
        const d = new Date(ts);
        if (bucketKind === 'month') return format(d, 'MMM yy');
        if (bucketKind === 'week') return format(d, 'MMM d');
        return format(d, 'MMM d');
    } catch {
        return '';
    }
};

// Precomputed Range tuples for Recharts range-area bands. Same pattern as the
// by-N-back chart — per modality we emit a [lower, upper] pair keyed by the
// bucket's ts so the Area component can render a shaded SD band.
const buildChartRows = (data, modalities) => {
    return data.map(r => {
        const out = { ts: r.ts, sessionCount: r.sessionCount, avgLevel: r.avgLevel };
        for (const mod of modalities) {
            const mean = r[`${mod}MeanRT`];
            const sd = r[`${mod}SdRT`];
            const lapses = r[`${mod}Lapses`];
            out[`${mod}MeanRT`] = mean != null ? Math.round(mean) : null;
            out[`${mod}SdRT`] = sd != null ? Math.round(sd) : null;
            const upper = (mean != null && sd != null) ? Math.round(mean + sd) : null;
            const lower = (mean != null && sd != null) ? Math.max(0, Math.round(mean - sd)) : null;
            out[`${mod}UpperRT`] = upper;
            out[`${mod}LowerRT`] = lower;
            out[`${mod}Range`] = (upper != null && lower != null) ? [lower, upper] : null;
            out[`${mod}Lapses`] = lapses != null ? Number(lapses.toFixed(2)) : null;
            out[`${mod}CoV`] = (mean != null && mean > 0 && sd != null) ? sd / mean : null;
        }
        return out;
    });
};

// Uniform small dot at every bucket; smaller on mobile where multiple
// modality lines can visually overlap on a narrow viewport.
const makeDot = (mod, radius) => (props) => (
    <circle
        key={props.key ?? `${mod}-${props.payload?.ts}`}
        cx={props.cx}
        cy={props.cy}
        r={radius}
        fill={MODALITY_COLORS[mod]}
        stroke={MODALITY_COLORS[mod]}
        strokeWidth={1}
    />
);

const RtTooltip = ({ active, payload, label, bucketKind, modalities }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload || {};
    return (
        <div className="bg-theme-bg-elevated border border-theme-line p-2 text-xs font-mono">
            <p className="text-theme-text-muted mb-1">
                {formatBucketLabel(label, bucketKind)}
                {row.sessionCount != null ? ` · ${row.sessionCount} session${row.sessionCount !== 1 ? 's' : ''}` : ''}
            </p>
            {modalities.map(mod => {
                const mean = row[`${mod}MeanRT`];
                const sd = row[`${mod}SdRT`];
                const cov = row[`${mod}CoV`];
                if (mean == null) return null;
                return (
                    <p key={mod} style={{ color: MODALITY_COLORS[mod] }}>
                        {MODALITY_LABELS[mod]}: {mean} ms{sd != null ? ` ± ${sd}` : ''}
                        {cov != null ? ` (CoV ${cov.toFixed(2)})` : ''}
                    </p>
                );
            })}
            {row.avgLevel != null && (
                <p className="text-theme-text-muted mt-1">
                    Avg level: {row.avgLevel.toFixed(2)}
                </p>
            )}
        </div>
    );
};

const LapseTooltip = ({ active, payload, label, bucketKind, modalities }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload || {};
    return (
        <div className="bg-theme-bg-elevated border border-theme-line p-2 text-xs font-mono">
            <p className="text-theme-text-muted mb-1">
                {formatBucketLabel(label, bucketKind)}
                {row.sessionCount != null ? ` · ${row.sessionCount} session${row.sessionCount !== 1 ? 's' : ''}` : ''}
            </p>
            {modalities.map(mod => {
                const v = row[`${mod}Lapses`];
                if (v == null) return null;
                return (
                    <p key={mod} style={{ color: MODALITY_COLORS[mod] }}>
                        {MODALITY_LABELS[mod]}: {v.toFixed(1)} / session
                    </p>
                );
            })}
            {row.avgLevel != null && (
                <p className="text-theme-text-muted mt-1">
                    Avg level: {row.avgLevel.toFixed(2)}
                </p>
            )}
        </div>
    );
};

const AVG_LEVEL_COLOR = 'rgb(var(--color-text-muted))';

const renderAvgLevelLine = () => (
    <Line
        yAxisId="right"
        type="monotone"
        dataKey="avgLevel"
        name="Avg level"
        stroke={AVG_LEVEL_COLOR}
        strokeWidth={1.25}
        strokeDasharray="4 3"
        dot={false}
        connectNulls={true}
        isAnimationActive={false}
    />
);

export const OverTimeRtChart = ({ data, modalities, bucketKind }) => {
    const rows = buildChartRows(data || [], modalities);
    const isMobile = useIsMobileChart();
    const dotR = isMobile ? SMALL_DOT_RADIUS_MOBILE : SMALL_DOT_RADIUS_DESKTOP;
    return (
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="2 3" stroke="rgb(var(--color-line))" strokeOpacity={0.4} />
                <XAxis
                    dataKey="ts"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    stroke="rgb(var(--color-text-muted))"
                    tick={{ fontSize: 11, fontFamily: 'monospace' }}
                    tickFormatter={(v) => formatAxisTick(v, bucketKind)}
                />
                <YAxis
                    yAxisId="left"
                    domain={[0, 'auto']}
                    tickFormatter={(v) => `${v}ms`}
                    stroke="rgb(var(--color-text-muted))"
                    tick={{ fontSize: 11, fontFamily: 'monospace' }}
                    width={52}
                />
                <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                    tickFormatter={(v) => (v != null ? v.toFixed(1) : '')}
                    stroke={AVG_LEVEL_COLOR}
                    tick={{ fontSize: 11, fontFamily: 'monospace', fill: AVG_LEVEL_COLOR }}
                    width={32}
                />
                <Tooltip
                    content={<RtTooltip modalities={modalities} bucketKind={bucketKind} />}
                    cursor={{ stroke: 'rgb(var(--color-accent))', strokeOpacity: 0.25 }}
                />
                {modalities.map(mod => (
                    <Area
                        key={`${mod}-band`}
                        yAxisId="left"
                        type="monotone"
                        dataKey={`${mod}Range`}
                        stroke="none"
                        fill={MODALITY_COLORS[mod]}
                        fillOpacity={0.12}
                        legendType="none"
                        activeDot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                ))}
                {modalities.map(mod => (
                    <Line
                        key={mod}
                        yAxisId="left"
                        type="monotone"
                        dataKey={`${mod}MeanRT`}
                        name={MODALITY_LABELS[mod]}
                        stroke={MODALITY_COLORS[mod]}
                        strokeWidth={1.75}
                        dot={makeDot(mod, dotR)}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                ))}
                {renderAvgLevelLine()}
            </ComposedChart>
        </ResponsiveContainer>
    );
};

export const OverTimeLapseChart = ({ data, modalities, bucketKind }) => {
    const rows = buildChartRows(data || [], modalities);
    const isMobile = useIsMobileChart();
    const dotR = isMobile ? SMALL_DOT_RADIUS_MOBILE : SMALL_DOT_RADIUS_DESKTOP;
    return (
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="2 3" stroke="rgb(var(--color-line))" strokeOpacity={0.4} />
                <XAxis
                    dataKey="ts"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    stroke="rgb(var(--color-text-muted))"
                    tick={{ fontSize: 11, fontFamily: 'monospace' }}
                    tickFormatter={(v) => formatAxisTick(v, bucketKind)}
                />
                <YAxis
                    yAxisId="left"
                    domain={[0, 'auto']}
                    tickFormatter={(v) => v.toFixed(1)}
                    stroke="rgb(var(--color-text-muted))"
                    tick={{ fontSize: 11, fontFamily: 'monospace' }}
                    width={36}
                />
                <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                    tickFormatter={(v) => (v != null ? v.toFixed(1) : '')}
                    stroke={AVG_LEVEL_COLOR}
                    tick={{ fontSize: 11, fontFamily: 'monospace', fill: AVG_LEVEL_COLOR }}
                    width={32}
                />
                <Tooltip
                    content={<LapseTooltip modalities={modalities} bucketKind={bucketKind} />}
                    cursor={{ stroke: 'rgb(var(--color-accent))', strokeOpacity: 0.25 }}
                />
                {modalities.map(mod => (
                    <Line
                        key={mod}
                        yAxisId="left"
                        type="monotone"
                        dataKey={`${mod}Lapses`}
                        name={MODALITY_LABELS[mod]}
                        stroke={MODALITY_COLORS[mod]}
                        strokeWidth={1.75}
                        dot={makeDot(mod, dotR)}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                ))}
                {renderAvgLevelLine()}
            </ComposedChart>
        </ResponsiveContainer>
    );
};

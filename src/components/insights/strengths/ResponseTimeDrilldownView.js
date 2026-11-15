/* src/components/insights/strengths/ResponseTimeDrilldownView.js */
/* Drilldown chart primitives for the Response Time chart. Given pre-built rows
 * keyed by `level` (float N.DD), each component renders a single zoomed chart
 * over [N, N+0.99] for one integer N-back. The parent panel owns the card
 * shell, title, and dropdown; these components render the chart only.
 *
 * Dot rendering policy: prefer 0.10 gridlines, but fall back to showing every
 * populated dot when the user has <3 gridline points (sparse data).
 */

import React, { useMemo } from 'react';
import {
    ComposedChart, LineChart, Line, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { MODALITY_LABELS, MODALITY_COLORS, dotRadius } from './responseTimeShared';

const isOnGridline = (level) => Math.round(level * 100) % 10 === 0;

// Drilldown dot: only render at 0.10 gridlines when we have enough of them,
// otherwise render every populated point so sparse drilldowns still show up.
const renderDrillDot = (mod, renderAllDots) => (props) => {
    const level = props.payload?.level;
    if (level == null) return null;
    if (!renderAllDots && !isOnGridline(level)) return null;
    const count = props.payload?.sessionCount ?? 0;
    const lowN = count > 0 && count < 3;
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

// Drilldown tooltips: label is a float N.DD level (e.g. 3.47). Formatted to 2 decimals.
const DrillRtTooltip = ({ active, payload, label, modalities }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload || {};
    return (
        <div className="bg-theme-bg-elevated border border-theme-line p-2 text-xs font-mono">
            <p className="text-theme-text-muted mb-1">
                N={Number(label).toFixed(2)}
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
        </div>
    );
};

const DrillLapseTooltip = ({ active, payload, label, modalities }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload || {};
    return (
        <div className="bg-theme-bg-elevated border border-theme-line p-2 text-xs font-mono">
            <p className="text-theme-text-muted mb-1">
                N={Number(label).toFixed(2)}
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
        </div>
    );
};

export const DrillRtChart = ({ rows, modalities, drillN }) => {
    const gridlineCount = useMemo(
        () => rows.filter(r => isOnGridline(r.level)).length,
        [rows]
    );
    const renderAllDots = gridlineCount < 3;
    return (
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="2 3" stroke="rgb(var(--color-line))" strokeOpacity={0.4} />
                <XAxis
                    dataKey="level"
                    type="number"
                    domain={[drillN, drillN + 0.99]}
                    ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => drillN + i * 0.1)}
                    allowDecimals={true}
                    stroke="rgb(var(--color-text-muted))"
                    tick={{ fontSize: 11, fontFamily: 'monospace' }}
                    tickFormatter={(v) => v.toFixed(1)}
                />
                <YAxis
                    domain={[0, 'auto']}
                    tickFormatter={(v) => `${v}ms`}
                    stroke="rgb(var(--color-text-muted))"
                    tick={{ fontSize: 11, fontFamily: 'monospace' }}
                    width={52}
                />
                <Tooltip
                    content={<DrillRtTooltip modalities={modalities} />}
                    cursor={{ stroke: 'rgb(var(--color-accent))', strokeOpacity: 0.25 }}
                />
                {modalities.map(mod => (
                    <Area
                        key={`${mod}-band`}
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
                        type="monotone"
                        dataKey={`${mod}MeanRT`}
                        name={MODALITY_LABELS[mod]}
                        stroke={MODALITY_COLORS[mod]}
                        strokeWidth={1.75}
                        dot={renderDrillDot(mod, renderAllDots)}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                ))}
            </ComposedChart>
        </ResponsiveContainer>
    );
};

export const DrillLapseChart = ({ rows, modalities, drillN }) => {
    const gridlineCount = useMemo(
        () => rows.filter(r => isOnGridline(r.level)).length,
        [rows]
    );
    const renderAllDots = gridlineCount < 3;
    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="2 3" stroke="rgb(var(--color-line))" strokeOpacity={0.4} />
                <XAxis
                    dataKey="level"
                    type="number"
                    domain={[drillN, drillN + 0.99]}
                    ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => drillN + i * 0.1)}
                    allowDecimals={true}
                    stroke="rgb(var(--color-text-muted))"
                    tick={{ fontSize: 11, fontFamily: 'monospace' }}
                    tickFormatter={(v) => v.toFixed(1)}
                />
                <YAxis
                    domain={[0, 'auto']}
                    tickFormatter={(v) => v.toFixed(1)}
                    stroke="rgb(var(--color-text-muted))"
                    tick={{ fontSize: 11, fontFamily: 'monospace' }}
                    width={36}
                />
                <Tooltip
                    content={<DrillLapseTooltip modalities={modalities} />}
                    cursor={{ stroke: 'rgb(var(--color-accent))', strokeOpacity: 0.25 }}
                />
                {modalities.map(mod => (
                    <Line
                        key={mod}
                        type="monotone"
                        dataKey={`${mod}Lapses`}
                        name={MODALITY_LABELS[mod]}
                        stroke={MODALITY_COLORS[mod]}
                        strokeWidth={1.75}
                        dot={renderDrillDot(mod, renderAllDots)}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );
};

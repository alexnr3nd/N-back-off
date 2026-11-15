/* src/components/insights/growth/LevelTrajectoryChart.js */
/* Multi-line chart of combined level (N.DD = nBack + difficulty) over time.
 *
 * Wide-array pattern: each data point carries level fields for every selected
 * game mode (others null). connectNulls lets sparse modes render smoothly.
 * PB points are rendered as emphasized dots.
 */

import React, { useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import {
    MODE_CHART_COLORS as MODE_COLORS,
    MODE_LABELS,
} from '../../../constants/modeStyles';

// Merge per-mode trajectories (already time-bucketed by useInsightsData) into
// a single wide array keyed by bucket-start timestamp.
const buildWideArray = (trajectoryByMode, selectedModes) => {
    const rows = new Map(); // ts → row
    for (const mode of selectedModes) {
        const arr = trajectoryByMode[mode] || [];
        for (const pt of arr) {
            if (!rows.has(pt.ts)) rows.set(pt.ts, { ts: pt.ts });
            const row = rows.get(pt.ts);
            row[`${mode}Level`] = pt.level;
            row[`${mode}Max`] = pt.maxLevel;
            row[`${mode}Count`] = pt.sessionCount;
            if (pt.pb) row[`${mode}Pb`] = true;
        }
    }
    return [...rows.values()].sort((a, b) => a.ts - b.ts);
};

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

const CustomTooltip = ({ active, payload, label, bucketKind }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-theme-bg-elevated border border-theme-line p-2 text-xs font-mono">
            <p className="text-theme-text-muted mb-1">{formatBucketLabel(label, bucketKind)}</p>
            {payload.map(entry => {
                const modeKey = entry.dataKey.replace('Level', '');
                const pb = entry.payload?.[`${modeKey}Pb`];
                const count = entry.payload?.[`${modeKey}Count`];
                const peak = entry.payload?.[`${modeKey}Max`];
                const avg = entry.value;
                const showPeak = peak != null && avg != null && Math.abs(peak - avg) > 0.005;
                return (
                    <p key={entry.dataKey} style={{ color: entry.color }}>
                        {entry.name}: {avg != null ? `avg ${avg.toFixed(2)}` : '—'}
                        {showPeak && ` · peak ${peak.toFixed(2)}`}
                        {count != null && ` · ${count} session${count === 1 ? '' : 's'}`}
                        {pb && ' ★ PB'}
                    </p>
                );
            })}
        </div>
    );
};

// PB-only dot renderer. Non-PB buckets render no marker — the line alone carries
// the trend, which avoids the "cloud of dots" problem for active users.
const makePbDot = (mode, color) => (props) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    if (!payload?.[`${mode}Pb`]) return null;
    return (
        <g>
            <circle cx={cx} cy={cy} r={5} fill={color} fillOpacity={0.25} />
            <circle cx={cx} cy={cy} r={3} fill={color} stroke={color} strokeWidth={1.5} />
        </g>
    );
};

const BUCKET_FOR_PERIOD = {
    '30d': 'day',
    '90d': 'week',
    '1y': 'week',
    'all': 'month',
};

const LevelTrajectoryChart = ({ trajectoryByMode, gameModes, period }) => {
    const bucketKind = BUCKET_FOR_PERIOD[period] || 'day';
    const data = useMemo(
        () => buildWideArray(trajectoryByMode, gameModes),
        [trajectoryByMode, gameModes]
    );

    // Per-gameMode sessionCount-weighted avg level. Serves as both the
    // chart legend (colored dot + mode name) and summary stat below the chart.
    const avgLevelByMode = useMemo(() => {
        const out = {};
        for (const mode of gameModes) {
            let sum = 0, weight = 0;
            for (const row of data) {
                const v = row[`${mode}Level`];
                const w = row[`${mode}Count`] || 0;
                if (v == null || w <= 0) continue;
                sum += v * w;
                weight += w;
            }
            out[mode] = weight > 0 ? sum / weight : null;
        }
        return out;
    }, [data, gameModes]);

    // Y-axis domain: ceil to the next nBack above max, floor to the nBack below min.
    const domain = useMemo(() => {
        let min = Infinity, max = -Infinity;
        for (const row of data) {
            for (const mode of gameModes) {
                const v = row[`${mode}Level`];
                if (v == null) continue;
                if (v < min) min = v;
                if (v > max) max = v;
            }
        }
        if (!Number.isFinite(min) || !Number.isFinite(max)) return [2, 4];
        return [Math.max(1, Math.floor(min)), Math.ceil(max + 0.1)];
    }, [data, gameModes]);

    if (data.length === 0) {
        return (
            <div className="specimen-card p-8 border border-theme-line text-center">
                <p className="text-sm font-mono text-theme-text-muted">
                    No sessions in this period. Try a wider time range or play a session to get started.
                </p>
            </div>
        );
    }

    const xFormatter = (ts) => {
        try { return format(new Date(ts), 'MMM d'); } catch { return ''; }
    };
    const yFormatter = (v) => v.toFixed(1);

    return (
        <div className="specimen-card p-3 sm:p-4 border border-theme-line">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="text-sm font-mono uppercase tracking-wider text-theme-text">Level Trajectory</h3>
                    <p className="text-xs text-theme-text-muted mt-0.5">
                        Combined level (N-back + difficulty) over time. Highlighted points mark personal bests.
                    </p>
                </div>
            </div>
            <div className="h-64 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
                        <CartesianGrid strokeDasharray="2 3" stroke="rgb(var(--color-line))" strokeOpacity={0.4} />
                        <XAxis
                            dataKey="ts"
                            tickFormatter={xFormatter}
                            stroke="rgb(var(--color-text-muted))"
                            tick={{ fontSize: 11, fontFamily: 'monospace' }}
                            scale="time"
                            type="number"
                            domain={['dataMin', 'dataMax']}
                        />
                        <YAxis
                            domain={domain}
                            tickFormatter={yFormatter}
                            stroke="rgb(var(--color-text-muted))"
                            tick={{ fontSize: 11, fontFamily: 'monospace' }}
                            width={40}
                        />
                        <Tooltip content={<CustomTooltip bucketKind={bucketKind} />} />
                        {gameModes.map(mode => (
                            <Line
                                key={mode}
                                type="monotone"
                                dataKey={`${mode}Level`}
                                name={MODE_LABELS[mode]}
                                stroke={MODE_COLORS[mode]}
                                strokeWidth={1.75}
                                connectNulls
                                dot={makePbDot(mode, MODE_COLORS[mode])}
                                activeDot={{ r: 5 }}
                                isAnimationActive={false}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-2 pt-2 border-t border-theme-line/40">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.6875rem] font-mono">
                    <span className="text-[0.6875rem] font-semibold text-theme-text uppercase tracking-wider">Average</span>
                    {gameModes.map(mode => {
                        const v = avgLevelByMode[mode];
                        return (
                            <span key={mode} className="flex items-center gap-1.5">
                                <span
                                    className="w-1.5 h-1.5 rounded-full inline-block"
                                    style={{ backgroundColor: MODE_COLORS[mode] }}
                                />
                                <span style={{ color: MODE_COLORS[mode] }}>{MODE_LABELS[mode]}</span>
                                <span className="text-theme-text">
                                    {v != null ? v.toFixed(2) : '—'}
                                </span>
                            </span>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default LevelTrajectoryChart;

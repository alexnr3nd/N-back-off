/* src/components/insights/strengths/metric/MetricOverTimeChart.js */
/* Time-series view for the MetricPanel primitive. ComposedChart with optional
 * dual Y-axis: left = metric, right (dashed muted line) = avg compound level
 * so users can read "did the metric change, or did my difficulty drift?" at
 * a glance. */

import React from 'react';
import {
    ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
    MODALITY_LABELS, MODALITY_COLORS, makeSmallDot,
    AVG_LEVEL_COLOR, formatBucketLabel, formatAxisTick,
    useIsMobileChart, SMALL_DOT_RADIUS_DESKTOP, SMALL_DOT_RADIUS_MOBILE,
} from './metricShared';

const OverTimeTooltip = ({ active, payload, label, bucketKind, modalities, dataKeySuffix, valueFormat }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload || {};
    return (
        <div className="bg-theme-bg-elevated border border-theme-line p-2 text-xs font-mono">
            <p className="text-theme-text-muted mb-1">
                {formatBucketLabel(label, bucketKind)}
                {row.sessionCount != null ? ` · ${row.sessionCount} session${row.sessionCount !== 1 ? 's' : ''}` : ''}
            </p>
            {modalities.map(mod => {
                const v = row[`${mod}${dataKeySuffix}`];
                if (v == null) return null;
                return (
                    <p key={mod} style={{ color: MODALITY_COLORS[mod] }}>
                        {MODALITY_LABELS[mod]}: {valueFormat(v)}
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

const MetricOverTimeChart = ({
    data, modalities, dataKeySuffix, yDomain, yTickFormat, valueFormat,
    bucketKind, showAvgLevelOverlay = true, yWidth = 42,
}) => {
    const isMobile = useIsMobileChart();
    const dotR = isMobile ? SMALL_DOT_RADIUS_MOBILE : SMALL_DOT_RADIUS_DESKTOP;
    return (
    <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
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
                domain={yDomain}
                tickFormatter={yTickFormat}
                stroke="rgb(var(--color-text-muted))"
                tick={{ fontSize: 11, fontFamily: 'monospace' }}
                width={yWidth}
            />
            {showAvgLevelOverlay && (
                <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                    tickFormatter={(v) => (v != null ? v.toFixed(1) : '')}
                    stroke={AVG_LEVEL_COLOR}
                    tick={{ fontSize: 11, fontFamily: 'monospace', fill: AVG_LEVEL_COLOR }}
                    width={32}
                />
            )}
            <Tooltip
                content={<OverTimeTooltip modalities={modalities} bucketKind={bucketKind} dataKeySuffix={dataKeySuffix} valueFormat={valueFormat} />}
                cursor={{ stroke: 'rgb(var(--color-accent))', strokeOpacity: 0.25 }}
            />
            {modalities.map(mod => (
                <Line
                    key={mod}
                    yAxisId="left"
                    type="monotone"
                    dataKey={`${mod}${dataKeySuffix}`}
                    name={MODALITY_LABELS[mod]}
                    stroke={MODALITY_COLORS[mod]}
                    strokeWidth={1.75}
                    dot={makeSmallDot(mod, dotR)}
                    connectNulls={false}
                    isAnimationActive={false}
                />
            ))}
            {showAvgLevelOverlay && (
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
            )}
        </ComposedChart>
    </ResponsiveContainer>
    );
};

export default MetricOverTimeChart;

/* src/components/insights/strengths/metric/MetricDrillChart.js */
/* Adaptive N.DD drilldown view for the MetricPanel primitive.
 * X axis spans [N, N+0.99]; dots appear at 0.10 gridlines (or all points
 * when gridline coverage is sparse). */

import React, { useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
    MODALITY_LABELS, MODALITY_COLORS, makeDrillDot, isOnGridline,
} from './metricShared';

const DrillTooltip = ({ active, payload, label, modalities, dataKeySuffix, valueFormat }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload || {};
    return (
        <div className="bg-theme-bg-elevated border border-theme-line p-2 text-xs font-mono">
            <p className="text-theme-text-muted mb-1">
                N={Number(label).toFixed(2)}
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
        </div>
    );
};

const MetricDrillChart = ({
    data, modalities, dataKeySuffix, yDomain, yTickFormat, valueFormat, drillN, yWidth = 42,
}) => {
    const gridlineCount = useMemo(
        () => data.filter(r => isOnGridline(r.level)).length,
        [data]
    );
    const renderAllDots = gridlineCount < 3;

    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
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
                    domain={yDomain}
                    tickFormatter={yTickFormat}
                    stroke="rgb(var(--color-text-muted))"
                    tick={{ fontSize: 11, fontFamily: 'monospace' }}
                    width={yWidth}
                />
                <Tooltip
                    content={<DrillTooltip modalities={modalities} dataKeySuffix={dataKeySuffix} valueFormat={valueFormat} />}
                    cursor={{ stroke: 'rgb(var(--color-accent))', strokeOpacity: 0.25 }}
                />
                {modalities.map(mod => (
                    <Line
                        key={mod}
                        type="monotone"
                        dataKey={`${mod}${dataKeySuffix}`}
                        name={MODALITY_LABELS[mod]}
                        stroke={MODALITY_COLORS[mod]}
                        strokeWidth={1.75}
                        dot={makeDrillDot(mod, renderAllDots)}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );
};

export default MetricDrillChart;

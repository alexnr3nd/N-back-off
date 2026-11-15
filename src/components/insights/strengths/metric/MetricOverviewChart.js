/* src/components/insights/strengths/metric/MetricOverviewChart.js */
/* By-N-back view for the MetricPanel primitive. One line per modality, X=nBack. */

import React from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
    MODALITY_LABELS, MODALITY_COLORS, makeOverviewDot,
} from './metricShared';

const OverviewTooltip = ({ active, payload, label, modalities, dataKeySuffix, valueFormat }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload || {};
    return (
        <div className="bg-theme-bg-elevated border border-theme-line p-2 text-xs font-mono">
            <p className="text-theme-text-muted mb-1">
                N={label}
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

const MetricOverviewChart = ({
    data, modalities, dataKeySuffix, yDomain, yTickFormat, valueFormat, yWidth = 42,
}) => (
    <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
            <CartesianGrid strokeDasharray="2 3" stroke="rgb(var(--color-line))" strokeOpacity={0.4} />
            <XAxis
                dataKey="nBack"
                type="number"
                domain={['dataMin', 'dataMax']}
                allowDecimals={false}
                stroke="rgb(var(--color-text-muted))"
                tick={{ fontSize: 11, fontFamily: 'monospace' }}
                tickFormatter={(v) => `N=${v}`}
            />
            <YAxis
                domain={yDomain}
                tickFormatter={yTickFormat}
                stroke="rgb(var(--color-text-muted))"
                tick={{ fontSize: 11, fontFamily: 'monospace' }}
                width={yWidth}
            />
            <Tooltip
                content={<OverviewTooltip modalities={modalities} dataKeySuffix={dataKeySuffix} valueFormat={valueFormat} />}
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
                    dot={makeOverviewDot(mod)}
                    connectNulls={false}
                    isAnimationActive={false}
                />
            ))}
        </LineChart>
    </ResponsiveContainer>
);

export default MetricOverviewChart;

/* src/components/testing/symmetrySpan/SymmetrySpanProgressChart.js */
/* Cognitive Lab dark theme; modeled on DigitSpanProgressChart.js. */
import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { SYMSPAN_DEFAULTS } from '../../../constants/symmetrySpanConstants';

// Cognitive Lab theme colors (mirrors ProgressChart.js)
const THEME = {
    amberAccent: '#d4a84b',
    warmText: '#e8e4dc',
    warmSecondary: '#b8b2a6',
    warmMuted: '#8a857c',
    charcoalBase: '#1a1915',
    charcoalElevated: '#2d2b27',
    charcoalLine: '#3d3a35',
};

const formatDateTick = (timestamp) => {
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return '';
    try {
        return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
        return '';
    }
};

const formatTooltipDateLabel = (timestamp) => {
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return 'Invalid Date';
    try {
        return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
        return 'Error Date';
    }
};

/**
 * Single-line progress chart for Symmetry Span: the partial-credit score
 * (0-42) across scored assessments.
 *
 * @param {object} props
 * @param {Array<object>} [props.historyData] - Scored (non-familiarization) SYMMETRY_SPAN history entries.
 */
const SymmetrySpanProgressChart = ({ historyData = [] }) => {
    const chartData = useMemo(() => historyData
        .map(item => {
            const date = item.timestamp ? new Date(item.timestamp) : null;
            const isValidDate = date instanceof Date && !isNaN(date.getTime());
            const score = typeof item.scorePCU === 'number' && !isNaN(item.scorePCU) ? item.scorePCU : null;
            return {
                ...item,
                timestamp: isValidDate ? date.getTime() : null,
                scorePCU: score,
                isValid: isValidDate && score !== null,
            };
        })
        .filter(item => item.isValid)
        .sort((a, b) => a.timestamp - b.timestamp),
        [historyData]
    );

    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 640);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const chartFontSize = isMobile ? 12 : 11;
    const labelFontSize = isMobile ? 13 : 11;

    if (chartData.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-theme-text-muted italic p-4 border border-theme-line bg-theme-bg-secondary font-mono text-sm">
                No valid Symmetry Span data available to display chart.
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 20, bottom: 20 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke={THEME.charcoalLine} />

                <XAxis
                    dataKey="timestamp"
                    scale="time"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={formatDateTick}
                    angle={-30}
                    textAnchor="end"
                    height={40}
                    tick={{ fontSize: chartFontSize, fill: THEME.warmMuted }}
                    stroke={THEME.charcoalLine}
                    name="Date"
                />

                <YAxis
                    domain={[0, SYMSPAN_DEFAULTS.MAX_PARTIAL_SCORE]}
                    allowDecimals={false}
                    tick={{ fontSize: chartFontSize, fill: THEME.warmMuted }}
                    stroke={THEME.charcoalLine}
                    label={{ value: 'Partial Score', angle: -90, position: 'insideLeft', fontSize: labelFontSize, fill: THEME.warmSecondary, dx: -10 }}
                />

                <Tooltip
                    contentStyle={{
                        fontSize: 12,
                        padding: '8px 12px',
                        borderRadius: '0',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        border: `1px solid ${THEME.charcoalLine}`,
                        backgroundColor: THEME.charcoalElevated,
                        color: THEME.warmText,
                        fontFamily: 'ui-monospace, monospace',
                    }}
                    labelStyle={{ color: THEME.amberAccent, marginBottom: '4px', fontWeight: 'bold' }}
                    itemStyle={{ color: THEME.warmSecondary }}
                    labelFormatter={formatTooltipDateLabel}
                    formatter={(value) => [
                        typeof value === 'number' ? `${value} / ${SYMSPAN_DEFAULTS.MAX_PARTIAL_SCORE}` : 'N/A',
                        'Partial Score',
                    ]}
                    cursor={{ stroke: THEME.warmMuted, strokeWidth: 1, strokeDasharray: '3 3' }}
                />

                <Line
                    type="monotone"
                    dataKey="scorePCU"
                    name="Partial Score"
                    stroke={THEME.amberAccent}
                    strokeWidth={2}
                    activeDot={{ r: 6, strokeWidth: 2, fill: THEME.amberAccent, stroke: THEME.charcoalBase }}
                    dot={{ r: 4, strokeWidth: 1, fill: THEME.amberAccent, stroke: THEME.amberAccent }}
                    connectNulls={false}
                />
            </LineChart>
        </ResponsiveContainer>
    );
};

SymmetrySpanProgressChart.propTypes = {
    historyData: PropTypes.arrayOf(
        PropTypes.shape({
            timestamp: PropTypes.oneOfType([
                PropTypes.string,
                PropTypes.number,
                PropTypes.instanceOf(Date),
            ]),
            scorePCU: PropTypes.number,
        })
    ),
};

export default SymmetrySpanProgressChart;

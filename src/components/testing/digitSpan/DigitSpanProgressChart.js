/* src/components/testing/digitSpan/DigitSpanProgressChart.js */
/* Cognitive Lab dark theme; modeled on src/components/ui/ProgressChart.js
   (that component hard-requires scorePCU, so Digit Span gets its own chart).
   Uses JS default params, not defaultProps (removed for function components
   in React 19). */
import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

// Cognitive Lab theme colors (mirrors ProgressChart.js)
const THEME = {
    amberAccent: '#d4a84b',
    warmText: '#e8e4dc',
    warmSecondary: '#b8b2a6',
    warmMuted: '#8a857c',
    charcoalBase: '#1a1915',
    charcoalElevated: '#2d2b27',
    charcoalLine: '#3d3a35',
    statusSuccess: '#22c55e',
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
 * Two-line progress chart for Digit Span: forward Mean Span (amber) and
 * backward Mean Span (green). Backward may be null for partial sessions;
 * those segments are simply not connected.
 *
 * @param {object} props
 * @param {Array<object>} [props.historyData] - Scored (non-familiarization) DIGIT_SPAN history entries.
 */
const DigitSpanProgressChart = ({ historyData = [] }) => {
    const chartData = useMemo(() => historyData
        .map(item => {
            const date = item.timestamp ? new Date(item.timestamp) : null;
            const isValidDate = date instanceof Date && !isNaN(date.getTime());
            const forward = typeof item.meanSpanForward === 'number' && !isNaN(item.meanSpanForward)
                ? item.meanSpanForward : null;
            const backward = typeof item.meanSpanBackward === 'number' && !isNaN(item.meanSpanBackward)
                ? item.meanSpanBackward : null;
            return {
                ...item,
                timestamp: isValidDate ? date.getTime() : null,
                meanSpanForward: forward,
                meanSpanBackward: backward,
                isValid: isValidDate && forward !== null,
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
                No valid Digit Span data available to display chart.
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

                {/* Mean Span can reach 9.5 on a perfect forward block */}
                <YAxis
                    domain={[0, 10]}
                    allowDecimals={false}
                    tick={{ fontSize: chartFontSize, fill: THEME.warmMuted }}
                    stroke={THEME.charcoalLine}
                    label={{ value: 'Mean Span', angle: -90, position: 'insideLeft', fontSize: labelFontSize, fill: THEME.warmSecondary, dx: -10 }}
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
                    formatter={(value, name) => [
                        typeof value === 'number' ? value.toFixed(2) : 'N/A',
                        name,
                    ]}
                    cursor={{ stroke: THEME.warmMuted, strokeWidth: 1, strokeDasharray: '3 3' }}
                />

                <Legend
                    verticalAlign="top"
                    height={36}
                    iconSize={10}
                    wrapperStyle={{ fontSize: labelFontSize, fontFamily: 'ui-monospace, monospace', color: THEME.warmSecondary }}
                />

                <Line
                    type="monotone"
                    dataKey="meanSpanForward"
                    name="Forward"
                    stroke={THEME.amberAccent}
                    strokeWidth={2}
                    activeDot={{ r: 6, strokeWidth: 2, fill: THEME.amberAccent, stroke: THEME.charcoalBase }}
                    dot={{ r: 4, strokeWidth: 1, fill: THEME.amberAccent, stroke: THEME.amberAccent }}
                    connectNulls={false}
                />
                <Line
                    type="monotone"
                    dataKey="meanSpanBackward"
                    name="Backward"
                    stroke={THEME.statusSuccess}
                    strokeWidth={2}
                    activeDot={{ r: 6, strokeWidth: 2, fill: THEME.statusSuccess, stroke: THEME.charcoalBase }}
                    dot={{ r: 4, strokeWidth: 1, fill: THEME.statusSuccess, stroke: THEME.statusSuccess }}
                    connectNulls={false}
                />
            </LineChart>
        </ResponsiveContainer>
    );
};

DigitSpanProgressChart.propTypes = {
    historyData: PropTypes.arrayOf(
        PropTypes.shape({
            timestamp: PropTypes.oneOfType([
                PropTypes.string,
                PropTypes.number,
                PropTypes.instanceOf(Date),
            ]),
            meanSpanForward: PropTypes.number,
            meanSpanBackward: PropTypes.number,
        })
    ),
};

export default DigitSpanProgressChart;

/* src/components/testing/faceNameMemory/FaceNameMemoryProgressChart.js */
/* Cognitive Lab dark theme; modeled on VisualArraysProgressChart.js.
   Uses JS default params, not defaultProps (removed for function components
   in React 19).

   Unlike the Visual Arrays chart (which receives pre-filtered historyData),
   this component accepts the raw userData.cstHistory array and does its own
   filtering + timestamp normalization, so it stays self-contained. */
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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine } from '@fortawesome/free-solid-svg-icons';
import { CST_TEST_TYPES } from '../../../constants/cstConstants';

// Cognitive Lab theme colors (mirrors VisualArraysProgressChart.js)
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

// Normalize the various timestamp shapes the backend may persist:
// ISO string, epoch number, JS Date, or a Firestore Timestamp-like object
// (with a .toDate() method or a _seconds field).
const toMillis = (timestamp) => {
    if (!timestamp) return null;
    try {
        if (typeof timestamp?.toDate === 'function') {
            const d = timestamp.toDate();
            return d instanceof Date && !isNaN(d.getTime()) ? d.getTime() : null;
        }
        if (typeof timestamp?._seconds === 'number') {
            return timestamp._seconds * 1000;
        }
        if (typeof timestamp === 'string' || typeof timestamp === 'number' || timestamp instanceof Date) {
            const d = new Date(timestamp);
            return d instanceof Date && !isNaN(d.getTime()) ? d.getTime() : null;
        }
    } catch (e) {
        return null;
    }
    return null;
};

/**
 * Single-line progress chart for Face-Name Memory: delayed hit rate
 * (percent of names recalled after the filled delay) over time.
 *
 * Familiarization entries (familiarizationSession === true) carry no score
 * fields and are excluded here. Y domain [0, 100] — a hit rate is a percentage.
 *
 * @param {object} props
 * @param {Array<object>} [props.cstHistory] - Raw userData.cstHistory array (mixed test types).
 */
const FaceNameMemoryProgressChart = ({ cstHistory = [] }) => {
    const chartData = useMemo(() => {
        if (!Array.isArray(cstHistory)) return [];
        return cstHistory
            .filter(item =>
                item
                && item.testType === CST_TEST_TYPES.FACE_NAME_MEMORY
                && item.familiarizationSession === false
                && typeof item.delayedHitRate === 'number'
                && Number.isFinite(item.delayedHitRate)
            )
            .map(item => ({
                ...item,
                timestamp: toMillis(item.timestamp),
                delayedHitRate: item.delayedHitRate,
            }))
            .filter(item => typeof item.timestamp === 'number' && Number.isFinite(item.timestamp))
            .sort((a, b) => a.timestamp - b.timestamp);
    }, [cstHistory]);

    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 640);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const chartFontSize = isMobile ? 12 : 11;
    const labelFontSize = isMobile ? 13 : 11;

    // A trend needs at least two points; show a friendly empty state otherwise.
    if (chartData.length < 2) {
        return (
            <div className="h-64 flex flex-col items-center justify-center text-center p-4 border border-theme-line bg-theme-bg-secondary">
                <div className="w-12 h-12 mb-3 border border-theme-line flex items-center justify-center text-theme-text-muted">
                    <FontAwesomeIcon icon={faChartLine} className="h-5 w-5" />
                </div>
                <p className="text-theme-text-secondary font-mono text-sm">
                    {chartData.length === 0 ? 'No assessment data yet' : 'One assessment recorded'}
                </p>
                <p className="text-theme-text-muted font-mono text-xs mt-1 max-w-xs">
                    Complete at least two monthly assessments to chart your recall trend over time.
                </p>
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

                {/* Hit rate is a percentage, 0–100 */}
                <YAxis
                    domain={[0, 100]}
                    allowDecimals={false}
                    tick={{ fontSize: chartFontSize, fill: THEME.warmMuted }}
                    stroke={THEME.charcoalLine}
                    label={{ value: '% recalled', angle: -90, position: 'insideLeft', fontSize: labelFontSize, fill: THEME.warmSecondary, dx: -10 }}
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
                        typeof value === 'number' ? `${value.toFixed(0)}%` : 'N/A',
                        name,
                    ]}
                    cursor={{ stroke: THEME.warmMuted, strokeWidth: 1, strokeDasharray: '3 3' }}
                />

                <Line
                    type="monotone"
                    dataKey="delayedHitRate"
                    name="Names recalled"
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

FaceNameMemoryProgressChart.propTypes = {
    cstHistory: PropTypes.arrayOf(
        PropTypes.shape({
            testType: PropTypes.string,
            familiarizationSession: PropTypes.bool,
            delayedHitRate: PropTypes.number,
            timestamp: PropTypes.oneOfType([
                PropTypes.string,
                PropTypes.number,
                PropTypes.instanceOf(Date),
                PropTypes.object, // Firestore Timestamp-like
            ]),
        })
    ),
};

export default FaceNameMemoryProgressChart;

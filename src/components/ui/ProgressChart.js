/* src/components/ui/ProgressChart.js */
/* Updated to match Cognitive Lab dark theme */
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
    ReferenceArea, // For highlighting familiarization
    Dot, // For custom dot rendering
} from 'recharts';
import { COUNTING_SPAN_DEFAULTS, CST_TEST_TYPES } from '../../constants/cstConstants'; // Import defaults

// Cognitive Lab theme colors
const THEME = {
    amberAccent: '#d4a84b',
    warmText: '#e8e4dc',
    warmSecondary: '#b8b2a6',
    warmMuted: '#8a857c',
    charcoalBase: '#1a1915',
    charcoalSurface: '#242320',
    charcoalElevated: '#2d2b27',
    charcoalLine: '#3d3a35',
    statusSuccess: '#22c55e',
};

// Helper to format numeric timestamp for XAxis ticks (e.g., "Aug 21")
const formatDateTick = (timestamp) => {
    // Validate input is a finite number
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return '';
    try {
        // Show Month/Day for ticks
        return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
        // Log error if date conversion fails
        console.warn("Error formatting tick timestamp:", timestamp, e);
        return '';
    }
};

// Helper to format numeric timestamp for Tooltip label (e.g., "August 21, 2024")
const formatTooltipDateLabel = (timestamp) => {
    // Validate input is a finite number
     if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return 'Invalid Date';
     try {
         // Show full date in tooltip label
         return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
     } catch (e) {
        // Log error if date conversion fails
        console.warn("Error formatting tooltip timestamp:", timestamp, e);
         return 'Error Date';
     }
};

/**
 * Custom Dot component for the LineChart.
 * Renders dots differently if they represent a familiarization session.
 * Includes coordinate validation.
 *
 * @param {object} props - Props passed by Recharts (cx, cy, stroke, payload, etc.)
 */
const CustomizedDot = (props) => {
    // Destructure props provided by Recharts
    const { cx, cy, stroke, payload } = props;

    // --- Coordinate Validation ---
    // Check if coordinates provided by Recharts are valid numbers.
    // This guards against potential NaN values from Recharts internal calculations.
    if (typeof cx !== 'number' || isNaN(cx) || typeof cy !== 'number' || isNaN(cy)) {
        console.error("[CustomizedDot] Received NaN coordinate from Recharts:", { cx, cy, payload });
        return null; // Don't render the dot if position is invalid
    }
    // --- End Validation ---

    // Check the payload (original data point) for the familiarization flag
    if (payload?.familiarizationSession) {
        // Render a different style for familiarization sessions (open circle with dark fill)
        return (
            <circle cx={cx} cy={cy} r={5} stroke={stroke} strokeWidth={1.5} fill={THEME.charcoalSurface} />
        );
    }

    // Default dot rendering for regular assessment sessions (filled amber dot)
    return <Dot cx={cx} cy={cy} r={4} stroke={stroke} strokeWidth={1} fill={stroke} />;
};

// PropTypes for the CustomizedDot component
CustomizedDot.propTypes = {
  cx: PropTypes.number, // X coordinate passed by Recharts
  cy: PropTypes.number, // Y coordinate passed by Recharts
  stroke: PropTypes.string, // Color passed by Recharts
  payload: PropTypes.shape({ // The original data object for this point
    familiarizationSession: PropTypes.bool, // Flag indicating if it was a familiarization session
    timestamp: PropTypes.number, // Expecting numeric timestamp in payload now
    score: PropTypes.number, // Expecting numeric score in payload
    // Include other potential fields from chartData if needed
  }),
};

/**
 * Renders a progress line chart using Recharts.
 * Filters data by testType, validates timestamps and scores, and handles familiarization highlighting.
 *
 * @param {object} props
 * @param {Array<object>} [props.historyData=[]] - The raw history data array.
 * @param {string} props.testType - The specific CST_TEST_TYPES key to filter and display.
 */
const ProgressChart = ({ historyData = [], testType = CST_TEST_TYPES.COUNTING_SPAN, maxPossibleScore = 75 }) => {

    // console.log("[ProgressChart] Received historyData:", historyData); // Optional: Debug raw input

    // --- Data Preparation and Validation ---
    // 1. Filter by testType
    // 2. Map to required structure, parsing/validating timestamp and score
    // 3. Filter out any entries with invalid data
    // 4. Sort chronologically
    const chartData = useMemo(() => historyData
        .filter(item => item?.testType === testType) // Ensure item exists and filter by test type
        .map(item => {
            // Parse timestamp string into Date object, check validity
            const date = item.timestamp ? new Date(item.timestamp) : null;
            const isValidDate = date instanceof Date && !isNaN(date.getTime());
            // Check if scorePCU is a valid number
            const score = typeof item.scorePCU === 'number' && !isNaN(item.scorePCU) ? item.scorePCU : null;
            const isValidScore = score !== null;

            // Return object with parsed/validated data and original properties
            return {
                ...item, // Keep original data (familiarizationSession, processingAccuracy, etc.)
                date: isValidDate ? date : null, // Keep Date object if valid for potential use
                timestamp: isValidDate ? date.getTime() : null, // Numeric timestamp for XAxis dataKey & sorting
                score: isValidScore ? score : null, // Validated score for YAxis dataKey
                isValid: isValidDate && isValidScore, // Flag for overall validity of this data point
            };
        })
        .filter(item => item.isValid) // Keep only items with valid date and score
        .sort((a, b) => a.timestamp - b.timestamp), // Sort chronologically by numeric timestamp
        [historyData, testType] // Recalculate only when history or testType changes
    );

    // Responsive font sizing for chart elements
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 640);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const chartFontSize = isMobile ? 12 : 11;
    const labelFontSize = isMobile ? 13 : 11;

    // console.log("[ProgressChart] Processed chartData:", chartData); // Optional: Debug processed data

    // --- Render Placeholder if No Valid Data ---
    if (chartData.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-theme-text-muted italic p-4 border border-theme-line bg-theme-bg-secondary font-mono text-sm">
                No valid {testType === CST_TEST_TYPES.COUNTING_SPAN ? "Counting Span" : "assessment"} data available to display chart.
            </div>
        );
    }

    // --- Chart Configuration ---

    // Y-Axis Domain: Fixed from 0 to the theoretical maximum score for consistency
    const yAxisDomain = [0, maxPossibleScore];

    // Familiarization Area Boundaries (using numeric timestamps)
    let familiarizationEndTime = null;
    // Find the index of the *first* item that is NOT a familiarization session
    const firstNonFamiliarizationIndex = chartData.findIndex(item => !item.familiarizationSession);

    if (firstNonFamiliarizationIndex === -1 && chartData.length > 0) {
        // Case: All available data points are familiarization sessions
        familiarizationEndTime = chartData[chartData.length - 1].timestamp; // End at the last point
    } else if (firstNonFamiliarizationIndex > 0) {
        // Case: Found the transition point. End time is the timestamp of the *last* familiarization session.
        familiarizationEndTime = chartData[firstNonFamiliarizationIndex - 1].timestamp;
    }
    // If familiarizationEndTime remains null, it means no familiarization area is needed
    // (either no data, or the first data point wasn't familiarization).

    // Use the timestamp of the very first data point as the start time for the area
    const familiarizationStartTime = chartData.length > 0 ? chartData[0].timestamp : null;
    const showFamiliarizationArea = familiarizationStartTime !== null && familiarizationEndTime !== null;


    // --- Render Chart ---
    return (
        // Responsive container ensures chart scales correctly within its parent
        <ResponsiveContainer width="100%" height={300}>
            <LineChart
                data={chartData} // Use the processed and validated data
                margin={{
                    top: 5,
                    right: 20, // Margin for labels/ticks
                    left: 20,  // Increased for Y-axis label visibility
                    bottom: 20, // Margin for angled X-axis labels
                }}
            >
                {/* Background Grid Lines */}
                <CartesianGrid strokeDasharray="3 3" stroke={THEME.charcoalLine} />

                {/* X Axis (Time) */}
                <XAxis
                    dataKey="timestamp" // Use the numeric timestamp for positioning
                    scale="time" // Indicate this axis represents time
                    type="number" // Required when scale="time" and dataKey provides numbers
                    domain={['dataMin', 'dataMax']} // Automatically determine time range
                    tickFormatter={formatDateTick} // Format the timestamp ticks (e.g., "Aug 21")
                    angle={-30} // Angle ticks to prevent overlap
                    textAnchor="end" // Align angled ticks correctly
                    height={40} // Allocate space for angled labels
                    tick={{ fontSize: chartFontSize, fill: THEME.warmMuted }} // Style tick labels
                    stroke={THEME.charcoalLine} // Axis line color
                    name="Date" // Name for the axis (used by Tooltip if labelFormatter not specified)
                />

                {/* Y Axis (Score) */}
                <YAxis
                    dataKey="score" // Use the validated score
                    domain={yAxisDomain} // Use the fixed domain [0, maxScore]
                    allowDecimals={false} // Scores are integers
                    tick={{ fontSize: chartFontSize, fill: THEME.warmMuted }} // Style tick labels
                    stroke={THEME.charcoalLine} // Axis line color
                    // Label for the Y-axis
                    label={{ value: 'PCU Score', angle: -90, position: 'insideLeft', fontSize: labelFontSize, fill: THEME.warmSecondary, dx: -10 }}
                />

                {/* Tooltip on Hover */}
                <Tooltip
                    // Style the tooltip container for dark theme
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
                    // Format the label (usually the X-axis value) using the timestamp
                    labelFormatter={formatTooltipDateLabel}
                    // Format the values displayed within the tooltip
                    formatter={(value, name, props) => {
                        const { payload } = props;
                        const entryMax = payload.maxPCU || 60;
                        const scoreText = typeof value === 'number' ? `${value} / ${entryMax}` : 'N/A';
                        const typeText = payload.familiarizationSession ? ' (Practice)' : '';
                        return [
                            <span key="tooltip">
                                Recall: {scoreText}{typeText}
                                {typeof payload.processingAccuracy === 'number' && (
                                    <><br />Odd/Even: {payload.processingAccuracy.toFixed(1)}%</>
                                )}
                            </span>,
                            null
                        ];
                    }}
                    // Style the cursor line
                    cursor={{ stroke: THEME.warmMuted, strokeWidth: 1, strokeDasharray: '3 3' }}
                />

                {/* Legend */}
                <Legend
                    verticalAlign="top"
                    height={36}
                    iconSize={10}
                    wrapperStyle={{ fontSize: labelFontSize, fontFamily: 'ui-monospace, monospace', color: THEME.warmSecondary }}
                />

                {/* Reference Area for Familiarization */}
                {/* Render only if we have valid start and end timestamps */}
                {showFamiliarizationArea && (
                    <ReferenceArea
                        x1={familiarizationStartTime} // Use numeric start timestamp
                        x2={familiarizationEndTime}   // Use numeric end timestamp
                        stroke="none" // No border for the area
                        fill={THEME.charcoalElevated} // Dark background for familiarization area
                        fillOpacity={0.6} // Semi-transparent
                        // Label the area
                        label={{
                            value: "Practice",
                            position: "insideTopLeft",
                            fontSize: chartFontSize,
                            fill: THEME.warmMuted,
                            dy: 10, // Offset label down slightly
                            dx: 10, // Offset label right slightly
                        }}
                        ifOverflow="visible" // Ensure label remains visible if near chart edge
                    />
                )}

                {/* The Score Line */}
                <Line
                    type="monotone" // Use smooth curve for the line
                    dataKey="score" // The data field for the Y value
                    name="PCU Score" // Name shown in Legend and Tooltip
                    stroke={THEME.amberAccent} // Line color (amber accent)
                    strokeWidth={2} // Line thickness
                    // Configure the appearance of the dot shown when hovering over a point
                    activeDot={{ r: 6, strokeWidth: 2, fill: THEME.amberAccent, stroke: THEME.charcoalBase }}
                    // Use the custom component to render each dot on the line
                    dot={<CustomizedDot />}
                    connectNulls={false} // Do not draw line segments over missing data points (null scores)
                />
            </LineChart>
        </ResponsiveContainer>
    );
};

// PropTypes definition for type checking the props passed to ProgressChart
ProgressChart.propTypes = {
    // historyData is an array of objects, but providing it is optional (defaults to [])
    historyData: PropTypes.arrayOf(
        PropTypes.shape({
            testType: PropTypes.string.isRequired, // Identifier for the type of test
            timestamp: PropTypes.string.isRequired, // ISO 8601 Date string expected from data source
            scorePCU: PropTypes.number, // Partial Credit Unit score (can be null/missing)
            familiarizationSession: PropTypes.bool, // Flag for familiarization sessions
            processingAccuracy: PropTypes.number, // Processing task accuracy (can be null/missing)
        })
    ),
    // testType prop is required to filter the data correctly
    testType: PropTypes.string.isRequired,
    // Maximum possible score for the Y-axis domain and tooltip display
    maxPossibleScore: PropTypes.number,
};

// Set default props for the component
ProgressChart.defaultProps = {
    historyData: [], // Default to an empty array if historyData is not provided
    maxPossibleScore: 75, // Default max score for Counting Span task
};

export default ProgressChart;

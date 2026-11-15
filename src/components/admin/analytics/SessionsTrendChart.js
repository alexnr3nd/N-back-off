/* src/components/admin/analytics/SessionsTrendChart.js */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import AdminEmptyState from '../ui/AdminEmptyState';
import { CHART, GRID_PROPS, AXIS_TICK, BAR_RADIUS, TOOLTIP_CLASS } from './chartTheme';

// View toggle definitions — order/labels unchanged from the original buttons.
const VIEWS = [
    { id: 'daily', label: 'Today' },
    { id: 'monthly', label: '30 Days' },
    { id: 'yearly', label: '12 Months' },
];

const TOGGLE_BASE = 'px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-lab transition-colors';
const TOGGLE_ACTIVE = 'bg-theme-accent/15 text-theme-accent border border-theme-accent/40';
const TOGGLE_INACTIVE = 'text-theme-text-muted hover:text-theme-text hover:bg-theme-bg-elevated border border-transparent';

const SessionsTrendChart = ({
    sessionsHourly,
    sessionsMonthly,
    sessionsYearly,
    totalSessionsToday,
    totalSessions30Days,
    totalSessionsYear
}) => {
    const [view, setView] = useState('monthly'); // 'daily', 'monthly', or 'yearly'

    // Process hourly data (today)
    const hourlyData = (sessionsHourly || []).map(d => ({
        ...d,
        displayTime: `${d.hour}:00`,
        shortLabel: d.hour % 3 === 0 ? `${d.hour}` : '', // Show every 3 hours on x-axis
    }));

    // Process monthly data (last 30 days)
    const monthlyData = (sessionsMonthly || []).map(d => ({
        ...d,
        displayDate: d.date ? format(parseISO(d.date), 'MMM d') : '',
        shortLabel: d.date ? format(parseISO(d.date), 'd') : '',
    }));

    // Process yearly data (last 12 months)
    const yearlyData = (sessionsYearly || []).map(d => ({
        ...d,
        displayMonth: d.month ? format(parseISO(`${d.month}-01`), 'MMM yyyy') : '',
        shortLabel: d.month ? format(parseISO(`${d.month}-01`), 'MMM') : '',
    }));

    // Select data based on view
    let data, totalSessions, periodLabel;
    switch (view) {
        case 'daily':
            data = hourlyData;
            totalSessions = totalSessionsToday || 0;
            periodLabel = 'sessions today';
            break;
        case 'yearly':
            data = yearlyData;
            totalSessions = totalSessionsYear || 0;
            periodLabel = 'sessions (12 months)';
            break;
        case 'monthly':
        default:
            data = monthlyData;
            totalSessions = totalSessions30Days || 0;
            periodLabel = 'sessions (30 days)';
            break;
    }

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const d = payload[0].payload;
            let label;
            if (view === 'daily') {
                label = d.displayTime;
            } else if (view === 'yearly') {
                label = d.displayMonth;
            } else {
                label = d.displayDate;
            }
            return (
                <div className={TOOLTIP_CLASS}>
                    <p className="text-theme-text mb-1">{label}</p>
                    <p className="text-theme-accent">
                        Sessions: <span className="tabular-nums">{d.sessions.toLocaleString()}</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    const hasData = data.some(d => d.sessions > 0);

    return (
        <div>
            {/* Toggle and Total */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-1">
                    {VIEWS.map(v => (
                        <button
                            key={v.id}
                            onClick={() => setView(v.id)}
                            className={`${TOGGLE_BASE} ${view === v.id ? TOGGLE_ACTIVE : TOGGLE_INACTIVE}`}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
                <div className="text-right">
                    <p className="text-2xl font-mono text-theme-text tabular-nums">{totalSessions.toLocaleString()}</p>
                    <p className="text-[0.6875rem] font-mono uppercase tracking-wider text-theme-text-muted">{periodLabel}</p>
                </div>
            </div>

            {/* Chart */}
            <div className="h-56">
                {!hasData ? (
                    <div className="h-full flex items-center justify-center">
                        <AdminEmptyState title="No session data available" />
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data}
                            margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                        >
                            <CartesianGrid {...GRID_PROPS} vertical={false} />
                            <XAxis
                                dataKey="shortLabel"
                                tick={{ ...AXIS_TICK, fontSize: 10 }}
                                tickLine={{ stroke: CHART.grid }}
                                axisLine={{ stroke: CHART.grid }}
                                interval={view === 'daily' ? 2 : view === 'monthly' ? 4 : 0}
                            />
                            <YAxis
                                tick={AXIS_TICK}
                                tickLine={{ stroke: CHART.grid }}
                                axisLine={{ stroke: CHART.grid }}
                                allowDecimals={false}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar
                                dataKey="sessions"
                                fill={CHART.accent}
                                radius={BAR_RADIUS}
                                maxBarSize={view === 'yearly' ? 40 : view === 'monthly' ? 20 : 15}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

SessionsTrendChart.propTypes = {
    sessionsHourly: PropTypes.arrayOf(PropTypes.shape({
        hour: PropTypes.number,
        sessions: PropTypes.number,
    })),
    sessionsMonthly: PropTypes.arrayOf(PropTypes.shape({
        date: PropTypes.string,
        sessions: PropTypes.number,
    })),
    sessionsYearly: PropTypes.arrayOf(PropTypes.shape({
        month: PropTypes.string,
        sessions: PropTypes.number,
    })),
    totalSessionsToday: PropTypes.number,
    totalSessions30Days: PropTypes.number,
    totalSessionsYear: PropTypes.number,
};

SessionsTrendChart.defaultProps = {
    sessionsHourly: [],
    sessionsMonthly: [],
    sessionsYearly: [],
    totalSessionsToday: 0,
    totalSessions30Days: 0,
    totalSessionsYear: 0,
};

export default SessionsTrendChart;

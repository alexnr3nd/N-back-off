/* src/components/admin/analytics/NBackDistributionChart.js */
import React from 'react';
import PropTypes from 'prop-types';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import AdminEmptyState from '../ui/AdminEmptyState';
import { CHART, GRID_PROPS, AXIS_TICK, BAR_RADIUS, TOOLTIP_CLASS, accentRamp } from './chartTheme';

const NBackDistributionChart = ({ distribution }) => {
    // Convert object to array format for Recharts
    const data = Object.entries(distribution || {})
        .map(([level, count]) => ({
            level: `${level}-Back`,
            levelNum: parseInt(level),
            count,
        }))
        .sort((a, b) => a.levelNum - b.levelNum);

    const totalUsers = data.reduce((sum, d) => sum + d.count, 0);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const d = payload[0].payload;
            const percentage = totalUsers > 0 ? ((d.count / totalUsers) * 100).toFixed(1) : 0;
            return (
                <div className={TOOLTIP_CLASS}>
                    <p className="text-theme-text">{d.level}</p>
                    <p className="text-theme-text-muted">
                        {d.count} user{d.count !== 1 ? 's' : ''} ({percentage}%)
                    </p>
                </div>
            );
        }
        return null;
    };

    if (totalUsers === 0) {
        return (
            <div className="h-64 flex items-center justify-center">
                <AdminEmptyState title="No user data available" />
            </div>
        );
    }

    return (
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                >
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis
                        dataKey="level"
                        tick={AXIS_TICK}
                        tickLine={{ stroke: CHART.grid }}
                        axisLine={{ stroke: CHART.grid }}
                    />
                    <YAxis
                        tick={AXIS_TICK}
                        tickLine={{ stroke: CHART.grid }}
                        axisLine={{ stroke: CHART.grid }}
                        allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={BAR_RADIUS}>
                        {data.map((entry, idx) => (
                            <Cell key={entry.levelNum} fill={accentRamp(idx, data.length)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

NBackDistributionChart.propTypes = {
    distribution: PropTypes.object,
};

NBackDistributionChart.defaultProps = {
    distribution: {},
};

export default NBackDistributionChart;

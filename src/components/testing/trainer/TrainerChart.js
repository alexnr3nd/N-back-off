/* src/components/testing/trainer/TrainerChart.js */
/**
 * Generic level-over-time chart for adaptive Trainers (shared chassis). Filters
 * the session history by the selected period and plots endLevel. The y-value
 * label + ceiling are parameterized per task via `formatLevel` / `maxLevel`
 * (e.g. "Level 6" for antisaccade, "Span 6" for digit span). Self-contained
 * (not the dual n-back DailyPerformanceChart) but styled to match the dashboard.
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const TICK = { fontSize: 11, fill: 'rgb(var(--color-text-muted))', fontFamily: 'Space Mono, monospace' };

const windowStartFor = (period) => {
    if (period === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
    if (period === 'week') return Date.now() - 7 * 86400000;
    if (period === 'month') return Date.now() - 30 * 86400000;
    return 0; // all
};

const makeTooltip = (formatLevel) => {
    const Tip = ({ active, payload }) => {
        if (!active || !payload || !payload.length) return null;
        const p = payload[0].payload;
        return (
            <div className="bg-theme-bg-elevated border border-theme-line px-3 py-2 text-xs font-mono">
                <div className="text-theme-text">{p.full}</div>
                <div className="text-theme-accent">{formatLevel(p.level)}</div>
                {p.acc != null && <div className="text-theme-text-muted">{Math.round(p.acc * 100)}% accuracy</div>}
            </div>
        );
    };
    Tip.propTypes = { active: PropTypes.bool, payload: PropTypes.array };
    return Tip;
};

const TrainerChart = ({ sessions, period, formatLevel, maxLevel }) => {
    const data = useMemo(() => {
        if (!Array.isArray(sessions)) return [];
        const start = windowStartFor(period);
        const chronological = sessions
            .filter((s) => s.timestamp && s.endLevel != null && new Date(s.timestamp).getTime() >= start)
            .slice()
            .reverse(); // server returns newest-first -> chronological

        if (period === 'today') {
            return chronological.map((s, i) => ({
                name: String(i + 1),
                full: `Session ${i + 1} · ${new Date(s.timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
                level: s.endLevel,
                acc: s.accuracy,
            }));
        }

        const byDay = new Map();
        for (const s of chronological) {
            const d = new Date(s.timestamp);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (!byDay.has(key)) byDay.set(key, { date: d, levelSum: 0, accSum: 0, accN: 0, count: 0 });
            const e = byDay.get(key);
            e.levelSum += s.endLevel;
            if (typeof s.accuracy === 'number') { e.accSum += s.accuracy; e.accN += 1; }
            e.count += 1;
        }
        return Array.from(byDay.values()).map((e) => ({
            name: e.date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
            full: `${e.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${e.count} session${e.count !== 1 ? 's' : ''}`,
            level: Math.round((e.levelSum / e.count) * 10) / 10,
            acc: e.accN ? e.accSum / e.accN : null,
        }));
    }, [sessions, period]);

    const Tip = useMemo(() => makeTooltip(formatLevel), [formatLevel]);

    if (data.length === 0) {
        return (
            <div className="h-56 flex items-center justify-center text-center">
                <p className="text-xs font-mono text-theme-text-muted">No sessions in this range yet.</p>
            </div>
        );
    }

    return (
        <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-line))" strokeOpacity={0.5} />
                    <XAxis dataKey="name" tick={TICK} stroke="rgb(var(--color-line))" interval="preserveStartEnd" minTickGap={24} />
                    <YAxis
                        tick={TICK}
                        stroke="rgb(var(--color-line))"
                        width={38}
                        allowDecimals={false}
                        domain={[(min) => Math.max(0, Math.floor(min) - 1), (max) => Math.min(maxLevel, Math.ceil(max) + 1)]}
                    />
                    <Tooltip content={<Tip />} cursor={{ stroke: 'rgb(var(--color-accent))', strokeOpacity: 0.3 }} />
                    <Line
                        type="monotone"
                        dataKey="level"
                        stroke="rgb(var(--color-accent))"
                        strokeWidth={2}
                        dot={{ r: 2.5, strokeWidth: 1, fill: 'rgb(var(--color-bg-secondary))', stroke: 'rgb(var(--color-accent))' }}
                        activeDot={{ r: 4, fill: 'rgb(var(--color-accent))' }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

TrainerChart.propTypes = {
    sessions: PropTypes.array,
    period: PropTypes.string,
    formatLevel: PropTypes.func,
    maxLevel: PropTypes.number,
};
TrainerChart.defaultProps = {
    formatLevel: (n) => `Level ${n}`,
    maxLevel: 99,
};

export default TrainerChart;

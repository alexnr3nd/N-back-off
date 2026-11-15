/* src/components/insights/consistency/CadenceHeroCard.js
 *
 * Inspired by the lab-aesthetic "cadence specimen" design: big
 * sessions/week headline + side-stat rail + weekly rhythm bars +
 * italic-serif interpretation strip. Replaces the earlier tiny
 * "This Week" card with a richer, information-dense surface.
 */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCircle, faFire, faInfoCircle, faStopwatch,
    faCalendarCheck, faTrophy,
} from '@fortawesome/free-solid-svg-icons';
import { TIER } from './consistencyDerivations';

const DeltaPill = ({ value, unit = '%' }) => {
    if (value === null || value === undefined) {
        return <span className="text-[0.625rem] font-mono text-theme-text-muted">—</span>;
    }
    const tone = value > 0
        ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5'
        : value < 0
            ? 'text-red-400 border-red-400/30 bg-red-400/5'
            : 'text-theme-text-muted border-theme-line bg-theme-bg-elevated';
    const sign = value > 0 ? '+' : '';
    return (
        <span className={`text-[0.625rem] font-mono px-1.5 py-0.5 border rounded-sm ${tone}`}>
            {sign}{value}{unit}
        </span>
    );
};

const SideRow = ({ label, value, unit, delta }) => (
    <div className="flex items-baseline gap-2 border-b border-dashed border-theme-line/50 pb-2 last:border-0 last:pb-0">
        <span className="text-xs text-theme-text-secondary flex-1">{label}</span>
        <span className="text-sm font-mono font-bold text-theme-text">
            {value}
            {unit && <span className="text-xs text-theme-text-muted font-normal ml-0.5">{unit}</span>}
        </span>
        {delta}
    </div>
);

const formatPerWeek = (n) => {
    if (!Number.isFinite(n) || n <= 0) return '0';
    if (n < 10) return n.toFixed(1);
    return Math.round(n).toString();
};

const WeeklyBarStrip = ({ weekStrip, targetSessions = 3 }) => {
    const max = Math.max(
        targetSessions,
        ...weekStrip.map(d => d.sessions),
    );
    return (
        <div>
            <div className="flex items-baseline justify-between mb-2">
                <span className="text-[0.625rem] font-mono uppercase tracking-wider text-theme-text-muted">
                    This week · sessions
                </span>
                <span className="text-[0.625rem] font-mono uppercase tracking-wider text-theme-text-muted">
                    Mon → Sun
                </span>
            </div>
            <div className="flex gap-1 items-end">
                {weekStrip.map((day) => {
                    const h = day.isFuture
                        ? 0
                        : Math.min(100, max > 0 ? (day.sessions / max) * 100 : 0);
                    const emptyPast = !day.isFuture && day.sessions === 0;
                    return (
                        <div key={day.dayKey} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                            <span className={`text-[0.625rem] font-mono font-bold ${day.isToday ? 'text-theme-accent' : 'text-theme-text-secondary'}`}>
                                {emptyPast ? '—' : day.isFuture ? '' : day.sessions}
                            </span>
                            <div
                                className={[
                                    'w-full h-16 border flex items-end p-[3px] overflow-hidden rounded-sm',
                                    day.isToday
                                        ? 'border-theme-accent shadow-[0_0_12px_rgba(228,184,92,0.15)]'
                                        : 'border-theme-line',
                                    'bg-theme-bg',
                                ].join(' ')}
                            >
                                <div
                                    className={`w-full rounded-sm ${emptyPast ? 'bg-transparent' : 'bg-theme-accent'}`}
                                    style={{ height: `${h}%` }}
                                />
                            </div>
                            <span className="text-[0.5625rem] font-mono uppercase tracking-wider text-theme-text-muted">
                                {day.dayLabel}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const interpretationFor = (cadence, currentWeek) => {
    const spw = cadence.sessionsPerWeek || 0;
    if (cadence.last30Count === 0) {
        return {
            head: 'No sessions in the last 30 days.',
            body: 'Start a streak this week — training 3 different days hits the Consistent tier.',
        };
    }
    if (spw >= 5) {
        return {
            head: 'You train more days than you rest.',
            body: `A ${formatPerWeek(spw)}/wk cadence sits in the top tier — steady volume at this level is the strongest predictor of sustained d′ gain.`,
        };
    }
    if (spw >= 3) {
        return {
            head: 'You have a steady rhythm.',
            body: `At ${formatPerWeek(spw)}/wk you're past the inflection point for progress. Pushing toward 5/wk would unlock the top cadence tier.`,
        };
    }
    return {
        head: 'Frequency matters more than duration.',
        body: `At ${formatPerWeek(spw)}/wk, adding a single extra day per week would move you into the Consistent tier.`,
    };
};

const tierLabel = (tier) => {
    if (tier === TIER.ALL_IN) return 'All-In';
    if (tier === TIER.CONSISTENT) return 'Consistent';
    if (tier === TIER.ACTIVE) return 'Active';
    return 'Off-tier';
};

const CadenceHeroCard = ({ cadence, currentWeek, streak, weekStrip }) => {
    const tier = currentWeek?.tier || TIER.NONE;
    const interp = interpretationFor(cadence, currentWeek);

    return (
        <div className="specimen-card p-4 sm:p-5 border-l-[3px] border-l-theme-accent">
            <div className="flex items-baseline justify-between pb-3 mb-4 border-b border-theme-line">
                <span className="text-[0.625rem] font-mono uppercase tracking-wider text-theme-text-muted">
                    Training cadence · last 30 days
                </span>
                <span className="text-[0.625rem] font-mono uppercase tracking-wider text-theme-accent">
                    <FontAwesomeIcon icon={faCircle} className="mr-1 h-1.5 w-1.5" />
                    {tierLabel(tier)}
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[auto_1px_1fr] gap-5 sm:gap-6 items-stretch">
                <div className="flex flex-col justify-center gap-1">
                    <span className="text-[0.625rem] font-mono uppercase tracking-wider text-theme-text-muted">
                        Weekly frequency
                    </span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-5xl sm:text-6xl font-mono font-bold text-theme-accent leading-none tracking-tight">
                            {formatPerWeek(cadence.sessionsPerWeek)}
                        </span>
                        <span className="text-base text-theme-text-muted font-normal ml-1">
                            sessions/wk
                        </span>
                    </div>
                    <div className="text-xs font-mono text-theme-text-secondary mt-1">
                        {cadence.last30Count} session{cadence.last30Count === 1 ? '' : 's'} · last 30d
                    </div>
                </div>

                <div className="hidden sm:block bg-theme-line w-px" />

                <div className="flex flex-col justify-center gap-2">
                    <SideRow
                        label="Current streak"
                        value={streak?.currentStreakWeeks || 0}
                        unit="wk"
                        delta={<DeltaPill value={cadence.cadenceDeltaPct} />}
                    />
                    <SideRow
                        label="Days trained this year"
                        value={cadence.daysTrainedThisYear}
                        unit="d"
                    />
                    <SideRow
                        label="Sessions this week"
                        value={cadence.sessionsThisWeek || 0}
                        delta={cadence.sessionsWeekDelta === null ? null : (
                            <DeltaPill value={cadence.sessionsWeekDelta} />
                        )}
                    />
                    <SideRow
                        label="Longest streak"
                        value={streak?.longestStreakWeeks || 0}
                        unit="wk"
                    />
                </div>
            </div>

            <div className="mt-5">
                <WeeklyBarStrip weekStrip={weekStrip || []} />
            </div>

            <div className="mt-4 p-3 border border-theme-accent/20 border-l-2 border-l-theme-accent bg-theme-accent/5 rounded-sm flex items-start gap-3">
                <FontAwesomeIcon icon={faInfoCircle} className="h-3.5 w-3.5 text-theme-accent mt-0.5 flex-shrink-0" />
                <p className="text-sm italic font-serif text-theme-text leading-snug m-0">
                    {interp.head}{' '}
                    <span className="not-italic">
                        {interp.body}
                    </span>
                </p>
            </div>
        </div>
    );
};

export default CadenceHeroCard;

/* src/components/insights/consistency/LifetimeLedgerCard.js
 *
 * Combined lifetime totals + community-percentile footer strip
 * (previously split across LifetimeLedgerCard + CommunityConsistencyCard).
 */

import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faClock, faFire, faLayerGroup, faUsers } from '@fortawesome/free-solid-svg-icons';
import { functions, httpsCallable } from '../../../firebaseConfig';

const getCommunityActivityFn = httpsCallable(functions, 'getCommunityActivity');

const PERIODS = [
    { key: 'last7d',  label: '7d' },
    { key: 'last30d', label: '30d' },
    { key: 'allTime', label: 'All time' },
];

const formatDuration = (ms) => {
    if (!ms || ms < 0) return { value: '0', unit: 'hrs' };
    const hours = ms / (1000 * 60 * 60);
    if (hours < 1) {
        return { value: (ms / (1000 * 60)).toFixed(0), unit: 'min' };
    }
    return {
        value: hours < 10 ? hours.toFixed(1) : Math.round(hours).toLocaleString(),
        unit: 'hrs',
    };
};

const formatJoined = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
};

const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Matches existing CommunityActivityPercentile logic (strict `<`).
const computePercentile = (distribution, userCount) => {
    const counts = Object.entries(distribution || {})
        .map(([k, v]) => [Number(k), v])
        .sort((a, b) => a[0] - b[0]);
    let totalUsers = 0, below = 0;
    for (const [c, n] of counts) {
        totalUsers += n;
        if (c < userCount) below += n;
    }
    if (totalUsers === 0) return null;
    return Math.max(1, Math.min(99, Math.round((below / totalUsers) * 100)));
};

const Stat = ({ icon, label, value, suffix }) => (
    <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-theme-text-muted">
            <FontAwesomeIcon icon={icon} className="h-3 w-3" />
            <span className="text-[0.625rem] font-mono uppercase tracking-wider">{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-serif text-theme-text">{value}</span>
            {suffix && <span className="text-xs font-mono text-theme-text-muted">{suffix}</span>}
        </div>
    </div>
);

const LifetimeLedgerCard = ({ lifetimeSessions, lifetimeDurationMs, totalConsistentWeeks, joinedAt }) => {
    const [period, setPeriod] = useState('last30d');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getCommunityActivityFn({})
            .then(res => { if (!cancelled) setData(res.data); })
            .catch(err => console.error('getCommunityActivity failed', err))
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const userCount = data?.userCounts?.[period] ?? 0;
    const percentile = data ? computePercentile(data.distributions?.[period], userCount) : null;

    return (
        <div className="specimen-card p-4">
            <div className="mb-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">
                    Lifetime Ledger
                </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat icon={faLayerGroup} label="Sessions" value={(lifetimeSessions ?? 0).toLocaleString()} />
                <Stat icon={faClock} label="Time Trained" value={formatDuration(lifetimeDurationMs).value} suffix={formatDuration(lifetimeDurationMs).unit} />
                <Stat icon={faFire} label="Consistent Weeks" value={(totalConsistentWeeks ?? 0).toLocaleString()} />
                <Stat icon={faCalendarDays} label="Joined" value={formatJoined(joinedAt)} />
            </div>

            {/* Community percentile strip — hidden until we have enough
                active users that the percentile reads as a badge rather
                than as a sign of an empty room. Re-enable when comfortable.
            <div className="mt-4 pt-3 border-t border-theme-line">
                <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[0.625rem] font-mono uppercase tracking-wider text-theme-text-muted">
                        <FontAwesomeIcon icon={faUsers} className="mr-2" />
                        Vs community
                    </span>
                    <div className="flex gap-1">
                        {PERIODS.map(p => (
                            <button
                                key={p.key}
                                onClick={() => setPeriod(p.key)}
                                className={[
                                    'text-[0.625rem] font-mono uppercase tracking-wider px-2 py-0.5 border',
                                    p.key === period
                                        ? 'border-theme-accent text-theme-accent bg-theme-accent/10'
                                        : 'border-theme-line text-theme-text-muted hover:text-theme-text',
                                ].join(' ')}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
                {loading ? (
                    <div className="text-xs font-mono text-theme-text-muted">Loading…</div>
                ) : percentile == null ? (
                    <div className="text-xs font-mono text-theme-text-muted">
                        Not enough community data yet.
                    </div>
                ) : (
                    <div className="text-sm text-theme-text">
                        You train more consistently than{' '}
                        <span className="font-serif text-xl text-theme-accent">{percentile}%</span>{' '}
                        of active users ({ordinal(percentile)} percentile).
                    </div>
                )}
            </div>
            */}
        </div>
    );
};

export default LifetimeLedgerCard;

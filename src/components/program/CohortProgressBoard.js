/* src/components/program/CohortProgressBoard.js */

/**
 * Cohort progress board — the "mission control" view.
 * Shows each member's progress as a row in a living experiment dashboard.
 * Real-time updates via CohortContext's onSnapshot listeners.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBed, faMinus, faFire, faPause, faChevronUp, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { useCohort } from '../../contexts/CohortContext';
import { useUser } from '../../contexts/UserContext';
import { formatCombinedDifficulty } from '../../contexts/gameHelpers';
import AdminBadge from './AdminBadge';

// Deterministic color for avatar based on name
const AVATAR_COLORS = [
    'bg-blue-500/20 text-blue-400',
    'bg-emerald-500/20 text-emerald-400',
    'bg-amber-500/20 text-amber-400',
    'bg-rose-500/20 text-rose-400',
    'bg-violet-500/20 text-violet-400',
    'bg-cyan-500/20 text-cyan-400',
    'bg-orange-500/20 text-orange-400',
    'bg-teal-500/20 text-teal-400',
    'bg-pink-500/20 text-pink-400',
    'bg-indigo-500/20 text-indigo-400',
    'bg-lime-500/20 text-lime-400',
    'bg-fuchsia-500/20 text-fuchsia-400',
];

function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
        hash = ((hash << 5) - hash) + name.charCodeAt(i);
        hash |= 0;
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Derive presence status from member's cohortPresence field
const getPresenceStatus = (member, now) => {
    const cp = member.cohortPresence;
    if (!cp?.lastSeen) return 'offline';
    const lastSeenMs = cp.lastSeen?.toMillis?.() || 0;
    const ageMs = now - lastSeenMs;
    if (ageMs > 15 * 60 * 1000) return 'offline';
    // Paused games get a longer threshold (5 min) since background tab timers are throttled
    const isPausedActivity = cp.activity === 'paused';
    const activeThreshold = isPausedActivity ? 5 * 60 * 1000 : 3 * 60 * 1000;
    if (ageMs > activeThreshold) return 'idle';
    if (cp.activity === 'playing' || cp.activity === 'paused' || cp.activity === 'preparing') return 'playing';
    return 'online';
};

const getGameModeLabel = (mode) => {
    switch (mode) {
        case 'triple': return 'Tri ';
        case 'quad': return 'Quad ';
        default: return '';
    }
};

const CohortProgressBoard = ({ isForming } = {}) => {
    const { cohortMembers, programDay, todaysPrescription, programData } = useCohort();
    const { userId } = useUser();

    const isRestDay = todaysPrescription?.type === 'rest';
    const dayKey = String(programDay);

    const [sortField, setSortField] = useState('today');
    const [sortDirection, setSortDirection] = useState('desc');

    // Refresh presence age every 30s so online/idle/offline transitions render
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(interval);
    }, []);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const getSortIcon = (field) => {
        if (sortField !== field) {
            return <FontAwesomeIcon icon={faChevronDown} className="ml-1 text-theme-text-muted opacity-50 h-2.5 w-2.5" />;
        }
        return sortDirection === 'asc'
            ? <FontAwesomeIcon icon={faChevronUp} className="ml-1 text-theme-accent h-2.5 w-2.5" />
            : <FontAwesomeIcon icon={faChevronDown} className="ml-1 text-theme-accent h-2.5 w-2.5" />;
    };

    // Compute effective streak — reset to 0 if any training day was missed since last completion
    const getEffectiveStreak = useCallback((member) => {
        const stored = member.programStreak || 0;
        if (stored === 0 || programDay < 2) return stored;
        const prescriptions = programData?.dailyPrescriptions;
        if (!prescriptions) return stored;

        // Walk backwards from yesterday — today doesn't break the streak
        for (let d = programDay - 1; d >= 1; d--) {
            const prescription = prescriptions.find(p => p.day === d);
            if (prescription?.type !== 'training') continue;
            if (member.dailyProgress?.[String(d)]?.completed) return stored;
            return 0;
        }
        return stored;
    }, [programDay, programData?.dailyPrescriptions]);

    const sortedMembers = useMemo(() => {
        const active = cohortMembers.filter(m => m.status === 'active' || m.status === 'completed');
        return active.sort((a, b) => {
            let cmp = 0;
            if (sortField === 'member') {
                cmp = (a.odivUsername || '').localeCompare(b.odivUsername || '');
            } else if (sortField === 'today') {
                const aToday = a.dailyProgress?.[dayKey]?.sessionsPlayed || 0;
                const bToday = b.dailyProgress?.[dayKey]?.sessionsPlayed || 0;
                cmp = aToday - bToday;
            } else if (sortField === 'total') {
                const aTotal = Object.values(a.dailyProgress || {}).reduce((s, d) => s + (d.sessionsPlayed || 0), 0);
                const bTotal = Object.values(b.dailyProgress || {}).reduce((s, d) => s + (d.sessionsPlayed || 0), 0);
                cmp = aTotal - bTotal;
            } else if (sortField === 'streak') {
                cmp = getEffectiveStreak(a) - getEffectiveStreak(b);
            } else if (sortField === 'progress') {
                cmp = (a.daysCompleted || 0) - (b.daysCompleted || 0);
            }
            // Apply direction
            if (cmp !== 0) return sortDirection === 'asc' ? cmp : -cmp;
            // Secondary: alphabetical by name
            return (a.odivUsername || '').localeCompare(b.odivUsername || '');
        });
    }, [cohortMembers, sortField, sortDirection, dayKey, getEffectiveStreak]);

    return (
        <div>
            {/* Board header */}
            <div className={`hidden sm:grid gap-4 px-3 py-2 text-xs font-mono uppercase tracking-wider text-theme-text-muted border-b border-theme-line mb-1 ${
                isForming ? 'sm:grid-cols-[1fr,auto]' : 'sm:grid-cols-[1fr,auto,auto,auto,auto]'
            }`}>
                {isForming ? (
                    <>
                        <span>Member</span>
                        <span className="text-center w-20">Status</span>
                    </>
                ) : (
                    <>
                        <button onClick={() => handleSort('member')} className="text-left cursor-pointer select-none hover:text-theme-text flex items-center" aria-sort={sortField === 'member' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                            Member{getSortIcon('member')}
                        </button>
                        <button onClick={() => handleSort('today')} className="text-center w-20 cursor-pointer select-none hover:text-theme-text flex items-center justify-center" aria-sort={sortField === 'today' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                            Today{getSortIcon('today')}
                        </button>
                        <button onClick={() => handleSort('total')} className="text-center w-12 cursor-pointer select-none hover:text-theme-text flex items-center justify-center" aria-sort={sortField === 'total' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                            Total{getSortIcon('total')}
                        </button>
                        <button onClick={() => handleSort('streak')} className="text-center w-16 cursor-pointer select-none hover:text-theme-text flex items-center justify-center" aria-sort={sortField === 'streak' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                            Streak{getSortIcon('streak')}
                        </button>
                        <button onClick={() => handleSort('progress')} className="text-center w-20 cursor-pointer select-none hover:text-theme-text flex items-center justify-center" aria-sort={sortField === 'progress' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                            Days Trained{getSortIcon('progress')}
                        </button>
                    </>
                )}
            </div>

            {/* Member rows */}
            <div className="space-y-1">
                {sortedMembers.map(member => {
                    const isCurrentUser = member.odivId === userId;
                    const dayProgress = member.dailyProgress?.[dayKey];
                    const sessionsPlayed = dayProgress?.sessionsPlayed || 0;
                    const dayCompleted = dayProgress?.completed || false;
                    const streak = getEffectiveStreak(member);
                    const daysCompleted = member.daysCompleted || 0;
                    const totalSessions = Object.values(member.dailyProgress || {})
                        .reduce((sum, day) => sum + (day.sessionsPlayed || 0), 0);
                    // Today's status
                    let todayStatus;
                    if (isRestDay) {
                        todayStatus = sessionsPlayed > 0
                            ? { icon: null, color: 'text-theme-text-muted', label: `${sessionsPlayed}` }
                            : { icon: faBed, color: 'text-theme-text-muted', label: 'Rest' };
                    } else if (dayCompleted) {
                        const target = todaysPrescription?.sessionTarget || '?';
                        todayStatus = { icon: null, color: 'text-theme-text', label: `${sessionsPlayed}/${target}` };
                    } else if (sessionsPlayed > 0) {
                        todayStatus = { icon: null, color: 'text-theme-accent', label: `${sessionsPlayed}/${todaysPrescription?.sessionTarget || '?'}` };
                    } else {
                        todayStatus = { icon: faMinus, color: 'text-theme-text-muted/50', label: '—' };
                    }

                    // Calculate total training days in program
                    const totalTrainingDays = programData?.dailyPrescriptions
                        ? programData.dailyPrescriptions.filter(p => p.type === 'training').length
                        : 21;

                    return (
                        <div
                            key={member.odivId}
                            className={`grid gap-2 sm:gap-4 items-center px-3 py-2.5 rounded transition-colors ${
                                isForming
                                    ? 'grid-cols-[1fr,auto] sm:grid-cols-[1fr,auto]'
                                    : 'grid-cols-[1fr,auto] sm:grid-cols-[1fr,auto,auto,auto,auto]'
                            } ${
                                isCurrentUser
                                    ? 'border border-theme-accent/20 bg-theme-accent/5'
                                    : 'border border-transparent hover:bg-theme-bg-hover'
                            }`}
                        >
                            {/* Member info */}
                            <div className="flex items-center gap-2.5 min-w-0">
                                {/* Avatar with presence dot */}
                                {(() => {
                                    const presenceStatus = getPresenceStatus(member, now);
                                    return (
                                        <div className="relative flex-shrink-0">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${getAvatarColor(member.odivUsername)}`}>
                                                {(member.odivUsername || '?')[0].toUpperCase()}
                                            </div>
                                            {presenceStatus !== 'offline' && (
                                                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-theme-bg-secondary ${
                                                    presenceStatus === 'idle' ? 'bg-amber-500'
                                                    : (presenceStatus === 'playing' && member.cohortPresence?.activity === 'paused') ? 'bg-yellow-500'
                                                    : 'bg-green-500'
                                                }`} />
                                            )}
                                        </div>
                                    );
                                })()}
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className={`text-sm truncate ${isCurrentUser ? 'font-medium text-theme-text' : 'text-theme-text-secondary'}`}>
                                            {member.odivUsername || 'Unknown'}
                                        </p>
{member.isAdmin && <AdminBadge />}
                                    </div>
                                    {/* Active game session display */}
                                    {getPresenceStatus(member, now) === 'playing' && member.cohortPresence?.gameProgress && (() => {
                                        const gp = member.cohortPresence.gameProgress;
                                        const isPaused = member.cohortPresence.activity === 'paused';
                                        return (
                                            <span className={`text-xs font-mono ${isPaused ? 'text-yellow-500' : 'text-theme-accent'}`}>
                                                {isPaused && <><FontAwesomeIcon icon={faPause} className="h-2.5 w-2.5 mr-1" />Paused &mdash; </>}
                                                {getGameModeLabel(gp.gameMode)}{formatCombinedDifficulty(gp.nBack, gp.difficulty)} &bull; Trial {gp.currentTrial}/{gp.totalTrials}
                                            </span>
                                        );
                                    })()}
                                    {/* Mobile-only stats row (hidden during forming) */}
                                    {!isForming && (
                                        <div className="flex items-center gap-3 sm:hidden text-xs text-theme-text-muted mt-0.5">
                                            {streak > 0 && (
                                                <span className="inline-flex items-center gap-0.5">
                                                    <FontAwesomeIcon icon={faFire} className="h-2.5 w-2.5 text-orange-400" />
                                                    {streak}d
                                                </span>
                                            )}
                                            <span>{totalSessions} sess</span>
                                            <span>{daysCompleted}/{totalTrainingDays}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {isForming ? (
                                /* Forming: simple "Joined" badge */
                                <div className="text-center w-auto sm:w-20">
                                    <span className="text-xs font-mono text-green-500">Joined</span>
                                </div>
                            ) : (
                                <>
                                    {/* Today's status */}
                                    <div className={`text-center w-auto sm:w-20 text-sm font-mono ${todayStatus.color}`}>
                                        {todayStatus.icon ? (
                                            <FontAwesomeIcon icon={todayStatus.icon} className="h-3.5 w-3.5" />
                                        ) : (
                                            <span className="text-xs">{todayStatus.label}</span>
                                        )}
                                    </div>

                                    {/* Total sessions (desktop) */}
                                    <div className="hidden sm:flex items-center justify-center w-12">
                                        <span className="text-xs font-mono text-theme-text-muted tabular-nums">
                                            {totalSessions}
                                        </span>
                                    </div>

                                    {/* Streak (desktop) */}
                                    <div className="hidden sm:flex items-center justify-center w-16">
                                        {streak > 0 ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-mono text-orange-400">
                                                <FontAwesomeIcon icon={faFire} className="h-3 w-3" />
                                                {streak}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-theme-text-muted/50">—</span>
                                        )}
                                    </div>

                                    {/* Progress (desktop) */}
                                    <div className="hidden sm:flex items-center justify-center w-20">
                                        <div className="flex items-center gap-2">
                                            <div className="w-10 h-1.5 bg-theme-line rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-theme-accent rounded-full transition-all duration-500"
                                                    style={{ width: `${totalTrainingDays > 0 ? (daysCompleted / totalTrainingDays) * 100 : 0}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-mono text-theme-text-muted tabular-nums">
                                                {daysCompleted}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Left members */}
            {cohortMembers.some(m => m.status === 'left') && (
                <div className="mt-4 pt-3 border-t border-theme-line">
                    <p className="text-xs text-theme-text-muted/50 px-3">
                        {cohortMembers.filter(m => m.status === 'left').length} member(s) left the cohort
                    </p>
                </div>
            )}
        </div>
    );
};

export default CohortProgressBoard;

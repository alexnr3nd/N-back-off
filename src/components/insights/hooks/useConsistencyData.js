/* src/components/insights/hooks/useConsistencyData.js
 *
 * Fetches dailyStats via getConsistencyData callable, module-caches the
 * payload, and runs memoized derivations to produce the shape consumed
 * by the Consistency section cards.
 *
 * Cache-bust triggers:
 *   - user changes (uid mismatch)
 *   - newest session's timestamp advances (user completed a session in-app,
 *     robust to the 60-day window sliding so that count-based watermarks miss)
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { startOfWeek, format, addDays } from 'date-fns';
import { useUser } from '../../../contexts/UserContext';
import { functions, httpsCallable } from '../../../firebaseConfig';
import {
    groupByWeek, fillMissingWeeks, computeStreak,
    calendarCells, lifetimeFromDailyStats,
} from '../consistency/consistencyDerivations';

const MS_DAY = 24 * 60 * 60 * 1000;
const WEEK_OPTS = { weekStartsOn: 1 };

// Session timestamp (ms) — mirrors the fallback chain used elsewhere.
const sessionMs = (s) => {
    const v = s?.timestamp || s?.recordedAt || s?.date;
    if (!v) return 0;
    if (typeof v === 'number') return v;
    if (v.toMillis) return v.toMillis();
    return new Date(v).getTime();
};

// Sessions + totalMs within a rolling window ending `now`.
const windowStats = (sessions, windowDays, now) => {
    const cutoff = now - windowDays * MS_DAY;
    let count = 0, totalMs = 0;
    for (const s of (sessions || [])) {
        const ts = sessionMs(s);
        if (ts >= cutoff && ts <= now) {
            count += 1;
            const d = s?.durationMs ?? s?.duration ?? 0;
            if (typeof d === 'number') totalMs += d;
        }
    }
    return { count, totalMs };
};

// Distinct training days within the current calendar year (YYYY prefix on date).
const daysTrainedThisYear = (dailyStats, now) => {
    const year = new Date(now).getFullYear().toString();
    const seen = new Set();
    for (const d of (dailyStats || [])) {
        if (d?.date?.startsWith(year) && (d.sessionCount || 0) > 0) seen.add(d.date);
    }
    return seen.size;
};

// Session count per day for the current Mon-Sun week (from dailyStats).
const thisWeekSessionsByDay = (dailyStats, now) => {
    const weekStart = startOfWeek(new Date(now), WEEK_OPTS);
    const byDate = new Map();
    for (const d of (dailyStats || [])) {
        if (!d.date) continue;
        byDate.set(d.date, (byDate.get(d.date) || 0) + (d.sessionCount || 0));
    }
    return Array.from({ length: 7 }).map((_, i) => {
        const dayDate = addDays(weekStart, i);
        const key = format(dayDate, 'yyyy-MM-dd');
        const sessions = byDate.get(key) || 0;
        return {
            dayKey: key,
            dayLabel: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
            sessions,
            isToday: key === format(new Date(now), 'yyyy-MM-dd'),
            isFuture: dayDate > new Date(now),
        };
    });
};

// Sum sessions across a Mon..Sun week offset from `now` (0 = this week, -1 = last).
const sessionsForWeek = (dailyStats, now, weekOffset = 0) => {
    const baseStart = startOfWeek(new Date(now), WEEK_OPTS);
    const targetStart = addDays(baseStart, weekOffset * 7);
    const targetEnd = addDays(targetStart, 6);
    let count = 0;
    for (const d of (dailyStats || [])) {
        if (!d.date) continue;
        const dayDate = new Date(d.date + 'T00:00:00');
        if (dayDate >= targetStart && dayDate <= targetEnd) {
            count += d.sessionCount || 0;
        }
    }
    return count;
};

// 365-day calendar footer stats — counts distinct trained days + total ms.
const calendarFooterStats = (dailyStats, daysBack, now) => {
    const cutoffKey = format(new Date(now - (daysBack - 1) * MS_DAY), 'yyyy-MM-dd');
    const todayKey = format(new Date(now), 'yyyy-MM-dd');
    const trainedDays = new Set();
    let totalMs = 0;
    let peakDays = 0;
    const peakByDate = new Map();
    for (const d of (dailyStats || [])) {
        if (!d.date || d.date < cutoffKey || d.date > todayKey) continue;
        if ((d.sessionCount || 0) > 0) trainedDays.add(d.date);
        totalMs += d.totalDurationMs || 0;
        const prev = peakByDate.get(d.date) || 0;
        peakByDate.set(d.date, Math.max(prev, d.sessionCount || 0));
    }
    for (const n of peakByDate.values()) {
        if (n >= 3) peakDays += 1; // "peak" = 3+ sessions on that day
    }
    return {
        activeDays: trainedDays.size,
        activeRate: Math.round((trainedDays.size / daysBack) * 100),
        peakDays,
        totalHours: Math.round(totalMs / (1000 * 60 * 60)),
    };
};

const getConsistencyDataFn = httpsCallable(functions, 'getConsistencyData');

// Module-level cache survives navigation within a session.
let _cache = null;  // { uid, watermarkMs, dailyStats, computedAt }

// Robust watermark: newest session's timestamp in ms. Monotonic (new sessions
// only push it forward), so it reliably fires a refetch even when the 60-day
// activeSessions window slides and length stays constant.
const newestSessionMs = (sessions) => {
    let max = 0;
    for (const s of (sessions || [])) {
        const t = sessionMs(s);
        if (t > max) max = t;
    }
    return max;
};

export function useConsistencyData() {
    const { userId, activeSessions, totalSessions, userData } = useUser();
    const uid = userId || null;
    const watermarkMs = newestSessionMs(activeSessions);

    const [state, setState] = useState({
        loading: true,
        error: null,
        dailyStats: _cache?.uid === uid ? _cache.dailyStats : [],
        computedAt: _cache?.uid === uid ? _cache.computedAt : 0,
    });

    const fetchData = useCallback(async () => {
        if (!uid) return;
        setState(s => ({ ...s, loading: true, error: null }));
        try {
            const res = await getConsistencyDataFn({});
            const { dailyStats = [], computedAt = Date.now() } = res.data || {};
            _cache = { uid, watermarkMs, dailyStats, computedAt };
            setState({ loading: false, error: null, dailyStats, computedAt });
        } catch (err) {
            console.error('[useConsistencyData] fetch failed', err);
            setState(s => ({ ...s, loading: false, error: err.message || 'Failed to load' }));
        }
    }, [uid, watermarkMs]);

    // Initial fetch or user change or new-session cache-bust.
    useEffect(() => {
        if (!uid) return;
        const cacheStale = !_cache
            || _cache.uid !== uid
            || _cache.watermarkMs !== watermarkMs;
        if (cacheStale) fetchData();
        else setState({
            loading: false, error: null,
            dailyStats: _cache.dailyStats, computedAt: _cache.computedAt,
        });
    }, [uid, watermarkMs, fetchData]);

    // Derivations — memoized on dailyStats identity + computedAt.
    // NOTE: lifetime hours is computed from dailyStats (single source of truth).
    // The aggregatedStats/allTime/totalDurationMs Firestore field exists
    // server-side but is NOT exposed on UserContext, and replicating it here
    // would add a second code path with no user-visible benefit.
    const derived = useMemo(() => {
        const now = Date.now();
        const weeks = groupByWeek(state.dailyStats);
        const filled = fillMissingWeeks(weeks);
        const streak = computeStreak(filled);
        const calendar = calendarCells(state.dailyStats, 365);
        const lifetimeAgg = lifetimeFromDailyStats(state.dailyStats);

        const lifetimeSessions = totalSessions ?? lifetimeAgg.sessions;
        const lifetimeDurationMs = lifetimeAgg.durationMs;

        const currentWeek = streak.weeks[streak.weeks.length - 1] || null;

        // Cadence over last 30 days (vs prior 30d for delta). Uses activeSessions
        // which is the 60-day sliding window already in UserContext.
        const last30 = windowStats(activeSessions, 30, now);
        const prior30 = windowStats(activeSessions, 60, now - 30 * MS_DAY);
        const sessionsPerWeek = last30.count / (30 / 7);
        const priorSessionsPerWeek = prior30.count / (30 / 7);
        const cadenceDeltaPct = priorSessionsPerWeek > 0
            ? Math.round(((sessionsPerWeek - priorSessionsPerWeek) / priorSessionsPerWeek) * 100)
            : null;

        const ytd = daysTrainedThisYear(state.dailyStats, now);
        const weekStrip = thisWeekSessionsByDay(state.dailyStats, now);
        const calendarStats = calendarFooterStats(state.dailyStats, 365, now);
        const sessionsThisWeek = sessionsForWeek(state.dailyStats, now, 0);
        const sessionsLastWeek = sessionsForWeek(state.dailyStats, now, -1);
        const sessionsWeekDelta = sessionsLastWeek > 0
            ? Math.round(((sessionsThisWeek - sessionsLastWeek) / sessionsLastWeek) * 100)
            : null;

        return {
            streak,
            calendar,
            calendarStats,
            lifetimeSessions,
            lifetimeDurationMs,
            joinedAt: userData?.createdAt || null,
            currentWeek,
            // cadence hero data
            cadence: {
                sessionsPerWeek,
                cadenceDeltaPct,
                daysTrainedThisYear: ytd,
                last30Count: last30.count,
                sessionsThisWeek,
                sessionsWeekDelta,
            },
            weekStrip,
        };
    }, [state.dailyStats, state.computedAt, totalSessions, userData, activeSessions]);

    return {
        ...state,
        ...derived,
        refetch: fetchData,
    };
}

/*
 * NOTE: This file is mirrored at `functions/consistencyDerivations.js` (CommonJS)
 * where it is unit-tested by Jest. Keep the two in sync when logic changes —
 * same pattern as gameHelpers.js / gameConstants.js (see CLAUDE.md).
 */

/* src/components/insights/consistency/consistencyDerivations.js
 *
 * Pure functions that turn a flat list of dailyStats docs into
 * week-tier, streak, rest-credit, calendar, and punch-card shapes.
 *
 * No React, no Firestore, no side effects — easy to reason about and test.
 *
 * Week boundary: Mon 00:00 → Sun 23:59, user local time (date-fns weekStartsOn: 1).
 * Tier criterion: distinct days with ≥1 session (NOT session count).
 *   2 days → Active, 3 days → Consistent (streak keeper), 5 days → All-In.
 * Rest credit: 1 per calendar month, not stackable, auto-consumed silently.
 */

import {
    startOfWeek, endOfWeek, addWeeks, format, parseISO, differenceInCalendarWeeks,
} from 'date-fns';

export const TIER = Object.freeze({
    NONE: 'none',
    ACTIVE: 'active',
    CONSISTENT: 'consistent',
    ALL_IN: 'all-in',
});

export const WEEK_STATUS = Object.freeze({
    TRAINED: 'trained',
    REST_USED: 'rest-used',
    MISSED: 'missed',
    IN_PROGRESS: 'in-progress',
});

const WEEK_OPTS = { weekStartsOn: 1 };
const ISO_DAY = 'yyyy-MM-dd';
const ISO_MONTH = 'yyyy-MM';

export function tierForDayCount(n) {
    if (n >= 5) return TIER.ALL_IN;
    if (n >= 3) return TIER.CONSISTENT;
    if (n >= 2) return TIER.ACTIVE;
    return TIER.NONE;
}

export function isConsistentTier(tier) {
    return tier === TIER.CONSISTENT || tier === TIER.ALL_IN;
}

// Group dailyStats docs by week. Each week tracks the set of distinct days
// trained, total session count, and total training duration.
export function groupByWeek(dailyStats) {
    // First, collapse multi-mode dailyStats for the same date into a single
    // per-day record (a dual+triple day is still one trained day).
    const byDay = new Map();
    for (const doc of dailyStats) {
        if (!doc.date) continue;
        const prev = byDay.get(doc.date) || { sessionCount: 0, durationMs: 0 };
        prev.sessionCount += doc.sessionCount || 0;
        prev.durationMs += doc.totalDurationMs || 0;
        byDay.set(doc.date, prev);
    }

    const byWeek = new Map();
    for (const [dayKey, { sessionCount, durationMs }] of byDay) {
        const date = parseISO(dayKey);
        const weekStartDate = startOfWeek(date, WEEK_OPTS);
        const weekStart = format(weekStartDate, ISO_DAY);
        const week = byWeek.get(weekStart) || {
            weekStart,
            weekStartDate,
            monthKey: format(weekStartDate, ISO_MONTH),
            days: new Set(),
            sessionCount: 0,
            totalDurationMs: 0,
        };
        week.days.add(dayKey);
        week.sessionCount += sessionCount;
        week.totalDurationMs += durationMs;
        byWeek.set(weekStart, week);
    }

    return Array.from(byWeek.values())
        .map(w => ({
            ...w,
            distinctDayCount: w.days.size,
            tier: tierForDayCount(w.days.size),
        }))
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

// Insert synthetic empty-week records so a user who trained in Jan then skipped
// to March doesn't appear to have a continuous streak. Fills from the first
// seen week through `throughDate` (default: current week).
export function fillMissingWeeks(weeks, throughDate = new Date()) {
    if (weeks.length === 0) return [];
    const currentWeekStartDate = startOfWeek(throughDate, WEEK_OPTS);

    const filled = [];
    let cursor = weeks[0].weekStartDate;
    const seen = new Map(weeks.map(w => [w.weekStart, w]));

    while (cursor <= currentWeekStartDate) {
        const key = format(cursor, ISO_DAY);
        if (seen.has(key)) {
            filled.push(seen.get(key));
        } else {
            filled.push({
                weekStart: key,
                weekStartDate: cursor,
                monthKey: format(cursor, ISO_MONTH),
                days: new Set(),
                distinctDayCount: 0,
                sessionCount: 0,
                totalDurationMs: 0,
                tier: TIER.NONE,
            });
        }
        cursor = addWeeks(cursor, 1);
    }
    return filled;
}

// Walk the filled-week list in order, apply per-month rest-week credits,
// and compute current streak, longest streak, and total Consistent weeks.
// Returns weeks with `.status` populated.
export function computeStreak(filledWeeks, nowDate = new Date()) {
    const currentWeekStart = format(startOfWeek(nowDate, WEEK_OPTS), ISO_DAY);
    const currentMonthKey = format(nowDate, ISO_MONTH);

    const restUsedByMonth = new Map();
    let running = 0;
    let longest = 0;
    let totalConsistent = 0;

    const weeksWithStatus = filledWeeks.map((w, i) => {
        const isCurrentWeek = w.weekStart === currentWeekStart;

        if (isConsistentTier(w.tier)) {
            running += 1;
            totalConsistent += 1;
            longest = Math.max(longest, running);
            return { ...w, status: isCurrentWeek ? WEEK_STATUS.IN_PROGRESS : WEEK_STATUS.TRAINED };
        }

        // Sub-Consistent week. Current in-progress week never breaks the streak —
        // the user still has time to hit Consistent. Show as in-progress.
        if (isCurrentWeek) {
            return { ...w, status: WEEK_STATUS.IN_PROGRESS };
        }

        // Past sub-Consistent week: consume a rest credit if available this month.
        if (!restUsedByMonth.has(w.monthKey)) {
            restUsedByMonth.set(w.monthKey, w.weekStart);
            running += 1;
            longest = Math.max(longest, running);
            return { ...w, status: WEEK_STATUS.REST_USED };
        }

        // No credit available — streak breaks.
        running = 0;
        return { ...w, status: WEEK_STATUS.MISSED };
    });

    return {
        weeks: weeksWithStatus,
        currentStreakWeeks: running,
        longestStreakWeeks: longest,
        totalConsistentWeeks: totalConsistent,
        restCreditAvailableThisMonth: !restUsedByMonth.has(currentMonthKey),
    };
}

// Slice the most-recent N weeks for the hero strip.
export function trailingWeeks(weeksWithStatus, n = 12) {
    return weeksWithStatus.slice(-n);
}

// Build a 365-day calendar grid keyed by 'YYYY-MM-DD' → session count.
export function calendarCells(dailyStats, daysBack = 365, nowDate = new Date()) {
    const byDay = new Map();
    for (const doc of dailyStats) {
        if (!doc.date) continue;
        byDay.set(doc.date, (byDay.get(doc.date) || 0) + (doc.sessionCount || 0));
    }

    const cells = [];
    const today = new Date(nowDate);
    today.setHours(0, 0, 0, 0);
    for (let i = daysBack - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = format(d, ISO_DAY);
        cells.push({ date: key, count: byDay.get(key) || 0 });
    }
    return cells;
}

// Lifetime aggregates from dailyStats (fallback when user doc aggregates missing).
export function lifetimeFromDailyStats(dailyStats) {
    let sessions = 0;
    let durationMs = 0;
    for (const doc of dailyStats) {
        sessions += doc.sessionCount || 0;
        durationMs += doc.totalDurationMs || 0;
    }
    return { sessions, durationMs };
}

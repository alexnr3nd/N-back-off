/* File: src\components\dashboard\DailyPerformanceChart.js */
/* File: src/components/dashboard/DailyPerformanceChart.js - Timezone Fix Applied */
import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
    LineChart,
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Label,
} from 'recharts';
import { formatCombinedDifficulty } from '../../contexts/gameHelpers';
import { MODE_LABELS } from '../../constants/modeStyles';

// --- Base date-fns functions ---
import {
    startOfDay,
    endOfDay,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    addDays,
    addWeeks,
    addMonths,
    subDays,
    isValid,
    parseISO,
    differenceInDays,
} from 'date-fns';

// --- Import date-fns-tz functions ---
import {
    toZonedTime,
    fromZonedTime,
    format as formatTz // Use alias to avoid conflict with date-fns format
} from 'date-fns-tz';


// --- Constants for Charting ---
const DEFAULT_TIMEZONE = 'UTC'; // Fallback timezone

// --- Helper: Aggregate Level for a Day ---
const aggregateDailyLevel = (sessionsForDay, isClassicView = false) => {
    if (!sessionsForDay || sessionsForDay.length === 0) return null;
    let totalLevel = 0; let validCount = 0;
    sessionsForDay.forEach(session => {
        if (typeof session.nBack === 'number' && typeof session.difficulty === 'number') {
            const level = isClassicView ? session.nBack : session.nBack + Math.max(0, Math.min(0.99, session.difficulty));
            totalLevel += level; validCount++;
        }
    });
    return validCount > 0 ? totalLevel / validCount : null;
};

// --- Helper: Safe Date Parsing (Remains unchanged) ---
const safeParseDate = (dateInput) => {
    if (!dateInput) return null;
    try {
        const date = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
        return isValid(date) ? date : null;
    } catch (e) {
        console.warn(`Error parsing date: ${dateInput}`, e);
        return null;
    }
};

// --- Helper: Determine aggregation level based on date range ---
const determineAggregationLevel = (dateRangeInDays) => {
    if (dateRangeInDays < 14) return 'daily';
    if (dateRangeInDays <= 60) return 'daily'; // Still daily but with spacing
    if (dateRangeInDays <= 180) return 'weekly';
    return 'monthly';
};

// --- Helper: Get week start for a date in timezone ---
const getWeekKey = (date, tz) => {
    const weekStart = startOfWeek(date, { weekStartsOn: 0 }); // Sunday
    return formatTz(weekStart, 'yyyy-MM-dd', { timeZone: tz });
};

// --- Helper: Get month key for a date ---
const getMonthKey = (date, tz) => {
    return formatTz(date, 'yyyy-MM', { timeZone: tz });
};


// --- Helper: Prepare Data for Chart (Handles all periods with Timezone) ---
const prepareChartData = (sessions, period, timezone, allTimeDailyStats, gameMode, isClassicView = false) => {
    const tz = timezone && typeof timezone === 'string' && timezone.length > 0 ? timezone : DEFAULT_TIMEZONE; // Use provided timezone or default
    const nowInTz = toZonedTime(new Date(), tz); // Get 'now' in the target timezone

    if (!Array.isArray(sessions) && period !== 'all') return { chartData: [], yDomain: [0, 5], xAxisProps: {}, tooltipFormatter: () => null };

    // Pre-filter and map sessions with valid UTC dates ONCE
    const processedSessions = sessions
        .map(s => {
            if (!s || !s.date) return null;
            const utcDate = safeParseDate(s.date); // Parse stored date string/object to get UTC Date object
            if (!utcDate) {
                 // console.warn(`Invalid date found for session ${s.id}: ${s.date}`); // Reduced verbosity
                 return null;
            }
            // Add level calculation here to avoid repetition later
            const level = (typeof s.nBack === 'number' && typeof s.difficulty === 'number')
                          ? (isClassicView ? s.nBack : s.nBack + Math.max(0, Math.min(0.99, s.difficulty)))
                          : null;
            return { ...s, utcDate, level }; // Add the validated UTC date object and calculated level
        })
        .filter(s => s !== null && s.level !== null); // Remove nulls and sessions missing valid level

    let chartData = [];
    let allLevels = [];
    let xAxisProps = {}; // Keep label here for the nested <Label> component
    let tooltipFormatter = (label) => label; // Default formatter returns the label
    const isMultiMode = gameMode === 'all';

    // --- Helper: split sessions by mode for multi-mode charts ---
    const splitByMode = (sessions) => {
        const modes = { dual: [], triple: [], quad: [] };
        sessions.forEach(s => {
            const mode = s.gameMode || 'dual';
            if (modes[mode]) modes[mode].push(s);
        });
        return modes;
    };

    // --- Period Logic ---
    switch (period) {
        // --- TODAY vs YESTERDAY (Session Number X-Axis) ---
        case 'today': {
            // Calculate UTC boundaries based on the user's timezone
            const startOfTodayTZ = startOfDay(nowInTz);
            const endOfTodayTZ = endOfDay(nowInTz);
            const startOfTodayUTC = fromZonedTime(startOfTodayTZ, tz);
            const endOfTodayUTC = fromZonedTime(endOfTodayTZ, tz);

            const yesterdayInTz = subDays(nowInTz, 1);
            const startOfYesterdayTZ = startOfDay(yesterdayInTz);
            const endOfYesterdayTZ = endOfDay(yesterdayInTz);
            const startOfYesterdayUTC = fromZonedTime(startOfYesterdayTZ, tz);
            const endOfYesterdayUTC = fromZonedTime(endOfYesterdayTZ, tz);

            // Filter using UTC boundaries and the session's utcDate
            const todaySessions = processedSessions
                .filter(s => s.utcDate >= startOfTodayUTC && s.utcDate <= endOfTodayUTC)
                .sort((a, b) => a.utcDate - b.utcDate); // Sort by original time

            if (isMultiMode) {
                // Multi-mode: show per-mode lines (no yesterday comparison)
                const maxCount = todaySessions.length;
                const modeGroups = splitByMode(todaySessions);
                // Build per-session-number data with per-mode values
                const maxPerMode = Math.max(modeGroups.dual.length, modeGroups.triple.length, modeGroups.quad.length);
                for (let i = 0; i < Math.max(maxPerMode, 1); i++) {
                    const point = { xValue: i + 1 };
                    ['dual', 'triple', 'quad'].forEach(mode => {
                        const s = modeGroups[mode][i];
                        if (s) {
                            point[`${mode}Value`] = s.level;
                            allLevels.push(s.level);
                        } else {
                            point[`${mode}Value`] = null;
                        }
                    });
                    chartData.push(point);
                }
                const maxSessionCount = Math.max(maxPerMode, 1);
                const tickCount = Math.min(maxSessionCount, 30);
                const uniqueTicks = maxSessionCount <= 30
                    ? Array.from({ length: maxSessionCount }, (_, i) => i + 1)
                    : Array.from({ length: tickCount }, (_, i) => Math.round((i + 1) * (maxSessionCount / tickCount)));
                xAxisProps = { dataKey: 'xValue', type: 'number', allowDecimals: false, domain: [1, Math.max(1, maxSessionCount)], label: { value: "Session #", position: 'insideBottom', offset: -15, fontSize: 11, fill: 'rgb(var(--color-text-muted))' }, ticks: uniqueTicks };
            } else {
                const yesterdaySessions = processedSessions
                    .filter(s => s.utcDate >= startOfYesterdayUTC && s.utcDate <= endOfYesterdayUTC)
                    .sort((a, b) => a.utcDate - b.utcDate);

                const maxSessionCount = Math.max(todaySessions.length, yesterdaySessions.length);
                if (maxSessionCount > 0) {
                    for (let i = 0; i < maxSessionCount; i++) {
                        const sessionNumber = i + 1;
                        const todaySession = todaySessions[i];
                        const yesterdaySession = yesterdaySessions[i];
                        const todayLevel = todaySession?.level ?? null;
                        const yesterdayLevel = yesterdaySession?.level ?? null;
                        if (todayLevel !== null) allLevels.push(todayLevel);
                        if (yesterdayLevel !== null) allLevels.push(yesterdayLevel);
                        chartData.push({
                            xValue: sessionNumber,
                            currentValue: todayLevel,
                            previousValue: yesterdayLevel,
                            currentOriginalDate: todaySession?.utcDate ?? null,
                            previousOriginalDate: yesterdaySession?.utcDate ?? null
                        });
                    }
                }
                const tickCountToday = Math.min(maxSessionCount, 30);
                const xTicksToday = maxSessionCount > 0
                    ? (maxSessionCount <= 30
                        ? Array.from({ length: maxSessionCount }, (_, i) => i + 1)
                        : Array.from({ length: tickCountToday }, (_, i) => Math.round((i + 1) * (maxSessionCount / tickCountToday))))
                    : [1];
                if(maxSessionCount > 0 && !xTicksToday.includes(1)) xTicksToday.unshift(1);
                if(maxSessionCount > 1 && !xTicksToday.includes(maxSessionCount)) xTicksToday.push(maxSessionCount);
                const uniqueTicks = [...new Set(xTicksToday.filter(t => t > 0))].sort((a, b) => a - b);
                xAxisProps = { dataKey: 'xValue', type: 'number', allowDecimals: false, domain: [1, Math.max(1, maxSessionCount)], label: { value: "Session #", position: 'insideBottom', offset: -15, fontSize: 11, fill: 'rgb(var(--color-text-muted))' }, ticks: uniqueTicks };
            }
            tooltipFormatter = (label) => `Session #${label}`;
            break;
        }

        // --- LAST 7 DAYS vs PRIOR 7 DAYS (Rolling Window) ---
        case 'week': {
            // Calculate rolling 7-day windows in user's timezone
            // Last 7 days: today - 6 days to today (inclusive)
            const last7EndTZ = endOfDay(nowInTz);
            const last7StartTZ = startOfDay(subDays(nowInTz, 6));

            // Prior 7 days: day before last7Start - 6 days to day before last7Start
            const prior7EndTZ = endOfDay(subDays(nowInTz, 7));
            const prior7StartTZ = startOfDay(subDays(nowInTz, 13));

            const last7StartUTC = fromZonedTime(last7StartTZ, tz);
            const last7EndUTC = fromZonedTime(last7EndTZ, tz);
            const prior7StartUTC = fromZonedTime(prior7StartTZ, tz);
            const prior7EndUTC = fromZonedTime(prior7EndTZ, tz);

            // Filter sessions for the rolling 7-day ranges
            const last7SessionsAll = processedSessions.filter(s => s.utcDate >= last7StartUTC && s.utcDate <= last7EndUTC);

            // Aggregate per day (oldest to newest)
            for (let i = 0; i < 7; i++) {
                const currentDayTargetTZ = addDays(last7StartTZ, i);
                const dayStartCurrentUTC = fromZonedTime(startOfDay(currentDayTargetTZ), tz);
                const dayEndCurrentUTC = fromZonedTime(endOfDay(currentDayTargetTZ), tz);
                const currentDaySessions = last7SessionsAll.filter(s => s.utcDate >= dayStartCurrentUTC && s.utcDate <= dayEndCurrentUTC);
                const dateLabel = formatTz(currentDayTargetTZ, 'M/d', { timeZone: tz });

                if (isMultiMode) {
                    const modeGroups = splitByMode(currentDaySessions);
                    const point = { xValue: dateLabel, dayDate: currentDayTargetTZ };
                    ['dual', 'triple', 'quad'].forEach(mode => {
                        const level = aggregateDailyLevel(modeGroups[mode], isClassicView);
                        point[`${mode}Value`] = level;
                        if (level !== null) allLevels.push(level);
                    });
                    chartData.push(point);
                } else {
                    const previousDayTargetTZ = addDays(prior7StartTZ, i);
                    const dayStartPreviousUTC = fromZonedTime(startOfDay(previousDayTargetTZ), tz);
                    const dayEndPreviousUTC = fromZonedTime(endOfDay(previousDayTargetTZ), tz);
                    const prior7SessionsAll = processedSessions.filter(s => s.utcDate >= prior7StartUTC && s.utcDate <= prior7EndUTC);
                    const previousDaySessions = prior7SessionsAll.filter(s => s.utcDate >= dayStartPreviousUTC && s.utcDate <= dayEndPreviousUTC);

                    const currentLevel = aggregateDailyLevel(currentDaySessions, isClassicView);
                    const previousLevel = aggregateDailyLevel(previousDaySessions, isClassicView);
                    if (currentLevel !== null) allLevels.push(currentLevel);
                    if (previousLevel !== null) allLevels.push(previousLevel);

                    chartData.push({
                        xValue: dateLabel,
                        dayDate: currentDayTargetTZ,
                        previousDayDate: previousDayTargetTZ,
                        currentValue: currentLevel,
                        previousValue: previousLevel,
                        currentSessionCount: currentDaySessions.length,
                        previousSessionCount: previousDaySessions.length
                    });
                }
            }
            xAxisProps = { dataKey: 'xValue', type: 'category', label: { value: "Date", position: 'insideBottom', offset: -15, fontSize: 11, fill: 'rgb(var(--color-text-muted))' } };
            tooltipFormatter = (label, payload) => {
                const point = payload?.[0]?.payload;
                const dateStr = point?.dayDate ? formatTz(point.dayDate, 'EEE, MMM d', { timeZone: tz }) : '';
                return dateStr;
            };
            break;
        }

        // --- LAST 30 DAYS vs PRIOR 30 DAYS (Rolling Window) ---
        case 'month': {
            // Calculate rolling 30-day windows in user's timezone
            // Last 30 days: today - 29 days to today (inclusive)
            const last30EndTZ = endOfDay(nowInTz);
            const last30StartTZ = startOfDay(subDays(nowInTz, 29));

            // Prior 30 days: day before last30Start - 29 days to day before last30Start
            const prior30EndTZ = endOfDay(subDays(nowInTz, 30));
            const prior30StartTZ = startOfDay(subDays(nowInTz, 59));

            const last30StartUTC = fromZonedTime(last30StartTZ, tz);
            const last30EndUTC = fromZonedTime(last30EndTZ, tz);
            const prior30StartUTC = fromZonedTime(prior30StartTZ, tz);
            const prior30EndUTC = fromZonedTime(prior30EndTZ, tz);

            // Filter sessions for the rolling 30-day ranges
            const last30SessionsAll = processedSessions.filter(s => s.utcDate >= last30StartUTC && s.utcDate <= last30EndUTC);

            // Aggregate per day (oldest to newest)
            for (let i = 0; i < 30; i++) {
                 const currentDayTargetTZ = addDays(last30StartTZ, i);
                 const dayStartCurrentUTC = fromZonedTime(startOfDay(currentDayTargetTZ), tz);
                 const dayEndCurrentUTC = fromZonedTime(endOfDay(currentDayTargetTZ), tz);
                 const currentDaySessions = last30SessionsAll.filter(s => s.utcDate >= dayStartCurrentUTC && s.utcDate <= dayEndCurrentUTC);
                 const dayNumber = i + 1;

                 if (isMultiMode) {
                     const modeGroups = splitByMode(currentDaySessions);
                     const point = { xValue: dayNumber, dayDate: currentDayTargetTZ };
                     ['dual', 'triple', 'quad'].forEach(mode => {
                         const level = aggregateDailyLevel(modeGroups[mode], isClassicView);
                         point[`${mode}Value`] = level;
                         if (level !== null) allLevels.push(level);
                     });
                     chartData.push(point);
                 } else {
                     const previousDayTargetTZ = addDays(prior30StartTZ, i);
                     const dayStartPreviousUTC = fromZonedTime(startOfDay(previousDayTargetTZ), tz);
                     const dayEndPreviousUTC = fromZonedTime(endOfDay(previousDayTargetTZ), tz);
                     const prior30SessionsAll = processedSessions.filter(s => s.utcDate >= prior30StartUTC && s.utcDate <= prior30EndUTC);
                     const previousDaySessions = prior30SessionsAll.filter(s => s.utcDate >= dayStartPreviousUTC && s.utcDate <= dayEndPreviousUTC);

                     const currentLevel = aggregateDailyLevel(currentDaySessions, isClassicView);
                     const previousLevel = aggregateDailyLevel(previousDaySessions, isClassicView);
                     if (currentLevel !== null) allLevels.push(currentLevel);
                     if (previousLevel !== null) allLevels.push(previousLevel);

                     chartData.push({
                         xValue: dayNumber,
                         dayDate: currentDayTargetTZ,
                         previousDayDate: previousDayTargetTZ,
                         currentValue: currentLevel,
                         previousValue: previousLevel,
                         currentSessionCount: currentDaySessions.length,
                         previousSessionCount: previousDaySessions.length
                     });
                 }
             }
            const xTicksMonth = [1, 5, 10, 15, 20, 25, 30];
            // X-axis ticks are day-indices (1 = oldest day of the window, 30 = today).
            // Print each tick's real calendar date so the axis reads oldest -> newest,
            // left -> right, matching the plotted data and the Week view. Replaces the
            // old reversed "Days Ago" numbering (1 sat on the oldest day, not the most
            // recent). Day-index N maps to last30Start + (N - 1) days.
            const formatMonthTick = (dayIndex) =>
                formatTz(addDays(last30StartTZ, dayIndex - 1), 'M/d', { timeZone: tz });

            xAxisProps = { dataKey: 'xValue', type: 'number', allowDecimals: false, domain: [1, 30], label: { value: "Date", position: 'insideBottom', offset: -15, fontSize: 11, fill: 'rgb(var(--color-text-muted))' }, ticks: xTicksMonth, tickFormatter: formatMonthTick };
             // Tooltip formatter shows full date
             tooltipFormatter = (label, payload) => {
                 const point = payload?.[0]?.payload;
                 const dateStr = point?.dayDate ? formatTz(point.dayDate, 'EEE, MMM d', { timeZone: tz }) : '';
                 return dateStr;
             };
            break;
        }

        // --- ALL TIME (Dynamic Aggregation with Volume Bars using dailyStats) ---
        case 'all': {
            // Use allTimeDailyStats instead of sessions for efficiency
            if (!Array.isArray(allTimeDailyStats) || allTimeDailyStats.length === 0) {
                return { chartData: [], yDomain: [0, 5], xAxisProps: {}, tooltipFormatter: () => null, isAllTime: true, maxSessionCount: 0 };
            }

            // Multi-mode support: when gameMode is 'all', show separate lines per mode
            const isMultiMode = gameMode === 'all';

            // Filter by game mode (skip filter when 'all')
            const modeFiltered = isMultiMode
                ? allTimeDailyStats
                : allTimeDailyStats.filter(doc => doc.gameMode === (gameMode || 'dual'));
            if (modeFiltered.length === 0) {
                return { chartData: [], yDomain: [0, 5], xAxisProps: {}, tooltipFormatter: () => null, isAllTime: true, maxSessionCount: 0 };
            }

            // Sort by date
            const sortedStats = [...modeFiltered].sort((a, b) => a.date.localeCompare(b.date));

            // Calculate date range
            const firstDate = parseISO(sortedStats[0].date);
            const lastDate = parseISO(sortedStats[sortedStats.length - 1].date);
            const dateRangeInDays = differenceInDays(lastDate, firstDate) + 1;
            const aggregationLevel = determineAggregationLevel(dateRangeInDays);

            // Helper to calculate average level from dailyStat
            const getAvgLevel = (stat) => {
                if (stat.sessionCount > 0 && stat.totalStartLevel !== undefined) {
                    return stat.totalStartLevel / stat.sessionCount;
                }
                return null;
            };

            // --- Multi-mode aggregation helper ---
            // Groups stats by time bucket and mode, produces { xValue, dualValue, tripleValue, quadValue, ... }
            const aggregateMultiMode = (stats, getKeyFn, getDateFn, getXValueFn) => {
                const bucketMap = new Map(); // key -> { dual: {totalLevel, totalSessions}, triple: {...}, quad: {...}, date, totalSessions }
                stats.forEach(stat => {
                    const mode = stat.gameMode || 'dual';
                    // Single-modality stats aren't represented on this chart's mode lines.
                    // Matches splitByMode's guard in today/week/month paths.
                    if (mode !== 'dual' && mode !== 'triple' && mode !== 'quad') return;
                    const key = getKeyFn(stat);
                    if (!bucketMap.has(key)) {
                        bucketMap.set(key, {
                            date: getDateFn(stat),
                            dual: { totalLevel: 0, totalSessions: 0 },
                            triple: { totalLevel: 0, totalSessions: 0 },
                            quad: { totalLevel: 0, totalSessions: 0 },
                            totalSessions: 0,
                        });
                    }
                    const bucket = bucketMap.get(key);
                    if (stat.totalStartLevel !== undefined && stat.sessionCount > 0) {
                        bucket[mode].totalLevel += stat.totalStartLevel;
                        bucket[mode].totalSessions += stat.sessionCount;
                        bucket.totalSessions += stat.sessionCount;
                    }
                });
                const sortedKeys = Array.from(bucketMap.keys()).sort();
                sortedKeys.forEach(key => {
                    const bucket = bucketMap.get(key);
                    if (bucket.totalSessions === 0) return;
                    const point = {
                        xValue: getXValueFn(bucket.date),
                        dayDate: bucket.date,
                        sessionCount: bucket.totalSessions,
                    };
                    ['dual', 'triple', 'quad'].forEach(mode => {
                        const modeData = bucket[mode];
                        if (modeData.totalSessions > 0) {
                            const avgLevel = modeData.totalLevel / modeData.totalSessions;
                            point[`${mode}Value`] = avgLevel;
                            allLevels.push(avgLevel);
                        } else {
                            point[`${mode}Value`] = null;
                        }
                    });
                    chartData.push(point);
                });
                return sortedKeys;
            };

            // Aggregate based on level
            if (aggregationLevel === 'daily') {
                if (isMultiMode) {
                    // Multi-mode daily aggregation
                    aggregateMultiMode(
                        sortedStats,
                        (stat) => stat.date,
                        (stat) => parseISO(stat.date),
                        (dateObj) => formatTz(dateObj, 'M/d', { timeZone: tz })
                    );
                } else {
                    // Single-mode daily aggregation - use data as-is
                    sortedStats.forEach(stat => {
                        const avgLevel = getAvgLevel(stat);
                        if (avgLevel === null) return;
                        allLevels.push(avgLevel);
                        const dateObj = parseISO(stat.date);
                        chartData.push({
                            xValue: formatTz(dateObj, 'M/d', { timeZone: tz }),
                            dayDate: dateObj,
                            currentValue: avgLevel,
                            sessionCount: stat.sessionCount,
                        });
                    });
                }

                xAxisProps = {
                    dataKey: 'xValue',
                    type: 'category',
                    label: { value: "Date", position: 'insideBottom', offset: -15, fontSize: 11, fill: 'rgb(var(--color-text-muted))' },
                    interval: dateRangeInDays > 30 ? Math.floor(dateRangeInDays / 10) : 'preserveStartEnd',
                };
                tooltipFormatter = (label, payload) => {
                    const point = payload?.[0]?.payload;
                    return point?.dayDate ? formatTz(point.dayDate, 'EEE, MMM d, yyyy', { timeZone: tz }) : label;
                };

            } else if (aggregationLevel === 'weekly') {
                if (isMultiMode) {
                    // Multi-mode weekly aggregation
                    aggregateMultiMode(
                        sortedStats,
                        (stat) => getWeekKey(parseISO(stat.date), tz),
                        (stat) => startOfWeek(parseISO(stat.date), { weekStartsOn: 0 }),
                        (dateObj) => formatTz(dateObj, 'M/d', { timeZone: tz })
                    );
                } else {
                    // Single-mode weekly aggregation
                    const weeklyMap = new Map();
                    sortedStats.forEach(stat => {
                        const dateObj = parseISO(stat.date);
                        const weekKey = getWeekKey(dateObj, tz);
                        if (!weeklyMap.has(weekKey)) {
                            const weekStartDate = startOfWeek(dateObj, { weekStartsOn: 0 });
                            weeklyMap.set(weekKey, { totalLevel: 0, totalSessions: 0, weekStart: weekStartDate });
                        }
                        const weekData = weeklyMap.get(weekKey);
                        if (stat.totalStartLevel !== undefined && stat.sessionCount > 0) {
                            weekData.totalLevel += stat.totalStartLevel;
                            weekData.totalSessions += stat.sessionCount;
                        }
                    });
                    const sortedKeys = Array.from(weeklyMap.keys()).sort();
                    sortedKeys.forEach(weekKey => {
                        const weekData = weeklyMap.get(weekKey);
                        if (weekData.totalSessions === 0) return;
                        const avgLevel = weekData.totalLevel / weekData.totalSessions;
                        allLevels.push(avgLevel);
                        chartData.push({
                            xValue: formatTz(weekData.weekStart, 'M/d', { timeZone: tz }),
                            dayDate: weekData.weekStart,
                            currentValue: avgLevel,
                            sessionCount: weekData.totalSessions,
                        });
                    });
                }

                const sortedKeysCount = chartData.length;
                xAxisProps = {
                    dataKey: 'xValue',
                    type: 'category',
                    label: { value: "Week of", position: 'insideBottom', offset: -15, fontSize: 11, fill: 'rgb(var(--color-text-muted))' },
                    interval: sortedKeysCount > 20 ? Math.floor(sortedKeysCount / 10) : 'preserveStartEnd',
                };
                tooltipFormatter = (label, payload) => {
                    const point = payload?.[0]?.payload;
                    if (point?.dayDate) {
                        const weekEnd = endOfWeek(point.dayDate, { weekStartsOn: 0 });
                        return `Week of ${formatTz(point.dayDate, 'MMM d', { timeZone: tz })} - ${formatTz(weekEnd, 'MMM d, yyyy', { timeZone: tz })}`;
                    }
                    return label;
                };

            } else {
                if (isMultiMode) {
                    // Multi-mode monthly aggregation
                    aggregateMultiMode(
                        sortedStats,
                        (stat) => getMonthKey(parseISO(stat.date), tz),
                        (stat) => startOfMonth(parseISO(stat.date)),
                        (dateObj) => formatTz(dateObj, "MMM ''yy", { timeZone: tz })
                    );
                } else {
                    // Single-mode monthly aggregation
                    const monthlyMap = new Map();
                    sortedStats.forEach(stat => {
                        const dateObj = parseISO(stat.date);
                        const monthKey = getMonthKey(dateObj, tz);
                        if (!monthlyMap.has(monthKey)) {
                            const monthStartDate = startOfMonth(dateObj);
                            monthlyMap.set(monthKey, { totalLevel: 0, totalSessions: 0, monthStart: monthStartDate });
                        }
                        const monthData = monthlyMap.get(monthKey);
                        if (stat.totalStartLevel !== undefined && stat.sessionCount > 0) {
                            monthData.totalLevel += stat.totalStartLevel;
                            monthData.totalSessions += stat.sessionCount;
                        }
                    });
                    const sortedKeys = Array.from(monthlyMap.keys()).sort();
                    sortedKeys.forEach(monthKey => {
                        const monthData = monthlyMap.get(monthKey);
                        if (monthData.totalSessions === 0) return;
                        const avgLevel = monthData.totalLevel / monthData.totalSessions;
                        allLevels.push(avgLevel);
                        chartData.push({
                            xValue: formatTz(monthData.monthStart, "MMM ''yy", { timeZone: tz }),
                            dayDate: monthData.monthStart,
                            currentValue: avgLevel,
                            sessionCount: monthData.totalSessions,
                        });
                    });
                }

                const sortedKeysCount = chartData.length;
                xAxisProps = {
                    dataKey: 'xValue',
                    type: 'category',
                    label: { value: "Month", position: 'insideBottom', offset: -15, fontSize: 11, fill: 'rgb(var(--color-text-muted))' },
                    interval: sortedKeysCount > 12 ? Math.floor(sortedKeysCount / 8) : 'preserveStartEnd',
                };
                tooltipFormatter = (label, payload) => {
                    const point = payload?.[0]?.payload;
                    return point?.dayDate ? formatTz(point.dayDate, 'MMMM yyyy', { timeZone: tz }) : label;
                };
            }

            break;
        }

        default:
            console.error(`Invalid period type: ${period}`);
            return { chartData: [], yDomain: [0, 5], xAxisProps: {}, tooltipFormatter: () => null };
    }

    // --- Calculate Y-Axis Domain ---
    let yDomain = [0, 5]; // Default Y-axis
     if (allLevels.length > 0) {
        const minY = Math.min(...allLevels);
        const maxY = Math.max(...allLevels);
        if (isClassicView) {
            // Integer-friendly bounds for classic view
            yDomain = [Math.max(0, Math.floor(minY) - 1), Math.ceil(maxY) + 1];
        } else {
            if (minY === maxY) { yDomain = [Math.max(0, minY - 0.2), maxY + 0.2]; }
            else { yDomain = [Math.max(0, minY - 0.1), maxY + 0.1]; }
            if (yDomain[1] - yDomain[0] < 0.5) { const mid = (yDomain[0] + yDomain[1]) / 2; yDomain = [Math.max(0, mid - 0.25), mid + 0.25]; }
        }
    }

    // Calculate max session count for secondary Y-axis domain (all-time view)
    const maxSessionCount = period === 'all' && chartData.length > 0
        ? Math.max(...chartData.map(d => d.sessionCount || 0))
        : 0;

    // Determine if the chart should show multi-mode lines (any period)
    const isMultiModeChart = gameMode === 'all' &&
        chartData.some(d => d.dualValue !== undefined || d.tripleValue !== undefined || d.quadValue !== undefined);

    return { chartData, yDomain, xAxisProps, tooltipFormatter, isAllTime: period === 'all', maxSessionCount, isMultiModeChart };
};


// --- Mode colors for multi-mode chart ---
const MODE_LINE_COLORS = {
    dual: '#EAB308',    // yellow-500
    triple: '#A855F7',  // purple-500
    quad: '#06B6D4',    // cyan-500
};

// --- Tooltip Formatter (Lab instrument style) ---
const CustomTooltip = ({ active, payload, label, formatter, period, timezone, lineColor, isClassicView = false }) => {
    if (active && payload && payload.length) {
        const currentData = payload.find(p => p.dataKey === 'currentValue');
        const previousData = payload.find(p => p.dataKey === 'previousValue');

        const periodLabel = typeof formatter === 'function' ? formatter(label, payload) : label;

        const formatLevel = (levelValue) => {
            if (levelValue === null || levelValue === undefined) return 'N/A';
            if (isClassicView) return String(Math.round(levelValue));
            const nBack = Math.floor(levelValue);
            const difficulty = levelValue - nBack;
            return formatCombinedDifficulty(nBack, difficulty);
        };

        const pointData = payload[0]?.payload;
        const currentOriginalDate = pointData?.currentOriginalDate;
        const previousOriginalDate = pointData?.previousOriginalDate;

        // For all-time view, show single line with session count
        if (period === 'all') {
            return (
                <div className="bg-theme-bg-elevated border border-theme-line p-3" style={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)' }}>
                    <p className="font-mono text-xs font-medium sm:text-[0.6875rem] sm:font-normal uppercase tracking-wider text-theme-text-muted mb-2">{periodLabel}</p>
                    {currentData && (
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 bg-indigo-400"></div>
                            <span className="text-sm sm:text-xs text-theme-text-secondary">Avg Level:</span>
                            <span className="font-mono text-sm text-indigo-400">{formatLevel(currentData.value)}</span>
                        </div>
                    )}
                    {pointData?.sessionCount !== undefined && (
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-theme-text-muted opacity-50"></div>
                            <span className="text-sm sm:text-xs text-theme-text-secondary">Sessions:</span>
                            <span className="font-mono text-sm text-theme-text-muted">{pointData.sessionCount}</span>
                        </div>
                    )}
                </div>
            );
        }

        // Multi-mode (All tab): show each mode's value with its color
        const isMultiMode = payload.some(p =>
            p.dataKey === 'dualValue' || p.dataKey === 'tripleValue' || p.dataKey === 'quadValue'
        );

        if (isMultiMode) {
            return (
                <div className="bg-theme-bg-elevated border border-theme-line p-3" style={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)' }}>
                    <p className="font-mono text-xs font-medium sm:text-[0.6875rem] sm:font-normal uppercase tracking-wider text-theme-text-muted mb-2">{periodLabel}</p>
                    {['dual', 'triple', 'quad'].map(mode => {
                        const entry = payload.find(p => p.dataKey === `${mode}Value`);
                        if (!entry || entry.value == null) return null;
                        return (
                            <div key={mode} className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2" style={{ backgroundColor: MODE_LINE_COLORS[mode] }}></div>
                                <span className="text-sm sm:text-xs text-theme-text-secondary">{MODE_LABELS[mode]}:</span>
                                <span className="font-mono text-sm" style={{ color: MODE_LINE_COLORS[mode] }}>{formatLevel(entry.value)}</span>
                            </div>
                        );
                    })}
                    {pointData?.sessionCount !== undefined && (
                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-2 h-2 bg-theme-text-muted opacity-50"></div>
                            <span className="text-sm sm:text-xs text-theme-text-secondary">Sessions:</span>
                            <span className="font-mono text-sm text-theme-text-muted">{pointData.sessionCount}</span>
                        </div>
                    )}
                </div>
            );
        }

        // For week/month views, show actual dates; for today view, use period names
        let currentSeriesName, previousSeriesName;
        if (period === 'today') {
            currentSeriesName = 'Today';
            previousSeriesName = 'Yesterday';
        } else if (period === 'week' || period === 'month') {
            // Format the actual dates for each line
            currentSeriesName = pointData?.dayDate && timezone
                ? formatTz(pointData.dayDate, 'EEE, MMM d', { timeZone: timezone })
                : 'Current';
            previousSeriesName = pointData?.previousDayDate && timezone
                ? formatTz(pointData.previousDayDate, 'EEE, MMM d', { timeZone: timezone })
                : 'Previous';
        } else {
            currentSeriesName = 'Current';
            previousSeriesName = 'Previous';
        }

        return (
            <div className="bg-theme-bg-elevated border border-theme-line p-3" style={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)' }}>
                {/* Only show header for today view */}
                {period === 'today' && (
                    <p className="font-mono text-xs font-medium sm:text-[0.6875rem] sm:font-normal uppercase tracking-wider text-theme-text-muted mb-2">{periodLabel}</p>
                )}
                {currentData && (
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2" style={{ backgroundColor: lineColor || 'rgb(var(--color-accent))' }}></div>
                        <span className="text-sm sm:text-xs text-theme-text-secondary">{currentSeriesName}:</span>
                        <span className="font-mono text-sm" style={{ color: lineColor || 'rgb(var(--color-accent))' }}>{formatLevel(currentData.value)}</span>
                        {currentOriginalDate && period === 'today' && timezone && (
                            <span className="text-theme-text-muted text-sm sm:text-[0.6875rem] font-mono">
                                {formatTz(currentOriginalDate, 'HH:mm', { timeZone: timezone })}
                            </span>
                        )}
                        {period !== 'today' && pointData?.currentSessionCount !== undefined && (
                            <span className="text-theme-text-muted text-sm sm:text-[0.6875rem] font-mono">
                                ({pointData.currentSessionCount} session{pointData.currentSessionCount !== 1 ? 's' : ''})
                            </span>
                        )}
                    </div>
                )}
                {previousData && (
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-theme-text-muted"></div>
                        <span className="text-sm sm:text-xs text-theme-text-secondary">{previousSeriesName}:</span>
                        <span className="font-mono text-sm text-theme-text">{formatLevel(previousData.value)}</span>
                        {previousOriginalDate && period === 'today' && timezone && (
                            <span className="text-theme-text-muted text-sm sm:text-[0.6875rem] font-mono">
                                {formatTz(previousOriginalDate, 'HH:mm', { timeZone: timezone })}
                            </span>
                        )}
                        {period !== 'today' && pointData?.previousSessionCount !== undefined && (
                            <span className="text-theme-text-muted text-sm sm:text-[0.6875rem] font-mono">
                                ({pointData.previousSessionCount} session{pointData.previousSessionCount !== 1 ? 's' : ''})
                            </span>
                        )}
                    </div>
                )}
            </div>
        );
    }
    return null;
};


// --- Main Chart Component (Accepts timezone prop) ---
const DailyPerformanceChart = ({ sessions, selectedPeriod, timezone, allTimeDailyStats, gameMode, isClassicView = false }) => {
    const { chartData, yDomain, xAxisProps, tooltipFormatter, isAllTime, maxSessionCount, isMultiModeChart } = useMemo(
        () => prepareChartData(sessions, selectedPeriod, timezone, allTimeDailyStats, gameMode, isClassicView),
        [sessions, selectedPeriod, timezone, allTimeDailyStats, gameMode, isClassicView]
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

    // Keep original destructuring for label prop if it exists
    const { label: xAxisLabelConfig, ...restXAxisProps } = xAxisProps;

    const hasData = chartData && chartData.length > 0 && chartData.some(d =>
        (d.currentValue != null) || (d.previousValue != null) ||
        (d.dualValue != null) || (d.tripleValue != null) || (d.quadValue != null)
    );

    // Lab instrument colors - theme-aware via CSS variables
    const currentLineName = selectedPeriod === 'today' ? 'Today' :
                            selectedPeriod === 'week' ? 'Last 7 days' :
                            selectedPeriod === 'month' ? 'Last 30 days' : 'All Time';
    const previousLineName = selectedPeriod === 'today' ? 'Yesterday' :
                             selectedPeriod === 'week' ? 'Prior 7 days' : 'Prior 30 days';
    // Use indigo for all-time view
    const currentLineColor = isAllTime ? "rgb(129, 140, 248)"
        : (gameMode && MODE_LINE_COLORS[gameMode]) || "rgb(var(--color-accent))";
    const previousLineColor = "rgb(var(--color-text-muted))";

    if (!hasData) {
        // No data state - Lab instrument style
        return (
            <div className="specimen-card p-6 text-center h-72 sm:h-80 flex flex-col justify-center items-center">
                <div className="w-16 h-16 border border-theme-line flex items-center justify-center text-theme-text-muted mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                </div>
                <h3 className="text-theme-text font-serif italic text-lg mb-2">No Trajectory Data</h3>
                <p className="text-theme-text-muted text-sm font-mono mb-4">Insufficient data points for visualization</p>
                <div className="inline-flex items-center gap-2 text-sm sm:text-xs text-theme-text-secondary bg-theme-bg-elevated px-3 py-1.5 border border-theme-line">
                    <div className="w-1.5 h-1.5 bg-theme-accent rounded-full animate-pulse"></div>
                    <span className="font-mono">Complete sessions to populate graph</span>
                </div>
            </div>
        );
    }

    // For all-time view, use ComposedChart with volume bars
    if (isAllTime) {
        return (
            <div className="specimen-card p-4 h-72 sm:h-80 relative overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={chartData}
                        margin={{ top: 5, right: 20, left: 0, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-line))" strokeOpacity={0.5} />
                        <XAxis
                            {...restXAxisProps}
                            tick={{ fontSize: chartFontSize, fill: 'rgb(var(--color-text-muted))', fontFamily: 'Space Mono, monospace' }}
                            padding={{ left: 10, right: 10 }}
                            stroke="rgb(var(--color-line))"
                        >
                           {xAxisLabelConfig && <Label {...xAxisLabelConfig} style={{ ...xAxisLabelConfig.style, fontSize: labelFontSize, fontFamily: 'Space Mono, monospace' }} />}
                        </XAxis>
                        <YAxis
                            yAxisId="level"
                            type="number"
                            domain={yDomain}
                            allowDecimals={!isClassicView}
                            tickFormatter={(tick) => isClassicView ? String(Math.round(tick)) : tick.toFixed(2)}
                            tick={{ fontSize: chartFontSize, fill: 'rgb(var(--color-text-muted))', fontFamily: 'Space Mono, monospace' }}
                            width={45}
                            stroke="rgb(var(--color-line))"
                        >
                             <Label value="N-Back Level" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fontSize: chartFontSize, fill: 'rgb(var(--color-text-muted))', fontFamily: 'Space Mono, monospace' }} offset={-5} />
                        </YAxis>
                        {/* Hidden Y-axis for volume bars - uses normalized height */}
                        <YAxis
                            yAxisId="volume"
                            orientation="right"
                            domain={[0, maxSessionCount * 3]} // Scale down bars to 1/3 of chart height
                            hide={true}
                        />
                        <Tooltip content={<CustomTooltip formatter={tooltipFormatter} period={selectedPeriod} timezone={timezone} lineColor={currentLineColor} isClassicView={isClassicView}/>} />
                        <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: chartFontSize, color: 'rgb(var(--color-text-secondary))', fontFamily: 'Space Mono, monospace' }}/>
                        {/* Volume bars - subtle background showing session count */}
                        <Bar
                            yAxisId="volume"
                            dataKey="sessionCount"
                            name="Sessions"
                            fill="rgb(var(--color-text-muted))"
                            fillOpacity={0.15}
                            isAnimationActive={true}
                        />
                        {/* Performance line(s) — multi-mode or single */}
                        {isMultiModeChart ? (
                            ['dual', 'triple', 'quad'].map(mode => (
                                <Line
                                    key={mode}
                                    yAxisId="level"
                                    isAnimationActive={true}
                                    type="monotone"
                                    dataKey={`${mode}Value`}
                                    name={MODE_LABELS[mode]}
                                    stroke={MODE_LINE_COLORS[mode]}
                                    strokeWidth={2}
                                    connectNulls={true}
                                    dot={{ r: 3, strokeWidth: 1, fill: 'rgb(var(--color-bg-secondary))' }}
                                    activeDot={{ r: 5, strokeWidth: 2, fill: MODE_LINE_COLORS[mode], stroke: 'rgb(var(--color-bg-secondary))' }}
                                />
                            ))
                        ) : (
                            <Line
                                yAxisId="level"
                                isAnimationActive={true}
                                type="monotone"
                                dataKey="currentValue"
                                name={currentLineName}
                                stroke={currentLineColor}
                                strokeWidth={2}
                                connectNulls={true}
                                dot={{ r: 3, strokeWidth: 1, fill: 'rgb(var(--color-bg-secondary))' }}
                                activeDot={{ r: 5, strokeWidth: 2, fill: currentLineColor, stroke: 'rgb(var(--color-bg-secondary))' }}
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        );
    }

    return (
        // Lab instrument style container
        <div className="specimen-card p-4 h-72 sm:h-80 relative overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 20, left: 0, bottom: 20 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-line))" strokeOpacity={0.5} />
                    <XAxis
                        {...restXAxisProps}
                        tick={{ fontSize: chartFontSize, fill: 'rgb(var(--color-text-muted))', fontFamily: 'Space Mono, monospace' }}
                        padding={{ left: 10, right: 10 }}
                        interval="preserveStartEnd"
                        stroke="rgb(var(--color-line))"
                        {...(restXAxisProps.type === 'number' && { tickCount: restXAxisProps.ticks?.length || 7 })}
                    >
                       {xAxisLabelConfig && <Label {...xAxisLabelConfig} style={{ ...xAxisLabelConfig.style, fontSize: labelFontSize, fontFamily: 'Space Mono, monospace' }} />}
                    </XAxis>
                    <YAxis
                        type="number"
                        domain={yDomain}
                        allowDecimals={!isClassicView}
                        tickFormatter={(tick) => isClassicView ? String(Math.round(tick)) : tick.toFixed(2)}
                        tick={{ fontSize: chartFontSize, fill: 'rgb(var(--color-text-muted))', fontFamily: 'Space Mono, monospace' }}
                        width={45}
                        stroke="rgb(var(--color-line))"
                    >
                         <Label value="N-Back Level" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fontSize: chartFontSize, fill: 'rgb(var(--color-text-muted))', fontFamily: 'Space Mono, monospace' }} offset={-5} />
                    </YAxis>
                    <Tooltip content={<CustomTooltip formatter={tooltipFormatter} period={selectedPeriod} timezone={timezone} lineColor={currentLineColor} isClassicView={isClassicView}/>} />
                    <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: chartFontSize, color: 'rgb(var(--color-text-secondary))', fontFamily: 'Space Mono, monospace' }}/>
                    {isMultiModeChart && (
                        ['dual', 'triple', 'quad'].map(mode => (
                            <Line
                                key={mode}
                                isAnimationActive={true}
                                type="monotone"
                                dataKey={`${mode}Value`}
                                name={MODE_LABELS[mode]}
                                stroke={MODE_LINE_COLORS[mode]}
                                strokeWidth={2}
                                connectNulls={true}
                                dot={{ r: 3, strokeWidth: 1, fill: 'rgb(var(--color-bg-secondary))' }}
                                activeDot={{ r: 5, strokeWidth: 2, fill: MODE_LINE_COLORS[mode], stroke: 'rgb(var(--color-bg-secondary))' }}
                            />
                        ))
                    )}
                    {!isMultiModeChart && (
                        <Line
                            isAnimationActive={true}
                            type="monotone"
                            dataKey="currentValue"
                            name={currentLineName}
                            stroke={currentLineColor}
                            strokeWidth={2}
                            connectNulls={true}
                            dot={{ r: 3, strokeWidth: 1, fill: 'rgb(var(--color-bg-secondary))' }}
                            activeDot={{ r: 5, strokeWidth: 2, fill: currentLineColor, stroke: 'rgb(var(--color-bg-secondary))' }}
                        />
                    )}
                    {!isMultiModeChart && (
                        <Line
                            isAnimationActive={true}
                            type="monotone"
                            dataKey="previousValue"
                            name={previousLineName}
                            stroke={previousLineColor}
                            strokeWidth={2}
                            strokeDasharray="4 2"
                            connectNulls={true}
                            dot={{ r: 3, strokeWidth: 1, fill: 'rgb(var(--color-bg-secondary))' }}
                            activeDot={{ r: 5, strokeWidth: 2, fill: previousLineColor, stroke: 'rgb(var(--color-bg-secondary))' }}
                        />
                    )}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

// Keep original PropTypes, add timezone
DailyPerformanceChart.propTypes = {
    sessions: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string,
        date: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]).isRequired, // ISO string or Date obj
        nBack: PropTypes.number, // Allow null/undefined if calculation happens later
        difficulty: PropTypes.number, // Allow null/undefined
    })).isRequired,
    selectedPeriod: PropTypes.oneOf(['today', 'week', 'month', 'all']).isRequired,
    // Add timezone prop type
    timezone: PropTypes.string, // User's timezone string (e.g., 'America/New_York')
    // All-time daily stats for 'all' period
    allTimeDailyStats: PropTypes.arrayOf(PropTypes.shape({
        date: PropTypes.string.isRequired, // YYYY-MM-DD
        gameMode: PropTypes.string,
        sessionCount: PropTypes.number,
        totalStartLevel: PropTypes.number,
    })),
    // Game mode for filtering all-time stats ('all' shows multi-mode lines)
    gameMode: PropTypes.oneOf(['dual', 'triple', 'quad', 'all']),
};

// Add default prop for timezone
DailyPerformanceChart.defaultProps = {
    timezone: DEFAULT_TIMEZONE, // Use constant defined above
    allTimeDailyStats: null,
    gameMode: 'dual',
};

export default DailyPerformanceChart;
/* File: src\components\dashboard\utils\statsCalculator.js */

/* src/components/dashboard/utils/statsCalculator.js */

import { formatCombinedDifficulty } from '../../../contexts/gameHelpers';
import { formatTotalDuration } from './formatters'; // Assuming formatters is in the same dir
import { MODE_MODALITIES } from '../../../constants/modeStyles';
import { getSessionAccuracy } from '../../../utils/accuracy';

// Active modalities for a session/doc mode. Legacy records without
// gameMode predate Triple/Quad/Single — treat them as Dual.
const modalitiesFor = (mode) => MODE_MODALITIES[mode || 'dual'] || ['visual', 'audio'];

/**
 * Calculates aggregated statistics for a given array of sessions.
 * @param {Array} sessions - An array of session objects.
 * @returns {object|null} An object containing calculated stats or null if no sessions provided.
 */
export const calculateSessionStats = (sessions, options = {}) => {
  const { isClassicView = false } = options;
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return null;
  }

  const filteredSessions = sessions.filter(Boolean); // Ensure no null/undefined entries

  if (filteredSessions.length === 0) {
      return null;
  }

  // --- Initialize Calculation Variables ---
  const totalSessions = filteredSessions.length;
  let totalDurationMs = 0;
  let totalAccuracy = 0;
  let totalVisualAccuracy = 0;
  let totalAudioAccuracy = 0;
  let totalColorAccuracy = 0;
  let totalShapeAccuracy = 0;
  let totalDprime = 0;
  let totalStartLevel = 0;
  let highestEndLevel = -Infinity;
  let lowestStartLevel = Infinity;
  let validAccuracyCount = 0;
  let validVisualAccCount = 0;
  let validAudioAccCount = 0;
  let validColorAccCount = 0;
  let validShapeAccCount = 0;
  let validDprimeCount = 0;
  let validStartLevelCount = 0;
  let validEndLevelCount = 0;

  // --- Iterate and Calculate Metrics ---
  filteredSessions.forEach(session => {
    const activeModalities = modalitiesFor(session.gameMode);
    if (typeof session.durationMs === 'number' && isFinite(session.durationMs)) totalDurationMs += session.durationMs;

    // Accuracy is ALWAYS recomputed via the shared Jaeggi helper so Classic and
    // Adaptive sessions use one formula. Don't read stored `session.accuracy`.
    const acc = getSessionAccuracy(session, { gameMode: session.gameMode });
    if (typeof acc.overall === 'number' && isFinite(acc.overall)) { totalAccuracy += acc.overall; validAccuracyCount++; }
    if (activeModalities.includes('visual') && typeof acc.visual === 'number' && isFinite(acc.visual)) { totalVisualAccuracy += acc.visual; validVisualAccCount++; }
    if (activeModalities.includes('audio') && typeof acc.audio === 'number' && isFinite(acc.audio)) { totalAudioAccuracy += acc.audio; validAudioAccCount++; }
    if (activeModalities.includes('color') && typeof acc.color === 'number' && isFinite(acc.color)) { totalColorAccuracy += acc.color; validColorAccCount++; }
    if (activeModalities.includes('shape') && typeof acc.shape === 'number' && isFinite(acc.shape)) { totalShapeAccuracy += acc.shape; validShapeAccCount++; }
    if (typeof session.overallDprime === 'number' && isFinite(session.overallDprime)) { totalDprime += session.overallDprime; validDprimeCount++; }

    const startN = session.nBack;
    const startDiff = session.difficulty ?? 0;
    if (typeof startN === 'number' && typeof startDiff === 'number' && isFinite(startN) && isFinite(startDiff)) {
      const clampedStartDiff = Math.max(0, Math.min(0.95, startDiff));
      const startLevel = startN + clampedStartDiff;
      totalStartLevel += startLevel;
      lowestStartLevel = Math.min(lowestStartLevel, startLevel);
      validStartLevelCount++;
    }

    const endN = session.newNBack ?? startN;
    const endDiff = session.newDifficulty ?? startDiff;
    if (typeof endN === 'number' && typeof endDiff === 'number' && isFinite(endN) && isFinite(endDiff)) {
        const clampedEndDiff = Math.max(0, Math.min(0.95, endDiff));
        const endLevel = endN + clampedEndDiff;
        highestEndLevel = Math.max(highestEndLevel, endLevel);
        validEndLevelCount++;
    }
  });

  // --- Calculate Averages (handle division by zero) ---
  const avgAccuracy = validAccuracyCount > 0 ? totalAccuracy / validAccuracyCount : null;
  const avgVisualAccuracy = validVisualAccCount > 0 ? totalVisualAccuracy / validVisualAccCount : null;
  const avgAudioAccuracy = validAudioAccCount > 0 ? totalAudioAccuracy / validAudioAccCount : null;
  const avgColorAccuracy = validColorAccCount > 0 ? totalColorAccuracy / validColorAccCount : null;
  const avgShapeAccuracy = validShapeAccCount > 0 ? totalShapeAccuracy / validShapeAccCount : null;
  const avgDprime = validDprimeCount > 0 ? totalDprime / validDprimeCount : null;
  const avgStartLevel = validStartLevelCount > 0 ? totalStartLevel / validStartLevelCount : null;

  // --- Helper to format combined level values ---
  const formatLevel = (combinedLevel) => {
      if (combinedLevel === -Infinity || combinedLevel === Infinity || !isFinite(combinedLevel) || combinedLevel === null) return 'N/A';
      if (isClassicView) return String(Math.floor(combinedLevel));
      const nBack = Math.floor(combinedLevel);
      const difficulty = Math.max(0, combinedLevel - nBack);
      return formatCombinedDifficulty(nBack, difficulty);
  };

   // Ensure lowestStartLevel is finite before formatting
   const formattedLowestStartLevel = isFinite(lowestStartLevel) ? formatLevel(lowestStartLevel) : 'N/A';

  // --- Return the Calculated Stats ---
  return {
    totalSessions, // Already included
    totalDurationMs,
    avgAccuracy,
    avgVisualAccuracy,
    avgAudioAccuracy,
    avgColorAccuracy,
    avgShapeAccuracy,
    avgDprime,
    avgStartLevel: formatLevel(avgStartLevel),
    highestEndLevel: formatLevel(highestEndLevel),
    lowestStartLevel: formattedLowestStartLevel, // Use the potentially adjusted value
  };
};

/**
 * Per-modality d' averages across an array of sessions. Each modality only
 * counts sessions that:
 *   - are adaptive (`trainingMode !== 'classic'`)
 *   - have a game mode that actually tests that modality (single modes
 *     default untested modalities to 0/100 server-side)
 *   - have a finite numeric d' for that modality
 *
 * Returns null for a modality when no valid sample exists in the range.
 */
export const calculateModalityDprimes = (sessions) => {
    if (!Array.isArray(sessions) || sessions.length === 0) {
        return { avgVisualDprime: null, avgAudioDprime: null, avgColorDprime: null, avgShapeDprime: null };
    }

    let vSum = 0, vN = 0, aSum = 0, aN = 0, cSum = 0, cN = 0, sSum = 0, sN = 0;

    sessions.forEach(session => {
        if (!session || session.trainingMode === 'classic') return;
        const active = modalitiesFor(session.gameMode);
        if (active.includes('visual') && Number.isFinite(session.visualDprime)) { vSum += session.visualDprime; vN++; }
        if (active.includes('audio')  && Number.isFinite(session.audioDprime))  { aSum += session.audioDprime;  aN++; }
        if (active.includes('color')  && Number.isFinite(session.colorDprime))  { cSum += session.colorDprime;  cN++; }
        if (active.includes('shape')  && Number.isFinite(session.shapeDprime))  { sSum += session.shapeDprime;  sN++; }
    });

    return {
        avgVisualDprime: vN > 0 ? vSum / vN : null,
        avgAudioDprime:  aN > 0 ? aSum / aN : null,
        avgColorDprime:  cN > 0 ? cSum / cN : null,
        avgShapeDprime:  sN > 0 ? sSum / sN : null,
    };
};

/**
 * Formats the calculated stats for display.
 * @param {object|null} stats - The stats object returned by calculateSessionStats.
 * @returns {object|null} An object with formatted values or null.
 */
export const formatCalculatedStats = (stats) => {
    if (!stats) return null;

    const formatNum = (num, decimals = 1) => (num !== null && num !== undefined && Number.isFinite(num) ? num.toFixed(decimals) : 'N/A');
    const formattedTotalTime = formatTotalDuration(stats.totalDurationMs);

    const fmtModalityD = (val) => (val !== null && val !== undefined && Number.isFinite(val) ? formatNum(val, 1) : null);

    return {
        ...stats, // Include original calculated values (including totalSessions)
        // Add formatted values
        formattedTotalTime,
        formattedAvgAccuracy: `${formatNum(stats.avgAccuracy, 1)}%`,
        formattedAvgVisualAccuracy: stats.avgVisualAccuracy !== null ? `${formatNum(stats.avgVisualAccuracy, 1)}%` : null,
        formattedAvgAudioAccuracy: stats.avgAudioAccuracy !== null ? `${formatNum(stats.avgAudioAccuracy, 1)}%` : null,
        formattedAvgColorAccuracy: stats.avgColorAccuracy !== null ? `${formatNum(stats.avgColorAccuracy, 1)}%` : null,
        formattedAvgShapeAccuracy: stats.avgShapeAccuracy !== null ? `${formatNum(stats.avgShapeAccuracy, 1)}%` : null,
        formattedAvgDprime: formatNum(stats.avgDprime, 2),
        // Per-modality d' (1 decimal to match game-results Overview tab). Null when no adaptive samples.
        formattedAvgVisualDprime: fmtModalityD(stats.avgVisualDprime),
        formattedAvgAudioDprime:  fmtModalityD(stats.avgAudioDprime),
        formattedAvgColorDprime:  fmtModalityD(stats.avgColorDprime),
        formattedAvgShapeDprime:  fmtModalityD(stats.avgShapeDprime),
        // Levels are already formatted by calculateSessionStats
    };
}

/**
 * Aggregates daily stats documents for a given date range.
 * Used by Today/Week/Month stats views instead of filtering raw sessions.
 *
 * @param {Array} dailyStatsDocs - Array of dailyStats documents from Firestore.
 * @param {object} options - Options for filtering.
 * @param {string} options.startDate - Start date in YYYY-MM-DD format (inclusive).
 * @param {string} options.endDate - End date in YYYY-MM-DD format (inclusive).
 * @param {string} options.gameMode - Optional game mode to filter by ('dual', 'triple', 'quad').
 * @returns {object|null} An object containing calculated stats or null if no data.
 */
export const aggregateDailyStats = (dailyStatsDocs, options = {}) => {
    if (!Array.isArray(dailyStatsDocs) || dailyStatsDocs.length === 0) {
        return null;
    }

    const { startDate, endDate, gameMode, isClassicView = false } = options;

    // Filter docs by date range and game mode
    const filteredDocs = dailyStatsDocs.filter(doc => {
        if (!doc || !doc.date) return false;

        // Date range filter
        if (startDate && doc.date < startDate) return false;
        if (endDate && doc.date > endDate) return false;

        // Game mode filter (skip when 'all' to show combined stats)
        if (gameMode && gameMode !== 'all' && doc.gameMode !== gameMode) return false;

        return true;
    });

    if (filteredDocs.length === 0) {
        return null;
    }

    // Aggregate all the docs
    let totalSessions = 0;
    let totalDurationMs = 0;
    let totalStartLevel = 0;
    let highestEndLevel = -Infinity;
    let lowestStartLevel = Infinity;
    let avgAccuracySum = 0;
    let avgDprimeSum = 0;
    let avgVisualAccuracySum = 0;
    let avgAudioAccuracySum = 0;
    let avgColorAccuracySum = 0;
    let avgShapeAccuracySum = 0;
    let visualSessionCount = 0;
    let audioSessionCount = 0;
    let colorSessionCount = 0;
    let shapeSessionCount = 0;

    filteredDocs.forEach(doc => {
        const activeModalities = modalitiesFor(doc.gameMode);
        const docSessionCount = doc.sessionCount || 0;
        totalSessions += docSessionCount;
        totalDurationMs += doc.totalDurationMs || 0;
        totalStartLevel += doc.totalStartLevel || 0;

        if (doc.lowestStartLevel !== undefined && doc.lowestStartLevel !== null) {
            lowestStartLevel = Math.min(lowestStartLevel, doc.lowestStartLevel);
        }
        if (doc.highestEndLevel !== undefined && doc.highestEndLevel !== null) {
            highestEndLevel = Math.max(highestEndLevel, doc.highestEndLevel);
        }

        avgAccuracySum += doc.avgAccuracySum || 0;
        avgDprimeSum += doc.avgDprimeSum || 0;
        // Only accumulate a modality's sum from doc rows whose mode actually tests it.
        if (activeModalities.includes('visual')) {
            avgVisualAccuracySum += doc.avgVisualAccuracySum || 0;
            visualSessionCount += docSessionCount;
        }
        if (activeModalities.includes('audio')) {
            avgAudioAccuracySum += doc.avgAudioAccuracySum || 0;
            audioSessionCount += docSessionCount;
        }
        if (activeModalities.includes('color')) {
            avgColorAccuracySum += doc.avgColorAccuracySum || 0;
            colorSessionCount += docSessionCount;
        }
        if (activeModalities.includes('shape')) {
            avgShapeAccuracySum += doc.avgShapeAccuracySum || 0;
            shapeSessionCount += docSessionCount;
        }
    });

    if (totalSessions === 0) {
        return null;
    }

    // Calculate averages from sums
    const avgAccuracy = avgAccuracySum / totalSessions;
    const avgDprime = avgDprimeSum / totalSessions;
    const avgVisualAccuracy = visualSessionCount > 0 ? avgVisualAccuracySum / visualSessionCount : null;
    const avgAudioAccuracy = audioSessionCount > 0 ? avgAudioAccuracySum / audioSessionCount : null;
    const avgColorAccuracy = colorSessionCount > 0 ? avgColorAccuracySum / colorSessionCount : null;
    const avgShapeAccuracy = shapeSessionCount > 0 ? avgShapeAccuracySum / shapeSessionCount : null;
    const avgStartLevel = totalStartLevel / totalSessions;

    // Helper to format combined level values (same as in calculateSessionStats)
    const formatLevel = (combinedLevel) => {
        if (combinedLevel === -Infinity || combinedLevel === Infinity || !isFinite(combinedLevel) || combinedLevel === null) return 'N/A';
        if (isClassicView) return String(Math.floor(combinedLevel));
        const nBack = Math.floor(combinedLevel);
        const difficulty = Math.max(0, combinedLevel - nBack);
        return formatCombinedDifficulty(nBack, difficulty);
    };

    const formattedLowestStartLevel = isFinite(lowestStartLevel) ? formatLevel(lowestStartLevel) : 'N/A';

    // Return in the same format as calculateSessionStats for compatibility
    return {
        totalSessions,
        totalDurationMs,
        avgAccuracy,
        avgVisualAccuracy,
        avgAudioAccuracy,
        avgColorAccuracy,
        avgShapeAccuracy,
        avgDprime,
        avgStartLevel: formatLevel(avgStartLevel),
        highestEndLevel: formatLevel(highestEndLevel),
        lowestStartLevel: formattedLowestStartLevel,
    };
};

/**
 * Aggregates level range stats per game mode from daily stats docs.
 * Used by stat components when gameMode === 'all' to show per-mode level ranges.
 *
 * @param {Array} dailyStatsDocs - Array of dailyStats documents from Firestore.
 * @param {object} options - Options for date filtering.
 * @param {string} [options.startDate] - Start date in YYYY-MM-DD format (inclusive).
 * @param {string} [options.endDate] - End date in YYYY-MM-DD format (inclusive).
 * @returns {object} { dual: { low, avg, peak } | null, triple: ..., quad: ... }
 */
export const aggregatePerModeLevelStats = (dailyStatsDocs, options = {}) => {
    if (!Array.isArray(dailyStatsDocs) || dailyStatsDocs.length === 0) {
        return { dual: null, triple: null, quad: null };
    }

    const { startDate, endDate, isClassicView = false } = options;

    const formatLevel = (combinedLevel) => {
        if (combinedLevel === -Infinity || combinedLevel === Infinity || !isFinite(combinedLevel) || combinedLevel === null) return 'N/A';
        if (isClassicView) return String(Math.floor(combinedLevel));
        const nBack = Math.floor(combinedLevel);
        const difficulty = Math.max(0, combinedLevel - nBack);
        return formatCombinedDifficulty(nBack, difficulty);
    };

    const result = {};
    ['dual', 'triple', 'quad'].forEach(mode => {
        const modeDocs = dailyStatsDocs.filter(doc => {
            if (!doc || !doc.date) return false;
            if (startDate && doc.date < startDate) return false;
            if (endDate && doc.date > endDate) return false;
            return (doc.gameMode ?? 'dual') === mode;
        });

        if (modeDocs.length === 0) {
            result[mode] = null;
            return;
        }

        let totalStartLevel = 0;
        let totalSessions = 0;
        let lowestStartLevel = Infinity;
        let highestEndLevel = -Infinity;

        modeDocs.forEach(doc => {
            totalSessions += doc.sessionCount || 0;
            totalStartLevel += doc.totalStartLevel || 0;
            if (doc.lowestStartLevel != null) lowestStartLevel = Math.min(lowestStartLevel, doc.lowestStartLevel);
            if (doc.highestEndLevel != null) highestEndLevel = Math.max(highestEndLevel, doc.highestEndLevel);
        });

        if (totalSessions === 0) {
            result[mode] = null;
            return;
        }

        result[mode] = {
            low: isFinite(lowestStartLevel) ? formatLevel(lowestStartLevel) : 'N/A',
            avg: formatLevel(totalStartLevel / totalSessions),
            peak: formatLevel(highestEndLevel),
        };
    });

    return result;
};
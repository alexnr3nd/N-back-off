/* File: src\components\dashboard\TodaysStats.js */

/* src/components/dashboard/TodaysStats.js */

import React, { useMemo } from 'react';
// Removed formatCombinedDifficulty and formatTotalDuration imports as they are now handled by the utility
import { calculateSessionStats, formatCalculatedStats, aggregateDailyStats, aggregatePerModeLevelStats, calculateModalityDprimes } from './utils/statsCalculator';

/**
 * Get today's date in YYYY-MM-DD format (user's local timezone).
 */
const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Helper function to check if a date string represents today.
 * @param {string | Date} dateInput - ISO date string or Date object.
 * @returns {boolean} True if the date is today, false otherwise.
 */
const isDateToday = (dateInput) => {
  if (!dateInput) return false;
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (!(date instanceof Date) || isNaN(date.getTime())) return false; // Invalid date

    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  } catch (error) {
    console.error("Error checking date in isDateToday:", dateInput, error);
    return false;
  }
};

/**
 * Enhanced component to display statistics for sessions completed today.
 * Uses dailyStats (pre-aggregated backend data) when available, falls back to sessions.
 * Supports Dual, Triple, and Quad N-Back modes.
 */
const TodaysStats = ({ sessions, dailyStats, gameMode = 'dual', isClassicView = false, useSessionFallback = false }) => {

  // Memoize the calculation of today's stats
  const todaysRawStats = useMemo(() => {
    const todayDate = getTodayDateString();

    // When training mode filter is active, dailyStats can't be split by trainingMode — use sessions
    if (!useSessionFallback && Array.isArray(dailyStats) && dailyStats.length > 0) {
      return aggregateDailyStats(dailyStats, {
        startDate: todayDate,
        endDate: todayDate,
        gameMode: gameMode,
        isClassicView,
      });
    }

    // Fallback to sessions-based calculation
    const todaysSessions = Array.isArray(sessions)
      ? sessions.filter(session => session && isDateToday(session.date))
      : [];

    return calculateSessionStats(todaysSessions, { isClassicView });

  }, [sessions, dailyStats, gameMode, isClassicView, useSessionFallback]);

  // Per-modality d' averages are computed directly from raw sessions so that
  // the d' sub-line appears even when the main aggregation path reads from
  // dailyStats docs (which don't store per-modality d' sums).
  const modalityDprimes = useMemo(() => {
    const todaysSessions = Array.isArray(sessions)
      ? sessions.filter(session => session && isDateToday(session.date))
      : [];
    return calculateModalityDprimes(todaysSessions);
  }, [sessions]);

  // Format the calculated stats for display
  const formattedStats = useMemo(
    () => formatCalculatedStats(todaysRawStats ? { ...todaysRawStats, ...modalityDprimes } : null),
    [todaysRawStats, modalityDprimes]
  );

  // Per-mode level range stats (only when gameMode === 'all')
  const perModeLevels = useMemo(() => {
    if (gameMode !== 'all' || !Array.isArray(dailyStats) || dailyStats.length === 0) return null;
    const todayDate = getTodayDateString();
    return aggregatePerModeLevelStats(dailyStats, { startDate: todayDate, endDate: todayDate, isClassicView });
  }, [dailyStats, gameMode, isClassicView]);

  // --- Empty State: No Sessions Today ---
  if (!formattedStats) {
    return (
      <div className="specimen-card p-8 text-center">
        <div className="inline-block mb-4">
          <div className="w-16 h-16 border border-theme-line flex items-center justify-center text-theme-text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
        <h3 className="text-theme-text font-serif italic text-lg mb-2">No Data Recorded</h3>
        <p className="text-theme-text-muted text-sm font-mono mb-4">Session log empty for current date</p>
        <div className="inline-flex items-center gap-2 text-sm sm:text-xs text-theme-text-secondary bg-theme-bg-elevated px-3 py-1.5 border border-theme-line">
          <div className="w-1.5 h-1.5 bg-theme-accent rounded-full animate-pulse"></div>
          <span className="font-mono">Initialize training to begin data collection</span>
        </div>
      </div>
    );
  }

  // --- Render Lab-Style Stats Display ---
  return (
    <div className="specimen-card p-4 sm:p-6">
      {/* Header with session count badge */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-theme-accent"></div>
          <div>
            <h3 className="text-lg font-serif italic text-theme-text">Today's Data</h3>
            <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider">Training Analysis Report</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono text-theme-accent">{formattedStats.totalSessions}</div>
          <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase">Sessions</div>
        </div>
      </div>

      {/* Data Grid - Asymmetric 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

        {/* Left Column - Primary Metrics */}
        <div className="space-y-4">
          {/* Time & d' Prime Score - Featured (d' hidden in Classic view) */}
          <div className="bg-theme-bg-elevated border border-theme-line p-4">
            <div className={`grid gap-4 ${isClassicView ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <div>
                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-1">Total Duration</div>
                <div className="text-xl sm:text-2xl font-mono text-theme-text">{formattedStats.formattedTotalTime}</div>
              </div>
              {!isClassicView && (
                <div className="border-l border-theme-line pl-4">
                  <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-1">Avg d′ Score</div>
                  <div className="text-xl sm:text-2xl font-mono text-theme-accent">{formattedStats.formattedAvgDprime}</div>
                </div>
              )}
            </div>
          </div>

          {/* Level Progress - Horizontal bar style */}
          <div className="bg-theme-bg-elevated border border-theme-line p-4">
            <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-3">Level Range</div>
            {gameMode === 'all' && perModeLevels && (perModeLevels.dual || perModeLevels.triple || perModeLevels.quad) ? (
              <div className="space-y-3">
                {[
                  { mode: 'dual', label: 'Dual', color: 'text-yellow-400', dot: 'bg-yellow-400', line: 'via-yellow-400' },
                  { mode: 'triple', label: 'Triple', color: 'text-purple-400', dot: 'bg-purple-400', line: 'via-purple-400' },
                  { mode: 'quad', label: 'Quad', color: 'text-cyan-400', dot: 'bg-cyan-400', line: 'via-cyan-400' },
                ].map(({ mode, label, color, dot, line }) => {
                  const data = perModeLevels[mode];
                  if (!data) return null;
                  return (
                    <div key={mode}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 ${dot}`}></div>
                        <span className={`text-xs font-mono uppercase ${color}`}>{label}</span>
                      </div>
                      <div className="flex items-center justify-between pl-4">
                        <div className="text-center">
                          <div className="text-[0.6875rem] text-theme-text-muted">Low</div>
                          <div className="text-sm font-mono text-theme-text-secondary">{data.low}</div>
                        </div>
                        <div className={`flex-1 mx-3 h-px bg-gradient-to-r from-theme-text-muted ${line} to-theme-text-muted`}></div>
                        <div className="text-center">
                          <div className="text-[0.6875rem] text-theme-text-muted">Avg</div>
                          <div className="text-sm font-mono text-theme-text">{data.avg}</div>
                        </div>
                        <div className={`flex-1 mx-3 h-px bg-gradient-to-r from-theme-text-muted ${line} to-theme-text-muted`}></div>
                        <div className="text-center">
                          <div className="text-[0.6875rem] text-theme-text-muted">Peak</div>
                          <div className={`text-sm font-mono ${color}`}>{data.peak}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <div className="text-sm sm:text-xs text-theme-text-muted mb-1">Low</div>
                  <div className="text-lg font-mono text-theme-text-secondary">{formattedStats.lowestStartLevel}</div>
                </div>
                <div className="flex-1 mx-4 h-px bg-gradient-to-r from-theme-text-muted via-theme-accent to-theme-text-muted"></div>
                <div className="text-center">
                  <div className="text-sm sm:text-xs text-theme-text-muted mb-1">Avg</div>
                  <div className="text-lg font-mono text-theme-text">{formattedStats.avgStartLevel}</div>
                </div>
                <div className="flex-1 mx-4 h-px bg-gradient-to-r from-theme-text-muted via-theme-accent to-theme-text-muted"></div>
                <div className="text-center">
                  <div className="text-sm sm:text-xs text-theme-text-muted mb-1">Peak</div>
                  <div className="text-lg font-mono text-theme-accent">{formattedStats.highestEndLevel}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Accuracy Breakdown */}
        <div className="bg-theme-bg-elevated border border-theme-line p-4">
          <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-4">Accuracy Metrics</div>

          {(() => {
            // Single-modality modes show only the tested modality — the other three
            // would read as "100%" or "0%" (untested defaults) and mislead.
            const singleInfo = {
              singleVisual: { label: 'Position', accuracy: formattedStats.formattedAvgVisualAccuracy, dprime: formattedStats.formattedAvgVisualDprime, color: 'text-theme-accent',       dot: 'bg-theme-accent'       },
              singleAudio:  { label: 'Audio',    accuracy: formattedStats.formattedAvgAudioAccuracy,  dprime: formattedStats.formattedAvgAudioDprime,  color: 'text-theme-neural-green', dot: 'bg-theme-neural-green' },
              singleColor:  { label: 'Color',    accuracy: formattedStats.formattedAvgColorAccuracy,  dprime: formattedStats.formattedAvgColorDprime,  color: 'text-purple-400',         dot: 'bg-purple-400'         },
              singleShape:  { label: 'Shape',    accuracy: formattedStats.formattedAvgShapeAccuracy,  dprime: formattedStats.formattedAvgShapeDprime,  color: 'text-cyan-400',           dot: 'bg-cyan-400'           },
            }[gameMode];

            if (singleInfo) {
              return (
                <div>
                  <div className="flex items-end justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 ${singleInfo.dot}`}></div>
                      <span className="text-sm text-theme-text-secondary font-serif italic">{singleInfo.label} Accuracy</span>
                    </div>
                    <span className={`text-2xl font-mono ${singleInfo.color}`}>{singleInfo.accuracy || 'N/A'}</span>
                  </div>
                  {!isClassicView && singleInfo.dprime && (
                    <div className="text-right text-sm sm:text-xs font-mono text-theme-text-muted mt-1">d′ {singleInfo.dprime}</div>
                  )}
                </div>
              );
            }

            const hasColor = gameMode === 'triple' || gameMode === 'quad' || (gameMode === 'all' && formattedStats.formattedAvgColorAccuracy);
            const hasShape = gameMode === 'quad' || (gameMode === 'all' && formattedStats.formattedAvgShapeAccuracy);
            return (
              <>
                {/* Overall Accuracy - Featured */}
                <div className="mb-4 pb-4 border-b border-theme-line">
                  <div className="flex items-end justify-between">
                    <span className="text-sm text-theme-text-secondary font-serif italic">Overall Accuracy</span>
                    <span className="text-2xl font-mono text-theme-text">{formattedStats.formattedAvgAccuracy}</span>
                  </div>
                </div>

                {/* Modality Accuracies - Adaptive grid based on mode */}
                <div className={`grid gap-4 ${hasShape ? 'grid-cols-2' : hasColor ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {/* Position */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-theme-accent"></div>
                      <span className="text-sm sm:text-xs text-theme-text-muted font-mono uppercase">Position</span>
                    </div>
                    <div className="text-xl font-mono text-theme-accent">{formattedStats.formattedAvgVisualAccuracy || 'N/A'}</div>
                    {!isClassicView && formattedStats.formattedAvgVisualDprime && (
                      <div className="text-sm sm:text-xs font-mono text-theme-text-muted mt-1">d′ {formattedStats.formattedAvgVisualDprime}</div>
                    )}
                  </div>
                  {/* Audio */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-theme-neural-green"></div>
                      <span className="text-sm sm:text-xs text-theme-text-muted font-mono uppercase">Audio</span>
                    </div>
                    <div className="text-xl font-mono text-theme-neural-green">{formattedStats.formattedAvgAudioAccuracy || 'N/A'}</div>
                    {!isClassicView && formattedStats.formattedAvgAudioDprime && (
                      <div className="text-sm sm:text-xs font-mono text-theme-text-muted mt-1">d′ {formattedStats.formattedAvgAudioDprime}</div>
                    )}
                  </div>
                  {/* Color - Triple/Quad/All (only if data exists) */}
                  {hasColor && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-purple-400"></div>
                        <span className="text-sm sm:text-xs text-theme-text-muted font-mono uppercase">Color</span>
                      </div>
                      <div className="text-xl font-mono text-purple-400">{formattedStats.formattedAvgColorAccuracy || 'N/A'}</div>
                      {!isClassicView && formattedStats.formattedAvgColorDprime && (
                        <div className="text-sm sm:text-xs font-mono text-theme-text-muted mt-1">d′ {formattedStats.formattedAvgColorDprime}</div>
                      )}
                    </div>
                  )}
                  {/* Shape - Quad/All (only if data exists) */}
                  {hasShape && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-cyan-400"></div>
                        <span className="text-sm sm:text-xs text-theme-text-muted font-mono uppercase">Shape</span>
                      </div>
                      <div className="text-xl font-mono text-cyan-400">{formattedStats.formattedAvgShapeAccuracy || 'N/A'}</div>
                      {!isClassicView && formattedStats.formattedAvgShapeDprime && (
                        <div className="text-sm sm:text-xs font-mono text-theme-text-muted mt-1">d′ {formattedStats.formattedAvgShapeDprime}</div>
                      )}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default TodaysStats;
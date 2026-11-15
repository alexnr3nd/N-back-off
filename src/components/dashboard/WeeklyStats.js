/* File: src\components\dashboard\WeeklyStats.js */

/* src/components/dashboard/WeeklyStats.js */
import React, { useMemo } from 'react';
import { calculateSessionStats, formatCalculatedStats, aggregateDailyStats, aggregatePerModeLevelStats, calculateModalityDprimes } from './utils/statsCalculator';

/**
 * Get the last 7 days date range (including today) as YYYY-MM-DD strings.
 */
const getLast7DaysDateRange = () => {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6); // 6 days back + today = 7 days

  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    startDate: formatDate(sevenDaysAgo),
    endDate: formatDate(today)
  };
};

/**
 * Helper function to check if a date falls within the last 7 days (including today).
 * @param {string | Date} dateInput - ISO date string or Date object.
 * @returns {boolean} True if the date is within the last 7 days, false otherwise.
 */
const isDateInLast7Days = (dateInput) => {
  if (!dateInput) return false;
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (!(date instanceof Date) || isNaN(date.getTime())) return false; // Invalid date

    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0); // Start of 7 days ago

    return date >= sevenDaysAgo && date <= today;

  } catch (error) {
    console.error("Error checking date in isDateInLast7Days:", dateInput, error);
    return false;
  }
};

/**
 * Component to display statistics for sessions completed in the last 7 days.
 * Uses dailyStats (pre-aggregated backend data) when available, falls back to sessions.
 * Supports Dual, Triple, and Quad N-Back modes.
 */
const WeeklyStats = ({ sessions, dailyStats, gameMode = 'dual', isClassicView = false, useSessionFallback = false }) => {

  // Memoize the calculation of last 7 days stats
  const weeklyStats = useMemo(() => {
    const { startDate, endDate } = getLast7DaysDateRange();

    // When training mode filter is active, dailyStats can't be split by trainingMode — use sessions
    if (!useSessionFallback && Array.isArray(dailyStats) && dailyStats.length > 0) {
      return aggregateDailyStats(dailyStats, {
        startDate,
        endDate,
        gameMode: gameMode,
        isClassicView,
      });
    }

    // Fallback to sessions-based calculation
    const weeklySessions = Array.isArray(sessions)
      ? sessions.filter(session => session && isDateInLast7Days(session.date))
      : [];

    return calculateSessionStats(weeklySessions, { isClassicView });

  }, [sessions, dailyStats, gameMode, isClassicView, useSessionFallback]);

  // Per-modality d' averages computed directly from raw sessions so the d'
  // sub-line appears even when main aggregation reads from dailyStats docs.
  const modalityDprimes = useMemo(() => {
    const weeklySessions = Array.isArray(sessions)
      ? sessions.filter(session => session && isDateInLast7Days(session.date))
      : [];
    return calculateModalityDprimes(weeklySessions);
  }, [sessions]);

  // Format the calculated stats for display
  const formattedStats = useMemo(
    () => formatCalculatedStats(weeklyStats ? { ...weeklyStats, ...modalityDprimes } : null),
    [weeklyStats, modalityDprimes]
  );

  // Per-mode level range stats (only when gameMode === 'all')
  const perModeLevels = useMemo(() => {
    if (gameMode !== 'all' || !Array.isArray(dailyStats) || dailyStats.length === 0) return null;
    const { startDate, endDate } = getLast7DaysDateRange();
    return aggregatePerModeLevelStats(dailyStats, { startDate, endDate, isClassicView });
  }, [dailyStats, gameMode, isClassicView]);

  // --- Empty State: No Sessions This Week ---
  if (!formattedStats) {
    return (
      <div className="specimen-card p-8 text-center">
        <div className="inline-block mb-4">
          <div className="w-16 h-16 border border-theme-line flex items-center justify-center text-theme-text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <h3 className="text-theme-text font-serif italic text-lg mb-2">No Weekly Data</h3>
        <p className="text-theme-text-muted text-sm font-mono mb-4">Session log empty for current week</p>
        <div className="inline-flex items-center gap-2 text-sm sm:text-xs text-theme-text-secondary bg-theme-bg-elevated px-3 py-1.5 border border-theme-line">
          <div className="w-1.5 h-1.5 bg-theme-accent rounded-full animate-pulse"></div>
          <span className="font-mono">Begin training to populate weekly metrics</span>
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
          <div className="w-1 h-8 bg-theme-neural-blue"></div>
          <div>
            <h3 className="text-lg font-serif italic text-theme-text">Weekly Summary</h3>
            <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider">7-Day Analysis Report</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono text-theme-neural-blue">{formattedStats.totalSessions}</div>
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
                <div className="flex-1 mx-4 h-px bg-gradient-to-r from-theme-text-muted via-theme-neural-blue to-theme-text-muted"></div>
                <div className="text-center">
                  <div className="text-sm sm:text-xs text-theme-text-muted mb-1">Avg</div>
                  <div className="text-lg font-mono text-theme-text">{formattedStats.avgStartLevel}</div>
                </div>
                <div className="flex-1 mx-4 h-px bg-gradient-to-r from-theme-text-muted via-theme-neural-blue to-theme-text-muted"></div>
                <div className="text-center">
                  <div className="text-sm sm:text-xs text-theme-text-muted mb-1">Peak</div>
                  <div className="text-lg font-mono text-theme-neural-blue">{formattedStats.highestEndLevel}</div>
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

export default WeeklyStats;
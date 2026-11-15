/* File: src/components/dashboard/AllTimeStats.js */

import React, { useMemo, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { aggregateDailyStats, formatCalculatedStats, aggregatePerModeLevelStats, calculateModalityDprimes } from './utils/statsCalculator';

/**
 * Component to display lifetime statistics.
 * Uses allTimeDailyStats (pre-aggregated backend data) for all-time view.
 * Supports Dual, Triple, and Quad N-Back modes.
 *
 * The `sessions` prop is the 60-day activeSessions window — it only feeds the
 * per-modality d' sub-lines. Headline totals must NEVER be derived from it:
 * dailyStats docs carry no Adaptive/Classic split, so the training-mode filter
 * cannot be applied to lifetime totals. When the user has both modes,
 * `includesBothTrainingModes` renders a caption saying so.
 */
const AllTimeStats = ({ sessions, gameMode = 'dual', isClassicView = false, includesBothTrainingModes = false, timezone }) => {
  const {
    allTimeDailyStats,
    isLoadingAllTimeStats,
    fetchAllTimeData,
  } = useUser();

  // Trigger fetch when component mounts (lazy loading)
  useEffect(() => {
    fetchAllTimeData();
  }, [fetchAllTimeData]);

  // Memoize the calculation of all-time stats
  const allTimeStats = useMemo(() => {
    if (!Array.isArray(allTimeDailyStats) || allTimeDailyStats.length === 0) {
      return null;
    }

    // No date filtering - use all data, just filter by game mode
    return aggregateDailyStats(allTimeDailyStats, {
      gameMode: gameMode,
      isClassicView,
    });

  }, [allTimeDailyStats, gameMode, isClassicView]);

  // Calculate additional metadata (first session date, days with training)
  const metaStats = useMemo(() => {
    if (!Array.isArray(allTimeDailyStats) || allTimeDailyStats.length === 0) {
      return null;
    }

    // Filter by game mode first (skip filter when 'all')
    const modeFiltered = gameMode === 'all'
      ? allTimeDailyStats
      : allTimeDailyStats.filter(doc => doc.gameMode === gameMode);
    if (modeFiltered.length === 0) return null;

    // Sort by date to find first and last
    const sorted = [...modeFiltered].sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = sorted[0]?.date;
    const lastDate = sorted[sorted.length - 1]?.date;

    // Count unique training days
    const uniqueDays = new Set(modeFiltered.map(doc => doc.date)).size;

    return {
      firstDate,
      lastDate,
      daysWithTraining: uniqueDays,
    };
  }, [allTimeDailyStats, gameMode]);

  // Per-modality d' averages computed directly from raw sessions (no date filter)
  // so the d' sub-line appears even when main aggregation reads from allTimeDailyStats docs.
  const modalityDprimes = useMemo(
    () => calculateModalityDprimes(Array.isArray(sessions) ? sessions : []),
    [sessions]
  );

  // Format the calculated stats for display
  const formattedStats = useMemo(
    () => formatCalculatedStats(allTimeStats ? { ...allTimeStats, ...modalityDprimes } : null),
    [allTimeStats, modalityDprimes]
  );

  // Per-mode level range stats (only when gameMode === 'all')
  const perModeLevels = useMemo(() => {
    if (gameMode !== 'all' || !Array.isArray(allTimeDailyStats) || allTimeDailyStats.length === 0) return null;
    return aggregatePerModeLevelStats(allTimeDailyStats, { isClassicView });
  }, [allTimeDailyStats, gameMode, isClassicView]);

  // Format first session date for display
  const formattedFirstDate = useMemo(() => {
    if (!metaStats?.firstDate) return null;
    try {
      const date = new Date(metaStats.firstDate + 'T00:00:00');
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return metaStats.firstDate;
    }
  }, [metaStats?.firstDate]);

  // --- Loading State ---
  if (isLoadingAllTimeStats) {
    return (
      <div className="specimen-card p-8 text-center">
        <div className="inline-block mb-4">
          <div className="w-16 h-16 border border-theme-line flex items-center justify-center text-theme-text-muted animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>
        <h3 className="text-theme-text font-serif italic text-lg mb-2">Loading Lifetime Data</h3>
        <p className="text-theme-text-muted text-sm font-mono">Retrieving complete training history...</p>
      </div>
    );
  }

  // --- Empty State: No Sessions Ever ---
  if (!formattedStats) {
    return (
      <div className="specimen-card p-8 text-center">
        <div className="inline-block mb-4">
          <div className="w-16 h-16 border border-theme-line flex items-center justify-center text-theme-text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>
        <h3 className="text-theme-text font-serif italic text-lg mb-2">No Lifetime Data</h3>
        <p className="text-theme-text-muted text-sm font-mono mb-4">Session log empty</p>
        <div className="inline-flex items-center gap-2 text-sm sm:text-xs text-theme-text-secondary bg-theme-bg-elevated px-3 py-1.5 border border-theme-line">
          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></div>
          <span className="font-mono">Begin training to populate lifetime metrics</span>
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
          <div className="w-1 h-8 bg-indigo-400"></div>
          <div>
            <h3 className="text-lg font-serif italic text-theme-text">Lifetime Summary</h3>
            <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider">Complete Training History</p>
            {includesBothTrainingModes && (
              <p className="mt-1 text-xs sm:text-[0.6875rem] text-theme-text-muted font-mono">
                Includes both Adaptive and Classic sessions. The Adaptive / Classic filter applies to Today, Week and Month.
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono text-indigo-400">{formattedStats.totalSessions}</div>
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
                  <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-1">Avg d' Score</div>
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
                <div className="flex-1 mx-4 h-px bg-gradient-to-r from-theme-text-muted via-indigo-400 to-theme-text-muted"></div>
                <div className="text-center">
                  <div className="text-sm sm:text-xs text-theme-text-muted mb-1">Avg</div>
                  <div className="text-lg font-mono text-theme-text">{formattedStats.avgStartLevel}</div>
                </div>
                <div className="flex-1 mx-4 h-px bg-gradient-to-r from-theme-text-muted via-indigo-400 to-theme-text-muted"></div>
                <div className="text-center">
                  <div className="text-sm sm:text-xs text-theme-text-muted mb-1">Peak</div>
                  <div className="text-lg font-mono text-indigo-400">{formattedStats.highestEndLevel}</div>
                </div>
              </div>
            )}
          </div>

          {/* Training Timeline */}
          {metaStats && (
            <div className="bg-theme-bg-elevated border border-theme-line p-4">
              <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-3">Training Timeline</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm sm:text-xs text-theme-text-muted mb-1">First Session</div>
                  <div className="text-base font-mono text-theme-text">{formattedFirstDate || 'N/A'}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm sm:text-xs text-theme-text-muted mb-1">Days Trained</div>
                  <div className="text-base font-mono text-indigo-400">{metaStats.daysWithTraining}</div>
                </div>
              </div>
            </div>
          )}
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

export default AllTimeStats;

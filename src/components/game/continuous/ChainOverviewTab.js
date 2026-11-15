/* File: src/components/game/continuous/ChainOverviewTab.js */
// Visual mirror of GameResults Overview tab structure — keep in sync.
// Sections: cap callout (continuous-specific) → performance gauge panel
// (lines 1016-1219 in GameResults) → ChainRangePanel (replaces Level Progression
// panel) → promotional card.
// Performance Scale Reference lives in ChainDetailedTab (matches GameResults).

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { GAME_MODES } from '../../../constants/gameConstants';
import ChainRangePanel from './ChainRangePanel';

const ChainOverviewTab = ({
    gameResults,
    displayAcc,
    performanceCategory,
    performanceDisplay,
    isClassicMode,
    selectedCard,
    formatNum,
    formatAcc,
}) => {
    const {
        gameMode = 'dual',
        overallDprime = null,
        visualDprime = null, visualCorrect = null, visualTargetCount = null, visualFalseAlarms = null,
        audioDprime = null, audioCorrect = null, audioTargetCount = null, audioFalseAlarms = null,
        colorDprime = null, colorCorrect = null, colorTargetCount = null, colorFalseAlarms = null,
        shapeDprime = null, shapeCorrect = null, shapeTargetCount = null, shapeFalseAlarms = null,
        chainSummary = {},
        newNBack = null,
        newDifficulty = null,
        preSessionProfileContext = null,
    } = gameResults || {};

    const cs = chainSummary || {};
    const cappedReason = cs.chainCappedReason ?? gameResults?.chainCappedReason;
    // Client-only flag set by GameContext when a capped cohort's chain stopped at a
    // block boundary because the daily Adaptive allowance ran out (never persisted).
    const endedByDailyCap = cs.endedByDailyCap === true;

    // Modality detection mirrors GameResults
    const modeModalities = GAME_MODES[gameMode]?.modalities || ['visual', 'audio'];
    const hasVisualModality = modeModalities.includes('visual');
    const hasAudioModality = modeModalities.includes('audio');
    const hasColorModality = modeModalities.includes('color');
    const hasShapeModality = modeModalities.includes('shape');
    const activeModalityCount = modeModalities.length;
    const accuracyTextSize = activeModalityCount >= 4 ? 'text-xl' : 'text-2xl';

    const dprimeGaugePercent = overallDprime !== null
        ? Math.min(100, Math.max(0, (overallDprime / 4) * 100))
        : 0;

    const gaugeFillClass = (
        performanceCategory === 'excellent' || performanceCategory === 'very-good' ? 'bg-theme-neural-green'
            : performanceCategory === 'good' ? 'bg-theme-neural-blue'
            : performanceCategory === 'fair' ? 'bg-theme-accent'
            : 'bg-theme-neural-red'
    );

    return (
        <div className="space-y-4">

            {/* Daily Adaptive cap callout — chain ended early at a block boundary */}
            {endedByDailyCap && (
                <div className="bg-theme-accent/10 border border-theme-accent/30 p-4">
                    <div className="flex items-start gap-3">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="h-5 w-5 text-theme-accent flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-mono text-theme-accent">
                                Chain ended — daily Adaptive cap reached
                            </p>
                            <p className="text-xs font-mono text-theme-text-muted mt-1">
                                Every session in a chain counts toward the daily Adaptive limit. It resets at midnight local time.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Cap callout — continuous-specific, above the gauge */}
            {cappedReason && cappedReason !== 'user-stop' && (
                <div className="bg-theme-accent/10 border border-theme-accent/30 p-4">
                    <div className="flex items-start gap-3">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="h-5 w-5 text-theme-accent flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-mono text-theme-accent">
                                {cappedReason === 'duration' && 'Chain capped at 30 minutes'}
                                {cappedReason === 'blocks' && 'Chain capped at 50 sessions'}
                                {cappedReason !== 'duration' && cappedReason !== 'blocks' && 'Chain capped'}
                            </p>
                            <p className="text-xs font-mono text-theme-text-muted mt-1">
                                Your brain has had enough for one go. Consistent shorter sessions outperform marathon ones.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Performance Gauge Panel — visual mirror of GameResults lines 1016-1219, keep in sync */}
            <div className="border border-theme-line bg-theme-bg-elevated p-4 relative">
                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-theme-accent/30" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-theme-accent/30" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-theme-accent/30" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-theme-accent/30" />

                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
                    {isClassicMode ? (
                        /* Classic: Accuracy Gauge */
                        <div className="flex-1">
                            <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-2">
                                Chain Accuracy
                            </div>
                            <div className="flex items-end gap-3">
                                <span className="text-2xl font-mono font-bold text-theme-text">
                                    {formatAcc(displayAcc.overall)}%
                                </span>
                                <span className="text-xs font-mono pb-1 text-theme-text-secondary">
                                    {performanceDisplay.text}
                                </span>
                            </div>
                            <div className="mt-3 h-2 bg-theme-bg-elevated border border-theme-line relative overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ${gaugeFillClass}`}
                                    style={{ width: `${Math.min(100, displayAcc.overall || 0)}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-1 text-[0.6875rem] font-medium sm:text-[0.5625rem] sm:font-normal font-mono text-theme-text-muted">
                                <span>0%</span>
                                <span>50%</span>
                                <span>100%</span>
                            </div>
                        </div>
                    ) : (
                        /* Adaptive: D-Prime Gauge */
                        <div className="flex-1">
                            <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-2">
                                Chain Sensitivity (d′)
                            </div>
                            <div className="flex items-end gap-3">
                                <span className={`text-4xl font-mono font-bold ${performanceDisplay.textClass}`}>
                                    {formatNum(overallDprime, 2)}
                                </span>
                                <span className="text-xs font-mono text-theme-text-muted pb-1">
                                    {performanceDisplay.text}
                                </span>
                            </div>
                            <div className="mt-3 h-2 bg-theme-bg-elevated border border-theme-line relative overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ${gaugeFillClass}`}
                                    style={{ width: `${dprimeGaugePercent}%` }}
                                />
                                <div className="absolute inset-0 flex">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="flex-1 border-r border-theme-line/50" />
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-between mt-1 text-[0.6875rem] font-medium sm:text-[0.5625rem] sm:font-normal font-mono text-theme-text-muted">
                                <span>0</span>
                                <span>1</span>
                                <span>2</span>
                                <span>3</span>
                                <span>4+</span>
                            </div>
                        </div>
                    )}

                    {/* Divider */}
                    <div className="hidden sm:block w-px h-20 bg-theme-line" />

                    {/* Modality Scores grid (chain-aggregated) */}
                    <div className={`grid gap-4 sm:gap-6 ${
                        activeModalityCount === 1 ? 'grid-cols-1' :
                        activeModalityCount === 4 ? 'grid-cols-2 sm:grid-cols-4' :
                        activeModalityCount === 3 ? 'grid-cols-3' : 'grid-cols-2'
                    }`}>
                        {hasVisualModality && (
                            <div className="text-center">
                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-1">
                                    Position
                                </div>
                                <div className={`${accuracyTextSize} font-mono font-bold text-theme-neural-blue`}>
                                    {formatAcc(displayAcc.visual)}%
                                </div>
                                {!isClassicMode && (
                                    <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                        d′ {formatNum(visualDprime, 1)}
                                    </div>
                                )}
                                {isClassicMode && (
                                    <>
                                        <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                            {visualCorrect ?? '?'}/{visualTargetCount ?? '?'} hits
                                        </div>
                                        <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                            {visualFalseAlarms ?? '?'} false alarm{visualFalseAlarms !== 1 ? 's' : ''}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {hasAudioModality && (
                            <div className="text-center">
                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-1">
                                    Audio
                                </div>
                                <div className={`${accuracyTextSize} font-mono font-bold text-theme-neural-green`}>
                                    {formatAcc(displayAcc.audio)}%
                                </div>
                                {!isClassicMode && (
                                    <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                        d′ {formatNum(audioDprime, 1)}
                                    </div>
                                )}
                                {isClassicMode && (
                                    <>
                                        <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                            {audioCorrect ?? '?'}/{audioTargetCount ?? '?'} hits
                                        </div>
                                        <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                            {audioFalseAlarms ?? '?'} false alarm{audioFalseAlarms !== 1 ? 's' : ''}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {hasColorModality && (
                            <div className="text-center">
                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-1">
                                    Color
                                </div>
                                <div className={`${accuracyTextSize} font-mono font-bold text-theme-accent`}>
                                    {formatAcc(displayAcc.color)}%
                                </div>
                                {!isClassicMode && (
                                    <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                        d′ {formatNum(colorDprime, 1)}
                                    </div>
                                )}
                                {isClassicMode && (
                                    <>
                                        <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                            {colorCorrect ?? '?'}/{colorTargetCount ?? '?'} hits
                                        </div>
                                        <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                            {colorFalseAlarms ?? '?'} false alarm{colorFalseAlarms !== 1 ? 's' : ''}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {hasShapeModality && (
                            <div className="text-center">
                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-1">
                                    Shape
                                </div>
                                <div className={`${accuracyTextSize} font-mono font-bold text-theme-neural-red`}>
                                    {formatAcc(displayAcc.shape)}%
                                </div>
                                {!isClassicMode && (
                                    <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                        d′ {formatNum(shapeDprime, 1)}
                                    </div>
                                )}
                                {isClassicMode && (
                                    <>
                                        <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                            {shapeCorrect ?? '?'}/{shapeTargetCount ?? '?'} hits
                                        </div>
                                        <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                            {shapeFalseAlarms ?? '?'} false alarm{shapeFalseAlarms !== 1 ? 's' : ''}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Chain Range / Outcome Panel */}
            <ChainRangePanel
                isClassicMode={isClassicMode}
                nDdRange={cs.nDdRange ?? null}
                nDdAverage={cs.nDdAverage ?? null}
                newNBack={newNBack}
                newDifficulty={newDifficulty}
                originalNBack={preSessionProfileContext?.originalNBack ?? null}
                chainTotalBlocks={cs.totalBlocks ?? (Array.isArray(cs.blocks) ? cs.blocks.length : 0)}
            />

            {/* Promotional / upsell card */}
            {selectedCard}
        </div>
    );
};

export default ChainOverviewTab;

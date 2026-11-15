/* File: src/components/game/continuous/ChainDetailedTab.js */
// Visual mirror of GameResults.js Detailed Analysis tab (lines 1387-1602), scoped to
// the chain. Sections (in order):
//   1. Per-modality Channel cards (chain-aggregate Acc / Hits / False Alarms / d′)
//   2. Chain Parameters 4-cell grid (Total Trials / Total Duration / Sessions / Current)
//   3. Performance Scale Reference (Adaptive only)
//   4. Per-session expandable list (folded in from the removed Sessions tab)
//
// Counts are chain-rolled by the backend (functions/game.js:1015-1024); per-session
// rows render from chainSummary.blocks via the existing ChainSessionRow component.

import React, { useState, useCallback } from 'react';
import { GAME_MODES } from '../../../constants/gameConstants';
import { formatDuration } from '../../dashboard/utils/formatters';
import { formatCombinedDifficulty } from '../../../contexts/gameHelpers';
import ChannelPerformanceCard from '../ChannelPerformanceCard';
import ChainSessionRow from './ChainSessionRow';

const ChainDetailedTab = ({
    gameResults,
    displayAcc,
    performanceCategory,
    isClassicMode,
    veryGoodT = null,
    totalTrials,
    totalDurationMs,
    totalBlocks,
    formatNum,
    formatAcc,
    blocks = [],
    newNBack = null,
    newDifficulty = null,
}) => {
    const {
        gameMode = 'dual',
        overallDprime = null,
        visualCorrect = null, visualTargetCount = null, visualFalseAlarms = null, visualDprime = null,
        audioCorrect = null, audioTargetCount = null, audioFalseAlarms = null, audioDprime = null,
        colorCorrect = null, colorTargetCount = null, colorFalseAlarms = null, colorDprime = null,
        shapeCorrect = null, shapeTargetCount = null, shapeFalseAlarms = null, shapeDprime = null,
        // Chain-wide hits-only median RT (ms) per modality — null for Classic/zero hits
        visualHitRTMedian = null, audioHitRTMedian = null,
        colorHitRTMedian = null, shapeHitRTMedian = null,
        excellentThreshold = null, goodThreshold = null, fairThreshold = null,
    } = gameResults || {};

    const modeModalities = GAME_MODES[gameMode]?.modalities || ['visual', 'audio'];
    const hasVisualModality = modeModalities.includes('visual');
    const hasAudioModality = modeModalities.includes('audio');
    const hasColorModality = modeModalities.includes('color');
    const hasShapeModality = modeModalities.includes('shape');
    const activeModalityCount = modeModalities.length;

    const thresholdsValid = excellentThreshold !== null && goodThreshold !== null && fairThreshold !== null;

    const gridCols =
        activeModalityCount === 1 ? 'grid-cols-1' :
        activeModalityCount === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
        activeModalityCount === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2';

    // "Current" — the level the user lands at next chain (newNBack/newDifficulty
    // from the backend). Adaptive shows N.DD; Classic shows N (no decimal because
    // Classic doesn't track sub-N difficulty).
    const currentLabel = (() => {
        if (typeof newNBack !== 'number') return '—';
        if (isClassicMode) return `${newNBack}`;
        if (typeof newDifficulty !== 'number') return `${newNBack}`;
        return formatCombinedDifficulty(newNBack, newDifficulty);
    })();

    // Per-session disclosure state lifted here (from the removed ChainSessionsTab).
    // Default: all collapsed — the chain-aggregate above already gives the user a
    // top-line view; expanding is opt-in.
    const safeBlocks = Array.isArray(blocks) ? blocks : [];
    const [expanded, setExpanded] = useState(() => new Set());
    const handleToggle = useCallback((index) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    }, []);

    return (
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2 custom-scrollbar">
            {/* Per-modality Channel cards (chain-aggregate) */}
            <div className={`grid gap-4 ${gridCols}`}>
                {hasVisualModality && (
                    <ChannelPerformanceCard
                        modality="visual"
                        accuracy={displayAcc?.visual}
                        correct={visualCorrect}
                        targetCount={visualTargetCount}
                        falseAlarms={visualFalseAlarms}
                        dprime={visualDprime}
                        medianRT={visualHitRTMedian}
                        isClassicMode={isClassicMode}
                    />
                )}
                {hasAudioModality && (
                    <ChannelPerformanceCard
                        modality="audio"
                        accuracy={displayAcc?.audio}
                        correct={audioCorrect}
                        targetCount={audioTargetCount}
                        falseAlarms={audioFalseAlarms}
                        dprime={audioDprime}
                        medianRT={audioHitRTMedian}
                        isClassicMode={isClassicMode}
                    />
                )}
                {hasColorModality && (
                    <ChannelPerformanceCard
                        modality="color"
                        accuracy={displayAcc?.color}
                        correct={colorCorrect}
                        targetCount={colorTargetCount}
                        falseAlarms={colorFalseAlarms}
                        dprime={colorDprime}
                        medianRT={colorHitRTMedian}
                        isClassicMode={isClassicMode}
                    />
                )}
                {hasShapeModality && (
                    <ChannelPerformanceCard
                        modality="shape"
                        accuracy={displayAcc?.shape}
                        correct={shapeCorrect}
                        targetCount={shapeTargetCount}
                        falseAlarms={shapeFalseAlarms}
                        dprime={shapeDprime}
                        medianRT={shapeHitRTMedian}
                        isClassicMode={isClassicMode}
                    />
                )}
            </div>

            {/* Chain Parameters — mirrors GameResults.js:1532-1555 (renamed to "Chain") */}
            <div className="border border-theme-line bg-theme-bg-elevated p-4">
                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-3">
                    Chain Parameters
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm font-mono">
                    <div>
                        <div className="text-theme-text-muted text-xs">Total Trials</div>
                        <div className="text-theme-text">{totalTrials ?? '—'}</div>
                    </div>
                    <div>
                        <div className="text-theme-text-muted text-xs">Total Duration</div>
                        <div className="text-theme-text">{formatDuration(totalDurationMs ?? 0)}</div>
                    </div>
                    <div>
                        <div className="text-theme-text-muted text-xs">Sessions</div>
                        <div className="text-theme-text">{totalBlocks ?? '—'}</div>
                    </div>
                    <div>
                        <div className="text-theme-text-muted text-xs">Current</div>
                        <div className="text-theme-text">{currentLabel}</div>
                    </div>
                </div>
            </div>

            {/* Performance Scale Reference (Adaptive only) — mirrors GameResults.js:1557-1602 */}
            {!isClassicMode && (
                <div className="border border-theme-line bg-theme-bg-elevated p-4">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted">
                            Performance Scale (d′)
                        </span>
                        {overallDprime !== null && (
                            <span className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                Your score: {formatNum(overallDprime, 2)}
                            </span>
                        )}
                    </div>
                    {thresholdsValid ? (
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                            <div className={`flex items-center gap-2 ${performanceCategory === 'excellent' ? 'text-theme-text' : 'text-theme-text-muted'}`}>
                                <div className="w-2 h-2 bg-theme-neural-green" />
                                <span>Excellent: ≥ {formatNum(excellentThreshold, 2)}</span>
                            </div>
                            <div className={`flex items-center gap-2 ${performanceCategory === 'very-good' ? 'text-theme-text' : 'text-theme-text-muted'}`}>
                                <div className="w-2 h-2 bg-theme-neural-blue" />
                                <span>Very Good: {formatNum(veryGoodT, 2)}+</span>
                            </div>
                            <div className={`flex items-center gap-2 ${performanceCategory === 'good' ? 'text-theme-text' : 'text-theme-text-muted'}`}>
                                <div className="w-2 h-2 bg-theme-neural-blue opacity-60" />
                                <span>Good: {formatNum(goodThreshold, 2)}+</span>
                            </div>
                            <div className={`flex items-center gap-2 ${performanceCategory === 'fair' ? 'text-theme-text' : 'text-theme-text-muted'}`}>
                                <div className="w-2 h-2 bg-theme-accent" />
                                <span>Fair: {formatNum(fairThreshold, 2)}+</span>
                            </div>
                            <div className={`flex items-center gap-2 ${performanceCategory === 'needs-improvement' ? 'text-theme-text' : 'text-theme-text-muted'}`}>
                                <div className="w-2 h-2 bg-theme-neural-red" />
                                <span>Needs Work: &lt; {formatNum(fairThreshold, 2)}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs font-mono text-theme-text-muted">
                            Performance thresholds not available.
                        </div>
                    )}
                </div>
            )}

            {/* Per-session disclosure list — folded in from the removed Sessions tab */}
            {safeBlocks.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted">
                        Sessions in this chain
                    </div>
                    {safeBlocks.map((b, i) => (
                        <ChainSessionRow
                            key={i}
                            block={b}
                            index={i}
                            gameMode={gameMode}
                            isClassicMode={isClassicMode}
                            isExpanded={expanded.has(i)}
                            onToggle={handleToggle}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default ChainDetailedTab;

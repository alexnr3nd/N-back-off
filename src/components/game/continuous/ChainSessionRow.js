/* File: src/components/game/continuous/ChainSessionRow.js */
// Per-session disclosure row for the Sessions tab.
// Collapsed: single-line summary (Session N · level · acc · d′ · trials · duration).
// Expanded: per-modality Channel cards + Session Parameters (mirrors regular
// GameResults Detailed Analysis tab, scoped to one block).
//
// Pattern: WAI-ARIA Disclosure (https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/).
// State is parent-managed (lifted into ChainDetailedTab) so we can support virtualization,
// "collapse all", and URL-deep-link in future without refactoring.

import React, { memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { GAME_MODES } from '../../../constants/gameConstants';
import { formatCombinedDifficulty } from '../../../contexts/gameHelpers';
import { formatDuration } from '../../dashboard/utils/formatters';
import { getSessionAccuracy } from '../../../utils/accuracy';
import ChannelPerformanceCard from '../ChannelPerformanceCard';

const formatNum = (n, d = 2) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : '—');
const formatAcc = (n) => formatNum(n, 1);

const ChainSessionRow = ({ block, index, gameMode, isClassicMode, isExpanded, onToggle }) => {
    if (!block) return null;

    const panelId = `chain-session-panel-${index}`;
    const sessionLabel = `Session ${index + 1}`;
    const levelLabel = isClassicMode
        ? `N = ${block.nBack ?? '—'}`
        : formatCombinedDifficulty(block.nBack, block.difficulty);

    // Recompute false-alarm-penalizing Jaeggi accuracy from the block's primary counts —
    // the same single source of truth (getSessionAccuracy) the chain-aggregate cards and
    // the rest of the app use. The stored block.accuracy / block.*Accuracy are a hit-rate
    // on Adaptive sessions (FA-blind), which produced "100% with false alarms" rows.
    //
    // Continuous scorable: a chain is one sequence, so only the FIRST session loses its N
    // lead-in trials; sessions 2+ look back into the previous session and score ALL their
    // trials (matching how the backend counted them, and the chain-aggregate cards). Feed
    // getSessionAccuracy totalTrials = trials + N for sessions 2+ so possibleTargetTrials
    // (= totalTrials − N) resolves to the full `trials`. (block stores `trials`.)
    const scorableTrials = index === 0 ? block.trials : (block.trials || 0) + (block.nBack || 0);
    const acc = getSessionAccuracy({ ...block, totalTrials: scorableTrials }, { gameMode });
    const accPct = typeof acc.overall === 'number' ? acc.overall : null;
    const dprime = block.overallDprime;

    const modeModalities = GAME_MODES[gameMode]?.modalities || ['visual', 'audio'];
    const gridCols =
        modeModalities.length === 1 ? 'grid-cols-1' :
        modeModalities.length === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
        modeModalities.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2';

    return (
        <div className={`border border-theme-line ${isExpanded ? 'bg-theme-bg-surface' : 'bg-theme-bg-elevated'} transition-colors`}>
            {/* Disclosure trigger — whole row is the click target. d′ / accuracy stays
                visible on the summary line so the most-asked stat is never hidden. */}
            <button
                type="button"
                onClick={() => onToggle(index)}
                aria-expanded={isExpanded}
                aria-controls={panelId}
                className="w-full px-3 py-2.5 flex items-center justify-between gap-3
                           hover:bg-theme-bg-surface transition-colors text-left
                           focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-accent"
            >
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[0.625rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted min-w-[5.5rem]">
                        {sessionLabel}
                    </span>
                    <span className="text-sm font-mono text-theme-text">{levelLabel}</span>
                    <span className="text-sm font-mono text-theme-accent">
                        {accPct != null ? `${accPct.toFixed(0)}%` : '—'}
                    </span>
                    {!isClassicMode && dprime != null && (
                        <span className="text-sm font-mono text-theme-text-secondary">
                            d′ {formatNum(dprime, 2)}
                        </span>
                    )}
                    <span className="text-xs font-mono text-theme-text-muted">
                        {block.trials ?? '?'} trials
                    </span>
                    {block.durationMs > 0 && (
                        <span className="text-xs font-mono text-theme-text-muted">
                            {formatDuration(block.durationMs)}
                        </span>
                    )}
                </div>
                <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`w-3 h-3 text-theme-text-muted flex-shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
            </button>

            {/* Disclosure panel — `hidden` attribute (not display:none-via-CSS-only)
                so SR + tab order skip it cleanly when collapsed. */}
            <div id={panelId} hidden={!isExpanded} className="border-t border-theme-line p-3 space-y-3">
                <div className={`grid gap-3 ${gridCols}`}>
                    {modeModalities.includes('visual') && (
                        <ChannelPerformanceCard
                            modality="visual"
                            accuracy={acc.visual}
                            correct={block.visualCorrect}
                            targetCount={block.visualTargetCount}
                            falseAlarms={block.visualFalseAlarms}
                            dprime={block.visualDprime}
                            medianRT={block.visualHitRTMedian}
                            isClassicMode={isClassicMode}
                        />
                    )}
                    {modeModalities.includes('audio') && (
                        <ChannelPerformanceCard
                            modality="audio"
                            accuracy={acc.audio}
                            correct={block.audioCorrect}
                            targetCount={block.audioTargetCount}
                            falseAlarms={block.audioFalseAlarms}
                            dprime={block.audioDprime}
                            medianRT={block.audioHitRTMedian}
                            isClassicMode={isClassicMode}
                        />
                    )}
                    {modeModalities.includes('color') && (
                        <ChannelPerformanceCard
                            modality="color"
                            accuracy={acc.color}
                            correct={block.colorCorrect}
                            targetCount={block.colorTargetCount}
                            falseAlarms={block.colorFalseAlarms}
                            dprime={block.colorDprime}
                            medianRT={block.colorHitRTMedian}
                            isClassicMode={isClassicMode}
                        />
                    )}
                    {modeModalities.includes('shape') && (
                        <ChannelPerformanceCard
                            modality="shape"
                            accuracy={acc.shape}
                            correct={block.shapeCorrect}
                            targetCount={block.shapeTargetCount}
                            falseAlarms={block.shapeFalseAlarms}
                            dprime={block.shapeDprime}
                            medianRT={block.shapeHitRTMedian}
                            isClassicMode={isClassicMode}
                        />
                    )}
                </div>

                {/* Session Parameters — mirrors GameResults.js:1532-1555 */}
                <div className="border border-theme-line bg-theme-bg p-3">
                    <div className="text-[0.625rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-2">
                        Session Parameters
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm font-mono">
                        <div>
                            <div className="text-theme-text-muted text-xs">Level</div>
                            <div className="text-theme-text">{levelLabel}</div>
                        </div>
                        <div>
                            <div className="text-theme-text-muted text-xs">Trials</div>
                            <div className="text-theme-text">{block.trials ?? '—'}</div>
                        </div>
                        <div>
                            <div className="text-theme-text-muted text-xs">Duration</div>
                            <div className="text-theme-text">{formatDuration(block.durationMs ?? 0)}</div>
                        </div>
                        <div>
                            <div className="text-theme-text-muted text-xs">Overall Acc.</div>
                            <div className="text-theme-text">{accPct != null ? `${formatAcc(accPct)}%` : '—'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Memoize so only the row whose `isExpanded` flipped re-renders. Boolean prop
// gives O(1) re-render scope even though the parent's Set reference changes
// on every toggle.
export default memo(ChainSessionRow);

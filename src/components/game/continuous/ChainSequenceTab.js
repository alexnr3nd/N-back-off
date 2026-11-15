/* File: src/components/game/continuous/ChainSequenceTab.js */
// Per-session sequence viewer for a continuous chain. One disclosure row per
// block. First session expanded by default (NN/g: first item open is OK when
// it's the most-likely target — chain readers go top-to-bottom).
//
// SequenceTimeline expects an `events` array with shape
// `{ type: 'responsePosition' | 'responseAudio' | 'responseColor' | 'responseShape',
//    trialIndex: number }` (see SequenceTimeline.js:577-580). Per-block chains
// don't carry a real replayData.events stream — we synthesize one from the
// per-modality response-index arrays the backend now ships in chainSummary.blocks.
//
// Known v1 limitation: for block 2+, the first nBack trials show as non-targets
// even when they are matches via cross-block lookback (priorStimuli). Fix later
// by passing priorStimuli to SequenceTimeline + rendering a faded prefix.

import React, { useState, useCallback, useMemo, memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { formatCombinedDifficulty } from '../../../contexts/gameHelpers';
import SequenceTimeline from '../../replay/SequenceTimeline';
import { useColorPreferences } from '../../../contexts/ColorPreferencesContext';

const buildEventsFromBlock = (block) => {
    if (!block) return [];
    const events = [];
    const push = (arr, type) => {
        if (!Array.isArray(arr)) return;
        for (const idx of arr) {
            if (typeof idx === 'number' && Number.isFinite(idx)) {
                events.push({ type, trialIndex: idx });
            }
        }
    };
    push(block.userVisualResponses, 'responsePosition');
    push(block.userAudioResponses, 'responseAudio');
    push(block.userColorResponses, 'responseColor');
    push(block.userShapeResponses, 'responseShape');
    return events;
};

const ChainSequenceRow = memo(({ block, index, gameMode, isClassicMode, isExpanded, onToggle, palette }) => {
    if (!block) return null;

    const panelId = `chain-sequence-panel-${index}`;
    const sessionLabel = `Session ${index + 1}`;
    const levelLabel = isClassicMode
        ? `N = ${block.nBack ?? '—'}`
        : formatCombinedDifficulty(block.nBack, block.difficulty);
    const trialsLabel = block.trials ?? (Array.isArray(block.sequence) ? block.sequence.length : '?');
    const hasSequence = Array.isArray(block.sequence) && block.sequence.length > 0;

    const events = useMemo(() => (isExpanded ? buildEventsFromBlock(block) : []), [isExpanded, block]);

    return (
        <div className={`border border-theme-line ${isExpanded ? 'bg-theme-bg-surface' : 'bg-theme-bg-elevated'} transition-colors`}>
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
                    <span className="text-xs font-mono text-theme-text-muted">
                        {trialsLabel} trials
                    </span>
                </div>
                <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`w-3 h-3 text-theme-text-muted flex-shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
            </button>

            <div id={panelId} hidden={!isExpanded} className="border-t border-theme-line p-3">
                {hasSequence ? (
                    <SequenceTimeline
                        sequence={block.sequence}
                        events={events}
                        nBack={block.nBack}
                        modality={gameMode}
                        totalTrials={block.trials ?? block.sequence.length}
                        currentTrialIndex={-1}
                        onSeekToTrial={() => {}}
                        compactMode={true}
                        palette={palette}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <svg className="w-8 h-8 text-theme-text-muted mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        <p className="text-sm font-mono text-theme-text-muted">
                            Sequence data not available for this session
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
});
ChainSequenceRow.displayName = 'ChainSequenceRow';

const ChainSequenceTab = ({ blocks, gameMode, isClassicMode }) => {
    const safeBlocks = Array.isArray(blocks) ? blocks : [];
    const { resolvedPalette: currentPalette } = useColorPreferences();
    // Accordion: only one session open at a time. First session open by default.
    const [expandedIndex, setExpandedIndex] = useState(0);

    const handleToggle = useCallback((index) => {
        setExpandedIndex((prev) => (prev === index ? null : index));
    }, []);

    if (safeBlocks.length === 0) {
        return (
            <div className="border border-theme-line bg-theme-bg-elevated p-4">
                <div className="text-xs font-mono text-theme-text-muted">
                    No session data available.
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-2 custom-scrollbar">
            {safeBlocks.map((b, i) => (
                <ChainSequenceRow
                    key={i}
                    block={b}
                    index={i}
                    gameMode={gameMode}
                    isClassicMode={isClassicMode}
                    isExpanded={expandedIndex === i}
                    onToggle={handleToggle}
                    palette={b?.palette || currentPalette}
                />
            ))}
        </div>
    );
};

export default ChainSequenceTab;

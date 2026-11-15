/* src/components/replay/SequenceTimeline.js */

import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { isTrialMatch } from '../../contexts/gameHelpers';
import ShapeIcon from '../game/ShapeIcon';
import { GAME_MODES } from '../../constants/gameConstants';

// Resolve active modalities for a given mode prop. Accepts full mode keys
// (dual/triple/quad/singleVisual/...) and legacy single-modality strings
// ('visual', 'audio') that older replay code passes through. Falls back to
// ['visual', 'audio'] so unknown modes keep their pre-existing behavior.
const resolveModalities = (mode) => {
    if (mode === 'visual') return ['visual'];
    if (mode === 'audio') return ['audio'];
    const fromGameModes = GAME_MODES[mode]?.modalities;
    if (Array.isArray(fromGameModes)) return fromGameModes;
    return ['visual', 'audio'];
};

// Default color mapping (legacy fallback for callers that don't pass a palette
// and for sessions saved before the customization feature). Palettes passed in
// via props take precedence — see resolvePaletteForSession in replayUtils.
const colorMap = {
    // Active colors (colorblind-safe)
    red: '#D93526',
    blue: '#2962FF',
    green: '#1B9E42',
    gold: '#A8A800',
    purple: '#8E24AA',
    teal: '#0097A7',
    orange: '#E8710A',
    white: 'rgb(var(--color-stimulus-white))',
    // Legacy colors (for old replay data)
    yellow: '#eab308',
    cyan: '#06b6d4',
    magenta: '#ec4899',
};

/**
 * MiniGrid - A tiny 3x3 grid showing position with integrated color/shape
 * - For triple mode: Active cell shows the trial's color
 * - For quad mode: Active cell shows the shape in the trial's color
 *
 * Accepts an optional `palette` prop to render with custom colors. Falls back
 * to the legacy colorMap when no palette is provided.
 */
const MiniGrid = ({ position, color, shape, isCurrent, isReference, showColor, showShape, palette }) => {
    const cells = Array(9).fill(null);
    const fillColor = (palette && palette[color]) || colorMap[color] || null;

    return (
        <div
            className="grid grid-cols-3 gap-px rounded-sm overflow-hidden flex-shrink-0"
            style={{ width: 44, height: 44 }}
        >
            {cells.map((_, idx) => {
                const isActive = position === idx;
                const isCenter = idx === 4;
                let bgClass = 'bg-theme-bg-surface';
                let cellStyle = { width: 13, height: 13 };

                // Center cell: show fixation cross or stimulus (backward compat for old replays)
                if (isCenter && !isActive) {
                    return (
                        <div
                            key={idx}
                            className="flex items-center justify-center"
                            style={cellStyle}
                        >
                            <span className="text-theme-line text-[0.5rem] font-light select-none leading-none">+</span>
                        </div>
                    );
                }

                if (isActive) {
                    // For quad mode with shape: show shape icon in the cell
                    if (showShape && shape) {
                        return (
                            <div
                                key={idx}
                                className="flex items-center justify-center bg-theme-bg-elevated"
                                style={cellStyle}
                            >
                                <ShapeIcon
                                    shape={shape}
                                    color={color || 'gold'}
                                    size={11}
                                    palette={palette}
                                />
                            </div>
                        );
                    }
                    // For triple mode with color: show colored cell
                    if (showColor && fillColor) {
                        return (
                            <div
                                key={idx}
                                className="transition-colors"
                                style={{ ...cellStyle, backgroundColor: fillColor }}
                            />
                        );
                    }
                    // Default: use highlight colors
                    if (isCurrent) {
                        bgClass = 'bg-amber-accent';
                    } else if (isReference) {
                        bgClass = 'bg-neural-pulse';
                    } else {
                        bgClass = 'bg-theme-accent';
                    }
                }

                return (
                    <div
                        key={idx}
                        className={`${bgClass} transition-colors`}
                        style={cellStyle}
                    />
                );
            })}
        </div>
    );
};

MiniGrid.propTypes = {
    position: PropTypes.number,
    color: PropTypes.string,
    shape: PropTypes.string,
    isCurrent: PropTypes.bool,
    isReference: PropTypes.bool,
    showColor: PropTypes.bool,
    showShape: PropTypes.bool,
};

/**
 * MatchIndicator - Shows match status and user result for position/audio/color/shape
 * Derived from (isMatch, responded) so the display is independent of instant-feedback
 * settings — the indicator reflects the scored outcome, which is what the user wants
 * to see after the session regardless of whether feedback was visible during play.
 */
const MatchIndicator = ({ type, isMatch, responded, shape }) => {
    const iconMap = {
        position: 'fa-th',
        audio: 'fa-volume-high',
        color: 'fa-palette',
        shape: 'fa-shapes',
    };
    const icon = iconMap[type] || 'fa-circle';
    const title = isMatch ? `${type} match` : `no ${type} match`;

    // Helper to render the icon content (ShapeIcon for shape type, FontAwesome otherwise)
    const renderIcon = (colorClass, opacity = '') => {
        if (type === 'shape' && shape) {
            let color = '#888';
            if (colorClass.includes('neural-dendrite')) color = '#22c55e';
            else if (colorClass.includes('neural-synapse')) color = '#ef4444';
            else if (colorClass.includes('theme-accent')) color = '#E4B85C';
            else if (colorClass.includes('theme-text-muted')) color = '#5C5955';

            return (
                <span className={opacity}>
                    <ShapeIcon shape={shape} color={color} size={10} />
                </span>
            );
        }
        return <i className={`fas ${icon} text-[0.625rem] ${colorClass} ${opacity}`} />;
    };

    if (isMatch && responded) {
        return (
            <span className="inline-flex items-center justify-center w-4 h-4" title={`${title} - correct`}>
                {renderIcon('text-neural-dendrite')}
            </span>
        );
    }

    if (isMatch && !responded) {
        return (
            <span
                className="relative inline-flex items-center justify-center w-4 h-4"
                title={`${title} - missed`}
            >
                <span className="absolute inset-0 border border-dashed border-neural-synapse rounded-sm" />
                {renderIcon('text-neural-synapse', 'opacity-60')}
            </span>
        );
    }

    if (!isMatch && responded) {
        return (
            <span
                className="relative inline-flex items-center justify-center w-4 h-4"
                title={`${title} - false alarm`}
            >
                {renderIcon('text-neural-synapse')}
                <span className="absolute w-full h-px bg-neural-synapse rotate-45 origin-center" />
            </span>
        );
    }

    // Correct rejection
    return (
        <span className="inline-flex items-center justify-center w-4 h-4" title={title}>
            {renderIcon('text-theme-text-muted', 'opacity-20')}
        </span>
    );
};

MatchIndicator.propTypes = {
    type: PropTypes.oneOf(['position', 'audio', 'color', 'shape']).isRequired,
    isMatch: PropTypes.bool,
    responded: PropTypes.bool,
    shape: PropTypes.string, // Optional: actual shape name for shape type
};

/**
 * SequenceLegend - Key explaining the match indicator icons
 */
const SequenceLegend = ({ modality = 'dual', compactMode = false }) => {
    const mods = resolveModalities(modality);
    const showPosition = mods.includes('visual');
    const showAudio = mods.includes('audio');
    const showColor = mods.includes('color');
    const showShape = mods.includes('shape');

    return (
        <div className="pt-3 mt-3 border-t border-theme-line">
            {/* Result indicators */}
            <div className={`flex items-center gap-x-4 gap-y-1 mb-2 ${compactMode ? 'flex-nowrap' : 'flex-wrap'}`}>
                {/* Correct */}
                <div className="flex items-center gap-1.5">
                    <i className="fas fa-th text-[0.625rem] text-neural-dendrite" />
                    <span className="text-[0.625rem] font-mono text-theme-text-muted">Correct</span>
                </div>
                {/* Missed */}
                <div className="flex items-center gap-1.5">
                    <span className="relative inline-flex items-center justify-center w-4 h-4">
                        <span className="absolute inset-0 border border-dashed border-neural-synapse rounded-sm" />
                        <i className="fas fa-th text-[0.625rem] text-neural-synapse opacity-60" />
                    </span>
                    <span className="text-[0.625rem] font-mono text-theme-text-muted">Missed</span>
                </div>
                {/* False Alarm */}
                <div className="flex items-center gap-1.5">
                    <span className="relative inline-flex items-center justify-center">
                        <i className="fas fa-th text-[0.625rem] text-neural-synapse" />
                        <span className="absolute w-full h-px bg-neural-synapse rotate-45 origin-center" />
                    </span>
                    <span className="text-[0.625rem] font-mono text-theme-text-muted">False Alarm</span>
                </div>
                {/* No Match */}
                <div className="flex items-center gap-1.5">
                    <i className="fas fa-th text-[0.625rem] text-theme-text-muted opacity-20" />
                    <span className="text-[0.625rem] font-mono text-theme-text-muted">No Match</span>
                </div>
            </div>
            {/* Modality indicators */}
            <div className={`flex items-center gap-x-3 gap-y-1 text-[0.5625rem] font-mono text-theme-text-muted ${compactMode ? 'flex-nowrap' : 'flex-wrap'}`}>
                {showPosition && (
                    <span className="flex items-center gap-1">
                        <i className="fas fa-th" /> Position
                    </span>
                )}
                {showAudio && (
                    <span className="flex items-center gap-1">
                        <i className="fas fa-volume-high" /> Audio
                    </span>
                )}
                {showColor && (
                    <span className="flex items-center gap-1">
                        <i className="fas fa-palette" /> Color
                    </span>
                )}
                {showShape && (
                    <span className="flex items-center gap-1">
                        <i className="fas fa-shapes" /> Shape
                    </span>
                )}
            </div>
        </div>
    );
};

SequenceLegend.propTypes = {
    modality: PropTypes.string,
    compactMode: PropTypes.bool,
};

/**
 * RecallOutcomeBadge - per-trial result for Recall sessions (singleColorRecall).
 * Recall has no match/false-alarm vocabulary: every scorable trial is answered exactly
 * right, answered with the wrong color, or left blank. MatchIndicator's binary semantics
 * would mislabel those, so recall rows render this instead.
 */
const RecallOutcomeBadge = ({ outcome }) => {
    if (outcome === 'exact') {
        return (
            <span className="text-neural-dendrite flex items-center gap-1" title="recalled the correct color">
                <i className="fas fa-check text-[0.5rem]" /> Exact
            </span>
        );
    }
    if (outcome === 'wrong') {
        return (
            <span className="text-neural-synapse flex items-center gap-1" title="answered with the wrong color">
                <i className="fas fa-times text-[0.5rem]" /> Wrong Color
            </span>
        );
    }
    if (outcome === 'blank') {
        return (
            <span className="text-theme-text-muted flex items-center gap-1" title="no answer given">
                <i className="fas fa-minus text-[0.5rem]" /> Blank
            </span>
        );
    }
    return null;
};

RecallOutcomeBadge.propTypes = {
    outcome: PropTypes.oneOf(['exact', 'wrong', 'blank']),
};

/**
 * TrialRow - A single trial in the timeline
 */
const TrialRow = ({
    trial,
    isCurrent,
    isReference,
    nBack,
    modality,
    onClick,
    compactMode = false,
    palette,
}) => {
    const mods = resolveModalities(modality);
    // Recall reuses the color modality but scores it as forced choice — see RecallOutcomeBadge.
    const isRecall = modality === 'singleColorRecall';
    const showPosition = mods.includes('visual');
    const showAudio = mods.includes('audio');
    const showColor = mods.includes('color');
    const showShape = mods.includes('shape');
    // Build class list for row
    const rowClasses = [
        "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-all duration-150",
        "hover:bg-theme-bg-surface",
    ];

    if (isCurrent) {
        rowClasses.push("bg-amber-accent/15 border-l-2 border-amber-accent");
    } else if (isReference) {
        rowClasses.push("bg-neural-pulse/10 border-l-2 border-neural-pulse");
    } else {
        rowClasses.push("border-l-2 border-transparent");
    }

    // Keyboard handler for accessibility
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
        }
    };

    return (
        <div
            className={rowClasses.join(' ')}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label={`Jump to trial ${trial.index + 1}`}
            aria-current={isCurrent ? 'true' : undefined}
            data-trial-index={trial.index}
        >
            {/* Trial Number */}
            <span className={`
                text-[0.6875rem] font-mono w-5 text-right flex-shrink-0
                ${isCurrent ? 'text-amber-accent font-bold' :
                  isReference ? 'text-neural-pulse font-medium' : 'text-theme-text-muted'}
            `}>
                {trial.index + 1}
            </span>

            {/* Mini Position Grid — shown for any mode that tracks position
                (dual/triple/quad/dynamic/singleVisual). For non-visual singles
                the grid is hidden and the stim renders as a standalone inline
                chip below. */}
            {showPosition && (
                <MiniGrid
                    position={trial.stimulus.position}
                    color={trial.stimulus.color}
                    shape={trial.stimulus.shape}
                    isCurrent={isCurrent}
                    isReference={isReference}
                    showColor={showColor}
                    showShape={showShape}
                    palette={palette}
                />
            )}

            {/* singleColor: standalone color circle (no grid, no border) */}
            {!showPosition && showColor && (
                <div
                    className="rounded-full flex-shrink-0"
                    style={{
                        width: 22,
                        height: 22,
                        backgroundColor: (palette && palette[trial.stimulus.color]) || colorMap[trial.stimulus.color] || 'transparent',
                    }}
                    title={trial.stimulus.color || '—'}
                />
            )}

            {/* singleShape: standalone shape icon (no grid) — always yellow */}
            {!showPosition && showShape && (
                <div className="flex-shrink-0" style={{ width: 22, height: 22 }}>
                    {trial.stimulus.shape ? (
                        <ShapeIcon
                            shape={trial.stimulus.shape}
                            color="#facc15"
                            className="w-full h-full"
                        />
                    ) : (
                        <div className="w-full h-full rounded-sm border border-dashed border-theme-line" />
                    )}
                </div>
            )}

            {/* Audio Letter */}
            {showAudio && (
                <span className={`
                    text-sm font-mono w-4 text-center flex-shrink-0
                    ${isCurrent ? 'text-theme-text font-bold' :
                      isReference ? 'text-theme-text-secondary font-medium' : 'text-theme-text-muted'}
                `}>
                    {trial.stimulus.letter || '-'}
                </span>
            )}

            {/* Match Indicators (only show for trials >= nBack) */}
            {trial.index >= nBack && (
                compactMode ? (
                    // Compact mode: text-based feedback derived from (isMatch, responded).
                    // Independent of instant-feedback settings — matches the scored outcome.
                    <div className="flex items-center gap-2 text-[0.625rem] font-mono">
                        {/* Position feedback */}
                        {showPosition && trial.isPositionMatch && trial.visualResponded && (
                            <span className="text-neural-dendrite flex items-center gap-1">
                                <i className="fas fa-check text-[0.5rem]" /> Position
                            </span>
                        )}
                        {showPosition && trial.isPositionMatch && !trial.visualResponded && (
                            <span className="text-neural-synapse flex items-center gap-1">
                                <i className="fas fa-times text-[0.5rem]" /> Missed Position
                            </span>
                        )}
                        {showPosition && !trial.isPositionMatch && trial.visualResponded && (
                            <span className="text-neural-synapse flex items-center gap-1">
                                <i className="fas fa-times text-[0.5rem]" /> False Alarm Position
                            </span>
                        )}
                        {/* Audio feedback */}
                        {showAudio && trial.isAudioMatch && trial.audioResponded && (
                            <span className="text-neural-dendrite flex items-center gap-1">
                                <i className="fas fa-check text-[0.5rem]" /> Audio
                            </span>
                        )}
                        {showAudio && trial.isAudioMatch && !trial.audioResponded && (
                            <span className="text-neural-synapse flex items-center gap-1">
                                <i className="fas fa-times text-[0.5rem]" /> Missed Audio
                            </span>
                        )}
                        {showAudio && !trial.isAudioMatch && trial.audioResponded && (
                            <span className="text-neural-synapse flex items-center gap-1">
                                <i className="fas fa-times text-[0.5rem]" /> False Alarm Audio
                            </span>
                        )}
                        {/* Color feedback — recall scores the color slot as forced choice */}
                        {showColor && isRecall && <RecallOutcomeBadge outcome={trial.recallOutcome} />}
                        {showColor && !isRecall && trial.isColorMatch && trial.colorResponded && (
                            <span className="text-neural-dendrite flex items-center gap-1">
                                <i className="fas fa-check text-[0.5rem]" /> Color
                            </span>
                        )}
                        {showColor && !isRecall && trial.isColorMatch && !trial.colorResponded && (
                            <span className="text-neural-synapse flex items-center gap-1">
                                <i className="fas fa-times text-[0.5rem]" /> Missed Color
                            </span>
                        )}
                        {showColor && !isRecall && !trial.isColorMatch && trial.colorResponded && (
                            <span className="text-neural-synapse flex items-center gap-1">
                                <i className="fas fa-times text-[0.5rem]" /> False Alarm Color
                            </span>
                        )}
                        {/* Shape feedback */}
                        {showShape && trial.isShapeMatch && trial.shapeResponded && (
                            <span className="text-neural-dendrite flex items-center gap-1">
                                <i className="fas fa-check text-[0.5rem]" /> Shape
                            </span>
                        )}
                        {showShape && trial.isShapeMatch && !trial.shapeResponded && (
                            <span className="text-neural-synapse flex items-center gap-1">
                                <i className="fas fa-times text-[0.5rem]" /> Missed Shape
                            </span>
                        )}
                        {showShape && !trial.isShapeMatch && trial.shapeResponded && (
                            <span className="text-neural-synapse flex items-center gap-1">
                                <i className="fas fa-times text-[0.5rem]" /> False Alarm Shape
                            </span>
                        )}
                    </div>
                ) : (
                    // Full mode: Show all match indicator icons
                    <div className="flex items-center gap-1.5 ml-auto">
                        {showPosition && (
                            <MatchIndicator
                                type="position"
                                isMatch={trial.isPositionMatch}
                                responded={trial.visualResponded}
                            />
                        )}
                        {showAudio && (
                            <MatchIndicator
                                type="audio"
                                isMatch={trial.isAudioMatch}
                                responded={trial.audioResponded}
                            />
                        )}
                        {showColor && isRecall && (
                            <span className="text-[0.625rem] font-mono">
                                <RecallOutcomeBadge outcome={trial.recallOutcome} />
                            </span>
                        )}
                        {showColor && !isRecall && (
                            <MatchIndicator
                                type="color"
                                isMatch={trial.isColorMatch}
                                responded={trial.colorResponded}
                            />
                        )}
                        {showShape && (
                            <MatchIndicator
                                type="shape"
                                shape={trial.stimulus.shape}
                                isMatch={trial.isShapeMatch}
                                responded={trial.shapeResponded}
                            />
                        )}
                    </div>
                )
            )}

            {/* Reference label for n-back trial */}
            {isReference && (
                <span className="text-[0.5625rem] font-mono uppercase tracking-wider text-neural-pulse ml-auto">
                    {nBack}-back
                </span>
            )}
        </div>
    );
};

TrialRow.propTypes = {
    trial: PropTypes.shape({
        index: PropTypes.number.isRequired,
        stimulus: PropTypes.shape({
            position: PropTypes.number,
            letter: PropTypes.string,
            color: PropTypes.string,
            shape: PropTypes.string,
        }).isRequired,
        isPositionMatch: PropTypes.bool,
        isAudioMatch: PropTypes.bool,
        isColorMatch: PropTypes.bool,
        isShapeMatch: PropTypes.bool,
        visualResponded: PropTypes.bool,
        audioResponded: PropTypes.bool,
        colorResponded: PropTypes.bool,
        recallOutcome: PropTypes.oneOf(['exact', 'wrong', 'blank']),
        shapeResponded: PropTypes.bool,
    }).isRequired,
    isCurrent: PropTypes.bool,
    isReference: PropTypes.bool,
    nBack: PropTypes.number.isRequired,
    modality: PropTypes.string,
    onClick: PropTypes.func.isRequired,
    compactMode: PropTypes.bool,
};

/**
 * SequenceTimeline - Main component showing all trials with N-back highlighting
 */
const SequenceTimeline = ({
    sequence,
    events,
    nBack,
    modality = 'dual',
    totalTrials,
    currentTrialIndex,
    onSeekToTrial,
    isMobile = false,
    isExpanded = true,
    onToggleExpand,
    compactMode = false,
    palette,
}) => {
    const scrollContainerRef = useRef(null);
    const [userInteracting, setUserInteracting] = useState(false);
    const interactionTimeoutRef = useRef(null);
    const isRecallMode = modality === 'singleColorRecall';

    // Pre-compute trial data with match info and feedback results
    const trialData = useMemo(() => {
        if (!sequence || !Array.isArray(sequence) || sequence.length === 0) return [];

        // Use totalTrials if provided and valid, otherwise fall back to sequence length
        const trialsToShow = (totalTrials > 0) ? Math.min(sequence.length, totalTrials) : sequence.length;

        return sequence.slice(0, trialsToShow).map((stimulus, index) => {
            const isPositionMatch = isTrialMatch(sequence, index, nBack, 'visual');
            const isAudioMatch = isTrialMatch(sequence, index, nBack, 'audio');
            const isColorMatch = isTrialMatch(sequence, index, nBack, 'color');
            const isShapeMatch = isTrialMatch(sequence, index, nBack, 'shape');

            // Response presence — responseX events are logged unconditionally by
            // useGameResponses regardless of instant-feedback settings, so this is
            // the authoritative signal for "did the user press Match on this trial?"
            const visualResponded = !!events?.some(e => e.type === 'responsePosition' && e.trialIndex === index);
            const audioResponded = !!events?.some(e => e.type === 'responseAudio' && e.trialIndex === index);
            const colorResponded = !!events?.some(e => e.type === 'responseColor' && e.trialIndex === index);
            const shapeResponded = !!events?.some(e => e.type === 'responseShape' && e.trialIndex === index);

            // Recall outcome (singleColorRecall only, null for every other mode). Derived from
            // the logged selection against the n-back stimulus rather than from feedback events,
            // so it stays correct no matter which instant-feedback toggles were on during play.
            let recallOutcome = null;
            if (isRecallMode && index >= nBack) {
                const selectionEvent = events?.find(e => e.type === 'responseColorRecall' && e.trialIndex === index);
                if (!selectionEvent) {
                    recallOutcome = 'blank';
                } else {
                    recallOutcome = selectionEvent.selectedColor === sequence[index - nBack]?.color ? 'exact' : 'wrong';
                }
            }

            return {
                index,
                stimulus,
                isPositionMatch,
                isAudioMatch,
                isColorMatch,
                isShapeMatch,
                visualResponded,
                audioResponded,
                colorResponded,
                shapeResponded,
                recallOutcome,
            };
        });
    }, [sequence, events, nBack, totalTrials, isRecallMode]);

    // Calculate the N-back reference index
    const referenceIndex = currentTrialIndex >= nBack ? currentTrialIndex - nBack : -1;

    // Auto-scroll to keep current trial visible
    useEffect(() => {
        if (!scrollContainerRef.current || userInteracting) return;
        if (currentTrialIndex < 0) return;

        const container = scrollContainerRef.current;
        const currentRow = container.querySelector(`[data-trial-index="${currentTrialIndex}"]`);

        if (currentRow) {
            const containerRect = container.getBoundingClientRect();
            const rowRect = currentRow.getBoundingClientRect();
            const targetScrollTop = container.scrollTop + (rowRect.top - containerRect.top) - (containerRect.height / 2) + (rowRect.height / 2);
            const maxScroll = container.scrollHeight - container.clientHeight;
            container.scrollTo({
                top: Math.max(0, Math.min(targetScrollTop, maxScroll)),
                behavior: 'smooth'
            });
        }
    }, [currentTrialIndex, userInteracting]);

    // Handle mouse enter - pause auto-scroll
    const handleMouseEnter = useCallback(() => {
        if (interactionTimeoutRef.current) {
            clearTimeout(interactionTimeoutRef.current);
            interactionTimeoutRef.current = null;
        }
        setUserInteracting(true);
    }, []);

    // Handle mouse leave - resume auto-scroll after delay
    const handleMouseLeave = useCallback(() => {
        if (interactionTimeoutRef.current) {
            clearTimeout(interactionTimeoutRef.current);
        }
        interactionTimeoutRef.current = setTimeout(() => {
            setUserInteracting(false);
        }, 1500);
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (interactionTimeoutRef.current) {
                clearTimeout(interactionTimeoutRef.current);
            }
        };
    }, []);

    // Handle trial click
    const handleTrialClick = useCallback((index) => {
        onSeekToTrial(index);
    }, [onSeekToTrial]);

    // Early return if no data
    if (!trialData || trialData.length === 0) {
        return null;
    }

    // Mobile collapsible version
    if (isMobile) {
        return (
            <div className="bg-theme-bg-elevated border-t border-theme-line">
                {/* Collapsible Header */}
                <button
                    onClick={onToggleExpand}
                    className="w-full flex justify-between items-center px-4 py-3 min-h-[44px] text-left"
                    aria-expanded={isExpanded}
                    aria-controls="sequence-timeline-content"
                >
                    <span className="text-xs font-mono uppercase tracking-wider text-theme-text-secondary">
                        Sequence
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-theme-text-muted">
                            Trial {currentTrialIndex >= 0 ? currentTrialIndex + 1 : '-'} / {trialData.length || totalTrials}
                        </span>
                        <i className={`fas fa-chevron-down text-xs text-theme-text-muted transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                        }`} />
                    </div>
                </button>

                {/* Expandable Content */}
                {isExpanded && (
                    <div className="px-3 pb-3">
                        <div
                            id="sequence-timeline-content"
                            ref={scrollContainerRef}
                            className="max-h-[400px] overflow-y-auto space-y-0.5 animated fadeIn custom-scrollbar"
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                            onTouchStart={handleMouseEnter}
                            onTouchEnd={handleMouseLeave}
                        >
                            {trialData.map((trial) => (
                                <TrialRow
                                    key={trial.index}
                                    trial={trial}
                                    isCurrent={trial.index === currentTrialIndex}
                                    isReference={trial.index === referenceIndex}
                                    nBack={nBack}
                                    modality={modality}
                                    onClick={() => handleTrialClick(trial.index)}
                                    compactMode={compactMode}
                                    palette={palette}
                                />
                            ))}
                        </div>

                        {/* Legend - hide in compact mode since feedback is text-based */}
                        {!compactMode && <SequenceLegend modality={modality} />}
                    </div>
                )}
            </div>
        );
    }

    // Desktop card version
    return (
        <div className="rounded-lg p-4 bg-theme-bg-secondary border border-theme-line">
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-mono uppercase tracking-wider text-theme-text-secondary">
                    Sequence
                </h3>
                <span className="text-xs font-mono text-theme-text-muted">
                    {currentTrialIndex >= 0 ? currentTrialIndex + 1 : '-'} / {trialData.length || totalTrials}
                </span>
            </div>

            {/* Trial List - Single scrollable column */}
            <div
                ref={scrollContainerRef}
                className="overflow-y-auto space-y-0.5 pr-1 custom-scrollbar max-h-[600px]"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {trialData.map((trial) => (
                    <TrialRow
                        key={trial.index}
                        trial={trial}
                        isCurrent={trial.index === currentTrialIndex}
                        isReference={trial.index === referenceIndex}
                        nBack={nBack}
                        modality={modality}
                        onClick={() => handleTrialClick(trial.index)}
                        compactMode={compactMode}
                        palette={palette}
                    />
                ))}
            </div>

            {/* Legend - hide in compact mode since feedback is text-based */}
            {!compactMode && <SequenceLegend modality={modality} />}
        </div>
    );
};

SequenceTimeline.propTypes = {
    sequence: PropTypes.arrayOf(PropTypes.shape({
        position: PropTypes.number,
        letter: PropTypes.string,
        color: PropTypes.string,
        shape: PropTypes.string,
    })),
    events: PropTypes.array,
    nBack: PropTypes.number.isRequired,
    modality: PropTypes.string,
    totalTrials: PropTypes.number.isRequired,
    currentTrialIndex: PropTypes.number.isRequired,
    onSeekToTrial: PropTypes.func.isRequired,
    isMobile: PropTypes.bool,
    isExpanded: PropTypes.bool,
    onToggleExpand: PropTypes.func,
    compactMode: PropTypes.bool,
};

export default SequenceTimeline;

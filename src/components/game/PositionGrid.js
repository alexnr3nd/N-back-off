/* src/components/game/PositionGrid.js */
/* Cognitive Lab Aesthetic - Visual Stimulus Matrix */

import React, { useState, useEffect, useRef } from 'react';
import { renderStimulusForMode, colorToHex } from './stimulusRenderers';
import ShapeIcon from './ShapeIcon';
import { GAME_MODES } from '../../constants/gameConstants';

/**
 * PositionGrid Component - Laboratory-style 3x3 stimulus matrix
 * Displays visual stimuli with scientific instrumentation aesthetic.
 */
const PositionGrid = (props) => {
  const isReplayMode = props.isReplayMode ?? (props.activePosition !== undefined && !props.isTutorialMode);
  const isTutorialMode = props.isTutorialMode ?? false;
  const isLiveMode = !isReplayMode && !isTutorialMode;

  // Resolved color palette: live gameplay receives it from ColorPreferencesContext
  // via GameScreen; replay receives it from the session snapshot via ReplayViewer.
  // Falls back to the legacy colorToHex for any caller that hasn't been updated
  // and for sessions saved before the customization feature shipped.
  const palette = props.palette || colorToHex;

  // Live Gameplay State (extended for color/shape in triple/quad modes)
  const [gridDisplayState, setGridDisplayState] = useState(() => {
    return isLiveMode ? { currentPosition: null, pulsePosition: null, currentColor: null, currentShape: null } : null;
  });
  const hideStimulusTimerRef = useRef(null);
  const clearPulseTimerRef = useRef(null);
  // Non-visual single-mode card visibility (singleAudio/singleColor/singleShape).
  // The 3x3 grid's own hide-timer blanks the visual stim via gridDisplayState;
  // we need a parallel flag because the non-visual card doesn't go through
  // gridDisplayState at all.
  const [nonVisualStimulusVisible, setNonVisualStimulusVisible] = useState(false);
  const hideNonVisualTimerRef = useRef(null);

  // Effect: Handles Stimulus Display (Live Mode Only)
  useEffect(() => {
    const { currentTrial, sequence, difficulty, logReplayEvent, stimulusDisplayDuration, gameState } = props;

    if (!isLiveMode || !sequence || typeof currentTrial !== 'number' || !logReplayEvent) {
      setGridDisplayState(prev => {
        if (prev?.currentPosition !== null || prev?.pulsePosition !== null) {
          return { currentPosition: null, pulsePosition: null };
        }
        return prev;
      });
      if (hideStimulusTimerRef.current) { clearTimeout(hideStimulusTimerRef.current); hideStimulusTimerRef.current = null; }
      if (clearPulseTimerRef.current) { clearTimeout(clearPulseTimerRef.current); clearPulseTimerRef.current = null; }
      return;
    }

    let targetPosition = null;
    let targetColor = null;
    let targetShape = null;
    if (gameState === 'playing' && currentTrial >= 0 && currentTrial < sequence.length) {
      const currentStimulus = sequence[currentTrial];
      targetPosition = currentStimulus?.position;
      targetColor = currentStimulus?.color || null;
      targetShape = currentStimulus?.shape || null;
    }

    const shouldPulse = targetPosition !== null;

    if (hideStimulusTimerRef.current) { clearTimeout(hideStimulusTimerRef.current); hideStimulusTimerRef.current = null; }
    if (clearPulseTimerRef.current) { clearTimeout(clearPulseTimerRef.current); clearPulseTimerRef.current = null; }

    setGridDisplayState({
      currentPosition: targetPosition,
      pulsePosition: shouldPulse ? targetPosition : null,
      currentColor: targetColor,
      currentShape: targetShape
    });

    if (targetPosition !== null && gameState === 'playing') {
      logReplayEvent({ type: 'visualStimulusOn', trialIndex: currentTrial, position: targetPosition });

      if (difficulty > 0.01 && stimulusDisplayDuration !== null && stimulusDisplayDuration > 0) {
        const positionToHide = targetPosition;
        const trialHiding = currentTrial;
        hideStimulusTimerRef.current = setTimeout(() => {
          logReplayEvent({ type: 'visualStimulusOff', trialIndex: trialHiding });
          setGridDisplayState(prev => {
            if (prev?.currentPosition === positionToHide) {
              return { ...prev, currentPosition: null };
            }
            return prev;
          });
          hideStimulusTimerRef.current = null;
        }, stimulusDisplayDuration);
      }

      if (shouldPulse) {
        const positionToClearPulse = targetPosition;
        clearPulseTimerRef.current = setTimeout(() => {
          setGridDisplayState(prev => {
            if (prev?.pulsePosition === positionToClearPulse) {
              return { ...prev, pulsePosition: null };
            }
            return prev;
          });
          clearPulseTimerRef.current = null;
        }, 200);
      }
    }

    return () => {
      if (hideStimulusTimerRef.current) { clearTimeout(hideStimulusTimerRef.current); hideStimulusTimerRef.current = null; }
      if (clearPulseTimerRef.current) { clearTimeout(clearPulseTimerRef.current); clearPulseTimerRef.current = null; }
    };
  }, [isLiveMode, props.currentTrial, props.sequence, props.gameState, props.difficulty, props.stimulusDisplayDuration, props.logReplayEvent]);

  // Effect: Non-Visual Card Stimulus Display (singleAudio/singleColor/singleShape).
  // Mirrors the visual hide-timer so the centered stim blanks after
  // stimulusDisplayDuration instead of staying on until the next trial.
  useEffect(() => {
    const { currentTrial, sequence, difficulty, stimulusDisplayDuration, gameState } = props;
    const modalities = GAME_MODES[props.gameMode]?.modalities;
    const hasVisualModality = !modalities || modalities.includes('visual');

    // Only applies to the non-visual card path.
    if (!isLiveMode || hasVisualModality || !sequence || typeof currentTrial !== 'number') {
      if (hideNonVisualTimerRef.current) { clearTimeout(hideNonVisualTimerRef.current); hideNonVisualTimerRef.current = null; }
      setNonVisualStimulusVisible(false);
      return;
    }

    if (hideNonVisualTimerRef.current) { clearTimeout(hideNonVisualTimerRef.current); hideNonVisualTimerRef.current = null; }

    if (gameState === 'playing' && currentTrial >= 0 && currentTrial < sequence.length) {
      setNonVisualStimulusVisible(true);
      if (difficulty > 0.01 && stimulusDisplayDuration !== null && stimulusDisplayDuration > 0) {
        hideNonVisualTimerRef.current = setTimeout(() => {
          setNonVisualStimulusVisible(false);
          hideNonVisualTimerRef.current = null;
        }, stimulusDisplayDuration);
      }
    } else {
      setNonVisualStimulusVisible(false);
    }

    return () => {
      if (hideNonVisualTimerRef.current) { clearTimeout(hideNonVisualTimerRef.current); hideNonVisualTimerRef.current = null; }
    };
  }, [isLiveMode, props.gameMode, props.currentTrial, props.sequence, props.gameState, props.difficulty, props.stimulusDisplayDuration]);

  // Calculate Missed Position Highlight
  const missedPositionIndexLive = (
    isLiveMode && props.instantFeedbackIsEnabled && props.missedMatchTrial !== null &&
    props.missedMatchTrial >= 0 && props.sequence?.[props.missedMatchTrial]
  ) ? props.sequence[props.missedMatchTrial].position : null;

  // ─────────────────────────────────────────────────────────────────────────
  // Non-visual single-mode card (singleAudio / singleColor / singleShape)
  // When the mode's only modality isn't 'visual', we hide the 3x3 grid and
  // render a single large centered stimulus card instead.
  // ─────────────────────────────────────────────────────────────────────────
  const modeModalities = GAME_MODES[props.gameMode]?.modalities;
  const hasVisual = !modeModalities || modeModalities.includes('visual');
  if (!hasVisual && (isLiveMode || isReplayMode)) {
    const { currentTrial, sequence, gameState } = props;
    const singleModality = modeModalities?.[0] || null;
    const stim = (typeof currentTrial === 'number' && currentTrial >= 0 && sequence?.[currentTrial]) || null;
    // Is a stimulus currently "on" this trial?
    // Live mode: tied to the hide-timer flag so the card blanks after
    //   stimulusDisplayDuration (not held on until the next trial).
    // Replay mode: show the stimulus for any valid trial (the replay engine
    //   drives currentTrial; between-trial blanking is not modeled for
    //   non-visual singles but the pulse-on-trial-change keeps it readable).
    const stimulusOn = isLiveMode
        ? (nonVisualStimulusVisible && gameState === 'playing' && stim !== null)
        : (stim !== null);

    let cardContent = null;
    if (stimulusOn) {
      if (singleModality === 'color' && stim.color) {
        cardContent = (
          <div
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full shadow-lg"
            style={{ backgroundColor: palette[stim.color] || '#D97706' }}
            aria-label={`Color: ${stim.color}`}
          />
        );
      } else if (singleModality === 'shape' && stim.shape) {
        cardContent = (
          <div className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
            <ShapeIcon shape={stim.shape} color="rgb(var(--color-accent))" className="w-full h-full" />
          </div>
        );
      } else if (singleModality === 'audio') {
        // Audio-only: pulsing speaker cue (the actual stimulus is the sound).
        cardContent = (
          <i className="fa-solid fa-volume-high text-6xl sm:text-7xl text-theme-accent" aria-hidden="true" />
        );
      }
    }

    return (
      <>
        <style>{`
          @keyframes lab-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.15); opacity: 0.9; }
          }
          .lab-pulse-animation {
            animation: lab-pulse 0.25s ease-out;
          }
        `}</style>
        <div className="relative w-full">
          <div className="w-full aspect-square bg-theme-bg p-2 sm:p-2.5 border border-theme-line flex items-center justify-center">
            {/* Fixation cross when no stimulus is showing */}
            {!stimulusOn && (
              <span className="text-theme-line text-3xl sm:text-4xl font-light select-none">+</span>
            )}
            {/* Stimulus card — key on currentTrial so CSS animation re-triggers each trial */}
            {stimulusOn && (
              <div
                key={`single-stim-${currentTrial}`}
                className="lab-pulse-animation transition-all duration-150 flex items-center justify-center"
              >
                {cardContent}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes lab-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.9; }
        }
        .lab-pulse-animation {
          animation: lab-pulse 0.25s ease-out;
        }
      `}</style>

      {/* Grid Container */}
      <div className="relative w-full">
        {/* Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 w-full aspect-square bg-theme-bg p-2 sm:p-2.5 border border-theme-line">
          {Array(9).fill(null).map((_, positionIndex) => {
            const {
              sequence: sequenceProp,
              currentTrial: currentTrialProp, visualFeedback, visualResponseTrials = [],
              instantFeedbackIsEnabled,
              activePosition, feedbackState, missedHighlightPositionIndex
            } = props;

            // Cell styling variables
            let cellBg = 'bg-theme-bg-elevated';
            let cellBorder = 'border-theme-line';
            let dotColor = 'bg-theme-accent';
            let dotVisible = false;
            let isPulsing = false;
            let isMissedPosition = false;

            // Mode-specific styling
            if (isReplayMode) {
              const isMissedHighlight = positionIndex === missedHighlightPositionIndex;
              const isActive = positionIndex === activePosition;
              isPulsing = isActive;

              if (isMissedHighlight) {
                cellBg = 'bg-neural-synapse/10';
                cellBorder = 'border-neural-synapse/50';
                dotColor = 'bg-neural-synapse';
                dotVisible = true;
              } else if (isActive) {
                dotVisible = true;
                if (feedbackState === 'correct') {
                  cellBg = 'bg-neural-dendrite/10';
                  cellBorder = 'border-neural-dendrite/50';
                  dotColor = 'bg-neural-dendrite';
                } else if (feedbackState === 'incorrect' || feedbackState === 'missed') {
                  cellBg = 'bg-neural-synapse/10';
                  cellBorder = 'border-neural-synapse/50';
                  dotColor = 'bg-neural-synapse';
                } else {
                  cellBg = 'bg-amber-accent/10';
                  cellBorder = 'border-amber-accent/30';
                }
              }

            } else if (isTutorialMode) {
              const isActive = positionIndex === activePosition;
              isPulsing = isActive;

              if (isActive) {
                dotVisible = true;
                if (feedbackState === 'correct') {
                  cellBg = 'bg-neural-dendrite/10';
                  cellBorder = 'border-neural-dendrite/50';
                  dotColor = 'bg-neural-dendrite';
                } else if (feedbackState === 'incorrect') {
                  cellBg = 'bg-neural-synapse/10';
                  cellBorder = 'border-neural-synapse/50';
                  dotColor = 'bg-neural-synapse';
                } else {
                  cellBg = 'bg-amber-accent/10';
                  cellBorder = 'border-amber-accent/30';
                }
              }

            } else {
              // Live Mode
              isMissedPosition = positionIndex === missedPositionIndexLive;
              const isCurrentPosition = gridDisplayState?.currentPosition === positionIndex;
              isPulsing = gridDisplayState?.pulsePosition === positionIndex;

              if (isMissedPosition) {
                cellBg = 'bg-neural-synapse/10';
                cellBorder = 'border-neural-synapse/50';
                dotColor = 'bg-neural-synapse';
                dotVisible = true;
              } else if (isCurrentPosition) {
                dotVisible = true;
                cellBg = 'bg-theme-bg-secondary';

                const wasResponseTrial = typeof currentTrialProp === 'number' ? visualResponseTrials.includes(currentTrialProp) : false;
                if (instantFeedbackIsEnabled && visualFeedback && wasResponseTrial) {
                  if (visualFeedback === 'correct') {
                    cellBg = 'bg-neural-dendrite/10';
                    cellBorder = 'border-neural-dendrite/50';
                    dotColor = 'bg-neural-dendrite';
                  } else if (visualFeedback === 'incorrect') {
                    cellBg = 'bg-neural-synapse/10';
                    cellBorder = 'border-neural-synapse/50';
                    dotColor = 'bg-neural-synapse';
                  }
                }
              }
            }

            const isCenter = positionIndex === 4;

            return (
              <div
                key={`grid-cell-${positionIndex}`}
                className={`
                  relative flex items-center justify-center
                  aspect-square
                  ${isCenter && !dotVisible ? '' : `border ${cellBg} ${cellBorder}`}
                  transition-all duration-150
                `}
              >
                {/* Corner accents (outer cells only) */}
                {!isCenter && (
                  <>
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-theme-line opacity-60" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-theme-line opacity-60" />
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-theme-line opacity-60" />
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-theme-line opacity-60" />
                  </>
                )}

                {/* Fixation cross at center (Jaeggi standard gaze anchor) */}
                {isCenter && !dotVisible && (
                  <span className="text-theme-line text-xl sm:text-2xl font-light select-none">+</span>
                )}

                {/* Stimulus Rendering - Mode-dependent */}
                {dotVisible && (() => {
                  const gameMode = props.gameMode || 'dual';
                  let stimColor = gridDisplayState?.currentColor;
                  let stimShape = gridDisplayState?.currentShape;
                  // In replay mode, derive from sequence since gridDisplayState is null
                  if (isReplayMode && props.sequence && typeof props.currentTrial === 'number' && props.currentTrial >= 0) {
                    const currentStimulus = props.sequence[props.currentTrial];
                    stimColor = currentStimulus?.color || null;
                    stimShape = currentStimulus?.shape || null;
                  }
                  // For missed position feedback, show the missed trial's shape/color (not the current trial's)
                  if (isMissedPosition && props.missedMatchTrial !== null && props.sequence?.[props.missedMatchTrial]) {
                    const missedStimulus = props.sequence[props.missedMatchTrial];
                    stimColor = missedStimulus?.color || null;
                    stimShape = missedStimulus?.shape || null;
                  }

                  return renderStimulusForMode({
                    gameMode,
                    stimColor,
                    stimShape,
                    isPulsing,
                    dotColor,
                    palette,
                  });
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default PositionGrid;

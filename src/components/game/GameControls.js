/* src/components/game/GameControls.js */
/* Cognitive Lab Aesthetic - Response Input Panel */

import React, { useEffect, useState, useCallback } from 'react';
import MatchButton from './MatchButton';
import ColorRecallPad from './ColorRecallPad';
import { useSettings } from '../../contexts/SettingsContext';
import { GAME_MODES } from '../../constants/gameConstants';

// Label map for the single-modality response button.
const SINGLE_BUTTON_LABELS = {
  visual: 'Position',
  audio: 'Audio',
  color: 'Color',
  shape: 'Shape',
};

// Helper function to format key names for display
const formatKeyForDisplay = (keyName) => {
  if (!keyName) return '?';
  if (keyName === ' ') return 'Space';
  if (keyName === 'ArrowLeft') return '←';
  if (keyName === 'ArrowRight') return '→';
  if (keyName === 'ArrowUp') return '↑';
  if (keyName === 'ArrowDown') return '↓';
  if (keyName.length === 1) return keyName.toUpperCase();
  if (keyName.startsWith('Key')) return keyName.substring(3).toUpperCase();
  if (keyName.startsWith('Digit')) return keyName.substring(5);
  return keyName;
};

/**
 * GameControls Component - Laboratory response input panel
 * Displays match buttons with keyboard hints in scientific style.
 * Supports 2-button (dual), 3-button (triple), and 4-button (quad) layouts.
 */
const GameControls = ({
  onPositionResponse,
  onAudioResponse,
  onColorResponse,
  onShapeResponse,
  onColorRecallSelect,
  positionFeedback,
  audioFeedback,
  colorFeedback,
  shapeFeedback,
  recallFeedback = null,
  recallSelectedColor = null,
  gameState,
  missedMatchTrial = null,
  sequence = null,
  currentTrial,
  gameMode = 'dual',
  nBack = 2,
  palette = null
}) => {
  const { settings } = useSettings();
  const [missedMatchType, setMissedMatchType] = useState(null);

  const keyBindings = settings?.keyBindings || { visual: 'ArrowLeft', audio: 'ArrowRight', color: 'ArrowDown', shape: 'ArrowUp' };
  const isDisabled = gameState !== 'playing';

  const visualKeyDisplay = formatKeyForDisplay(keyBindings.visual);
  const audioKeyDisplay = formatKeyForDisplay(keyBindings.audio);
  const colorKeyDisplay = formatKeyForDisplay(keyBindings.color || 'ArrowDown');
  const shapeKeyDisplay = formatKeyForDisplay(keyBindings.shape || 'ArrowUp');

  // Effect to determine type of missed match
  useEffect(() => {
    if (missedMatchTrial !== null && sequence && missedMatchTrial >= 0 && missedMatchTrial < sequence.length) {
      const trial = sequence[missedMatchTrial];
      // Check which modality was missed (in priority order)
      if (trial?.isVisualMatch) {
        setMissedMatchType('visual');
      } else if (trial?.isAudioMatch) {
        setMissedMatchType('audio');
      } else if (trial?.isColorMatch) {
        setMissedMatchType('color');
      } else if (trial?.isShapeMatch) {
        setMissedMatchType('shape');
      } else {
        setMissedMatchType(null);
      }
    } else {
      setMissedMatchType(null);
    }

    const timer = setTimeout(() => {
      setMissedMatchType(null);
    }, 500);

    return () => clearTimeout(timer);
  }, [missedMatchTrial, sequence]);

  const handleVisualClick = useCallback(() => {
    if (!isDisabled && typeof currentTrial === 'number' && currentTrial >= 0) {
      onPositionResponse(currentTrial);
    }
  }, [isDisabled, currentTrial, onPositionResponse]);

  const handleAudioClick = useCallback(() => {
    if (!isDisabled && typeof currentTrial === 'number' && currentTrial >= 0) {
      onAudioResponse(currentTrial);
    }
  }, [isDisabled, currentTrial, onAudioResponse]);

  const handleColorClick = useCallback(() => {
    if (!isDisabled && typeof currentTrial === 'number' && currentTrial >= 0 && onColorResponse) {
      onColorResponse(currentTrial);
    }
  }, [isDisabled, currentTrial, onColorResponse]);

  const handleShapeClick = useCallback(() => {
    if (!isDisabled && typeof currentTrial === 'number' && currentTrial >= 0 && onShapeResponse) {
      onShapeResponse(currentTrial);
    }
  }, [isDisabled, currentTrial, onShapeResponse]);

  // Determine layout based on game mode
  const isTriple = gameMode === 'triple';
  const isQuad = gameMode === 'quad';
  const modalities = GAME_MODES[gameMode]?.modalities;
  const isSingle = Array.isArray(modalities) && modalities.length === 1;
  // Recall Mode is single-modality too, but answers with the swatch pad rather than a
  // match button — it takes over the single branch below.
  const isRecall = gameMode === 'singleColorRecall';
  const singleModality = isSingle ? modalities[0] : null;

  // Pick the correct handler/feedback for the single modality.
  const singleClickHandler =
    singleModality === 'visual' ? handleVisualClick :
    singleModality === 'audio'  ? handleAudioClick  :
    singleModality === 'color'  ? handleColorClick  :
    singleModality === 'shape'  ? handleShapeClick  : null;
  const singleFeedback =
    singleModality === 'visual' ? positionFeedback :
    singleModality === 'audio'  ? audioFeedback    :
    singleModality === 'color'  ? colorFeedback    :
    singleModality === 'shape'  ? shapeFeedback    : null;

  return (
    <div>
      {/* Response Input Header */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-theme-line" />
        <span className="text-[0.6875rem] font-mono uppercase tracking-[0.2em] text-theme-text-muted">
          Response Input
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-theme-line" />
      </div>

      {/* Recall Mode: the 8-color swatch pad replaces the single match button */}
      {isRecall && (
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <ColorRecallPad
              onSelect={(color) => {
                if (!isDisabled && typeof currentTrial === 'number' && currentTrial >= 0 && onColorRecallSelect) {
                  onColorRecallSelect(currentTrial, color);
                }
              }}
              feedbackState={recallFeedback}
              selectedColor={recallSelectedColor}
              disabled={isDisabled}
              isWatchPhase={typeof currentTrial === 'number' && currentTrial >= 0 && currentTrial < nBack}
              palette={palette}
              trialIndex={currentTrial}
            />
          </div>
        </div>
      )}

      {/* Single Mode: one full-width button — uses the modality's hotkey */}
      {!isRecall && isSingle && singleClickHandler && (
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <MatchButton
              label={SINGLE_BUTTON_LABELS[singleModality] || 'Match'}
              keyHint={
                singleModality === 'visual' ? visualKeyDisplay :
                singleModality === 'audio'  ? audioKeyDisplay  :
                singleModality === 'color'  ? colorKeyDisplay  :
                singleModality === 'shape'  ? shapeKeyDisplay  : '?'
              }
              onClick={singleClickHandler}
              feedbackState={missedMatchType === singleModality ? 'missed' : singleFeedback}
              disabled={isDisabled}
            />
          </div>
        </div>
      )}

      {/* Dual Mode: Position | Audio */}
      {!isSingle && !isTriple && !isQuad && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <MatchButton
            label="Position"
            keyHint={visualKeyDisplay}
            onClick={handleVisualClick}
            feedbackState={missedMatchType === 'visual' ? 'missed' : positionFeedback}
            disabled={isDisabled}
          />
          <MatchButton
            label="Audio"
            keyHint={audioKeyDisplay}
            onClick={handleAudioClick}
            feedbackState={missedMatchType === 'audio' ? 'missed' : audioFeedback}
            disabled={isDisabled}
          />
        </div>
      )}

      {/* Triple Mode: Position | Color | Audio */}
      {isTriple && (
        <div className="match-grid-3 grid grid-cols-3 gap-2 sm:gap-3">
          <MatchButton
            label="Position"
            keyHint={visualKeyDisplay}
            onClick={handleVisualClick}
            feedbackState={missedMatchType === 'visual' ? 'missed' : positionFeedback}
            disabled={isDisabled}
          />
          <MatchButton
            label="Color"
            keyHint={colorKeyDisplay}
            onClick={handleColorClick}
            feedbackState={missedMatchType === 'color' ? 'missed' : colorFeedback}
            disabled={isDisabled}
          />
          <MatchButton
            label="Audio"
            keyHint={audioKeyDisplay}
            onClick={handleAudioClick}
            feedbackState={missedMatchType === 'audio' ? 'missed' : audioFeedback}
            disabled={isDisabled}
          />
        </div>
      )}

      {/* Quad Mode: Cross layout - Position (left) | Shape/Color stacked (center) | Audio (right) */}
      {isQuad && (
        <div className="match-grid-3 grid grid-cols-3 gap-2 sm:gap-3 items-center">
          {/* Left: Position - centered vertically */}
          <div className="flex items-center">
            <MatchButton
              label="Position"
              keyHint={visualKeyDisplay}
              onClick={handleVisualClick}
              feedbackState={missedMatchType === 'visual' ? 'missed' : positionFeedback}
              disabled={isDisabled}
            />
          </div>

          {/* Center: Stacked Shape (↑) and Color (↓) */}
          <div className="flex flex-col gap-1 sm:gap-2">
            <MatchButton
              label="Shape"
              keyHint={shapeKeyDisplay}
              onClick={handleShapeClick}
              feedbackState={missedMatchType === 'shape' ? 'missed' : shapeFeedback}
              disabled={isDisabled}
            />
            <MatchButton
              label="Color"
              keyHint={colorKeyDisplay}
              onClick={handleColorClick}
              feedbackState={missedMatchType === 'color' ? 'missed' : colorFeedback}
              disabled={isDisabled}
            />
          </div>

          {/* Right: Audio - centered vertically */}
          <div className="flex items-center">
            <MatchButton
              label="Audio"
              keyHint={audioKeyDisplay}
              onClick={handleAudioClick}
              feedbackState={missedMatchType === 'audio' ? 'missed' : audioFeedback}
              disabled={isDisabled}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default GameControls;

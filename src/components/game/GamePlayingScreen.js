/* File: src/components/game/GamePlayingScreen.js */
/* Cognitive Lab Aesthetic - Active Test Interface */

import React, { useMemo } from 'react';
import GameHeader from './GameHeader';
import PositionGrid from './PositionGrid';
import GameControls from './GameControls';
import { MODE_LABELS } from '../../constants/modeStyles';
import { useColorPreferences } from '../../contexts/ColorPreferencesContext';

/**
 * GamePlayingScreen - Laboratory cognitive test interface
 * Renders the main game interface during active gameplay with scientific instrumentation aesthetic.
 */
const GamePlayingScreen = ({
  // Core Game State
  nBack,
  difficulty,
  sequence,
  currentTrial,
  totalTrials,
  gameState,
  gameMode = 'dual', // NEW: Game mode (dual, triple, quad)

  // Feedback State
  positionFeedback,
  audioFeedback,
  colorFeedback,    // NEW: for triple/quad
  shapeFeedback,    // NEW: for quad
  recallFeedback,        // Recall Mode pad feedback (singleColorRecall)
  recallSelectedColor,   // Recall Mode: color locked for the current trial
  missedMatchTrial,
  visualResponseTrials,
  audioResponseTrials,

  // Response Handlers
  handlePositionResponse,
  handleAudioResponse,
  handleColorResponse,  // NEW: for triple/quad
  handleShapeResponse,  // NEW: for quad
  handleColorRecallSelect, // Recall Mode selection handler (singleColorRecall)

  // Control Handlers
  handlePauseResume,

  // Configuration & Utility Props
  renderControls = true,
  logReplayEvent,
  getStimulusDuration,
  instantFeedbackIsEnabled,

  // Overlay visibility flag
  isOverlayVisible,
  // Training mode
  trainingMode
}) => {

  const stimulusDisplayDuration = useMemo(() => {
    if (typeof getStimulusDuration === 'function') {
      const duration = getStimulusDuration();
      return duration && duration > 0 ? duration : 1000;
    }
    return 1000;
  }, [getStimulusDuration]);

  // Resolved color palette from user preferences. PositionGrid falls back to
  // the legacy colorToHex map if undefined, so this prop is safe to pass even
  // before ColorPreferencesProvider has hydrated.
  const { resolvedPalette } = useColorPreferences();

  const dimContent = isOverlayVisible;

  return (
    <div className="h-full bg-theme-bg flex items-center justify-center pt-4 px-3 pb-12 sm:pt-6 sm:px-4 sm:pb-14 overflow-y-auto">
      {/* Grid background with vignette */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(var(--color-line) 1px, transparent 1px),
              linear-gradient(90deg, var(--color-line) 1px, transparent 1px)
            `,
            backgroundSize: '32px 32px'
          }}
        />
        {/* Radial vignette */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, color-mix(in srgb, var(--color-bg-primary) 70%, transparent) 100%)'
          }}
        />
      </div>

      {/* Main Game Container - Lab Instrument Panel */}
      <div className="relative z-10 bg-theme-bg-secondary border border-theme-line shadow-lab-elevated w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">

        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-theme-accent/50 to-transparent" />

        {/* Panel Header - Status Bar */}
        <div className="border-b border-theme-line px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${gameState === 'playing' ? 'bg-status-success' : 'bg-theme-accent'}`} />
            <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.2em] text-theme-text-muted">
              {gameState === 'playing' ? 'Test Active' : 'Paused'}
            </span>
          </div>

          {/* Right side: mobile pause button + desktop mode label.
              To end a session (regular or continuous chain) the user pauses
              first and then uses the End button inside the pause overlay. */}
          <div className="flex items-center gap-2">
            {/* Mobile-only pause button */}
            <div className="sm:hidden">
              {gameState === 'playing' && typeof handlePauseResume === 'function' && (
                <button
                  onClick={handlePauseResume}
                  className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider
                           text-theme-text-secondary hover:text-theme-text
                           border border-theme-line hover:border-theme-accent/50
                           bg-theme-bg-elevated hover:bg-theme-bg-surface
                           transition-all duration-150
                           flex items-center gap-1.5"
                  title="Pause Game (P)"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Pause
                </button>
              )}
              {gameState === 'paused' && typeof handlePauseResume === 'function' && (
                <button
                  onClick={handlePauseResume}
                  className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider
                           text-theme-bg bg-theme-accent hover:bg-theme-accent-hover
                           transition-all duration-150
                           flex items-center gap-1.5"
                  title="Resume Game (P)"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Resume
                </button>
              )}
            </div>

            <div className="hidden sm:block text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">
              {MODE_LABELS[gameMode] || 'Dual'} N-Back
            </div>
          </div>
        </div>

        {/* Game Content Area */}
        <div className="p-4 sm:p-6">
          {/* Game Header - Level, Difficulty, Progress & Controls */}
          <GameHeader
            nBack={nBack}
            difficulty={difficulty}
            currentTrial={currentTrial}
            totalTrials={totalTrials}
            gameState={gameState}
            onPauseResume={handlePauseResume}
            trainingMode={trainingMode}
          />

          {/* Central Content Area - Grid */}
          <div className={`
            flex justify-center items-center
            my-6 py-4
            ${dimContent ? 'opacity-40 pointer-events-none' : ''}
            transition-opacity duration-300
          `}>
            <div className="w-full max-w-[320px] sm:max-w-[340px] lg:max-w-[360px]">
              <PositionGrid
              currentTrial={currentTrial}
              sequence={sequence}
              nBack={nBack}
              difficulty={difficulty}
              gameMode={gameMode}
              visualFeedback={positionFeedback}
              missedMatchTrial={missedMatchTrial}
              instantFeedbackIsEnabled={instantFeedbackIsEnabled}
              visualResponseTrials={visualResponseTrials}
              logReplayEvent={logReplayEvent}
              stimulusDisplayDuration={stimulusDisplayDuration}
              gameState={gameState}
              palette={resolvedPalette}
            />
            </div>
          </div>

          {/* Game Controls - Match Buttons */}
          <div className={`
            mt-4
            ${dimContent ? 'opacity-40 pointer-events-none' : ''}
            transition-opacity duration-300
          `}>
            {renderControls && (
              <GameControls
                onPositionResponse={handlePositionResponse}
                onAudioResponse={handleAudioResponse}
                onColorResponse={handleColorResponse}
                onShapeResponse={handleShapeResponse}
                onColorRecallSelect={handleColorRecallSelect}
                positionFeedback={positionFeedback}
                audioFeedback={audioFeedback}
                colorFeedback={colorFeedback}
                shapeFeedback={shapeFeedback}
                recallFeedback={recallFeedback}
                recallSelectedColor={recallSelectedColor}
                gameState={gameState}
                gameMode={gameMode}
                missedMatchTrial={missedMatchTrial}
                sequence={sequence}
                currentTrial={currentTrial}
                nBack={nBack}
                palette={resolvedPalette}
              />
            )}
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-theme-line to-transparent" />
      </div>
    </div>
  );
};

export default GamePlayingScreen;

/* src/components/game/GameHeader.js */
/* Cognitive Lab Aesthetic - Session Metrics Display */

import React from 'react';
import { formatCombinedDifficulty } from '../../contexts/gameHelpers';
import { useGame } from '../../contexts/GameContext';

/**
 * GameHeader Component - Laboratory session metrics display
 * Shows N-Back level, difficulty index, trial progress, and pause controls.
 */
const GameHeader = ({
  nBack,
  difficulty,
  currentTrial,
  totalTrials,
  gameState,
  onPauseResume,
  trainingMode
}) => {

  const displayDifficulty = formatCombinedDifficulty(nBack, difficulty);
  const isClassic = trainingMode === 'classic';

  // Continuous Mode: show "Session N" + "Trial X/Y" stacked, where X/Y is the trial
  // count *within the current session only* (not cumulative across the chain).
  // Trial counts use NEW trials only (excludes prior-context stimuli prepended for n-back continuity).
  const { continuousChainRef, sessionSettingsRef } = useGame();
  const chain = continuousChainRef?.current;
  const isContinuousChain = chain?.isActive === true;
  const completedBlockCount = isContinuousChain ? (chain.blocks.length || 0) : 0;
  const currentBlockNumber = isContinuousChain ? completedBlockCount + 1 : null;
  // For the in-progress block: subtract priorLen so the user sees their actual trial count
  // for this block (not inflated by the prepended prior-context stimuli).
  const currentBlockPriorLen = isContinuousChain
    ? (sessionSettingsRef?.current?.priorLen || 0)
    : 0;
  const inBlockNewTrialIndex = isContinuousChain && currentTrial >= currentBlockPriorLen
    ? (currentTrial - currentBlockPriorLen + 1)
    : 0;
  const inBlockTotalNewTrials = isContinuousChain
    ? Math.max(0, (totalTrials || 0) - currentBlockPriorLen)
    : 0;

  return (
    <div className="flex justify-between items-center mb-4">

      {/* Left: N-Back Level & Difficulty */}
      <div className="flex items-center gap-4">
        {/* N-Back Level */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted">
            N-Back
          </span>
          <span className="text-2xl font-mono text-theme-accent font-bold">
            {nBack}
          </span>
        </div>

        {/* Difficulty Index — hidden for Classic mode */}
        {!isClassic && (
          <div className="flex items-center gap-2 pl-4 border-l border-theme-line">
            <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted">
              Level
            </span>
            <span className="text-lg font-mono text-theme-text">
              {displayDifficulty}
            </span>
          </div>
        )}
      </div>

      {/* Center: Trial Progress
          - Continuous Mode: stacked "Block N" + "Trial N" with full-word labels (mobile-readable)
          - Normal session: "current / total" within the single session */}
      {isContinuousChain ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 items-center bg-theme-bg-elevated border border-theme-line px-3 sm:px-4 py-1.5 sm:py-2 leading-tight">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[0.625rem] sm:text-[0.6875rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted">Session</span>
            <span className="text-base sm:text-lg font-mono text-theme-accent">{currentBlockNumber ?? '-'}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[0.625rem] sm:text-[0.6875rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted">Trial</span>
            <span className="text-sm sm:text-lg font-mono text-theme-text">
              {inBlockNewTrialIndex > 0 ? inBlockNewTrialIndex : '-'}
              <span className="text-theme-text-muted mx-1">/</span>
              {inBlockTotalNewTrials > 0 ? inBlockTotalNewTrials : '?'}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 sm:gap-3 bg-theme-bg-elevated border border-theme-line px-3 sm:px-4 py-2">
          <span className="hidden sm:inline text-[0.6875rem] font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted">
            Trial
          </span>
          <span className="text-lg font-mono text-theme-text">
            {currentTrial < 0 ? '-' : currentTrial + 1}
            <span className="text-theme-text-muted mx-1">/</span>
            {totalTrials > 0 ? totalTrials : '?'}
          </span>
        </div>
      )}

      {/* Right: Pause/Resume Button - Desktop only (mobile button is in status bar) */}
      <div className="hidden sm:flex items-center justify-end">
        {gameState === 'playing' && typeof onPauseResume === 'function' && (
          <button
            onClick={onPauseResume}
            className="px-4 py-2 text-xs font-mono uppercase tracking-wider
                     text-theme-text-secondary hover:text-theme-text
                     border border-theme-line hover:border-theme-accent/50
                     bg-theme-bg-elevated hover:bg-theme-bg-surface
                     transition-all duration-150
                     flex items-center gap-2"
            title="Pause Game (P)"
          >
            <kbd className="px-1.5 py-0.5 text-xs bg-theme-bg border border-theme-line text-theme-text-secondary font-mono">
              P
            </kbd>
            Pause
          </button>
        )}
        {gameState === 'paused' && typeof onPauseResume === 'function' && (
          <button
            onClick={onPauseResume}
            className="px-4 py-2 text-xs font-mono uppercase tracking-wider
                     text-theme-bg bg-theme-accent hover:bg-theme-accent-hover
                     transition-all duration-150
                     flex items-center gap-2"
            title="Resume Game (P)"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Resume
          </button>
        )}
        {!(gameState === 'playing' || gameState === 'paused') && (
          <div className="w-16 h-6"></div>
        )}
      </div>
    </div>
  );
};

export default GameHeader;

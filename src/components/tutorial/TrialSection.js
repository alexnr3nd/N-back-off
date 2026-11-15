/* src/components/tutorial/TrialSection.js */
/* Protocol Guide - Trial-based Section with Visual 2-Back Display */

import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight, faVolumeUp, faPlay } from '@fortawesome/free-solid-svg-icons';

import { getSequenceForPhase } from './tutorialSequences';
import PositionGrid from '../game/PositionGrid';
import PracticeSection from './PracticeSection';
import audioManager from '../../utils/audioManager';

/**
 * TrialSection - Displays all trials with visual 2-back arrow
 * No interaction required - just view and understand
 *
 * Desktop: Horizontal layout with arrow bouncing back 2 positions
 * Mobile: Vertical layout with arrow bouncing back 2 positions
 */
const TrialSection = ({ section, onComplete, onBack, onPracticeStateChange }) => {
  const [view, setView] = useState('static'); // 'static' | 'practice'
  const sequence = getSequenceForPhase(section.phase);

  // Determine modality from section phase
  const modality = section.phase === '2back-visual' ? 'visual'
    : section.phase === '2back-audio' ? 'audio'
    : 'dual';

  // Initialize audio
  useEffect(() => {
    audioManager.init();
  }, []);

  // Report practice state changes to parent
  useEffect(() => {
    if (onPracticeStateChange) {
      onPracticeStateChange(view === 'practice');
    }
  }, [view, onPracticeStateChange]);

  // If in practice mode, render PracticeSection
  if (view === 'practice') {
    return (
      <PracticeSection
        modality={modality}
        onBack={() => setView('static')}
        onComplete={onComplete}
      />
    );
  }

  // Play audio for a specific trial
  const playAudio = (letter) => {
    if (letter) {
      audioManager.playItem(letter, 0); // 0 = easy difficulty
    }
  };

  // Find match info for display
  const matchTrialIndex = sequence.length - 1;
  const targetTrialIndex = matchTrialIndex - 2;

  // Check what matches
  const isVisualMatch = modality !== 'audio' &&
    sequence[matchTrialIndex]?.position === sequence[targetTrialIndex]?.position;
  const isAudioMatch = modality !== 'visual' &&
    sequence[matchTrialIndex]?.letter === sequence[targetTrialIndex]?.letter;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="text-center py-4 px-4 border-b border-theme-line">
        <h2 className="text-xl font-serif text-theme-text mb-1">
          {section.title}
        </h2>
        <p className="text-sm text-theme-text-secondary font-mono">
          {section.description}
        </p>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center md:justify-center px-4 py-6 overflow-y-auto">
        {/* Desktop Layout - Horizontal */}
        <div className="hidden md:block w-full max-w-3xl">
          <DesktopTrialGrid
            sequence={sequence}
            modality={modality}
            matchTrialIndex={matchTrialIndex}
            targetTrialIndex={targetTrialIndex}
            isVisualMatch={isVisualMatch}
            isAudioMatch={isAudioMatch}
            onPlayAudio={playAudio}
          />
        </div>

        {/* Mobile Layout - Vertical */}
        <div className="md:hidden w-full max-w-xs">
          <MobileTrialStack
            sequence={sequence}
            modality={modality}
            matchTrialIndex={matchTrialIndex}
            targetTrialIndex={targetTrialIndex}
            isVisualMatch={isVisualMatch}
            isAudioMatch={isAudioMatch}
            onPlayAudio={playAudio}
          />
        </div>

        {/* Explanation */}
        <div className="mt-6 text-center max-w-md">
          <p className="text-sm text-theme-text-secondary font-mono">
            {getExplanation(modality, isVisualMatch, isAudioMatch)}
          </p>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="flex items-center justify-between px-4 py-4 border-t border-theme-line">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-sm font-mono
            text-theme-text-muted hover:text-theme-text transition-colors"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" />
          <span>Back to Menu</span>
        </button>

        <button
          onClick={() => setView('practice')}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-mono uppercase tracking-wider
            bg-theme-accent hover:bg-amber-highlight border border-theme-accent text-theme-bg
            rounded-lab transition-all"
        >
          <FontAwesomeIcon icon={faPlay} className="h-3 w-3" />
          <span>Practice</span>
        </button>
      </footer>
    </div>
  );
};

/**
 * DesktopTrialGrid - Horizontal layout with n-back labels
 */
const DesktopTrialGrid = ({
  sequence,
  modality,
  matchTrialIndex,
  targetTrialIndex,
  isVisualMatch,
  isAudioMatch,
  onPlayAudio
}) => {
  return (
    <div className="flex flex-col items-center">
      {/* Trial Grid */}
      <div className="flex items-start justify-center gap-3">
        {sequence.map((trial, index) => {
          const isTarget = index === targetTrialIndex;
          const isMatch = index === matchTrialIndex;

          return (
            <div key={index} className="flex flex-col items-center" style={{ width: '100px' }}>
              {/* Trial Label */}
              <div className={`
                mb-2 px-2 py-1 text-xs font-mono uppercase tracking-wider text-center
                ${isMatch ? 'text-neural-dendrite font-bold' : 'text-theme-text-muted'}
              `}>
                {isMatch ? 'Current' : `Trial ${index + 1}`}
              </div>

              {/* Trial Content */}
              <div className={`
                p-2 border rounded-lab transition-all w-full
                ${isTarget ? 'border-theme-accent bg-theme-accent/10' : ''}
                ${isMatch ? 'border-neural-dendrite bg-neural-dendrite/10' : ''}
                ${!isTarget && !isMatch ? 'border-theme-line bg-theme-bg-secondary' : ''}
              `}>
                {/* Position Grid */}
                {(modality === 'visual' || modality === 'dual') && (
                  <div className="w-full aspect-square">
                    <PositionGrid
                      isTutorialMode={true}
                      activePosition={trial.position}
                      size="small"
                    />
                  </div>
                )}

                {/* Audio Letter */}
                {(modality === 'audio' || modality === 'dual') && (
                  <div className={`
                    flex flex-col items-center gap-1
                    ${modality === 'dual' ? 'mt-2' : ''}
                  `}>
                    <div className="flex items-center justify-center w-full h-10 border border-theme-line bg-theme-bg-elevated">
                      <span className="text-lg font-mono font-bold text-theme-text">
                        {trial.letter}
                      </span>
                    </div>
                    <button
                      onClick={() => onPlayAudio(trial.letter)}
                      className="flex items-center gap-1 text-[0.6875rem] text-theme-text-muted hover:text-theme-accent transition-colors"
                    >
                      <FontAwesomeIcon icon={faVolumeUp} className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* N-back label or Match indicator below each trial */}
              <div className="mt-2 text-xs font-mono h-4 text-center">
                {isMatch ? (
                  <span className="text-neural-dendrite">
                    {isVisualMatch && isAudioMatch ? 'Both Match!' :
                      isVisualMatch ? 'Match!' :
                      isAudioMatch ? 'Match!' : 'Current'}
                  </span>
                ) : (
                  <span className={`${matchTrialIndex - index === 2 ? 'text-theme-accent font-bold' : 'text-theme-text-muted'}`}>
                    {matchTrialIndex - index}-back
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * MobileTrialStack - Vertical layout with n-back labels
 */
const MobileTrialStack = ({
  sequence,
  modality,
  matchTrialIndex,
  targetTrialIndex,
  isVisualMatch,
  isAudioMatch,
  onPlayAudio
}) => {
  return (
    <div className="flex flex-col items-center gap-4">
      {sequence.map((trial, index) => {
        const isTarget = index === targetTrialIndex;
        const isMatch = index === matchTrialIndex;
        const nBack = matchTrialIndex - index;
        const is2Back = nBack === 2;

        return (
          <div key={index} className="flex items-center gap-4 w-full justify-center">
            {/* Trial Label - LEFT */}
            <div className={`
              w-16 text-right text-xs font-mono uppercase tracking-wider
              ${isMatch ? 'text-neural-dendrite font-bold' : 'text-theme-text-muted'}
            `}>
              {isMatch ? 'Current' : `Trial ${index + 1}`}
            </div>

            {/* Trial Content */}
            <div className={`
              p-2 border rounded-lab transition-all
              ${isTarget ? 'border-theme-accent bg-theme-accent/10' : ''}
              ${isMatch ? 'border-neural-dendrite bg-neural-dendrite/10' : ''}
              ${!isTarget && !isMatch ? 'border-theme-line bg-theme-bg-secondary' : ''}
            `} style={{ width: '100px' }}>
              {/* Position Grid */}
              {(modality === 'visual' || modality === 'dual') && (
                <div className="w-full aspect-square">
                  <PositionGrid
                    isTutorialMode={true}
                    activePosition={trial.position}
                    size="small"
                  />
                </div>
              )}

              {/* Audio Letter */}
              {(modality === 'audio' || modality === 'dual') && (
                <div className={`
                  flex flex-col items-center gap-1
                  ${modality === 'dual' ? 'mt-2' : ''}
                `}>
                  <div className="flex items-center justify-center w-full h-10 border border-theme-line bg-theme-bg-elevated">
                    <span className="text-lg font-mono font-bold text-theme-text">
                      {trial.letter}
                    </span>
                  </div>
                  <button
                    onClick={() => onPlayAudio(trial.letter)}
                    className="flex items-center gap-1 text-[0.6875rem] text-theme-text-muted hover:text-theme-accent transition-colors"
                  >
                    <FontAwesomeIcon icon={faVolumeUp} className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}
            </div>

            {/* N-back label or Match indicator - RIGHT */}
            <div className="w-20 text-left text-xs font-mono">
              {isMatch ? (
                <span className="text-neural-dendrite">
                  {isVisualMatch && isAudioMatch ? 'Both Match!' :
                    isVisualMatch ? 'Match!' :
                    isAudioMatch ? 'Match!' : 'Current'}
                </span>
              ) : (
                <span className={`${is2Back ? 'text-theme-accent font-bold' : 'text-theme-text-muted'}`}>
                  {nBack} back
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Helper function for explanation text
const getExplanation = (modality, isVisualMatch, isAudioMatch) => {
  if (modality === 'visual') {
    return 'The current position matches the position from 2 trials back. In the game, you would press the POSITION button.';
  }
  if (modality === 'audio') {
    return 'The current letter matches the letter from 2 trials back. In the game, you would press the AUDIO button.';
  }
  // Dual
  if (isVisualMatch && isAudioMatch) {
    return 'Both position AND audio match 2 trials back. You would press BOTH buttons.';
  }
  if (isVisualMatch) {
    return 'Only the position matches 2 trials back. You would press only the POSITION button.';
  }
  if (isAudioMatch) {
    return 'Only the audio matches 2 trials back. You would press only the AUDIO button.';
  }
  return 'Compare each stimulus to what appeared 2 trials back.';
};

export default TrialSection;

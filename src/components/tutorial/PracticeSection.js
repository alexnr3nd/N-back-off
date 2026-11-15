/* src/components/tutorial/PracticeSection.js */
/* Protocol Guide - Interactive Practice Mode */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faRedo, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';

import PositionGrid from '../game/PositionGrid';
import audioManager from '../../utils/audioManager';

// Praise messages for correct responses - randomly selected once per correct answer
const PRAISE_MESSAGES = ['Nice!', 'Good eye!', 'Got it!'];

/**
 * Generate a randomized 2-back sequence for practice
 * Guarantees exactly targetMatches matches spread across the sequence
 * @param {number} length - Number of trials (default 12)
 * @param {string} modality - 'visual', 'audio', or 'dual'
 * @param {number} targetMatches - Number of matches to include (default 3)
 */
const generatePracticeSequence = (length = 12, modality = 'visual', targetMatches = 3) => {
  const positions = [0, 1, 2, 3, 5, 6, 7, 8];
  const letters = ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T'];

  // Determine which trials will be matches (indices 2 through length-1)
  const possibleMatchIndices = [];
  for (let i = 2; i < length; i++) {
    possibleMatchIndices.push(i);
  }

  // Shuffle possible indices
  const shuffled = [...possibleMatchIndices].sort(() => Math.random() - 0.5);

  // For dual mode: separate non-overlapping indices for visual and audio
  let visualMatchIndices = new Set();
  let audioMatchIndices = new Set();

  if (modality === 'dual') {
    // Split matches between visual and audio (no overlap, 2 each)
    visualMatchIndices = new Set(shuffled.slice(0, 2));
    audioMatchIndices = new Set(shuffled.slice(2, 4));
  } else {
    // Single modality uses same indices
    const matchIndices = new Set(shuffled.slice(0, targetMatches));
    visualMatchIndices = matchIndices;
    audioMatchIndices = matchIndices;
  }

  const sequence = [];

  for (let i = 0; i < length; i++) {
    let position = null;
    let letter = null;

    if (modality === 'visual' || modality === 'dual') {
      if (visualMatchIndices.has(i) && i >= 2) {
        // Create a position match
        position = sequence[i - 2].position;
      } else {
        // Random position (avoid accidental matches)
        do {
          position = positions[Math.floor(Math.random() * positions.length)];
        } while (i >= 2 && position === sequence[i - 2].position);
      }
    }

    if (modality === 'audio' || modality === 'dual') {
      if (audioMatchIndices.has(i) && i >= 2) {
        // Create an audio match
        letter = sequence[i - 2].letter;
      } else {
        // Random letter (avoid accidental matches)
        do {
          letter = letters[Math.floor(Math.random() * letters.length)];
        } while (i >= 2 && letter === sequence[i - 2].letter);
      }
    }

    sequence.push({ position, letter });
  }

  // Calculate actual matches for scoring
  const matches = sequence.map((trial, i) => {
    if (i < 2) return { visual: false, audio: false };
    return {
      visual: modality !== 'audio' && trial.position === sequence[i - 2].position,
      audio: modality !== 'visual' && trial.letter === sequence[i - 2].letter,
    };
  });

  return { sequence, matches };
};

/**
 * PracticeSection - Interactive practice with live game grid
 */
const PracticeSection = ({ modality = 'visual', onBack, onComplete }) => {
  // Game state
  const [gameState, setGameState] = useState('ready'); // 'ready' | 'playing' | 'results'
  const [currentTrial, setCurrentTrial] = useState(-1);
  const [sequence, setSequence] = useState([]);
  const [matches, setMatches] = useState([]);
  const [responses, setResponses] = useState([]); // { visual: boolean, audio: boolean }
  const [showStimulus, setShowStimulus] = useState(false);
  const [feedbackState, setFeedbackState] = useState(null); // 'correct' | 'incorrect' | null
  const [buttonPressed, setButtonPressed] = useState(null); // 'visual' | 'audio' | null - brief press feedback
  const [praiseMessage, setPraiseMessage] = useState(null); // Random praise message for correct answers

  // Timing
  const ISI = 2500; // Inter-stimulus interval (ms)
  const STIMULUS_DURATION = 1500; // How long to show stimulus (ms)
  const FEEDBACK_DURATION = 800; // How long to show feedback (ms)
  const BUTTON_PRESS_DURATION = 150; // How long to show button press (ms)

  const timerRef = useRef(null);
  const feedbackTimerRef = useRef(null);
  const buttonTimerRef = useRef(null);

  // Initialize audio
  useEffect(() => {
    audioManager.init();
  }, []);

  // Generate new sequence
  const startPractice = useCallback(() => {
    const { sequence: newSequence, matches: newMatches } = generatePracticeSequence(12, modality);
    setSequence(newSequence);
    setMatches(newMatches);
    setResponses(newSequence.map(() => ({ visual: false, audio: false })));
    setCurrentTrial(-1);
    setGameState('playing');
    setFeedbackState(null);
  }, [modality]);

  // Advance to next trial
  const advanceTrial = useCallback(() => {
    setCurrentTrial(prev => {
      const next = prev + 1;
      if (next >= sequence.length) {
        setGameState('results');
        return prev;
      }
      return next;
    });
  }, [sequence.length]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    // Start first trial after a brief delay
    if (currentTrial === -1) {
      timerRef.current = setTimeout(() => {
        setCurrentTrial(0);
      }, 500);
      return () => clearTimeout(timerRef.current);
    }

    // Show stimulus
    setShowStimulus(true);
    setFeedbackState(null);

    // Play audio if applicable
    if ((modality === 'audio' || modality === 'dual') && sequence[currentTrial]?.letter) {
      audioManager.playItem(sequence[currentTrial].letter, 0); // 0 = easy difficulty
    }

    // Hide stimulus after duration
    const hideTimer = setTimeout(() => {
      setShowStimulus(false);
    }, STIMULUS_DURATION);

    // Advance to next trial after ISI
    timerRef.current = setTimeout(() => {
      advanceTrial();
    }, ISI);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(timerRef.current);
    };
  }, [gameState, currentTrial, sequence, modality, advanceTrial]);

  // Handle response
  const handleResponse = useCallback((type) => {
    if (gameState !== 'playing' || currentTrial < 0) return;

    // Show brief button press feedback (always, so button feels responsive)
    setButtonPressed(type);
    if (buttonTimerRef.current) clearTimeout(buttonTimerRef.current);
    buttonTimerRef.current = setTimeout(() => {
      setButtonPressed(null);
    }, BUTTON_PRESS_DURATION);

    // First 2 trials: button is clickable but doesn't count
    if (currentTrial < 2) return;

    // Record response
    setResponses(prev => {
      const updated = [...prev];
      updated[currentTrial] = {
        ...updated[currentTrial],
        [type]: true,
      };
      return updated;
    });

    // Show feedback on grid
    const isMatch = matches[currentTrial]?.[type];

    // Play feedback sound
    audioManager.playFeedbackSound(isMatch ? 'correct' : 'incorrect');

    // Update feedback state - don't overwrite 'correct' with 'incorrect'
    setFeedbackState(prev => {
      if (isMatch) {
        // Got a match - show correct and reset timer
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        // Select a random praise message
        setPraiseMessage(PRAISE_MESSAGES[Math.floor(Math.random() * PRAISE_MESSAGES.length)]);
        feedbackTimerRef.current = setTimeout(() => {
          setFeedbackState(null);
          setPraiseMessage(null);
        }, FEEDBACK_DURATION);
        return 'correct';
      }
      // Incorrect - only update if not already showing correct
      if (prev === 'correct') return prev;
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setFeedbackState(null);
        setPraiseMessage(null);
      }, FEEDBACK_DURATION);
      return 'incorrect';
    });
  }, [gameState, currentTrial, matches]);

  // Calculate results
  const calculateResults = useCallback(() => {
    let visualHits = 0, visualMisses = 0, visualFalseAlarms = 0;
    let audioHits = 0, audioMisses = 0, audioFalseAlarms = 0;

    for (let i = 2; i < sequence.length; i++) {
      const isVisualMatch = matches[i]?.visual;
      const isAudioMatch = matches[i]?.audio;
      const respondedVisual = responses[i]?.visual;
      const respondedAudio = responses[i]?.audio;

      if (modality === 'visual' || modality === 'dual') {
        if (isVisualMatch && respondedVisual) visualHits++;
        else if (isVisualMatch && !respondedVisual) visualMisses++;
        else if (!isVisualMatch && respondedVisual) visualFalseAlarms++;
      }

      if (modality === 'audio' || modality === 'dual') {
        if (isAudioMatch && respondedAudio) audioHits++;
        else if (isAudioMatch && !respondedAudio) audioMisses++;
        else if (!isAudioMatch && respondedAudio) audioFalseAlarms++;
      }
    }

    // Combined stats
    const hits = visualHits + audioHits;
    const misses = visualMisses + audioMisses;
    const falseAlarms = visualFalseAlarms + audioFalseAlarms;
    const totalMatches = hits + misses;
    const hitRate = totalMatches > 0 ? Math.round((hits / totalMatches) * 100) : 0;

    // Individual stats
    const visualTotalMatches = visualHits + visualMisses;
    const audioTotalMatches = audioHits + audioMisses;
    const visualHitRate = visualTotalMatches > 0 ? Math.round((visualHits / visualTotalMatches) * 100) : 0;
    const audioHitRate = audioTotalMatches > 0 ? Math.round((audioHits / audioTotalMatches) * 100) : 0;

    return {
      hits, misses, falseAlarms, hitRate, totalMatches,
      visual: { hits: visualHits, misses: visualMisses, falseAlarms: visualFalseAlarms, hitRate: visualHitRate, totalMatches: visualTotalMatches },
      audio: { hits: audioHits, misses: audioMisses, falseAlarms: audioFalseAlarms, hitRate: audioHitRate, totalMatches: audioTotalMatches }
    };
  }, [sequence, matches, responses, modality]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (buttonTimerRef.current) clearTimeout(buttonTimerRef.current);
    };
  }, []);

  // Ready state - show start button
  if (gameState === 'ready') {
    return (
      <div className="flex flex-col h-full">
        <header className="text-center py-4 px-4 border-b border-theme-line">
          <h2 className="text-xl font-serif text-theme-text mb-1">
            {modality === 'visual' ? 'Position Practice' :
             modality === 'audio' ? 'Audio Practice' : 'Dual Practice'}
          </h2>
          <p className="text-sm text-theme-text-secondary font-mono">
            12 trials • 2-back
          </p>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-6">
          <div className="text-center max-w-sm">
            <p className="text-theme-text-secondary font-mono text-sm mb-6">
              {modality === 'visual'
                ? 'Press POSITION when the square appears in the same location as 2 trials ago.'
                : modality === 'audio'
                ? 'Press AUDIO when you hear the same letter as 2 trials ago.'
                : 'Press POSITION for position matches and AUDIO for letter matches.'}
            </p>

            <button
              onClick={startPractice}
              className="px-8 py-3 text-sm font-mono uppercase tracking-wider
                bg-theme-accent hover:bg-amber-highlight border border-theme-accent text-theme-bg
                rounded-lab transition-all"
            >
              Start Practice
            </button>
          </div>
        </main>

        <footer className="flex items-center justify-start px-4 py-4 border-t border-theme-line">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-sm font-mono
              text-theme-text-muted hover:text-theme-text transition-colors"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" />
            <span>Back</span>
          </button>
        </footer>
      </div>
    );
  }

  // Results state
  if (gameState === 'results') {
    const results = calculateResults();
    const isPassing = results.hitRate >= 70;

    return (
      <div className="flex flex-col h-full">
        <header className="text-center py-4 px-4 border-b border-theme-line">
          <h2 className="text-xl font-serif text-theme-text mb-1">
            Practice Complete
          </h2>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-6">
          <div className="text-center max-w-sm">
            {/* Score */}
            <div className={`text-6xl font-mono font-bold mb-2 ${isPassing ? 'text-neural-dendrite' : 'text-neural-synapse'}`}>
              {results.hitRate}%
            </div>
            <p className="text-theme-text-secondary font-mono text-sm mb-6">
              Matches Found
            </p>

            {/* Stats */}
            {modality === 'dual' ? (
              // Dual mode: show separate sections for Position and Audio
              <div className="space-y-6 mb-8 text-left">
                {/* Position section */}
                <div>
                  <h3 className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-2">Position</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-theme-bg-secondary border border-theme-line rounded-lab">
                      <div className="flex items-center gap-2 mb-1">
                        <FontAwesomeIcon icon={faCheck} className="h-3 w-3 text-neural-dendrite" />
                        <span className="text-xs font-mono text-theme-text-muted uppercase">Hits</span>
                      </div>
                      <span className="text-lg font-mono text-theme-text">{results.visual.hits}</span>
                      <span className="text-xs font-mono text-theme-text-muted"> / {results.visual.totalMatches}</span>
                    </div>
                    <div className="p-3 bg-theme-bg-secondary border border-theme-line rounded-lab">
                      <div className="flex items-center gap-2 mb-1">
                        <FontAwesomeIcon icon={faTimes} className="h-3 w-3 text-neural-synapse" />
                        <span className="text-xs font-mono text-theme-text-muted uppercase">False Alarms</span>
                      </div>
                      <span className="text-lg font-mono text-theme-text">{results.visual.falseAlarms}</span>
                    </div>
                  </div>
                </div>

                {/* Audio section */}
                <div>
                  <h3 className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-2">Audio</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-theme-bg-secondary border border-theme-line rounded-lab">
                      <div className="flex items-center gap-2 mb-1">
                        <FontAwesomeIcon icon={faCheck} className="h-3 w-3 text-neural-dendrite" />
                        <span className="text-xs font-mono text-theme-text-muted uppercase">Hits</span>
                      </div>
                      <span className="text-lg font-mono text-theme-text">{results.audio.hits}</span>
                      <span className="text-xs font-mono text-theme-text-muted"> / {results.audio.totalMatches}</span>
                    </div>
                    <div className="p-3 bg-theme-bg-secondary border border-theme-line rounded-lab">
                      <div className="flex items-center gap-2 mb-1">
                        <FontAwesomeIcon icon={faTimes} className="h-3 w-3 text-neural-synapse" />
                        <span className="text-xs font-mono text-theme-text-muted uppercase">False Alarms</span>
                      </div>
                      <span className="text-lg font-mono text-theme-text">{results.audio.falseAlarms}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Single mode: show combined stats
              <div className="grid grid-cols-2 gap-4 mb-8 text-left">
                <div className="p-3 bg-theme-bg-secondary border border-theme-line rounded-lab">
                  <div className="flex items-center gap-2 mb-1">
                    <FontAwesomeIcon icon={faCheck} className="h-3 w-3 text-neural-dendrite" />
                    <span className="text-xs font-mono text-theme-text-muted uppercase">Hits</span>
                  </div>
                  <span className="text-lg font-mono text-theme-text">{results.hits}</span>
                  <span className="text-xs font-mono text-theme-text-muted"> / {results.totalMatches}</span>
                </div>

                <div className="p-3 bg-theme-bg-secondary border border-theme-line rounded-lab">
                  <div className="flex items-center gap-2 mb-1">
                    <FontAwesomeIcon icon={faTimes} className="h-3 w-3 text-neural-synapse" />
                    <span className="text-xs font-mono text-theme-text-muted uppercase">False Alarms</span>
                  </div>
                  <span className="text-lg font-mono text-theme-text">{results.falseAlarms}</span>
                </div>
              </div>
            )}

            {/* Feedback message */}
            <p className="text-theme-text-secondary font-mono text-sm mb-6">
              {results.hitRate >= 70 && results.falseAlarms <= 2
                ? 'Great job! You\'re ready to continue.'
                : results.hitRate >= 70 && results.falseAlarms > 2
                  ? `Good hit rate! Try to reduce false alarms (${results.falseAlarms} is high).`
                  : results.hitRate < 70 && results.falseAlarms <= 2
                    ? 'Keep practicing to catch more matches.'
                    : 'Keep practicing to improve accuracy and reduce false alarms.'}
            </p>

            {/* Action buttons */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={startPractice}
                className="flex items-center gap-2 px-4 py-2 text-sm font-mono
                  text-theme-text-muted hover:text-theme-text border border-theme-line
                  hover:border-theme-accent/50 rounded-lab transition-all"
              >
                <FontAwesomeIcon icon={faRedo} className="h-3 w-3" />
                <span>Try Again</span>
              </button>

              <button
                onClick={onComplete}
                className="flex items-center gap-2 px-6 py-2 text-sm font-mono uppercase tracking-wider
                  bg-theme-accent hover:bg-amber-highlight border border-theme-accent text-theme-bg
                  rounded-lab transition-all"
              >
                <span>Continue</span>
              </button>
            </div>
          </div>
        </main>

        <footer className="flex items-center justify-start px-4 py-4 border-t border-theme-line">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-sm font-mono
              text-theme-text-muted hover:text-theme-text transition-colors"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" />
            <span>Back to Guide</span>
          </button>
        </footer>
      </div>
    );
  }

  // Playing state
  const currentPosition = showStimulus ? sequence[currentTrial]?.position : null;
  const progress = ((currentTrial + 1) / sequence.length * 100).toFixed(0);

  return (
    <div className="flex flex-col h-full">
      {/* Game grid */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6">
        <div className="w-full max-w-xs">
          {/* Progress bar above the grid */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-theme-text-muted">
                Trial {currentTrial + 1} of {sequence.length}
              </span>
              <span className="text-xs font-mono text-theme-text-muted">
                {progress}%
              </span>
            </div>
            <div className="h-1 bg-theme-bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-theme-accent transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <PositionGrid
            isTutorialMode={true}
            activePosition={currentPosition}
            feedbackState={feedbackState}
          />
        </div>

        {/* Response buttons */}
        <div className="mt-6 flex gap-4 justify-center">
          {(modality === 'visual' || modality === 'dual') && (
            <button
              onClick={() => handleResponse('visual')}
              className={`
                w-28 py-3 text-sm font-mono uppercase tracking-wider
                border rounded-lab transition-all
                ${buttonPressed === 'visual'
                  ? feedbackState === 'correct'
                    ? 'bg-neural-dendrite/20 border-neural-dendrite text-neural-dendrite'
                    : feedbackState === 'incorrect'
                      ? 'bg-neural-synapse/20 border-neural-synapse text-neural-synapse'
                      : 'bg-theme-bg-surface border-theme-line text-theme-text'
                  : 'bg-theme-bg-elevated border-theme-line text-theme-text hover:border-theme-accent/50'
                }
              `}
            >
              Position
            </button>
          )}

          {(modality === 'audio' || modality === 'dual') && (
            <button
              onClick={() => handleResponse('audio')}
              className={`
                w-28 py-3 text-sm font-mono uppercase tracking-wider
                border rounded-lab transition-all
                ${buttonPressed === 'audio'
                  ? feedbackState === 'correct'
                    ? 'bg-neural-dendrite/20 border-neural-dendrite text-neural-dendrite'
                    : feedbackState === 'incorrect'
                      ? 'bg-neural-synapse/20 border-neural-synapse text-neural-synapse'
                      : 'bg-theme-bg-surface border-theme-line text-theme-text'
                  : 'bg-theme-bg-elevated border-theme-line text-theme-text hover:border-theme-accent/50'
                }
              `}
            >
              Audio
            </button>
          )}
        </div>

        {/* Praise on correct hit */}
        <p className="mt-4 text-xs font-mono text-center h-4 text-theme-text-muted">
          {praiseMessage}
        </p>
      </main>

      {/* Footer with back button */}
      <footer className="flex items-center justify-start px-4 py-4 border-t border-theme-line">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-sm font-mono
            text-theme-text-muted hover:text-theme-text transition-colors"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" />
          <span>Back</span>
        </button>
      </footer>
    </div>
  );
};

export default PracticeSection;

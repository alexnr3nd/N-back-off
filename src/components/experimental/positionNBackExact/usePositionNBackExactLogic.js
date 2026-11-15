// src/components/experimental/positionNBackExact/usePositionNBackExactLogic.js
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DEFAULT_N_LEVEL,
  DEFAULT_NUM_TRIALS,
  DEFAULT_ISI_MS,
  STIMULUS_DURATION_MS
} from './PositionNBackExactConstants';

const generateSequence = (numTrials) => {
  return Array.from({ length: numTrials }, () => ({
    position: Math.floor(Math.random() * 9),
  }));
};

const usePositionNBackExactLogic = () => {
  const [nLevel, setNLevel] = useState(DEFAULT_N_LEVEL);
  const [numTrials, setNumTrials] = useState(DEFAULT_NUM_TRIALS);
  const [isiMs, setIsiMs] = useState(DEFAULT_ISI_MS);
  const [stimulusDurationMs, setStimulusDurationMs] = useState(STIMULUS_DURATION_MS);

  const [gameState, setGameState] = useState('idle'); // idle, countdown, playing, results
  const [sequence, setSequence] = useState([]);
  const [currentTrialIndex, setCurrentTrialIndex] = useState(-1);
  const [currentStimulusPosition, setCurrentStimulusPosition] = useState(null);
  const [nBackTargetPosition, setNBackTargetPosition] = useState(null);

  const [score, setScore] = useState({ correct: 0, incorrect: 0, misses: 0 });
  const [results, setResults] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [missedTargetFeedback, setMissedTargetFeedback] = useState(null);

  const trialTimerRef = useRef(null);
  const stimulusTimerRef = useRef(null);
  const respondedThisTrialRef = useRef(false);

  const resetGame = useCallback(() => {
    setCurrentTrialIndex(-1);
    setCurrentStimulusPosition(null);
    setNBackTargetPosition(null);
    setScore({ correct: 0, incorrect: 0, misses: 0 });
    setResults(null);
    setFeedback(null);
    setMissedTargetFeedback(null);
    respondedThisTrialRef.current = false;
    if (trialTimerRef.current) clearTimeout(trialTimerRef.current);
    if (stimulusTimerRef.current) clearTimeout(stimulusTimerRef.current);
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    const newSequence = generateSequence(numTrials);
    setSequence(newSequence);
    setCurrentTrialIndex(0); 
    setGameState('playing');
  }, [resetGame, numTrials]);

  useEffect(() => {
    if (gameState !== 'playing') {
      if (trialTimerRef.current) clearTimeout(trialTimerRef.current);
      if (stimulusTimerRef.current) clearTimeout(stimulusTimerRef.current);
      return;
    }

    if (currentTrialIndex === -1) return; // Not started yet

    if (currentTrialIndex >= numTrials) {
      setGameState('results');
      const totalAttempted = Math.max(0, numTrials - nLevel);
      setResults({ ...score, totalTrialsAttempted: totalAttempted });
      setCurrentStimulusPosition(null);
      setNBackTargetPosition(null);
      if (trialTimerRef.current) clearTimeout(trialTimerRef.current);
      if (stimulusTimerRef.current) clearTimeout(stimulusTimerRef.current);
      return;
    }
    
    // Display current stimulus
    const newStimulusPos = sequence[currentTrialIndex].position;
    setCurrentStimulusPosition(newStimulusPos);
    if (stimulusTimerRef.current) clearTimeout(stimulusTimerRef.current);
    stimulusTimerRef.current = setTimeout(() => {
      setCurrentStimulusPosition(null);
    }, stimulusDurationMs);

    // Determine N-back target for *this* trial
    if (currentTrialIndex >= nLevel) {
      setNBackTargetPosition(sequence[currentTrialIndex - nLevel].position);
    } else {
      setNBackTargetPosition(null); 
    }

    // Timer to advance to the next trial
    trialTimerRef.current = setTimeout(() => {
      // This code executes when the current trial's time (ISI) is up.
      // Check for a miss for the N-back target of the *currentTrialIndex*
      if (currentTrialIndex >= nLevel && nBackTargetPosition !== null && !respondedThisTrialRef.current) {
        setScore(s => ({ ...s, misses: s.misses + 1 }));
        setMissedTargetFeedback(nBackTargetPosition); // Show what was missed
      } else {
        // Clear missed feedback if there wasn't a miss OR if a response occurred.
        // The response handler would have cleared it if it was for a click.
        if(!respondedThisTrialRef.current) setMissedTargetFeedback(null);
      }
      
      respondedThisTrialRef.current = false; // Reset for the upcoming trial
      setFeedback(null); // Clear any click feedback

      setCurrentTrialIndex(prev => prev + 1); // Advance to the next trial
    }, isiMs);

    return () => {
      if (trialTimerRef.current) clearTimeout(trialTimerRef.current);
      if (stimulusTimerRef.current) clearTimeout(stimulusTimerRef.current);
    };
  }, [gameState, currentTrialIndex, sequence, nLevel, isiMs, stimulusDurationMs, numTrials, score, nBackTargetPosition]); // nBackTargetPosition added

  const handleCellClick = useCallback((clickedPosition) => {
    if (gameState !== 'playing' || currentTrialIndex < nLevel || respondedThisTrialRef.current) {
      return;
    }

    respondedThisTrialRef.current = true; 

    if (nBackTargetPosition === null) { return; } // Should ideally not happen if currentTrialIndex >= nLevel

    if (clickedPosition === nBackTargetPosition) {
      setScore(s => ({ ...s, correct: s.correct + 1 }));
      setFeedback({ position: clickedPosition, type: 'correct' });
    } else {
      setScore(s => ({ ...s, incorrect: s.incorrect + 1 }));
      setFeedback({ position: clickedPosition, type: 'incorrect' });
    }
    setMissedTargetFeedback(null); // A click means it's not a "miss by timeout"
  }, [gameState, currentTrialIndex, nLevel, nBackTargetPosition]);

  const updateSettings = useCallback((settings) => {
    if (settings.nLevel !== undefined) setNLevel(parseInt(settings.nLevel, 10));
    if (settings.numTrials !== undefined) setNumTrials(parseInt(settings.numTrials, 10));
    if (settings.isiMs !== undefined) setIsiMs(parseInt(settings.isiMs, 10));
    if (settings.stimulusDurationMs !== undefined) setStimulusDurationMs(parseInt(settings.stimulusDurationMs, 10));
  }, []);

  useEffect(() => { // Cleanup on unmount
    return () => {
      if (trialTimerRef.current) clearTimeout(trialTimerRef.current);
      if (stimulusTimerRef.current) clearTimeout(stimulusTimerRef.current);
    };
  }, []);

  return {
    gameState, nLevel, numTrials, isiMs, stimulusDurationMs,
    currentStimulusPosition, feedback, missedTargetFeedback, results, score,
    startGame, handleCellClick, updateSettings, setGameState,
  };
};

export default usePositionNBackExactLogic;
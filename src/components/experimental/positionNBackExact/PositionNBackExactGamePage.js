// src/components/experimental/positionNBackExact/PositionNBackExactGamePage.js
import React, { useState, useEffect } from 'react';
import usePositionNBackExactLogic from './usePositionNBackExactLogic';
import PositionNBackExactGrid from './PositionNBackExactGrid';
import PositionNBackExactControls from './PositionNBackExactControls';
import { DEFAULT_N_LEVEL, DEFAULT_NUM_TRIALS, DEFAULT_ISI_MS, STIMULUS_DURATION_MS } from './PositionNBackExactConstants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faPlay, faRedo, faChartBar, faStop } from '@fortawesome/free-solid-svg-icons';


const PositionNBackExactGamePage = () => {
  const {
    gameState, nLevel, numTrials, isiMs, stimulusDurationMs,
    currentStimulusPosition, feedback, missedTargetFeedback,
    results, score,
    startGame, handleCellClick, updateSettings, setGameState,
  } = usePositionNBackExactLogic();

  const [currentSettings, setCurrentSettings] = useState({
    nLevel: DEFAULT_N_LEVEL,
    numTrials: DEFAULT_NUM_TRIALS,
    isiMs: DEFAULT_ISI_MS,
    stimulusDurationMs: STIMULUS_DURATION_MS,
  });

  useEffect(() => {
    // Ensure stimulus duration is less than ISI when ISI changes
    if (currentSettings.stimulusDurationMs >= currentSettings.isiMs) {
      setCurrentSettings(prev => ({
        ...prev,
        stimulusDurationMs: Math.max(100, prev.isiMs - 100)
      }));
    }
  }, [currentSettings.isiMs]);


  const handleSettingsChange = (newSettings) => {
    setCurrentSettings(prev => ({ ...prev, ...newSettings }));
  };

  const handleStartGame = () => {
    updateSettings(currentSettings); 
    startGame();
  };

  const handleStopGame = () => {
    setGameState('idle');
  };

  // Protect active game from auto-refresh on version updates
  const isGameActive = gameState === 'playing';

  return (
    <div
      data-game-active={isGameActive}
      className="p-4 max-w-md mx-auto font-sans"
    >
      <header className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-700">Position N-Back</h1>
        <p className="text-sm text-gray-500">Click the N-Back location</p>
      </header>

      {gameState === 'idle' && (
        <PositionNBackExactControls
            settings={currentSettings}
            onSettingsChange={handleSettingsChange}
            onStartGame={handleStartGame}
            disabled={false}
        />
      )}
      
      {(gameState === 'playing' || gameState === 'results') && (
         <div className="mb-4 p-3 bg-gray-100 rounded-md shadow">
            <div className="flex justify-around text-center text-sm text-gray-700">
                <div><span className="font-semibold">N-Level:</span> {nLevel}</div>
                <div><span className="font-semibold">Trials:</span> {numTrials}</div>
                <div><span className="font-semibold">Speed:</span> {isiMs}ms</div>
            </div>
         </div>
      )}


      {gameState === 'playing' && (
        <div className="text-center mb-4 p-3 bg-indigo-50 rounded-md shadow">
          <p className="text-lg font-medium text-indigo-700">
            Score: 
            <span className="text-green-600 ml-2">Correct: {score.correct}</span>,
            <span className="text-red-600 ml-2">Incorrect: {score.incorrect}</span>,
            <span className="text-yellow-600 ml-2">Misses: {score.misses}</span>
          </p>
        </div>
      )}

      {gameState === 'playing' && (
         <PositionNBackExactGrid
          currentStimulusPosition={currentStimulusPosition}
          onCellClick={handleCellClick}
          feedback={feedback}
          missedTargetFeedback={missedTargetFeedback}
          disabled={false} // Grid itself is never disabled when 'playing', logic hook handles response timing
        />
      )}
      
      {gameState === 'playing' && (
          <button
            onClick={handleStopGame}
            className="mt-6 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded w-full flex items-center justify-center transition-colors duration-150"
            aria-label="Stop Game"
          >
            <FontAwesomeIcon icon={faStop} className="mr-2"/> Stop Game
          </button>
      )}


      {gameState === 'results' && results && (
        <div className="mt-6 p-6 border rounded-lg shadow-xl bg-white">
          <h2 className="text-2xl font-semibold mb-4 text-center text-gray-700"><FontAwesomeIcon icon={faChartBar} className="mr-2"/>Results</h2>
          <div className="space-y-2 text-gray-600">
            <p><strong>Total N-Back Targets:</strong> {results.totalTrialsAttempted}</p>
            <p><strong>Correct Clicks:</strong> {results.correct} ({results.totalTrialsAttempted > 0 ? ((results.correct / results.totalTrialsAttempted) * 100).toFixed(1) : 0}%)</p>
            <p><strong>Incorrect Clicks:</strong> {results.incorrect}</p>
            <p><strong>Missed Targets:</strong> {results.misses}</p>
          </div>
          <button
            onClick={handleStartGame} // Re-uses current settings to play again
            className="mt-6 w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded flex items-center justify-center transition-colors duration-150"
            aria-label="Play Again"
          >
            <FontAwesomeIcon icon={faRedo} className="mr-2"/> Play Again
          </button>
          <button
            onClick={() => setGameState('idle')}
            className="mt-3 w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded flex items-center justify-center transition-colors duration-150"
            aria-label="Back to Settings"
          >
            <FontAwesomeIcon icon={faCog} className="mr-2"/> Back to Settings
          </button>
        </div>
      )}
    </div>
  );
};

export default PositionNBackExactGamePage;
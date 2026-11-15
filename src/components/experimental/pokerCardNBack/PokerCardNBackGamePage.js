// src/components/experimental/pokerCardNBack/PokerCardNBackGamePage.js
import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faStop, faArrowLeft, faCog, faChartLine, faThLarge, faInfoCircle, faSpinner, faHeart, faFont } from '@fortawesome/free-solid-svg-icons';

import usePokerCardNBackLogic from './usePokerCardNBackLogic';
import PokerCardNBackDisplay from './PokerCardNBackDisplay';
import PokerCardNBackResultsModal from './PokerCardNBackResultsModal'; // Import the new modal
import PokerCardNBackControls from './PokerCardNBackControls';
import LoadingSpinner from '../../ui/LoadingSpinner';

// Reusable Select Component
const SettingSelect = ({ label, id, value, onChange, options, disabled, optionValueKey = "value", optionLabelKey = "label" }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <select
            id={id}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
        >
            {options.map(opt => (
                typeof opt === 'object' ?
                <option key={opt[optionValueKey]} value={opt[optionValueKey]}>{opt[optionLabelKey]}</option> :
                <option key={opt} value={opt}>{opt}</option> // For simple array of values like N_BACK_OPTIONS
            ))}
        </select>
    </div>
);

const PokerCardNBackGamePage = () => {
    const navigate = useNavigate();
    const {
        nBack, setNBack,
        durationMinutes, setDurationMinutes,
        isiOption, setIsiOption,
        matchFrequencyOption, setMatchFrequencyOption,
        gameState, sequence, currentTrialIndex, stimulusVisible, currentStimulus,
        feedback, score, totalTrialsCount,
        actions,
        N_BACK_OPTIONS, DURATION_OPTIONS, ISI_OPTIONS, MATCH_FREQUENCY_OPTIONS
    } = usePokerCardNBackLogic();

    const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);

    const isSettingsDisabled = gameState === 'playing' || gameState === 'generating' || gameState === 'paused';
    const isGenerating = gameState === 'generating';

    useEffect(() => {
        if (gameState === 'ended') {
            setIsResultsModalOpen(true);
        }
    }, [gameState]);

    // Combined function to generate sequence and start game with a single click
    const handleStartGame = useCallback(async () => {
        if (gameState === 'idle' && sequence.length === 0) {
            // First generate new sequence, then immediately play
            await actions.generateNewSequence();
            // The sequence will be available in the next render, and we can start the game
            setTimeout(() => actions.handlePlayPause(), 100);
        } else if (gameState === 'idle' || gameState === 'paused' || gameState === 'ended') {
            // If we already have a sequence, just play/resume
            // If paused, this effectively means stop and restart if called from "Play Again"
            // If ended, this starts a new game (possibly with same settings)
            actions.handlePlayPause(); // This will reset sequence if called from 'ended' state via usePokerCardNBackLogic's handlePlayPause
        }
    }, [gameState, sequence.length, actions]);


    // Properties for the button in the Game Configuration panel
    let configPanelButtonText = "Start Game";
    let configPanelButtonIcon = faPlay;
    let configPanelButtonDisabled = isGenerating;
    let configPanelButtonHandler = handleStartGame;

    if (isGenerating) {
        configPanelButtonText = "Generating...";
        configPanelButtonIcon = faSpinner;
    } else if (gameState === 'ended') {
        configPanelButtonText = "Play Again";
    } else if (gameState === 'playing' || gameState === 'paused') {
        // Disable "Start Game" button if a game is active or paused,
        // as starting a new game should be a more deliberate action (e.g. after stopping)
        configPanelButtonDisabled = true;
    }


    // Protect active game from auto-refresh on version updates
    const isGameActive = gameState === 'playing' || gameState === 'generating' || gameState === 'paused';

    return (
        <div
            data-game-active={isGameActive}
            className="max-w-5xl mx-auto p-4 sm:p-6 bg-gray-100 min-h-screen flex flex-col"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 pb-4 border-b border-gray-300">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2 sm:mb-0 flex items-center">
                    <FontAwesomeIcon icon={faThLarge} className="mr-3 h-6 w-6 text-indigo-600" />
                    Card N-Back Game
                </h1>
                <button
                    onClick={() => navigate('/experimental')}
                    className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 self-start sm:self-center"
                >
                    <FontAwesomeIcon icon={faArrowLeft} className="mr-1.5" />
                    Back to Training Games
                </button>
            </div>

            {/* Settings Panel */}
            <div className={`bg-white p-5 rounded-lg border border-gray-200 shadow-sm mb-6`}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <h2 className={`text-lg font-semibold text-gray-800 mb-4 md:mb-0 flex items-center ${isSettingsDisabled ? 'opacity-60' : ''}`}>
                        <FontAwesomeIcon icon={faCog} className="mr-2 h-5 w-5 text-gray-600" />
                        Game Configuration
                    </h2>
                    
                    <div> {/* Container for the button */}
                        <button
                            onClick={configPanelButtonHandler}
                            disabled={configPanelButtonDisabled || isSettingsDisabled}
                            className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors flex items-center justify-center 
                                        ${(configPanelButtonDisabled || isSettingsDisabled) ? 'opacity-50 cursor-not-allowed !bg-gray-400 !hover:bg-gray-400' : ''}`}
                        >
                            <FontAwesomeIcon icon={configPanelButtonIcon} className={`mr-2 h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                            {configPanelButtonText}
                        </button>
                    </div>
                </div>
                
                <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 ${isSettingsDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
                    <SettingSelect label="N-Back Level" id="nback-select" value={nBack} onChange={(e) => setNBack(parseInt(e.target.value))} options={N_BACK_OPTIONS} disabled={isSettingsDisabled} />
                    <SettingSelect label="Match Frequency" id="matchfreq-select" value={matchFrequencyOption.value} onChange={(e) => setMatchFrequencyOption(MATCH_FREQUENCY_OPTIONS.find(opt => opt.value === parseFloat(e.target.value)))} options={MATCH_FREQUENCY_OPTIONS} disabled={isSettingsDisabled} />
                    <SettingSelect label="Card Speed (ISI)" id="isi-select" value={isiOption.value} onChange={(e) => setIsiOption(ISI_OPTIONS.find(opt => opt.value === parseFloat(e.target.value)))} options={ISI_OPTIONS} disabled={isSettingsDisabled} />
                    <SettingSelect label="Session Duration" id="duration-select" value={durationMinutes} onChange={(e) => setDurationMinutes(parseInt(e.target.value))} options={DURATION_OPTIONS} disabled={isSettingsDisabled} />
                </div>
            </div>

            {/* Game Area */}
            <div className="flex-grow flex flex-col items-center justify-center bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
                {isGenerating ? (
                    <LoadingSpinner message="Generating card sequence..." theme="auto" />
                ) : (
                    <>
                        {/* Game Status Bar */}
                        <div className="w-full max-w-lg mb-4 flex justify-between items-center">
                            <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-md">
                                { totalTrialsCount > 0 ?
                                    `Card: ${score && gameState === 'ended' ? score.trialsCompleted : (currentTrialIndex < 0 ? 0 : currentTrialIndex + 1)} / ${totalTrialsCount}`
                                    : 'Card: - / -'
                                }
                                {gameState === 'ended' && ' - Complete'}
                            </div>
                            
                            {/* Top Right Pause/Stop Controls */}
                            {(gameState === 'playing' || gameState === 'paused') && (
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={actions.handlePlayPause}
                                        title={gameState === 'playing' ? 'Pause Game' : 'Resume Game'}
                                        className="p-2 h-9 w-9 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-colors"
                                    >
                                        <FontAwesomeIcon icon={gameState === 'playing' ? faPause : faPlay} className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={actions.handleStop}
                                        title="Stop Game"
                                        className="p-2 h-9 w-9 flex items-center justify-center bg-gray-400 hover:bg-gray-500 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-500 transition-colors"
                                    >
                                        <FontAwesomeIcon icon={faStop} className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {/* Main Card Display */}
                        <div className="mb-6 perspective-500">
                            <PokerCardNBackDisplay
                                suit={currentStimulus?.displaySuit}
                                rank={currentStimulus?.displayRank}
                                feedbackSuit={feedback.suit}
                                feedbackRank={feedback.rank}
                                isVisible={stimulusVisible && (gameState === 'playing' || gameState === 'paused')}
                                gameState={gameState}
                            />
                        </div>

                        {/* Match Buttons and Game Controls in a better layout */}
                        <div className="w-full max-w-md">
                            {/* Match Buttons */}
                            <PokerCardNBackControls
                                onSuitMatch={actions.processSuitResponse}
                                onRankMatch={actions.processRankResponse}
                                disabled={gameState !== 'playing' || currentTrialIndex < nBack}
                                feedbackSuit={feedback.suit}
                                feedbackRank={feedback.rank}
                            />
                            
                            {/* Main Game Controls (Start/Pause/Resume/Play Again and Stop) - This section is now removed as per new requirements */}
                            {/* The buttons are moved to Game Config panel and Top Right corner */}
                        </div>
                    </>
                )}

                {/* Results Modal Triggered by gameState === 'ended' */}
                <PokerCardNBackResultsModal
                    isOpen={isResultsModalOpen}
                    onClose={() => setIsResultsModalOpen(false)}
                    results={{ score, nBack, durationMinutes, isiOption, matchFrequencyOption /* Pass any other needed data */ }}
                    onPlayAgain={handleStartGame}
                />
            </div>

            {/* How to Play Section Below the Game */}
            <div className="bg-indigo-50 border-l-4 border-indigo-400 p-4 mb-6 rounded-r-md">
                <div className="flex">
                    <FontAwesomeIcon icon={faInfoCircle} className="h-5 w-5 text-indigo-500 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-indigo-800">
                        <h3 className="font-semibold mb-2 text-indigo-900">How to Play:</h3>
                        <p className="mb-2">Watch the cards and respond when you see a match from {nBack} cards ago:</p>
                        <ul className="space-y-3 mb-3">
                            <li className="flex items-start">
                                <div className="bg-red-100 p-1.5 rounded-full mr-2 mt-0.5">
                                    <FontAwesomeIcon icon={faHeart} className="h-4 w-4 text-red-600" />
                                </div>
                                <div>
                                    Press "<strong>Suit Match</strong>" when the <strong>suit</strong> (♥, ♦, ♣, ♠) matches the card from {nBack} positions back
                                </div>
                            </li>
                            <li className="flex items-start">
                                <div className="bg-blue-100 p-1.5 rounded-full mr-2 mt-0.5">
                                    <FontAwesomeIcon icon={faFont} className="h-4 w-4 text-blue-600" />
                                </div>
                                <div>
                                    Press "<strong>Rank Match</strong>" when the <strong>rank</strong> (A, K, Q, etc.) matches the card from {nBack} positions back
                                </div>
                            </li>
                        </ul>
                        <p>Configure your settings in the Game Configuration panel, then press the Start button to begin.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PokerCardNBackGamePage;
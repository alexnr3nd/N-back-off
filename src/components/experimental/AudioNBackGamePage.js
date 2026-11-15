// File: src/components/experimental/AudioNBackGamePage.js
// Content is from the old src/components/playground/PlaygroundPage.js, with modifications

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faStop, faArrowLeft, faCog, faVolumeUp, faRedo } from '@fortawesome/free-solid-svg-icons';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig'; // Firebase functions instance
import { useSettings } from '../../contexts/SettingsContext'; // To get voice setting
import { isTrialMatch } from '../../contexts/gameHelpers'; // Reuse match logic
import audioManager from '../../utils/audioManager';
import LoadingSpinner from '../ui/LoadingSpinner'; // Use your loading spinner

// --- Constants ---
const N_BACK_OPTIONS = [2, 3, 4, 5, 6, 7];
const DURATION_OPTIONS = [
    { value: 1, label: '1 Min' }, // Shortened labels
    { value: 2, label: '2 Min' },
    { value: 5, label: '5 Min' },
    { value: 10, label: '10 Min' },
    { value: 20, label: '20 Min' },
    { value: 30, label: '30 Min' },
];
const SPEED_OPTIONS = [
    { value: 1, label: 'Speed 1', difficulty: 0.0 }, // Shortened labels
    { value: 2, label: 'Speed 2', difficulty: 0.2 },
    { value: 3, label: 'Speed 3', difficulty: 0.4 },
    { value: 4, label: 'Speed 4', difficulty: 0.6 },
    { value: 5, label: 'Speed 5', difficulty: 0.8 },
];
const ISI_OPTIONS = [
    { value: 3.0, label: '3.0s' }, // Shortened labels
    { value: 2.6, label: '2.6s' },
    { value: 2.2, label: '2.2s' },
    { value: 1.8, label: '1.8s' },
    { value: 1.5, label: '1.5s' },
];
const MATCH_FREQUENCY_OPTIONS = [
    { value: 0.1, label: 'Very Low' }, // Shortened labels
    { value: 0.3, label: 'Low' },
    { value: 0.5, label: 'Medium' },
    { value: 0.7, label: 'High' },
    { value: 0.9, label: 'Very High' },
];


const FEEDBACK_DURATION_MS = 300;
const FEEDBACK_DELAY_FACTOR = 0.85;

// Reusable Select Component
const SettingSelect = ({ label, id, value, onChange, options, disabled }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <select
            id={id}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
        >
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
);


const AudioNBackGamePage = () => {
    const navigate = useNavigate();
    const { settings } = useSettings();

    const [nBack, setNBack] = useState(N_BACK_OPTIONS[0]);
    const [durationMinutes, setDurationMinutes] = useState(DURATION_OPTIONS[1].value);
    const [speedOption, setSpeedOption] = useState(SPEED_OPTIONS[2]);
    const [isiOption, setIsiOption] = useState(ISI_OPTIONS[2]);
    const [matchFrequencyOption, setMatchFrequencyOption] = useState(MATCH_FREQUENCY_OPTIONS[2]);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);

    const [sequence, setSequence] = useState([]);
    // const [audioMatches, setAudioMatches] = useState([]); // Not directly used for UI, can be removed if only for logging
    const [currentTrialIndex, setCurrentTrialIndex] = useState(-1);
    const [feedbackState, setFeedbackState] = useState('idle');

    const timerRef = useRef(null);
    const feedbackTimerRef = useRef(null);
    const audioTriggeredForTrial = useRef(-1);
    const sequenceRef = useRef(sequence);
    const nBackRef = useRef(nBack);
    const isPlayingRef = useRef(isPlaying);
    const isPausedRef = useRef(isPaused);

    useEffect(() => { sequenceRef.current = sequence; }, [sequence]);
    useEffect(() => { nBackRef.current = nBack; }, [nBack]);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

    const generateSequenceCallable = httpsCallable(functions, 'generateSequence');

    const calculateTrials = useCallback(() => {
        const duration = typeof durationMinutes === 'number' ? durationMinutes : parseInt(durationMinutes || '2', 10);
        const isi = isiOption?.value || 2.2;
        return Math.max(10, Math.round((duration * 60) / isi));
    }, [durationMinutes, isiOption]);

    const mapIsiValueToOption = useCallback((isiValue) => {
         const targetIsi = parseFloat(isiValue);
         return ISI_OPTIONS.find(opt => Math.abs(opt.value - targetIsi) < 0.01) || ISI_OPTIONS[2];
    }, []);

     const mapSpeedValueToOption = useCallback((speedValue) => {
         return SPEED_OPTIONS.find(opt => opt.value === parseInt(speedValue)) || SPEED_OPTIONS[2];
     }, []);

     const mapFrequencyValueToOption = useCallback((freqValue) => {
         const targetFreq = parseFloat(freqValue);
         return MATCH_FREQUENCY_OPTIONS.reduce((prev, curr) =>
            Math.abs(curr.value - targetFreq) < Math.abs(prev.value - targetFreq) ? curr : prev
         ) || MATCH_FREQUENCY_OPTIONS[2];
     }, []);

    const cleanupTimers = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        timerRef.current = null;
        feedbackTimerRef.current = null;
        setFeedbackState('idle');
        audioManager.stopCurrentSound();
        audioManager.stopFeedbackSounds();
    }, []);

    const handleStop = useCallback(() => {
        cleanupTimers();
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentTrialIndex(-1);
        audioTriggeredForTrial.current = -1;
        setError(null);
    }, [cleanupTimers]);

    useEffect(() => {
        return () => {
            handleStop();
        };
    }, [handleStop]);

    const generateNewSequence = useCallback(async () => {
        handleStop();
        setIsGenerating(true);
        setError(null);
        setSequence([]);
        // setAudioMatches([]); // Not directly used

        const trials = calculateTrials();
        const currentMatchFrequencyOption = MATCH_FREQUENCY_OPTIONS.find(opt => opt.value === matchFrequencyOption.value) || MATCH_FREQUENCY_OPTIONS[2];
        const currentIsiOption = ISI_OPTIONS.find(opt => opt.value === isiOption.value) || ISI_OPTIONS[2];

        const params = {
            nBack: nBack,
            difficulty: currentMatchFrequencyOption.value,
            isPlayground: true,
            playgroundParams: {
                trials: trials,
                isi: currentIsiOption.value,
                stimDuration: 500
            }
        };

        try {
            const result = await generateSequenceCallable(params);
            if (result.data && result.data.sequence && result.data.parameters) {
                setSequence(result.data.sequence);
                // const matchIndices = [];
                // for (let i = nBack; i < result.data.sequence.length; i++) {
                //     if (isTrialMatch(result.data.sequence, i, nBack, 'audio')) {
                //         matchIndices.push(i);
                //     }
                // }
                // setAudioMatches(matchIndices);

                const actualIsi = result.data.parameters.calculatedISI;
                const actualTrials = result.data.parameters.totalTrials;
                setIsiOption(mapIsiValueToOption(actualIsi));
                const actualDurationMinutes = Math.round(actualTrials * actualIsi / 60);
                const closestDurationOption = DURATION_OPTIONS.reduce((prev, curr) =>
                    Math.abs(curr.value - actualDurationMinutes) < Math.abs(prev.value - actualDurationMinutes) ? curr : prev
                );
                 setDurationMinutes(closestDurationOption.value);
            } else {
                throw new Error("Invalid sequence data received from backend.");
            }
        } catch (err) {
            setError(`Failed to generate sequence: ${err.message || 'Unknown error'}`);
            setSequence([]);
            // setAudioMatches([]);
        } finally {
            setIsGenerating(false);
        }
    }, [
        nBack, matchFrequencyOption, isiOption, calculateTrials, handleStop,
        generateSequenceCallable, mapIsiValueToOption, durationMinutes // Added durationMinutes to dep array
    ]); // Added durationMinutes dependency


    const playTrial = useCallback((trialIndex) => {
        if (trialIndex < 0 || trialIndex >= sequenceRef.current.length) return;
        const currentItem = sequenceRef.current[trialIndex];
        const isMatch = isTrialMatch(sequenceRef.current, trialIndex, nBackRef.current, 'audio');
        const feedbackDelay = (isiOption.value * 1000 * FEEDBACK_DELAY_FACTOR);

        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => {
            if (!isPlayingRef.current || isPausedRef.current) return;
            if (isMatch) {
                audioManager.playFeedbackSound('correct');
            }
            setFeedbackState(isMatch ? 'match' : 'no-match');
            feedbackTimerRef.current = setTimeout(() => setFeedbackState('idle'), FEEDBACK_DURATION_MS);
        }, feedbackDelay);

        if (currentItem?.letter && currentItem.letter !== ' ') {
             const difficultyForPlayback = speedOption.difficulty;
             const voiceId = settings?.selectedVoiceId;
             if (!voiceId) {
                 setError("Warning: No audio voice selected in profile settings.");
                 return;
             }
             if (audioTriggeredForTrial.current !== trialIndex) {
                 audioTriggeredForTrial.current = trialIndex;
                 audioManager.playItem(currentItem.letter, difficultyForPlayback, { voiceId });
             }
        }
    }, [
        isiOption.value, speedOption.difficulty, settings?.selectedVoiceId,
    ]);


    useEffect(() => {
        if (isPlaying && !isPaused && sequence.length > 0 && currentTrialIndex < sequence.length) {
            if (timerRef.current) clearInterval(timerRef.current);
            if (currentTrialIndex === 0) playTrial(0);

            const intervalDuration = (isiOption.value || 2.2) * 1000;
             if (isNaN(intervalDuration) || intervalDuration <= 100) {
                 setError("Invalid ISI setting.");
                 handleStop();
                 return;
             }

            timerRef.current = setInterval(() => {
                setCurrentTrialIndex(prevIndex => {
                    const nextIndex = prevIndex + 1;
                    if (nextIndex >= sequence.length) {
                         const lastTrialIndex = sequence.length - 1;
                         if (lastTrialIndex >= 0) {
                            const isLastMatch = isTrialMatch(sequenceRef.current, lastTrialIndex, nBackRef.current, 'audio');
                            if (isLastMatch) audioManager.playFeedbackSound('correct');
                         }
                         setTimeout(() => handleStop(), 200);
                        return prevIndex;
                    }
                    playTrial(nextIndex);
                    return nextIndex;
                });
            }, intervalDuration);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isPlaying, isPaused, sequence, currentTrialIndex, isiOption.value, playTrial, handleStop]);


    const handlePlayPause = useCallback(async () => {
        setError(null);
        if (!isPlaying) {
            if (sequence.length === 0) {
                await generateNewSequence(); // generateNewSequence updates sequenceRef
                if (sequenceRef.current.length > 0) { // Check sequenceRef.current after generation
                     const resumed = await audioManager.resume();
                     if (!resumed) { setError("Could not start audio. Please click the page and try again."); return; }
                     setCurrentTrialIndex(0); setIsPaused(false); setIsPlaying(true);
                }
            } else {
                 const resumed = await audioManager.resume();
                 if (!resumed) { setError("Could not start audio. Please click the page and try again."); return; }
                 setIsPaused(false); setIsPlaying(true);
                 if (currentTrialIndex === -1) setCurrentTrialIndex(0);
                 else playTrial(currentTrialIndex);
            }
        } else {
            if (isPaused) {
                 const resumed = await audioManager.resume();
                 if (!resumed) { setError("Could not resume audio. Please click the page and try again."); return; }
                setIsPaused(false);
                 playTrial(currentTrialIndex);
            } else {
                setIsPaused(true);
                cleanupTimers();
            }
        }
    }, [isPlaying, isPaused, sequence, currentTrialIndex, generateNewSequence, cleanupTimers, playTrial]);


    const feedbackBorderStyle = () => {
        switch (feedbackState) {
            case 'match': return 'border-green-500 ring-2 ring-green-300';
            case 'no-match': return 'border-red-500 ring-2 ring-red-300';
            default: return 'border-gray-300';
        }
    };

    const isSettingsDisabled = isPlaying || isGenerating;

    // Protect active game from auto-refresh on version updates
    const isGameActive = isPlaying || isGenerating;

    return (
        <div
            data-game-active={isGameActive}
            className="max-w-5xl mx-auto p-4 sm:p-6 bg-gray-100 min-h-screen flex flex-col"
        >
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 pb-4 border-b border-gray-300">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2 sm:mb-0 flex items-center">
                    <FontAwesomeIcon icon={faVolumeUp} className="mr-3 h-6 w-6 text-indigo-600" />
                    Audio N-Back Game
                </h1>
                <button
                    onClick={() => navigate('/experimental')}
                    className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 self-start sm:self-center"
                    aria-label="Back to Experimental Features"
                >
                    <FontAwesomeIcon icon={faArrowLeft} className="mr-1.5" />
                    Back to Experimental
                </button>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md shadow-sm" role="alert">
                    <div className="flex">
                        <div className="py-1"><svg className="fill-current h-6 w-6 text-red-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zM11 14v-4h-2v4h2zm0-6V6h-2v2h2z"/></svg></div>
                        <div>
                            <p className="font-bold">Error</p>
                            <p className="text-sm">{error}</p>
                        </div>
                        <button onClick={() => setError(null)} className="ml-auto -mx-1.5 -my-1.5 bg-red-100 text-red-500 rounded-lg focus:ring-2 focus:ring-red-400 p-1.5 hover:bg-red-200 inline-flex h-8 w-8" aria-label="Dismiss">
                            <span className="sr-only">Dismiss</span>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Settings Panel Card */}
            <div className={`bg-white p-5 rounded-lg border border-gray-200 shadow-sm mb-8 ${isSettingsDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <FontAwesomeIcon icon={faCog} className="mr-2 h-5 w-5 text-gray-600" />
                    Configuration
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <SettingSelect label="N-Back" id="nback-select" value={nBack} onChange={(e) => setNBack(parseInt(e.target.value))} options={N_BACK_OPTIONS.map(n => ({value: n, label: `${n}-Back`}))} disabled={isSettingsDisabled} />
                    <SettingSelect label="Frequency" id="frequency-select" value={matchFrequencyOption.value} onChange={(e) => setMatchFrequencyOption(mapFrequencyValueToOption(e.target.value))} options={MATCH_FREQUENCY_OPTIONS} disabled={isSettingsDisabled} />
                    <SettingSelect label="Audio Speed" id="speed-select" value={speedOption.value} onChange={(e) => setSpeedOption(mapSpeedValueToOption(e.target.value))} options={SPEED_OPTIONS} disabled={isSettingsDisabled} />
                    <SettingSelect label="Interval (ISI)" id="isi-select" value={isiOption.value} onChange={(e) => setIsiOption(mapIsiValueToOption(e.target.value))} options={ISI_OPTIONS} disabled={isSettingsDisabled} />
                    <SettingSelect label="Duration" id="duration-select" value={durationMinutes} onChange={(e) => setDurationMinutes(parseInt(e.target.value))} options={DURATION_OPTIONS} disabled={isSettingsDisabled} />
                </div>
            </div>

            {/* Main Content Area (Feedback Indicator & Controls) */}
            <div className="flex-grow flex flex-col items-center justify-center bg-white rounded-lg shadow-md border border-gray-200 p-6">
                {isGenerating ? (
                     <LoadingSpinner message="Generating sequence..." theme="auto" />
                ) : (
                    <div className={`w-full max-w-md h-32 sm:h-40 border-4 ${feedbackBorderStyle()} rounded-lg flex items-center justify-center transition-all duration-150 ease-in-out mb-6 shadow-inner bg-gray-50`}>
                        {isPlaying ? (
                             <span className="text-gray-600 italic text-lg sm:text-xl">
                                {isPaused ? "Paused" : "Listening..."}
                                {currentTrialIndex >= 0 && sequence.length > 0 && ` (Trial ${currentTrialIndex + 1} / ${sequence.length})`}
                             </span>
                        ) : (
                             <span className="text-gray-500 text-base sm:text-lg">
                                 {sequence.length > 0 ? 'Ready to Play' : 'Configure and Press Play or Generate'}
                             </span>
                        )}
                    </div>
                )}

                {/* Play/Pause/Stop Controls */}
                <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 w-full max-w-md">
                    <button
                        onClick={handlePlayPause}
                        disabled={isGenerating || (sequence.length === 0 && !isPlaying)}
                        className={`w-full sm:w-auto flex-1 px-6 py-3 rounded-md shadow-sm text-white font-medium text-base flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                            (isGenerating || (sequence.length === 0 && !isPlaying && !isPaused)) ? 'bg-gray-400 cursor-not-allowed' :
                            (isPlaying && !isPaused) ? 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500' :
                            'bg-green-500 hover:bg-green-600 focus:ring-green-500'
                        }`}
                        aria-label={isPlaying && !isPaused ? "Pause" : "Play"}
                    >
                        <FontAwesomeIcon icon={(isPlaying && !isPaused) ? faPause : faPlay} className="mr-2 h-5 w-5" />
                        {(isPlaying && !isPaused) ? 'Pause' : (isPaused ? 'Resume' : 'Play')}
                    </button>
                    <button
                        onClick={handleStop}
                        disabled={!isPlaying && !isPaused && !isGenerating}
                        className={`w-full sm:w-auto flex-1 px-6 py-3 rounded-md shadow-sm text-white font-medium text-base flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                            (!isPlaying && !isPaused && !isGenerating) ? 'bg-gray-400 cursor-not-allowed' :
                            'bg-red-500 hover:bg-red-600 focus:ring-red-500'
                        }`}
                        aria-label="Stop"
                    >
                        <FontAwesomeIcon icon={faStop} className="mr-2 h-5 w-5" />
                        Stop
                    </button>
                </div>

                {/* Regenerate Button */}
                 <button
                     onClick={generateNewSequence}
                     disabled={isSettingsDisabled}
                     className={`mt-6 text-sm flex items-center ${isSettingsDisabled ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-700 hover:underline focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded'}`}
                 >
                     <FontAwesomeIcon icon={faRedo} className="mr-1.5 h-4 w-4" />
                     Generate New Sequence
                 </button>
            </div>
        </div>
    );
};

export default AudioNBackGamePage;
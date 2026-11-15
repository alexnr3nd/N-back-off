// src/components/experimental/pokerCardNBack/usePokerCardNBackLogic.js
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    SUITS, RANKS, N_BACK_OPTIONS, DURATION_OPTIONS, ISI_OPTIONS, MATCH_FREQUENCY_OPTIONS,
    FEEDBACK_DURATION_MS, STIMULUS_DURATION_MS,
    INITIAL_N_BACK, INITIAL_DURATION_MINUTES, INITIAL_ISI_OPTION, INITIAL_MATCH_FREQUENCY_OPTION
} from './PokerCardNBackConstants';

const usePokerCardNBackLogic = () => {
    const [nBack, setNBack] = useState(INITIAL_N_BACK);
    const [durationMinutes, setDurationMinutes] = useState(INITIAL_DURATION_MINUTES);
    const [isiOption, setIsiOption] = useState(INITIAL_ISI_OPTION);
    const [matchFrequencyOption, setMatchFrequencyOption] = useState(INITIAL_MATCH_FREQUENCY_OPTION);

    const [gameState, setGameState] = useState('idle'); // idle, generating, playing, paused, ended
    const [sequence, setSequence] = useState([]);
    const [currentTrialIndex, setCurrentTrialIndex] = useState(-1);
    const [stimulusVisible, setStimulusVisible] = useState(false);

    const [feedback, setFeedback] = useState({ suit: 'none', rank: 'none' });
    const [score, setScore] = useState({
        suit: { hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0, responses: 0 },
        rank: { hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0, responses: 0 },
        trialsCompleted: 0,
        totalPossibleSuitMatches: 0,
        totalPossibleRankMatches: 0,
    });

    // --- Refs for state values to use in callbacks without stale closures ---
    const sequenceRef = useRef(sequence);
    const nBackRef = useRef(nBack);
    const isiOptionRef = useRef(isiOption);
    const currentTrialIndexRef = useRef(currentTrialIndex); // Ref for currentTrialIndex

    // --- Refs for timers ---
    const trialTimerRef = useRef(null);
    const stimulusTimerRef = useRef(null);
    const feedbackTimerRef = useRef({ suit: null, rank: null });
    const respondedThisTrialRef = useRef({ suit: false, rank: false });

    // --- Update refs when state changes ---
    useEffect(() => { sequenceRef.current = sequence; }, [sequence]);
    useEffect(() => { nBackRef.current = nBack; }, [nBack]);
    useEffect(() => { isiOptionRef.current = isiOption; }, [isiOption]);
    useEffect(() => { currentTrialIndexRef.current = currentTrialIndex; }, [currentTrialIndex]);

    const totalTrials = useCallback(() => {
        return Math.max(nBackRef.current + 5, Math.round((durationMinutes * 60) / isiOptionRef.current.value));
    }, [durationMinutes, nBackRef, isiOptionRef]); // Use refs

    const resetScore = useCallback(() => {
        setScore({
            suit: { hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0, responses: 0 },
            rank: { hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0, responses: 0 },
            trialsCompleted: 0,
            totalPossibleSuitMatches: 0,
            totalPossibleRankMatches: 0,
        });
    }, []);
    
    const cleanupTimers = useCallback((clearFeedback = true) => {
        if (trialTimerRef.current) clearInterval(trialTimerRef.current);
        if (stimulusTimerRef.current) clearTimeout(stimulusTimerRef.current);
        trialTimerRef.current = null;
        stimulusTimerRef.current = null;
        if (clearFeedback) {
            if (feedbackTimerRef.current.suit) clearTimeout(feedbackTimerRef.current.suit);
            if (feedbackTimerRef.current.rank) clearTimeout(feedbackTimerRef.current.rank);
            feedbackTimerRef.current = { suit: null, rank: null };
        }
    }, []);

    const generateNewSequence = useCallback(() => {
        setGameState('generating');
        // cleanupTimers called by useEffect for gameState change
        setCurrentTrialIndex(-1); 
        setStimulusVisible(false);
        setFeedback({ suit: 'none', rank: 'none' });
        resetScore();

        const numTrials = totalTrials();
        const newGeneratedSequence = [];
        let possibleSuitMatches = 0;
        let possibleRankMatches = 0;


        for (let i = 0; i < numTrials; i++) {
            let suit = SUITS[Math.floor(Math.random() * SUITS.length)];
            let rank = RANKS[Math.floor(Math.random() * RANKS.length)];
            let isSuitMatch = false;
            let isRankMatch = false;

            if (i >= nBackRef.current) {
                const prevCard = newGeneratedSequence[i - nBackRef.current];
                const prevSuit = prevCard.suit;
                const prevRank = prevCard.rank;

                // Decide if current trial's suit should be a match
                if (Math.random() < matchFrequencyOption.value) { 
                    suit = prevSuit;
                }
                // Decide if current trial's rank should be a match
                if (Math.random() < matchFrequencyOption.value) {
                    rank = prevRank;
                }
                
                isSuitMatch = (suit === prevSuit);
                isRankMatch = (rank === prevRank);
            }
            
            if(isSuitMatch) possibleSuitMatches++;
            if(isRankMatch) possibleRankMatches++;

            newGeneratedSequence.push({ suit, rank, isSuitMatch, isRankMatch, displaySuit: suit, displayRank: rank });
        }
        
        
        setSequence(newGeneratedSequence); // This updates sequence state -> sequenceRef
        setScore(prev => ({...prev, totalPossibleSuitMatches: possibleSuitMatches, totalPossibleRankMatches: possibleRankMatches}));
        setGameState('idle'); // Switch to idle after generation is complete
        return newGeneratedSequence; // Return for immediate use if needed by handlePlayPause

    }, [totalTrials, matchFrequencyOption.value, resetScore, setGameState, setCurrentTrialIndex, setStimulusVisible, setFeedback, setSequence, setScore, nBackRef]);


    // Function to perform a single trial step (advancing index, showing card, etc.)
    const performNextTrialStep = useCallback(() => {
        const trialIdxForMissCheck = currentTrialIndexRef.current; // Use ref for current value

        // Check for missed matches on the *completed* trial (trialIdxForMissCheck)
        if (trialIdxForMissCheck >= nBackRef.current && trialIdxForMissCheck < sequenceRef.current.length) {
            const prevTrial = sequenceRef.current[trialIdxForMissCheck];
            let suitFeedbackChanged = false;
            let rankFeedbackChanged = false;

            if (prevTrial.isSuitMatch && !respondedThisTrialRef.current.suit) {
                setScore(s => ({ ...s, suit: { ...s.suit, misses: s.suit.misses + 1 } }));
                setFeedback(f => ({ ...f, suit: 'missed' }));
                suitFeedbackChanged = true;
            }
            if (prevTrial.isRankMatch && !respondedThisTrialRef.current.rank) {
                setScore(s => ({ ...s, rank: { ...s.rank, misses: s.rank.misses + 1 } }));
                setFeedback(f => ({ ...f, rank: 'missed' }));
                rankFeedbackChanged = true;
            }

            if (suitFeedbackChanged) {
                if (feedbackTimerRef.current.suit) clearTimeout(feedbackTimerRef.current.suit);
                feedbackTimerRef.current.suit = setTimeout(() => setFeedback(f => ({ ...f, suit: 'none' })), FEEDBACK_DURATION_MS);
            }
            if (rankFeedbackChanged) {
                if (feedbackTimerRef.current.rank) clearTimeout(feedbackTimerRef.current.rank);
                feedbackTimerRef.current.rank = setTimeout(() => setFeedback(f => ({ ...f, rank: 'none' })), FEEDBACK_DURATION_MS);
            }
        }
        
        respondedThisTrialRef.current = { suit: false, rank: false }; // Reset for the upcoming trial

        // Update to the next trial
        setCurrentTrialIndex(prevActualCurrentTrialIndex => {
            const nextTrialIndex = prevActualCurrentTrialIndex + 1;

            if (nextTrialIndex >= sequenceRef.current.length) {
                setGameState('ended'); // This will trigger useEffect to clear timer
                setStimulusVisible(false);
                return prevActualCurrentTrialIndex; // Game ended, keep index as is
            }

            // console.log(`Advancing to trial: ${nextTrialIndex}, Card: ${sequenceRef.current[nextTrialIndex]?.rank}${sequenceRef.current[nextTrialIndex]?.suit}`);
            setStimulusVisible(true);
            setScore(s => ({ ...s, trialsCompleted: nextTrialIndex + 1 }));

            if (stimulusTimerRef.current) clearTimeout(stimulusTimerRef.current);
            stimulusTimerRef.current = setTimeout(() => {
                setStimulusVisible(false);
            }, STIMULUS_DURATION_MS);
            
            return nextTrialIndex; // Set the new trial index
        });
    }, [setScore, setFeedback, setCurrentTrialIndex, setGameState, setStimulusVisible, nBackRef, sequenceRef]); // Use refs for nBack and sequence


    // useEffect to manage the game timer and initial trial display
    useEffect(() => {
        if (gameState === 'playing') {
            if (currentTrialIndex === -1) { // Starting a new game session (trial 0)
                respondedThisTrialRef.current = { suit: false, rank: false };
                setCurrentTrialIndex(0); // Set to trial 0
                setStimulusVisible(true);
                setScore(s => ({ ...s, trialsCompleted: 1 }));

                if (stimulusTimerRef.current) clearTimeout(stimulusTimerRef.current);
                stimulusTimerRef.current = setTimeout(() => {
                    setStimulusVisible(false);
                }, STIMULUS_DURATION_MS);
                // The interval below will then call performNextTrialStep to process advancement FROM 0 TO 1, etc.
            }
            
            // Clear any existing trial timer and set a new one
            // This will handle both starting after trial 0 setup and resuming from pause
            if (trialTimerRef.current) clearInterval(trialTimerRef.current);
            trialTimerRef.current = setInterval(performNextTrialStep, isiOptionRef.current.value * 1000);

        } else {
            // If not 'playing' (paused, ended, idle, generating), clear the main trial timer
            cleanupTimers(gameState !== 'paused'); // Don't clear feedback timers if just pausing
        }
        
        // Cleanup function for this effect: clears the main trial timer
        return () => {
            if (trialTimerRef.current) clearInterval(trialTimerRef.current);
            trialTimerRef.current = null;
        };
    // currentTrialIndex is included because the logic for -1 (initial start) depends on it.
    // gameState is the primary driver for starting/stopping the timer.
    // performNextTrialStep is a stable callback. isiOptionRef is stable.
    }, [gameState, currentTrialIndex, performNextTrialStep, setCurrentTrialIndex, setStimulusVisible, setScore, isiOptionRef, cleanupTimers]);


    const handlePlayPause = useCallback(async () => {
        if (gameState === 'playing') {
            setGameState('paused');
        } else { // Game is paused, idle, or ended
            let currentSequence = sequenceRef.current; // Use ref
            if (currentSequence.length === 0 || gameState === 'ended') {
                // generateNewSequence will set gameState to 'generating', then 'idle', and setCurrentTrialIndex to -1
                const newSeq = generateNewSequence(); 
                if (newSeq.length === 0) {
                    console.error("Failed to generate sequence for play.");
                    return; 
                }
                // At this point, currentTrialIndex is -1, sequence is populated.
                // The useEffect for 'playing' state will handle setting currentTrialIndex to 0.
            }
            setGameState('playing'); // This triggers the timer useEffect
        }
    }, [gameState, generateNewSequence, setGameState]); // sequenceRef is stable

    const handleStop = useCallback(() => {
        setGameState('ended');
        // cleanupTimers called by useEffect on gameState change
        setStimulusVisible(false);
    }, [setGameState, setStimulusVisible]);

    const processResponse = useCallback((type) => { // type is 'suit' or 'rank'
        if (gameState !== 'playing' || currentTrialIndexRef.current < nBackRef.current || respondedThisTrialRef.current[type]) {
            return;
        }
        
        respondedThisTrialRef.current[type] = true;
        setScore(s => ({ ...s, [type]: { ...s[type], responses: s[type].responses + 1 } }));

        const currentCard = sequenceRef.current[currentTrialIndexRef.current];
        const isMatch = type === 'suit' ? currentCard.isSuitMatch : currentCard.isRankMatch;
        let feedbackType = 'none';

        if (isMatch) {
            setScore(s => ({ ...s, [type]: { ...s[type], hits: s[type].hits + 1 } }));
            feedbackType = 'correct';
        } else {
            setScore(s => ({ ...s, [type]: { ...s[type], falseAlarms: s[type].falseAlarms + 1 } }));
            feedbackType = 'incorrect';
        }
        setFeedback(f => ({ ...f, [type]: feedbackType }));

        if (feedbackTimerRef.current[type]) clearTimeout(feedbackTimerRef.current[type]);
        feedbackTimerRef.current[type] = setTimeout(() => {
            setFeedback(f => ({ ...f, [type]: 'none' }));
        }, FEEDBACK_DURATION_MS);

    }, [setScore, setFeedback, gameState, nBackRef, sequenceRef, currentTrialIndexRef ]); // gameState added to ensure it only runs when playing

    // Calculate correct rejections after game ends (or on demand)
    const calculateCorrectRejections = useCallback(() => {
        if (gameState === 'ended' && sequenceRef.current.length > 0) { // Use sequenceRef
            const comparableTrials = sequenceRef.current.length - nBackRef.current; // Use nBackRef
            
            const suitNonMatches = Math.max(0, comparableTrials - score.totalPossibleSuitMatches);
            const rankNonMatches = Math.max(0, comparableTrials - score.totalPossibleRankMatches);

            const suitCR = Math.max(0, suitNonMatches - score.suit.falseAlarms);
            const rankCR = Math.max(0, rankNonMatches - score.rank.falseAlarms);
            
            setScore(s => ({
                ...s,
                suit: { ...s.suit, correctRejections: suitCR },
                rank: { ...s.rank, correctRejections: rankCR }
            }));
        }
    },[gameState, score.totalPossibleSuitMatches, score.totalPossibleRankMatches, score.suit.falseAlarms, score.rank.falseAlarms, setScore, nBackRef, sequenceRef]);
    
    useEffect(() => {
        if(gameState === 'ended') {
            calculateCorrectRejections();
        }
    }, [gameState, calculateCorrectRejections]);


    useEffect(() => { // Global cleanup on unmount
        return () => cleanupTimers(true); // Clear all timers including feedback on unmount
    }, [cleanupTimers]);
    
    return {
        nBack, setNBack,
        durationMinutes, setDurationMinutes,
        isiOption, setIsiOption,
        matchFrequencyOption, setMatchFrequencyOption,
        gameState,
        sequence, // <<< --- UNCOMMENT THIS LINE ---
        currentTrialIndex,
        stimulusVisible,
        currentStimulus: sequence[currentTrialIndex] || null, // Page uses this for display
        feedback,
        score,
        totalTrialsCount: totalTrials(),
        actions: {
            generateNewSequence,
            handlePlayPause,
            handleStop,
            processSuitResponse: () => processResponse('suit'),
            processRankResponse: () => processResponse('rank'),
        },
        N_BACK_OPTIONS, DURATION_OPTIONS, ISI_OPTIONS, MATCH_FREQUENCY_OPTIONS // Export options for UI
    };
};

export default usePokerCardNBackLogic;
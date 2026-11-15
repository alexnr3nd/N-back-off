/* src/components/replay/hooks/useReplayStateSync.js */
import { useState, useCallback, useEffect, useRef } from 'react';
import audioManager from '../../../utils/audioManager'; // Import the new audio manager

const REPLAY_FEEDBACK_DURATION = 300; // ms for how long feedback visuals persist
const DEBUG_REPLAY_SYNC = false; // Specific debug flag for this hook

/**
 * Hook to synchronize the visual and audio state of the replay
 * based on the current time and events array. Returns memoized functions
 * for updating and resetting state.
 *
 * @param {Array<object>} events - The array of replay events.
 * @param {object} settings - The game settings object from replayData.
 * @param {number} replayStartTime - The absolute start timestamp of the original game.
 * @returns {object} An object containing the current replay state and control functions.
 */
export const useReplayStateSync = (events, settings, replayStartTime) => {
    // Destructure settings with defaults
    // *** MODIFIED LINE: Read 'difficulty' instead of 'difficultySeed' ***
    const { nBack = 2, difficulty = 0.5, generatedSequence: sequence = [], actualTrialCount: totalTrials = 0, modality = 'dual' } = settings || {};
    // *** END MODIFIED LINE ***

    // --- State Definitions ---
    // Mirrors the relevant parts of the live game state needed for display
    const [currentTrialIndex, setCurrentTrialIndex] = useState(-1);
    const [gridPosition, setGridPosition] = useState(null); // Current visual stimulus position
    const [visualFeedbackState, setVisualFeedbackState] = useState(null); // 'correct', 'incorrect', 'missed'
    const [missedVisualHighlightIndex, setMissedVisualHighlightIndex] = useState(null); // Trial index for missed visual match highlight
    const [posResponseFlash, setPosResponseFlash] = useState(false); // Brief flash for visual response input
    const [visualFeedbackEndTime, setVisualFeedbackEndTime] = useState(null); // Timestamp when visual feedback should clear
    const [audioLetter, setAudioLetter] = useState(null); // Current audio stimulus letter
    const [audioFeedbackState, setAudioFeedbackState] = useState(null); // 'correct', 'incorrect', 'missed'
    const [audioResponseFlash, setAudioResponseFlash] = useState(false); // Brief flash for audio response input
    const [audioFeedbackEndTime, setAudioFeedbackEndTime] = useState(null); // Timestamp when audio feedback should clear
    // Color/Shape feedback & response state (triple/quad modes)
    const [colorFeedbackState, setColorFeedbackState] = useState(null);
    const [colorResponseFlash, setColorResponseFlash] = useState(false);
    const [colorFeedbackEndTime, setColorFeedbackEndTime] = useState(null);
    const [shapeFeedbackState, setShapeFeedbackState] = useState(null);
    const [shapeResponseFlash, setShapeResponseFlash] = useState(false);
    const [shapeFeedbackEndTime, setShapeFeedbackEndTime] = useState(null);
    // Recall mode (singleColorRecall): the color the player picked for the current trial.
    // Drives the pad's selected swatch; cleared when the next trial starts.
    const [recallSelection, setRecallSelection] = useState(null);

    // --- Internal State & Refs ---
    // Keep track of the last processed event index to optimize non-seeking updates
    const [lastProcessedEventIndex, setLastProcessedEventIndex] = useState(0);
    // Store the latest time processed by updateStateForTime to manage feedback clearing
    const [latestProcessedTime, setLatestProcessedTime] = useState(0);
    // Refs for managing feedback clearing timers
    const visualFeedbackTimerRef = useRef(null);
    const audioFeedbackTimerRef = useRef(null);
    const colorFeedbackTimerRef = useRef(null);
    const shapeFeedbackTimerRef = useRef(null);

    // --- Effect to Clear Feedback Over Time ---
    // This effect runs whenever feedback end times change or the latest processed time changes.
    useEffect(() => {
        const now = latestProcessedTime; // Use the most recently processed replay time

        // Clear any existing timers before potentially setting new ones
        clearTimeout(visualFeedbackTimerRef.current);
        visualFeedbackTimerRef.current = null;
        clearTimeout(audioFeedbackTimerRef.current);
        audioFeedbackTimerRef.current = null;
        clearTimeout(colorFeedbackTimerRef.current);
        colorFeedbackTimerRef.current = null;
        clearTimeout(shapeFeedbackTimerRef.current);
        shapeFeedbackTimerRef.current = null;

        // --- Visual Feedback Timer Logic ---
        if (visualFeedbackEndTime !== null) { // Only proceed if there's an active end time
            if (now < visualFeedbackEndTime) {
                // If current time is before the end time, schedule clearing
                const delay = visualFeedbackEndTime - now;
                if (DEBUG_REPLAY_SYNC) console.log(`[Sync Effect] Scheduling VISUAL feedback clear in ${delay.toFixed(0)}ms`);
                visualFeedbackTimerRef.current = setTimeout(() => {
                    if (DEBUG_REPLAY_SYNC) console.log(`[Sync Effect] VISUAL feedback timer fired.`);
                    setVisualFeedbackState(null);
                    setVisualFeedbackEndTime(null);
                    setMissedVisualHighlightIndex(null); // Also clear missed highlight
                    visualFeedbackTimerRef.current = null; // Clear the ref
                }, delay);
            } else {
                // If current time is already past the end time (e.g., due to seeking), clear immediately
                if (DEBUG_REPLAY_SYNC) console.log(`[Sync Effect] Clearing VISUAL feedback immediately (time already passed).`);
                setVisualFeedbackState(null);
                setVisualFeedbackEndTime(null);
                setMissedVisualHighlightIndex(null);
            }
        }

        // --- Audio Feedback Timer Logic ---
        if (audioFeedbackEndTime !== null) { // Only proceed if there's an active end time
            if (now < audioFeedbackEndTime) {
                // If current time is before the end time, schedule clearing
                const delay = audioFeedbackEndTime - now;
                 if (DEBUG_REPLAY_SYNC) console.log(`[Sync Effect] Scheduling AUDIO feedback clear in ${delay.toFixed(0)}ms`);
                audioFeedbackTimerRef.current = setTimeout(() => {
                    if (DEBUG_REPLAY_SYNC) console.log(`[Sync Effect] AUDIO feedback timer fired.`);
                    setAudioFeedbackState(null);
                    setAudioFeedbackEndTime(null);
                    audioFeedbackTimerRef.current = null; // Clear the ref
                }, delay);
            } else {
                 // If current time is already past the end time, clear immediately
                if (DEBUG_REPLAY_SYNC) console.log(`[Sync Effect] Clearing AUDIO feedback immediately (time already passed).`);
                setAudioFeedbackState(null);
                setAudioFeedbackEndTime(null);
            }
        }

        // --- Color Feedback Timer Logic ---
        if (colorFeedbackEndTime !== null) {
            if (now < colorFeedbackEndTime) {
                const delay = colorFeedbackEndTime - now;
                colorFeedbackTimerRef.current = setTimeout(() => {
                    setColorFeedbackState(null);
                    setColorFeedbackEndTime(null);
                    colorFeedbackTimerRef.current = null;
                }, delay);
            } else {
                setColorFeedbackState(null);
                setColorFeedbackEndTime(null);
            }
        }

        // --- Shape Feedback Timer Logic ---
        if (shapeFeedbackEndTime !== null) {
            if (now < shapeFeedbackEndTime) {
                const delay = shapeFeedbackEndTime - now;
                shapeFeedbackTimerRef.current = setTimeout(() => {
                    setShapeFeedbackState(null);
                    setShapeFeedbackEndTime(null);
                    shapeFeedbackTimerRef.current = null;
                }, delay);
            } else {
                setShapeFeedbackState(null);
                setShapeFeedbackEndTime(null);
            }
        }

        // Cleanup function: Clear timers on unmount or if dependencies change
        return () => {
            clearTimeout(visualFeedbackTimerRef.current);
            clearTimeout(audioFeedbackTimerRef.current);
            clearTimeout(colorFeedbackTimerRef.current);
            clearTimeout(shapeFeedbackTimerRef.current);
        };
    // Dependencies: This effect should re-run if the target end times change or the current time progresses past them
    }, [visualFeedbackEndTime, audioFeedbackEndTime, colorFeedbackEndTime, shapeFeedbackEndTime, latestProcessedTime]);


    // --- MEMOIZED Function to update state based on a specific time ---
    const updateStateForTime = useCallback((targetTime, isSeeking = false) => {
        // Capture isSeeking in a ref-like variable for use inside the functional update
        const seekingFlag = isSeeking;

        // Update the latest processed time state immediately
        // Use functional update to avoid potential stale state issues if called rapidly
        setLatestProcessedTime(prevLatestTime => {
            const currentLatestTime = prevLatestTime; // Capture state at the start of this update

            if (DEBUG_REPLAY_SYNC && !isSeeking) console.log(`[updateStateForTime] Target: ${targetTime.toFixed(0)}, Last Processed: ${currentLatestTime.toFixed(0)}, Seeking: ${isSeeking}`);

            // Create temporary variables to hold the state calculated during this pass
            let tempTrialIdx = currentTrialIndex;
            let tempGridPos = gridPosition;
            let tempVisFeedback = visualFeedbackState;
            let tempMissedVisHighlightIdx = missedVisualHighlightIndex;
            let tempAudioLetter = audioLetter;
            let tempAudFeedback = audioFeedbackState;
            let tempVisEndTime = visualFeedbackEndTime;
            let tempAudEndTime = audioFeedbackEndTime;
            let tempColorFeedback = colorFeedbackState;
            let tempShapeFeedback = shapeFeedbackState;
            let tempColorEndTime = colorFeedbackEndTime;
            let tempShapeEndTime = shapeFeedbackEndTime;
            let tempRecallSelection = recallSelection;

            let startIndex = 0; // Index in the events array to start processing from

            // Handle seeking: reset state and start processing from the beginning of events
            if (isSeeking) {
                if (DEBUG_REPLAY_SYNC) console.log(`[updateStateForTime] SEEKING to ${targetTime.toFixed(0)}ms. Resetting state.`);
                startIndex = 0;
                tempTrialIdx = -1; tempGridPos = null; tempAudioLetter = null;
                tempVisFeedback = null; tempAudFeedback = null; tempMissedVisHighlightIdx = null;
                tempVisEndTime = null; tempAudEndTime = null;
                tempColorFeedback = null; tempShapeFeedback = null;
                tempColorEndTime = null; tempShapeEndTime = null;
                tempRecallSelection = null;
                // Also reset flash states immediately on seek
                setPosResponseFlash(false);
                setAudioResponseFlash(false);
                setColorResponseFlash(false);
                setShapeResponseFlash(false);
            } else {
                // Normal update: start from the last processed event index
                startIndex = lastProcessedEventIndex;
                // Sanity check: If target time jumps backwards significantly, recalculate from start
                if (targetTime < currentLatestTime - 100) { // Increased tolerance for minor fluctuations
                    if (DEBUG_REPLAY_SYNC) console.log(`[updateStateForTime] WARN: Target time ${targetTime.toFixed(0)} jumped backwards from last processed ${currentLatestTime.toFixed(0)}. Recalculating from event 0.`);
                    startIndex = 0;
                    tempTrialIdx = -1; tempGridPos = null; tempAudioLetter = null;
                    tempVisFeedback = null; tempAudFeedback = null; tempMissedVisHighlightIdx = null;
                    tempVisEndTime = null; tempAudEndTime = null;
                    tempColorFeedback = null; tempShapeFeedback = null;
                    tempColorEndTime = null; tempShapeEndTime = null;
                    tempRecallSelection = null;
                    // Also clear flashes if recalculating
                    setPosResponseFlash(false);
                    setAudioResponseFlash(false);
                    setColorResponseFlash(false);
                    setShapeResponseFlash(false);
                }
            }

            let currentEventIdx = startIndex;
            // Process events from startIndex up to the targetTime
            while (currentEventIdx < events.length) {
                const event = events[currentEventIdx];
                // Calculate event time relative to the replay's start
                const eventRelativeTime = (event.timestamp || 0) - replayStartTime;

                // Stop processing if this event is beyond the target time
                if (eventRelativeTime > targetTime) break;

                // --- Apply Event Changes to Temporary State ---
                switch (event.type) {
                    case 'trialStart':
                        tempTrialIdx = event.trialIndex;
                        // Recall's locked answer is per-trial (the live game clears it on trial advance),
                        // so it clears on EVERY trial boundary — seeking included. During a seek the
                        // events after this trialStart are still replayed, so a selection belonging to
                        // the sought trial re-sets it; without the unconditional clear the pad would
                        // keep showing an earlier trial's color (e.g. step back over an unanswered trial).
                        tempRecallSelection = null;
                        // When a new trial starts naturally (not seeking), clear the stimuli from the *previous* trial
                        if (!isSeeking) {
                           tempGridPos = null;
                           tempAudioLetter = null;
                           // Do NOT clear feedback here - let the timer effect handle it based on feedbackEndTime
                        }
                        break;
                    case 'visualStimulusOn':
                        if (modality !== 'audio') { tempGridPos = event.position; }
                        break;
                    case 'visualStimulusOff':
                         // Only turn off the stimulus if it belongs to the trial index being processed
                        if (tempGridPos !== null && event.trialIndex === tempTrialIdx) {
                            tempGridPos = null; // Turn off visual stimulus
                        }
                        break;
                    case 'audioStimulusStart':
                        // Update the letter state. Actual playback triggered elsewhere.
                        if (modality !== 'visual') { tempAudioLetter = event.letter; }
                        break;
                    case 'responsePosition':
                        // Briefly flash visual response indicator if not seeking
                        if (!isSeeking) { setPosResponseFlash(true); setTimeout(() => setPosResponseFlash(false), 150); }
                        break;
                    case 'responseAudio':
                         // Briefly flash audio response indicator if not seeking
                        if (!isSeeking) { setAudioResponseFlash(true); setTimeout(() => setAudioResponseFlash(false), 150); }
                        break;
                    case 'feedbackVisual':
                        if (!event.disabled) { // Check if feedback was enabled for this event
                            tempVisFeedback = event.feedbackType;
                            tempVisEndTime = eventRelativeTime + REPLAY_FEEDBACK_DURATION; // Schedule end time
                            if (event.feedbackType === 'missed') {
                                 tempMissedVisHighlightIdx = event.trialIndex; // Highlight missed position
                            } else {
                                // Clear missed highlight *only* if it matches the current feedback's trial
                                 if (tempMissedVisHighlightIdx === event.trialIndex) {
                                    tempMissedVisHighlightIdx = null;
                                 }
                            }
                             // Play feedback sound only during natural playback (not seeking)
                            if (!isSeeking) {
                                 audioManager.playFeedbackSound(event.feedbackType === 'correct' ? 'correct' : 'incorrect');
                            }
                        }
                        break;
                    case 'feedbackAudio':
                         if (!event.disabled) { // Check if feedback was enabled
                            tempAudFeedback = event.feedbackType;
                            tempAudEndTime = eventRelativeTime + REPLAY_FEEDBACK_DURATION; // Schedule end time
                             // Play feedback sound only during natural playback
                            if (!isSeeking) {
                                audioManager.playFeedbackSound(event.feedbackType === 'correct' ? 'correct' : 'incorrect');
                            }
                        }
                        break;
                    case 'responseColor':
                        if (!isSeeking) { setColorResponseFlash(true); setTimeout(() => setColorResponseFlash(false), 150); }
                        break;
                    case 'responseShape':
                        if (!isSeeking) { setShapeResponseFlash(true); setTimeout(() => setShapeResponseFlash(false), 150); }
                        break;
                    case 'feedbackColor':
                        if (!event.disabled) {
                            tempColorFeedback = event.feedbackType;
                            tempColorEndTime = eventRelativeTime + REPLAY_FEEDBACK_DURATION;
                            if (!isSeeking) {
                                audioManager.playFeedbackSound(event.feedbackType === 'correct' ? 'correct' : 'incorrect');
                            }
                        }
                        break;
                    case 'feedbackShape':
                        if (!event.disabled) {
                            tempShapeFeedback = event.feedbackType;
                            tempShapeEndTime = eventRelativeTime + REPLAY_FEEDBACK_DURATION;
                            if (!isSeeking) {
                                audioManager.playFeedbackSound(event.feedbackType === 'correct' ? 'correct' : 'incorrect');
                            }
                        }
                        break;
                    // --- Recall mode (singleColorRecall) ---
                    // Recall reuses the color slot: a session is either Recall or color-match, never both.
                    case 'responseColorRecall':
                        if (!isSeeking) { setColorResponseFlash(true); setTimeout(() => setColorResponseFlash(false), 150); }
                        tempRecallSelection = event.selectedColor ?? null;
                        break;
                    case 'feedbackColorRecall':
                        // DIVERGES from the sibling feedback* cases on purpose. Recall logs a
                        // 'missed' event on EVERY unanswered (blank) trial, and there `disabled: true`
                        // means only "miss feedback was suppressed by the player's settings" — the blank
                        // still happened and was still scored. So the blank is always surfaced in the
                        // replay (this is a review tool: hiding it would make blanks invisible for anyone
                        // who plays with miss feedback off); only the SOUND is withheld, matching what
                        // the player actually heard live. 'correct'/'incorrect' keep the sibling
                        // disabled-skip: when that feedback is off those events log as 'acknowledged'
                        // and carry no correctness to show.
                        if (event.feedbackType === 'missed') {
                            tempColorFeedback = 'missed';
                            tempColorEndTime = eventRelativeTime + REPLAY_FEEDBACK_DURATION;
                            if (!event.disabled && !isSeeking) {
                                audioManager.playFeedbackSound('incorrect');
                            }
                        } else if (!event.disabled) {
                            tempColorFeedback = event.feedbackType;
                            tempColorEndTime = eventRelativeTime + REPLAY_FEEDBACK_DURATION;
                            if (!isSeeking) {
                                audioManager.playFeedbackSound(event.feedbackType === 'correct' ? 'correct' : 'incorrect');
                            }
                        }
                        break;
                    default: break; // Ignore other event types like gameStart, gameEnd etc.
                }
                currentEventIdx++; // Move to the next event index
            }

            // --- Update Component State ---
            // Update state values only if they have actually changed from the current component state
            // This minimizes unnecessary re-renders triggered by the state setters.
            if (tempTrialIdx !== currentTrialIndex) setCurrentTrialIndex(tempTrialIdx);
            // Skip setting gridPosition and audioLetter when seeking - displayStimuliForTrial handles those
            if (!seekingFlag) {
                if (tempGridPos !== gridPosition) setGridPosition(tempGridPos);
                if (tempAudioLetter !== audioLetter) setAudioLetter(tempAudioLetter);
            }
            if (tempVisFeedback !== visualFeedbackState) setVisualFeedbackState(tempVisFeedback);
            if (tempMissedVisHighlightIdx !== missedVisualHighlightIndex) setMissedVisualHighlightIndex(tempMissedVisHighlightIdx);
            if (tempAudFeedback !== audioFeedbackState) setAudioFeedbackState(tempAudFeedback);
            if (tempColorFeedback !== colorFeedbackState) setColorFeedbackState(tempColorFeedback);
            if (tempShapeFeedback !== shapeFeedbackState) setShapeFeedbackState(tempShapeFeedback);
            if (tempRecallSelection !== recallSelection) setRecallSelection(tempRecallSelection);
            // Update end times: These *should* always be updated if feedback occurred, triggering the timer effect
            if (tempVisEndTime !== visualFeedbackEndTime) setVisualFeedbackEndTime(tempVisEndTime);
            if (tempAudEndTime !== audioFeedbackEndTime) setAudioFeedbackEndTime(tempAudEndTime);
            if (tempColorEndTime !== colorFeedbackEndTime) setColorFeedbackEndTime(tempColorEndTime);
            if (tempShapeEndTime !== shapeFeedbackEndTime) setShapeFeedbackEndTime(tempShapeEndTime);

            // Store the index of the *next* event to process for subsequent non-seeking updates
            setLastProcessedEventIndex(currentEventIdx);

            // Return the targetTime to update the latestProcessedTime state
            return targetTime;
        }); // End of functional update for setLatestProcessedTime

     // Dependencies for the useCallback wrapping updateStateForTime
     // Include all external values (props, state, refs - though refs are stable) used inside the function.
     // State setters are guaranteed stable by React.
     // Added 'difficulty' to dependencies, although not actively used in this hook's logic,
     // it's part of the destructured settings object which defines the hook's context.
     }, [ events, replayStartTime, modality, sequence, difficulty, // Stable game definition props (added difficulty)
           // State values read inside for comparison or logic:
           currentTrialIndex, gridPosition, visualFeedbackState, missedVisualHighlightIndex,
           audioLetter, audioFeedbackState, visualFeedbackEndTime, audioFeedbackEndTime,
           colorFeedbackState, colorFeedbackEndTime, shapeFeedbackState, shapeFeedbackEndTime,
           recallSelection,
           lastProcessedEventIndex // Needed to determine starting point for non-seek updates
         ]);


    // --- MEMOIZED Function to explicitly display stimuli for a trial ---
    // Used for stepping or manually setting state after a seek.
    const displayStimuliForTrial = useCallback((targetTrialIndex) => {
        // Reset state first
        setGridPosition(null); setAudioLetter(null);
        setVisualFeedbackState(null); setAudioFeedbackState(null);
        setMissedVisualHighlightIndex(null);
        setVisualFeedbackEndTime(null); setAudioFeedbackEndTime(null);
        setPosResponseFlash(false); setAudioResponseFlash(false);
        setColorFeedbackState(null); setColorFeedbackEndTime(null); setColorResponseFlash(false);
        setShapeFeedbackState(null); setShapeFeedbackEndTime(null); setShapeResponseFlash(false);
        setRecallSelection(null);

        if (targetTrialIndex < 0 || targetTrialIndex >= totalTrials) return; // Boundary check

        // Find and set visual stimulus if applicable
        const visualStimEvent = events.find(e => e.type === 'visualStimulusOn' && e.trialIndex === targetTrialIndex);
        if (visualStimEvent && modality !== 'audio') {
            setGridPosition(visualStimEvent.position);
        }

        // Find and set audio stimulus letter if applicable
        const audioStimEvent = events.find(e => e.type === 'audioStimulusStart' && e.trialIndex === targetTrialIndex);
        if (audioStimEvent && modality !== 'visual') {
            setAudioLetter(audioStimEvent.letter);
            // NOTE: Actual audio playback is triggered by ReplayViewer's effect/step handler
        }

        // Recall: re-derive the trial's locked answer, same as the stimuli above. Both seek paths
        // run this AFTER updateStateForTime(t, true), so without it the pad would read blank on
        // every stepped-to trial even when the player answered it. Absent for non-recall replays.
        const recallSelectionEvent = events.find(e => e.type === 'responseColorRecall' && e.trialIndex === targetTrialIndex);
        if (recallSelectionEvent) {
            setRecallSelection(recallSelectionEvent.selectedColor ?? null);
        }
    }, [events, totalTrials, modality]); // Dependencies


     // --- MEMOIZED Function to find the start time of a specific trial ---
     // Seeks to the stimulus event (not trial start) so the stimulus is actively displayed
     const findTrialStartTime = useCallback((trialIndex) => {
        if (trialIndex < 0) return 0; // Time 0 for indices before the first trial

        const epsilon = 1; // Add 1ms to ensure we are just past the event timestamp

        // Find the visual or audio stimulus event for this trial
        // This ensures we seek to a time where the stimulus is displayed
        const stimulusEvent = events.find(e =>
            (e.type === 'visualStimulusOn' || e.type === 'audioStimulusStart') &&
            e.trialIndex === trialIndex
        );

        if (stimulusEvent) {
            return Math.max(0, (stimulusEvent.timestamp || 0) - replayStartTime + epsilon);
        }

        // Fallback to trialStart if no stimulus event found
        const trialStartEvent = events.find(e =>
            e.type === 'trialStart' && e.trialIndex === trialIndex
        );
        if (trialStartEvent) {
            return Math.max(0, (trialStartEvent.timestamp || 0) - replayStartTime + epsilon);
        }

        // Fallback if event not found (shouldn't normally happen for valid indices)
        console.warn(`Could not find start time for trial ${trialIndex}`);
        return null;
     }, [events, replayStartTime]); // Dependencies


     // --- MEMOIZED Function to reset state to the beginning (time 0) ---
     const resetStateToStart = useCallback(() => {
        setCurrentTrialIndex(-1); setGridPosition(null);
        setVisualFeedbackState(null); setMissedVisualHighlightIndex(null);
        setPosResponseFlash(false); setVisualFeedbackEndTime(null);
        setAudioLetter(null); setAudioFeedbackState(null);
        setAudioResponseFlash(false); setAudioFeedbackEndTime(null);
        setColorFeedbackState(null); setColorFeedbackEndTime(null); setColorResponseFlash(false);
        setShapeFeedbackState(null); setShapeFeedbackEndTime(null); setShapeResponseFlash(false);
        setRecallSelection(null);
        setLastProcessedEventIndex(0); setLatestProcessedTime(0);
     }, []); // No dependencies needed as it only calls setters with initial values

    // --- Return Hook Interface ---
    // Provide the current state values and the memoized control functions
    return {
        // Current Display State
        currentTrialIndex,
        gridPosition,
        visualFeedbackState,
        missedVisualHighlightIndex,
        posResponseFlash,
        audioLetter,
        audioFeedbackState,
        audioResponseFlash,
        colorFeedbackState,
        colorResponseFlash,
        shapeFeedbackState,
        shapeResponseFlash,
        recallSelection, // Recall mode only: color picked for the current trial (null otherwise)
        // Memoized Functions
        updateStateForTime,
        displayStimuliForTrial,
        findTrialStartTime,
        resetStateToStart,
    };
};
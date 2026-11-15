/* src/contexts/game/gameActions.js */
import audioManager from '../../utils/audioManager'; // Utility for managing audio playback

/**
 * Factory function returning the *logic* for core game actions like pause, resume, etc.
 * These are plain functions (not wrapped in useCallback here) that operate on the
 * state and refs provided by the GameContext.
 *
 * @param {object} params - Dependencies required for the actions.
 * @param {Function} params.setGameState - Setter for the main game state ('idle', 'playing', etc.).
 * @param {Function} params.setNBack - Setter for the N-back level state.
 * @param {Function} params.setDifficulty - Setter for the difficulty state.
 * @param {Function} params.setSaveToProfile - Setter for the saveToProfile flag state.
 * @param {Function} params.setCurrentTrial - Setter for the current trial index state.
 * @param {Function} params.setShowCountdown - Setter for the countdown visibility state.
 * @param {Function} params.setIsCountdownVisuallyComplete - Setter for the countdown completion flag.
 * @param {Function} params.setPauseReason - Setter for the reason the game was paused ('manual', 'navigation_block', etc.).
 * @param {React.MutableRefObject<string>} params.latestGameStateRef - Ref holding the most recent gameState value.
 * @param {React.MutableRefObject<number[]>} params.visualResponsesRef - Ref holding indices of visual responses.
 * @param {React.MutableRefObject<number[]>} params.audioResponsesRef - Ref holding indices of audio responses.
 * @param {React.MutableRefObject<NodeJS.Timeout|null>} params.timerRef - Ref holding the main game interval timer ID.
 * @param {React.MutableRefObject<number|null>} params.sessionStartTimeRef - Ref holding the timestamp when the session started playing.
 * @param {React.MutableRefObject<boolean>} params.isEndingRef - Ref indicating if the endGame process is underway.
 * @param {Function} params.logReplayEvent - Function to log events for session replays.
 * @returns {object} Object containing the logic functions for game actions.
 */
export function createGameActions({
    // State Setters from GameContext
    setGameState,
    setNBack,
    setDifficulty,
    setSaveToProfile,
    setCurrentTrial,
    setShowCountdown,
    setIsCountdownVisuallyComplete,
    setPauseReason, // Setter for pause reason

    // Refs from GameContext
    latestGameStateRef,
    visualResponsesRef, // <<< Ref for visual responses
    audioResponsesRef,  // <<< Ref for audio responses
    colorResponsesRef,  // <<< Ref for color responses (triple/quad modes)
    shapeResponsesRef,  // <<< Ref for shape responses (quad mode)
    colorRecallSelectionsRef, // <<< Ref for Recall Mode selections (singleColorRecall): trialIndex -> color
    timerRef,
    sessionStartTimeRef,
    isEndingRef,

    // Utilities/Other Actions
    logReplayEvent
}) {

    /**
     * Logic to pause the currently active game.
     * Sets the game state to 'paused' and records the reason.
     * Stops the game timer and stimulus audio.
     *
     * @param {string} [reason='manual'] - The reason for pausing ('manual', 'navigation_block', etc.).
     */
    const pauseGameLogic = (reason = 'manual') => {
        const currentState = latestGameStateRef?.current;

        // Can only pause if the game is currently 'playing'
        if (currentState !== 'playing') {
             // Avoid excessive logging if already paused or in another state
             if (currentState !== 'paused') {
                 console.warn(`[GameActions Logic] pauseGame called in invalid state: ${currentState}`);
             }
            return;
        }

        // Clear the main game timer interval if it exists
        if (timerRef?.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        // Stop any currently playing stimulus audio (e.g., letter sound)
        audioManager.stopCurrentSound();

        // Update the state to reflect the pause and its reason
        setPauseReason(reason); // Set the specific reason for the pause
        setGameState('paused');   // Set the game state to paused

        // Log the pause event for replays
        logReplayEvent({ type: 'pause', timestamp: Date.now(), reason: reason });
    };

    /**
     * Logic to resume the game from a paused state.
     * Resets the pause reason and sets the game state back to 'playing'.
     * The main timer effect in GameContext will handle restarting the timer.
     */
     const resumeGameLogic = () => {
        const currentState = latestGameStateRef?.current;

        // Can only resume if currently 'paused'
        if (currentState !== 'paused') {
            console.warn(`[GameActions Logic] resumeGame called in invalid state: ${currentState}`);
            return;
        }

        // Note: Audio context resumption is handled in the GameContext's `resumeGame` wrapper.

        // Clear the pause reason and set the state back to playing
        setPauseReason(null); // Clear the pause reason upon resuming
        setGameState('playing');

        // Log the resume event for replays
        logReplayEvent({ type: 'resume', timestamp: Date.now() });
    };

    /**
     * Logic to clear the pause reason state, typically used when cancelling
     * an action that caused a specific pause reason (like cancelling the
     * navigation block confirmation modal).
     * Important: This action *only* clears the reason; it does *not* change
     * the main `gameState` (the game remains paused if it was paused).
     */
    const clearPauseReasonLogic = () => {
        setPauseReason(null); // Directly update the pauseReason state to null
    };

    /**
     * Logic executed after the countdown component visually finishes its animation.
     * This signals the GameContext that it's time to transition to the 'playing' state.
     */
    const playAfterCountdownLogic = () => {
         const currentState = latestGameStateRef?.current;
        // Only proceed if the game is currently in the 'preparing' state
        if (currentState === 'preparing') {
            // Set the flag that the main effect in GameContext watches
            setIsCountdownVisuallyComplete(true);
        } else {
             console.warn(`[gameActions playAfterCountdownLogic] Called in unexpected state: ${currentState}`);
        }
    };

    // *** MODIFIED: registerResponseLogic now updates the response refs ***
    /**
     * Logic to register a user's response (visual or audio match button press).
     * Updates the corresponding response ref array in GameContext (visualResponsesRef or audioResponsesRef).
     * This is crucial for correctly calculating results at the end of the game.
     *
     * @param {'visual' | 'audio'} type - The type of response being registered.
     * @param {number} trialIndex - The 0-based index of the trial the response corresponds to.
     */
    const registerResponseLogic = (type, trialIndex) => {
        const currentState = latestGameStateRef?.current;
        // Only record responses during the 'playing' state
        if (currentState !== 'playing') {
            // Optional: Log ignored responses for debugging if needed
            // console.log(`[GameActions Logic] Response (${type} for trial ${trialIndex}) ignored, game not 'playing' (state: ${currentState})`);
            return;
        }
        // Validate trialIndex to ensure it's a valid number
        if (typeof trialIndex !== 'number' || !Number.isInteger(trialIndex) || trialIndex < 0) {
            console.error(`[GameActions Logic] Invalid trialIndex (${trialIndex}) received for response type ${type}.`);
            return;
        }

        // Update the appropriate ref array, ensuring no duplicates for the same trial index
        if (type === 'visual' && visualResponsesRef?.current) { // Check if ref exists
            if (!visualResponsesRef.current.includes(trialIndex)) { // Check for duplicates
                visualResponsesRef.current.push(trialIndex); // Add the trial index
                // Optional: Log successful registration for debugging
            } else {
                // Handle duplicate response attempt (e.g., rapid clicks) - usually ignored silently
                // console.debug(`[GameActions Logic] Duplicate visual response for trial ${trialIndex} ignored.`);
            }
        } else if (type === 'audio' && audioResponsesRef?.current) { // Check if ref exists
            if (!audioResponsesRef.current.includes(trialIndex)) { // Check for duplicates
                audioResponsesRef.current.push(trialIndex); // Add the trial index
            } else {
                // Handle duplicate response attempt
                // console.debug(`[GameActions Logic] Duplicate audio response for trial ${trialIndex} ignored.`);
            }
        } else {
            // Log error if the corresponding ref is missing (should not happen in normal operation)
            if (!visualResponsesRef?.current && type === 'visual') console.error("[GameActions Logic] visualResponsesRef is missing!");
            if (!audioResponsesRef?.current && type === 'audio') console.error("[GameActions Logic] audioResponsesRef is missing!");
        }
        // Note: Feedback logic (checking correctness, UI updates) is handled in useGameResponses hook.
        // This function purely records the raw response index in the context refs.
    };
    // *** END MODIFIED CODE ***

    /**
     * Logic to manually override N-Back and Difficulty settings.
     * Typically used for debugging or specific testing scenarios.
     * Automatically sets saveToProfile to false when used.
     *
     * @param {number} n - The N-back level to set.
     * @param {number} d - The difficulty level to set.
     */
     const setManualSettingsLogic = (n, d) => {
        setNBack(n);
        setDifficulty(d);
        // Manual overrides generally shouldn't affect standard progression
        setSaveToProfile(false);
    };

    /**
     * Logic to reset the context's internal arrays tracking user responses.
     * Called typically when starting a new game session.
     */
    const resetContextResponseArraysLogic = () => {
        // Reset the refs holding response indices
        if (visualResponsesRef) visualResponsesRef.current = [];
        if (audioResponsesRef) audioResponsesRef.current = [];
        if (colorResponsesRef) colorResponsesRef.current = [];
        if (shapeResponsesRef) shapeResponsesRef.current = [];
        if (colorRecallSelectionsRef) colorRecallSelectionsRef.current = {};
    };

    // Return the logic functions to be used by GameContext
    return {
        pauseGameLogic,
        resumeGameLogic,
        clearPauseReasonLogic,
        playAfterCountdownLogic,
        registerResponseLogic, // <<< Export the UPDATED logic
        setManualSettingsLogic,
        resetContextResponseArraysLogic,
    };
}
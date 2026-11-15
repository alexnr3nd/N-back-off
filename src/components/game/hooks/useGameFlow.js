/* File: src/components/game/hooks/useGameFlow.js */

import { useEffect, useCallback } from 'react';

/**
 * Manages post-game actions like retrying, starting the next session, or returning to the dashboard.
 * Also includes the effect to check for missed matches during gameplay.
 * Accepts a single dependency object from the calling component (GameScreen).
 */
const useGameFlow = ({
    // === Functions/State passed as dependencies from GameScreen ===

    // From useGameResponses:
    checkMissedMatches,         // Function to check for missed matches on trial change
    resetResponses,             // Function to clear UI feedback state

    // From GameContext (via useGame in GameScreen):
    resetContextResponseArrays, // Function to clear internal hit/miss arrays
    startGame,                  // Function to initiate a new game session
    sequence,                   // Current game sequence (for checkMissedMatches)
    currentTrial,               // Current trial index (for checkMissedMatches)
    gameState,                  // Current game state (for checkMissedMatches)
    gameResults,                // Results object after game ends (for retry logic AND challenge success check) // <<< Added comment
    sessionSettingsRef,         // Ref containing settings of the completed session

    // From useNavigate (passed from GameScreen):
    navigate,                   // React Router navigation function

    // From GameContext (via useGame in GameScreen):
    gameOriginRef,              // Ref tracking where the user started the game from

}) => {

    // --- Effect to Check for Missed Matches ---
    // Runs whenever the trial changes while the game might be playing.
    useEffect(() => {
        // Ensure checkMissedMatches was passed correctly and is a function
        if (typeof checkMissedMatches === 'function') {
            // The checkMissedMatches function itself should verify gameState === 'playing' internally
            // It checks the *previous* trial based on the new currentTrial value.
            checkMissedMatches(currentTrial, sequence, gameState);
        } else {
            // Log an error if the function is missing, helps debugging
            // This check might be redundant if GameScreen ensures it's passed, but safe to keep.
            if(gameState === 'playing') { // Only log error during active gameplay
                console.error("useGameFlow Effect Error: checkMissedMatches dependency is not a function!", { checkMissedMatches });
            }
        }
    // Dependencies: Effect reruns if these key values change
    }, [currentTrial, sequence, gameState, checkMissedMatches]);

    // --- Action Handlers (Wrapped with useCallback for stability) ---

    /**
     * Handler for the "Retry Level N.00" button in GameResults.
     * Resets necessary states and starts a new game session overriding N-Back and setting difficulty to 0.00.
     */
    const handleRetryLevel = useCallback(() => {
        // Ensure we have results data to know which level to retry
        if (!gameResults || typeof gameResults.nBack !== 'number') {
            console.error("[useGameFlow] Cannot retry level: gameResults data or nBack is missing.", { gameResults });
            // Optionally navigate to origin as a fallback
            if (typeof navigate === 'function') navigate(gameOriginRef?.current || '/dashboard');
            return;
        }

        // 1. Reset UI feedback state (e.g., button highlights, feedback messages in useGameResponses)
        if (typeof resetResponses === 'function') {
            resetResponses();
        } else {
            console.warn("[useGameFlow] resetResponses function not provided for handleRetryLevel.");
        }

        // 2. Reset internal game context response arrays (visual/audio hits/misses stored in GameContext refs)
        if (typeof resetContextResponseArrays === 'function') {
            resetContextResponseArrays();
        } else {
            console.warn("[useGameFlow] resetContextResponseArrays function not provided for handleRetryLevel.");
        }

        // 3. Start the game with specific override options using the N-Back from the results
        if (typeof startGame === 'function') {
            const nBackToRetry = gameResults.nBack;
            startGame({
                overrideNBack: nBackToRetry,
                overrideDifficulty: 0.00, // Retry always starts at the base difficulty for that N
                skipCountdown: true,
                ...(gameResults.trainingMode && { trainingMode: gameResults.trainingMode }),
                ...((gameResults.newSubMode != null || gameResults.trainingMode === 'dynamic') && gameResults.gameMode && { overrideGameMode: gameResults.gameMode }),
            });
            // GameScreen's useEffect watching gameState will handle UI updates (e.g., showing countdown)
        } else {
            console.error("[useGameFlow] startGame action is not available for handleRetryLevel.");
            // Fallback navigation
            if (typeof navigate === 'function') navigate(gameOriginRef?.current || '/dashboard');
        }
    }, [gameResults, resetResponses, resetContextResponseArrays, startGame, navigate]); // Include all dependencies

    /**
     * Handler for the "Start Next Session" or "Play Again" button in GameResults.
     * Starts a new game using the current profile settings.
     */
    const handleStartNextSession = useCallback(() => {
        // 1. Reset UI feedback state from the previous session
        if (typeof resetResponses === 'function') {
            resetResponses();
        } else {
            console.warn("[useGameFlow] resetResponses function not provided for handleStartNextSession.");
        }

        // 2. Reset internal game context response arrays
        if (typeof resetContextResponseArrays === 'function') {
            resetContextResponseArrays();
        } else {
            console.warn("[useGameFlow] resetContextResponseArrays function not provided for handleStartNextSession.");
        }

        // 3. Start a new standard game session (no overrides).
        // The `startGame` function in GameContext, when called without options,
        // should read the current N-Back and Difficulty from the active profile/context state.
        // This correctly handles starting Level N+1.00 after a successful challenge,
        // because completeChallengeLogic already updated the context state.
        if (typeof startGame === 'function') {
            startGame({ skipCountdown: true }); // Launched from results page → no countdown
        } else {
            console.error("[useGameFlow] startGame action is not available for handleStartNextSession.");
             if (typeof navigate === 'function') navigate(gameOriginRef?.current || '/dashboard'); // Fallback
        }
    }, [
        resetResponses, resetContextResponseArrays, startGame, navigate, gameResults
    ]);

    /**
     * Handler for the "Dashboard" button in GameResults.
     * Simply navigates the user back to the main dashboard screen.
     */
    const handleGoToDashboard = useCallback(() => {
        try { sessionStorage.removeItem('lastResultsSessionId'); } catch(e) {}

        if (typeof navigate === 'function') {
            navigate('/dashboard');
        } else {
            console.error("[useGameFlow] navigate function not provided for handleGoToDashboard.");
        }
    }, [navigate]); // Dependency: navigate function

    // --- Return Hook Interface ---
    // Expose the handlers needed by the GameResults component (or potentially GameScreen)
    return {
        handleRetryLevel,
        handleStartNextSession,
        handleGoToDashboard
    };
};

export default useGameFlow; // Ensure it's the default export
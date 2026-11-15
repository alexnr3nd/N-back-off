/* File: src/components/game/hooks/useGameControls.js */
import { useEffect, useCallback } from 'react';
import { useGame } from '../../../contexts/GameContext'; // Hook to access game context
import { useSettings } from '../../../contexts/SettingsContext'; // Hook to access settings like keybindings
import { GAME_MODES, COLOR_STIMULI } from '../../../constants/gameConstants';

/**
 * Custom hook to manage game controls via keyboard input.
 * Handles:
 * - Pause/Resume toggle using Spacebar or 'P'.
 * - Visual/Audio match responses based on user-defined keybindings.
 * - Optional debug key combination.
 * Obtains necessary actions and refs directly from GameContext.
 */
const useGameControls = ({
    // === Dependencies passed from GameScreen ===
    // gameState is still useful passed down to control the useEffect listener attachment
    gameState,
    // Callbacks for match responses are passed from useGameResponses via GameScreen
    onPositionMatch,        // Callback function for visual match attempt
    onAudioMatch,           // Callback function for audio match attempt
    onColorMatch,           // Callback function for color match attempt (Triple/Quad)
    onShapeMatch,           // Callback function for shape match attempt (Quad)
    onRecallSelect,         // Callback function for a recall color pick (singleColorRecall)
    // Game mode to determine which keys to listen for
    gameMode = 'dual',
    // Optional debug info
    debugInfo = null
}) => {
    // --- Context Access ---
    // Get necessary refs and actions directly from GameContext
    const {
        logReplayEvent,         // Function to log replay events
        latestGameStateRef,     // Ref to the latest game state
        currentTrialRef,        // Ref to the current trial index
        pauseGame,              // Action to pause the game
        resumeGame,             // Action to resume the game
        // endGame // Action to end the game (could be added if needed for a keybinding)
    } = useGame();
    // Get settings (specifically keyBindings) from SettingsContext
    const { settings } = useSettings();

    // --- Settings Values ---
    // Provide default keybindings if settings or keyBindings are not yet loaded/available
    const keyBindings = settings?.keyBindings || {
        visual: 'ArrowLeft',
        audio: 'ArrowRight',
        color: 'ArrowDown',
        shape: 'ArrowUp'
    };

    // Determine if color/shape responses are needed based on game mode
    const isTriple = gameMode === 'triple';
    const isQuad = gameMode === 'quad';
    // Single-modality modes — each binds to its own modality hotkey (same
    // keys as quad: visual=Left, audio=Right, color=Down, shape=Up, unless
    // the user has customized them in Settings). Spacebar remains the
    // pause key for singles, same as the multi-modal modes.
    const modalities = GAME_MODES[gameMode]?.modalities;
    const isSingle = Array.isArray(modalities) && modalities.length === 1;
    const isSingleColor = gameMode === 'singleColor';
    const isSingleShape = gameMode === 'singleShape';
    // Recall Mode answers with the digits 1-8 (one per pool color) instead of a match key.
    // Its arrow keys stay inert: isSingle is true here and the per-modality guards below
    // all require a different single mode.
    const isRecall = gameMode === 'singleColorRecall';

    // --- Combined Pause/Resume Handler (for Button & Keyboard) ---
    // Memoized function to toggle between playing and paused states.
    const handlePauseResume = useCallback(() => {
        const currentState = latestGameStateRef?.current; // Read latest state via ref
        if (currentState === 'playing') {
            if (logReplayEvent) logReplayEvent({ type: 'pause', timestamp: Date.now() });
            if (typeof pauseGame === 'function') {
                pauseGame();
            } else {
                console.error("[handlePauseResume] pauseGame action missing from GameContext!");
            }
        } else if (currentState === 'paused') {
            if (logReplayEvent) logReplayEvent({ type: 'resume', timestamp: Date.now() });
            if (typeof resumeGame === 'function') {
                resumeGame(); // resumeGame should handle audio context resumption
            } else {
                console.error("[handlePauseResume] resumeGame action missing from GameContext!");
            }
        } else {
            console.warn(`[handlePauseResume] Called in unexpected state: ${currentState}`);
        }
    }, [latestGameStateRef, pauseGame, resumeGame, logReplayEvent]); // Dependencies for the callback

    // --- Keyboard Event Handler (Memoized) ---
    // Handles all relevant keyboard inputs during the game.
    const handleKeyDown = useCallback((e) => {
        const currentState = latestGameStateRef?.current; // Read latest state for checks
        const target = e.target;
        // Ignore key presses if an input field, textarea, or editable element has focus
        const isInputFocused = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

        // --- Pause/Resume Logic ('P'/'p' always; Spacebar in any mode) ---
        const pauseKeys = [' ', 'p', 'P'];
        if (!isInputFocused && pauseKeys.includes(e.key)) {
            // Only allow toggle if game is currently playing or paused
            if (currentState === 'playing' || currentState === 'paused') {
                e.preventDefault(); // Prevent default spacebar/letter actions
                handlePauseResume(); // Use the combined handler
            }
        }
        // --- Debug Key (Ctrl+D or Cmd+D) ---
        else if (!isInputFocused && e.key === 'd' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            // Add any other specific debug actions here if needed
        }
        // --- Game Response Keys (Visual/Audio/Color/Shape Match) ---
        // Only process response keys if the game is actively 'playing'
        else if (currentState === 'playing' && !isInputFocused) {
            // Ignore held-down keys (OS key repeat) - only respond to initial press
            if (e.repeat) return;

            // Get key bindings from settings, providing defaults
            const visualKey = keyBindings.visual || 'ArrowLeft';
            const audioKey = keyBindings.audio || 'ArrowRight';
            const colorKey = keyBindings.color || 'ArrowDown';
            const shapeKey = keyBindings.shape || 'ArrowUp';
            // Get the current trial index *at the time of the key press* using the ref
            const currentTrialForResponse = currentTrialRef.current;

            // Recall Mode: digits 1-8 pick the corresponding pool color.
            // Checked first so a custom digit keybinding can't shadow it.
            if (isRecall && /^[1-8]$/.test(e.key)) {
                e.preventDefault();
                if (typeof onRecallSelect === 'function') {
                    onRecallSelect(currentTrialForResponse, COLOR_STIMULI[parseInt(e.key, 10) - 1]);
                } else {
                    console.warn("[handleKeyDown] onRecallSelect handler not available for recall key press.");
                }
            }
            // Check if the pressed key matches the visual binding
            // (all modes except singleAudio/singleColor/singleShape)
            else if (e.key === visualKey && (!isSingle || gameMode === 'singleVisual')) {
                e.preventDefault(); // Prevent key repeat and browser scroll on macOS
                if (typeof onPositionMatch === 'function') {
                    onPositionMatch(currentTrialForResponse);
                } else {
                    console.error("[handleKeyDown] onPositionMatch handler prop is missing or not a function!");
                }
            }
            // Check if the pressed key matches the audio binding
            // (all modes except singleVisual/singleColor/singleShape)
            else if (e.key === audioKey && (!isSingle || gameMode === 'singleAudio')) {
                e.preventDefault(); // Prevent key repeat and browser scroll on macOS
                if (typeof onAudioMatch === 'function') {
                    onAudioMatch(currentTrialForResponse);
                } else {
                    console.error("[handleKeyDown] onAudioMatch handler prop is missing or not a function!");
                }
            }
            // Check if the pressed key matches the color binding (Triple/Quad/singleColor)
            else if ((isTriple || isQuad || isSingleColor) && e.key === colorKey) {
                e.preventDefault(); // Prevent key repeat and browser scroll on macOS
                if (typeof onColorMatch === 'function') {
                    onColorMatch(currentTrialForResponse);
                } else {
                    console.warn("[handleKeyDown] onColorMatch handler not available for color key press.");
                }
            }
            // Check if the pressed key matches the shape binding (Quad/singleShape)
            else if ((isQuad || isSingleShape) && e.key === shapeKey) {
                e.preventDefault(); // Prevent key repeat and browser scroll on macOS
                if (typeof onShapeMatch === 'function') {
                    onShapeMatch(currentTrialForResponse);
                } else {
                    console.warn("[handleKeyDown] onShapeMatch handler not available for shape key press.");
                }
            }
        }
    // Dependencies: Update handler if these functions, refs, or values change identity
    }, [
        latestGameStateRef, handlePauseResume, debugInfo, keyBindings,
        onPositionMatch, onAudioMatch, onColorMatch, onShapeMatch, onRecallSelect,
        currentTrialRef, isTriple, isQuad, isSingle, gameMode,
        isSingleColor, isSingleShape, isRecall
    ]);

    // --- Effect: Attach/Detach Keyboard Listener ---
    // Manages adding and removing the global keydown listener based on game state.
    useEffect(() => {
        // Only listen for keys when the game is actively playing or paused
        if (gameState === 'playing' || gameState === 'paused') {
            // console.log(`[useGameControls Attach] Attaching keydown listener (State: ${gameState})`);
            window.addEventListener('keydown', handleKeyDown);
            // Cleanup function removes listener when effect dependencies change or component unmounts
            return () => {
                // console.log(`[useGameControls Detach] Detaching keydown listener`);
                window.removeEventListener('keydown', handleKeyDown);
            };
        }
        // If state is not playing/paused, ensure no listener is attached (return undefined)
        return undefined;
    // Dependencies: Re-attach/detach listener if game state or the handler function changes
    }, [gameState, handleKeyDown]);


    // --- Return Values ---
    // Return the memoized handlers needed by the parent component (GameScreen) or its children.
    // `handleInteractionStart` is usually handled directly in GameScreen.
    return {
        handlePauseResume   // Expose Pause/Resume handler for UI buttons (e.g., in GameHeader)
        // handleKeyDown is managed internally by the effect, no need to return usually
    };
};

export default useGameControls; // Ensure it's the default export
/* File: src/components/game/hooks/useGameResponses.js */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useGame } from '../../../contexts/GameContext';

// Constants for feedback timing
const ACKNOWLEDGMENT_DURATION = 150; // ms - Short duration for acknowledgment flash
const CORRECTNESS_FEEDBACK_DURATION = 300; // ms
const MISSED_MATCH_DELAY = 50; // ms, short delay before showing missed feedback
const RESPONSE_DEBOUNCE_MS = 200; // ms - Minimum time between responses to prevent iOS phantom clicks

/**
 * Custom hook to manage user responses during gameplay.
 * - Tracks visual and audio responses per trial.
 * - Provides feedback state ('correct', 'incorrect', 'missed', 'acknowledged').
 * - Checks for missed matches automatically when trials advance (only if instant feedback is enabled).
 * - Uses GameContext for logging, feedback settings, match checking, and state.
 */
const useGameResponses = () => {
    // --- Get ALL needed context values via useGame ---
    const {
        // Actions
        registerResponse,       // Function to record raw response in context
        logReplayEvent,         // Function to log events for replay
        playFeedbackSound,      // Function to play feedback sounds
        registerColorResponse,  // Function to record color response in context
        registerShapeResponse,  // Function to record shape response in context
        registerColorRecallSelection, // Recall Mode: lock this trial's color answer (returns false if already answered)

        // Getters
        isMatch,                // Function to check if a trial is a match
        isColorMatch,           // Function to check if a trial is a color match
        isShapeMatch,           // Function to check if a trial is a shape match
        isRecallSelectionCorrect, // Recall Mode: does the picked color equal the color n trials back?
        getInstantFeedbackEnabled, // Function to check settings

        // State
        sequence,               // Current game sequence array
        currentTrial,           // Current trial index (0-based)
        nBack,                  // Current n-back level (first scorable recall trial === nBack)
        gameMode: activeGameMode, // Current game mode ('dual', 'triple', 'quad') - renamed for local use

        // Refs
        latestGameStateRef,     // Ref holding the most current game state
        stimulusOnsetTimeRef,   // Ref holding stimulus onset times for RT calculation
        sessionSettingsRef,     // Ref holding this session's settings (resolved gameMode lives here)
        colorRecallSelectionsRef // Recall Mode: trialIndex -> selected color (authoritative "answered?" source)
    } = useGame();

    // Recall Mode is played as a singleColor session with a different response mode, so
    // activeGameMode stays 'singleColor' — the resolved mode lives on the session ref
    // (same resolution GameScreen does at its `gameMode` line).
    const isRecallMode = useCallback(
        () => (sessionSettingsRef?.current?.gameMode || activeGameMode) === 'singleColorRecall',
        [sessionSettingsRef, activeGameMode]
    );

    // --- Local State for Feedback UI ---
    const [positionFeedback, setPositionFeedback] = useState(null); // 'correct', 'incorrect', 'missed', 'acknowledged', null
    const [audioFeedback, setAudioFeedback] = useState(null);       // 'correct', 'incorrect', 'missed', 'acknowledged', null
    const [colorFeedback, setColorFeedback] = useState(null);       // 'correct', 'incorrect', 'missed', 'acknowledged', null
    const [shapeFeedback, setShapeFeedback] = useState(null);       // 'correct', 'incorrect', 'missed', 'acknowledged', null
    const [recallFeedback, setRecallFeedback] = useState(null);     // Recall Mode pad: 'correct', 'incorrect', 'missed', 'acknowledged', null
    const [recallSelectedColor, setRecallSelectedColor] = useState(null); // Recall Mode: color locked for the current trial
    const [missedMatchTrial, setMissedMatchTrial] = useState(null); // Stores the index of the missed trial

    // State to track which trials user has already responded to
    const [visualResponseTrials, setVisualResponseTrials] = useState([]);
    const [audioResponseTrials, setAudioResponseTrials] = useState([]);
    const [colorResponseTrials, setColorResponseTrials] = useState([]);
    const [shapeResponseTrials, setShapeResponseTrials] = useState([]);

    // Refs for latest response data (to avoid stale closures when called from GameContext)
    // These mirror the state arrays but are refs so they can be read synchronously
    const visualResponseTrialsRef = useRef([]);
    const audioResponseTrialsRef = useRef([]);
    const colorResponseTrialsRef = useRef([]);
    const shapeResponseTrialsRef = useRef([]);

    // --- Refs ---
    // Refs to prevent repeated 'missed' feedback flashes for the *same* trial index
    const lastMissedVisualTrialRef = useRef(null);
    const lastMissedAudioTrialRef = useRef(null);
    const lastMissedColorTrialRef = useRef(null);
    const lastMissedShapeTrialRef = useRef(null);
    // Recall Mode: guards against re-flagging the same unanswered (blank) trial
    const lastRecallBlankTrialRef = useRef(null);

    // Refs for debouncing responses - prevents ghost clicks on iOS Chrome/Brave
    const lastPositionResponseTimeRef = useRef(0);
    const lastAudioResponseTimeRef = useRef(0);
    const lastColorResponseTimeRef = useRef(0);
    const lastShapeResponseTimeRef = useRef(0);

    // Refs for the INNER timeouts (clearing feedback display after it shows)
    const innerFeedbackTimeouts = useRef({ visual: null, audio: null, color: null, shape: null });
    // Refs for the OUTER timeouts (delaying the initiation of missed feedback)
    const outerMissedCheckTimeouts = useRef({ visual: null, audio: null, color: null, shape: null });

    // --- Helper: Force Clear ALL Pending Timeouts ---
    // Used ONLY for major resets (new game)
    const cancelAllPendingFeedbackTimeouts = useCallback(() => {
        if (innerFeedbackTimeouts.current.visual) clearTimeout(innerFeedbackTimeouts.current.visual);
        if (innerFeedbackTimeouts.current.audio) clearTimeout(innerFeedbackTimeouts.current.audio);
        if (innerFeedbackTimeouts.current.color) clearTimeout(innerFeedbackTimeouts.current.color);
        if (innerFeedbackTimeouts.current.shape) clearTimeout(innerFeedbackTimeouts.current.shape);
        if (outerMissedCheckTimeouts.current.visual) clearTimeout(outerMissedCheckTimeouts.current.visual);
        if (outerMissedCheckTimeouts.current.audio) clearTimeout(outerMissedCheckTimeouts.current.audio);
        if (outerMissedCheckTimeouts.current.color) clearTimeout(outerMissedCheckTimeouts.current.color);
        if (outerMissedCheckTimeouts.current.shape) clearTimeout(outerMissedCheckTimeouts.current.shape);
        innerFeedbackTimeouts.current = { visual: null, audio: null, color: null, shape: null }; // Reset refs
        outerMissedCheckTimeouts.current = { visual: null, audio: null, color: null, shape: null }; // Reset refs
    }, []); // No dependencies, relies only on refs

    // --- Helper: Cancel ONLY OUTER Pending Timeouts ---
    // Used by effect cleanup to prevent stale miss checks, but allow inner clears to finish
    const cancelOuterPendingTimeouts = useCallback(() => {
        if (outerMissedCheckTimeouts.current.visual) {
            clearTimeout(outerMissedCheckTimeouts.current.visual);
            outerMissedCheckTimeouts.current.visual = null;
        }
        if (outerMissedCheckTimeouts.current.audio) {
            clearTimeout(outerMissedCheckTimeouts.current.audio);
            outerMissedCheckTimeouts.current.audio = null;
        }
        if (outerMissedCheckTimeouts.current.color) {
            clearTimeout(outerMissedCheckTimeouts.current.color);
            outerMissedCheckTimeouts.current.color = null;
        }
        if (outerMissedCheckTimeouts.current.shape) {
            clearTimeout(outerMissedCheckTimeouts.current.shape);
            outerMissedCheckTimeouts.current.shape = null;
        }
    }, []); // No dependencies

    // --- Handler: Position (Visual) Response ---
    const handlePositionResponse = useCallback((trialIndex) => {
        // Debounce: Prevent phantom clicks on iOS Chrome/Brave
        const now = Date.now();
        const timeSinceLast = now - lastPositionResponseTimeRef.current;
        if (timeSinceLast < RESPONSE_DEBOUNCE_MS) {
            console.warn(`[useGameResponses] Position response debounced (too fast) - attempted trial ${trialIndex}, ${timeSinceLast}ms since last`);
            return;
        }
        lastPositionResponseTimeRef.current = now;

        // Check game state and if already responded
        if (latestGameStateRef.current !== 'playing' || visualResponseTrials.includes(trialIndex)) {
            return;
        }
        // Check for required functions from context
        if (typeof registerResponse !== 'function' || typeof logReplayEvent !== 'function' || typeof isMatch !== 'function' || typeof getInstantFeedbackEnabled !== 'function' || typeof playFeedbackSound !== 'function') {
             console.error("Missing context functions in useGameResponses for handlePositionResponse!"); return;
        }

        // Calculate response latency (time from stimulus onset to response)
        const responseTime = Date.now();
        const onsetTime = stimulusOnsetTimeRef?.current?.[trialIndex];
        const responseLatency = onsetTime ? responseTime - onsetTime : null;

        logReplayEvent({ type: 'responsePosition', trialIndex, responseLatency });
        setVisualResponseTrials(prev => {
            const updated = [...prev, trialIndex];
            visualResponseTrialsRef.current = updated; // Keep ref in sync for last-trial check
            return updated;
        });
        registerResponse('visual', trialIndex); // Register in context
        const feedbackSettings = getInstantFeedbackEnabled(); // Returns { positive, errors, misses }

        // *** Clear specific pending VISUAL timeouts (inner & outer) before setting new feedback ***
        if (innerFeedbackTimeouts.current.visual) {
            clearTimeout(innerFeedbackTimeouts.current.visual);
            innerFeedbackTimeouts.current.visual = null;
        }
        if (outerMissedCheckTimeouts.current.visual) {
            clearTimeout(outerMissedCheckTimeouts.current.visual);
            outerMissedCheckTimeouts.current.visual = null;
        }
        setMissedMatchTrial(null); // Still clear missed highlight

        // Determine correctness first
        const isCorrect = isMatch('visual', trialIndex);

        // Provide feedback based on correctness and user's feedback preferences
        if (isCorrect && feedbackSettings.positive) {
            // Show positive feedback (green)
            setPositionFeedback('correct');
            playFeedbackSound('correct');
            logReplayEvent({ type: 'feedbackVisual', trialIndex, feedbackType: 'correct' });
            innerFeedbackTimeouts.current.visual = setTimeout(() => {
                setPositionFeedback(null);
                innerFeedbackTimeouts.current.visual = null;
            }, CORRECTNESS_FEEDBACK_DURATION);
        } else if (!isCorrect && feedbackSettings.errors) {
            // Show negative feedback (red)
            setPositionFeedback('incorrect');
            playFeedbackSound('incorrect');
            logReplayEvent({ type: 'feedbackVisual', trialIndex, feedbackType: 'incorrect' });
            innerFeedbackTimeouts.current.visual = setTimeout(() => {
                setPositionFeedback(null);
                innerFeedbackTimeouts.current.visual = null;
            }, CORRECTNESS_FEEDBACK_DURATION);
        } else {
            // Feedback disabled for this result type - show acknowledgment
            setPositionFeedback('acknowledged');
            logReplayEvent({ type: 'feedbackVisual', trialIndex, feedbackType: 'acknowledged', disabled: true });
            innerFeedbackTimeouts.current.visual = setTimeout(() => {
                setPositionFeedback(null);
                innerFeedbackTimeouts.current.visual = null;
            }, ACKNOWLEDGMENT_DURATION);
        }
    }, [visualResponseTrials, registerResponse, isMatch, logReplayEvent, getInstantFeedbackEnabled, playFeedbackSound, latestGameStateRef]); // Keep latestGameStateRef dep

    // --- Handler: Audio Response ---
    const handleAudioResponse = useCallback((trialIndex) => {
        // Debounce: Prevent phantom clicks on iOS Chrome/Brave
        const now = Date.now();
        const timeSinceLast = now - lastAudioResponseTimeRef.current;
        if (timeSinceLast < RESPONSE_DEBOUNCE_MS) {
            console.warn(`[useGameResponses] Audio response debounced (too fast) - attempted trial ${trialIndex}, ${timeSinceLast}ms since last`);
            return;
        }
        lastAudioResponseTimeRef.current = now;

        // Check game state and if already responded
        if (latestGameStateRef.current !== 'playing' || audioResponseTrials.includes(trialIndex)) {
            return;
        }
        // Check for required functions from context
        if (typeof registerResponse !== 'function' || typeof logReplayEvent !== 'function' || typeof isMatch !== 'function' || typeof getInstantFeedbackEnabled !== 'function' || typeof playFeedbackSound !== 'function') {
             console.error("Missing context functions in useGameResponses for handleAudioResponse!"); return;
        }

        // Calculate response latency (time from stimulus onset to response)
        const responseTime = Date.now();
        const onsetTime = stimulusOnsetTimeRef?.current?.[trialIndex];
        const responseLatency = onsetTime ? responseTime - onsetTime : null;

        logReplayEvent({ type: 'responseAudio', trialIndex, responseLatency });
        setAudioResponseTrials(prev => {
            const updated = [...prev, trialIndex];
            audioResponseTrialsRef.current = updated; // Keep ref in sync for last-trial check
            return updated;
        });
        registerResponse('audio', trialIndex); // Register in context
        const feedbackSettings = getInstantFeedbackEnabled(); // Returns { positive, errors, misses }

        // *** Clear specific pending AUDIO timeouts (inner & outer) before setting new feedback ***
        if (innerFeedbackTimeouts.current.audio) {
            clearTimeout(innerFeedbackTimeouts.current.audio);
            innerFeedbackTimeouts.current.audio = null;
        }
        if (outerMissedCheckTimeouts.current.audio) {
            clearTimeout(outerMissedCheckTimeouts.current.audio);
            outerMissedCheckTimeouts.current.audio = null;
        }

        // Determine correctness first
        const isCorrect = isMatch('audio', trialIndex);

        // Provide feedback based on correctness and user's feedback preferences
        if (isCorrect && feedbackSettings.positive) {
            // Show positive feedback (green)
            setAudioFeedback('correct');
            playFeedbackSound('correct');
            logReplayEvent({ type: 'feedbackAudio', trialIndex, feedbackType: 'correct' });
            innerFeedbackTimeouts.current.audio = setTimeout(() => {
                setAudioFeedback(null);
                innerFeedbackTimeouts.current.audio = null;
            }, CORRECTNESS_FEEDBACK_DURATION);
        } else if (!isCorrect && feedbackSettings.errors) {
            // Show negative feedback (red)
            setAudioFeedback('incorrect');
            playFeedbackSound('incorrect');
            logReplayEvent({ type: 'feedbackAudio', trialIndex, feedbackType: 'incorrect' });
            innerFeedbackTimeouts.current.audio = setTimeout(() => {
                setAudioFeedback(null);
                innerFeedbackTimeouts.current.audio = null;
            }, CORRECTNESS_FEEDBACK_DURATION);
        } else {
            // Feedback disabled for this result type - show acknowledgment
            setAudioFeedback('acknowledged');
            logReplayEvent({ type: 'feedbackAudio', trialIndex, feedbackType: 'acknowledged', disabled: true });
            innerFeedbackTimeouts.current.audio = setTimeout(() => {
                setAudioFeedback(null);
                innerFeedbackTimeouts.current.audio = null;
            }, ACKNOWLEDGMENT_DURATION);
        }
    }, [audioResponseTrials, registerResponse, isMatch, logReplayEvent, getInstantFeedbackEnabled, playFeedbackSound, latestGameStateRef]); // Keep latestGameStateRef dep

    // --- Handler: Color Response (Triple/Quad modes) ---
    const handleColorResponse = useCallback((trialIndex) => {
        // Debounce: Prevent phantom clicks on iOS Chrome/Brave
        const now = Date.now();
        const timeSinceLast = now - lastColorResponseTimeRef.current;
        if (timeSinceLast < RESPONSE_DEBOUNCE_MS) {
            console.warn(`[useGameResponses] Color response debounced (too fast) - attempted trial ${trialIndex}, ${timeSinceLast}ms since last`);
            return;
        }
        lastColorResponseTimeRef.current = now;

        // Check game state and if already responded
        if (latestGameStateRef.current !== 'playing' || colorResponseTrials.includes(trialIndex)) {
            return;
        }
        // Check for required functions from context
        if (typeof registerColorResponse !== 'function' || typeof logReplayEvent !== 'function' || typeof isColorMatch !== 'function' || typeof getInstantFeedbackEnabled !== 'function' || typeof playFeedbackSound !== 'function') {
             console.error("Missing context functions in useGameResponses for handleColorResponse!"); return;
        }

        // Calculate response latency (time from stimulus onset to response)
        const responseTime = Date.now();
        const onsetTime = stimulusOnsetTimeRef?.current?.[trialIndex];
        const responseLatency = onsetTime ? responseTime - onsetTime : null;

        logReplayEvent({ type: 'responseColor', trialIndex, responseLatency });
        setColorResponseTrials(prev => {
            const updated = [...prev, trialIndex];
            colorResponseTrialsRef.current = updated; // Keep ref in sync for last-trial check
            return updated;
        });
        registerColorResponse(trialIndex); // Register in context
        const feedbackSettings = getInstantFeedbackEnabled(); // Returns { positive, errors, misses }

        // Clear specific pending COLOR timeouts (inner & outer) before setting new feedback
        if (innerFeedbackTimeouts.current.color) {
            clearTimeout(innerFeedbackTimeouts.current.color);
            innerFeedbackTimeouts.current.color = null;
        }
        if (outerMissedCheckTimeouts.current.color) {
            clearTimeout(outerMissedCheckTimeouts.current.color);
            outerMissedCheckTimeouts.current.color = null;
        }

        // Determine correctness first
        const isCorrect = isColorMatch(trialIndex);

        // Provide feedback based on correctness and user's feedback preferences
        if (isCorrect && feedbackSettings.positive) {
            // Show positive feedback (green)
            setColorFeedback('correct');
            playFeedbackSound('correct');
            logReplayEvent({ type: 'feedbackColor', trialIndex, feedbackType: 'correct' });
            innerFeedbackTimeouts.current.color = setTimeout(() => {
                setColorFeedback(null);
                innerFeedbackTimeouts.current.color = null;
            }, CORRECTNESS_FEEDBACK_DURATION);
        } else if (!isCorrect && feedbackSettings.errors) {
            // Show negative feedback (red)
            setColorFeedback('incorrect');
            playFeedbackSound('incorrect');
            logReplayEvent({ type: 'feedbackColor', trialIndex, feedbackType: 'incorrect' });
            innerFeedbackTimeouts.current.color = setTimeout(() => {
                setColorFeedback(null);
                innerFeedbackTimeouts.current.color = null;
            }, CORRECTNESS_FEEDBACK_DURATION);
        } else {
            // Feedback disabled for this result type - show acknowledgment
            setColorFeedback('acknowledged');
            logReplayEvent({ type: 'feedbackColor', trialIndex, feedbackType: 'acknowledged', disabled: true });
            innerFeedbackTimeouts.current.color = setTimeout(() => {
                setColorFeedback(null);
                innerFeedbackTimeouts.current.color = null;
            }, ACKNOWLEDGMENT_DURATION);
        }
    }, [colorResponseTrials, registerColorResponse, isColorMatch, logReplayEvent, getInstantFeedbackEnabled, playFeedbackSound, latestGameStateRef]);

    // --- Handler: Color Recall Selection (Recall Mode / singleColorRecall) ---
    // Forced choice, not a match press: the player names WHICH color appeared n trials
    // back. Modeled on handleColorResponse, with two differences — the once-per-trial
    // guard is the context ref (a fast second tap must not slip past lagging state), and
    // the answer itself is carried in the replay event.
    const handleColorRecallSelect = useCallback((trialIndex, color) => {
        // Debounce: Prevent phantom clicks on iOS Chrome/Brave (shares the color timestamp —
        // the two response paths are mutually exclusive per session)
        const now = Date.now();
        const timeSinceLast = now - lastColorResponseTimeRef.current;
        if (timeSinceLast < RESPONSE_DEBOUNCE_MS) {
            // debug, not warn: recall players tap every single trial, so ordinary mis-taps
            // (double-tap, fat-finger) would flood the console at warn level.
            console.debug(`[useGameResponses] Recall selection debounced (too fast) - attempted trial ${trialIndex}, ${timeSinceLast}ms since last`);
            return;
        }

        if (latestGameStateRef.current !== 'playing') {
            return;
        }
        if (typeof registerColorRecallSelection !== 'function' || typeof isRecallSelectionCorrect !== 'function' ||
            typeof logReplayEvent !== 'function' || typeof getInstantFeedbackEnabled !== 'function' || typeof playFeedbackSound !== 'function') {
            console.error("Missing context functions in useGameResponses for handleColorRecallSelect!"); return;
        }
        if (typeof trialIndex !== 'number' || trialIndex < 0 || typeof color !== 'string') {
            return;
        }
        // Watch phase (trials 0..n-1) has nothing to recall yet — ignore presses there.
        // The pad is disabled during it; this also covers the 1-8 hotkeys.
        if (typeof nBack === 'number' && trialIndex < nBack) {
            return;
        }

        // Once-per-trial gate: only the tap that actually locked the answer proceeds.
        if (!registerColorRecallSelection(trialIndex, color)) {
            return;
        }
        // Arm the debounce window ONLY on an ACCEPTED selection. Arming before the
        // guards let a REJECTED tap (a "correction" second tap, a watch-phase press)
        // start the 200ms window and silently swallow the NEXT trial's genuine answer —
        // which then scored as a blank with a red miss flash. A ghost/phantom duplicate
        // of an accepted tap is still blocked: its parent armed the window.
        lastColorResponseTimeRef.current = now;

        // Calculate response latency (time from stimulus onset to response)
        const responseTime = Date.now();
        const onsetTime = stimulusOnsetTimeRef?.current?.[trialIndex];
        const responseLatency = onsetTime ? responseTime - onsetTime : null;

        logReplayEvent({ type: 'responseColorRecall', trialIndex, selectedColor: color, responseLatency });
        setRecallSelectedColor(color);
        const feedbackSettings = getInstantFeedbackEnabled(); // Returns { positive, errors, misses }

        // Clear specific pending COLOR-slot timeouts (inner & outer) before setting new feedback.
        // Recall reuses the color slot: a session is either Recall or color-match, never both.
        if (innerFeedbackTimeouts.current.color) {
            clearTimeout(innerFeedbackTimeouts.current.color);
            innerFeedbackTimeouts.current.color = null;
        }
        if (outerMissedCheckTimeouts.current.color) {
            clearTimeout(outerMissedCheckTimeouts.current.color);
            outerMissedCheckTimeouts.current.color = null;
        }

        const isCorrect = isRecallSelectionCorrect(trialIndex, color);

        if (isCorrect && feedbackSettings.positive) {
            setRecallFeedback('correct');
            playFeedbackSound('correct');
            logReplayEvent({ type: 'feedbackColorRecall', trialIndex, feedbackType: 'correct' });
            innerFeedbackTimeouts.current.color = setTimeout(() => {
                setRecallFeedback(null);
                innerFeedbackTimeouts.current.color = null;
            }, CORRECTNESS_FEEDBACK_DURATION);
        } else if (!isCorrect && feedbackSettings.errors) {
            setRecallFeedback('incorrect');
            playFeedbackSound('incorrect');
            logReplayEvent({ type: 'feedbackColorRecall', trialIndex, feedbackType: 'incorrect' });
            innerFeedbackTimeouts.current.color = setTimeout(() => {
                setRecallFeedback(null);
                innerFeedbackTimeouts.current.color = null;
            }, CORRECTNESS_FEEDBACK_DURATION);
        } else {
            // Feedback disabled for this result type - show acknowledgment
            setRecallFeedback('acknowledged');
            logReplayEvent({ type: 'feedbackColorRecall', trialIndex, feedbackType: 'acknowledged', disabled: true });
            innerFeedbackTimeouts.current.color = setTimeout(() => {
                setRecallFeedback(null);
                innerFeedbackTimeouts.current.color = null;
            }, ACKNOWLEDGMENT_DURATION);
        }
    }, [nBack, registerColorRecallSelection, isRecallSelectionCorrect, logReplayEvent, getInstantFeedbackEnabled, playFeedbackSound, latestGameStateRef, stimulusOnsetTimeRef]);

    // --- Effect: Clear the locked recall answer when the trial advances ---
    // Functional update so non-recall modes never re-render on this (React bails out
    // when the returned state is identical).
    useEffect(() => {
        setRecallSelectedColor(prev => (prev === null ? prev : null));
    }, [currentTrial]);

    // --- Handler: Shape Response (Quad mode only) ---
    const handleShapeResponse = useCallback((trialIndex) => {
        // Debounce: Prevent phantom clicks on iOS Chrome/Brave
        const now = Date.now();
        const timeSinceLast = now - lastShapeResponseTimeRef.current;
        if (timeSinceLast < RESPONSE_DEBOUNCE_MS) {
            console.warn(`[useGameResponses] Shape response debounced (too fast) - attempted trial ${trialIndex}, ${timeSinceLast}ms since last`);
            return;
        }
        lastShapeResponseTimeRef.current = now;

        // Check game state and if already responded
        if (latestGameStateRef.current !== 'playing' || shapeResponseTrials.includes(trialIndex)) {
            return;
        }
        // Check for required functions from context
        if (typeof registerShapeResponse !== 'function' || typeof logReplayEvent !== 'function' || typeof isShapeMatch !== 'function' || typeof getInstantFeedbackEnabled !== 'function' || typeof playFeedbackSound !== 'function') {
             console.error("Missing context functions in useGameResponses for handleShapeResponse!"); return;
        }

        // Calculate response latency (time from stimulus onset to response)
        const responseTime = Date.now();
        const onsetTime = stimulusOnsetTimeRef?.current?.[trialIndex];
        const responseLatency = onsetTime ? responseTime - onsetTime : null;

        logReplayEvent({ type: 'responseShape', trialIndex, responseLatency });
        setShapeResponseTrials(prev => {
            const updated = [...prev, trialIndex];
            shapeResponseTrialsRef.current = updated; // Keep ref in sync for last-trial check
            return updated;
        });
        registerShapeResponse(trialIndex); // Register in context
        const feedbackSettings = getInstantFeedbackEnabled(); // Returns { positive, errors, misses }

        // Clear specific pending SHAPE timeouts (inner & outer) before setting new feedback
        if (innerFeedbackTimeouts.current.shape) {
            clearTimeout(innerFeedbackTimeouts.current.shape);
            innerFeedbackTimeouts.current.shape = null;
        }
        if (outerMissedCheckTimeouts.current.shape) {
            clearTimeout(outerMissedCheckTimeouts.current.shape);
            outerMissedCheckTimeouts.current.shape = null;
        }

        // Determine correctness first
        const isCorrect = isShapeMatch(trialIndex);

        // Provide feedback based on correctness and user's feedback preferences
        if (isCorrect && feedbackSettings.positive) {
            // Show positive feedback (green)
            setShapeFeedback('correct');
            playFeedbackSound('correct');
            logReplayEvent({ type: 'feedbackShape', trialIndex, feedbackType: 'correct' });
            innerFeedbackTimeouts.current.shape = setTimeout(() => {
                setShapeFeedback(null);
                innerFeedbackTimeouts.current.shape = null;
            }, CORRECTNESS_FEEDBACK_DURATION);
        } else if (!isCorrect && feedbackSettings.errors) {
            // Show negative feedback (red)
            setShapeFeedback('incorrect');
            playFeedbackSound('incorrect');
            logReplayEvent({ type: 'feedbackShape', trialIndex, feedbackType: 'incorrect' });
            innerFeedbackTimeouts.current.shape = setTimeout(() => {
                setShapeFeedback(null);
                innerFeedbackTimeouts.current.shape = null;
            }, CORRECTNESS_FEEDBACK_DURATION);
        } else {
            // Feedback disabled for this result type - show acknowledgment
            setShapeFeedback('acknowledged');
            logReplayEvent({ type: 'feedbackShape', trialIndex, feedbackType: 'acknowledged', disabled: true });
            innerFeedbackTimeouts.current.shape = setTimeout(() => {
                setShapeFeedback(null);
                innerFeedbackTimeouts.current.shape = null;
            }, ACKNOWLEDGMENT_DURATION);
        }
    }, [shapeResponseTrials, registerShapeResponse, isShapeMatch, logReplayEvent, getInstantFeedbackEnabled, playFeedbackSound, latestGameStateRef]);

    // --- Effect to Check for Missed Matches (Only runs if `misses` feedback is enabled) ---
    useEffect(() => {
        // Check for required functions first
        if (typeof isMatch !== 'function' || typeof getInstantFeedbackEnabled !== 'function' || typeof logReplayEvent !== 'function' || typeof playFeedbackSound !== 'function') {
            return;
        }

        const feedbackSettings = getInstantFeedbackEnabled(); // Returns { positive, errors, misses }
        if (!feedbackSettings.misses || latestGameStateRef.current !== 'playing') {
            return; // Skip if miss feedback is off or not playing
        }

        const prevTrial = currentTrial - 1; // Check the trial that just finished
        // Check if previous trial index is valid
        if (prevTrial < 0 || !Array.isArray(sequence) || prevTrial >= sequence.length) {
            return;
        }

        // --- Check Missed Visual Match ---
        const visualWasMatch = isMatch('visual', prevTrial);
        if (visualWasMatch && !visualResponseTrials.includes(prevTrial)) {
            // Only trigger miss feedback if we haven't already flagged this trial as missed
            if (lastMissedVisualTrialRef.current !== prevTrial) {
                lastMissedVisualTrialRef.current = prevTrial; // Mark as missed for this check cycle
                logReplayEvent({ type: 'feedbackVisual', trialIndex: prevTrial, feedbackType: 'missed' });

                // Clear specific pending VISUAL timeouts (inner & outer) before scheduling new outer
                if (outerMissedCheckTimeouts.current.visual) clearTimeout(outerMissedCheckTimeouts.current.visual);
                if (innerFeedbackTimeouts.current.visual) clearTimeout(innerFeedbackTimeouts.current.visual);
                setPositionFeedback(null); // Ensure visual feedback is null before scheduling
                setMissedMatchTrial(null);

                // Schedule the delayed check for showing miss feedback
                outerMissedCheckTimeouts.current.visual = setTimeout(() => {
                    outerMissedCheckTimeouts.current.visual = null; // Clear self immediately
                    // Check game state AGAIN inside the timeout using the ref
                    if (latestGameStateRef.current === 'playing') {
                        setPositionFeedback('incorrect'); // Show 'incorrect' style feedback for miss
                        setMissedMatchTrial(prevTrial);   // Highlight the grid square
                        playFeedbackSound('incorrect'); // Play sound for miss
                        // Schedule the clearing of *this* specific miss feedback display
                        innerFeedbackTimeouts.current.visual = setTimeout(() => {
                            // Check state again before clearing visual feedback
                            if (latestGameStateRef.current === 'playing') {
                                setPositionFeedback(null);
                                setMissedMatchTrial(null); // Clear grid highlight
                            }
                            innerFeedbackTimeouts.current.visual = null; // Clear the timeout ref regardless
                        }, CORRECTNESS_FEEDBACK_DURATION);
                    }
                }, MISSED_MATCH_DELAY);
            }
        } else {
            // Reset the guard if the previous trial was NOT a missed visual match
            if (lastMissedVisualTrialRef.current === prevTrial) {
                lastMissedVisualTrialRef.current = null;
            }
        }

        // --- Check Missed Audio Match ---
        const audioWasMatch = isMatch('audio', prevTrial);
        if (audioWasMatch && !audioResponseTrials.includes(prevTrial)) {
             // Only trigger miss feedback if we haven't already flagged this trial as missed
            if (lastMissedAudioTrialRef.current !== prevTrial) {
                lastMissedAudioTrialRef.current = prevTrial; // Mark as missed for this check cycle
                logReplayEvent({ type: 'feedbackAudio', trialIndex: prevTrial, feedbackType: 'missed' });

                // Clear specific pending AUDIO timeouts (inner & outer) before scheduling new outer
                if (outerMissedCheckTimeouts.current.audio) clearTimeout(outerMissedCheckTimeouts.current.audio);
                if (innerFeedbackTimeouts.current.audio) clearTimeout(innerFeedbackTimeouts.current.audio);
                setAudioFeedback(null); // Ensure audio feedback is null before scheduling

                // Schedule the delayed check for showing miss feedback
                outerMissedCheckTimeouts.current.audio = setTimeout(() => {
                    outerMissedCheckTimeouts.current.audio = null; // Clear self immediately
                    // Check game state AGAIN inside the timeout using the ref
                    if (latestGameStateRef.current === 'playing') {
                        setAudioFeedback('incorrect'); // Show 'incorrect' style feedback for miss
                        playFeedbackSound('incorrect'); // Play sound for miss
                        // Schedule the clearing of *this* specific miss feedback display
                        innerFeedbackTimeouts.current.audio = setTimeout(() => {
                            // Check state again before clearing audio feedback
                            if (latestGameStateRef.current === 'playing') {
                                setAudioFeedback(null);
                            }
                            innerFeedbackTimeouts.current.audio = null; // Clear the timeout ref regardless
                        }, CORRECTNESS_FEEDBACK_DURATION);
                    }
                }, MISSED_MATCH_DELAY);
            }
        } else {
            // Reset the guard if the previous trial was NOT a missed audio match
            if (lastMissedAudioTrialRef.current === prevTrial) {
                lastMissedAudioTrialRef.current = null;
            }
        }

        // --- Check Missed Color Match (Triple/Quad modes, including Dynamic) ---
        // Recall Mode sequences also carry colors, but there is no color *match* to miss
        // there — an unanswered trial is a blank, handled by the recall blank detector
        // below. Without this guard a chance n-back color repeat would flash and sound.
        const hasColorInSequence = sequence?.length > 0 && sequence[0]?.color != null;
        if (hasColorInSequence && !isRecallMode() && typeof isColorMatch === 'function') {
            const colorWasMatch = isColorMatch(prevTrial);
            if (colorWasMatch && !colorResponseTrials.includes(prevTrial)) {
                if (lastMissedColorTrialRef.current !== prevTrial) {
                    lastMissedColorTrialRef.current = prevTrial;
                    logReplayEvent({ type: 'feedbackColor', trialIndex: prevTrial, feedbackType: 'missed' });

                    if (outerMissedCheckTimeouts.current.color) clearTimeout(outerMissedCheckTimeouts.current.color);
                    if (innerFeedbackTimeouts.current.color) clearTimeout(innerFeedbackTimeouts.current.color);
                    setColorFeedback(null);

                    outerMissedCheckTimeouts.current.color = setTimeout(() => {
                        outerMissedCheckTimeouts.current.color = null;
                        if (latestGameStateRef.current === 'playing') {
                            setColorFeedback('incorrect');
                            playFeedbackSound('incorrect');
                            innerFeedbackTimeouts.current.color = setTimeout(() => {
                                if (latestGameStateRef.current === 'playing') {
                                    setColorFeedback(null);
                                }
                                innerFeedbackTimeouts.current.color = null;
                            }, CORRECTNESS_FEEDBACK_DURATION);
                        }
                    }, MISSED_MATCH_DELAY);
                }
            } else {
                if (lastMissedColorTrialRef.current === prevTrial) {
                    lastMissedColorTrialRef.current = null;
                }
            }
        }

        // --- Check Missed Shape Match (Quad mode, including Dynamic) ---
        const hasShapeInSequence = sequence?.length > 0 && sequence[0]?.shape != null;
        if (hasShapeInSequence && typeof isShapeMatch === 'function') {
            const shapeWasMatch = isShapeMatch(prevTrial);
            if (shapeWasMatch && !shapeResponseTrials.includes(prevTrial)) {
                if (lastMissedShapeTrialRef.current !== prevTrial) {
                    lastMissedShapeTrialRef.current = prevTrial;
                    logReplayEvent({ type: 'feedbackShape', trialIndex: prevTrial, feedbackType: 'missed' });

                    if (outerMissedCheckTimeouts.current.shape) clearTimeout(outerMissedCheckTimeouts.current.shape);
                    if (innerFeedbackTimeouts.current.shape) clearTimeout(innerFeedbackTimeouts.current.shape);
                    setShapeFeedback(null);

                    outerMissedCheckTimeouts.current.shape = setTimeout(() => {
                        outerMissedCheckTimeouts.current.shape = null;
                        if (latestGameStateRef.current === 'playing') {
                            setShapeFeedback('incorrect');
                            playFeedbackSound('incorrect');
                            innerFeedbackTimeouts.current.shape = setTimeout(() => {
                                if (latestGameStateRef.current === 'playing') {
                                    setShapeFeedback(null);
                                }
                                innerFeedbackTimeouts.current.shape = null;
                            }, CORRECTNESS_FEEDBACK_DURATION);
                        }
                    }, MISSED_MATCH_DELAY);
                }
            } else {
                if (lastMissedShapeTrialRef.current === prevTrial) {
                    lastMissedShapeTrialRef.current = null;
                }
            }
        }

        // --- Effect Cleanup ---
        // Cancel potentially pending *outer* checks when dependencies change before the next run.
        return () => {
            cancelOuterPendingTimeouts(); // Use the specific outer canceller
        };

    }, [
        // Dependencies that trigger the check
        currentTrial,
        sequence, // Need sequence to check content of prevTrial and detect color/shape modalities
        // Context functions/state needed inside
        isMatch,
        isColorMatch,
        isShapeMatch,
        visualResponseTrials, // Needed to check if response was made
        audioResponseTrials,  // Needed to check if response was made
        colorResponseTrials,  // Needed to check if response was made
        shapeResponseTrials,  // Needed to check if response was made
        logReplayEvent,
        getInstantFeedbackEnabled, // Critical dependency for the effect's conditional execution
        playFeedbackSound,
        latestGameStateRef, // Ref is stable, but used directly
        isRecallMode,       // Gates the color-miss branch off in Recall Mode
        // Include the specific outer canceller function as it's used in cleanup
        cancelOuterPendingTimeouts
    ]);

    // --- Effect: Recall Mode Blank Detection ---
    // Recall's failure mode is a trial the player never answered. Unlike the miss detector
    // above, the blank event is ALWAYS logged — whether or not miss feedback is enabled.
    // When it is disabled the event carries `disabled: true` and nothing is shown.
    //
    // Contract for consumers (replay stats, analytics): on `feedbackColorRecall` events,
    // `disabled: true` means "UI feedback was suppressed by the user's settings" — it does
    // NOT mean "skip when counting". A blank is a real scored outcome either way, so any
    // stats pass must count feedbackType 'missed' regardless of the flag. (The sibling
    // Match cases skip disabled events, which is why this needs saying.)
    // Answered-ness is read from the context ref, not state: a tap in the final
    // milliseconds of a trial writes the ref synchronously, so it can't be mis-flagged.
    useEffect(() => {
        if (typeof logReplayEvent !== 'function' || typeof getInstantFeedbackEnabled !== 'function' || typeof playFeedbackSound !== 'function') {
            return;
        }
        if (!isRecallMode() || latestGameStateRef.current !== 'playing') {
            return;
        }

        const prevTrial = currentTrial - 1; // The trial that just finished
        // Trials before nBack are the watch phase — not scorable, never blank.
        if (prevTrial < nBack || !Array.isArray(sequence) || prevTrial >= sequence.length) {
            return;
        }
        if (colorRecallSelectionsRef?.current?.[prevTrial] !== undefined) {
            return; // Answered
        }
        if (lastRecallBlankTrialRef.current === prevTrial) {
            return; // Already flagged this trial on an earlier run of this effect
        }
        lastRecallBlankTrialRef.current = prevTrial;

        const feedbackSettings = getInstantFeedbackEnabled(); // Returns { positive, errors, misses }
        logReplayEvent({
            type: 'feedbackColorRecall',
            trialIndex: prevTrial,
            feedbackType: 'missed',
            ...(!feedbackSettings.misses && { disabled: true })
        });
        if (!feedbackSettings.misses) {
            return; // Logged only — user has miss feedback turned off
        }

        // Clear pending COLOR-slot timeouts before scheduling the new outer check
        if (outerMissedCheckTimeouts.current.color) clearTimeout(outerMissedCheckTimeouts.current.color);
        if (innerFeedbackTimeouts.current.color) clearTimeout(innerFeedbackTimeouts.current.color);
        setRecallFeedback(null);

        outerMissedCheckTimeouts.current.color = setTimeout(() => {
            outerMissedCheckTimeouts.current.color = null;
            if (latestGameStateRef.current === 'playing') {
                setRecallFeedback('missed');
                playFeedbackSound('incorrect');
                innerFeedbackTimeouts.current.color = setTimeout(() => {
                    if (latestGameStateRef.current === 'playing') {
                        setRecallFeedback(null);
                    }
                    innerFeedbackTimeouts.current.color = null;
                }, CORRECTNESS_FEEDBACK_DURATION);
            }
        }, MISSED_MATCH_DELAY);

        return () => {
            if (outerMissedCheckTimeouts.current.color) {
                clearTimeout(outerMissedCheckTimeouts.current.color);
                outerMissedCheckTimeouts.current.color = null;
            }
        };
    }, [
        currentTrial, sequence, nBack, isRecallMode, colorRecallSelectionsRef,
        logReplayEvent, getInstantFeedbackEnabled, playFeedbackSound, latestGameStateRef
    ]);

    // --- Reset State Function ---
    // Called externally (e.g., by useGameFlow) when starting a new game/retry.
    const resetResponses = useCallback(() => {
        // Force clear ALL known pending timeouts FIRST (inner and outer)
        cancelAllPendingFeedbackTimeouts(); // Use the full canceller here for complete reset

        // Reset UI feedback states
        setPositionFeedback(null);
        setAudioFeedback(null);
        setColorFeedback(null);
        setShapeFeedback(null);
        setRecallFeedback(null);
        setRecallSelectedColor(null);
        setMissedMatchTrial(null);

        // Reset response tracking arrays (state and refs)
        setVisualResponseTrials([]);
        setAudioResponseTrials([]);
        setColorResponseTrials([]);
        setShapeResponseTrials([]);
        visualResponseTrialsRef.current = [];
        audioResponseTrialsRef.current = [];
        colorResponseTrialsRef.current = [];
        shapeResponseTrialsRef.current = [];

        // Reset missed match guard refs
        lastMissedVisualTrialRef.current = null;
        lastMissedAudioTrialRef.current = null;
        lastMissedColorTrialRef.current = null;
        lastMissedShapeTrialRef.current = null;
        lastRecallBlankTrialRef.current = null;

        // Reset debounce timestamps to prevent stale locks from affecting new game
        lastPositionResponseTimeRef.current = 0;
        lastAudioResponseTimeRef.current = 0;
        lastColorResponseTimeRef.current = 0;
        lastShapeResponseTimeRef.current = 0;

    }, [cancelAllPendingFeedbackTimeouts]); // Dependency on the full canceller

    // --- Check Last Trial Missed Feedback ---
    // Called by GameContext before endGame() to handle missed matches on the final trial.
    // Returns a Promise that resolves after feedback duration (or immediately if no misses).
    // Uses refs instead of state to ensure latest data when called asynchronously.
    const checkLastTrialMissedFeedback = useCallback((trialIndex) => {
        return new Promise((resolve) => {
            const feedbackSettings = getInstantFeedbackEnabled();

            // --- Recall Mode: last-trial blank ---
            // No trial advance follows the final trial, so the blank detector never sees
            // it. Handle it here (event always, display only when miss feedback is on) and
            // short-circuit: Recall has no match-miss branches to run below, and the color
            // one would otherwise fire on a chance n-back repeat.
            if (isRecallMode()) {
                const isScorable = typeof trialIndex === 'number' && typeof nBack === 'number' && trialIndex >= nBack;
                const isBlank = isScorable
                    && colorRecallSelectionsRef?.current?.[trialIndex] === undefined
                    && lastRecallBlankTrialRef.current !== trialIndex;
                if (isBlank) {
                    lastRecallBlankTrialRef.current = trialIndex;
                    logReplayEvent({
                        type: 'feedbackColorRecall',
                        trialIndex,
                        feedbackType: 'missed',
                        ...(!feedbackSettings.misses && { disabled: true })
                    });
                    if (feedbackSettings.misses) {
                        setRecallFeedback('missed');
                        playFeedbackSound('incorrect');
                        setTimeout(resolve, CORRECTNESS_FEEDBACK_DURATION);
                        return;
                    }
                }
                resolve();
                return;
            }

            // Skip if miss feedback is disabled
            if (!feedbackSettings.misses) {
                resolve();
                return;
            }

            const missedModalities = [];

            // Use refs for most current data (avoids stale closure)
            const visualResponses = visualResponseTrialsRef.current;
            const audioResponses = audioResponseTrialsRef.current;
            const colorResponses = colorResponseTrialsRef.current;
            const shapeResponses = shapeResponseTrialsRef.current;

            // Check visual miss
            if (isMatch('visual', trialIndex) && !visualResponses.includes(trialIndex)) {
                missedModalities.push('visual');
                logReplayEvent({ type: 'feedbackVisual', trialIndex, feedbackType: 'missed' });
            }

            // Check audio miss
            if (isMatch('audio', trialIndex) && !audioResponses.includes(trialIndex)) {
                missedModalities.push('audio');
                logReplayEvent({ type: 'feedbackAudio', trialIndex, feedbackType: 'missed' });
            }

            // Check color miss (triple/quad modes)
            if (typeof isColorMatch === 'function' &&
                isColorMatch(trialIndex) &&
                !colorResponses.includes(trialIndex)) {
                missedModalities.push('color');
                logReplayEvent({ type: 'feedbackColor', trialIndex, feedbackType: 'missed' });
            }

            // Check shape miss (quad mode only)
            if (typeof isShapeMatch === 'function' &&
                isShapeMatch(trialIndex) &&
                !shapeResponses.includes(trialIndex)) {
                missedModalities.push('shape');
                logReplayEvent({ type: 'feedbackShape', trialIndex, feedbackType: 'missed' });
            }

            // If any misses, show feedback then resolve after duration
            if (missedModalities.length > 0) {
                if (missedModalities.includes('visual')) {
                    setPositionFeedback('incorrect');
                    setMissedMatchTrial(trialIndex);
                }
                if (missedModalities.includes('audio')) {
                    setAudioFeedback('incorrect');
                }
                if (missedModalities.includes('color')) {
                    setColorFeedback('incorrect');
                }
                if (missedModalities.includes('shape')) {
                    setShapeFeedback('incorrect');
                }
                playFeedbackSound('incorrect');

                // Resolve after feedback duration
                setTimeout(resolve, CORRECTNESS_FEEDBACK_DURATION);
            } else {
                // No misses - resolve immediately
                resolve();
            }
        });
    }, [
        // Only stable dependencies - refs are stable so not needed
        getInstantFeedbackEnabled, isMatch, isColorMatch, isShapeMatch,
        logReplayEvent, playFeedbackSound,
        isRecallMode, nBack, colorRecallSelectionsRef
    ]);

    // --- Return Hook Interface ---
    // Expose state values and handler functions needed by the consuming component (GameScreen).
    return {
        // State values for UI feedback
        positionFeedback,
        audioFeedback,
        colorFeedback,          // Color feedback state (Triple/Quad)
        shapeFeedback,          // Shape feedback state (Quad only)
        recallFeedback,         // Recall pad feedback state (singleColorRecall)
        recallSelectedColor,    // Color locked for the current trial (singleColorRecall)
        missedMatchTrial,       // Index for PositionGrid highlight
        visualResponseTrials,   // Array of visual response trials (useful for grid state)
        audioResponseTrials,    // Array of audio response trials
        colorResponseTrials,    // Array of color response trials
        shapeResponseTrials,    // Array of shape response trials

        // Handler functions to be called by UI controls or keybindings
        handlePositionResponse,
        handleAudioResponse,
        handleColorResponse,    // Color response handler (Triple/Quad)
        handleShapeResponse,    // Shape response handler (Quad only)
        handleColorRecallSelect, // Recall selection handler (singleColorRecall)

        // Function to reset state (called by useGameFlow/GameScreen)
        resetResponses,

        // Function to check and show feedback for missed matches on last trial
        // Called by GameContext before endGame()
        checkLastTrialMissedFeedback,
    };
};

export default useGameResponses;
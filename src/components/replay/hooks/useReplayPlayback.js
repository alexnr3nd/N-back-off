/* File: src/components/replay/hooks/useReplayPlayback.js */
import { useState, useRef, useCallback, useEffect } from 'react';
import audioManager from '../../../utils/audioManager';

// --- Debug Flags (Set to false for production) ---
const DEBUG_PLAYBACK_LOOP = false;
const DEBUG_PLAYBACK_EFFECT = false;
const DEBUG_CONTROLS = false;

/**
 * Hook to manage the core playback state and timing of the replay.
 * Relies on the calling component to handle AudioContext resume via user interaction
 * before calling play() or togglePlayPause(). Handles internal timing stabilization.
 *
 * @param {number} totalDuration - Total duration of the replay in ms.
 * @param {function(number): void} onTimeUpdate - Callback function triggered on time updates during playback.
 * @param {function(): void} onFinished - Callback function triggered when playback reaches the end.
 * @param {boolean} autoPlay - DEPRECATED: Ignored. Playback requires user interaction first.
 */
export const useReplayPlayback = (totalDuration, onTimeUpdate, onFinished, autoPlay = false) => {
    const initialPlaybackState = 'paused'; // Always start paused
    const [playbackState, setPlaybackState] = useState(initialPlaybackState);
    const [currentTime, setCurrentTime] = useState(0); // Milliseconds
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

    // Refs for managing the animation loop and state within callbacks/closures
    const animationFrameRef = useRef(null);
    const lastUpdateTimeRef = useRef(null); // Initialize to null - will be set on first frame
    const playbackStateRef = useRef(playbackState); // Ref to track state reliably
    const isFirstFrameRef = useRef(false); // Flag to track the first frame after play/seek/speed change

    // Keep playbackStateRef synchronized
    useEffect(() => {
        playbackStateRef.current = playbackState;
    }, [playbackState]);

    // --- Core Playback Loop (using requestAnimationFrame) ---
    const runPlaybackLoop = useCallback((timestamp) => {
        // --- Loop Termination Check ---
        if (playbackStateRef.current !== 'playing') {
            if (DEBUG_PLAYBACK_LOOP) console.log(`[PlaybackLoop] Stopping. State: ${playbackStateRef.current}`);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            return;
        }

        // --- First Frame Initialization ---
        if (isFirstFrameRef.current) {
             if (DEBUG_PLAYBACK_LOOP) console.log(`[PlaybackLoop] First frame detected. Timestamp: ${timestamp.toFixed(0)}. Setting lastUpdateTimeRef.`);
             lastUpdateTimeRef.current = timestamp;
             isFirstFrameRef.current = false;
        }

        // --- Delta Time Calculation ---
        if (lastUpdateTimeRef.current === null) {
             if (DEBUG_PLAYBACK_LOOP) console.warn("[PlaybackLoop] lastUpdateTimeRef is null, skipping frame calculation.");
             if (playbackStateRef.current === 'playing') {
                animationFrameRef.current = requestAnimationFrame(runPlaybackLoop);
             }
            return;
        }

        const realDeltaTime = timestamp - lastUpdateTimeRef.current;

        if (realDeltaTime <= 0) {
            if (DEBUG_PLAYBACK_LOOP) console.log(`[PlaybackLoop] Delta time <= 0 (${realDeltaTime.toFixed(2)}ms). Skipping update, requesting next frame.`);
            lastUpdateTimeRef.current = timestamp;
            if (playbackStateRef.current === 'playing') {
                animationFrameRef.current = requestAnimationFrame(runPlaybackLoop);
            }
            return;
        }

        const cappedRealDeltaTime = Math.min(realDeltaTime, 100); // Cap delta to prevent large jumps
        const gameDeltaTime = cappedRealDeltaTime * playbackSpeed;
        lastUpdateTimeRef.current = timestamp;

        if (DEBUG_PLAYBACK_LOOP) {
             const logTime = currentTime; // Use state value for logging if needed
             console.log(`[PlaybackLoop] Approx Time: ${logTime.toFixed(0)}, Real Delta: ${realDeltaTime.toFixed(1)}ms, Game Delta: ${gameDeltaTime.toFixed(1)}ms, Speed: ${playbackSpeed}x`);
        }

        // --- Update Current Time State ---
        setCurrentTime(prevTime => {
            const newTime = prevTime + gameDeltaTime;
            if (newTime >= totalDuration) {
                if (DEBUG_PLAYBACK_LOOP) console.log("[PlaybackLoop] Replay finished.");
                setPlaybackState('finished');
                if (onTimeUpdate) onTimeUpdate(totalDuration);
                if (onFinished) onFinished();
                return totalDuration;
            }
            if (onTimeUpdate) {
                onTimeUpdate(newTime);
            }
            return newTime;
        });

        // --- Request Next Frame ---
        if (playbackStateRef.current === 'playing') {
            animationFrameRef.current = requestAnimationFrame(runPlaybackLoop);
        } else {
            if (DEBUG_PLAYBACK_LOOP) console.log("[PlaybackLoop] State changed mid-loop, stopping next frame request.");
            animationFrameRef.current = null;
        }
    }, [playbackSpeed, totalDuration, onTimeUpdate, onFinished]); // Stable dependencies


    // --- Effect to Manage Starting/Stopping Loop and Sound Cleanup ---
    useEffect(() => {
        if (DEBUG_PLAYBACK_EFFECT) {
            console.log(`[Playback Effect RUN] State: ${playbackState} at ${performance.now().toFixed(0)}`);
        }

        if (playbackState === 'playing') {
            if (DEBUG_PLAYBACK_EFFECT) console.log("[Playback Effect] State is 'playing'. Setting isFirstFrameRef=true and requesting animation frame.");
            isFirstFrameRef.current = true;
            if (animationFrameRef.current) {
                 cancelAnimationFrame(animationFrameRef.current);
            }
            animationFrameRef.current = requestAnimationFrame(runPlaybackLoop);
        } else {
             if (DEBUG_PLAYBACK_EFFECT) console.log(`[Playback Effect] State is '${playbackState}'. Cancelling animation frame.`);
             if (animationFrameRef.current) {
                  cancelAnimationFrame(animationFrameRef.current);
                  animationFrameRef.current = null;
             }
             isFirstFrameRef.current = false;
             if (playbackState === 'paused' || playbackState === 'finished') {
                  if (DEBUG_PLAYBACK_EFFECT) console.log(`[Playback Effect] State is '${playbackState}'. Calling audioManager.stopCurrentSound().`);
                  // Ensure sound stops when explicitly paused or finished
                  audioManager.stopCurrentSound();
             }
        }

        // --- Cleanup Function ---
        return () => {
            if (DEBUG_PLAYBACK_EFFECT) {
                 console.log(`[Playback Effect CLEANUP] Running for state '${playbackState}' at ${performance.now().toFixed(0)}. Cancelling frame. Stopping sound.`);
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            isFirstFrameRef.current = false;
            // Ensure sound stops on cleanup/unmount
            audioManager.stopCurrentSound();
        };
    }, [playbackState, runPlaybackLoop]); // Stable dependencies


    // ==================================================
    // === Control Functions ===
    // ==================================================

    /** Start or resume playback. ASSUMES AudioContext is already running or resumed by the caller. */
    const play = useCallback(() => {
        if (DEBUG_CONTROLS) console.log("[Playback Controls] Play() called.");

        if (playbackStateRef.current === 'finished') {
            if (DEBUG_CONTROLS) console.log("[Playback Controls] Play(): Resetting from finished state.");
            setCurrentTime(0);
            if (onTimeUpdate) {
                 if (DEBUG_CONTROLS) console.log("[Playback Controls] Play(): Triggering onTimeUpdate(0) for reset.");
                 onTimeUpdate(0);
            }
            setPlaybackState('playing');
        } else {
            if (DEBUG_CONTROLS) console.log("[Playback Controls] Play(): Setting state to playing.");
            setCurrentTime(prevCurrentTime => {
                 if (onTimeUpdate) {
                     if (DEBUG_CONTROLS) console.log(`[Playback Controls] Play(): Triggering onTimeUpdate(${prevCurrentTime.toFixed(0)}) for resume.`);
                     onTimeUpdate(prevCurrentTime);
                 }
                 return prevCurrentTime;
            });
            setPlaybackState('playing');
        }
    }, [onTimeUpdate]);

    /** Pause playback. */
    const pause = useCallback(() => {
        if (DEBUG_CONTROLS) console.log("[Playback Controls] Pause() called.");
        setPlaybackState('paused');
     }, []);

    /** Toggle between play and pause states. Assumes context is handled externally. */
    const togglePlayPause = useCallback(() => {
        if (DEBUG_CONTROLS) console.log(`[Playback Controls] TogglePlayPause() called. Current state ref: ${playbackStateRef.current}`);
        if (playbackStateRef.current === 'playing') {
            pause();
        } else {
            play();
        }
    }, [play, pause]);

    /** Reset playback to the beginning and pause. */
    const reset = useCallback(() => {
        if (DEBUG_CONTROLS) console.log("[Playback Controls] Reset() called.");
        setPlaybackState('paused');
        setCurrentTime(0);
        if (onTimeUpdate) {
            if (DEBUG_CONTROLS) console.log("[Playback Controls] Reset(): Triggering onTimeUpdate(0).");
            onTimeUpdate(0);
        }
     }, [onTimeUpdate]);

    /** Seek to a specific time. ASSUMES AudioContext is running/resumed by the caller. */
    const seek = useCallback((targetTime) => {
         if (DEBUG_CONTROLS) console.log(`[Playback Controls] Seek() called with targetTime: ${targetTime.toFixed(0)}`);
         const clampedTime = Math.max(0, Math.min(targetTime, totalDuration));
         setCurrentTime(clampedTime);
         if (onTimeUpdate) {
             if (DEBUG_CONTROLS) console.log(`[Playback Controls] Seek(): Triggering onTimeUpdate(${clampedTime.toFixed(0)}).`);
             onTimeUpdate(clampedTime);
         }
         const wasPlaying = playbackStateRef.current === 'playing';
         const wasFinished = playbackStateRef.current === 'finished';
         const isNowFinished = clampedTime >= totalDuration;
         if (isNowFinished && !wasFinished) {
              if (DEBUG_CONTROLS) console.log("[Playback Controls] Seek(): Reached end, setting state to finished.");
              setPlaybackState('finished');
              if (onFinished) onFinished();
         } else if (!isNowFinished && wasFinished) {
              if (DEBUG_CONTROLS) console.log("[Playback Controls] Seek(): Moved from end, setting state to paused.");
              setPlaybackState('paused');
         } else if (wasPlaying) {
              if (DEBUG_CONTROLS) console.log("[Playback Controls] Seek(): Was playing, setting isFirstFrameRef=true.");
              isFirstFrameRef.current = true; // Re-initialize time ref on next frame
         }
    }, [totalDuration, onTimeUpdate, onFinished]);

    /** Change the playback speed multiplier. */
    const changeSpeed = useCallback((newSpeed) => {
        const speedValue = parseFloat(newSpeed);
        if (!isNaN(speedValue) && speedValue > 0 && speedValue <= 4) {
             if (DEBUG_CONTROLS) console.log(`[Playback Controls] ChangeSpeed() called with newSpeed: ${speedValue}`);
            setPlaybackSpeed(speedValue);
             if (playbackStateRef.current === 'playing') {
                 if (DEBUG_CONTROLS) console.log("[Playback Controls] ChangeSpeed(): Was playing, setting isFirstFrameRef=true.");
                 isFirstFrameRef.current = true; // Re-initialize time ref on next frame
             }
        } else {
            // Keep this warning for production
            console.warn(`[useReplayPlayback] Invalid speed value received: ${newSpeed}`);
        }
    }, []);

    // ==================================================
    // === Return Hook Interface ===
    // ==================================================
    return {
        // State
        playbackState,
        currentTime,
        playbackSpeed,
        // Actions (Assume external context management)
        play,
        pause,
        togglePlayPause,
        reset,
        seek,
        changeSpeed,
        // Internal setters EXPOSED FOR STEPPING LOGIC in ReplayViewer - use with caution!
        _setCurrentTime: setCurrentTime,
        _setPlaybackState: setPlaybackState,
    };
};
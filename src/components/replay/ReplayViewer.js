/* File: src/components/replay/ReplayViewer.js */

import React, { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

// --- Hooks ---
import { useReplayPlayback } from './hooks/useReplayPlayback';
import { useReplayStateSync } from './hooks/useReplayStateSync';
import { useReplayStats } from './hooks/useReplayStats';
import { useReplaySharing } from './hooks/useReplaySharing';
import { useSettings } from '../../contexts/SettingsContext';

// --- UI and Helper Components ---
import PositionGrid from '../game/PositionGrid';
import MatchButton from '../game/MatchButton';
import ColorRecallPad from '../game/ColorRecallPad';
import { GAME_MODES } from '../../constants/gameConstants';
import { MODE_LABELS } from '../../constants/modeStyles';
import ConfirmationModal from '../ui/ConfirmationModal';
import PublicReplayHeader from '../ui/PublicReplayHeader';
import SequenceTimeline from './SequenceTimeline';
import FeedbackButton from '../feedback/FeedbackButton';
import PublicFooter from '../ui/PublicFooter';

// --- Utilities ---
import audioManager from '../../utils/audioManager';
import { getReplayDuration } from './utils/replayUtils';
import { SAFE_AREA_TOP, SAFE_AREA_BOTTOM } from '../../utils/safeArea';



// --- Loading/Error Components ---
const ErrorDisplay = ({ message }) => (
    <div className="h-screen flex items-center justify-center p-4 bg-theme-bg">
        <div className="text-center p-6 rounded-lg max-w-md bg-theme-bg-secondary border border-theme-line">
            <p className="font-serif italic text-theme-accent mb-2">Error</p>
            <p className="mb-4 text-sm text-theme-text-secondary">{message || "An unknown error occurred."}</p>
            <button
                onClick={() => window.history.back()}
                className='mt-4 px-4 py-2 rounded-lg transition-colors font-mono text-sm bg-theme-bg-elevated border border-theme-line text-theme-text hover:bg-theme-bg-surface'
            >
                Go Back
            </button>
        </div>
    </div>
);
// --- End Loading/Error Components ---


// --- Helper Functions ---
const formatCombinedDifficulty = (nBack, difficulty) => {
    const diffValue = Math.max(0, Math.min(0.99, difficulty ?? 0));
    const formattedDifficulty = diffValue.toFixed(2).substring(2);
    return `${nBack}.${formattedDifficulty}`;
};
// --- End Helper Functions ---


const ReplayViewer = ({
    replayData,
    username = 'Player',
    sessionId,
    profileId,
    initialIsPublic = false,
    isPublicView = false, // This prop determines if it's accessed via a public link
    isLocalReplay = false, // This prop determines if it's loaded locally
    onExit,
    authUser, // The currently logged-in user object from Firebase Auth
}) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Determine where user came from for smart back navigation
    const cameFrom = location.state?.from; // 'results', 'sessions', or 'dashboard'
    const { settings: appSettings } = useSettings();

    // State for mobile sequence timeline expansion
    const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);

    // --- Prop Validation ---
    if (!replayData || !replayData.events || typeof replayData.startTime !== 'number') {
        console.error("ReplayViewer: Missing or invalid data.", { replayData }); // Keep critical error
        return <ErrorDisplay message="Could not load replay viewer due to missing or invalid data." />;
    }
    const { settings: replaySettings, events, startTime: replayStartTime } = replayData;

    // *** MODIFIED LINE: Read 'difficulty' instead of 'difficultySeed', rename to 'difficultyValue' locally ***
    const { nBack = 2, difficulty: difficultyValue = 0.5, generatedSequence,
            actualTrialCount, totalTrials: totalTrialsFromSettings,
            modality, gameMode, trainingMode } = replaySettings || {};
    const isClassicReplay = trainingMode === 'classic';
    // Use gameMode if available, fall back to modality, then 'dual'
    const effectiveModality = gameMode || modality || 'dual';
    // Sequence can be at replayData.sequence (new) or replayData.settings.generatedSequence (legacy)
    const sequence = replayData?.sequence || generatedSequence || [];
    // *** END MODIFIED LINE ***
    const totalTrials = actualTrialCount ?? totalTrialsFromSettings ?? 0;

    // --- Default Voice ID ---
    const defaultVoiceId = useMemo(() => {
        if (audioManager && audioManager.VOICES && typeof audioManager.VOICES === 'object') {
            const voiceKeys = Object.keys(audioManager.VOICES);
            if (voiceKeys.length > 0) { return voiceKeys[0]; }
        }
        console.warn("[ReplayViewer] audioManager.VOICES not available/populated during defaultVoiceId calculation."); // Keep potential config warning
        return null;
    }, []);

    // --- State & Context ---
    const isLoggedIn = !!authUser;

    // --- VIEW TYPE DETERMINATION ---
    const isPublicUnauthenticatedView = !isLoggedIn && isPublicView;
    const viewingOwnReplay = isLoggedIn && !!replayData.userId && authUser.uid === replayData.userId && !!profileId;
    // Calculate isPrivateView:
    // It's private if it's a local replay OR if the user is logged in AND (it's not explicitly a public view OR they own the replay being viewed).
    const isPrivateView = isLocalReplay || (isLoggedIn && (!isPublicView || viewingOwnReplay));

    // --- Refs ---
    const prevTrialIndexRef = useRef(-1);
    const prevPlaybackStateRef = useRef('paused');
    const updateStateForTimeRef = useRef(null);
    const calculateStatsAtTimeRef = useRef(null);
    const onFinishedCallbackRef = useRef(null);

    // --- Derived Values ---
    const totalDuration = useMemo(() => getReplayDuration(events || []), [events]);

    // --- Initialize AudioManager ---
    useEffect(() => {
        if (!defaultVoiceId) return;
        if(audioManager.init()) {
            audioManager.preload({
              soundSetId: 'alphabet',
              voiceId: defaultVoiceId,
            });
        } else {
            console.error("[ReplayViewer] AudioManager initialization failed, cannot preload."); // Keep critical error
        }
        return () => {
          audioManager.stopCurrentSound(); // Cleanup on unmount
        };
      }, [defaultVoiceId]); // Note: removed difficultyValue from here, preload doesn't need specific difficulty

    // --- Custom Hooks ---
    const {
        currentTrialIndex, gridPosition, visualFeedbackState, missedVisualHighlightIndex,
        posResponseFlash, audioLetter, audioFeedbackState, audioResponseFlash,
        colorFeedbackState, colorResponseFlash, shapeFeedbackState, shapeResponseFlash,
        recallSelection,
        updateStateForTime, displayStimuliForTrial, findTrialStartTime, resetStateToStart,
    } = useReplayStateSync(events, replaySettings, replayStartTime);

    const { calculateStatsAtTime, resetStats } = useReplayStats(events, replayStartTime);

    // --- Keep Refs Updated with Latest Functions ---
    useEffect(() => { updateStateForTimeRef.current = updateStateForTime; }, [updateStateForTime]);
    useEffect(() => { calculateStatsAtTimeRef.current = calculateStatsAtTime; }, [calculateStatsAtTime]);

    // --- Define onFinished logic ---
    const handlePlaybackFinished = useCallback(() => {
        if (updateStateForTimeRef.current) updateStateForTimeRef.current(totalDuration, false);
        if (calculateStatsAtTimeRef.current) calculateStatsAtTimeRef.current(totalDuration);
        prevPlaybackStateRef.current = 'finished';
    }, [totalDuration]);

    // Update the ref for the finished handler
    useEffect(() => { onFinishedCallbackRef.current = handlePlaybackFinished; }, [handlePlaybackFinished]);

    // --- Define STABLE Callbacks for useReplayPlayback ---
    const stableOnTimeUpdate = useCallback((newTime) => {
        if (updateStateForTimeRef.current) updateStateForTimeRef.current(newTime, false);
        if (calculateStatsAtTimeRef.current) calculateStatsAtTimeRef.current(newTime);
    }, []); // Stable

    const stableOnFinished = useCallback(() => {
        if (onFinishedCallbackRef.current) onFinishedCallbackRef.current();
    }, []); // Stable

    // --- Playback Hook Initialization ---
    const {
        playbackState, currentTime, playbackSpeed,
        togglePlayPause, reset: playbackReset, seek, changeSpeed,
        _setCurrentTime, _setPlaybackState
    } = useReplayPlayback(
        totalDuration,
        stableOnTimeUpdate,
        stableOnFinished
    );

    // --- Resume Logic ---
    const handlePlayPauseWithResume = useCallback(() => {
        const ctx = audioManager.getAudioContext();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume()
            .then(() => {
              togglePlayPause();
            })
            .catch(err => {
              console.error("[ReplayViewer] Failed to resume audio context on play click:", err); // Keep error
            });
        } else if (ctx && ctx.state === 'running') {
           togglePlayPause();
        } else {
          console.warn("[ReplayViewer] AudioContext not available or in unexpected state:", ctx?.state); // Keep warning
          togglePlayPause();
        }
      }, [togglePlayPause]);

    // --- Sharing Hook ---
    const {
        isSharing, isMakingPrivate, shareError, showShareLinkModal, shareLink, isNowPublic, isCopied,
        canShare, canMakePrivate, handleSharePublicly, handleCopyLink, handleManualCopy, handleMakePrivate, closeShareModal
    } = useReplaySharing(sessionId, profileId, initialIsPublic, isPublicView, isLocalReplay);


    // --- AUDIO PLAYBACK EFFECT ---
    useEffect(() => {
        const currentPlaybackState = playbackState;
        const previousPlaybackState = prevPlaybackStateRef.current;

        if (currentPlaybackState !== 'playing') {
          audioManager.stopCurrentSound();
          prevPlaybackStateRef.current = currentPlaybackState;
          return;
        }

        let trialToPlay = -1;
        const isJustStarted = currentPlaybackState === 'playing' && previousPlaybackState !== 'playing';

        if (isJustStarted) {
            if (currentTrialIndex === 0) {
                trialToPlay = 0;
            }
        }
        else if (currentTrialIndex >= 0 && currentTrialIndex !== prevTrialIndexRef.current) {
           trialToPlay = currentTrialIndex;
        }

        if (trialToPlay >= 0) {
            prevTrialIndexRef.current = trialToPlay; // Update ref before async call

            const audioStimEvent = events.find(
                e => e.type === 'audioStimulusStart' && e.trialIndex === trialToPlay
            );

            if (!audioStimEvent?.letter) {
               prevPlaybackStateRef.current = currentPlaybackState;
               return;
            }

            const ctx = audioManager.getAudioContext();
            if (!ctx || ctx.state !== 'running') {
              console.warn(`[Replay Audio Effect] Skipping play for trial ${trialToPlay}, audio context state is: ${ctx?.state}`); // Keep warning
              prevPlaybackStateRef.current = currentPlaybackState;
              return;
            }

            const voiceId = audioStimEvent.voice || appSettings.selectedVoiceId || defaultVoiceId;
            // *** MODIFIED LINE: Use difficultyValue from replaySettings ***
            const difficultyForPlayback = typeof audioStimEvent.difficulty === 'number'
               ? audioStimEvent.difficulty
               : difficultyValue;
            // *** END MODIFIED LINE ***

            if (!voiceId) {
              console.error(`[Replay Audio Effect] No valid voiceId found for trial ${trialToPlay}. Skipping play.`); // Keep error
              prevPlaybackStateRef.current = currentPlaybackState;
              return;
            }

            audioManager
              .playItem(audioStimEvent.letter, difficultyForPlayback, { voiceId })
              .catch(err => {
                  console.error(`[Replay Audio Effect] PlayItem FAILED for trial ${trialToPlay}:`, err); // Keep error
              });
        }

        // Update previous state ref at the end
        prevPlaybackStateRef.current = currentPlaybackState;

      }, [
        playbackState, currentTrialIndex, currentTime,
        events,
        // *** MODIFIED LINE: Add difficultyValue to dependency array ***
        difficultyValue,
        // *** END MODIFIED LINE ***
        appSettings.selectedVoiceId, defaultVoiceId,
      ]);


    // --- Other CALLBACKS ---
    const handleReset = useCallback(() => {
        playbackReset();
        resetStateToStart();
        resetStats();
        prevTrialIndexRef.current = -1;
        prevPlaybackStateRef.current = 'paused';
        audioManager.stopCurrentSound();
    }, [playbackReset, resetStateToStart, resetStats]);

    const handleStep = useCallback(async (direction) => {
        const resumeSuccess = await audioManager.resume();
        if (!resumeSuccess) console.warn("[Replay Step] Audio context could not be resumed."); // Keep warning

        const wasPlaying = playbackState === 'playing';
        if (wasPlaying) {
             _setPlaybackState('paused');
             audioManager.stopCurrentSound();
        }

        const stepAmount = direction === 'forward' ? 1 : -1;
        let targetTrialIndex = prevTrialIndexRef.current + stepAmount;
        let targetTime = null;
        let newPlaybackState = 'paused';

        if (targetTrialIndex >= totalTrials) {
            targetTrialIndex = totalTrials - 1;
            targetTime = totalDuration;
            newPlaybackState = 'finished';
        } else if (targetTrialIndex < -1) {
            targetTrialIndex = -1;
            targetTime = 0;
        } else if (targetTrialIndex === -1) {
            targetTime = 0;
        } else {
            targetTime = findTrialStartTime(targetTrialIndex);
            if (targetTime === null) {
                 console.warn(`[Replay Step] Could not find start time for trial ${targetTrialIndex}. Aborting step.`); // Keep warning
                 return;
            }
        }

        _setCurrentTime(targetTime);
        if(updateStateForTimeRef.current) updateStateForTimeRef.current(targetTime, true);
        if(calculateStatsAtTimeRef.current) calculateStatsAtTimeRef.current(targetTime);
        displayStimuliForTrial(targetTrialIndex);

        prevTrialIndexRef.current = targetTrialIndex;
        _setPlaybackState(newPlaybackState);
        prevPlaybackStateRef.current = newPlaybackState;

        if (resumeSuccess && direction === 'forward' && targetTrialIndex >= 0 && targetTrialIndex < totalTrials && (modality === 'dual' || modality === 'audio')) {
            const audioStimEvent = events.find(e => e.type === 'audioStimulusStart' && e.trialIndex === targetTrialIndex);
            if (audioStimEvent?.letter) {
                // *** MODIFIED LINE: Use difficultyValue from replaySettings ***
                const difficultyForPlayback = typeof audioStimEvent.difficulty === 'number'
                    ? audioStimEvent.difficulty
                    : difficultyValue;
                // *** END MODIFIED LINE ***
                const voiceId = audioStimEvent.voice || appSettings?.selectedVoiceId || defaultVoiceId;
                if (voiceId) {
                    audioManager.playItem(audioStimEvent.letter, difficultyForPlayback, { voiceId })
                        .catch(error => console.error(`[Replay Step Audio] Error playing item:`, error)); // Keep error
                } else {
                     console.warn(`[Replay Step] Could not determine voiceId for trial ${targetTrialIndex}`); // Keep warning
                }
            }
        } else if (!resumeSuccess && targetTrialIndex >= 0) {
             console.warn(`[Replay Step] Audio context not running, skipping audio playback for trial ${targetTrialIndex}`); // Keep warning
        }

    }, [
        playbackState, totalTrials, totalDuration, modality,
        // *** MODIFIED LINE: Add difficultyValue to dependency array ***
        difficultyValue,
        // *** END MODIFIED LINE ***
        events,
        appSettings?.selectedVoiceId, defaultVoiceId, findTrialStartTime,
        _setCurrentTime, _setPlaybackState, displayStimuliForTrial
    ]);

    const handleStepForward = useCallback(() => handleStep('forward'), [handleStep]);
    const handleStepBackward = useCallback(() => handleStep('backward'), [handleStep]);

    // Handler for sequence timeline click-to-seek
    const handleSeekToTrial = useCallback(async (targetTrialIndex) => {
        const resumeSuccess = await audioManager.resume();
        if (!resumeSuccess) console.warn("[Replay SeekToTrial] Audio context could not be resumed.");

        // Remember if we were playing before seeking
        const wasPlaying = playbackState === 'playing';

        // Pause while seeking
        if (wasPlaying) {
            _setPlaybackState('paused');
            audioManager.stopCurrentSound();
        }

        // Find the start time for the target trial
        let targetTime;
        let newPlaybackState = wasPlaying ? 'playing' : 'paused'; // Preserve play state

        if (targetTrialIndex < 0) {
            targetTrialIndex = -1;
            targetTime = 0;
        } else if (targetTrialIndex >= totalTrials) {
            targetTrialIndex = totalTrials - 1;
            targetTime = totalDuration;
            newPlaybackState = 'finished';
        } else {
            targetTime = findTrialStartTime(targetTrialIndex);
            if (targetTime === null) {
                console.warn(`[Replay SeekToTrial] Could not find start time for trial ${targetTrialIndex}`);
                return;
            }
        }

        // Update playback position
        _setCurrentTime(targetTime);
        if (updateStateForTimeRef.current) updateStateForTimeRef.current(targetTime, true);
        if (calculateStatsAtTimeRef.current) calculateStatsAtTimeRef.current(targetTime);
        displayStimuliForTrial(targetTrialIndex);

        // Update refs
        prevTrialIndexRef.current = targetTrialIndex;
        _setPlaybackState(newPlaybackState);
        prevPlaybackStateRef.current = newPlaybackState;

        // Only play audio if we were playing (continue playback)
        if (wasPlaying && resumeSuccess && targetTrialIndex >= 0 && targetTrialIndex < totalTrials && (modality === 'dual' || modality === 'audio')) {
            const audioStimEvent = events.find(e => e.type === 'audioStimulusStart' && e.trialIndex === targetTrialIndex);
            if (audioStimEvent?.letter) {
                const difficultyForPlayback = typeof audioStimEvent.difficulty === 'number'
                    ? audioStimEvent.difficulty
                    : difficultyValue;
                const voiceId = audioStimEvent.voice || appSettings?.selectedVoiceId || defaultVoiceId;
                if (voiceId) {
                    audioManager.playItem(audioStimEvent.letter, difficultyForPlayback, { voiceId })
                        .catch(error => console.error(`[Replay SeekToTrial Audio] Error playing item:`, error));
                }
            }
        }
    }, [
        playbackState, totalTrials, totalDuration, modality,
        difficultyValue, events, appSettings?.selectedVoiceId, defaultVoiceId,
        findTrialStartTime, _setCurrentTime, _setPlaybackState, displayStimuliForTrial
    ]);

    // --- Derived Values for Rendering ---
    const missedPositionToHighlight = useMemo(() => ( sequence && missedVisualHighlightIndex !== null && missedVisualHighlightIndex >= 0 && sequence[missedVisualHighlightIndex] ) ? sequence[missedVisualHighlightIndex].position : null, [sequence, missedVisualHighlightIndex]);

    // Determine if we should show play/replay overlay
    const showPlayOverlay = playbackState === 'paused' && currentTime === 0;
    const showReplayOverlay = playbackState === 'finished';

    // --- Reusable Replay Card Content Definition ---
    const replayCardContentJSX = (
        <>
            {/* Panel Header - Status Bar (matches GamePlayingScreen) */}
            <div className="border-b border-theme-line px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${playbackState === 'playing' ? 'bg-status-success' : 'bg-theme-accent'}`} />
                    <span className="text-xs font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                        {MODE_LABELS[effectiveModality] || 'Dual'} N-Back
                    </span>
                </div>
                <div className="flex items-center justify-end">
                    {(playbackState === 'playing' || (playbackState === 'paused' && currentTime > 0)) && (
                        <button
                            onClick={handlePlayPauseWithResume}
                            className={`w-[88px] py-1.5 text-xs font-mono uppercase tracking-wider
                                     transition-all duration-150
                                     flex items-center justify-center gap-1.5 border
                                     ${playbackState === 'playing'
                                         ? 'text-theme-text-secondary hover:text-theme-text border-theme-line hover:border-theme-accent/50 bg-theme-bg-elevated hover:bg-theme-bg-surface'
                                         : 'text-theme-bg bg-theme-accent hover:bg-theme-accent-hover border-theme-accent'
                                     }`}
                            title={playbackState === 'playing' ? 'Pause Replay' : 'Resume Replay'}
                        >
                            <i className={`fas ${playbackState === 'playing' ? 'fa-pause' : 'fa-play'} text-sm w-3 text-center`} />
                            {playbackState === 'playing' ? 'Pause' : 'Resume'}
                        </button>
                    )}
                </div>
            </div>

            {/* Unified Card Header Content - matches GameHeader layout */}
            <div className="p-6">
                {/* Main Header Row */}
                <div className="flex justify-between items-center mb-3">
                    {/* Left: N-Back Level & Difficulty */}
                    <div className="flex items-center gap-4">
                        {/* N-Back Level */}
                        <div className="flex items-center gap-2">
                            <span className="text-[0.6875rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted">
                                N-Back
                            </span>
                            <span className="text-2xl font-mono text-theme-accent font-bold">
                                {nBack}
                            </span>
                        </div>

                        {/* Difficulty Index — hidden for Classic replays, shown for all others (including old sessions without trainingMode) */}
                        {!isClassicReplay && (
                            <div className="flex items-center gap-2 pl-4 border-l border-theme-line">
                                <span className="text-[0.6875rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted">
                                    Level
                                </span>
                                <span className="text-lg font-mono text-theme-text">
                                    {formatCombinedDifficulty(nBack, difficultyValue)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Right: Trial Progress */}
                    <div className="flex items-center gap-3 px-4 py-2 bg-theme-bg-elevated border border-theme-line">
                        <span className="text-[0.6875rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted">
                            Trial
                        </span>
                        <span className="text-lg font-mono text-theme-text">
                            {currentTrialIndex >= 0 ? currentTrialIndex + 1 : '-'}
                            <span className="text-theme-text-muted mx-1">/</span>
                            {totalTrials}
                        </span>
                    </div>
                </div>
                <hr className="mt-3 border-theme-line" />
            </div>

            {/* Game Content Area */}
            <div className="px-6 pb-6 pt-4">
                {/* Grid Container with Overlay */}
                <div className="relative">
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                        <div className="flex justify-center w-full max-w-[320px] sm:max-w-[340px] lg:max-w-[360px]">
                            <PositionGrid
                                isReplayMode={true} activePosition={gridPosition} feedbackState={visualFeedbackState} missedHighlightPositionIndex={missedPositionToHighlight}
                                sequence={sequence} currentTrial={currentTrialIndex} nBack={nBack}
                                gameMode={effectiveModality}
                                palette={replayData?.palette}
                            />
                        </div>
                    </div>

                    {/* Play/Replay Overlay */}
                    {(showPlayOverlay || showReplayOverlay) && (
                        <div
                            className="absolute inset-0 flex items-center justify-center cursor-pointer z-10"
                            onClick={handlePlayPauseWithResume}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePlayPauseWithResume(); }}
                            aria-label={showReplayOverlay ? 'Replay session' : 'Play replay'}
                        >
                            {/* Play/Replay button */}
                            <div className="w-20 h-20 rounded-full bg-theme-accent hover:bg-theme-accent-hover transition-colors flex items-center justify-center shadow-lg">
                                <i className={`fas ${showReplayOverlay ? 'fa-rotate-right' : 'fa-play'} text-3xl text-theme-bg ${!showReplayOverlay ? 'pl-1' : ''}`} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Match Buttons Section - Mode-aware layout */}
                {(() => {
                    const replayModalities = GAME_MODES[effectiveModality]?.modalities || ['visual', 'audio'];
                    const isSingle = replayModalities.length === 1;
                    // Recall sessions are single-modality too, so this must precede the isSingle
                    // fallback (which would render a lone "Color" match button instead of the pad).
                    if (effectiveModality === 'singleColorRecall') {
                        return (
                            <div className="flex justify-center mt-6">
                                <div className="w-full max-w-md">
                                    <ColorRecallPad
                                        /* null (not a no-op fn): the pad's handleTap bails on a falsy
                                           onSelect BEFORE its haptics call, so replay taps stay inert
                                           instead of buzzing on native. */
                                        onSelect={null}
                                        feedbackState={colorResponseFlash ? 'acknowledged' : colorFeedbackState}
                                        selectedColor={recallSelection}
                                        disabled={false}
                                        /* Mirror the live watch phase (trials 0..n-1 have nothing to recall yet). */
                                        isWatchPhase={typeof currentTrialIndex === 'number' && currentTrialIndex >= 0 && currentTrialIndex < nBack}
                                        palette={replayData?.palette}
                                    />
                                </div>
                            </div>
                        );
                    }
                    if (isSingle) {
                        const m = replayModalities[0];
                        const label = m === 'visual' ? 'Position' : m === 'audio' ? 'Audio' : m === 'color' ? 'Color' : 'Shape';
                        const fb = m === 'visual' ? (posResponseFlash ? 'acknowledged' : visualFeedbackState)
                                : m === 'audio'  ? (audioResponseFlash ? 'acknowledged' : audioFeedbackState)
                                : m === 'color'  ? (colorResponseFlash ? 'acknowledged' : colorFeedbackState)
                                :                  (shapeResponseFlash ? 'acknowledged' : shapeFeedbackState);
                        return (
                            <div className="flex justify-center mt-6">
                                <div className="w-full max-w-md">
                                    <MatchButton label={label} onClick={() => {}} feedbackState={fb} disabled={false} />
                                </div>
                            </div>
                        );
                    }
                    if (effectiveModality === 'quad') {
                        return (
                            <div className="grid grid-cols-3 gap-2 sm:gap-3 items-center mt-6">
                                <MatchButton label="Position" onClick={() => {}} feedbackState={posResponseFlash ? 'acknowledged' : visualFeedbackState} disabled={false} />
                                <div className="flex flex-col gap-1 sm:gap-2">
                                    <MatchButton label="Shape" onClick={() => {}} feedbackState={shapeResponseFlash ? 'acknowledged' : shapeFeedbackState} disabled={false} />
                                    <MatchButton label="Color" onClick={() => {}} feedbackState={colorResponseFlash ? 'acknowledged' : colorFeedbackState} disabled={false} />
                                </div>
                                <MatchButton label="Audio" onClick={() => {}} feedbackState={audioResponseFlash ? 'acknowledged' : audioFeedbackState} disabled={false} />
                            </div>
                        );
                    }
                    if (effectiveModality === 'triple') {
                        return (
                            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-6">
                                <MatchButton label="Position" onClick={() => {}} feedbackState={posResponseFlash ? 'acknowledged' : visualFeedbackState} disabled={false} />
                                <MatchButton label="Color" onClick={() => {}} feedbackState={colorResponseFlash ? 'acknowledged' : colorFeedbackState} disabled={false} />
                                <MatchButton label="Audio" onClick={() => {}} feedbackState={audioResponseFlash ? 'acknowledged' : audioFeedbackState} disabled={false} />
                            </div>
                        );
                    }
                    /* Dual (default): 2-col grid — Position | Audio */
                    return (
                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <MatchButton label="Position Match" onClick={() => {}} feedbackState={posResponseFlash ? 'acknowledged' : visualFeedbackState} disabled={false} />
                            <MatchButton label="Audio Match" onClick={() => {}} feedbackState={audioResponseFlash ? 'acknowledged' : audioFeedbackState} disabled={modality === 'visual'} />
                        </div>
                    );
                })()}
            </div>
        </>
    );


    // Safe-area padding (status bar top, gesture/nav bar bottom). Universal across
    // Android (Capacitor 8 SystemBars), iOS PWA, and web — see src/utils/safeArea.js.
    const mainContainerStyle = useMemo(() => ({
        paddingTop: SAFE_AREA_TOP,
        paddingBottom: SAFE_AREA_BOTTOM,
    }), []);

    // --- Main Component Render ---
    // Protect against auto-refresh when replay is actively playing
    const isActiveReplay = playbackState === 'playing';

    return (
        // Apply dynamic styles to the outermost container
        <div
            data-game-active={isActiveReplay}
            className="min-h-screen flex flex-col overflow-y-auto bg-theme-bg"
            style={mainContainerStyle}
        >
            {isPublicUnauthenticatedView && <PublicReplayHeader />}

            {/* Main Content Wrapper */}
            <div className="w-full max-w-7xl mx-auto px-4 py-6 pb-12">

                {/* Page Header: Back Navigation + Share Button */}
                <div className="flex justify-between items-center mb-6">
                    {/* Left: Back Navigation */}
                    {isPrivateView && !isPublicView ? (
                        <div>
                            {cameFrom === 'results' ? (
                                <button
                                    onClick={() => navigate(-1)}
                                    className="group inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-accent transition-colors"
                                    aria-label="Back to game results"
                                >
                                    <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                                    <span className="text-xs font-mono uppercase tracking-wider">Return to Results</span>
                                </button>
                            ) : cameFrom === 'sessions' ? (
                                <Link
                                    to="/sessions"
                                    className="group inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-accent transition-colors"
                                >
                                    <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                                    <span className="text-xs font-mono uppercase tracking-wider">Return to Session History</span>
                                </Link>
                            ) : (
                                <Link
                                    to="/dashboard"
                                    className="group inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-accent transition-colors"
                                >
                                    <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                                    <span className="text-xs font-mono uppercase tracking-wider">Return to Dashboard</span>
                                </Link>
                            )}
                        </div>
                    ) : <div />}

                    {/* Right: Share Button */}
                    {canShare && (
                        <div className="flex items-center gap-2">
                            {isNowPublic ? (
                                <>
                                    <button
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                            isCopied ? '' : 'hover:opacity-80'
                                        }`}
                                        style={{
                                            backgroundColor: isCopied ? 'rgba(124, 255, 180, 0.2)' : 'rgb(var(--color-bg-secondary))',
                                            color: isCopied ? '#7CFFB4' : 'rgb(var(--color-text-secondary))',
                                            border: isCopied ? '1px solid rgba(124, 255, 180, 0.5)' : '1px solid rgb(var(--color-line))'
                                        }}
                                        onClick={handleCopyLink}
                                        title="Copy public share link"
                                    >
                                        <i className={`fas ${isCopied ? 'fa-check' : 'fa-copy'}`}></i>
                                        <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Copy Link'}</span>
                                    </button>
                                    <button
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                            isMakingPrivate ? 'cursor-wait opacity-60' : 'hover:opacity-80'
                                        }`}
                                        style={{
                                            backgroundColor: 'rgb(var(--color-bg-secondary))',
                                            color: 'rgb(var(--color-text-secondary))',
                                            border: '1px solid rgb(var(--color-line))'
                                        }}
                                        onClick={handleMakePrivate}
                                        disabled={isMakingPrivate}
                                        title="Make replay private"
                                    >
                                        <i className={`fas ${isMakingPrivate ? 'fa-spinner fa-spin' : 'fa-lock'}`}></i>
                                        <span className="hidden sm:inline">Private</span>
                                    </button>
                                </>
                            ) : (
                                <button
                                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 ${
                                        isSharing ? 'cursor-wait' : 'hover:opacity-90'
                                    }`}
                                    style={{
                                        backgroundColor: isSharing ? 'rgb(var(--color-line))' : 'rgb(var(--color-accent))',
                                        color: isSharing ? 'rgb(var(--color-text-muted))' : 'rgb(var(--color-bg-primary))'
                                    }}
                                    onClick={handleSharePublicly}
                                    disabled={isSharing}
                                    title="Make replay public"
                                >
                                    <i className="fas fa-share-nodes"></i>
                                    <span className="hidden sm:inline">{isSharing ? 'Sharing...' : 'Share'}</span>
                                </button>
                            )}
                            {shareError && (
                                <span className="text-red-500 text-xs">{shareError}</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Main Layout (columns) */}
                <div className="flex flex-col lg:flex-row lg:items-start lg:gap-6">
                    {/* Left Column - Game Card */}
                    <div className="w-full lg:flex-1 flex justify-center lg:justify-start">
                        <div className="rounded-lg w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl relative mb-4 lg:mb-0 bg-theme-bg-secondary border border-theme-line overflow-hidden">
                            {replayCardContentJSX}
                            {/* Mobile Sequence Timeline (collapsible) */}
                            <div className="lg:hidden">
                                <SequenceTimeline
                                    sequence={sequence}
                                    events={events}
                                    nBack={nBack}
                                    modality={effectiveModality}
                                    totalTrials={totalTrials}
                                    currentTrialIndex={currentTrialIndex}
                                    onSeekToTrial={handleSeekToTrial}
                                    palette={replayData?.palette}
                                    isMobile={true}
                                    isExpanded={isTimelineExpanded}
                                    onToggleExpand={() => setIsTimelineExpanded(prev => !prev)}
                                    compactMode={true}
                                />
                            </div>
                        </div>
                    </div>
                    {/* Right Column - Sequence Timeline Only (Desktop) */}
                    <div className="hidden lg:block w-full lg:w-96 lg:flex-shrink-0 mt-6 lg:mt-0">
                        <SequenceTimeline
                            sequence={sequence}
                            events={events}
                            nBack={nBack}
                            modality={effectiveModality}
                            totalTrials={totalTrials}
                            currentTrialIndex={currentTrialIndex}
                            onSeekToTrial={handleSeekToTrial}
                            palette={replayData?.palette}
                            compactMode={true}
                        />
                        {isPublicUnauthenticatedView && <div className="mt-6" />}
                    </div>
                </div>
            </div> {/* End Main Content Wrapper */}

            {/* Share Link Modal - Theme-aware styled with React Portal */}
            {showShareLinkModal && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                    {/* Background overlay */}
                    <div
                        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
                        onClick={closeShareModal}
                    />

                    {/* Modal panel */}
                    <div
                        className="relative w-full max-w-lg bg-theme-bg-secondary border border-theme-line rounded-lg shadow-2xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="share-modal-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="px-6 pt-6 pb-4">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-theme-accent/20">
                                    <i className="fas fa-share-nodes text-theme-accent"></i>
                                </div>
                                <h3 className="text-lg font-serif text-theme-text" id="share-modal-title">
                                    {isCopied ? 'Link Copied!' : 'Share Replay'}
                                </h3>
                            </div>

                            <p className="text-sm text-theme-text-secondary font-mono mb-4">
                                {isCopied
                                    ? 'The link has been copied to your clipboard. Share it with anyone to let them view this replay.'
                                    : 'This replay is now public. Anyone with this link can view your session.'}
                            </p>

                            {/* Link Input with Copy Button */}
                            <div className="mt-4">
                                <label htmlFor="shareLinkInput" className="block text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-2">
                                    Shareable Link
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        id="shareLinkInput"
                                        type="text"
                                        readOnly
                                        value={shareLink}
                                        className="flex-1 px-4 py-3 bg-theme-bg-elevated border border-theme-line rounded-lg
                                            text-theme-text font-mono text-sm
                                            focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-theme-accent
                                            cursor-text"
                                        onFocus={(e) => e.target.select()}
                                        aria-label="Shareable replay link"
                                    />
                                    <button
                                        onClick={handleManualCopy}
                                        className={`px-4 py-3 rounded-lg text-sm font-mono uppercase tracking-wider
                                            transition-all duration-200 flex items-center gap-2
                                            ${isCopied
                                                ? 'bg-neural-dendrite/20 text-theme-neural-green border border-neural-dendrite/50'
                                                : 'bg-theme-accent hover:opacity-90 text-theme-bg border border-theme-accent'
                                            }`}
                                        title="Copy link to clipboard"
                                    >
                                        <i className={`fas ${isCopied ? 'fa-check' : 'fa-copy'}`}></i>
                                        <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Copy'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Copied success indicator */}
                            {isCopied && (
                                <div className="mt-3 flex items-center gap-2 text-theme-neural-green text-sm font-mono">
                                    <i className="fas fa-circle-check"></i>
                                    <span>Ready to paste!</span>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-theme-bg-elevated px-6 py-4 border-t border-theme-line rounded-b-lg">
                            <button
                                type="button"
                                onClick={closeShareModal}
                                className="w-full px-5 py-2.5 rounded-lg text-sm font-mono uppercase tracking-wider
                                    bg-theme-bg-surface hover:bg-theme-bg text-theme-text-secondary hover:text-theme-text
                                    border border-theme-line transition-all duration-200
                                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-theme-bg-surface focus:ring-theme-accent"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Render the Public Footer INSIDE the main padded container */}
            {isPublicUnauthenticatedView && (
                <div className="w-full flex-shrink-0"> {/* Ensure it doesn't grow unnecessarily */}
                    <PublicFooter />
                </div>
            )}

            {/* Render the Feedback Button OUTSIDE the main container IF it uses fixed positioning */}
            {/* Note: If FeedbackButton is fixed, it might need its OWN safe area bottom adjustment */}
            {isPrivateView && !isPublicView && <FeedbackButton />}

        </div> // End outermost container
    );
};

export default ReplayViewer;

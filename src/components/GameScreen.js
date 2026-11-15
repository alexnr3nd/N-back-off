/* src/components/GameScreen.js */
import React, { useEffect, useCallback, useState, useRef } from 'react';
// Import necessary hooks from react-router-dom
import { useNavigate, useBlocker } from 'react-router-dom';

// --- Contexts ---
import { useGame } from '../contexts/GameContext'; // Context for game state and actions
import { useLoading as useLoadingContextHook } from '../contexts/LoadingContext'; // Context for global loading state
import { useSettings } from '../contexts/SettingsContext'; // Context for user settings
import { useUser } from '../contexts/UserContext'; // Context for user ID (session recovery)
import { trackEvent } from '../utils/analyticsTracker';

// --- Firestore (session recovery) ---
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { mapSessionDocToGameResults } from '../utils/sessionRecovery';

// --- Hooks ---
import useGameControls from './game/hooks/useGameControls'; // Hook for keyboard/button controls
import useGameResponses from './game/hooks/useGameResponses'; // Hook for handling match responses
import useGameFlow from './game/hooks/useGameFlow'; // Hook for post-game actions (retry, next, etc.)
import useAutoHideCursor from '../hooks/useAutoHideCursor'; // Hook for auto-hiding cursor during gameplay
import { useDailyCapStatus } from '../hooks/useDailyCapStatus'; // Daily Adaptive cap status (capped cohorts)

// --- Components ---
import GameCountdown from './game/GameCountdown'; // Countdown screen before game starts
import GamePlayingScreen from './game/GamePlayingScreen'; // Main screen for active gameplay/pause
import GameResults from './game/GameResults'; // Screen displaying results after game ends
import ContinuousResults from './game/ContinuousResults'; // Chain-aware results for Continuous Mode
import ContinuousModeStartModal from './game/ContinuousModeStartModal'; // Pre-start modal (also reused on chain end)
import LoadingScreen from './ui/LoadingScreen'; // Generic loading indicator component
import ConfirmationModal from './ui/ConfirmationModal'; // Reusable confirmation dialog
import FeedbackButton from './feedback/FeedbackButton'; // Feedback button component
// *** ADDED: Import GamePaused component ***
import GamePaused from './game/GamePaused'; // Standard pause overlay
import HealthSafetyNoticeModal from './game/HealthSafetyNoticeModal';
import useHealthSafetyNotice from '../hooks/useHealthSafetyNotice';

// --- Utils ---
import audioManager from '../utils/audioManager';
import { DAILY_ADAPTIVE_CAP, CLASSIC_FIXED_DIFFICULTY } from '../constants/gameConstants';

/**
 * GameScreen Component
 * Orchestrates game phases (Countdown, Playing, Paused, Results).
 * Renders overlays like GamePaused and ConfirmationModal at the top level,
 * ensuring they cover the entire screen correctly. Passes down an
 * `isOverlayVisible` flag to child components like GamePlayingScreen
 * so they can dim their content when an overlay is active.
 */
const GameScreen = () => {
    // --- Basic Hooks ---
    const navigate = useNavigate(); // Function to programmatically navigate

    // --- Game Context ---
    // Destructure all needed state and actions from GameContext
    const {
        // State
        gameState, nBack, difficulty, gameResults,
        currentTrial, sessionSettingsRef, sequence, totalTrials,
        pauseReason, // Reason game is paused ('manual', 'navigation_block', null)
        gameMode: rawGameMode, // Game mode from context ('dual', 'triple', 'quad', or 'dynamic')

        // Actions
        cancelPreparation, pauseGame, resumeGame, endGame, playAfterCountdown,
        registerResponse, resetContextResponseArrays, startGame,
        clearPauseReason, // Action to clear only the pause reason
        recoverSession, // Recovery function for restoring results after page refresh

        // Getters
        isMatch, getStimulusDuration, getInstantFeedbackEnabled, getVisualMatches,
        getAudioMatches, playFeedbackSound, logReplayEvent,

        // Refs
        isEndingRef, // Flag to prevent race conditions during game end
        checkLastTrialMissedFeedbackRef, // Ref for last-trial missed feedback function
        resetResponsesRef, // Ref for clearing per-trial response tracking at continuous block transitions
        gameOriginRef, // Tracks where the user started the game from
        continuousChainRef, // Continuous-mode chain state (for back-button save routing)

        // Continuous Mode action: save chain immediately when navigating away mid-chain
        stopAndSaveContinuousChain,

        // Continuous Mode chain controls (used by "Start Another Session" on results page)
        startContinuousChain,
        setSaveToProfile,
        setGameOrigin,

        // Navigation
        setNavigationHandler,
    } = useGame();
    // Note: Continuous Mode Stop button moved into GamePlayingScreen's panel header
    // to avoid mobile overlap with the page header / pause button.

    // --- Other Contexts ---
    const { isLoading: isGlobalLoading } = useLoadingContextHook(); // Get global loading state
    const { settings } = useSettings(); // Get user settings for cursor auto-hide
    // User ID for session recovery; classic progression for chain restart;
    // cap state for the Adaptive-chain pre-start gate.
    const {
        userId, getClassicModeProgression,
        isFullAdaptive, setDailyCapInfo, setShowDailyCapModal,
    } = useUser();
    // Date-aware daily Adaptive cap status (effective count resets at local midnight).
    const { atCap: isDailyCapReached, used: dailyAdaptiveUsedToday } = useDailyCapStatus();

    // --- Health & Safety Notice (first-session acknowledgment) ---
    // Gates the countdown: if the user has not acknowledged the current notice
    // version, the modal is rendered in place of GameCountdown.
    const healthSafety = useHealthSafetyNotice();

    // --- Auto-hide Cursor Hook ---
    // Hides cursor during active gameplay when setting is enabled
    const { containerRef: cursorContainerRef, cursorHidden } = useAutoHideCursor({
        enabled: settings?.autoHideCursor ?? false,
        isActive: gameState === 'playing' || gameState === 'preparing',
        isOverlayVisible: (gameState === 'paused' && pauseReason !== 'navigation_block') || pauseReason === 'navigation_block',
        hideDelayMs: 2500
    });

    // --- Component State ---
    // State to manage the initial loading of the screen component itself
    const [isScreenLoading, setIsScreenLoading] = useState(true);
    const [isRecoveringSession, setIsRecoveringSession] = useState(false);
    // Ref to store pending navigation when blocked
    const pendingTransition = useRef(null);
    // Ref that makes the blocker-handling effect idempotent. That effect re-runs whenever its
    // deps (endGame / shouldWarnForPartialScore) change identity — which happens as soon as
    // endGame() resets gameState/currentTrial/totalTrials — and on those re-runs `blocker` is
    // still the SAME stale 'blocked' object. Tracking which blocker object we've already handled
    // prevents a second endGame()+proceed(), which would throw
    // "Invalid blocker state transition: unblocked -> proceeding".
    const handledBlockerRef = useRef(null);

    // --- Game Logic Hooks ---
    // Hook managing user responses and feedback UI
    const {
        handlePositionResponse, handleAudioResponse, handleColorResponse, handleShapeResponse,
        handleColorRecallSelect, // Recall Mode (singleColorRecall)
        positionFeedback, audioFeedback, colorFeedback, shapeFeedback,
        recallFeedback, recallSelectedColor, // Recall Mode pad state
        missedMatchTrial, visualResponseTrials, audioResponseTrials,
        colorResponseTrials, shapeResponseTrials, resetResponses,
        checkLastTrialMissedFeedback // For last-trial missed feedback
    } = useGameResponses();

    // Resolve actual game mode (for Dynamic, use the sub-mode from session settings)
    const gameMode = sessionSettingsRef?.current?.gameMode || rawGameMode;
    const trainingMode = sessionSettingsRef?.current?.trainingMode || null;

    // Hook managing keyboard controls and pause/resume button action
    const { handlePauseResume } = useGameControls({
        gameState,
        onPositionMatch: handlePositionResponse,
        onAudioMatch: handleAudioResponse,
        onColorMatch: handleColorResponse,   // Color response handler (Triple/Quad)
        onShapeMatch: handleShapeResponse,   // Shape response handler (Quad only)
        onRecallSelect: handleColorRecallSelect, // Recall selection handler (digits 1-8, singleColorRecall)
        gameMode: gameMode,                  // Pass resolved game mode for conditional key handling
        // Note: pause/resume actions are triggered via handlePauseResume,
        // which is passed to GameHeader. Direct calls here are not needed.
    });

    // Hook managing post-game actions
    const {
        handleRetryLevel, handleStartNextSession, handleGoToDashboard
    } = useGameFlow({
        startGame, resetContextResponseArrays, resetResponses, navigate,
        gameResults, sessionSettingsRef, gameOriginRef,
    });

    // --- Continuous "Start Another Session" modal ---
    // ContinuousResults's primary button reopens the same pre-start modal
    // (defaulting to the previous chain's session count) instead of jumping
    // straight into a new chain. Mirrors ProfileDashboard's launch flow.
    const [newChainModal, setNewChainModal] = useState(null);

    // Args: optional { overrideNBack, overrideDifficulty, overrideLevelLabel }.
    // Continue-with-no-args (legacy path) → adaptive uses live profile, classic uses
    // getClassicModeProgression(). Continue/Retry/Go-up from the new ContinuousResults
    // buttons pass explicit overrides so the modal can confirm the level and the
    // chain starts there regardless of post-chain profile mutation.
    const handleOpenAnotherChain = useCallback((opts = {}) => {
        if (!gameResults) return;
        const mode = gameResults.trainingMode === 'classic' ? 'classic' : 'adaptive';
        // Pre-start cap gate for Adaptive chains (mirrors GameResults' maybeBlockOnDailyCap).
        // Classic chains are uncapped, so they skip it.
        if (mode !== 'classic' && !isFullAdaptive && isDailyCapReached) {
            if (typeof setDailyCapInfo === 'function') {
                setDailyCapInfo({ sessionsUsed: dailyAdaptiveUsedToday, dailyCap: DAILY_ADAPTIVE_CAP, source: 'pre_start' });
            }
            if (typeof setShowDailyCapModal === 'function') {
                setShowDailyCapModal(true);
            }
            trackEvent('daily_cap_pre_start_blocked', {
                sessionsUsed: dailyAdaptiveUsedToday,
                source: 'chain_results_another',
            });
            return;
        }
        const previousCount = gameResults?.chainSummary?.totalBlocks;
        setNewChainModal({
            mode,
            defaultSessionCount: typeof previousCount === 'number' ? previousCount : undefined,
            overrideNBack: typeof opts.overrideNBack === 'number' ? opts.overrideNBack : undefined,
            overrideDifficulty: typeof opts.overrideDifficulty === 'number' ? opts.overrideDifficulty : undefined,
            overrideLevelLabel: typeof opts.overrideLevelLabel === 'string' ? opts.overrideLevelLabel : undefined,
        });
    }, [gameResults, isFullAdaptive, isDailyCapReached, dailyAdaptiveUsedToday, setDailyCapInfo, setShowDailyCapModal]);

    const handleCloseNewChainModal = useCallback(() => setNewChainModal(null), []);

    const handleConfirmNewChain = useCallback(async ({ targetBlocks }) => {
        if (!newChainModal) return;
        const { mode, overrideNBack, overrideDifficulty } = newChainModal;
        const hasOverride = typeof overrideNBack === 'number' && typeof overrideDifficulty === 'number';
        setNewChainModal(null);
        try {
            audioManager.init();
            const audioResumed = await audioManager.resume();
            if (audioResumed) {
                const voiceId = settings?.selectedVoiceId || Object.keys(audioManager.VOICES || {})[0];
                if (voiceId) audioManager.preload({ voiceId, difficulties: [0.05] });
            }
        } catch (err) {
            console.error('[GameScreen] Audio resume error (continuous restart):', err);
        }
        // Reset response state from the prior chain. The skipCountdown path bypasses
        // the gameState==='preparing' useEffect AND useGameFlow's reset calls, so without
        // this the previous chain's last-block colorResponseTrials/etc. leak into the new
        // chain — making any trial index that was responded to in the prior block silently
        // reject the user's press as "already responded".
        if (typeof resetResponses === 'function') resetResponses();
        if (typeof resetContextResponseArrays === 'function') resetContextResponseArrays();
        if (typeof setSaveToProfile === 'function') setSaveToProfile(true);
        if (typeof setGameOrigin === 'function') setGameOrigin(gameOriginRef?.current || '/dashboard');
        // Classic always plays at fixed 0.50; override N comes from button
        // (Retry / Manual N±1) or, in the legacy no-override path, from
        // getClassicModeProgression(). Resolved BEFORE startContinuousChain so the
        // chain's start context records the level actually about to be played — the
        // backend derives classicProgression.currentNBack from that context.
        const classicNBack = mode === 'classic'
            ? (hasOverride
                ? overrideNBack
                : (typeof getClassicModeProgression === 'function' ? getClassicModeProgression()?.currentNBack : undefined))
            : undefined;
        if (typeof startContinuousChain === 'function') {
            startContinuousChain({
                targetBlocks,
                trainingMode: mode === 'classic' ? 'classic' : 'adaptive',
                ...(mode === 'classic' && typeof classicNBack === 'number' && {
                    initialNBack: classicNBack,
                    initialDifficulty: CLASSIC_FIXED_DIFFICULTY,
                }),
            });
        }
        if (mode === 'classic') {
            startGame({
                trainingMode: 'classic',
                overrideNBack: classicNBack,
                overrideDifficulty: 0.50,
                skipCountdown: true,
            });
        } else if (hasOverride) {
            startGame({
                trainingMode: 'adaptive',
                overrideNBack,
                overrideDifficulty,
                skipCountdown: true,
            });
        } else {
            startGame({ trainingMode: 'adaptive', skipCountdown: true });
        }
    }, [
        newChainModal, settings?.selectedVoiceId, setSaveToProfile, setGameOrigin,
        gameOriginRef, startContinuousChain, getClassicModeProgression, startGame,
        resetResponses, resetContextResponseArrays,
    ]);

    // --- Set navigation handler for gameEnd discard flow ---
    useEffect(() => {
        if (setNavigationHandler) setNavigationHandler(navigate);
        return () => { if (setNavigationHandler) setNavigationHandler(null); };
    }, [setNavigationHandler, navigate]);

    // --- Wire up last-trial missed feedback function ---
    // Populate the ref so GameContext can call this function before endGame()
    useEffect(() => {
        if (checkLastTrialMissedFeedbackRef) {
            checkLastTrialMissedFeedbackRef.current = checkLastTrialMissedFeedback;
        }
        return () => {
            if (checkLastTrialMissedFeedbackRef) {
                checkLastTrialMissedFeedbackRef.current = null;
            }
        };
    }, [checkLastTrialMissedFeedback, checkLastTrialMissedFeedbackRef]);

    // --- Wire up resetResponses for continuous-mode block transitions ---
    useEffect(() => {
        if (resetResponsesRef) {
            resetResponsesRef.current = resetResponses;
        }
        return () => {
            if (resetResponsesRef) {
                resetResponsesRef.current = null;
            }
        };
    }, [resetResponses, resetResponsesRef]);

    // --- Discard Threshold Logic ---
    // Calculates the minimum trial count required before a warning is shown
    const getDiscardThreshold = useCallback((totalTrialsPlanned) => {
        const validTotal = typeof totalTrialsPlanned === 'number' && totalTrialsPlanned > 0 ? totalTrialsPlanned : 0;
        return Math.max(1, Math.min(10, validTotal > 0 ? Math.ceil(validTotal * 0.5) : 10));
    }, []); // No dependencies, pure function

    // --- Helper to Check for Partial Score Warning ---
    // Determines if the "Leave Game?" confirmation modal should be shown
    const shouldWarnForPartialScore = useCallback(() => {
        const currentTrialFromState = currentTrial; // Read state directly
        const totalTrialsFromState = totalTrials; // Read state directly
        if (gameState !== 'playing' && gameState !== 'paused') return false;
        const trialsCompleted = currentTrialFromState + 1;
        const discardThreshold = getDiscardThreshold(totalTrialsFromState);
        return trialsCompleted >= discardThreshold;
    }, [currentTrial, totalTrials, getDiscardThreshold, gameState]); // Dependencies

    // --- Navigation Blocker Setup ---
    // Intercepts navigation attempts when the game is active
    const blocker = useBlocker(
        // Block if actively playing or paused (regardless of reason)
        gameState === 'playing' || gameState === 'paused'
    );

    // --- Effect to Handle Blocker State Changes ---
    // Runs when navigation is blocked or unblocked
    useEffect(() => {
        // If navigation is currently blocked:
        if (blocker && blocker.state === 'blocked') {
            // Idempotency guard — this effect re-runs whenever its deps change identity
            // (endGame / shouldWarnForPartialScore both change the moment endGame() resets
            // gameState/currentTrial/totalTrials), and on those re-runs `blocker` is still the
            // SAME stale 'blocked' object. Processing it twice fires a second endGame()+proceed(),
            // and that second proceed() hits an already-unblocked router →
            // "Invalid blocker state transition: unblocked -> proceeding". Handle each blocked
            // navigation object exactly once.
            if (handledBlockerRef.current === blocker) {
                return;
            }
            handledBlockerRef.current = blocker;
            pendingTransition.current = blocker; // Store the blocker object

            // --- Continuous Mode: chain has completed blocks → always confirm + save ---
            // Even a chain on its first block (with no completed blocks yet) should follow the
            // standard partial-score logic below; only chains with at least one full block
            // get the special "save chain" treatment.
            const chain = continuousChainRef?.current;
            const continuousHasData = chain?.isActive === true
                && chain?.chainCappedReason == null
                && Array.isArray(chain?.blocks)
                && chain.blocks.length >= 1;

            if (continuousHasData) {
                // Always confirm before saving + leaving — chain represents real training time.
                if (typeof pauseGame === 'function') {
                    pauseGame('navigation_block'); // Triggers modal
                } else {
                    // Fallback: just save and proceed.
                    // Guard proceed() with the live blocker state — calling it when the blocker is
                    // no longer 'blocked' throws "Invalid blocker state transition" (React Router contract).
                    if (typeof stopAndSaveContinuousChain === 'function') {
                        stopAndSaveContinuousChain().finally(() => { if (blocker.state === 'blocked') blocker.proceed(); });
                    } else {
                        if (blocker.state === 'blocked') blocker.proceed();
                    }
                }
                return;
            }

            // --- Standard session OR continuous chain with no full blocks: existing logic ---
            // Check if a warning is needed based on progress
            if (shouldWarnForPartialScore()) {
                // Pause the game specifically for navigation blocking
                if (typeof pauseGame === 'function') {
                    pauseGame('navigation_block'); // This pauseReason triggers the modal
                } else {
                    // Fallback if pause fails
                    console.error("[Blocker] pauseGame function not available!");
                    // blocker.proceed() is the sole navigator here — tell endGame not to also
                    // navigate, or the two competing history operations race (invalid-transition throw).
                    if (typeof endGame === 'function') endGame({ skipDiscardNavigate: true }); // End immediately
                    if (blocker.state === 'blocked') blocker.proceed(); // Allow navigation
                }
            } else {
                // No warning needed (e.g., early in the game), end the game immediately (likely discarding).
                // blocker.proceed() (below) is the single navigator for this back-press; pass
                // skipDiscardNavigate so endGame does NOT also queue its own navigate('/dashboard').
                if (typeof endGame === 'function') {
                    endGame({ skipDiscardNavigate: true }); // Call standard endGame (will likely discard if few trials done)
                } else {
                    console.error("[Blocker] endGame function not available!");
                }
                // Immediately allow navigation to proceed after initiating endGame.
                // Guard with the live blocker state per React Router's contract (proceed() is only legal from 'blocked').
                if (blocker.state === 'blocked') blocker.proceed();
            }
        } else if (blocker && (blocker.state === 'unblocked' || blocker.state === 'proceeding')) {
            // Blocker resolved (navigated or cancelled). Clear our markers so the NEXT real
            // block is processed fresh.
            handledBlockerRef.current = null;
            if (pendingTransition.current) {
                 pendingTransition.current = null;
            }
        }
        // NOTE: intentionally NO per-run cleanup here. The old cleanup called reset() on every
        // effect re-run using the stale 'blocked' snapshot, which cancelled an in-flight proceed().
        // Unmount-time release is handled by the separate empty-deps effect below.
    // Only depend on the blocker object itself and the functions it calls
    }, [blocker, pauseGame, endGame, shouldWarnForPartialScore, stopAndSaveContinuousChain]);

    // --- Release a still-pending navigation blocker ONLY on actual unmount ---
    // Kept separate (empty deps) so ordinary re-runs of the handler effect above never
    // reset()/cancel an in-flight navigation.
    useEffect(() => {
        return () => {
            const pending = pendingTransition.current;
            if (pending && pending.state === 'blocked') {
                pending.reset();
            }
            pendingTransition.current = null;
            handledBlockerRef.current = null;
        };
    }, []);


    // --- Confirmation Modal Handlers ---
    // Called when the user confirms leaving ("Leave Game" button)
    const handleConfirmBackNavigation = useCallback(async () => {
        // Continuous Mode: if a chain is active with completed blocks, save the chain
        // (capturing partial current block if ≥5 trials), then proceed navigation.
        const chain = continuousChainRef?.current;
        const continuousHasData = chain?.isActive === true
            && Array.isArray(chain?.blocks)
            && chain.blocks.length >= 1;

        if (continuousHasData && typeof stopAndSaveContinuousChain === 'function') {
            try {
                await stopAndSaveContinuousChain();
            } catch (err) {
                console.error("[ConfirmBackNav] Continuous chain save failed:", err);
            }
        } else if (typeof endGame === 'function') {
            // Standard flow: process results / partial save / discard as appropriate.
            endGame();
        } else {
            console.error("[ConfirmBackNav] endGame function not available!");
        }

        // Allow the originally blocked navigation to proceed.
        // Guard with the live state — proceed() is only legal from 'blocked' (React Router contract).
        if (pendingTransition.current) {
            if (pendingTransition.current.state === 'blocked') pendingTransition.current.proceed();
            pendingTransition.current = null;
        } else {
             console.warn("[ConfirmBackNav] No pending transition found to proceed with.");
        }
    }, [endGame, stopAndSaveContinuousChain]);

    // End handler used by the pause overlay's End button. Routes to the chain
    // save flow when a continuous chain is active, otherwise falls through to
    // the standard endGame. Lets a single control (pause → End) terminate
    // both regular and continuous sessions.
    const handleEndFromPause = useCallback(async () => {
        const chain = continuousChainRef?.current;
        if (chain?.isActive === true && typeof stopAndSaveContinuousChain === 'function') {
            try {
                await stopAndSaveContinuousChain();
            } catch (err) {
                console.error("[EndFromPause] Continuous chain save failed:", err);
            }
            return;
        }
        if (typeof endGame === 'function') {
            endGame();
        }
    }, [endGame, stopAndSaveContinuousChain]);

    // Called when the user cancels leaving ("Stay" button or closing the modal)
    const handleCancelBackNavigation = useCallback(() => {
        // 1. Hide the modal by clearing the specific pause reason
        if (typeof clearPauseReason === 'function') {
             clearPauseReason();
        } else {
            console.error("[CancelBackNav] clearPauseReason function not available!");
        }
        // 2. Cancel the blocked navigation attempt.
        // Guard with the live state — reset() is only legal from 'blocked' (React Router contract).
        if (pendingTransition.current) {
            if (pendingTransition.current.state === 'blocked') pendingTransition.current.reset();
            pendingTransition.current = null; // Clear the stored transition
        } else {
             console.warn("[CancelBackNav] No pending transition found to reset.");
        }
        // 3. Resume the game automatically since the user chose to stay
        if (typeof resumeGame === 'function') {
            resumeGame(); // Resume game from paused state
        } else {
             console.error("[CancelBackNav] resumeGame function not available!");
        }
    }, [clearPauseReason, resumeGame]); // Dependencies: clearPauseReason and resumeGame actions


    // --- Effect for Idle State Redirect ---
    // Redirects away from GameScreen if game state becomes idle unexpectedly.
    // On refresh, checks sessionStorage for a recoverable session and restores it from Firestore.
    useEffect(() => {
        const shouldRedirect =
            gameState === 'idle' &&
            !isGlobalLoading &&
            currentTrial === -1 &&
            !gameResults;

        if (shouldRedirect) {
            const savedSessionId = (() => { try { return sessionStorage.getItem('lastResultsSessionId'); } catch(e) { return null; } })();
            if (savedSessionId && userId && !isRecoveringSession) {
                setIsRecoveringSession(true);
                const sessionRef = doc(db, 'users', userId, 'sessions', savedSessionId);
                getDoc(sessionRef).then(snap => {
                    if (snap.exists()) {
                        const recovered = mapSessionDocToGameResults(snap.id, snap.data());
                        recoverSession(recovered);
                    } else {
                        try { sessionStorage.removeItem('lastResultsSessionId'); } catch(e) {}
                        navigate(gameOriginRef.current || '/dashboard', { replace: true });
                    }
                }).catch((err) => {
                    console.error("[GameScreen Effect] Failed to recover session:", err);
                    try { sessionStorage.removeItem('lastResultsSessionId'); } catch(e) {}
                    navigate(gameOriginRef.current || '/dashboard', { replace: true });
                }).finally(() => setIsRecoveringSession(false));
            } else if (!isRecoveringSession) {
                setTimeout(() => navigate(gameOriginRef.current || '/dashboard', { replace: true }), 0);
            }
        } else {
            if (isScreenLoading) setIsScreenLoading(false);
        }
    }, [gameState, navigate, isGlobalLoading, currentTrial, gameResults, isScreenLoading, userId, isRecoveringSession, recoverSession]);


    // --- Callbacks for Countdown Component ---
    // Triggered when countdown finishes
    const handleCountdownComplete = useCallback(() => {
        if (playAfterCountdown && typeof playAfterCountdown === 'function') {
            trackEvent('game_start', { game_mode: gameMode, n_back_level: nBack, difficulty });
            playAfterCountdown();
        } else {
            console.error("[GameScreen] playAfterCountdown missing or not a function!");
        }
    }, [playAfterCountdown, gameMode, nBack, difficulty]);

    // Triggered if user cancels countdown
    const handleCancelCountdown = useCallback(() => {
        if (cancelPreparation && typeof cancelPreparation === 'function') {
            cancelPreparation();
        } else {
            console.error("[GameScreen] cancelPreparation missing or not a function!");
            navigate(gameOriginRef.current || '/dashboard', { replace: true });
        }
    }, [cancelPreparation, navigate]);


    // --- Rendering Logic ---

    // Show loading screen during initial mount, transitions, or session recovery
    if (isScreenLoading || isRecoveringSession) {
        return <LoadingScreen message={isRecoveringSession ? "Loading results..." : "Initializing Game..."} theme="auto" />;
    }

    // *** Determine Overlay Visibility ***
    // Should the standard "Game Paused" overlay be shown?
    const showStandardPauseOverlay = gameState === 'paused' && pauseReason !== 'navigation_block';
    // Should the "Leave Game?" confirmation modal be shown?
    const showConfirmationModal = pauseReason === 'navigation_block';
    // Is *any* overlay currently visible? (Used to dim underlying content)
    const isOverlayVisible = showStandardPauseOverlay || showConfirmationModal;

    // Determine the main content component based on the gameState
    let content;
    switch (gameState) {
        case 'loading':
            // Show loading screen while sequence is being generated
            content = <LoadingScreen message="Generating sequence..." theme="auto" />;
            break;

        case 'preparing':
            if (healthSafety.loading) {
                // Brief gap while we check for an existing acknowledgment.
                content = <LoadingScreen message="Preparing session..." theme="auto" />;
            } else if (healthSafety.needsAck && healthSafety.notice) {
                // First-session acknowledgment gate. Declining cancels the preparation
                // and returns the user to the screen they started from.
                content = (
                    <HealthSafetyNoticeModal
                        isOpen={true}
                        notice={healthSafety.notice}
                        isFirstSession={healthSafety.isFirstSession}
                        onAffirm={healthSafety.acknowledge}
                        onDecline={() => {
                            healthSafety.decline();
                            handleCancelCountdown();
                        }}
                        onShown={() => trackEvent('health_safety_notice_shown', {
                            notice_version: healthSafety.notice.version,
                            is_first_session: healthSafety.isFirstSession,
                        })}
                        onLinkClicked={(link) => trackEvent('health_safety_notice_link_clicked', {
                            notice_version: healthSafety.notice.version,
                            link,
                        })}
                    />
                );
            } else {
                // GameCountdown is rendered directly, already covers full screen
                content = (
                    <GameCountdown
                        onComplete={handleCountdownComplete}
                        onCancel={handleCancelCountdown}
                        nBack={nBack}
                        difficulty={difficulty}
                        gameMode={gameMode}
                        isDynamic={rawGameMode === 'dynamic'}
                        trainingMode={trainingMode}
                    />
                );
            }
            break;

        case 'playing':
        case 'paused':
            // Guard against rendering before essential game data is loaded
            if (currentTrial < 0 || totalTrials <= 0 || !Array.isArray(sequence) || sequence.length === 0) {
                 content = <LoadingScreen message="Starting Game..." theme="auto" />;
            } else {
                // Render the main gameplay screen component
                content = (
                    <GamePlayingScreen
                        // Pass necessary props from context and state
                        nBack={nBack} difficulty={difficulty} sequence={sequence}
                        currentTrial={currentTrial} totalTrials={totalTrials} gameState={gameState}
                        gameMode={gameMode} // Pass game mode
                        positionFeedback={positionFeedback} audioFeedback={audioFeedback}
                        colorFeedback={colorFeedback} shapeFeedback={shapeFeedback} // Color/Shape feedback
                        recallFeedback={recallFeedback} recallSelectedColor={recallSelectedColor} // Recall pad state
                        missedMatchTrial={missedMatchTrial} visualResponseTrials={visualResponseTrials}
                        audioResponseTrials={audioResponseTrials}
                        handlePositionResponse={handlePositionResponse} handleAudioResponse={handleAudioResponse}
                        handleColorResponse={handleColorResponse} handleShapeResponse={handleShapeResponse} // Color/Shape handlers
                        handleColorRecallSelect={handleColorRecallSelect} // Recall selection handler
                        handlePauseResume={handlePauseResume} // Pass handler used by header button
                        // resumeGame & endGame are NOT passed here anymore; used directly by GamePaused below
                        getStimulusDuration={getStimulusDuration}
                        instantFeedbackIsEnabled={getInstantFeedbackEnabled ? getInstantFeedbackEnabled() : true}
                        renderControls={true} logReplayEvent={logReplayEvent}
                        trainingMode={trainingMode}
                        // *** Pass the calculated overlay visibility flag ***
                        isOverlayVisible={isOverlayVisible}
                    />
                );
            }
            break;

        case 'results':
             // Guard against rendering results if data is missing
             if (!gameResults) {
                 console.error("[GameScreen Render] gameState 'results' but gameResults state is null. This may indicate a race condition or backend error. Navigating dashboard.");
                 setTimeout(() => navigate('/dashboard', { replace: true }), 0);
                 content = <LoadingScreen message="Error loading results..." theme="auto" />;
             } else if (gameResults.chainSummary || gameResults.mode === 'continuous') {
                 // Render the chain-aware results page for Continuous Mode sessions.
                 // chainSummary signals new per-block storage; the legacy mode === 'continuous'
                 // check still catches any old test sessions saved under the original schema.
                 // "Start Another Session" reopens the pre-start modal pre-filled with the
                 // previous chain length — not a silent restart.
                 content = (
                    <ContinuousResults
                        gameResults={gameResults}
                        onDashboard={handleGoToDashboard}
                        onStartNextSession={handleOpenAnotherChain}
                        onNavigate={navigate}
                    />
                 );
             } else {
                 // Render the standard results display for normal sessions
                content = (
                    <GameResults
                        gameResults={gameResults}
                        getFeatureIntroMessage={null} // Pass if needed
                        onDashboard={handleGoToDashboard}
                        onRetryLevel={handleRetryLevel}
                        onStartNextSession={handleStartNextSession}
                        resetResponses={resetResponses} // Combined reset function
                        onNavigate={navigate}
                    />
                );
             }
            break;

        case 'idle':
        default:
            // Default state, usually waiting for the redirect effect
            content = <LoadingScreen message="Loading dashboard..." theme="auto" />;
            break;
    }

    // --- Final Component Return ---
    // Render the determined main content, and conditionally render overlays on top
    // data-game-active prevents auto-refresh during gameplay
    return (
        <div
            ref={cursorContainerRef}
            data-game-active={gameState === 'playing' || gameState === 'countdown' || gameState === 'paused'}
            className={cursorHidden ? 'cursor-hidden' : ''}
        >
            {/* Render the main component determined by the switch statement */}
            {content}

            {/* *** Conditionally render GamePaused overlay HERE *** */}
            {/* Rendered outside 'content', allowing full screen coverage */}
            {/* Shown only when game is paused for reasons OTHER than navigation block */}
            {showStandardPauseOverlay && (
              <GamePaused
                onResume={resumeGame}            // Pass the resumeGame action from context
                onEndGame={handleEndFromPause}   // Smart end: chain save for continuous, else endGame
                gameMode={gameMode}              // Controls which keybind rows to show
              />
            )}

            {/* Confirmation Modal for intercepted navigation attempts.
                Copy + button text adapt to continuous-chain state: when a chain has
                completed blocks, leaving will save the chain (not just discard). */}
            {(() => {
                const chain = continuousChainRef?.current;
                const continuousHasData = chain?.isActive === true
                    && Array.isArray(chain?.blocks)
                    && chain.blocks.length >= 1;
                return (
                    <ConfirmationModal
                        isOpen={showConfirmationModal}
                        onClose={handleCancelBackNavigation}
                        onConfirm={handleConfirmBackNavigation}
                        title={continuousHasData ? "End continuous chain?" : "Leave Game Session?"}
                        confirmText={continuousHasData ? "Save & Leave" : "Leave Game"}
                        cancelText="Stay"
                        confirmColor="red"
                        isDestructive={true}
                    >
                        {continuousHasData ? (
                            <>
                                <p className="text-sm text-gray-600">
                                    Your continuous chain ({chain.blocks.length} block{chain.blocks.length === 1 ? '' : 's'} completed) will be saved before you leave.
                                </p>
                                <p className="text-sm text-gray-600 mt-2">
                                    Stats and progression will reflect this chain. You can start another any time.
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-gray-600">
                                    Navigating away will end your current game session.
                                </p>
                                <p className="text-sm text-gray-600 mt-2">
                                    You have completed enough trials to receive partial scoring if you leave now.
                                </p>
                                <p className="text-sm text-gray-600 mt-3 font-medium">
                                    Are you sure you want to leave?
                                </p>
                            </>
                        )}
                    </ConfirmationModal>
                );
            })()}

            {/* Render the Feedback Button only when paused (position is fixed) */}
            {gameState === 'paused' && <FeedbackButton />}

            {/* "Start Another Session" modal — reuses the pre-start modal,
                pre-filled with the previous chain's session count. */}
            <ContinuousModeStartModal
                isOpen={newChainModal !== null}
                mode={newChainModal?.mode}
                defaultSessionCount={newChainModal?.defaultSessionCount}
                overrideLevelLabel={newChainModal?.overrideLevelLabel}
                capRemaining={(newChainModal?.mode === 'adaptive' && !isFullAdaptive)
                    ? Math.max(0, DAILY_ADAPTIVE_CAP - dailyAdaptiveUsedToday)
                    : null}
                onClose={handleCloseNewChainModal}
                onConfirm={handleConfirmNewChain}
            />
        </div>
    );
};

export default GameScreen;
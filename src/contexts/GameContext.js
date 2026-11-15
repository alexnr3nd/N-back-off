/* src/contexts/GameContext.js */
import React, {
    createContext,
    useState,
    useContext,
    useEffect,
    useRef,
    useCallback,
    useMemo
} from 'react';
import { useUser } from './UserContext';
import { useSettings } from './SettingsContext';
import { DYNAMIC_SUB_MODE_ORDER, GAME_MODES } from '../constants/gameConstants';
import audioManager from '../utils/audioManager';
import { isAndroid } from '../utils/platform';
import { createGameActions } from './game/gameActions';
import { createGameSetupActions } from './game/gameSetup';
import { useColorPreferences, useResolvedTheme } from './ColorPreferencesContext';
import { computePaletteFingerprint } from '../constants/colorPresets';
import { createEndGameAction } from './game/gameEnd';
import { getSequenceLanguage } from '../utils/sequenceLanguage';
import { createGameGetters } from './game/gameGetters';
import { createLogReplayEvent } from './game/replayUtils';
import {
    makeEmptyChainState,
    startChain as startContinuousChainState,
    captureBlock as captureContinuousBlock,
    computeBlockDprime,
    shouldCapChain,
    shouldCompleteChain,
    capChain,
    resetChain as resetContinuousChain,
    assembleSingleBlockPayload,
    resolveChainTrainingMode,
    resolveNextBlockLevel,
} from './game/continuousMode';
import { decideChainEndSubModeRotation } from './game/dynamicChainRotation';
import { calculateAndSaveResultsCall, generateSequenceHttp, isFetchNetworkError, isAuthError, isAppCheckAttestationError } from './game/gameCloudFunctions';
import { enqueue as enqueueOfflineSave } from '../utils/offlineSaveQueue';
import { holdRecoveryReload } from '../utils/appCheckHealth';
import { useLoading } from './LoadingContext';
import { functions, db, auth } from '../firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { CONTINUOUS_RANGES, DPRIME_THRESHOLDS_INTERPRETATION, DAILY_ADAPTIVE_CAP, CLASSIC_FIXED_DIFFICULTY } from '../constants/gameConstants';
import { useDailyCapStatus } from '../hooks/useDailyCapStatus';

// Initialize notification cloud functions
let updateNotificationPreferencesFn = null;
let getNotificationPreferencesFn = null;
let sendTestReminderEmailFn = null;
try {
    if (functions) {
        updateNotificationPreferencesFn = httpsCallable(functions, 'updateNotificationPreferences');
        getNotificationPreferencesFn = httpsCallable(functions, 'getNotificationPreferences');
        sendTestReminderEmailFn = httpsCallable(functions, 'sendTestReminderEmail');

        // Expose test functions to console only in development
        if (process.env.NODE_ENV === 'development') {
            // Usage: window.testEmail('default') or window.testEmail('multi-mode')
            // Variants: 'default', 'free-exhausted', 'premium', 'no-chart', 'no-streak', 'fresh-start', 'multi-mode', 'high-volume', 'power-user'
            window.testEmail = async (variant = 'default') => {
                try {
                    const result = await sendTestReminderEmailFn({ variant });
                    console.log(`✓ Test email (${variant}) sent to:`, result.data?.sentTo);
                    return result.data;
                } catch (error) {
                    console.error(`✗ Failed to send test email (${variant}):`, error.message);
                    throw error;
                }
            };
            window.testAllEmails = async () => {
                const variants = ['default', 'free-exhausted', 'premium', 'no-chart', 'no-streak', 'fresh-start', 'multi-mode', 'high-volume', 'power-user'];
                console.log('Sending all email variants...');
                for (const variant of variants) {
                    await window.testEmail(variant);
                }
                console.log('All test emails sent!');
            };
        }
    }
} catch (error) {
    console.error("GameContext: Error initializing notification functions:", error);
}

export const GameContext = createContext(null);

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) { throw new Error('useGame must be used within a GameProvider'); }
    return context;
};

/**
 * Fetch the user's most-recent saved session's dynamic thresholds for use in
 * client-side determineProgression during continuous chains. Returns null if no
 * prior session exists or thresholds are missing — caller falls back to static
 * DPRIME_THRESHOLDS_INTERPRETATION.
 */
async function fetchLatestDynamicThresholds(userId) {
    if (!userId) return null;
    try {
        const sessionsRef = collection(db, 'users', userId, 'sessions');
        const q = query(sessionsRef, orderBy('recordedAt', 'desc'), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        const data = snap.docs[0].data();
        if (typeof data.excellentThreshold !== 'number'
            || typeof data.goodThreshold !== 'number'
            || typeof data.fairThreshold !== 'number') {
            return null;
        }
        return {
            excellentThreshold: data.excellentThreshold,
            goodThreshold: data.goodThreshold,
            fairThreshold: data.fairThreshold,
        };
    } catch (err) {
        console.warn('[Continuous] fetchLatestDynamicThresholds failed:', err?.message || err);
        return null;
    }
}

/**
 * Static fallback when no per-user dynamic thresholds are available. Mirrors
 * the server fallback in functions/progressionLogic.js (snapToFreeTierDifficulty).
 */
function getStaticThresholdsFallback() {
    return {
        excellentThreshold: DPRIME_THRESHOLDS_INTERPRETATION.EXCELLENT,
        goodThreshold: DPRIME_THRESHOLDS_INTERPRETATION.GOOD,
        fairThreshold: DPRIME_THRESHOLDS_INTERPRETATION.FAIR,
    };
}

// Helper function for NEW weighted random ISI variability
function getWeightedRandomVariability(maxOffset) {
    // If maxOffset is 0 (e.g., for difficulties below N.60),
    // no variability should be added.
    if (maxOffset <= 0) {
        return 0;
    }

    const probRoll = Math.random(); // Random number between 0.0 (inclusive) and 1.0 (exclusive)

    // Define probabilities for each bucket
    const probZeroAdded = 0.55;       // 55% chance of 0ms added variability
    const probMaxRangeTarget = 0.10;  // Target 10% chance for the "max variability" bucket
    // The probMidRange is implicitly 1.0 - probZeroAdded - probMaxRangeTarget = 0.35

    let selectedRandomMs;

    // Bucket 1: Zero Added Variability (55% chance)
    if (probRoll < probZeroAdded) { // True for probRoll in [0, 0.55)
        selectedRandomMs = 0;
    }
    // Bucket 2: Maximum Added Variability Range (next 10% chance)
    // True for probRoll in [0.55, 0.65)
    else if (probRoll < probZeroAdded + probMaxRangeTarget) { 
        // Value from the upper 25% of maxOffset
        const upperRangeStart = maxOffset * 0.75;
        // Ensure the range has some width, especially if maxOffset is small
        // If maxOffset is 1, 2, or 3, then 0.75*maxOffset will be < maxOffset, so the range (maxOffset - upperRangeStart) will be > 0
        // If maxOffset is 0, we already returned.
        if (upperRangeStart >= maxOffset) { 
             // This edge case occurs if maxOffset is extremely small (e.g., < 4ms such that 0.75*maxOffset rounds up to maxOffset)
             // or if maxOffset itself is 0 (though handled at the start).
             // To ensure some variability if maxOffset > 0, just return maxOffset.
            selectedRandomMs = maxOffset;
        } else {
            selectedRandomMs = upperRangeStart + (Math.random() * (maxOffset - upperRangeStart));
        }
    }
    // Bucket 3: Medium Added Variability (remaining 35% chance)
    // True for probRoll in [0.65, 1.0)
    else {
        // Value from 1ms up to (but not including) the start of the "Maximum Added" range (0.75 * maxOffset)
        const midRangeExclusiveEnd = maxOffset * 0.75;

        if (midRangeExclusiveEnd <= 1) { 
            // If 75% of maxOffset is 1ms or less, it's hard to get a varied random number
            // that isn't 0 (already handled) or exactly 1.
            // If maxOffset itself is > 0 (guaranteed by the first check in this function), let's just return 1ms.
            selectedRandomMs = 1;
        } else {
            // We want a random number in [1, midRangeExclusiveEnd).
            // Math.random() * (range_size) gives [0, range_size)
            // range_size = midRangeExclusiveEnd - 1
            // So, 1 + (Math.random() * (midRangeExclusiveEnd - 1)) gives [1, midRangeExclusiveEnd)
            selectedRandomMs = 1 + (Math.random() * (midRangeExclusiveEnd - 1));
        }
    }

    return Math.floor(selectedRandomMs);
}


export const GameProvider = ({ children }) => {
    // --- State Definitions ---
    const [gameState, setGameState] = useState('idle');
    const [pauseReason, setPauseReason] = useState(null);
    const [nBack, setNBack] = useState(2);
    const [difficulty, setDifficulty] = useState(0.0);
    const [sequence, setSequence] = useState([]);
    const [currentTrial, setCurrentTrial] = useState(-1);
    const [totalTrials, setTotalTrials] = useState(0);
    const [gameResults, setGameResults] = useState(null);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    // Why a second channel: feedbackMessage carries in-game and post-session text too —
    // gameEnd writes the raw backend error into it when a save is queued offline — so the
    // dashboard's start-failure notice would otherwise surface SDK strings from a save
    // that happened minutes earlier. Only startGameLogic writes this one.
    const [startFailureMessage, setStartFailureMessage] = useState('');
    const [consecutiveSuccesses, setConsecutiveSuccesses] = useState(0);
    const [showCountdown, setShowCountdown] = useState(false);
    const [saveToProfile, setSaveToProfile] = useState(true);
    const [isCountdownVisuallyComplete, setIsCountdownVisuallyComplete] = useState(false);
    const [hasNotificationsEnabled, setHasNotificationsEnabled] = useState(false);

    // --- Refs ---
    const visualMatchesRef = useRef([]);
    const audioMatchesRef = useRef([]);
    const colorMatchesRef = useRef([]); // NEW: for triple/quad
    const shapeMatchesRef = useRef([]); // NEW: for quad
    const visualResponsesRef = useRef([]);
    const audioResponsesRef = useRef([]);
    const colorResponsesRef = useRef([]); // NEW: for triple/quad
    const shapeResponsesRef = useRef([]); // NEW: for quad
    // Recall Mode (singleColorRecall): map of trialIndex -> selected color name.
    // An object (not an array) so "already answered this trial" is a cheap key lookup,
    // and so blank trials stay absent rather than being holes in a sparse array.
    const colorRecallSelectionsRef = useRef({});
    const timerRef = useRef(null);
    const isEndingRef = useRef(false);
    const sessionSettingsRef = useRef(null);
    const replayEventsRef = useRef([]);
    const sessionStartTimeRef = useRef(null);
    const onNavigateRef = useRef(null);
    const latestGameStateRef = useRef(gameState);
    const currentTrialRef = useRef(currentTrial);
    const totalTrialsRef = useRef(totalTrials);
    const nBackRef = useRef(nBack);
    const difficultyRef = useRef(difficulty);
    const consecutiveSuccessesRef = useRef(consecutiveSuccesses);
    const audioTriggeredForTrial = useRef(-1);
    const stimulusOnsetTimeRef = useRef({});  // { trialIndex: timestamp } for RT calculation
    const checkLastTrialMissedFeedbackRef = useRef(null); // Function from useGameResponses to check/show last trial missed feedback
    const resetResponsesRef = useRef(null); // Function from useGameResponses to clear per-trial response tracking on continuous block transitions
    const gameOriginRef = useRef('/dashboard'); // Tracks where the user started the game from
    // Continuous-mode chain state (mutable; checked at every block boundary)
    const continuousChainRef = useRef(makeEmptyChainState());
    // Per-chain serialized save queue. Each completed block enqueues its save here so the
    // backend processes them in chain order (no progression race) while gameplay continues
    // immediately. Initialized to a resolved promise; reset on chain start/end.
    const chainSaveQueueRef = useRef(Promise.resolve());
    // SessionIds returned from per-block saves, in chain order. Used to build the chain summary
    // shown on the results screen at chain end (frontend-built; backend no longer returns one).
    const chainBlockSessionIdsRef = useRef([]);
    // Per-block save error tracking (for non-network errors). Network errors fall into the
    // existing offlineSaveQueue. Non-network errors logged here for surfacing if needed.
    const chainBlockSaveErrorsRef = useRef([]);
    // Per-block metrics returned by the backend (one entry per successful save). Used to
    // build the chain results screen's chainSummary at chain end (replacing what the
    // batch save's chainSummaryForResponse used to provide).
    const chainBlockMetricsRef = useRef([]);
    // Most recent per-block save response — gives us latest progression (newNBack/newDifficulty)
    // and global session count for the chain results screen.
    const chainLastSaveResponseRef = useRef(null);
    // --- Daily Adaptive cap bookkeeping for chains (capped cohorts only) ---
    // Held in refs, never in the block-end callback's deps: handleContinuousBlockEnd is a
    // dependency of the trial timer effect, so a changing dep would clear and reschedule
    // the timer mid-block.
    // Server-authoritative count of Adaptive sessions used today, seeded at chain start
    // from the client cap status and then advanced by each per-block save response.
    const chainDailyUsedRef = useRef(0);
    // Adaptive block saves that have been enqueued but whose response hasn't landed yet.
    // Added to chainDailyUsedRef so the boundary check counts the in-flight block.
    const chainPendingAdaptiveSavesRef = useRef(0);
    // Set when the chain must stop because the daily cap is (or is about to be) exhausted.
    // Client-only: it flags the results summary and never reaches a save payload.
    const chainEndedByDailyCapRef = useRef(false);

    // --- External Contexts ---
    const { userId, activeProfileId, isDataReady, getCurrentModeProgression, getClassicModeProgression, updateProfileProgress, addLocalSession, subscriptionTier, coachGrantedPremium, activeGameMode, setTotalSessions, setDailyAdaptiveCount, setShowDailyCapModal, setDailyCapInfo, validateAuthToken } = useUser();
    const { settings } = useSettings(); // settings is available here
    // The sequence "language" (backend letter-set key AND sequence-cache key component).
    // Derived once, as a plain string, so downstream memos depend on the VALUE rather than
    // on the settings object identity. See src/utils/sequenceLanguage.js.
    const sequenceLanguage = useMemo(() => getSequenceLanguage(settings), [settings?.selectedVoiceId]); // eslint-disable-line react-hooks/exhaustive-deps
    const { paletteId: colorPaletteId, resolvedPalette: colorPalette } = useColorPreferences();
    const colorThemeAtPlayTime = useResolvedTheme();
    const colorPaletteFingerprint = useMemo(
        () => computePaletteFingerprint(colorPalette),
        [colorPalette]
    );
    const { showLoading, hideLoading } = useLoading();
    // Daily Adaptive cap status, mirrored into a ref so chain code can read it without
    // taking a render-scoped dependency (see chainDailyUsedRef note above).
    const { isCappedCohort, used: dailyAdaptiveUsedToday } = useDailyCapStatus();
    const dailyCapStatusRef = useRef({ isCappedCohort: false, used: 0 });
    useEffect(() => {
        dailyCapStatusRef.current = { isCappedCohort, used: dailyAdaptiveUsedToday };
    }, [isCappedCohort, dailyAdaptiveUsedToday]);

    // Build a profile-like object for sub-modules (gameSetup, gameEnd) that still expect the old interface
    // This provides mode-specific progression values with userId as the id
    const modeProgressionData = useMemo(() => {
        if (!isDataReady || !activeProfileId) return null;
        const modeProgress = getCurrentModeProgression();
        return {
            id: activeProfileId,
            currentNBack: modeProgress.currentNBack,
            currentDifficulty: modeProgress.currentDifficulty,
            consecutiveSuccesses: modeProgress.consecutiveSuccesses,
            promotionCredits: modeProgress.promotionCredits || 0,
            highestNBack: modeProgress.highestNBack,
            previousNBackLevelDifficulties: modeProgress.previousNBackLevelDifficulties || {},
            currentSubMode: modeProgress.currentSubMode,
            // Recall Mode: the 'singleColorRecall' progression track, carried alongside
            // the active mode's numbers. gameSetup decides WHEN to use it (singleColor +
            // the Recall response-mode setting, outside continuous chains); this just
            // makes the track reachable from the profile-shaped object those modules take.
            recallProgression: getCurrentModeProgression('singleColorRecall'),
        };
    }, [isDataReady, activeProfileId, getCurrentModeProgression]);

    // --- Initialization Effects ---
    useEffect(() => { audioManager.init(); }, []);

    // Prefetch a sequence for the user's current state when data is ready
    useEffect(() => {
        if (isDataReady && modeProgressionData && settings?.selectedVoiceId) {
            import('../utils/sequencePrefetcher').then(({ prefetchForCurrentState }) => {
                prefetchForCurrentState(modeProgressionData, settings, activeGameMode, userId);
            }).catch(() => {});
        }
        // Recall deps mirror the Match ones: under Recall the prefetch targets the
        // recall track's level, and toggling the response mode must re-fire this.
    }, [isDataReady, modeProgressionData?.currentNBack, modeProgressionData?.currentDifficulty,
        modeProgressionData?.recallProgression?.currentNBack, modeProgressionData?.recallProgression?.currentDifficulty,
        settings?.responseModes?.singleColor, activeGameMode]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Ref Sync Effects ---
    useEffect(() => { latestGameStateRef.current = gameState; }, [gameState]);
    useEffect(() => { currentTrialRef.current = currentTrial; }, [currentTrial]);
    useEffect(() => { totalTrialsRef.current = totalTrials; }, [totalTrials]);
    useEffect(() => { nBackRef.current = nBack; }, [nBack]);
    useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);
    useEffect(() => { consecutiveSuccessesRef.current = consecutiveSuccesses; }, [consecutiveSuccesses]);

    // --- Replay Logging Action ---
    const logReplayEvent = useCallback(createLogReplayEvent(replayEventsRef), [replayEventsRef]);

    // --- Memoized Action Logics (Created via Factory Functions) ---
    const {
        pauseGameLogic, resumeGameLogic, clearPauseReasonLogic,
        playAfterCountdownLogic, registerResponseLogic,
        setManualSettingsLogic, resetContextResponseArraysLogic
    } = useMemo(() => createGameActions({
        setGameState, setNBack, setDifficulty, setSaveToProfile, setCurrentTrial,
        setShowCountdown, setIsCountdownVisuallyComplete, setPauseReason,
        latestGameStateRef, visualResponsesRef, audioResponsesRef,
        colorResponsesRef, shapeResponsesRef, // Color/shape response refs (triple/quad modes)
        colorRecallSelectionsRef, // Recall Mode selections (singleColorRecall)
        logReplayEvent,
        timerRef, sessionStartTimeRef, isEndingRef, audioManager
    }), [
        logReplayEvent, setGameState, setNBack, setDifficulty, setSaveToProfile,
        setCurrentTrial, setShowCountdown, setIsCountdownVisuallyComplete, setPauseReason
    ]);

    const startCountdown = useCallback(({ skipCountdown = false } = {}) => {
         // Android Bluetooth fix: if the app was foregrounded since the last game
         // (the audio output device may have changed), rebuild the AudioContext on
         // the current output device BEFORE resume(), so the session routes to
         // connected Bluetooth headphones. No-op on web/iOS and when not flagged.
         // See memory/project_bluetooth_audio_routing_bug.md.
         if (isAndroid()) audioManager.recreateForOutputChange();
         audioManager.resume().then(async resumed => {
            if (resumed) {
                setPauseReason(null); setFeedbackMessage('');
                audioTriggeredForTrial.current = -1;
                const d = modeProgressionData?.currentDifficulty;
                const voice = settings?.selectedVoiceId;
                const actualD = d ?? 0.0;
                const difficultySeedForPreload = Math.max(0, Math.min(1.0, actualD));
                // Skip audio preload for modes that have no audio modality
                // (singleVisual, singleColor, singleShape) — no letters to load.
                const modalities = GAME_MODES[activeGameMode]?.modalities;
                const modeHasAudio = !modalities || modalities.includes('audio');
                if (skipCountdown) {
                    // Bypass visual countdown — used when launching from results-page
                    // Continue/Retry. Await the preload so the first audio stimulus
                    // isn't silent on Capacitor Android WebView cold-start, then go
                    // directly loading → playing (skipping the 'preparing' state so
                    // GameCountdown never renders).
                    setShowCountdown(false);
                    if (modeHasAudio && voice) {
                        try {
                            await audioManager.preload({ difficulties: [difficultySeedForPreload], voiceId: voice });
                        } catch (err) {
                            console.warn("[GameContext->startCountdown] Audio preload failed; proceeding anyway.", err);
                        }
                    } else if (modeHasAudio && !voice) {
                        console.warn("[GameContext->startCountdown] Cannot preload audio: No voice selected.");
                    }
                    // Wake the OS audio output device so the first stimulus isn't
                    // clipped. The standard countdown path warms it incidentally via
                    // playCountdownSound beeps; the skip path has no audible output
                    // before the first letter. Android pauses the audio output
                    // stream during the silent results-page gap (power saving), and
                    // a SILENT buffer does not re-acquire it — only real audible
                    // output does. warmUpTone() plays a soft ~600Hz tone that
                    // absorbs the device's cold-start warm-up and stays active
                    // through the first letter (its ~0.4s duration overlaps the
                    // ~250ms initialDelayMs), so the output is hot at letter onset.
                    // Fire-and-forget and untracked — it mixes with, and is not cut
                    // by, the first playItem.
                    if (modeHasAudio) {
                        audioManager.warmUp();
                    }
                    // Initialize session-start state that the gameState==='preparing'
                    // useEffect (line ~1155) would have set. That effect is gated on
                    // 'preparing', which this branch bypasses, so without this block
                    // sessionStartTimeRef.current stays null and gameEnd aborts at the
                    // refs check ("Missing critical session refs/state").
                    sessionStartTimeRef.current = Date.now();
                    stimulusOnsetTimeRef.current = {};
                    logReplayEvent({ type: 'gameStart', timestamp: sessionStartTimeRef.current });
                    setCurrentTrial(-1);
                    setIsCountdownVisuallyComplete(true);
                    setGameState('playing');
                } else {
                    setGameState('preparing');
                    setShowCountdown(true); setIsCountdownVisuallyComplete(false);
                    if (!modeHasAudio) {
                        // No-op: this mode doesn't use audio stimuli.
                    } else if (voice) {
                        audioManager.preload({ difficulties: [difficultySeedForPreload], voiceId: voice });
                    } else {
                        console.warn("[GameContext->startCountdown] Cannot preload audio: No voice selected.");
                    }
                }
            } else {
                 console.error("[GameContext->startCountdown] Failed to resume audio context.");
                 setFeedbackMessage("Audio could not be started. Please click anywhere on the page or try again.");
            }
        });
    }, [
        setGameState, setPauseReason, setFeedbackMessage, setShowCountdown, setIsCountdownVisuallyComplete,
        setCurrentTrial, logReplayEvent,
        modeProgressionData, settings, activeGameMode
    ]);

    // Fetch notification preferences on mount to check if already enabled
    useEffect(() => {
        const fetchNotificationStatus = async () => {
            if (!getNotificationPreferencesFn || !isDataReady) return;
            try {
                const result = await getNotificationPreferencesFn();
                if (result.data) {
                    setHasNotificationsEnabled(result.data.enabled ?? false);
                }
            } catch (error) {
                console.error("[GameContext] Error fetching notification preferences:", error);
            }
        };
        fetchNotificationStatus();
    }, [isDataReady]);

    // Clean up showUpgrade URL parameter if present (legacy from old session limit flow)
    useEffect(() => {
        if (!isDataReady) return;
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('showUpgrade') === 'true' && window.location.pathname.startsWith('/dashboard')) {
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [isDataReady]);

    // Handler for notification opt-in
    const handleNotificationOptIn = useCallback(async (preferences) => {
        if (!updateNotificationPreferencesFn) {
            console.error("[GameContext] Notification function not available");
            return;
        }
        try {
            await updateNotificationPreferencesFn(preferences);
            setHasNotificationsEnabled(true);

            // TEST MODE: If ?testSessionLimit=true is in URL, also send a test email immediately
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('testSessionLimit') === 'true' && sendTestReminderEmailFn) {
                try {
                    await sendTestReminderEmailFn();
                } catch (emailError) {
                    console.error("[GameContext] TEST MODE: Failed to send test email:", emailError);
                }
            }
        } catch (error) {
            console.error("[GameContext] Error opting in to notifications:", error);
        }
    }, []);

    const { startGameLogic, cancelPreparationLogic } = useMemo(() => createGameSetupActions({
        activeProfile: modeProgressionData, // Pass mode-specific data as activeProfile for backward compat
        settings,
        saveToProfileState: saveToProfile,
        activeGameMode, // Pass game mode for sequence generation
        setGameState, setNBack, setDifficulty, setSequence, setCurrentTrial,
        setTotalTrials, setGameResults, setFeedbackMessage,
        setStartFailureMessage, // Dedicated channel the dashboard's StartFailureNotice reads
        setSaveToProfile, startCountdown,
        setConsecutiveSuccesses, setShowCountdown, setIsCountdownVisuallyComplete, setPauseReason,
        timerRef, isEndingRef, visualResponsesRef, audioResponsesRef, visualMatchesRef,
        audioMatchesRef, colorMatchesRef, shapeMatchesRef, // Add color/shape match refs
        colorResponsesRef, shapeResponsesRef, // Color/shape response refs (triple/quad modes)
        colorRecallSelectionsRef, // Recall Mode selections (singleColorRecall)
        sessionSettingsRef, replayEventsRef, sessionStartTimeRef,
        onNavigateRef, latestGameStateRef, audioManager,
        validateAuthToken, // Authoritative session-expiry check — gates the forced sign-out on game start
        continuousChainRef, // Read chain.isActive in startGameLogic to enable bufferTrials path; store returned primers
        // Color customization snapshot — passed in here so gameSetup can stamp it
        // onto sessionSettingsRef.current at session start.
        colorPaletteId, colorPalette, colorThemeAtPlayTime, colorPaletteFingerprint,
    }), [
        modeProgressionData,
        settings,
        saveToProfile,
        activeGameMode,
        startCountdown,
        setGameState, setNBack, setDifficulty, setSequence, setCurrentTrial,
        setTotalTrials, setGameResults, setFeedbackMessage, setStartFailureMessage,
        setSaveToProfile,
        setConsecutiveSuccesses, setShowCountdown, setIsCountdownVisuallyComplete, setPauseReason,
        validateAuthToken,
        colorPaletteId, colorPalette, colorThemeAtPlayTime, colorPaletteFingerprint,
    ]);

    const endGameLogic = useMemo(() => createEndGameAction({
        activeProfile: modeProgressionData, // Pass mode-specific data as activeProfile for backward compat
        saveToProfile, logReplayEvent,
        setGameState, setGameResults, setFeedbackMessage,
        setCurrentTrial, setSequence, setTotalTrials, setNBack, setDifficulty, setConsecutiveSuccesses,
        setSaveToProfile, updateProfileProgress, setPauseReason,
        latestGameStateRef, nBackRef, difficultyRef, consecutiveSuccessesRef, currentTrialRef, totalTrialsRef,
        onNavigateRef, isEndingRef, visualResponsesRef, audioResponsesRef,
        colorResponsesRef, shapeResponsesRef,  // NEW: for triple/quad modes
        colorRecallSelectionsRef,  // Recall Mode selections (singleColorRecall) — read when building the save payload
        sessionSettingsRef, sessionStartTimeRef, replayEventsRef,
        sequenceLanguage,  // Cache/letter-set key for the post-save prefetch of the NEXT level
        showLoading,
        hideLoading,
        addLocalSession,
        setTotalSessions,
        // Daily Adaptive cap state (relaunch monetization, May 2026)
        setDailyAdaptiveCount, setShowDailyCapModal, setDailyCapInfo,
        gameMode: activeGameMode  // Pass game mode for mode-specific progression
    }), [
        modeProgressionData, saveToProfile, logReplayEvent,
        updateProfileProgress, addLocalSession, setTotalSessions, activeGameMode,
        sequenceLanguage,
        setGameState, setGameResults, setFeedbackMessage,
        setCurrentTrial, setSequence,
        setTotalTrials, setNBack, setDifficulty, setConsecutiveSuccesses, setSaveToProfile,
        setPauseReason,
        showLoading,
        hideLoading,
        setDailyAdaptiveCount, setShowDailyCapModal, setDailyCapInfo,
    ]);

    const {
        isMatchLogic, getStimulusDurationLogic, getInstantFeedbackEnabledLogic, getCoachingMessageLogic,
        getFeatureIntroMessageLogic, getVisualMatchesLogic, getAudioMatchesLogic, getUserVisualResponsesLogic,
        getUserAudioResponsesLogic
    } = useMemo(() => createGameGetters({
        sequence, nBackRef, difficultyRef, sessionSettingsRef,
        visualMatchesRef, audioMatchesRef, visualResponsesRef, audioResponsesRef, settings
    }), [
        sequence, settings
    ]);


    // --- Stable Action Callbacks (Exported via Context Value) ---
    const pauseGame = useCallback((reason = 'manual') => { pauseGameLogic(reason); }, [pauseGameLogic]);
    const resumeGame = useCallback(() => {
        audioManager.resume().then(resumed => {
            if(resumed) { resumeGameLogic(); }
            else {
                console.error("[GameContext->resumeGame] Failed to resume audio.");
                setFeedbackMessage("Could not resume audio. Please interact with the page and try again.");
                setGameState('paused');
            }
        });
    }, [resumeGameLogic, setFeedbackMessage, setGameState]);

    const clearPauseReason = useCallback(() => { clearPauseReasonLogic(); }, [clearPauseReasonLogic]);
    const playAfterCountdown = useCallback(playAfterCountdownLogic, [playAfterCountdownLogic]);
    const registerResponse = useCallback(registerResponseLogic, [registerResponseLogic]);
    const setManualSettings = useCallback(setManualSettingsLogic, [setManualSettingsLogic]);
    const resetContextResponseArrays = useCallback(resetContextResponseArraysLogic, [resetContextResponseArraysLogic]);
    const setNavigationHandler = useCallback((handler) => { onNavigateRef.current = handler; }, []);
    const setGameOrigin = useCallback((path) => { gameOriginRef.current = path; }, []);
    const startGame = useCallback(startGameLogic, [startGameLogic]);
    const cancelPreparation = useCallback(cancelPreparationLogic, [cancelPreparationLogic]);

    const endGame = useCallback(async (options = { skipResultsProcessing: false }) => {
        await endGameLogic(options);
    }, [endGameLogic]);

    // ============================================================================
    // === Continuous Mode (chain-of-blocks) actions ==============================
    // ============================================================================

    /**
     * Start a new continuous chain. Called from the pre-game UI when the user clicks
     * "Start Continuous". Sets the chain state ref; the actual game start still
     * goes through startGame()/startCountdown() — chain-active just changes how
     * block-ends are handled.
     *
     * @param {object}  [args]
     * @param {number}  [args.targetBlocks]      user-chosen session count (null = open-ended)
     * @param {string}  [args.trainingMode]      'classic' | 'adaptive' (Dynamic resolves to 'dynamic')
     * @param {number}  [args.initialNBack]      explicit chain-start N (overrides the progression lookup)
     * @param {number}  [args.initialDifficulty] explicit chain-start difficulty
     */
    const startContinuousChain = useCallback(({ targetBlocks, trainingMode, initialNBack, initialDifficulty } = {}) => {
        if (!modeProgressionData) {
            console.warn("[Continuous] Cannot start chain — no progression data.");
            return;
        }
        // Dynamic meta-mode: resolve the concrete sub-mode ONCE here; the whole chain
        // plays it. Storing the literal 'dynamic' broke block-boundary generation
        // (backend defaulted it to 'dual') and save scoring/routing.
        const isDynamic = activeGameMode === 'dynamic';
        const resolvedSubMode = isDynamic ? (modeProgressionData.currentSubMode || 'dual') : null;
        // The caller's trainingMode is authoritative (see resolveChainTrainingMode): a
        // Classic chain must stay Classic so its block payloads route to classicProgression
        // and stay exempt from the daily Adaptive cap.
        const resolvedTrainingMode = resolveChainTrainingMode({ isDynamic, requestedTrainingMode: trainingMode });
        const isClassicChain = resolvedTrainingMode === 'classic';
        // modeProgressionData is the ADAPTIVE bucket (getCurrentModeProgression). Classic
        // plays out of classicProgression at a fixed 0.50, so seeding a Classic chain from
        // modeProgressionData would ship the wrong originalNBack in preSessionProfileContext
        // — and the backend derives classicProgression.currentNBack from exactly that field.
        const classicProgression = isClassicChain && typeof getClassicModeProgression === 'function'
            ? getClassicModeProgression()
            : null;
        // Never cross buckets on the fallback: a Classic chain with no classicProgression
        // doc yet starts at N=2, not at the user's Adaptive level.
        const seedNBack = typeof initialNBack === 'number'
            ? initialNBack
            : (isClassicChain
                ? (classicProgression?.currentNBack ?? 2)
                : (modeProgressionData.currentNBack ?? 2));
        const seedDifficulty = typeof initialDifficulty === 'number'
            ? initialDifficulty
            : (isClassicChain ? CLASSIC_FIXED_DIFFICULTY : (modeProgressionData.currentDifficulty ?? 0.0));
        // Reset per-block save tracking refs for the new chain.
        chainSaveQueueRef.current = Promise.resolve();
        chainBlockSessionIdsRef.current = [];
        chainBlockSaveErrorsRef.current = [];
        chainBlockMetricsRef.current = [];
        chainLastSaveResponseRef.current = null;
        // Seed the chain's daily-cap accounting from the current client status; per-block
        // save responses replace it with the server count as the chain progresses.
        chainDailyUsedRef.current = dailyCapStatusRef.current.used || 0;
        chainPendingAdaptiveSavesRef.current = 0;
        chainEndedByDailyCapRef.current = false;
        startContinuousChainState(continuousChainRef, {
            initialNBack: seedNBack,
            initialDifficulty: Math.max(0, Math.min(0.99, seedDifficulty)),
            // consecutiveSuccesses / highestNBack are Adaptive-only concepts; a Classic
            // chain must not carry the Adaptive bucket's values into its chain context.
            initialConsecutiveSuccesses: isClassicChain ? 0 : (modeProgressionData.consecutiveSuccesses ?? 0),
            highestAchievedNBack: isClassicChain
                ? seedNBack
                : (modeProgressionData.highestNBack ?? modeProgressionData.currentNBack ?? 2),
            highestNBackGood: null,
            gameMode: isDynamic ? resolvedSubMode : activeGameMode,
            isDynamic,
            currentSubMode: resolvedSubMode,
            trainingMode: resolvedTrainingMode,
            // Same derivation as every other sequence request (the chain reuses this for
            // every block fetch) — see src/utils/sequenceLanguage.js.
            language: sequenceLanguage,
            progressionRange: settings?.difficultyAdjustmentRange || 'standard',
            targetBlocks,
            dynamicThresholds: null, // populated async below; falls back to static if not ready in time
        });
        // Fire-and-forget threshold fetch. Block 1 takes ≥15s to play, so this
        // (~100-300ms read) lands well before block-1 ends and is used for
        // determineProgression at the block-1 → block-2 boundary.
        if (userId) {
            fetchLatestDynamicThresholds(userId).then(thresholds => {
                if (thresholds && continuousChainRef.current?.isActive) {
                    continuousChainRef.current = {
                        ...continuousChainRef.current,
                        dynamicThresholds: thresholds,
                    };
                    console.info('[Continuous] Cached dynamic thresholds:', thresholds);
                }
            }).catch(() => {});
        }
        console.info(`[Continuous] Chain started. Mode=${activeGameMode}${isDynamic ? ` (sub-mode: ${resolvedSubMode})` : ''}, training=${resolvedTrainingMode}, N=${seedNBack}, D=${seedDifficulty}, target=${targetBlocks ?? 'open-ended'}`);
    }, [modeProgressionData, activeGameMode, settings, sequenceLanguage, userId, getClassicModeProgression]);

    /**
     * Reset chain state to empty. Called by regular (non-continuous) session start handlers
     * to clear any stale chain state from a previously-abandoned chain (e.g., user
     * navigated away mid-chain without going through the normal save flow).
     * Safe to call always — no-op if chain is already inactive.
     */
    const resetContinuousChainState = useCallback(() => {
        if (continuousChainRef.current?.isActive) {
            console.info("[Continuous] Resetting stale chain state before regular session.");
        }
        resetContinuousChain(continuousChainRef);
    }, []);

    /**
     * Capture a just-completed block into the chain. Called by handleContinuousBlockEnd.
     *
     * For continuous blocks with prior context (block 2+ in a chain), the played sequence
     * starts with priorLen "prior" stimuli (already shown in prev block) followed by the
     * intended new trials. We split these so:
     *   - block.sequence = just the NEW trials (what the user actually did this block)
     *   - block.priorStimuli = the prior context (passed to backend for lookback scoring)
     *   - block.totalTrials = count of NEW trials only
     *   - response indices shifted to be 0-based within block.sequence
     */
    const captureCurrentBlock = useCallback(() => {
        const settingsFromSession = sessionSettingsRef.current;
        if (!settingsFromSession) return;
        const priorLen = settingsFromSession?.priorLen || 0;
        const trialsCompleted = (currentTrialRef.current ?? -1) + 1; // total stimuli rendered (incl. prior)
        const newTrialsCompleted = Math.max(0, trialsCompleted - priorLen);
        const fullSequence = settingsFromSession?.generatedSequence?.slice(0, trialsCompleted) || [];
        const newSequence = priorLen > 0 ? fullSequence.slice(priorLen) : fullSequence;
        const priorStimuli = priorLen > 0 ? fullSequence.slice(0, priorLen) : null;

        // Shift responses to be 0-indexed within newSequence (subtract priorLen).
        // Filter out any stray responses to prior trials (shouldn't happen but defensive).
        const shift = (arr) => (arr || [])
            .filter(idx => idx >= priorLen && idx < trialsCompleted)
            .map(idx => idx - priorLen);

        captureContinuousBlock(continuousChainRef, {
            nBack: nBackRef.current,
            difficulty: difficultyRef.current,
            sequence: newSequence,
            totalTrials: newTrialsCompleted,
            priorStimuli,                 // null for first block of chain
            calculatedISI: settingsFromSession?.calculatedISI,
            stimulusDuration: settingsFromSession?.stimulusDuration,
            visualResponses: shift(visualResponsesRef.current),
            audioResponses: shift(audioResponsesRef.current),
            colorResponses: shift(colorResponsesRef.current),
            shapeResponses: shift(shapeResponsesRef.current),
            startTime: sessionStartTimeRef.current || Date.now(),
            endTime: Date.now(),
            replayEvents: replayEventsRef.current || [],
        });
    }, []);

    /**
     * Enqueue a per-block save onto the chain's serialized save queue.
     *
     * Each just-captured block is sent to the backend as a 1-block continuous payload.
     * Saves are serialized (Promise chain) so backend progression updates apply in chain
     * order and never race. Gameplay does NOT wait — the chain advances to the next block
     * while the prior block's save is in flight.
     *
     * Network errors fall into the existing offlineSaveQueue (retried on reconnect).
     * Non-network errors are logged; the chain continues regardless.
     *
     * @param {number} blockIndex - 0-indexed position of the captured block in chain.blocks
     */
    const enqueueBlockSave = useCallback((blockIndex) => {
        const chain = continuousChainRef.current;
        if (!chain || !chain.isActive) return;
        const block = chain.blocks[blockIndex];
        if (!block) return;

        // Snapshot at enqueue time so subsequent block-end progression updates don't mutate.
        const payload = assembleSingleBlockPayload(block, chain, blockIndex, sessionSettingsRef.current);
        if (!payload) return;
        const chainIdSnap = chain.clientSessionId;
        const trainingModeSnap = chain.trainingMode;
        const isDynamicSnap = chain.isDynamic === true;
        // Only Adaptive blocks consume daily-cap credits server-side
        // (functions/game.js: capApplies = !isPro && trainingMode !== 'classic').
        const countsTowardDailyCap = trainingModeSnap !== 'classic';
        if (countsTowardDailyCap) chainPendingAdaptiveSavesRef.current += 1;
        // Owner of this block, captured now: the serialized save may run much later
        // (earlier blocks' 20s/3s probes) and a sign-out in between must not store it unowned.
        const uidSnap = auth.currentUser?.uid || null;

        chainSaveQueueRef.current = chainSaveQueueRef.current.then(async () => {
            // Block the App Check recovery reload from the save through the offline
            // enqueue (a back-out with a captured partial block runs this on the dashboard).
            const releaseReloadHold = holdRecoveryReload('chain_block_save');
            try {
                const result = await calculateAndSaveResultsCall(payload);
                // Server-authoritative post-save counter (capped cohorts only) — keeps the
                // cap chip and the block-boundary check current between blocks.
                if (typeof result?.dailyAdaptiveCount === 'number') {
                    chainDailyUsedRef.current = result.dailyAdaptiveCount;
                    if (typeof setDailyAdaptiveCount === 'function') {
                        setDailyAdaptiveCount(result.dailyAdaptiveCount);
                    }
                }
                if (!result?.sessionId) return;

                chainBlockSessionIdsRef.current = [...chainBlockSessionIdsRef.current, result.sessionId];
                chainLastSaveResponseRef.current = result;

                // Capture per-block metrics for the chain summary built at chain end.
                const responseBlock = result.chainSummary?.blocks?.[0];
                if (responseBlock) {
                    chainBlockMetricsRef.current[blockIndex] = {
                        ...responseBlock,
                        trials: responseBlock.trials ?? block.sequence.length,
                    };
                }

                // Optimistic single-row inject so dashboard reflects this block immediately.
                if (typeof addLocalSession === 'function') {
                    const m = responseBlock || {};
                    const ts = new Date(block.endTime || Date.now()).toISOString();
                    addLocalSession({
                        id: result.sessionId,
                        date: ts,
                        recordedAt: ts,
                        timestamp: ts,
                        mode: 'continuous-block',
                        chainId: chainIdSnap,
                        chainPosition: blockIndex + 1,
                        chainTotalBlocks: null,
                        nBack: block.nBack,
                        difficulty: block.difficulty,
                        gameMode: result.gameMode || activeGameMode,
                        trainingMode: result.trainingMode || trainingModeSnap || null,
                        overallDprime: m.overallDprime ?? null,
                        overallAccuracy: m.accuracy ?? null,
                        accuracy: m.accuracy ?? null,
                        visualAccuracy: m.visualAccuracy ?? null,
                        audioAccuracy: m.audioAccuracy ?? null,
                        colorAccuracy: m.colorAccuracy ?? null,
                        shapeAccuracy: m.shapeAccuracy ?? null,
                        visualDprime: m.visualDprime ?? null,
                        audioDprime: m.audioDprime ?? null,
                        colorDprime: m.colorDprime ?? null,
                        shapeDprime: m.shapeDprime ?? null,
                        durationMs: m.durationMs ?? ((block.endTime || 0) - (block.startTime || 0)),
                        trialsCompleted: m.trials ?? block.sequence.length,
                        totalTrialsPlanned: m.trials ?? block.sequence.length,
                        totalTrials: m.trials ?? block.sequence.length,
                        visualTargetCount: m.visualTargetCount ?? null,
                        visualCorrect: m.visualCorrect ?? null,
                        visualFalseAlarms: m.visualFalseAlarms ?? null,
                        audioTargetCount: m.audioTargetCount ?? null,
                        audioCorrect: m.audioCorrect ?? null,
                        audioFalseAlarms: m.audioFalseAlarms ?? null,
                        colorTargetCount: m.colorTargetCount ?? null,
                        colorCorrect: m.colorCorrect ?? null,
                        colorFalseAlarms: m.colorFalseAlarms ?? null,
                        shapeTargetCount: m.shapeTargetCount ?? null,
                        shapeCorrect: m.shapeCorrect ?? null,
                        shapeFalseAlarms: m.shapeFalseAlarms ?? null,
                        newNBack: result.newNBack ?? block.nBack,
                        newDifficulty: result.newDifficulty ?? block.difficulty,
                    });
                }

                // Update local profile state so subsequent blocks see the post-this-block
                // progression. Per-block math is identical client and server (commit 6cf927e),
                // but persisting via updateProfileProgress keeps the user doc up to date.
                // ALL Classic chains skip this: the backend already owns the classicProgression.*
                // write for those blocks, and this path (which carries no trainingMode key)
                // would route the Classic-shaped newNBack/0.50 into modeProgression.{mode}.*,
                // clobbering the user's Adaptive level.
                if (modeProgressionData?.id && updateProfileProgress
                    && trainingModeSnap !== 'classic'
                    && typeof result.newNBack === 'number'
                    && typeof result.newDifficulty === 'number') {
                    const updatePayload = {
                        currentNBack: result.newNBack,
                        currentDifficulty: result.newDifficulty,
                        consecutiveSuccesses: result.newConsecutiveSuccesses ?? 0,
                        // Dynamic chains: pin routing to the 'dynamic' bucket (guards against a
                        // mid-chain activeGameMode switch) and let chain-end rotation own
                        // highestNBack — a final-block N-promotion is usually rolled back to the
                        // anchor by the rotation (next sub-mode, same N).
                        ...(isDynamicSnap && { gameMode: 'dynamic' }),
                        ...(!isDynamicSnap && result.newNBack > (modeProgressionData.highestNBack || 0) && { highestNBack: result.newNBack }),
                    };
                    updateProfileProgress(modeProgressionData.id, updatePayload).catch(err =>
                        console.error("[Continuous] Per-block profile update failed:", err)
                    );
                }
            } catch (error) {
                // Normalize the error code — different SDK versions emit 'functions/x' vs 'x'
                // (mirrors gameEnd.js).
                const normalizedCode = (error?.code || '').replace(/^functions\//, '');
                const isDailyCap = normalizedCode === 'resource-exhausted' && error?.details?.reason === 'daily_cap';
                if (isDailyCap) {
                    // Safety net for a stale client count (e.g. sessions played on another
                    // device today): the server refused this block, so stop the chain at the
                    // next boundary instead of playing blocks that can't be saved.
                    chainEndedByDailyCapRef.current = true;
                    // This ref tracks sessions USED today, so prefer the server's used count;
                    // the limit is only a stand-in when the server didn't report one.
                    chainDailyUsedRef.current = error?.details?.sessionsUsed
                        ?? error?.details?.limit
                        ?? DAILY_ADAPTIVE_CAP;
                    if (typeof setDailyAdaptiveCount === 'function') {
                        setDailyAdaptiveCount(chainDailyUsedRef.current);
                    }
                    console.info(`[Continuous] Block ${blockIndex + 1} rejected: daily Adaptive cap reached. Chain will end at the next boundary.`);
                    chainBlockSaveErrorsRef.current.push({ blockIndex, error });
                } else if (isFetchNetworkError(error) || isAppCheckAttestationError(error)) {
                    // Also covers the app-imposed deadlines inside calculateAndSaveResultsCall
                    // (wedged App Check → 20s, then 3s probes for later blocks, so the chain-end
                    // drain stays bounded) and an App Check attestation failure (bounded retries
                    // in the drain). appCheckHealth arms the recovery reload itself; the
                    // watcher defers it past the results screen (ContinuousResults sets
                    // data-game-active). enqueue never throws — it returns null on failure.
                    // Unlike gameEnd (which throws "User not authenticated." before saving),
                    // the chain keeps playing after a sign-out. Never store an unowned entry:
                    // the drain would replay it into whichever account signs in next.
                    const queued = uidSnap
                        ? await enqueueOfflineSave(payload, payload.clientSessionId, { uid: uidSnap })
                        : null;
                    if (queued) {
                        console.warn(`[Continuous] Block ${blockIndex + 1} save queued offline (will retry on reconnect):`, error.message);
                    } else {
                        console.error(`[Continuous] Block ${blockIndex + 1} save failed AND offline enqueue failed (enqueue returned null).`);
                        chainBlockSaveErrorsRef.current.push({ blockIndex, error: new Error(`offline enqueue failed after: ${error.message}`) });
                    }
                } else if (isAuthError(error)) {
                    console.error(`[Continuous] Block ${blockIndex + 1} save failed (auth error):`, error);
                    chainBlockSaveErrorsRef.current.push({ blockIndex, error });
                } else {
                    console.error(`[Continuous] Block ${blockIndex + 1} save failed (non-network):`, error);
                    chainBlockSaveErrorsRef.current.push({ blockIndex, error });
                }
            } finally {
                releaseReloadHold();
                if (countsTowardDailyCap) {
                    chainPendingAdaptiveSavesRef.current = Math.max(0, chainPendingAdaptiveSavesRef.current - 1);
                }
            }
        });
    }, [addLocalSession, activeGameMode, modeProgressionData, updateProfileProgress, setDailyAdaptiveCount]);

    /**
     * Drain pending per-block saves, build the chain results summary from in-memory state
     * + collected per-block save responses, set gameResults, and transition to the results
     * screen. Replaces the old batched chain save (which sent the whole chain in one call).
     */
    const endContinuousChainAndSave = useCallback(async () => {
        const chain = continuousChainRef.current;
        const fullChainReset = () => {
            resetContinuousChain(continuousChainRef);
            chainSaveQueueRef.current = Promise.resolve();
            chainBlockSessionIdsRef.current = [];
            chainBlockSaveErrorsRef.current = [];
            chainBlockMetricsRef.current = [];
            chainLastSaveResponseRef.current = null;
            chainDailyUsedRef.current = 0;
            chainPendingAdaptiveSavesRef.current = 0;
            chainEndedByDailyCapRef.current = false;
            if (visualResponsesRef.current) visualResponsesRef.current = [];
            if (audioResponsesRef.current) audioResponsesRef.current = [];
            if (colorResponsesRef.current) colorResponsesRef.current = [];
            if (shapeResponsesRef.current) shapeResponsesRef.current = [];
            colorRecallSelectionsRef.current = {};
            if (replayEventsRef.current) replayEventsRef.current = [];
            if (sessionSettingsRef.current) sessionSettingsRef.current = null;
            if (sessionStartTimeRef) sessionStartTimeRef.current = null;
            setCurrentTrial(-1);
            setSequence([]);
            setTotalTrials(0);
        };

        if (!chain.isActive || chain.blocks.length === 0) {
            console.warn("[Continuous] No completed blocks — chain ended empty.");
            fullChainReset();
            setGameState('idle');
            return;
        }

        if (typeof showLoading === 'function') {
            showLoading("Finalizing continuous session...", null, "auto");
        }

        // Drain queued per-block saves so dashboard / results screen reflect final state.
        try {
            await chainSaveQueueRef.current;
        } catch (err) {
            console.error("[Continuous] Queue drain caught error (chain continues):", err);
        }

        if (typeof hideLoading === 'function') hideLoading();

        // Build the chain summary for the results screen from in-memory state +
        // per-block save responses. Backend per-block calls already wrote individual
        // session docs and updated progression, so no chain-end backend call is needed.
        const lastResponse = chainLastSaveResponseRef.current;
        const blockMetrics = chainBlockMetricsRef.current;
        const sessionIds = chainBlockSessionIdsRef.current;

        let totalTrials = 0;
        let maxNBack = 0;
        let nDdMin = Infinity;
        let nDdMax = -Infinity;
        let nDdSumWeighted = 0;
        let earliestStart = Infinity;
        let latestEnd = -Infinity;
        for (const b of chain.blocks) {
            totalTrials += b.sequence.length;
            maxNBack = Math.max(maxNBack, b.nBack);
            const nDd = b.nBack + (b.difficulty || 0);
            if (nDd < nDdMin) nDdMin = nDd;
            if (nDd > nDdMax) nDdMax = nDd;
            nDdSumWeighted += nDd * b.sequence.length;
            if (b.startTime < earliestStart) earliestStart = b.startTime;
            if (b.endTime > latestEnd) latestEnd = b.endTime;
        }
        const nDdAverage = totalTrials > 0 ? nDdSumWeighted / totalTrials : 0;
        const hasBlocks = chain.blocks.length > 0;
        const totalDurationMs = (latestEnd === -Infinity || earliestStart === Infinity)
            ? 0
            : Math.max(0, latestEnd - earliestStart);

        const chainSummary = {
            chainId: chain.clientSessionId,
            totalBlocks: chain.blocks.length,
            chainStartedAt: chain.chainStartedAt,
            chainCappedReason: chain.chainCappedReason,
            // Client-only marker (never persisted): the chain stopped because the capped
            // cohort's daily Adaptive allowance ran out. Drives the results notice + upsell.
            ...(chainEndedByDailyCapRef.current && { endedByDailyCap: true }),
            nDdAverage,
            nDdRange: hasBlocks ? { min: nDdMin, max: nDdMax } : null,
            maxNBackReached: maxNBack,
            // Per-block details: backend-returned metrics where available, fallback to local
            // block data (raw responses, no d-prime/accuracy) for blocks that didn't save.
            blocks: chain.blocks.map((b, i) => {
                const m = blockMetrics[i];
                if (m) return m;
                return {
                    nBack: b.nBack,
                    difficulty: b.difficulty,
                    trials: b.sequence.length,
                    durationMs: Math.max(0, (b.endTime || 0) - (b.startTime || 0)),
                    overallDprime: null,
                    accuracy: null,
                };
            }),
            sessionIds,
        };

        // Dynamic chains: rotate the sub-mode ONCE here, at chain end. Per-block rotation
        // is suppressed server-side (chainStillInProgress gate); the promotion signal is
        // the backend's own final per-block response, so this mirrors what a single
        // Dynamic session would have done.
        const rotation = decideChainEndSubModeRotation({
            isDynamic: chain.isDynamic,
            currentSubMode: chain.currentSubMode,
            trainingMode: chain.trainingMode,
            anchorNBack: chain.blocks[0]?.nBack ?? chain.chainStartNBack,
            finalNewNBack: lastResponse?.newNBack,
        });
        if (rotation && modeProgressionData?.id && typeof updateProfileProgress === 'function') {
            // Manual Adaptive mode (adaptiveAutoLevel off): the backend froze the level;
            // writing N/difficulty here would silently unfreeze it. Rotate sub-mode only.
            const manualAdaptive = chain.trainingMode !== 'classic' && lastResponse?.adaptiveAutoLevel === false;
            // No trainingMode key in either payload: routing falls back to activeGameMode
            // ('dynamic') → modeProgression.dynamic.*, the bucket every sub-mode read uses.
            const rotationPayload = (chain.trainingMode === 'classic' || manualAdaptive)
                // Classic+Dynamic: sub-mode only; N/difficulty live in classicProgression
                // (server-authoritative for the classic engine). Manual Adaptive: sub-mode
                // only; N/difficulty stay frozen at the stored anchor.
                ? { currentSubMode: rotation.newSubMode, gameMode: 'dynamic' }
                : {
                    currentSubMode: rotation.newSubMode,
                    currentNBack: rotation.newNBack,
                    currentDifficulty: rotation.newDifficulty,
                    consecutiveSuccesses: rotation.newConsecutiveSuccesses,
                    gameMode: 'dynamic',
                    ...(rotation.wrapped && rotation.newNBack > (modeProgressionData.highestNBack || 0)
                        && { highestNBack: rotation.newNBack }),
                };
            console.info(`[Continuous] Dynamic chain-end rotation: ${chain.currentSubMode} → ${rotation.newSubMode} (N=${rotation.newNBack}${rotation.wrapped ? ', wrapped' : ''})`);
            // Fire-and-forget (mirrors gameEnd): the chain is already saved; a lost write
            // just means the same sub-mode next time.
            updateProfileProgress(modeProgressionData.id, rotationPayload).catch(err =>
                console.error("[Continuous] Chain-end sub-mode rotation write failed:", err)
            );
        }

        // Compose gameResults from the most recent backend save (carries newNBack, newDifficulty,
        // totalSessions, readinessScore, threshold values) plus the chain summary we just built.
        const gameResultsForChain = {
            ...(lastResponse || {}),
            chainSummary,
            gameMode: chain.gameMode,
            trainingMode: chain.trainingMode,
            nBack: maxNBack,
            durationMs: totalDurationMs,
            totalTrials,
            nextSubMode: rotation?.newSubMode ?? null,
            preSessionProfileContext: chain.chainStartContext,
        };

        setGameResults(gameResultsForChain);
        setGameState('results');
        fullChainReset();
    }, [showLoading, hideLoading, modeProgressionData, updateProfileProgress]);

    /**
     * Stop the chain and save it immediately (mid-block). Called by the in-game
     * Stop button AND when the user navigates away mid-chain (back button confirm).
     * Captures a partial current block if it has substantial data (≥5 trials),
     * otherwise saves only fully-completed blocks.
     *
     * Cancels the trial timer up-front so no more trials fire during the async
     * save flow. If there are no completed blocks at all, resets session state
     * back to idle so the in-game caller doesn't get stuck in a frozen 'playing'
     * UI.
     *
     * @returns {Promise<{saved: boolean, hadData: boolean}>}
     *   saved: true if a chain doc was written to Firestore.
     *   hadData: true if there was any chain data to persist (false → nothing to save, just discarded).
     */
    const stopAndSaveContinuousChain = useCallback(async () => {
        if (!continuousChainRef.current?.isActive) {
            return { saved: false, hadData: false };
        }
        // Re-entry guard: if another save (chain save or normal endGame) is already
        // in flight, bail. Prevents double-click on Stop or simultaneous back-button +
        // Stop from kicking off two saves.
        if (isEndingRef.current) {
            return { saved: false, hadData: false };
        }

        // Cancel the trial timer immediately so no further trials advance during
        // the async save. isEndingRef is also checked inside the timer's inner
        // callback as defense-in-depth in case a fire is already scheduled.
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        isEndingRef.current = true;

        try {
            capChain(continuousChainRef, 'user-stop');

            // Capture the in-progress partial block IF it has enough NEW trials to be statistically meaningful.
            // Threshold mirrors the normal-session discard formula in gameEnd.js: max(1, min(10, ceil(planned*0.5))).
            // Compares NEW trials only (excluding prepended prior context) — same accounting captureCurrentBlock uses.
            const settings = sessionSettingsRef.current;
            const priorLen = settings?.priorLen || 0;
            const trialsRendered = (currentTrialRef.current ?? -1) + 1;
            const newTrialsCompleted = Math.max(0, trialsRendered - priorLen);
            const plannedNewTrials = Math.max(0, (settings?.totalTrials ?? 0) - priorLen);
            const partialBlockThreshold = Math.max(1, Math.min(10, plannedNewTrials > 0 ? Math.ceil(plannedNewTrials * 0.5) : 10));

            if (newTrialsCompleted >= partialBlockThreshold) {
                captureCurrentBlock();
                console.info(`[Continuous] Captured partial final block: ${newTrialsCompleted}/${plannedNewTrials} new trials (threshold ${partialBlockThreshold}).`);
                // Enqueue the partial block's save (chain.chainCappedReason='user-stop' is
                // already set by capChain above, so this final per-block doc records the cap).
                const partialIndex = continuousChainRef.current.blocks.length - 1;
                enqueueBlockSave(partialIndex);
            } else if (newTrialsCompleted > 0) {
                console.info(`[Continuous] Dropping partial final block: ${newTrialsCompleted}/${plannedNewTrials} new trials (below threshold ${partialBlockThreshold}).`);
            }

            // No completed blocks to save → discard chain and clean up session state
            // so the in-game caller (Stop button) lands back on idle/launch instead
            // of a frozen 'playing' state.
            if (continuousChainRef.current.blocks.length === 0) {
                console.info("[Continuous] Chain has no completed blocks — discarding.");
                resetContinuousChain(continuousChainRef);
                visualResponsesRef.current = [];
                audioResponsesRef.current = [];
                colorResponsesRef.current = [];
                shapeResponsesRef.current = [];
                colorRecallSelectionsRef.current = {};
                replayEventsRef.current = [];
                sessionSettingsRef.current = null;
                sessionStartTimeRef.current = null;
                setCurrentTrial(-1);
                setSequence([]);
                setTotalTrials(0);
                setGameState('idle');
                return { saved: false, hadData: false };
            }

            await endContinuousChainAndSave();
            return { saved: true, hadData: true };
        } finally {
            isEndingRef.current = false;
        }
    }, [captureCurrentBlock, endContinuousChainAndSave, enqueueBlockSave]);

    /**
     * Block-end handler invoked by the timer when trial >= totalTrials AND a chain is active.
     * Captures the block, checks caps, then either advances to the next block (seamlessly)
     * or saves the chain.
     */
    const handleContinuousBlockEnd = useCallback(async () => {
        const chain = continuousChainRef.current;
        if (!chain.isActive) return false; // not in continuous mode → caller should call endGame

        // Capture the just-completed block
        captureCurrentBlock();

        // Enqueue the just-captured block's save onto the per-chain serialized save queue.
        // Non-blocking: the chain advances to the next block while this save is in flight.
        // Refresh during the chain now only loses the in-progress block (parity with normal sessions).
        const justCapturedIndex = continuousChainRef.current.blocks.length - 1;
        enqueueBlockSave(justCapturedIndex);

        // User-chosen target reached → end silently with no cap reason (this isn't a cap, it's completion)
        if (shouldCompleteChain(continuousChainRef)) {
            console.info(`[Continuous] Target reached (${continuousChainRef.current.blocks.length}/${continuousChainRef.current.targetBlocks} sessions). Ending chain.`);
            await endContinuousChainAndSave();
            return true;
        }

        // Daily Adaptive cap: every adaptive chain block spends one credit server-side,
        // so end the chain here rather than let the user play blocks the backend will
        // reject. Two triggers, both graceful completions (NOT a chainCappedReason —
        // the backend only accepts 'user-stop'|'duration'|'blocks', so the flag stays
        // client-side):
        // 1) A block save already bounced with resource-exhausted/daily_cap. Server
        //    proof — honored regardless of the client cohort tag, because untagged
        //    freeTier docs are capped server-side (!isPro) but invisible to
        //    isCappedCohort.
        // 2) Proactive projection for known capped cohorts: freshest server count
        //    (`chainDailyUsedRef`) plus in-flight saves says the next block would be
        //    rejected.
        if (chain.trainingMode !== 'classic') {
            const projectedUsed = chainDailyUsedRef.current + chainPendingAdaptiveSavesRef.current;
            if (chainEndedByDailyCapRef.current
                || (dailyCapStatusRef.current.isCappedCohort && projectedUsed >= DAILY_ADAPTIVE_CAP)) {
                chainEndedByDailyCapRef.current = true;
                console.info(`[Continuous] Daily Adaptive cap reached (${projectedUsed}/${DAILY_ADAPTIVE_CAP}). Ending chain at block boundary.`);
                await endContinuousChainAndSave();
                return true;
            }
        }

        // Check caps
        const capReason = chain.chainCappedReason || shouldCapChain(continuousChainRef);
        if (capReason) {
            if (capReason !== chain.chainCappedReason) capChain(continuousChainRef, capReason);
            // Save chain
            await endContinuousChainAndSave();
            return true;
        }

        // No cap → advance to next block.
        // Buffer-trial architecture: pick the next block's level, then request a single
        // fresh sequence at it. The held primers from the prior request become this
        // block's first K trials, displayed at the new level's timing.
        //   - Adaptive/Dynamic: block d' → client-side determineProgression with cached
        //     dynamic thresholds (mirrors the server's progression formula exactly).
        //   - Classic: no per-block adaptation at all — the chain holds its starting N at
        //     the fixed 0.50 and the backend decides progression once, from the pooled
        //     chain. See resolveNextBlockLevel().
        const justCompletedBlock = continuousChainRef.current.blocks[continuousChainRef.current.blocks.length - 1];
        const isClassicChain = chain.trainingMode === 'classic';
        const blockDprime = isClassicChain ? null : computeBlockDprime(
            justCompletedBlock.sequence,
            {
                visual: justCompletedBlock.userVisualResponses,
                audio: justCompletedBlock.userAudioResponses,
                color: justCompletedBlock.userColorResponses,
                shape: justCompletedBlock.userShapeResponses,
            },
            justCompletedBlock.nBack,
            chain.gameMode
        );

        const adjustmentRange = CONTINUOUS_RANGES[chain.progressionRange] || CONTINUOUS_RANGES.standard;
        const thresholds = chain.dynamicThresholds || getStaticThresholdsFallback();
        const { nBack: cappedNBack, difficulty: cappedDifficulty } = resolveNextBlockLevel({
            chain,
            justCompletedBlock,
            blockDprime,
            thresholds,
            adjustmentRange,
        });
        const nextLevelLabel = `${cappedNBack}.${(cappedDifficulty * 100).toFixed(0).padStart(2, '0')}`;
        console.info(isClassicChain
            ? `[Continuous] Block ${continuousChainRef.current.blocks.length} ended (classic): holding ${nextLevelLabel} (fixed difficulty).`
            : `[Continuous] Block ${continuousChainRef.current.blocks.length} ended: d'=${blockDprime.toFixed(2)} → next ${nextLevelLabel} (range=${chain.progressionRange}, thresholds=${thresholds === chain.dynamicThresholds ? 'dynamic' : 'static-fallback'})`);

        let nextBlock = null;
        try {
            const heldPrimers = Array.isArray(chain.heldPrimers) && chain.heldPrimers.length > 0
                ? chain.heldPrimers
                : null;
            const resp = await generateSequenceHttp({
                nBack: cappedNBack,
                difficulty: cappedDifficulty,
                isPlayground: false,
                gameMode: chain.gameMode,
                language: chain.language || 'en',
                progressionRange: chain.progressionRange || 'standard',
                bufferTrials: 3,
                ...(heldPrimers && { priorStimuli: heldPrimers }),
            });
            if (resp?.sequence && Array.isArray(resp.sequence) && resp.sequence.length > 0) {
                nextBlock = {
                    nBack: cappedNBack,
                    difficulty: cappedDifficulty,
                    sequence: resp.sequence,                    // already includes prepended primers (priorLen of them)
                    visualMatches: resp.visualMatches || [],
                    audioMatches: resp.audioMatches || [],
                    colorMatches: resp.colorMatches || [],
                    shapeMatches: resp.shapeMatches || [],
                    priorLen: resp.priorLen || 0,               // for sessionSettings; we set the SCORING priorLen to 0 below
                    primerStimuli: Array.isArray(resp.primerStimuli) ? resp.primerStimuli : null,
                    parameters: resp.parameters || {},
                };
            }
        } catch (fetchError) {
            console.error("[Continuous] Block-end generation failed:", fetchError);
        }
        if (!nextBlock || !Array.isArray(nextBlock.sequence) || nextBlock.sequence.length === 0) {
            // Truly stuck — end chain gracefully (saves what we have so far).
            console.warn("[Continuous] Generation failed at block boundary; capping chain.");
            capChain(continuousChainRef, 'user-stop');
            await endContinuousChainAndSave();
            return true;
        }

        // Load next block under buffer-trials architecture:
        // nextBlock.sequence already has the inherited primers PREPENDED (priorLen of them)
        // followed by (baseTrialCount - priorLen) NEW trials at the new level. We treat the
        // ENTIRE sequence as the new block's playable trials with priorLen=0 — all displayed
        // trials are scored. Inherited primers contribute zero targets (no match flags),
        // any user presses on them count as FAs (matches today's first-N-trial behavior).
        // Timing (ISI/stimulusDuration) comes from L_{N+1}'s parameters — applied uniformly,
        // so primers and new trials all play at the new level's pace (no mid-session shift).
        const newSessionSettings = {
            ...sessionSettingsRef.current,
            nBack: nextBlock.nBack,
            difficulty: nextBlock.difficulty,
            calculatedISI: nextBlock.parameters?.calculatedISI ?? sessionSettingsRef.current?.calculatedISI,
            stimulusDuration: nextBlock.parameters?.stimulusDuration ?? sessionSettingsRef.current?.stimulusDuration,
            generatedSequence: nextBlock.sequence,
            totalTrials: nextBlock.sequence.length,
            visualMatches: nextBlock.visualMatches || [],
            audioMatches: nextBlock.audioMatches || [],
            colorMatches: nextBlock.colorMatches || [],
            shapeMatches: nextBlock.shapeMatches || [],
            priorLen: 0,  // full sequence scored; primers (if any) at start have no match flags
        };
        sessionSettingsRef.current = newSessionSettings;
        // Update visible state (matters for game UI displays)
        setNBack(nextBlock.nBack);
        setDifficulty(nextBlock.difficulty);
        setSequence(nextBlock.sequence);
        setTotalTrials(nextBlock.sequence.length);
        // Update match refs (for trial-end correctness)
        visualMatchesRef.current = nextBlock.visualMatches || [];
        audioMatchesRef.current = nextBlock.audioMatches || [];
        colorMatchesRef.current = nextBlock.colorMatches || [];
        shapeMatchesRef.current = nextBlock.shapeMatches || [];
        // Reset response refs and replay events for the new block
        visualResponsesRef.current = [];
        audioResponsesRef.current = [];
        colorResponsesRef.current = [];
        shapeResponsesRef.current = [];
        colorRecallSelectionsRef.current = {};
        replayEventsRef.current = [];
        resetResponsesRef.current?.();
        sessionStartTimeRef.current = Date.now();
        // Stash the new K primers (from this gen response) for use as the NEXT next-session's
        // first K trials. Clear legacy fields from the OLD multi-candidate prefetch path.
        continuousChainRef.current = {
            ...continuousChainRef.current,
            heldPrimers: nextBlock.primerStimuli || null,
            pendingCandidates: null,
            pendingNextBlock: null,
        };
        // Render the first stimulus immediately (no flicker, no 250ms initial delay).
        // priorLen=0 in the new design — trials advance 0..totalTrials-1 with no skipping.
        const firstNewTrialIndex = 0;
        const onsetTime = Date.now();
        stimulusOnsetTimeRef.current[firstNewTrialIndex] = onsetTime;
        logReplayEvent({ type: 'trialStart', trialIndex: firstNewTrialIndex, timestamp: onsetTime });
        setCurrentTrial(firstNewTrialIndex);
        // gameState stays 'playing' — no UI break, no countdown.
        return true;
    }, [captureCurrentBlock, endContinuousChainAndSave, enqueueBlockSave, logReplayEvent]);

    // --- NEW GAME ACTIONS for N-Level Navigation ---
    const goToPreviousNBackLevel = useCallback(async () => {
        // Defense-in-depth: this handler reads/writes the MATCH track
        // (modeProgressionData.previousNBackLevelDifficulties, currentNBack/currentDifficulty),
        // which is not the recall track. GameResults already hides every entry point for a
        // recall session, so this is unreachable today — the guard makes the invariant local
        // instead of depending on a distant UI gate staying correct.
        if (sessionSettingsRef.current?.gameMode === 'singleColorRecall') {
            console.warn('[GameContext] Level-jump handlers are not recall-aware; ignoring.');
            return;
        }
        if (!modeProgressionData || nBackRef.current <= 1) {
            console.warn("Cannot go to previous level: No profile or already at lowest playable level.");
            setFeedbackMessage("Already at the lowest N-Back level or no profile loaded.");
            return;
        }
        const targetNBack = nBackRef.current - 1;
        const previousDifficulties = modeProgressionData.previousNBackLevelDifficulties || {};
        const targetDifficulty = previousDifficulties[targetNBack] !== undefined ? previousDifficulties[targetNBack] : 0.0;

        if (latestGameStateRef.current !== 'idle' && latestGameStateRef.current !== 'results') {
             await endGameLogic({ skipResultsProcessing: true });
        }
        // Update profile: Set currentNBack and currentDifficulty to where we are going
        // This mechanic reads previousNBackLevelDifficulties, which is an Adaptive-only concept.
        const profileUpdatePayload = {
            currentNBack: targetNBack,
            currentDifficulty: targetDifficulty,
            consecutiveSuccesses: 0, // Reset streak when manually changing levels
            trainingMode: 'adaptive',
        };
        const updateSuccess = await updateProfileProgress(userId, profileUpdatePayload);
        if (updateSuccess) {
            startGameLogic({ overrideNBack: targetNBack, overrideDifficulty: targetDifficulty, skipCountdown: true });
        } else {
            console.error("[GameContext] Failed to update profile for goToPreviousNBackLevel.");
            setFeedbackMessage("Error saving progress. Could not go to previous level.");
        }
    }, [modeProgressionData, userId, startGameLogic, endGameLogic, updateProfileProgress, setFeedbackMessage]);

    // **** MODIFIED: goToNextNBackLevelZero now accepts nBackJustPlayed and difficultyJustPlayed ****
    // For Dynamic mode, advances to next sub-mode instead of next N-back level
    const goToNextNBackLevelZero = useCallback(async (nBackJustPlayed, difficultyJustPlayed, trainingMode) => {
        // Defense-in-depth — see goToPreviousNBackLevel. Same Match-track read/write set
        // (and the Dynamic sub-mode cycle), none of it recall-aware.
        if (sessionSettingsRef.current?.gameMode === 'singleColorRecall') {
            console.warn('[GameContext] Level-jump handlers are not recall-aware; ignoring.');
            return;
        }
        if (!modeProgressionData) {
            console.warn("Cannot go to next level: No profile.");
            setFeedbackMessage("No profile loaded.");
            return;
        }

        const isDynamic = activeGameMode === 'dynamic';
        let targetNBack, targetDifficulty;
        let profileUpdatePayload;

        if (isDynamic) {
            // Dynamic mode: cycle sub-mode (D→T→Q→D+1)
            const currentSubMode = modeProgressionData.currentSubMode || 'dual';
            const subModeIndex = DYNAMIC_SUB_MODE_ORDER.indexOf(currentSubMode);
            let nextSubMode;

            if (subModeIndex < DYNAMIC_SUB_MODE_ORDER.length - 1) {
                nextSubMode = DYNAMIC_SUB_MODE_ORDER[subModeIndex + 1];
                targetNBack = nBackJustPlayed;
            } else {
                nextSubMode = DYNAMIC_SUB_MODE_ORDER[0]; // 'dual'
                targetNBack = nBackJustPlayed + 1;
            }
            targetDifficulty = 0.0;

            profileUpdatePayload = {
                currentNBack: targetNBack,
                currentDifficulty: targetDifficulty,
                currentSubMode: nextSubMode,
                consecutiveSuccesses: 0,
                highestNBack: Math.max(modeProgressionData.highestNBack || 0, targetNBack),
                ...(trainingMode && { trainingMode }),
            };
        } else {
            // Standard mode: advance to next N-back level
            targetNBack = nBackJustPlayed + 1;
            targetDifficulty = 0.0;

            const newPreviousDifficulties = {
                ...(modeProgressionData.previousNBackLevelDifficulties || {}),
                [nBackJustPlayed]: difficultyJustPlayed
            };

            profileUpdatePayload = {
                currentNBack: targetNBack,
                currentDifficulty: targetDifficulty,
                consecutiveSuccesses: 0,
                highestNBack: Math.max(modeProgressionData.highestNBack || 0, targetNBack),
                previousNBackLevelDifficulties: newPreviousDifficulties,
                ...(trainingMode && { trainingMode }),
            };
        }

        const updateSuccess = await updateProfileProgress(userId, profileUpdatePayload);

        if (updateSuccess) {
            if (latestGameStateRef.current !== 'idle' && latestGameStateRef.current !== 'results') {
                await endGameLogic({ skipResultsProcessing: true });
            }
            startGameLogic({ overrideNBack: targetNBack, overrideDifficulty: targetDifficulty, ...(trainingMode && { trainingMode }), skipCountdown: true });
        } else {
            console.error("[GameContext] Failed to update profile for goToNextNBackLevelZero.");
            setFeedbackMessage("Error saving progress. Could not advance level.");
        }
    }, [modeProgressionData, userId, updateProfileProgress, startGameLogic, endGameLogic, setFeedbackMessage, activeGameMode]);


    // --- Stable Getter Callbacks (Exported via Context Value) ---
    const isMatch = useCallback(isMatchLogic, [isMatchLogic]);
    const getStimulusDuration = useCallback(getStimulusDurationLogic, [getStimulusDurationLogic]);
    const getInstantFeedbackEnabled = useCallback(getInstantFeedbackEnabledLogic, [getInstantFeedbackEnabledLogic]);
    const getCoachingMessage = useCallback(getCoachingMessageLogic, [getCoachingMessageLogic]);
    const getFeatureIntroMessage = useCallback(getFeatureIntroMessageLogic, [getFeatureIntroMessageLogic]);
    const getVisualMatches = useCallback(getVisualMatchesLogic, [getVisualMatchesLogic]);
    const getAudioMatches = useCallback(getAudioMatchesLogic, [getAudioMatchesLogic]);
    const getUserVisualResponses = useCallback(getUserVisualResponsesLogic, [getUserVisualResponsesLogic]);
    const getUserAudioResponses = useCallback(getUserAudioResponsesLogic, [getUserAudioResponsesLogic]);
    const playFeedbackSound = useCallback((type) => {
        audioManager.playFeedbackSound(type);
    }, []);

    // --- NEW: Color/Shape Getters for Triple/Quad modes ---
    const getColorMatches = useCallback(() => colorMatchesRef.current, []);
    const getShapeMatches = useCallback(() => shapeMatchesRef.current, []);
    const getUserColorResponses = useCallback(() => colorResponsesRef.current, []);
    const getUserShapeResponses = useCallback(() => shapeResponsesRef.current, []);

    // --- NEW: Register color/shape responses ---
    const registerColorResponse = useCallback((trialIndex) => {
        if (!colorResponsesRef.current.includes(trialIndex)) {
            colorResponsesRef.current.push(trialIndex);
            logReplayEvent({ type: 'colorResponse', trialIndex, timestamp: Date.now() });
        }
    }, [logReplayEvent]);

    const registerShapeResponse = useCallback((trialIndex) => {
        if (!shapeResponsesRef.current.includes(trialIndex)) {
            shapeResponsesRef.current.push(trialIndex);
            logReplayEvent({ type: 'shapeResponse', trialIndex, timestamp: Date.now() });
        }
    }, [logReplayEvent]);

    // --- Recall Mode (singleColorRecall): selection registration + correctness ---
    // The ref is the single source of truth for "this trial is already answered":
    // component state can lag a fast second tap, the ref cannot. Returns true only
    // for the tap that actually locked the trial, so callers can bail on false.
    const registerColorRecallSelection = useCallback((trialIndex, color) => {
        if (typeof trialIndex !== 'number' || !Number.isFinite(trialIndex) || trialIndex < 0) return false;
        if (typeof color !== 'string' || !color) return false;
        if (colorRecallSelectionsRef.current[trialIndex] !== undefined) return false; // already answered
        colorRecallSelectionsRef.current[trialIndex] = color;
        return true;
    }, []);

    // Forced choice: the answer is correct when it names the color shown n trials back.
    // Same sequence/nBack access pattern as isColorMatch below.
    const isRecallSelectionCorrect = useCallback((trialIndex, color) => {
        const n = nBackRef.current;
        if (typeof trialIndex !== 'number' || trialIndex < n) return false;
        const targetColor = sequence[trialIndex - n]?.color;
        return targetColor != null && targetColor === color;
    }, [sequence]);

    // --- NEW: Check if current trial is a color/shape match ---
    const isColorMatch = useCallback((trial = null) => {
        const trialToCheck = trial ?? currentTrialRef.current;
        if (trialToCheck < nBackRef.current || !sequence[trialToCheck] || !sequence[trialToCheck - nBackRef.current]) return false;
        const currentColor = sequence[trialToCheck]?.color;
        const nBackColor = sequence[trialToCheck - nBackRef.current]?.color;
        return currentColor != null && currentColor === nBackColor;
    }, [sequence]);

    const isShapeMatch = useCallback((trial = null) => {
        const trialToCheck = trial ?? currentTrialRef.current;
        if (trialToCheck < nBackRef.current || !sequence[trialToCheck] || !sequence[trialToCheck - nBackRef.current]) return false;
        const currentShape = sequence[trialToCheck]?.shape;
        const nBackShape = sequence[trialToCheck - nBackRef.current]?.shape;
        return currentShape != null && currentShape === nBackShape;
    }, [sequence]);

    // --- Core Game Logic Effects ---
    useEffect(() => {
        if (isCountdownVisuallyComplete && gameState === 'preparing') {
            sessionStartTimeRef.current = Date.now(); // Set start time
            stimulusOnsetTimeRef.current = {};  // Reset RT tracking for new game
            logReplayEvent({ type: 'gameStart', timestamp: sessionStartTimeRef.current });

            // Reset trial to -1 before setting to 'playing'.
            // The 'playing' state effect will handle advancing to trial 0.
            setCurrentTrial(-1);

            setGameState('playing'); // This will trigger the timer useEffect
            setPauseReason(null); // Clear any pause reason
            setIsCountdownVisuallyComplete(false); // Reset the flag
        }
    }, [isCountdownVisuallyComplete, gameState, logReplayEvent, setCurrentTrial, setGameState, setPauseReason, setIsCountdownVisuallyComplete]);

    useEffect(() => {
        if (gameState === 'playing' && currentTrial >= 0 && currentTrial < sequence.length && currentTrial !== audioTriggeredForTrial.current) {
            // console.log(`[GameContext Audio Effect] Conditions met for trial ${currentTrial}. audioTriggeredForTrial.current = ${audioTriggeredForTrial.current}`);
            const currentStimulus = sequence[currentTrial];
            if (currentStimulus?.letter) {
                const trialToPlay = currentTrial;
                audioTriggeredForTrial.current = trialToPlay;
                // console.log(`[GameContext Audio Effect] Playing letter '${currentStimulus.letter}' for trial ${trialToPlay}.`);
                queueMicrotask(() => {
                    if (latestGameStateRef.current === 'playing' && currentTrialRef.current === trialToPlay) {
                        // console.log(`[GameContext Audio Effect] Double check passed for playing letter '${currentStimulus.letter}'`);
                         const selectedVoiceId = settings?.selectedVoiceId;
                         if (!selectedVoiceId) { console.error(`[GameContext Audio Effect] No voice selected. Cannot play audio.`); setFeedbackMessage("Warning: No audio voice selected in settings."); return; }
                         // TODO(2026-06-11): revert this playItem call to the simple 3-arg form and delete the onBufferReady/onSourceStart blocks. Diagnostic added 2026-05-12; see memory/project_audio_timing_instrumentation_todo.md
                         // Diagnostic instrumentation: capture call-time, post-await time, and
                         // post-source.start() time + audioContext clock to localize where audio lag accrues.
                         // Trial-aligned via trialToPlay closure.
                         audioManager.playItem(currentStimulus.letter, difficultyRef.current, {
                             voiceId: selectedVoiceId,
                             onBufferReady: ({ wasCached }) => {
                                 logReplayEvent({
                                     type: 'audioBufferReady',
                                     trialIndex: trialToPlay,
                                     timestamp: Date.now(),
                                     wasCached,
                                 });
                             },
                             onSourceStart: ({ audioContextTime, outputLatency, baseLatency }) => {
                                 logReplayEvent({
                                     type: 'audioSourceStart',
                                     trialIndex: trialToPlay,
                                     timestamp: Date.now(),
                                     audioContextTime,
                                     outputLatency,
                                     baseLatency,
                                 });
                             },
                         });
                         const playedTimestamp = Date.now();
                         logReplayEvent({
                             type: 'audioStimulusStart',
                             trialIndex: trialToPlay,
                             timestamp: playedTimestamp,
                             letter: currentStimulus.letter,
                             voice: selectedVoiceId,
                             difficulty: difficultyRef.current
                         });
                    }
                    // else { console.log(`[GameContext Audio Effect] Double check FAILED for playing letter. State: ${latestGameStateRef.current}, Trial: ${currentTrialRef.current} vs ${trialToPlay}`); }
                });
            }
            // else { console.log(`[GameContext Audio Effect] No letter for trial ${currentTrial} or already triggered.`); }
        } else if (gameState !== 'playing' && gameState !== 'paused') { audioManager.stopCurrentSound(); }
    }, [gameState, currentTrial, sequence, settings, logReplayEvent, setFeedbackMessage]);

    useEffect(() => {
        // timerRef.current will now hold the setTimeout ID
        if (timerRef.current) { 
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        if (gameState === 'playing') {
            const isiMs = (sessionSettingsRef.current?.calculatedISI ?? 2.5) * 1000; // Base ISI in ms
            const baseVariabilityOffsetMs = sessionSettingsRef.current?.baseVariabilityOffsetMs ?? 0; // Should be 0 with current backend logic
            const maxRandomVariabilityOffsetMs = sessionSettingsRef.current?.maxRandomVariabilityOffsetMs ?? 0;

            if (isNaN(isiMs) || isiMs <= 0) { 
                console.error(`Invalid base ISI (${isiMs}ms). Game cannot proceed.`);
                setGameState('idle'); setFeedbackMessage("Error: Invalid game speed configuration."); return; 
            }
            
            // console.log(`[GameContext Timer Effect] Initializing for 'playing' state. BaseISI: ${isiMs}ms, BaseVar: ${baseVariabilityOffsetMs}ms, MaxRandVar: ${maxRandomVariabilityOffsetMs}ms. CurrentTrial: ${currentTrialRef.current}`);

            const advanceAndScheduleNext = () => {
                if (isEndingRef.current || latestGameStateRef.current !== 'playing') {
                    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
                    return;
                }

                setCurrentTrial(prevTrial => {
                    const nextTrial = prevTrial + 1;
                    const totalTrialsFromRef = totalTrialsRef.current;

                    if (nextTrial >= totalTrialsFromRef) {
                        // console.log(`Trial ${nextTrial}/${totalTrialsFromRef}. Reached end of sequence. Ending game.`);
                        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }

                        // Check for missed matches on last trial, show feedback, then end-or-continue
                        const lastTrialIndex = prevTrial;
                        const finishHandler = () => {
                            // Continuous-mode interceptor: if a chain is active and not yet capped,
                            // route block-end to the chain handler (capture + advance OR save chain).
                            // Otherwise fall through to standard endGame.
                            if (continuousChainRef.current?.isActive) {
                                queueMicrotask(() => handleContinuousBlockEnd());
                            } else {
                                queueMicrotask(() => endGame());
                            }
                        };
                        if (checkLastTrialMissedFeedbackRef.current) {
                            checkLastTrialMissedFeedbackRef.current(lastTrialIndex).then(finishHandler);
                        } else {
                            finishHandler();
                        }
                        return prevTrial;
                    } else {
                        const onsetTime = Date.now();
                        stimulusOnsetTimeRef.current[nextTrial] = onsetTime;  // Store for RT calculation
                        logReplayEvent({ type: 'trialStart', trialIndex: nextTrial, timestamp: onsetTime });

                        const randomVariabilityMs = getWeightedRandomVariability(maxRandomVariabilityOffsetMs);

                        const currentTotalIsiMs = isiMs + baseVariabilityOffsetMs + randomVariabilityMs; // baseVariabilityOffsetMs is likely 0
                        const nextTimeoutDurationMs = Math.max(100, currentTotalIsiMs);

                        // (Continuous Mode mid-block prefetch removed — buffer-trial architecture
                        // fires generation at block-end with full d', not mid-block with partial d'.
                        // See handleContinuousBlockEnd for the new path.)
                        timerRef.current = setTimeout(advanceAndScheduleNext, nextTimeoutDurationMs);
                        return nextTrial;
                    }
                });
            };

            // Determine the delay for the *first* advancement (from currentTrial -1 to 0)
            let initialDelayMs;
            if (currentTrialRef.current === -1) { // This is the very start of the game, after countdown
                initialDelayMs = 250; // Fixed short delay for the first trial to appear quickly
            } else {
                // This branch would be for resuming a game that was already in progress,
                // or if somehow gameState became 'playing' when currentTrial was already >= 0.
                // In this case, apply full (weighted) variability for the next step.
                const randomVariabilityMs = getWeightedRandomVariability(maxRandomVariabilityOffsetMs);
                initialDelayMs = Math.max(100, isiMs + baseVariabilityOffsetMs + randomVariabilityMs); // baseVariabilityOffsetMs is likely 0
            }
            
            timerRef.current = setTimeout(advanceAndScheduleNext, initialDelayMs);
        }

        return () => {
            if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; /* console.log("[GameContext Timer Effect] Timer cleared on cleanup or gameState change."); */ }
        };
        // `sequence` added to deps so the effect re-fires when continuous mode loads
        // a new block's sequence (sessionSettings update + setSequence happens in handleContinuousBlockEnd).
        // For non-continuous play `sequence` only changes at game start (already covered by gameState),
        // so this adds no extra effect runs.
    }, [gameState, endGame, logReplayEvent, setCurrentTrial, setGameState, setFeedbackMessage, sequence, handleContinuousBlockEnd]);

    useEffect(() => {
        if (gameState === 'idle' && modeProgressionData) {
            const profileNBack = modeProgressionData.currentNBack ?? 2;
            // --- MODIFICATION: Ensure difficulty is capped at 0.99 for display/logic consistency ---
            const profileDifficulty = Math.max(0, Math.min(0.99, modeProgressionData.currentDifficulty ?? 0.0));
            const profileStreak = modeProgressionData.consecutiveSuccesses ?? 0;
            if (nBack !== profileNBack) { setNBack(profileNBack); }
            if (Math.abs(difficulty - profileDifficulty) > 0.001) { setDifficulty(profileDifficulty); }
            if (consecutiveSuccesses !== profileStreak) { setConsecutiveSuccesses(profileStreak); }
            if (!saveToProfile) { setSaveToProfile(true); }
            if (showCountdown) { setShowCountdown(false); }
            if (pauseReason !== null) { setPauseReason(null); }
        }
    }, [
        modeProgressionData, gameState,
        nBack, difficulty, consecutiveSuccesses, saveToProfile, showCountdown, pauseReason,
        setNBack, setDifficulty, setConsecutiveSuccesses, setSaveToProfile, setShowCountdown, setPauseReason
    ]);

    // Recovery function for restoring results after a page refresh
    const recoverSession = useCallback((results) => {
        setGameResults(results);
        setGameState('results');
    }, []);

    const value = useMemo(() => ({
        gameState, nBack, difficulty, sequence, currentTrial, totalTrials, gameResults,
        feedbackMessage, consecutiveSuccesses,
        // Start failures only — see the state declaration for why this is not feedbackMessage.
        startFailureMessage, setStartFailureMessage,
        showCountdown, saveToProfile, pauseReason,
        // Game mode (NEW)
        gameMode: activeGameMode,
        pauseGame, resumeGame, clearPauseReason, playAfterCountdown, registerResponse,
        setManualSettings, startGame, endGame, recoverSession,
        logReplayEvent, cancelPreparation, setSaveToProfile, setNavigationHandler,
        resetContextResponseArrays,
        isMatch, getStimulusDuration, getInstantFeedbackEnabled, getCoachingMessage, getFeatureIntroMessage,
        getVisualMatches, getAudioMatches, getUserVisualResponses, getUserAudioResponses,
        // NEW: Color/Shape getters and actions
        getColorMatches, getShapeMatches, getUserColorResponses, getUserShapeResponses,
        registerColorResponse, registerShapeResponse,
        isColorMatch, isShapeMatch,
        // Recall Mode (singleColorRecall)
        registerColorRecallSelection, isRecallSelectionCorrect, colorRecallSelectionsRef,
        goToPreviousNBackLevel,
        goToNextNBackLevelZero,
        resumeAudio: audioManager.resume, playFeedbackSound,
        latestGameStateRef, sessionSettingsRef, currentTrialRef, isEndingRef,
        stimulusOnsetTimeRef,  // For RT calculation in useGameResponses
        checkLastTrialMissedFeedbackRef,  // For last-trial missed feedback check
        resetResponsesRef,                // For clearing per-trial response tracking at continuous block transitions
        gameOriginRef, setGameOrigin,  // For returning to the page that started the game
        // --- Continuous Mode actions + ref ---
        startContinuousChain,
        stopAndSaveContinuousChain,
        resetContinuousChainState,
        continuousChainRef,         // Components can read isActive / blocks.length / chainStartedAt for UI
    }), [
        gameState, nBack, difficulty, sequence, currentTrial, totalTrials, gameResults,
        feedbackMessage, consecutiveSuccesses, showCountdown,
        startFailureMessage, setStartFailureMessage,
        saveToProfile, pauseReason, activeGameMode,
        pauseGame, resumeGame, clearPauseReason, playAfterCountdown, registerResponse,
        setManualSettings, startGame, endGame, recoverSession, logReplayEvent, cancelPreparation,
        setSaveToProfile, setNavigationHandler,
        resetContextResponseArrays,
        isMatch, getStimulusDuration, getInstantFeedbackEnabled, getCoachingMessage, getFeatureIntroMessage,
        getVisualMatches, getAudioMatches, getUserVisualResponses, getUserAudioResponses,
        getColorMatches, getShapeMatches, getUserColorResponses, getUserShapeResponses,
        registerColorResponse, registerShapeResponse, isColorMatch, isShapeMatch,
        registerColorRecallSelection, isRecallSelectionCorrect,
        goToPreviousNBackLevel,
        goToNextNBackLevelZero,
        playFeedbackSound,
        latestGameStateRef, sessionSettingsRef, currentTrialRef, isEndingRef,
        setGameOrigin,
        startContinuousChain, stopAndSaveContinuousChain, resetContinuousChainState
    ]);

    return (
        <GameContext.Provider value={value}>
            {children}
        </GameContext.Provider>
    );
};
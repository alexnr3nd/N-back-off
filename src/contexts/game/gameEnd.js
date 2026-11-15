/* File: src/contexts/game/gameEnd.js */
import { auth } from '../../firebaseConfig'; // Firebase auth instance
import { generateFeedbackMessage } from '../gameFeedback'; // Helper for generating user feedback
import { isAuthError, isFetchNetworkError, isAppCheckAttestationError, calculateAndSaveResultsCall } from './gameCloudFunctions'; // Helper for detecting auth/network errors + game save callable
import { generateClientSessionId, enqueue } from '../../utils/offlineSaveQueue';
import { prefetchSequence } from '../../utils/sequencePrefetcher';
import { isFirestoreBroken } from '../../utils/firestoreRecovery';
import { trackEvent } from '../../utils/analyticsTracker';
import { isRecoveryReloadArmed, holdRecoveryReload } from '../../utils/appCheckHealth';
import { DAILY_ADAPTIVE_CAP } from '../../constants/gameConstants';

// When the App Check SDK is wedged the save is queued and appCheckHealth arms a reload
// (fires once the dashboard is up). The overlay stays up with an honest message until
// then; this is the safety hide in case the reload never lands.
const RECOVERY_OVERLAY_SAFETY_HIDE_MS = 10000;
const isTokenStuckError = (error) => error?.code === 'appcheck-deadline' || error?.code === 'appcheck-stuck-probe';

// Enhanced Helper function to sanitize data for JSON stringification with cycle detection
// Prevents errors when trying to stringify complex objects (like React state or refs)
function sanitizeForJSON(obj, depth = 0, maxDepth = 15, visited = new Set()) {
    if (depth > maxDepth) return "[Max Depth Exceeded]"; // Prevent infinite recursion
    if (typeof window !== 'undefined' && obj === window) return "[Window Object]";
    if (typeof document !== 'undefined' && obj === document) return "[Document Object]";
    if (typeof obj?.nodeType === 'number' && typeof obj?.nodeName === 'string') return `[DOM Element <${obj.nodeName}>]`; // Basic DOM element check
    if (obj instanceof Event) return `[Event type: ${obj.type}]`; // Handle Event objects
    if (obj?.$$typeof === Symbol.for('react.element')) return "[React Element]"; // Handle React elements
    if (obj === null || typeof obj !== 'object') return obj; // Handle primitives and null
    if (visited.has(obj)) return "[Circular Reference Detected]"; // Detect circular references
    visited.add(obj); // Mark object as visited for this path
    let sanitizedData = null;
    try {
        if (obj instanceof Date) sanitizedData = obj.toISOString(); // Serialize Dates
        else if (Array.isArray(obj)) { // Recursively sanitize array elements
            sanitizedData = [];
            for (const item of obj) { if (typeof item !== 'function' && typeof item !== 'undefined' && typeof item !== 'symbol') { sanitizedData.push(sanitizeForJSON(item, depth + 1, maxDepth, visited)); } }
        } else { // Recursively sanitize object properties
            sanitizedData = {};
            for (const key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { const value = obj[key]; if (typeof value !== 'function' && typeof value !== 'undefined' && typeof value !== 'symbol') { sanitizedData[key] = sanitizeForJSON(value, depth + 1, maxDepth, visited); } } }
        }
    } catch (error) { console.error(`[sanitizeForJSON] Error during recursion at depth ${depth}:`, error); sanitizedData = "[Sanitization Error]"; }
    finally { visited.delete(obj); } // Remove from visited set after processing its branch
    return sanitizedData;
}


/**
 * Factory function returning the *logic* for ending a game session.
 * This function encapsulates the process of calculating results (potentially skipping),
 * updating profile state, and transitioning the game state appropriately.
 * It accepts an options object to modify its behavior, such as skipping the results
 * calculation and display, which is useful when abandoning a session via navigation.
 *
 * @param {object} dependencies - Dependencies required for the action.
 * @param {object|null} dependencies.activeProfile - The current user profile object.
 * @param {boolean} dependencies.saveToProfile - Flag indicating if results should update profile progress.
 * @param {Function} dependencies.logReplayEvent - Function to log replay events.
 * @param {Function} dependencies.setGameState - Setter for the main game state.
 * @param {Function} dependencies.setGameResults - Setter for the game results object.
 * @param {Function} dependencies.setFeedbackMessage - Setter for user feedback messages.
 * @param {Function} dependencies.setCurrentTrial - Setter for the current trial index.
 * @param {Function} dependencies.setSequence - Setter for the game sequence array.
 * @param {Function} dependencies.setTotalTrials - Setter for the total trials count.
 * @param {Function} dependencies.setNBack - Setter for the N-back level state.
 * @param {Function} dependencies.setDifficulty - Setter for the difficulty state.
 * @param {Function} dependencies.setConsecutiveSuccesses - Setter for the consecutive successes state.
 * @param {Function} dependencies.setSaveToProfile - Setter for the saveToProfile flag state.
 * @param {Function} dependencies.updateProfileProgress - Action from ProfileContext to update profile data.
 * @param {Function} dependencies.setPauseReason - Setter for the pause reason state.
 * @param {React.MutableRefObject<string>} dependencies.latestGameStateRef - Ref to the latest game state.
 * @param {React.MutableRefObject<number>} dependencies.nBackRef - Ref to the latest N-back level.
 * @param {React.MutableRefObject<number>} dependencies.difficultyRef - Ref to the latest difficulty.
 * @param {Function} dependencies.showLoading - Function to show loading indicator.
 * @param {Function} dependencies.hideLoading - Function to hide loading indicator.
 * @param {React.MutableRefObject<number>} dependencies.consecutiveSuccessesRef - Ref to the latest streak count.
 * @param {React.MutableRefObject<number>} dependencies.currentTrialRef - Ref to the latest trial index.
 * @param {React.MutableRefObject<number>} dependencies.totalTrialsRef - Ref to the latest total trials count.
 * @param {React.MutableRefObject<Function|null>} dependencies.onNavigateRef - Ref holding the navigate function.
 * @param {React.MutableRefObject<boolean>} dependencies.isEndingRef - Ref indicating if the ending process is active.
 * @param {React.MutableRefObject<number[]>} dependencies.visualResponsesRef - Ref to user's visual responses.
 * @param {React.MutableRefObject<number[]>} dependencies.audioResponsesRef - Ref to user's audio responses.
 * @param {React.MutableRefObject<object|null>} dependencies.sessionSettingsRef - Ref to current session's settings.
 * @param {React.MutableRefObject<number|null>} dependencies.sessionStartTimeRef - Ref to session start timestamp.
 * @param {React.MutableRefObject<object[]>} dependencies.replayEventsRef - Ref to replay event log.
 * @param {string} dependencies.sequenceLanguage - Sequence language code from
 *   `getSequenceLanguage(settings)` (a LANGUAGE_AUDIO_LETTERS key, e.g. 'en'). Used for the
 *   post-save prefetch of the NEXT level; it is part of the sequence-cache key, so it must be
 *   the same string game start derives or the cached entry is never read.
 * @returns {Function} An async function that ends the game, optionally skipping results calculation.
 */
export function createEndGameAction({
    activeProfile, saveToProfile, logReplayEvent,
    setGameState, setGameResults, setFeedbackMessage,
    setCurrentTrial, setSequence, setTotalTrials,
    setNBack, setDifficulty, setConsecutiveSuccesses, setSaveToProfile,
    updateProfileProgress, setPauseReason,
    latestGameStateRef, nBackRef, difficultyRef,
    showLoading, hideLoading,
    consecutiveSuccessesRef, currentTrialRef, totalTrialsRef, onNavigateRef,
    isEndingRef, visualResponsesRef, audioResponsesRef,
    colorResponsesRef, shapeResponsesRef,  // NEW: for triple/quad modes
    colorRecallSelectionsRef,  // Recall Mode selections (singleColorRecall): trialIndex -> color.
                               // Threaded here for the save payload; startGameLogic owns the reset.
    sessionSettingsRef, sessionStartTimeRef, replayEventsRef,
    sequenceLanguage = 'en',  // Sequence-cache / letter-set key for the post-save prefetch
    addLocalSession,  // Optimistic session injection to avoid onSnapshot race
    setTotalSessions, // Update total session count (for session-gated free trial)
    // Daily Adaptive cap (relaunch monetization, May 2026)
    setDailyAdaptiveCount, setShowDailyCapModal, setDailyCapInfo,
    gameMode = 'dual',  // Game mode for mode-specific progression
}) {

    /**
     * The core logic function returned by the factory. Ends the game session.
     * @param {object} [options={}] - Options to modify behavior.
     * @param {boolean} [options.skipResultsProcessing=false] - If true, skips backend call, results calculation, and showing results screen. Used for abandoning session.
     */
    return async (options = { skipResultsProcessing: false }) => {
        const functionStartTime = Date.now(); // Capture start time early for consistent logging ID
        // --- Guard Clauses & Initialization ---
        if (!isEndingRef) { // Check if the ref object itself is missing
            console.error(`[gameEnd Logic ${functionStartTime}] CRITICAL ABORT: isEndingRef object is missing.`);
            // Attempt to set a feedback message if possible, though other things might be broken too
            if (typeof setFeedbackMessage === 'function') {
                setFeedbackMessage("Critical error: Game ending mechanism is broken.");
            }
            if (typeof setGameState === 'function') {
                setGameState('idle'); // Try to reset to a safe state
            }
            return;
        }

        if (isEndingRef.current) { 
            console.warn(`[gameEnd Logic ${functionStartTime}] Aborted: Already ending.`); 
            return; 
        }
        
        const localGameState = latestGameStateRef?.current;
        if (localGameState === 'results' || localGameState === 'idle') { 
            console.warn(`[gameEnd Logic ${functionStartTime}] Aborted: Game already in state '${localGameState}'.`); 
            return; 
        }
        
        isEndingRef.current = true; // Set the flag immediately
        // Ensure a default value for endTime for logging in finally block, even if an early error occurs
        let endTime = Date.now();
        // Blocks the App Check recovery reload from the save call through the offline
        // enqueue (a back-out mid-game runs this headless on the dashboard). Idempotent.
        let releaseReloadHold = () => {};

        try {
            endTime = Date.now(); // Capture actual end time before processing
            if (typeof logReplayEvent === 'function') logReplayEvent({ type: 'gameEnd', timestamp: endTime });

            // --- Capture state/refs needed ---
            const currentTrial = currentTrialRef?.current;
            const totalTrialsPlanned = totalTrialsRef?.current;
            const navigate = onNavigateRef?.current;
            const startTime = sessionStartTimeRef?.current;
            const settingsFromSession = sessionSettingsRef?.current;
            const currentNBackContext = nBackRef?.current; 
            const currentDifficultyContext = difficultyRef?.current; 
            const currentStreakContext = consecutiveSuccessesRef?.current;

            // --- Minimal Reset and Exit Logic (if skipping results) ---
            if (options.skipResultsProcessing) {
                if (typeof logReplayEvent === 'function') {
                    logReplayEvent({ type: 'sessionDiscarded', reason: 'user_confirmed_leave', trialsCompleted: (currentTrial ?? -1) + 1 });
                }
                // Minimal state reset
                setGameState('idle'); setCurrentTrial(-1); setGameResults(null); setFeedbackMessage('');
                setSequence([]); setTotalTrials(0); setPauseReason(null);
                if (visualResponsesRef) visualResponsesRef.current = []; if (audioResponsesRef) audioResponsesRef.current = [];
                if (colorResponsesRef) colorResponsesRef.current = []; if (shapeResponsesRef) shapeResponsesRef.current = [];
                if (sessionSettingsRef) sessionSettingsRef.current = null; if (replayEventsRef) replayEventsRef.current = [];
                if (sessionStartTimeRef) sessionStartTimeRef.current = null;
                setSaveToProfile(true);
                return; // Exit (finally block will still run to reset isEndingRef)
            }

            // --- Standard Game End Flow ---
            if (currentTrial === undefined || totalTrialsPlanned === undefined || startTime === null || !settingsFromSession ||
                currentNBackContext === undefined || currentDifficultyContext === undefined || currentStreakContext === undefined) {
                console.error(`[gameEnd Logic ${functionStartTime}] Error: Missing critical session refs/state for standard end. Aborting.`);
                setGameState('idle'); setFeedbackMessage("Error ending game: Critical data missing.");
                setPauseReason(null);
                return; // Exit (finally block will still run)
            }

            // --- Handle standard session discard (too few trials) ---
            const trialsCompleted = Math.max(0, (currentTrial ?? -1) + 1);
            const endedEarly = trialsCompleted < (totalTrialsPlanned ?? 0);
            const discardThreshold = Math.max(1, Math.min(10, totalTrialsPlanned > 0 ? Math.ceil(totalTrialsPlanned * 0.5) : 10));
            if (endedEarly && trialsCompleted < discardThreshold) {
                 console.warn(`[gameEnd Logic ${functionStartTime}] Session discarded locally (completed ${trialsCompleted} < threshold ${discardThreshold}). Resetting state and navigating to dashboard.`);
                 if (typeof logReplayEvent === 'function') {
                    logReplayEvent({ type: 'sessionDiscarded', reason: 'early_quit_below_threshold', trialsCompleted, discardThreshold });
                 }
                 // Full state reset and navigate to dashboard
                 setGameState('idle'); setCurrentTrial(-1); setGameResults(null); setFeedbackMessage(''); setSequence([]); setTotalTrials(0);
                 setPauseReason(null);
                 if (visualResponsesRef) visualResponsesRef.current = []; if (audioResponsesRef) audioResponsesRef.current = [];
                 if (colorResponsesRef) colorResponsesRef.current = []; if (shapeResponsesRef) shapeResponsesRef.current = [];
                 if (sessionSettingsRef) sessionSettingsRef.current = null; if (replayEventsRef) replayEventsRef.current = [];
                 if (sessionStartTimeRef) sessionStartTimeRef.current = null;
                 setSaveToProfile(true);
                 if (activeProfile) { setNBack(activeProfile.currentNBack ?? 2); setDifficulty(Math.max(0, Math.min(0.99, activeProfile.currentDifficulty ?? 0.0))); setConsecutiveSuccesses(activeProfile.consecutiveSuccesses ?? 0); }
                 else { setNBack(2); setDifficulty(0.0); setConsecutiveSuccesses(0); }
                 // Skip our own navigate when the navigation blocker (GameScreen) is the caller —
                 // it drives navigation via blocker.proceed(), and two competing history operations
                 // race and throw "Invalid blocker state transition". See plan delegated-coalescing-hammock.
                 if (!options.skipDiscardNavigate) {
                     if (navigate && typeof navigate === 'function') { queueMicrotask(() => navigate('/dashboard', { replace: true })); }
                     else { console.error("[gameEnd Logic] Navigate handler missing after discard."); }
                 }
                 return; // Exit (finally block will still run)
            }

            // --- Prepare payload for backend results calculation ---
            if (!visualResponsesRef || !audioResponsesRef || !replayEventsRef) { console.error(`[gameEnd Logic ${functionStartTime}] Missing response/replay refs!`); setFeedbackMessage("Error: Cannot save results, missing data."); setGameState('idle'); /* finally handles isEndingRef */ return; }
            const visualResponsesPlayed = visualResponsesRef.current.filter(idx => idx < trialsCompleted);
            const audioResponsesPlayed = audioResponsesRef.current.filter(idx => idx < trialsCompleted);
            // NEW: Color and shape responses for triple/quad modes
            const colorResponsesPlayed = colorResponsesRef?.current?.filter(idx => idx < trialsCompleted) || [];
            const shapeResponsesPlayed = shapeResponsesRef?.current?.filter(idx => idx < trialsCompleted) || [];
            let sanitizedEvents = []; let serializableSettingsForReplay = {};
            try {
                const settingsToSanitize = {
                     nBack: settingsFromSession?.nBack, difficulty: settingsFromSession?.difficulty,
                     calculatedISI: settingsFromSession?.calculatedISI, stimulusDuration: settingsFromSession?.stimulusDuration,
                     totalTrials: settingsFromSession?.totalTrials, isPlayground: settingsFromSession?.isPlayground,
                     baseVariabilityOffsetMs: settingsFromSession?.baseVariabilityOffsetMs,
                     maxRandomVariabilityOffsetMs: settingsFromSession?.maxRandomVariabilityOffsetMs,
                     gameMode: settingsFromSession?.gameMode || 'dual',
                };
                serializableSettingsForReplay = sanitizeForJSON(settingsToSanitize);
                if (Array.isArray(replayEventsRef.current)) { sanitizedEvents = replayEventsRef.current.map(event => sanitizeForJSON(event)); }
            } catch (sanitizeError) { console.error(`[gameEnd Logic ${functionStartTime}] Error sanitizing replay data:`, sanitizeError); setFeedbackMessage("Warning: Could not fully prepare replay data."); }

            // --- Extract Response Times from Replay Events for Fatigue Detection ---
            const responseTimes = { visual: [], audio: [], color: [], shape: [] };
            try {
                if (Array.isArray(replayEventsRef.current)) {
                    for (const event of replayEventsRef.current) {
                        if (event.responseLatency != null && event.responseLatency > 0 && event.responseLatency < 10000) {
                            if (event.type === 'responsePosition') {
                                responseTimes.visual.push(event.responseLatency);
                            } else if (event.type === 'responseAudio') {
                                responseTimes.audio.push(event.responseLatency);
                            } else if (event.type === 'responseColor') {
                                responseTimes.color.push(event.responseLatency);
                            } else if (event.type === 'responseShape') {
                                responseTimes.shape.push(event.responseLatency);
                            } else if (event.type === 'responseColorRecall') {
                                // Recall selections reuse the color RT bucket — a session is
                                // either Recall or color-match, never both, so they can't mix.
                                responseTimes.color.push(event.responseLatency);
                            }
                        }
                    }
                }
            } catch (rtError) {
                console.error(`[gameEnd Logic ${functionStartTime}] Error extracting response times:`, rtError);
            }
            // --- End Response Times Extraction ---

            const replayData = { version: 1, startTime: startTime, settings: serializableSettingsForReplay, events: sanitizedEvents };
            const shouldSaveProgress = !settingsFromSession?.isPlayground && saveToProfile;

            // Recall sessions progress on the 'singleColorRecall' track, so the
            // pre-session highest must come from that track — activeProfile.highestNBack
            // is the active mode's (singleColor) number.
            const isRecallSave = settingsFromSession?.gameMode === 'singleColorRecall';
            const preSessionContext = {
                originalNBack: currentNBackContext,
                originalDifficulty: currentDifficultyContext,
                originalConsecutiveSuccesses: currentStreakContext,
                originalHighestAchievedNBack: isRecallSave
                    ? (activeProfile?.recallProgression?.highestNBack ?? currentNBackContext)
                    : (activeProfile?.highestNBack ?? currentNBackContext)
            };

            if (typeof preSessionContext.originalConsecutiveSuccesses !== 'number' || isNaN(preSessionContext.originalConsecutiveSuccesses)) { console.error("preSessionContext invalid", preSessionContext); setFeedbackMessage("Error: Cannot save results, invalid internal state."); setGameState('idle'); /* finally handles isEndingRef */ return; }
            const sequencePlayed = settingsFromSession?.generatedSequence?.slice(0, trialsCompleted) || [];
            // Recall Mode answers, densified: index i is the color chosen for trial i, or null
            // for a blank. Sized to trialsCompleted so it matches `sequencePlayed` above — the
            // server rejects the save on any length mismatch (a shorter array would silently
            // score the missing trials as blanks). Built here, next to the slice it must match,
            // rather than up with the response filters, so the invariant is visible in one place.
            const recallSelectionsPlayed = isRecallSave
                ? Array.from({ length: trialsCompleted }, (_, i) => colorRecallSelectionsRef?.current?.[i] ?? null)
                : null;

            // Construct sessionDataForPayload, ensuring all expected fields (including new variability ones) are present
            const sessionDataForPayload = {
                nBack: Number(settingsFromSession?.nBack ?? 0),
                difficulty: Number(settingsFromSession?.difficulty ?? 0),
                calculatedISI: Number(settingsFromSession?.calculatedISI ?? 0),
                stimulusDuration: Number(settingsFromSession?.stimulusDuration ?? 0),
                baseVariabilityOffsetMs: Number(settingsFromSession?.baseVariabilityOffsetMs ?? 0),
                maxRandomVariabilityOffsetMs: Number(settingsFromSession?.maxRandomVariabilityOffsetMs ?? 0),
                totalTrialsPlanned: Number(totalTrialsPlanned ?? 0),
                trialsCompleted: Number(trialsCompleted ?? 0),
                isPlayground: Boolean(settingsFromSession?.isPlayground ?? false),
                isPartialResult: Boolean(endedEarly ?? false),
                showReport: settingsFromSession?.showReport !== false,
                saveToProfile: Boolean(shouldSaveProgress ?? false),
                totalTrials: Number(settingsFromSession?.totalTrials ?? totalTrialsPlanned ?? 0),
                sequence: sequencePlayed,
                preSessionProfileContext: preSessionContext,
                gameMode: settingsFromSession?.gameMode || gameMode,  // Use resolved sub-mode (not 'dynamic')
                // Training mode metadata (passed through to backend for Classic/Adaptive/Dynamic routing)
                ...(settingsFromSession?.trainingMode && { trainingMode: settingsFromSession.trainingMode }),
                ...(settingsFromSession?.currentSubMode && { currentSubMode: settingsFromSession.currentSubMode }),
                ...(settingsFromSession?.clientVersion && { clientVersion: settingsFromSession.clientVersion }),
                // Color customization snapshot (additive optional fields; old backend
                // accepts absence, old replay viewers fall back to the legacy colorToHex
                // map). The fingerprint is for analytics bucketing across users on the
                // same palette.
                ...(settingsFromSession?.colorPaletteId && { paletteId: settingsFromSession.colorPaletteId }),
                ...(settingsFromSession?.colorPalette && { palette: settingsFromSession.colorPalette }),
                ...(settingsFromSession?.colorPaletteFingerprint && { paletteHash: settingsFromSession.colorPaletteFingerprint }),
                ...(settingsFromSession?.colorThemeAtPlayTime && { themeAtPlayTime: settingsFromSession.colorThemeAtPlayTime }),
            };


            let validationOk = true;
            if (typeof sessionDataForPayload.nBack !== 'number' || sessionDataForPayload.nBack < 1) { validationOk = false; console.error("Validation fail: nBack", sessionDataForPayload.nBack); }
            if (typeof sessionDataForPayload.difficulty !== 'number' || 
                (sessionDataForPayload.difficulty < 0 && !sessionDataForPayload.isPlayground) || 
                sessionDataForPayload.difficulty > 1) { 
                validationOk = false; console.error("Validation fail: difficulty", sessionDataForPayload.difficulty); 
            }
            if (typeof sessionDataForPayload.trialsCompleted !== 'number' || sessionDataForPayload.trialsCompleted < 0) { validationOk = false; console.error("Validation fail: trialsCompleted", sessionDataForPayload.trialsCompleted); }
            // Also validate new variability params if present (they should be numbers)
            if (sessionDataForPayload.baseVariabilityOffsetMs === undefined || typeof sessionDataForPayload.baseVariabilityOffsetMs !== 'number') { validationOk = false; console.error("Validation fail: baseVariabilityOffsetMs", sessionDataForPayload.baseVariabilityOffsetMs); }
            if (sessionDataForPayload.maxRandomVariabilityOffsetMs === undefined || typeof sessionDataForPayload.maxRandomVariabilityOffsetMs !== 'number') { validationOk = false; console.error("Validation fail: maxRandomVariabilityOffsetMs", sessionDataForPayload.maxRandomVariabilityOffsetMs); }


            if (!validationOk) { console.error(`[gameEnd Logic ${functionStartTime}] Frontend payload validation failed! Aborting backend call.`, sessionDataForPayload); setFeedbackMessage("Error: Failed internal validation before saving."); setGameState('idle'); /* finally handles isEndingRef */ return; }
            const clientSessionId = generateClientSessionId();
            const payload = {
                clientSessionId,                           // For idempotent offline retry
                profileId: activeProfile?.id || null,
                sessionData: sessionDataForPayload,
                userVisualResponses: visualResponsesPlayed,
                userAudioResponses: audioResponsesPlayed,
                userColorResponses: colorResponsesPlayed,  // NEW: for triple/quad modes
                userShapeResponses: shapeResponsesPlayed,  // NEW: for quad mode
                // Recall Mode only — absent (spread no-op) on every Match session
                ...(recallSelectionsPlayed && { userColorRecallSelections: recallSelectionsPlayed }),
                responseTimes: responseTimes,              // NEW: for fatigue detection
                replayData: replayData,
                timing: { startTime: startTime, endTime: endTime }
            };

            // --- Call Backend ---
            let fetchedBackendResults = null; let backendError = null;
            let keepOverlayForRecovery = false; // true = App Check wedged, reload armed, overlay stays up
            const backendCallStart = Date.now();
            // Captured NOW, not at enqueue time: a headless back-out save can take up to
            // ~110s (preflight + backstop) with the dashboard interactive, and a sign-out in
            // that window would otherwise store the entry unowned (replayable by the next
            // account on a shared device).
            const savingUid = auth.currentUser?.uid || null;
            releaseReloadHold = holdRecoveryReload('save');
            // Show loading indicator before the backend call (theme-aware for light mode)
            if (typeof showLoading === 'function') {
                showLoading("Finalizing session...", null, "auto");
            }

            try {
                 if (!auth.currentUser) throw new Error("User not authenticated.");
                 // Use httpsCallable (App Check enforced). The SDK attaches the App Check
                 // token and auth automatically — no manual header construction needed.
                 fetchedBackendResults = await calculateAndSaveResultsCall(payload);
                const saveLatencyMs = Date.now() - backendCallStart;
                // Hide loading immediately after backend success - don't wait for profile update
                if (typeof hideLoading === 'function') {
                    hideLoading();
                }

                // Save-latency telemetry (after hideLoading so a hypothetical trackEvent
                // throw can't be misclassified as a backend failure by the catch below).
                try {
                    trackEvent('session_save_latency', {
                        latency_ms: saveLatencyMs,
                        success: true,
                        game_mode: settingsFromSession?.gameMode || gameMode || 'dual',
                        training_mode: settingsFromSession?.trainingMode || 'unknown',
                    });
                } catch (_) { /* telemetry must never affect the save flow */ }

                // Profile update runs in background (non-blocking) to prevent UI hang
                if (shouldSaveProgress && activeProfile?.id && typeof updateProfileProgress === 'function' && !isFirestoreBroken()) {
                    if (typeof fetchedBackendResults?.newNBack === 'number' &&
                        typeof fetchedBackendResults?.newDifficulty === 'number' &&
                        typeof fetchedBackendResults?.newConsecutiveSuccesses === 'number') {

                        // Seed from the track this session actually progressed — seeding a recall
                        // save from the Match history would write Match's level map onto the
                        // recall track wholesale.
                        let newPreviousDifficulties = (isRecallSave
                            ? activeProfile.recallProgression?.previousNBackLevelDifficulties
                            : activeProfile.previousNBackLevelDifficulties) || {};
                        if (fetchedBackendResults.newNBack !== currentNBackContext) {
                            newPreviousDifficulties = {
                                ...newPreviousDifficulties,
                                [currentNBackContext]: currentDifficultyContext
                            };
                        }
                        const updatePayload = {
                            currentNBack: fetchedBackendResults.newNBack,
                            currentDifficulty: fetchedBackendResults.newDifficulty,
                            consecutiveSuccesses: fetchedBackendResults.newConsecutiveSuccesses,
                            // Compare against the track this session progressed. Using the Match
                            // highestNBack for a recall save can DOWNGRADE the recall best (recall
                            // high 6, de-promoted to 3, Match high 2, session ends at 4 → 4 > 2
                            // writes 4 over 6). Branch rather than always using preSessionContext:
                            // its `?? currentNBackContext` fallback would change Match behavior
                            // whenever highestNBack is absent (legacy docs), where `|| 0` is the
                            // established semantic.
                            ...(fetchedBackendResults.newNBack > ((isRecallSave ? preSessionContext.originalHighestAchievedNBack : activeProfile.highestNBack) || 0) && { highestNBack: fetchedBackendResults.newNBack }),
                            previousNBackLevelDifficulties: newPreviousDifficulties,
                            // Dynamic mode: update sub-mode from backend results
                            ...(fetchedBackendResults.newSubMode && { currentSubMode: fetchedBackendResults.newSubMode }),
                            // Route to classicProgression vs modeProgression based on session's trainingMode
                            ...(settingsFromSession?.trainingMode && { trainingMode: settingsFromSession.trainingMode }),
                            // Recall sessions progress the 'singleColorRecall' track. Without this the
                            // mirror would clobber modeProgression.singleColor with recall numbers
                            // (the backend already wrote the recall track correctly).
                            ...(isRecallSave && { gameMode: 'singleColorRecall' }),
                        };
                        // Fire-and-forget: don't await to prevent blocking if Firestore hangs
                        updateProfileProgress(activeProfile.id, updatePayload)
                            .catch(err => console.error(`[gameEnd Logic ${functionStartTime}] Profile update failed:`, err));
                    } else { console.error('[gameEnd Logic] Backend results missing fields for profile update.', fetchedBackendResults); }
                } else {
                    if (shouldSaveProgress) console.warn(`[gameEnd Logic ${functionStartTime}] Cannot update profile: Missing activeProfile.id or updateProfileProgress function.`);
                }

                // Prefetch next sequence in background (fire-and-forget).
                // The language MUST be the one getSequenceLanguage() derives from settings —
                // it is part of the cache key the next game start looks up. (It used to read
                // sessionSettingsRef.current.language, a field that never exists there: that
                // silently cached every "next level" sequence under an unread key.)
                if (typeof fetchedBackendResults?.newNBack === 'number' && typeof fetchedBackendResults?.newDifficulty === 'number') {
                    prefetchSequence({
                        gameMode: gameMode || 'dual',
                        nBack: fetchedBackendResults.newNBack,
                        difficulty: fetchedBackendResults.newDifficulty,
                        language: sequenceLanguage || 'en',
                        profileId: activeProfile?.id || null,
                    }).catch(() => {});
                }
            } catch (error) {
                 console.error(`[gameEnd Logic ${functionStartTime}] Backend call/processing failed:`, error);
                 backendError = error;

                 // Normalize the error code — different SDK versions emit 'functions/x' vs 'x'.
                 const normalizedCode = (error?.code || '').replace(/^functions\//, '');
                 const isDailyCap = normalizedCode === 'resource-exhausted' && error?.details?.reason === 'daily_cap';

                 if (isDailyCap) {
                     // Daily Adaptive cap hit (server-enforced). Surface the paywall modal.
                     // Cap errors are permanent (until tomorrow's TZ rollover) — do NOT queue offline.
                     console.info(`[gameEnd Logic ${functionStartTime}] Daily Adaptive cap reached. sessionsUsed=${error?.details?.sessionsUsed}, limit=${error?.details?.limit}`);
                     if (typeof setDailyCapInfo === 'function') {
                         setDailyCapInfo({
                             sessionsUsed: error?.details?.sessionsUsed ?? DAILY_ADAPTIVE_CAP,
                             dailyCap: error?.details?.limit ?? DAILY_ADAPTIVE_CAP,
                             source: 'post_save',
                         });
                     }
                     if (typeof setShowDailyCapModal === 'function') {
                         setShowDailyCapModal(true);
                     }
                     setFeedbackMessage(''); // suppress generic toast
                     setGameState('idle');   // unstick the game screen
                     trackEvent('daily_cap_reached', {
                         source: 'live_save',
                         sessionsUsed: error?.details?.sessionsUsed,
                     });
                 } else if (isFetchNetworkError(error) || isAppCheckAttestationError(error)) {
                     // Queue for offline retry. Covers a real offline blip, the SDK's
                     // fetch-level 'internal' failure, the app-imposed deadlines from
                     // gameCloudFunctions (wedged App Check, hung ID token, POST backstop),
                     // and an App Check attestation failure (queued too, but the drain
                     // retries that one a bounded number of times).
                     // enqueue() never throws — it returns null when IndexedDB failed.
                     const queued = await enqueue(payload, clientSessionId, { uid: savingUid });
                     if (queued) {
                         console.info(`[gameEnd Logic ${functionStartTime}] Session queued for offline retry. clientSessionId=${clientSessionId}`);
                         setFeedbackMessage(isAppCheckAttestationError(error)
                             ? 'App verification failed. Your session has been saved on this device and will retry automatically.'
                             : 'You appear to be offline. Your session has been saved locally and will sync when you reconnect.');
                         // A wedged App Check SDK can only be reset by a reload; appCheckHealth
                         // armed one when the preflight marked it stuck, and it fires once the
                         // dashboard is up. Keep the overlay (swap the text; hide+show would
                         // flash the dashboard first) so the reload happens under it.
                         if (isTokenStuckError(error) && isRecoveryReloadArmed()) {
                             keepOverlayForRecovery = true;
                             if (typeof showLoading === 'function') {
                                 showLoading('Session saved on this device. Reconnecting...', null, 'auto');
                             }
                         }
                     } else {
                         console.error(`[gameEnd Logic ${functionStartTime}] Failed to queue session: enqueue returned null. clientSessionId=${clientSessionId}`);
                         setFeedbackMessage('Network error and could not save locally. Your session may be lost.');
                     }
                 } else if (isAuthError(error)) {
                     // Check if this is an auth error (stale token after long idle)
                     console.error(`[gameEnd Logic ${functionStartTime}] Auth error detected - session expired during game.`);
                     setFeedbackMessage('Session expired. Your results may not have been saved. Please log in again after reviewing.');
                 } else {
                     setFeedbackMessage(error.message.includes("Backend Error") ? error.message : `Error processing results: ${error.message}. Please try again.`);
                 }

                 fetchedBackendResults = null; // Ensure it's null on error
                 // Hide loading on error too (unless the recovery reload is about to happen under it)
                 if (!keepOverlayForRecovery && typeof hideLoading === 'function') {
                    hideLoading();
                 }

                 // Save-latency telemetry, failure variant. Placed LAST in the catch
                 // (after daily-cap handling / offline enqueue / hideLoading) so a
                 // hypothetical trackEvent throw can't escape into the outer try,
                 // which has no catch.
                 try {
                     trackEvent('session_save_latency', {
                         latency_ms: Date.now() - backendCallStart,
                         success: false,
                         error_code: normalizedCode || 'unknown',
                         game_mode: settingsFromSession?.gameMode || gameMode || 'dual',
                         training_mode: settingsFromSession?.trainingMode || 'unknown',
                     });
                 } catch (_) { /* telemetry must never affect the save flow */ }
            }
            // Saved server-side or queued locally (or neither, and reported): the reload may proceed.
            releaseReloadHold();
            // --- State Transition Logic ---
            if (fetchedBackendResults && fetchedBackendResults.showReport !== false) {
                 const feedback = generateFeedbackMessage(fetchedBackendResults, preSessionContext?.originalDifficulty);
                 setFeedbackMessage(feedback || (backendError ? `Error: ${backendError.message}` : 'Session complete.'));
                 setGameResults(fetchedBackendResults);
                 // Update total session count (for session-gated free trial offer)
                 if (typeof fetchedBackendResults?.totalSessions === 'number' && typeof setTotalSessions === 'function') {
                     setTotalSessions(fetchedBackendResults.totalSessions);
                 }
                 // Update daily Adaptive counter from backend response (capped cohorts only;
                 // non-capped users won't have this field in the response).
                 if (typeof fetchedBackendResults?.dailyAdaptiveCount === 'number' && typeof setDailyAdaptiveCount === 'function') {
                     setDailyAdaptiveCount(fetchedBackendResults.dailyAdaptiveCount);
                 }
                 setGameState('results');
                 if (fetchedBackendResults?.sessionId) {
                     try { sessionStorage.setItem('lastResultsSessionId', fetchedBackendResults.sessionId); } catch(e) {}
                 }
                 // Optimistically inject session into activeSessions so the dashboard chart
                 // has it immediately (onSnapshot for server-side writes can lag)
                 if (typeof addLocalSession === 'function' && fetchedBackendResults.sessionId) {
                     const now = new Date().toISOString();
                     addLocalSession({
                         id: fetchedBackendResults.sessionId,
                         date: now,
                         recordedAt: now,
                         timestamp: now,
                         nBack: fetchedBackendResults.nBack,
                         difficulty: fetchedBackendResults.difficulty,
                         gameMode: fetchedBackendResults.gameMode || gameMode,
                         trainingMode: fetchedBackendResults.trainingMode || null,
                         overallDprime: fetchedBackendResults.overallDprime,
                         overallAccuracy: fetchedBackendResults.overallAccuracy ?? null,
                         visualAccuracy: fetchedBackendResults.visualAccuracy ?? null,
                         audioAccuracy: fetchedBackendResults.audioAccuracy ?? null,
                         visualDprime: fetchedBackendResults.visualDprime ?? null,
                         audioDprime: fetchedBackendResults.audioDprime ?? null,
                         colorAccuracy: fetchedBackendResults.colorAccuracy ?? null,
                         colorDprime: fetchedBackendResults.colorDprime ?? null,
                         shapeAccuracy: fetchedBackendResults.shapeAccuracy ?? null,
                         shapeDprime: fetchedBackendResults.shapeDprime ?? null,
                         durationMs: fetchedBackendResults.durationMs ?? 0,
                         newDifficulty: fetchedBackendResults.newDifficulty ?? 0,
                         newNBack: fetchedBackendResults.newNBack ?? 2,
                     });
                 }
            } else {
                 setFeedbackMessage(backendError ? backendError.message : 'Session ended without results.');
                 setGameResults(null);
                 setGameState('idle');
                 setCurrentTrial(-1); setSequence([]); setTotalTrials(0);
                 if (visualResponsesRef) visualResponsesRef.current = []; if (audioResponsesRef) audioResponsesRef.current = [];
                 if (colorResponsesRef) colorResponsesRef.current = []; if (shapeResponsesRef) shapeResponsesRef.current = [];
                 if (sessionSettingsRef) sessionSettingsRef.current = null; if (replayEventsRef) replayEventsRef.current = [];
                 if (sessionStartTimeRef) sessionStartTimeRef.current = null;
                 setSaveToProfile(true);
                 if (activeProfile && fetchedBackendResults) {
                     setNBack(fetchedBackendResults.newNBack ?? currentNBackContext ?? 2);
                     setDifficulty(fetchedBackendResults.newDifficulty ?? currentDifficultyContext ?? 0.0);
                     setConsecutiveSuccesses(fetchedBackendResults.newConsecutiveSuccesses ?? currentStreakContext ?? 0);
                 } else if (activeProfile) {
                     setNBack(activeProfile.currentNBack ?? 2);
                     setDifficulty(Math.max(0, Math.min(0.99, activeProfile.currentDifficulty ?? 0.0)));
                     setConsecutiveSuccesses(activeProfile.consecutiveSuccesses ?? 0);
                 } else {
                     setNBack(2); setDifficulty(0.0); setConsecutiveSuccesses(0);
                 }
                 if (navigate && typeof navigate === 'function') { queueMicrotask(() => navigate('/dashboard', { replace: true })); }
                 else { console.error("[gameEnd Logic] Navigate handler missing after backend fail/no report."); }
            }
            if (keepOverlayForRecovery && typeof hideLoading === 'function') {
                // The recovery reload normally lands within ~1.5s of the dashboard mounting.
                // If it never does (storage quirk, cooldown race), don't leave a stuck overlay.
                setTimeout(() => hideLoading(), RECOVERY_OVERLAY_SAFETY_HIDE_MS);
            }
            setPauseReason(null);
            // } // Inner try removed
        } finally {
            releaseReloadHold(); // no-op if already released; never leave the reload blocked
            // Ensure isEndingRef is reset regardless of how the function exits.
            // The setTimeout provides a brief window to allow other state updates to settle
            // and to prevent overly rapid re-entry if a click event is somehow doubled.
            setTimeout(() => {
                if (isEndingRef) { 
                    isEndingRef.current = false; 
                } else { 
                    // This case should ideally not be hit if the initial guard is correct
                    console.warn("[gameEnd Logic] isEndingRef missing in finally during reset attempt!"); 
                }
            }, 50); // Reduced delay for faster reset, adjust if needed
        }
    };
}
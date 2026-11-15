/* File: src/contexts/game/gameSetup.js */
import { auth } from '../../firebaseConfig'; // Import Firebase auth instance
import { signOut } from 'firebase/auth';

// Import the frontend wrapper function for the backend call
import { generateSequenceWithAuthRetry, isAuthError, isNetworkOrTimeoutError, isAppCheckAttestationError } from './gameCloudFunctions';
import { getSequenceFromCache, getCacheCount, addSequenceToCache } from '../../utils/sequenceCache';
import { prefetchSequence } from '../../utils/sequencePrefetcher';
import { getSequenceLanguage } from '../../utils/sequenceLanguage';
import { generateLocalSequence, toDifficultySeed } from '../../utils/localSequenceGenerator';
import { acquireSequence } from './sequenceAcquisition';
import { trackEvent } from '../../utils/analyticsTracker';

// Import helpers (assuming they are correctly defined and exported in the frontend version)
// Frontend version might only have formatters etc. - calculateSessionParameters typically runs backend-side.
// import { calculateSessionParameters } from '../gameHelpers';

/**
 * Factory function returning an object containing the *logic* for setting up a game.
 * These are plain functions, NOT wrapped in useCallback here; the wrapping happens in GameContext.
 * Handles starting standard games and retries.
 *
 * @param {object} params - Dependencies required for setup actions.
 * @param {object|null} params.activeProfile - The currently active user profile object.
 * @param {object} params.settings - The user's application settings (contains selectedVoiceId).
 * @param {boolean} params.saveToProfileState - Current value of the saveToProfile state.
 * @param {Function} params.setGameState - Setter for game state.
 * @param {Function} params.setNBack - Setter for standard n-back state.
 * @param {Function} params.setDifficulty - Setter for standard difficulty state.
 * @param {Function} params.setSequence - Setter for game sequence state.
 * @param {Function} params.setCurrentTrial - Setter for current trial index state.
 * @param {Function} params.setTotalTrials - Setter for total trials state.
 * @param {Function} params.setGameResults - Setter for game results state.
 * @param {Function} params.setFeedbackMessage - Setter for feedback message state.
 * @param {Function} [params.setStartFailureMessage] - Setter for the DEDICATED start-failure
 *   channel the dashboard renders. Separate from feedbackMessage, which gameEnd also writes
 *   (raw SDK text on a queued-offline save) and which nothing clears on the way to the dashboard.
 * @param {Function} params.setSaveToProfile - Setter for the save-to-profile flag state.
 * @param {Function} params.startCountdown - Action to initiate the countdown.
 * @param {Function} params.setConsecutiveSuccesses - Setter for standard consecutive successes state.
 * @param {Function} params.setShowCountdown - Setter for showing/hiding countdown UI.
 * @param {Function} params.setIsCountdownVisuallyComplete - Setter for countdown animation flag.
 * @param {React.MutableRefObject<NodeJS.Timeout|null>} params.timerRef - Ref for the game timer.
 * @param {React.MutableRefObject<boolean>} params.isEndingRef - Ref flag to prevent concurrent endGame executions.
 * @param {React.MutableRefObject<Array<number>>} params.visualResponsesRef - Ref for visual responses.
 * @param {React.MutableRefObject<Array<number>>} params.audioResponsesRef - Ref for audio responses.
 * @param {React.MutableRefObject<Array<object>>} params.visualMatchesRef - Ref for storing calculated visual matches.
 * @param {React.MutableRefObject<Array<object>>} params.audioMatchesRef - Ref for storing calculated audio matches.
 * @param {React.MutableRefObject<object|null>} params.sessionSettingsRef - Ref for storing generated session parameters.
 * @param {React.MutableRefObject<Array<object>>} params.replayEventsRef - Ref for replay event log.
 * @param {React.MutableRefObject<number|null>} params.sessionStartTimeRef - Ref for session start timestamp.
 * @param {React.MutableRefObject<Function|null>} params.onNavigateRef - Ref holding the navigation function.
 * @param {React.MutableRefObject<string>} params.latestGameStateRef - Ref holding the latest gameState.
 * @param {object} params.audioManager - Instance of the audio manager.
 * @returns {object} Object containing setup action logic functions: { startGameLogic, cancelPreparationLogic }.
 */
export function createGameSetupActions({
    activeProfile, settings,
    saveToProfileState,
    activeGameMode, // Game mode from ProfileContext ('dual', 'triple', 'quad')
    setGameState, setNBack, setDifficulty, setSequence, setCurrentTrial,
    setTotalTrials, setGameResults, setFeedbackMessage,
    setStartFailureMessage = () => {},
    setSaveToProfile, startCountdown,
    setConsecutiveSuccesses, setShowCountdown, setIsCountdownVisuallyComplete,
    timerRef, isEndingRef, visualResponsesRef, audioResponsesRef, visualMatchesRef,
    audioMatchesRef, colorMatchesRef, shapeMatchesRef, // Add color/shape match refs
    colorResponsesRef, shapeResponsesRef, // Color/shape response refs (triple/quad modes)
    colorRecallSelectionsRef, // Recall Mode selections (singleColorRecall): trialIndex -> color
    sessionSettingsRef, replayEventsRef, sessionStartTimeRef,
    onNavigateRef, latestGameStateRef, audioManager,
    validateAuthToken, // Authoritative session-expiry check (from useUser) — gates the forced sign-out below
    continuousChainRef, // optional — if provided and chain is active, request bufferTrials and stash returned primers
    // Color customization snapshot inputs — captured in sessionSettingsRef at start
    // so the gameEnd payload reads a stable value even if user changes prefs mid-session.
    colorPaletteId, colorPalette, colorThemeAtPlayTime, colorPaletteFingerprint,
}) {

    /**
     * Report a start failure on BOTH channels.
     *
     * `feedbackMessage` is shared with gameEnd (which writes raw SDK text into it when a
     * save is queued offline), so the dashboard notice reads the dedicated start-failure
     * channel instead. The legacy write stays for the components still reading it.
     *
     * @param {string} message - User-facing text; no first person.
     */
    const reportStartFailure = (message) => {
        setFeedbackMessage(message);
        setStartFailureMessage(message);
    };

    /**
     * Core logic for starting a game session (standard or override).
     * Fetches sequence from backend, resets state, and triggers countdown.
     * @param {object} [options={}] - Optional settings overrides.
     * @param {number} [options.overrideNBack] - Specific N-Back level for retry/override.
     * @param {number} [options.overrideDifficulty] - Specific difficulty level for retry/override.
     * @param {boolean} [options.skipCountdown] - If true, skip the 3-second pre-game countdown
     *   and jump straight into the first trial. Used by results-page Retry/Continue buttons.
     */
    const startGameLogic = async (options = {}) => {
        const functionStartTime = Date.now(); 
        if (!auth.currentUser) {
            console.error(`[startGameLogic ${functionStartTime}] Aborted: User is not authenticated.`);
            setFeedbackMessage("Authentication error. Please log in again.");
            setGameState('idle'); setShowCountdown(false); return;
        }

        const currentState = latestGameStateRef.current;
        // 'loading' belongs here: sequence acquisition can now legitimately sit in this
        // state for the whole 8s fallback window, and a second start during it would run a
        // full concurrent acquisition (two server calls, two local generations) whose
        // results race into the same state setters.
        if (['loading', 'preparing', 'playing', 'paused'].includes(currentState)) {
             console.warn(`[startGameLogic ${functionStartTime}] Aborted: Game already in progress or preparing (state: ${currentState}).`);
             return;
        }

        setGameState('loading');
        setGameResults(null); setFeedbackMessage(''); setStartFailureMessage(''); setCurrentTrial(-1);
        try { sessionStorage.removeItem('lastResultsSessionId'); } catch(e) {}
        setSequence([]); setTotalTrials(0);
        setShowCountdown(false); setIsCountdownVisuallyComplete(false);
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        isEndingRef.current = false; visualResponsesRef.current = []; audioResponsesRef.current = [];
        if (colorResponsesRef) colorResponsesRef.current = []; if (shapeResponsesRef) shapeResponsesRef.current = [];
        if (colorRecallSelectionsRef) colorRecallSelectionsRef.current = {};
        visualMatchesRef.current = []; audioMatchesRef.current = []; sessionSettingsRef.current = null;
        replayEventsRef.current = []; sessionStartTimeRef.current = null;
        
        let nBackToUse = null;
        let difficultyToUse = null;
        let sessionType = 'UNKNOWN';

        // Single source of truth for "this start is a continuous-chain block".
        // Declared here (rather than at the payload build below) because the Recall
        // resolution needs it. Safe to snapshot once: no `await` intervenes between
        // this line and the reuse site in the payload build, so startContinuousChain
        // cannot interleave and flip the ref underneath us. The read after the await
        // (primer stash, ~line 289) deliberately uses this same snapshot so the
        // whole start path agrees on one answer.
        const isContinuousChainStart = continuousChainRef?.current?.isActive === true;

        // Recall Mode resolution: singleColor + the Recall response-mode setting
        // plays as internal gameMode 'singleColorRecall'. Sequences are still
        // fetched as 'singleColor' (identical stimulus contract / cache keys).
        // Excluded from continuous chains (v1) and playground.
        const isRecallSession =
            activeGameMode === 'singleColor' &&
            settings?.responseModes?.singleColor === 'recall' &&
            !isContinuousChainStart;

        if (options.overrideNBack !== undefined && options.overrideDifficulty !== undefined) {
            sessionType = 'OVERRIDE';
            nBackToUse = options.overrideNBack;
            difficultyToUse = Math.max(0, Math.min(0.99, options.overrideDifficulty));
            setSaveToProfile(true);

        } else if (activeProfile) {
            sessionType = 'STANDARD (Profile)';
            // Recall runs on its own progression track. activeProfile carries the
            // ACTIVE mode's numbers (singleColor); recallProgression carries the
            // 'singleColorRecall' track alongside it (see GameContext, which already
            // defaults it via getDefaultModeProgression — the `|| {}` is only for a
            // hypothetical caller that builds activeProfile itself; today GameContext
            // is the sole caller of createGameSetupActions).
            const recallProg = isRecallSession ? (activeProfile.recallProgression || {}) : null;
            nBackToUse = recallProg ? (recallProg.currentNBack ?? 2) : (activeProfile.currentNBack ?? 2);
            // Classic mode: force fixed difficulty at 0.50 regardless of stored progression
            difficultyToUse = options.trainingMode === 'classic'
                ? 0.50
                : Math.max(0, Math.min(0.99, (recallProg ? (recallProg.currentDifficulty ?? 0.0) : (activeProfile.currentDifficulty ?? 0.0))));
            setSaveToProfile(saveToProfileState);

        } else {
            sessionType = 'ERROR (No Profile/Override)';
            console.error(`[startGameLogic ${functionStartTime} - Param Det] Critical error: ${sessionType}. Cannot determine parameters.`);
            setFeedbackMessage("Internal error: Could not determine game level. Profile missing?");
            setGameState('idle');
            return;
        }

         if (nBackToUse === null || difficultyToUse === null) {
              console.error(`[startGameLogic ${functionStartTime}] CRITICAL INTERNAL ERROR: Parameters nBackToUse or difficultyToUse are null after determination block! Aborting.`);
              setFeedbackMessage("Internal error: Failed to set game parameters correctly.");
              setGameState('idle');
              return;
         }
        
        setNBack(nBackToUse);
        setDifficulty(difficultyToUse); 
        if (sessionType !== 'STANDARD (Profile)') {
             setConsecutiveSuccesses(0);
        } else if (activeProfile) {
             const profileStreak = isRecallSession
                 ? (activeProfile.recallProgression?.consecutiveSuccesses || 0)
                 : (activeProfile.consecutiveSuccesses || 0);
             setConsecutiveSuccesses(profileStreak);
        }
        
        const setupTimestamp = Date.now();
        replayEventsRef.current.push({
            type: 'gameSetup',
            timestamp: setupTimestamp,
            nBack: nBackToUse,
            difficulty: difficultyToUse,
            isPlayground: false,
            isOverride: sessionType === 'OVERRIDE',
            profileId: activeProfile?.id || null
        });

        try {
            // Client difficulty (0-0.99) -> backend seed (0.0-1.0). One shared helper so the
            // server payload, the prefetcher and the local generator cannot disagree.
            const difficultySeedForBackend = toDifficultySeed(difficultyToUse);

            // Sequence language: the backend letter-set key AND part of the sequence-cache
            // key. Derived in exactly one place so the prefetch writes entries under the
            // key this lookup reads (see src/utils/sequenceLanguage.js).
            const languageCodeForBackend = getSequenceLanguage(settings);

            const backendCallStartTime = Date.now();
            // For Dynamic mode, resolve the actual sub-mode to play. Continuous chains
            // resolved it once at startContinuousChain — prefer that so block 1 can't
            // drift from the sub-mode the rest of the chain will use.
            const isDynamicMode = activeGameMode === 'dynamic';
            // isContinuousChainStart is resolved once at the top of startGameLogic
            // (the Recall resolution needs it) — reused here.
            const dynamicSubMode = isDynamicMode
                ? (options.overrideGameMode
                    || (isContinuousChainStart && continuousChainRef.current.currentSubMode)
                    || activeProfile?.currentSubMode
                    || 'dual')
                : null;
            const effectiveGameMode = isDynamicMode ? dynamicSubMode : (activeGameMode || 'dual');
            const payload = {
                nBack: nBackToUse,
                difficulty: difficultySeedForBackend,
                isPlayground: false,
                profileId: activeProfile?.id || null,
                gameMode: effectiveGameMode, // Send actual sub-mode, not 'dynamic'
                overrideTrials: options.overrideTrials || null,
                language: languageCodeForBackend,
                ...(isContinuousChainStart && {
                    bufferTrials: 3,
                    progressionRange: continuousChainRef.current.progressionRange || 'standard',
                }),
            };

            // Sequence acquisition: cache → server (bounded) → local generation.
            // See src/contexts/game/sequenceAcquisition.js for the full decision table.
            //
            // Continuous chains deliberately stay SERVER-ONLY: a chain block needs
            // `bufferTrials` and the primer stimuli the callable returns, which the local
            // builder does not produce, and a locally generated block would break n-back
            // continuity across the block boundary.
            let response = null;
            let sequenceSource = 'server';
            let sequenceReason = null;

            if (isContinuousChainStart) {
                // Chains stay server-only (bufferTrials + primer stimuli), so there is no
                // local fallback to reach. With the device reporting itself offline there is
                // nothing to wait for either: fail fast instead of spending the callable's
                // 20s token preflight and 60s backstop on a call that cannot land.
                // (The reverse case — `onLine` true on a dead VPN/DNS network — still goes
                // out and comes back as a network-class error via the catch below.)
                if (!navigator.onLine) {
                    const offlineError = new Error('Network unavailable: the device is offline.');
                    offlineError.code = 'unavailable'; // classified by isNetworkOrTimeoutError
                    throw offlineError;
                }
                // Wrapper does one silent token-refresh + retry on a transient auth
                // error before the catch below signs the user out (genuine expiry only).
                // Bounded end to end: generateSequenceHttp preflights the App Check/Auth
                // tokens (20s) and backstops the callable (60s), so a wedged App Check SDK
                // surfaces here as a network-class error ('timed out') → the network branch
                // in the catch below → idle, instead of "Generating sequence..." forever.
                response = await generateSequenceWithAuthRetry(payload);
            } else {
                const acquired = await acquireSequence({
                    // Playground/override trial counts are not cacheable (the cache key
                    // carries no trial count), so the lookup is skipped entirely for them —
                    // reading would consume a use-once entry that then gets discarded.
                    lookupCache: options.overrideTrials
                        ? null
                        : () => getSequenceFromCache(effectiveGameMode, nBackToUse, difficultyToUse, languageCodeForBackend),
                    requestFromServer: () => generateSequenceWithAuthRetry(payload),
                    generateLocally: () => generateLocalSequence({
                        nBack: nBackToUse,
                        difficulty: difficultyToUse,
                        gameMode: effectiveGameMode,
                        language: languageCodeForBackend,
                        // Always null: the callable reads overrideTrials only when
                        // isPlayground is true (functions/game.js), and this path never is —
                        // honouring it locally would make the offline sequence a different
                        // length than the same start made online.
                        overrideTrials: null,
                    }),
                    // A server response that lands after the fallback deadline is still
                    // good — bank it for the next start (same 2-per-key rule as prefetch).
                    cacheLateResult: async (lateResponse) => {
                        if (options.overrideTrials) return;
                        const count = await getCacheCount(effectiveGameMode, nBackToUse, difficultyToUse, languageCodeForBackend);
                        if (count < 2) {
                            await addSequenceToCache(effectiveGameMode, nBackToUse, difficultyToUse, languageCodeForBackend, lateResponse);
                        }
                    },
                    isNetworkError: isNetworkOrTimeoutError,
                });
                response = acquired.response;
                sequenceSource = acquired.source;
                sequenceReason = acquired.reason;

                if (sequenceSource === 'cache') {
                    // Replenish cache in background (fire-and-forget)
                    prefetchSequence({
                        gameMode: effectiveGameMode, nBack: nBackToUse,
                        difficulty: difficultyToUse, language: languageCodeForBackend,
                        profileId: activeProfile?.id || null,
                    }).catch(() => {});
                }
            }

            if (sequenceSource === 'local') {
                // The documented marker to grep for in a device log (see the design doc).
                console.info(`[startGameLogic ${functionStartTime}] Using locally generated sequence (${sequenceReason})`);
                try {
                    trackEvent('sequence_local_fallback', {
                        reason: sequenceReason,
                        game_mode: effectiveGameMode,
                        n_back: nBackToUse,
                    });
                } catch (trackError) { /* telemetry must never block a start */ }
            } else {
                console.info(`[startGameLogic ${functionStartTime}] Sequence source: ${sequenceSource}`);
            }

            if (!response || !response.sequence || !response.parameters) {
                throw new Error('Invalid sequence response structure from backend.');
            }
             if (!Array.isArray(response.sequence)) {
                  throw new Error('Backend returned non-array sequence.');
             }
             if (typeof response.parameters?.totalTrials !== 'number' || response.parameters.totalTrials <= 0) {
                  throw new Error(`Backend returned invalid totalTrials: ${response.parameters?.totalTrials}`);
             }
            // Determine trainingMode for session payload
            // Explicit trainingMode from options (e.g., 'classic') takes priority over dynamic mode
            const resolvedTrainingMode = options.trainingMode
                || (isDynamicMode ? 'dynamic' : 'adaptive');

            sessionSettingsRef.current = {
                ...response.parameters,
                nBack: nBackToUse,
                difficulty: difficultyToUse,
                isPlayground: false,
                showReport: true,
                // Session/progression/replay identity. The sequence above was fetched
                // as 'singleColor' (same stimulus contract) but the session is saved,
                // scored and progressed as 'singleColorRecall'.
                gameMode: isRecallSession ? 'singleColorRecall' : effectiveGameMode,
                trainingMode: resolvedTrainingMode,
                clientVersion: 2, // Signals new client to backend (gates Stripe trial, etc.)
                ...(isDynamicMode && { currentSubMode: dynamicSubMode }),
                generatedSequence: response.sequence,
                // Color customization snapshot — captured at session start so the
                // session save payload records what the player actually saw,
                // even if they change preferences during the session.
                ...(colorPaletteId && { colorPaletteId }),
                ...(colorPalette && { colorPalette }),
                ...(colorThemeAtPlayTime && { colorThemeAtPlayTime }),
                ...(colorPaletteFingerprint && { colorPaletteFingerprint }),
            };
            setSequence(response.sequence);
            setTotalTrials(response.parameters.totalTrials);
            visualMatchesRef.current = response.visualMatches || [];
            audioMatchesRef.current = response.audioMatches || [];
            if (colorMatchesRef) colorMatchesRef.current = response.colorMatches || [];
            if (shapeMatchesRef) shapeMatchesRef.current = response.shapeMatches || [];
            // Continuous chain: stash the K primer stimuli for use as session 2's first K trials.
            if (isContinuousChainStart && Array.isArray(response.primerStimuli) && response.primerStimuli.length > 0) {
                continuousChainRef.current = {
                    ...continuousChainRef.current,
                    heldPrimers: response.primerStimuli,
                };
                console.info(`[Continuous] Stashed ${response.primerStimuli.length} primer stimuli for next session.`);
            }

            replayEventsRef.current.push({
                type: 'sequenceGenerated',
                timestamp: Date.now(),
                sequenceLength: response.sequence.length,
                totalTrials: response.parameters.totalTrials,
            });
            
            if (options.skipCountdown) {
                // Stay in 'loading' state; startCountdown will await audio readiness
                // and jump straight to 'playing'. Avoids a flicker of the countdown UI.
                startCountdown({ skipCountdown: true });
            } else {
                setGameState('preparing');
                startCountdown();
            }

        } catch (error) {
             const errorTime = Date.now();
             const setupDurationOnError = errorTime - setupTimestamp;
             console.error(`[startGameLogic ${functionStartTime}] Error during backend call or processing (occurred after ${setupDurationOnError} ms from setup log):`, error);

             // Check if this is an auth error (stale token after long idle)
             if (error.isAuthError || isAuthError(error)) {
                 // App Check / transient failures on the App-Check-enforced generateSequence
                 // also surface as 'unauthenticated' (matched by isAuthError) but leave the
                 // auth SESSION valid. generateSequenceWithAuthRetry already retried once with
                 // refreshed tokens, so if validateAuthToken() (force ID-token refresh) STILL
                 // succeeds, the session is fine and this was an App-Check/transient hiccup —
                 // show a retryable error instead of logging the user out.
                 let sessionValid = false;
                 try {
                     sessionValid = validateAuthToken ? await validateAuthToken() : false;
                 } catch (validateError) {
                     console.warn('[startGameLogic] validateAuthToken threw; treating session as expired:', validateError?.message);
                 }
                 if (sessionValid) {
                     console.warn(`[startGameLogic ${functionStartTime}] Auth-classified error but session is still valid (likely App Check/transient) — not signing out.`);
                     reportStartFailure('Something went wrong starting the game. Please try again.');
                     setGameState('idle');
                     setShowCountdown(false);
                     setSequence([]); setTotalTrials(0); sessionSettingsRef.current = null;
                     visualMatchesRef.current = []; audioMatchesRef.current = []; replayEventsRef.current = [];
                     return;
                 }
                 console.error(`[startGameLogic ${functionStartTime}] Auth error detected - session expired. Signing out user.`);
                 reportStartFailure('Your session has expired. Please log in again.');
                 setGameState('idle');
                 setShowCountdown(false);
                 // Sign out to clear stale auth state and trigger redirect to login
                 try {
                     await signOut(auth);
                 } catch (signOutError) {
                     console.error('[startGameLogic] Error signing out:', signOutError);
                     // Force redirect even if signOut fails
                     window.location.href = '/login';
                 }
                 return;
             }

             // Network/timeout. On a single session this is now reachable only when LOCAL
             // generation also failed (acquireSequence falls back before throwing) or on a
             // continuous-chain block, which stays server-only by design.
             if (isNetworkOrTimeoutError(error)) {
                 console.error(`[startGameLogic ${functionStartTime}] Network/timeout error detected.`);
                 reportStartFailure("Couldn't start the session. Check your connection and try again.");
                 setGameState('idle');
                 setShowCountdown(false);
                 setSequence([]); setTotalTrials(0); sessionSettingsRef.current = null;
                 visualMatchesRef.current = []; audioMatchesRef.current = []; replayEventsRef.current = [];
                 return;
             }

             // App Check attestation failed (no valid token; the backend would reject the
             // call). Not a session problem and not connectivity; keep the SDK's text out.
             if (isAppCheckAttestationError(error)) {
                 console.error(`[startGameLogic ${functionStartTime}] App Check attestation failed (${error.appCheckCode || 'unknown'}).`);
                 reportStartFailure('App verification failed. Please try again in a moment.');
                 setGameState('idle');
                 setShowCountdown(false);
                 setSequence([]); setTotalTrials(0); sessionSettingsRef.current = null;
                 visualMatchesRef.current = []; audioMatchesRef.current = []; replayEventsRef.current = [];
                 return;
             }

             // Regular error handling for non-auth errors
             reportStartFailure(`Error starting game: ${error.message}. Please try again.`);
             setGameState('idle');
             setShowCountdown(false);
             setSequence([]); setTotalTrials(0); sessionSettingsRef.current = null;
             visualMatchesRef.current = []; audioMatchesRef.current = []; replayEventsRef.current = [];
        } finally {
             const functionEndTime = Date.now();
        }
    };

    const cancelPreparationLogic = () => {
        const currentState = latestGameStateRef.current;
        if (currentState === 'preparing') {
            setGameState('idle');
            setShowCountdown(false); setIsCountdownVisuallyComplete(false); setFeedbackMessage('');
            setSequence([]); setTotalTrials(0); sessionSettingsRef.current = null;
            visualMatchesRef.current = []; audioMatchesRef.current = []; replayEventsRef.current = [];
        } else {
        }
    };

    return {
        startGameLogic,
        cancelPreparationLogic,
    };
}
/* File: src/contexts/game/gameGetters.js */
import {
    isTrialMatch as isTrialMatchUtil,
    getCoachingMessage as getCoachingMessageUtil,
    getFeatureIntroMessage as getFeatureIntroMessageUtil
} from '../gameUtils'; // Assuming gameUtils re-exports needed helpers

/**
 * Factory function returning an object containing the *logic* for game getters.
 * These are plain functions, NOT wrapped in useCallback/useMemo here.
 * The actual memoized getters are created in GameProvider using this logic.
 *
 * @param {object} params - Dependencies required for the getter logic.
 * @param {Array|null} params.sequence - Current game sequence state (used by isMatch). Can be null/empty initially.
 * @param {React.MutableRefObject<number>} params.nBackRef - Ref holding the current standard nBack state value.
 * @param {React.MutableRefObject<number>} params.difficultyRef - Ref holding the current standard difficulty state value.
 * @param {React.MutableRefObject<object|null>} params.sessionSettingsRef - Ref holding current session settings (contains session nBack, calculated ISI/Duration).
 * @param {React.MutableRefObject<Array<number>>} params.visualMatchesRef - Ref for visual matches indices (direct access).
 * @param {React.MutableRefObject<Array<number>>} params.audioMatchesRef - Ref for audio matches indices (direct access).
 * @param {React.MutableRefObject<Array<number>>} params.visualResponsesRef - Ref for user visual responses (direct access).
 * @param {React.MutableRefObject<Array<number>>} params.audioResponsesRef - Ref for user audio responses (direct access).
 * @param {object|null} params.settings - The user's app settings object from SettingsContext.
 * @returns {object} Object containing the getter logic functions.
 */
export function createGameGetters({
    sequence,
    nBackRef,
    difficultyRef,
    sessionSettingsRef,
    visualMatchesRef,
    audioMatchesRef,
    visualResponsesRef,
    audioResponsesRef,
    settings
}) {

    /**
     * Logic to check if a given trial is a match for the specified type ('visual' or 'audio').
     * Uses the nBack level stored in the current session's settings or falls back to standard nBack ref.
     */
    const isMatchLogic = (type, trialIndex) => {
        // Determine the correct N-Back level to use for the check
        // Prioritize the nBack level stored in the active session settings ref
        const currentSessionNBack = sessionSettingsRef.current?.nBack;
        // Fallback to the standard nBack state ref if session ref doesn't have it
        const nBackToUse = typeof currentSessionNBack === 'number' && Number.isInteger(currentSessionNBack) && currentSessionNBack >= 1
                         ? currentSessionNBack
                         : nBackRef.current; // Use the ref value from GameContext state

        // Sequence comes directly from the GameContext state passed into this factory
        if (!sequence || !Array.isArray(sequence) || sequence.length === 0) {
            return false;
        }
        // Call the utility function from gameHelpers/gameUtils to perform the actual comparison
        // Pass the determined nBackToUse
        return isTrialMatchUtil(sequence, trialIndex, nBackToUse, type);
    };

    /**
     * Logic to get the stimulus display duration (ms) for the current session.
     * Reads the value calculated by the backend and stored in sessionSettingsRef.
     */
    const getStimulusDurationLogic = () => {
        const currentSettings = sessionSettingsRef.current;
        // Check potential names for the duration property based on backend response structure
        const durationMs = currentSettings?.stimulusDuration || currentSettings?.calculatedStimDurationMs;

        if (typeof durationMs === 'number' && Number.isFinite(durationMs)) {
            return durationMs;
        }
        // Fallback if not found in ref or not a valid number
        console.warn("[getStimulusDuration logic] Stimulus duration not found/invalid in sessionSettingsRef. Returning default 1000ms.");
        return 1000; // Default to 1 second if unavailable
    };

    /**
     * Logic to get whether instant feedback is enabled for the current session.
     * Returns separate controls for positive (correct), errors (false-alarm clicks),
     * and misses (real matches the user failed to click). Errors and misses both
     * fall back to the legacy `instantFeedbackNegative` shadow when the per-type
     * keys are absent (mid-flight before migration writes back, or on installed
     * Android APKs that haven't updated yet).
     * @returns {{ positive: boolean, errors: boolean, misses: boolean }}
     */
    const getInstantFeedbackEnabledLogic = () => {
        return {
            positive: settings?.instantFeedbackPositive ?? true,
            errors:   settings?.instantFeedbackErrors   ?? settings?.instantFeedbackNegative ?? true,
            misses:   settings?.instantFeedbackMisses   ?? settings?.instantFeedbackNegative ?? true,
        };
    };

    /**
     * Logic to get a relevant coaching message based on current N-back and difficulty.
     */
    const getCoachingMessageLogic = () => {
         // Use the current difficulty ref
         const diffToUse = difficultyRef.current;
         // Use N-back from the current session settings if available, otherwise use the current nBack ref
         const nBackToUse = sessionSettingsRef.current?.nBack || nBackRef.current;
         // Call the imported utility function
         return getCoachingMessageUtil(diffToUse, nBackToUse);
     };

    /**
     * Logic to get a feature introduction message based on the current difficulty.
     */
    const getFeatureIntroMessageLogic = () => {
        // Use the current difficulty ref
        const diffToUse = difficultyRef.current;
        // Call the imported utility function
        return getFeatureIntroMessageUtil(diffToUse);
    };

    // --- Direct Ref Getters ---
    // Provide direct access to the current values of specific refs.
    // Note: These return the *array reference* itself, not a copy. Be careful if modifying.
    const getVisualMatchesLogic = () => visualMatchesRef.current;
    const getAudioMatchesLogic = () => audioMatchesRef.current;
    const getUserVisualResponsesLogic = () => visualResponsesRef.current;
    const getUserAudioResponsesLogic = () => audioResponsesRef.current;
    // --- End Direct Ref Getters ---

    // Return the collection of getter logic functions
    return {
        isMatchLogic,
        getStimulusDurationLogic,
        getInstantFeedbackEnabledLogic,
        getCoachingMessageLogic,
        getFeatureIntroMessageLogic,
        // Direct ref accessors
        getVisualMatchesLogic,
        getAudioMatchesLogic,
        getUserVisualResponsesLogic,
        getUserAudioResponsesLogic,
    };
}
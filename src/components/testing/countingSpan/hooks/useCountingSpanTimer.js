/* src/components/testing/countingSpan/hooks/useCountingSpanTimer.js */
import { useEffect, useRef, useCallback } from 'react';
// Import phase constants and default timing values
import { TASK_PHASES, COUNTING_SPAN_DEFAULTS } from '../../../../constants/cstConstants';

/**
 * Hook to manage the timing of different phases in the Counting Span task.
 * It triggers phase advancements based on predefined durations using setTimeout.
 *
 * @param {string|null} currentPhase - The current phase state from useCountingSpanLogic (e.g., 'fixation', 'odd_even_judgment', 'recall').
 * @param {function} advancePhase - Function from useCountingSpanLogic to request a transition to the next logical phase.
 * @param {number|null} currentTrialIndexInSet - The index of the current trial (used for logging/debugging, not direct timer logic).
 * @param {number|null} setSize - The size of the current set (used for logging/debugging, not direct timer logic).
 * @returns {object} An object containing functions to manually clear specific timers: { clearStimulusJudgmentTimer, clearRecallTimer }.
 */
const useCountingSpanTimer = (currentPhase, advancePhase, currentTrialIndexInSet, setSize) => {
    // Ref to store the ID of the active setTimeout timer, allowing it to be cleared
    const timerRef = useRef(null);

    // Effect to set and clear timers based on the current phase
    useEffect(() => {
        // --- Cleanup Previous Timer ---
        // Always clear any existing timer when the phase or other dependencies change.
        // This prevents multiple timers running concurrently or stale timers firing.
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
            // console.log(`[Timer Cleanup] Cleared timer due to dependency change (Phase: ${currentPhase})`);
        }

        // --- Validate Phase ---
        // Only proceed if currentPhase is a valid, known phase string.
        if (!currentPhase || typeof currentPhase !== 'string') {
            // console.log(`[Timer] Skipping setup, currentPhase is invalid or not ready (${currentPhase}).`);
            return; // Don't set any timers if phase isn't ready
        }

        // --- Set New Timer Based on Current Phase ---
        switch (currentPhase) {
            case TASK_PHASES.FIXATION:
                // After fixation duration, request transition to the judgment phase
                console.log(`[Timer] Starting ${COUNTING_SPAN_DEFAULTS.FIXATION_DURATION_MS}ms for FIXATION`);
                timerRef.current = setTimeout(() => {
                    console.log("[Timer] Fixation complete. Requesting ODD_EVEN_JUDGMENT phase.");
                    // The advancePhase function in the logic hook will handle setting the state
                    advancePhase(TASK_PHASES.ODD_EVEN_JUDGMENT);
                }, COUNTING_SPAN_DEFAULTS.FIXATION_DURATION_MS);
                break;

            case TASK_PHASES.ODD_EVEN_JUDGMENT:
                 // This phase combines stimulus display and the judgment window.
                 // Start the main timer for this window.
                console.log(`[Timer] Starting ${COUNTING_SPAN_DEFAULTS.STIMULUS_JUDGMENT_WINDOW_MS}ms for ODD_EVEN_JUDGMENT window`);
                 timerRef.current = setTimeout(() => {
                    console.log("[Timer] ODD_EVEN_JUDGMENT window timed out. Requesting PROCESSING_TRANSITION phase.");
                    // Signal the timeout occurred by requesting the transition phase.
                    // The logic hook's advancePhase handler needs to call handleJudgmentTimeout.
                    advancePhase(TASK_PHASES.PROCESSING_TRANSITION);
                }, COUNTING_SPAN_DEFAULTS.STIMULUS_JUDGMENT_WINDOW_MS);
                break;

            case TASK_PHASES.PROCESSING_TRANSITION:
                 // This is the Inter-Trial Interval (ITI).
                 console.log(`[Timer] Starting ${COUNTING_SPAN_DEFAULTS.ITI_DURATION_MS}ms for ITI (PROCESSING_TRANSITION)`);
                 timerRef.current = setTimeout(() => {
                     console.log("[Timer] ITI complete. Requesting advance to next logical step (FIXATION).");
                     // Signal the end of the ITI. The logic hook's advancePhase handler
                     // will determine if the *actual* next phase is FIXATION (for next trial)
                     // or RECALL (if the set ended). We request FIXATION as the default follow-up.
                     advancePhase(TASK_PHASES.FIXATION);
                 }, COUNTING_SPAN_DEFAULTS.ITI_DURATION_MS);
                break;

            case TASK_PHASES.RECALL:
                // Start the timer for the maximum recall duration.
                console.log(`[Timer] Starting ${COUNTING_SPAN_DEFAULTS.RECALL_TIMEOUT_MS}ms for RECALL timeout`);
                timerRef.current = setTimeout(() => {
                    console.log("[Timer] RECALL window timed out. Requesting RECALL_TIMEOUT phase.");
                    // Signal the timeout by requesting the specific RECALL_TIMEOUT phase.
                    // The logic hook's advancePhase handler will catch this phase transition.
                    advancePhase(TASK_PHASES.RECALL_TIMEOUT);
                }, COUNTING_SPAN_DEFAULTS.RECALL_TIMEOUT_MS);
                break;

            // --- Phases without automatic timers ---
            // These phases transition based on user actions or synchronous logic.
            case TASK_PHASES.INSTRUCTIONS:
            case TASK_PHASES.PRACTICE_PROCESSING:
            case TASK_PHASES.PRACTICE_RECALL:
            case TASK_PHASES.PRACTICE_INTEGRATED:
            case TASK_PHASES.READY_ASSESSMENT:
            case TASK_PHASES.SET_START:       // Transition handled synchronously by logic
            case TASK_PHASES.RECALL_TIMEOUT:  // This is a result phase, no timer *starts* here
            case TASK_PHASES.SAVING:          // Duration depends on async operation
            case TASK_PHASES.RESULTS:         // Stays until user navigates away
                // console.log(`[Timer] No automatic timer needed for phase: ${currentPhase}`);
                // No timer action needed for these phases. Cleanup already handled above.
                break;

            default:
                // Log a warning if an unknown phase is encountered
                console.warn(`[Timer] Unhandled or unknown phase encountered: ${currentPhase}`);
                break;
        }

        // --- Effect Cleanup Function ---
        // This function runs when the component unmounts or *before* the effect runs again
        // due to dependency changes. It ensures no timers linger unexpectedly.
        return () => {
            if (timerRef.current) {
                // console.log(`[Timer Cleanup] Effect cleanup clearing timer ID: ${timerRef.current} (Phase was ${currentPhase})`);
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };

    // Dependencies: Re-run the effect if any of these change.
    // advancePhase is included because its reference might change (though unlikely with useCallback).
    // Logging dependencies (currentTrialIndexInSet, setSize) are included for completeness, though they don't directly affect timer logic.
    }, [currentPhase, advancePhase, currentTrialIndexInSet, setSize]);

    // --- Manually Clearable Timer Functions ---

    // Function to manually clear the stimulus/judgment timer.
    // Used when the user responds *before* the ODD_EVEN_JUDGMENT timeout.
    const clearStimulusJudgmentTimer = useCallback(() => {
         // Only clear if we are actually in the judgment phase where the timer is running.
         if (currentPhase === TASK_PHASES.ODD_EVEN_JUDGMENT) {
            if (timerRef.current) {
                console.log("[Timer] Manually clearing ODD_EVEN_JUDGMENT timer.");
                clearTimeout(timerRef.current);
                timerRef.current = null; // Important to nullify the ref
            } else {
                // This might happen if the user clicks extremely quickly after the phase transition
                // console.log("[Timer] clearStimulusJudgmentTimer called, but no active timer found (might be okay).");
            }
        } else {
             // Log if called in an unexpected phase, might indicate logic error elsewhere
             // console.warn(`[Timer] clearStimulusJudgmentTimer called during unexpected phase: ${currentPhase}`);
        }
    }, [currentPhase]); // Dependency: only needs currentPhase to know if clearing is relevant.

    // Function to manually clear the recall timer.
    // Used when the user submits their recall sequence *before* the RECALL timeout.
    const clearRecallTimer = useCallback(() => {
        // Only clear if we are actually in the recall phase where the timer is running.
        if (currentPhase === TASK_PHASES.RECALL) {
           if (timerRef.current) {
               console.log("[Timer] Manually clearing RECALL timeout timer.");
               clearTimeout(timerRef.current);
               timerRef.current = null; // Important to nullify the ref
           } else {
                // This might happen if the user clicks extremely quickly after the phase transition
               // console.log("[Timer] clearRecallTimer called, but no active timer found.");
           }
       } else {
             // Log if called in an unexpected phase
             // console.warn(`[Timer] clearRecallTimer called during unexpected phase: ${currentPhase}`);
       }
   }, [currentPhase]); // Dependency: only needs currentPhase.


    // Return the functions that allow manual clearing of specific timers.
    return { clearStimulusJudgmentTimer, clearRecallTimer };
};

export default useCountingSpanTimer;
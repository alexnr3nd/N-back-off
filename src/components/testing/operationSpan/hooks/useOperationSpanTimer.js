/* src/components/testing/operationSpan/hooks/useOperationSpanTimer.js */
import { useEffect, useRef, useCallback } from 'react';
import { OSPAN_PHASES, OSPAN_DEFAULTS } from '../../../../constants/ospanConstants';

/**
 * Timer hook for the Operation Span task.
 * Key difference from CST timer: MATH_PROBLEM phase uses a dynamic deadline
 * (from calibration) instead of a constant.
 *
 * @param {string|null} currentPhase
 * @param {function} advancePhase - Request phase transition
 * @param {number|null} mathDeadlineMs - Calibrated math deadline (dynamic)
 * @returns {{ clearMathTimer: function, clearRecallTimer: function }}
 */
const useOperationSpanTimer = (currentPhase, advancePhase, mathDeadlineMs) => {
    const timerRef = useRef(null);

    useEffect(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        if (!currentPhase || typeof currentPhase !== 'string') return;

        switch (currentPhase) {
            case OSPAN_PHASES.FIXATION:
                timerRef.current = setTimeout(() => {
                    advancePhase(OSPAN_PHASES.MATH_PROBLEM);
                }, OSPAN_DEFAULTS.FIXATION_DURATION_MS);
                break;

            case OSPAN_PHASES.MATH_PROBLEM:
                if (mathDeadlineMs && mathDeadlineMs > 0) {
                    timerRef.current = setTimeout(() => {
                        advancePhase(OSPAN_PHASES.LETTER_DISPLAY);
                    }, mathDeadlineMs);
                }
                break;

            case OSPAN_PHASES.LETTER_DISPLAY:
                timerRef.current = setTimeout(() => {
                    advancePhase(OSPAN_PHASES.FIXATION); // Logic hook decides if FIXATION or RECALL
                }, OSPAN_DEFAULTS.LETTER_DISPLAY_MS);
                break;

            case OSPAN_PHASES.SET_FEEDBACK:
                timerRef.current = setTimeout(() => {
                    advancePhase(OSPAN_PHASES.FIXATION); // Logic hook advances to next set
                }, OSPAN_DEFAULTS.SET_FEEDBACK_MS);
                break;

            case OSPAN_PHASES.RECALL:
                timerRef.current = setTimeout(() => {
                    advancePhase(OSPAN_PHASES.RECALL_TIMEOUT);
                }, OSPAN_DEFAULTS.RECALL_TIMEOUT_MS);
                break;

            // No timers for these phases
            case OSPAN_PHASES.INSTRUCTIONS:
            case OSPAN_PHASES.PRACTICE_LETTER_ONLY:
            case OSPAN_PHASES.PRACTICE_MATH_ONLY:
            case OSPAN_PHASES.PRACTICE_COMBINED:
            case OSPAN_PHASES.PRACTICE_FEEDBACK:
            case OSPAN_PHASES.READY_ASSESSMENT:
            case OSPAN_PHASES.MATH_VERIFICATION:
            case OSPAN_PHASES.RECALL_TIMEOUT:
            case OSPAN_PHASES.SAVING:
            case OSPAN_PHASES.RESULTS:
                break;

            default:
                console.warn(`[OSPAN Timer] Unhandled phase: ${currentPhase}`);
                break;
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [currentPhase, advancePhase, mathDeadlineMs]);

    const clearMathTimer = useCallback(() => {
        if (currentPhase === OSPAN_PHASES.MATH_PROBLEM && timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, [currentPhase]);

    const clearRecallTimer = useCallback(() => {
        if (currentPhase === OSPAN_PHASES.RECALL && timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, [currentPhase]);

    return { clearMathTimer, clearRecallTimer };
};

export default useOperationSpanTimer;

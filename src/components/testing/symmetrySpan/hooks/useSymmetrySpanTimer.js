/* src/components/testing/symmetrySpan/hooks/useSymmetrySpanTimer.js */
import { useEffect, useCallback } from 'react';
import { useRef } from 'react';
import { SYMSPAN_PHASES, SYMSPAN_DEFAULTS } from '../../../../constants/symmetrySpanConstants';

/**
 * Timer hook for the Symmetry Span task (phase-driven, single instance).
 * The SYMMETRY_JUDGMENT phase uses the dynamic calibrated deadline; a null
 * deadline means participant-paced (symmetry-only practice, pre-calibration).
 *
 * Clear functions are published onto `controlsRef` so the logic hook can be
 * created before this hook without a circular dependency (Digit Span pattern).
 *
 * @param {string|null} currentPhase
 * @param {function} advancePhase - Request a phase transition (logic hook interprets it)
 * @param {number|null} judgmentDeadlineMs - Active judgment deadline, or null for untimed
 * @param {object} controlsRef - ref populated with { clearJudgmentTimer, clearRecallTimer }
 */
const useSymmetrySpanTimer = (currentPhase, advancePhase, judgmentDeadlineMs, controlsRef) => {
    const timerRef = useRef(null);

    useEffect(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        if (!currentPhase || typeof currentPhase !== 'string') return undefined;

        switch (currentPhase) {
            case SYMSPAN_PHASES.FIXATION:
                timerRef.current = setTimeout(() => {
                    advancePhase(SYMSPAN_PHASES.SYMMETRY_JUDGMENT);
                }, SYMSPAN_DEFAULTS.FIXATION_MS);
                break;

            case SYMSPAN_PHASES.SYMMETRY_JUDGMENT:
                // Deadline-paced once calibrated; untimed during calibration practice
                if (judgmentDeadlineMs && judgmentDeadlineMs > 0) {
                    timerRef.current = setTimeout(() => {
                        advancePhase(SYMSPAN_PHASES.PRE_SQUARE_BLANK); // Logic hook records the speed error
                    }, judgmentDeadlineMs);
                }
                break;

            case SYMSPAN_PHASES.JUDGMENT_FEEDBACK:
                timerRef.current = setTimeout(() => {
                    advancePhase(SYMSPAN_PHASES.SYMMETRY_JUDGMENT); // Next practice judgment or stage end
                }, SYMSPAN_DEFAULTS.JUDGMENT_FEEDBACK_MS);
                break;

            case SYMSPAN_PHASES.PRE_SQUARE_BLANK:
                timerRef.current = setTimeout(() => {
                    advancePhase(SYMSPAN_PHASES.SQUARE_DISPLAY);
                }, SYMSPAN_DEFAULTS.PRE_SQUARE_BLANK_MS);
                break;

            case SYMSPAN_PHASES.SQUARE_DISPLAY:
                timerRef.current = setTimeout(() => {
                    advancePhase(SYMSPAN_PHASES.POST_SQUARE_BLANK);
                }, SYMSPAN_DEFAULTS.SQUARE_DISPLAY_MS);
                break;

            case SYMSPAN_PHASES.POST_SQUARE_BLANK:
                timerRef.current = setTimeout(() => {
                    advancePhase(SYMSPAN_PHASES.FIXATION); // Logic hook decides: next element or RECALL
                }, SYMSPAN_DEFAULTS.POST_SQUARE_BLANK_MS);
                break;

            case SYMSPAN_PHASES.SET_FEEDBACK:
                timerRef.current = setTimeout(() => {
                    advancePhase(SYMSPAN_PHASES.FIXATION); // Logic hook advances to the next set
                }, SYMSPAN_DEFAULTS.SET_FEEDBACK_MS);
                break;

            case SYMSPAN_PHASES.RECALL:
                timerRef.current = setTimeout(() => {
                    advancePhase(SYMSPAN_PHASES.RECALL_TIMEOUT);
                }, SYMSPAN_DEFAULTS.RECALL_TIMEOUT_MS);
                break;

            // No timers for these phases
            case SYMSPAN_PHASES.INSTRUCTIONS:
            case SYMSPAN_PHASES.PRACTICE_FEEDBACK:
            case SYMSPAN_PHASES.READY_ASSESSMENT:
            case SYMSPAN_PHASES.RECALL_TIMEOUT:
            case SYMSPAN_PHASES.SAVING:
            case SYMSPAN_PHASES.RESULTS:
                break;

            default:
                console.warn(`[SymSpan Timer] Unhandled phase: ${currentPhase}`);
                break;
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [currentPhase, advancePhase, judgmentDeadlineMs]);

    // No phase checks here: timerRef always holds the most recently scheduled
    // timer, so unconditionally clearing is safe — and a phase check would race
    // against the deferred controlsRef publication below (stale closure could
    // no-op the clear right after a phase transition).
    const clearJudgmentTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const clearRecallTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // Publish controls for the logic hook (avoids a circular hook dependency)
    useEffect(() => {
        if (controlsRef) {
            controlsRef.current = { clearJudgmentTimer, clearRecallTimer };
        }
    }, [controlsRef, clearJudgmentTimer, clearRecallTimer]);
};

export default useSymmetrySpanTimer;

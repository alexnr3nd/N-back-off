/* src/components/testing/digitSpan/hooks/useDigitSpanTimer.js */
import { useEffect, useRef, useCallback } from 'react';
import { DIGIT_SPAN_PHASES, DIGIT_SPAN_TIMING } from '../../../../constants/digitSpanConstants';

/**
 * Timer hook for the Digit Span task. Single instance; the event callback is
 * held in a ref so timer effects depend only on the phase / trial key.
 *
 * Presentation timing uses ABSOLUTE-DEADLINE scheduling: the whole digit
 * schedule is precomputed against a performance.now() anchor at fixation
 * start, and every timeout is set as (deadline - now). Chained fixed delays
 * would accumulate drift at the 800/200 ms cadence; anchored deadlines do not
 * (jsPsych-style pattern). Actual digit-on durations are measured and reported
 * with the recall_start event for post-hoc validity checks.
 *
 * Timer events emitted via onTimerEvent(type, payload):
 * - 'digit_show'   { index }                 - digit `index` should appear
 * - 'digit_blank'  { index }                 - digit `index` should disappear
 * - 'recall_cue'                             - go-signal between stream and recall
 * - 'recall_start' { measuredDigitOnMs }     - open the keypad
 * - 'recall_timeout'                         - 90 s recall window expired
 * - 'feedback_done'                          - scored-trial check/X feedback elapsed
 * - 'interrupted_done'                       - "trial restarted" notice elapsed
 *
 * @param {object} params
 * @param {string} params.currentPhase
 * @param {number} params.presentationTrialKey - Increments when a trial's presentation starts (0 = none).
 * @param {number} params.digitCount - Digit count of the current trial.
 * @param {function} params.onTimerEvent
 * @param {object} [params.controlsRef] - Populated with { cancelPresentation, clearPhaseTimer }.
 */
const useDigitSpanTimer = ({ currentPhase, presentationTrialKey, digitCount, onTimerEvent, controlsRef }) => {
    const eventRef = useRef(onTimerEvent);
    useEffect(() => {
        eventRef.current = onTimerEvent;
    }, [onTimerEvent]);

    // Read at presentation start without re-triggering the runner effect
    const digitCountRef = useRef(digitCount);
    useEffect(() => {
        digitCountRef.current = digitCount;
    }, [digitCount]);

    const presentationRunRef = useRef(null); // { cancelled, timeoutId }
    const phaseTimeoutRef = useRef(null);

    // --- Presentation runner (fixation -> digits -> cue -> recall) ---
    useEffect(() => {
        if (!presentationTrialKey) return undefined;
        const digitTotal = digitCountRef.current;
        if (!digitTotal) return undefined;

        const { FIXATION_DURATION_MS, DIGIT_DISPLAY_MS, DIGIT_BLANK_MS, RECALL_CUE_MS } = DIGIT_SPAN_TIMING;
        const soaMs = DIGIT_DISPLAY_MS + DIGIT_BLANK_MS;
        const anchor = performance.now();

        const steps = [];
        for (let i = 0; i < digitTotal; i++) {
            steps.push({ at: FIXATION_DURATION_MS + i * soaMs, type: 'digit_show', index: i });
            steps.push({ at: FIXATION_DURATION_MS + i * soaMs + DIGIT_DISPLAY_MS, type: 'digit_blank', index: i });
        }
        steps.push({ at: FIXATION_DURATION_MS + digitTotal * soaMs, type: 'recall_cue' });
        steps.push({ at: FIXATION_DURATION_MS + digitTotal * soaMs + RECALL_CUE_MS, type: 'recall_start' });

        const run = { cancelled: false, timeoutId: null };
        presentationRunRef.current = run;

        const showTimes = new Array(digitTotal).fill(null);
        const onDurations = [];
        let stepIndex = 0;

        const scheduleNext = () => {
            if (run.cancelled || stepIndex >= steps.length) return;
            const step = steps[stepIndex];
            const delay = Math.max(0, anchor + step.at - performance.now());
            run.timeoutId = setTimeout(() => {
                if (run.cancelled) return;
                stepIndex++;
                const firedAt = performance.now();
                if (step.type === 'digit_show') {
                    showTimes[step.index] = firedAt;
                    eventRef.current('digit_show', { index: step.index });
                } else if (step.type === 'digit_blank') {
                    if (showTimes[step.index] != null) {
                        onDurations.push(firedAt - showTimes[step.index]);
                    }
                    eventRef.current('digit_blank', { index: step.index });
                } else if (step.type === 'recall_cue') {
                    eventRef.current('recall_cue');
                } else if (step.type === 'recall_start') {
                    const measuredDigitOnMs = onDurations.length > 0 ? {
                        min: Math.round(Math.min(...onDurations)),
                        max: Math.round(Math.max(...onDurations)),
                        mean: Math.round((onDurations.reduce((s, v) => s + v, 0) / onDurations.length) * 10) / 10,
                    } : null;
                    eventRef.current('recall_start', { measuredDigitOnMs });
                }
                scheduleNext();
            }, delay);
        };
        scheduleNext();

        return () => {
            run.cancelled = true;
            if (run.timeoutId) clearTimeout(run.timeoutId);
        };
    }, [presentationTrialKey]);

    // --- Phase timers (recall timeout, scored feedback, interruption notice) ---
    useEffect(() => {
        if (phaseTimeoutRef.current) {
            clearTimeout(phaseTimeoutRef.current);
            phaseTimeoutRef.current = null;
        }

        let delay = null;
        let eventType = null;
        switch (currentPhase) {
            case DIGIT_SPAN_PHASES.RECALL:
                delay = DIGIT_SPAN_TIMING.RECALL_TIMEOUT_MS;
                eventType = 'recall_timeout';
                break;
            case DIGIT_SPAN_PHASES.TRIAL_FEEDBACK:
                delay = DIGIT_SPAN_TIMING.TRIAL_FEEDBACK_MS;
                eventType = 'feedback_done';
                break;
            case DIGIT_SPAN_PHASES.INTERRUPTED:
                delay = DIGIT_SPAN_TIMING.INTERRUPTED_NOTICE_MS;
                eventType = 'interrupted_done';
                break;
            default:
                break;
        }

        if (delay != null) {
            phaseTimeoutRef.current = setTimeout(() => {
                phaseTimeoutRef.current = null;
                eventRef.current(eventType);
            }, delay);
        }

        return () => {
            if (phaseTimeoutRef.current) {
                clearTimeout(phaseTimeoutRef.current);
                phaseTimeoutRef.current = null;
            }
        };
    }, [currentPhase]);

    // --- Controls (exposed to the logic hook via controlsRef) ---
    const cancelPresentation = useCallback(() => {
        const run = presentationRunRef.current;
        if (run) {
            run.cancelled = true;
            if (run.timeoutId) clearTimeout(run.timeoutId);
        }
    }, []);

    const clearPhaseTimer = useCallback(() => {
        if (phaseTimeoutRef.current) {
            clearTimeout(phaseTimeoutRef.current);
            phaseTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (controlsRef) {
            controlsRef.current = { cancelPresentation, clearPhaseTimer };
        }
    }, [controlsRef, cancelPresentation, clearPhaseTimer]);
};

export default useDigitSpanTimer;

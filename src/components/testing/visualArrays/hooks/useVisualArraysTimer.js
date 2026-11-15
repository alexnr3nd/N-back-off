/* src/components/testing/visualArrays/hooks/useVisualArraysTimer.js */
import { useRef, useCallback, useEffect } from 'react';
import { VISUAL_ARRAYS_PHASES, VISUAL_ARRAYS_TIMING } from '../../../../constants/visualArraysConstants';

const T = VISUAL_ARRAYS_TIMING;

// Measured array durations outside this window mean the stimulus was not
// presented faithfully (a long frame stall jumped over part or all of the
// 250ms array window) — the trial must be voided, not scored as a guess.
// Bounds are generous: ±1 frame at 60Hz is ~233-267ms; 150/500 only catch
// gross corruption.
const MIN_VALID_ARRAY_MS = 150;
const MAX_VALID_ARRAY_MS = 500;

/**
 * Drives one trial's presentation sequence with a single rAF loop:
 * FIXATION (800) -> CUE (250) -> CUE_GAP (100) -> ARRAY (250) ->
 * RETENTION (900) -> PROBE (until response; logic hook owns the timeout).
 *
 * Phase boundaries are absolute offsets from the trial-start timestamp, so
 * drift cannot accumulate. The ARRAY on/off transitions happen inside rAF
 * callbacks (paint-aligned); the actual visible duration is measured from
 * the frame timestamps and reported via onProbe(measuredArrayOnMs,
 * presentationValid). The boundary scan jumps to the LATEST crossed
 * boundary, so a single long frame gap can skip the CUE or ARRAY phase
 * entirely — presentationValid=false tells the logic hook to void the
 * trial through the same redo path as a tab-hidden interruption.
 */
export const useVisualArraysTimer = ({ onPhaseChange, onProbe }) => {
    const rafIdRef = useRef(null);
    const runningRef = useRef(false);
    const arrayOnTsRef = useRef(null);
    const arrayOffTsRef = useRef(null);
    const cueSeenRef = useRef(false);
    const phaseRef = useRef(null);

    const cancelPresentation = useCallback(() => {
        runningRef.current = false;
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
    }, []);

    const startTrialPresentation = useCallback(() => {
        cancelPresentation();
        runningRef.current = true;
        arrayOnTsRef.current = null;
        arrayOffTsRef.current = null;
        cueSeenRef.current = false;
        phaseRef.current = null;

        const boundaries = [
            { phase: VISUAL_ARRAYS_PHASES.FIXATION, at: 0 },
            { phase: VISUAL_ARRAYS_PHASES.CUE, at: T.FIXATION_MS },
            { phase: VISUAL_ARRAYS_PHASES.CUE_GAP, at: T.FIXATION_MS + T.CUE_MS },
            { phase: VISUAL_ARRAYS_PHASES.ARRAY, at: T.FIXATION_MS + T.CUE_MS + T.CUE_GAP_MS },
            { phase: VISUAL_ARRAYS_PHASES.RETENTION, at: T.FIXATION_MS + T.CUE_MS + T.CUE_GAP_MS + T.ARRAY_MS },
            { phase: VISUAL_ARRAYS_PHASES.PROBE, at: T.FIXATION_MS + T.CUE_MS + T.CUE_GAP_MS + T.ARRAY_MS + T.RETENTION_MS },
        ];

        let startTs = null;

        const tick = (ts) => {
            if (!runningRef.current) return;
            if (startTs === null) startTs = ts; // first frame = trial anchor
            const elapsed = ts - startTs;

            // Find the latest boundary we have crossed
            let current = boundaries[0];
            for (const b of boundaries) {
                if (elapsed >= b.at) current = b;
            }

            if (current.phase !== phaseRef.current) {
                phaseRef.current = current.phase;
                if (current.phase === VISUAL_ARRAYS_PHASES.RETENTION) {
                    arrayOffTsRef.current = ts;
                } else if (current.phase === VISUAL_ARRAYS_PHASES.ARRAY) {
                    arrayOnTsRef.current = ts;
                } else if (current.phase === VISUAL_ARRAYS_PHASES.CUE) {
                    cueSeenRef.current = true;
                }
                onPhaseChange(current.phase);
                if (current.phase === VISUAL_ARRAYS_PHASES.PROBE) {
                    const measured = (arrayOnTsRef.current !== null && arrayOffTsRef.current !== null)
                        ? Math.round(arrayOffTsRef.current - arrayOnTsRef.current)
                        : null;
                    const presentationValid = cueSeenRef.current
                        && measured !== null
                        && measured >= MIN_VALID_ARRAY_MS
                        && measured <= MAX_VALID_ARRAY_MS;
                    onProbe(measured, presentationValid);
                    runningRef.current = false;
                    rafIdRef.current = null;
                    return; // PROBE phase is response-driven; loop ends here
                }
            }
            rafIdRef.current = requestAnimationFrame(tick);
        };

        // Double-rAF: schedule inside one frame so the first phase paints on
        // a clean vsync boundary.
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = requestAnimationFrame(tick);
        });
    }, [cancelPresentation, onPhaseChange, onProbe]);

    useEffect(() => cancelPresentation, [cancelPresentation]);

    return { startTrialPresentation, cancelPresentation };
};

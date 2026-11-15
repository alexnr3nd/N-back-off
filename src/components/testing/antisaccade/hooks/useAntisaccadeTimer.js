/* src/components/testing/antisaccade/hooks/useAntisaccadeTimer.js */
import { useRef, useCallback, useEffect } from 'react';
import { ANTISACCADE_PHASES, ANTISACCADE_TIMING } from '../../../../constants/antisaccadeConstants';

const T = ANTISACCADE_TIMING;

/**
 * Drives one trial's presentation sequence with a single rAF loop:
 * FIXATION (per-trial 2000-3000) -> TONE (300, fixation stays visible) ->
 * CUE (300) -> TARGET (100 scored / 300 practice) -> MASK (500) ->
 * RESPONSE (until response; logic hook owns the timeout).
 *
 * Phase boundaries are absolute offsets from the trial-start timestamp, so
 * drift cannot accumulate. The TARGET on/off transitions happen inside rAF
 * callbacks (paint-aligned); the actual visible duration is measured from
 * the frame timestamps and reported via onResponseReady(measuredTargetMs,
 * presentationValid). The boundary scan jumps to the LATEST crossed
 * boundary, so a single long frame gap can skip the TONE, CUE, or TARGET
 * phase entirely — presentationValid=false tells the logic hook to void
 * the trial through the same redo path as a tab-hidden interruption.
 *
 * fixationMs (jittered per trial) and targetMs (100 scored / 300 practice)
 * are passed into startTrialPresentation; the measured-exposure validity
 * window shifts with targetMs so practice trials aren't voided by the
 * scored-trial window.
 */
export const useAntisaccadeTimer = ({ onPhaseChange, onTone, onResponseReady }) => {
    const rafIdRef = useRef(null);
    const runningRef = useRef(false);
    const targetOnTsRef = useRef(null);
    const targetOffTsRef = useRef(null);
    const toneSeenRef = useRef(false);
    const cueSeenRef = useRef(false);
    const targetSeenRef = useRef(false);
    const phaseRef = useRef(null);

    const cancelPresentation = useCallback(() => {
        runningRef.current = false;
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
    }, []);

    const startTrialPresentation = useCallback((fixationMs, targetMs, opts = {}) => {
        // cueMs (the CUE->TARGET SOA) is parameterized for the trainer's
        // inhibition lever. Default = the assessment's fixed CUE_MS, so passing
        // only (fixationMs, targetMs) leaves the assessment behavior unchanged.
        const cueMs = (opts && Number.isFinite(opts.cueMs)) ? opts.cueMs : T.CUE_MS;
        cancelPresentation();
        runningRef.current = true;
        targetOnTsRef.current = null;
        targetOffTsRef.current = null;
        toneSeenRef.current = false;
        cueSeenRef.current = false;
        targetSeenRef.current = false;
        phaseRef.current = null;

        // Measured target exposures outside this window mean the letter was
        // not presented faithfully (a frame stall jumped over part or all of
        // the target window) — the trial must be voided, not scored as a
        // guess. The window is the scored-trial bounds (67-167 around the
        // 100ms target: -2/+4 frames @60Hz) shifted to the requested
        // duration, so the 300ms practice target gets 267-367. For targetMs =
        // TARGET_MS this reduces to exactly TARGET_MIN/MAX_VALID_MS.
        const minValidMs = targetMs + (T.TARGET_MIN_VALID_MS - T.TARGET_MS);
        const maxValidMs = targetMs + (T.TARGET_MAX_VALID_MS - T.TARGET_MS);

        const boundaries = [
            { phase: ANTISACCADE_PHASES.FIXATION, at: 0 },
            { phase: ANTISACCADE_PHASES.TONE, at: fixationMs },
            { phase: ANTISACCADE_PHASES.CUE, at: fixationMs + T.TONE_MS },
            { phase: ANTISACCADE_PHASES.TARGET, at: fixationMs + T.TONE_MS + cueMs },
            { phase: ANTISACCADE_PHASES.MASK, at: fixationMs + T.TONE_MS + cueMs + targetMs },
            { phase: ANTISACCADE_PHASES.RESPONSE, at: fixationMs + T.TONE_MS + cueMs + targetMs + T.MASK_MS },
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
                if (current.phase === ANTISACCADE_PHASES.MASK) {
                    targetOffTsRef.current = ts;
                } else if (current.phase === ANTISACCADE_PHASES.TARGET) {
                    targetOnTsRef.current = ts;
                    targetSeenRef.current = true;
                } else if (current.phase === ANTISACCADE_PHASES.CUE) {
                    cueSeenRef.current = true;
                } else if (current.phase === ANTISACCADE_PHASES.TONE) {
                    toneSeenRef.current = true;
                }
                onPhaseChange(current.phase);
                if (current.phase === ANTISACCADE_PHASES.TONE) {
                    // Tone-onset timestamp; the logic hook schedules the beep.
                    onTone(ts);
                } else if (current.phase === ANTISACCADE_PHASES.RESPONSE) {
                    const measured = (targetOnTsRef.current !== null && targetOffTsRef.current !== null)
                        ? Math.round(targetOffTsRef.current - targetOnTsRef.current)
                        : null;
                    // toneSeen/cueSeen guard the phases without timestamp
                    // pairs (VA's cueSeen mechanism): skipping either means a
                    // ≥300ms frame stall corrupted the presentation.
                    // (targetSeen is implied by measured !== null — both
                    // timestamps require the TARGET and MASK transitions —
                    // and is kept only for symmetry with the other flags.)
                    const presentationValid = toneSeenRef.current
                        && cueSeenRef.current
                        && targetSeenRef.current
                        && measured !== null
                        && measured >= minValidMs
                        && measured <= maxValidMs;
                    onResponseReady(measured, presentationValid);
                    runningRef.current = false;
                    rafIdRef.current = null;
                    return; // RESPONSE phase is response-driven; loop ends here
                }
            }
            rafIdRef.current = requestAnimationFrame(tick);
        };

        // Double-rAF: schedule inside one frame so the first phase paints on
        // a clean vsync boundary.
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = requestAnimationFrame(tick);
        });
    }, [cancelPresentation, onPhaseChange, onTone, onResponseReady]);

    useEffect(() => cancelPresentation, [cancelPresentation]);

    return { startTrialPresentation, cancelPresentation };
};

/* src/components/testing/relationMonitoring/hooks/useRelationMonitoringTimer.js */
import { useRef, useCallback, useEffect } from 'react';
import { RELATION_MONITORING_DEFAULTS } from '../../../../constants/relationMonitoringConstants';

const D = RELATION_MONITORING_DEFAULTS;

/**
 * Drives one continuous block of Relation Monitoring arrays with a single
 * rAF loop: each "slot" is ARRAY_MS of grid time plus a gap (the 100ms blink
 * for scored blocks, the feedback interval for practice). Slot boundaries
 * are absolute offsets from the stream-start timestamp, so drift cannot
 * accumulate across the ~3.4-minute block.
 *
 * The actual on-screen duration of every array is measured from frame
 * timestamps. A duration deviating more than MAX_ARRAY_DEVIATION_RATIO from
 * ARRAY_MS (tab hidden, OS throttling, long frame stall) means the stimulus
 * was not presented faithfully — onArrayEnd reports presentationValid=false
 * and the logic hook records the trial as flagged (excluded from scoring
 * server-side). Slots jumped over entirely while rAF was suspended are
 * finalized the same way, in order, so the record list stays index-ordered.
 *
 * Callbacks:
 *   onArrayStart(slotIndex)                            — array i is on screen
 *   onArrayEnd(slotIndex, measuredMs, presentationValid) — array i finished
 *   onStreamEnd()                                      — all slots finalized
 */
export const useRelationMonitoringTimer = ({ onArrayStart, onArrayEnd, onStreamEnd }) => {
    const rafIdRef = useRef(null);
    const runningRef = useRef(false);

    const cancelStream = useCallback(() => {
        runningRef.current = false;
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
    }, []);

    const startStream = useCallback((trialCount, gapMs) => {
        cancelStream();
        runningRef.current = true;

        const slotMs = D.ARRAY_MS + gapMs;
        const maxDeviation = D.ARRAY_MS * D.MAX_ARRAY_DEVIATION_RATIO;
        let startTs = null;
        let displayedSlot = null;   // slot whose array is currently on screen
        let arrayOnTs = null;
        let finalizedThrough = -1;  // highest slot index already reported via onArrayEnd

        const tick = (ts) => {
            if (!runningRef.current) return;
            if (startTs === null) startTs = ts; // first frame = stream anchor
            const elapsed = ts - startTs;
            const slot = Math.floor(elapsed / slotMs);
            const inArray = slot < trialCount && (elapsed - slot * slotMs) < D.ARRAY_MS;

            // 1. The displayed array is no longer the active array window:
            //    finalize it with its measured duration.
            if (displayedSlot !== null && !(inArray && slot === displayedSlot)) {
                const measured = Math.round(ts - arrayOnTs);
                onArrayEnd(displayedSlot, measured, Math.abs(measured - D.ARRAY_MS) <= maxDeviation);
                finalizedThrough = Math.max(finalizedThrough, displayedSlot);
                displayedSlot = null;
                arrayOnTs = null;
            }

            // 2. Slots jumped over while rAF was suspended were never painted.
            //    (If we woke up inside `slot`'s gap, `slot` itself was skipped.)
            const skippedUpTo = Math.min(inArray ? slot : slot + 1, trialCount);
            for (let s = finalizedThrough + 1; s < skippedUpTo; s++) {
                onArrayEnd(s, null, false);
                finalizedThrough = s;
            }

            // 3. Past the last slot's gap: the stream is over.
            if (slot >= trialCount) {
                runningRef.current = false;
                rafIdRef.current = null;
                onStreamEnd();
                return;
            }

            // 4. Inside an array window that hasn't started displaying yet.
            if (inArray && displayedSlot === null && slot > finalizedThrough) {
                displayedSlot = slot;
                arrayOnTs = ts;
                onArrayStart(slot);
            }

            rafIdRef.current = requestAnimationFrame(tick);
        };

        // Double-rAF: schedule inside one frame so the first array paints on
        // a clean vsync boundary.
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = requestAnimationFrame(tick);
        });
    }, [cancelStream, onArrayStart, onArrayEnd, onStreamEnd]);

    useEffect(() => cancelStream, [cancelStream]);

    return { startStream, cancelStream };
};

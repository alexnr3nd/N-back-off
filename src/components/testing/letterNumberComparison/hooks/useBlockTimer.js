/* src/components/testing/letterNumberComparison/hooks/useBlockTimer.js */
import { useRef, useCallback, useEffect } from 'react';
import { LNC_DEFAULTS } from '../../../../constants/letterNumberComparisonConstants';

const D = LNC_DEFAULTS;

/**
 * Drives one 30-second timed block. Unlike the stimulus-paced RM/VA timers,
 * items here are USER-paced — the only clock is the block clock, so frame
 * jitter cannot affect the score; the clock only has to (a) end the block
 * within a frame of 30.000s and (b) detect conditions that corrupt
 * count-per-time scoring entirely:
 *   - tab hidden / app backgrounded (clock runs, user can't respond)
 *   - a single rAF gap > RAF_STALL_VOID_MS (frozen WebView)
 *   - an overlay opening (reported by the Task via voidBlock)
 * Void and expire are mutually exclusive and idempotent: whichever flips
 * runningRef first wins; late taps are rejected by the logic hook's
 * blockActive guard, which is cleared synchronously in both callbacks.
 */
export const useBlockTimer = ({ onExpire, onVoid }) => {
    const rafIdRef = useRef(null);
    const runningRef = useRef(false);
    const startTsRef = useRef(null);
    const callbacksRef = useRef({ onExpire, onVoid });
    callbacksRef.current = { onExpire, onVoid };

    const stopBlock = useCallback(() => {
        runningRef.current = false;
        startTsRef.current = null;
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
    }, []);

    const voidBlock = useCallback((reason) => {
        if (!runningRef.current) return;
        stopBlock();
        callbacksRef.current.onVoid(reason);
    }, [stopBlock]);

    const startBlock = useCallback((durationMs) => {
        stopBlock();
        runningRef.current = true;
        startTsRef.current = null;
        let lastFrameTs = null;

        const tick = (ts) => {
            if (!runningRef.current) return;
            if (startTsRef.current === null) {
                startTsRef.current = ts; // first painted frame = clock zero
                lastFrameTs = ts;
            }
            if (ts - lastFrameTs > D.RAF_STALL_VOID_MS) {
                voidBlock('stall');
                return;
            }
            lastFrameTs = ts;
            if (ts - startTsRef.current >= durationMs) {
                runningRef.current = false;
                rafIdRef.current = null;
                callbacksRef.current.onExpire();
                return;
            }
            rafIdRef.current = requestAnimationFrame(tick);
        };
        // Double-rAF so the first item paints on a clean vsync boundary
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = requestAnimationFrame(tick);
        });
    }, [stopBlock, voidBlock]);

    // Tab hidden while a block is running -> the clock would keep counting
    // against a user who can't see the items. Void immediately.
    useEffect(() => {
        const handler = () => {
            if (document.hidden) voidBlock('hidden');
        };
        document.addEventListener('visibilitychange', handler);
        return () => document.removeEventListener('visibilitychange', handler);
    }, [voidBlock]);

    useEffect(() => stopBlock, [stopBlock]);

    const getElapsedMs = useCallback(() => {
        if (startTsRef.current === null) return 0;
        return performance.now() - startTsRef.current;
    }, []);

    return { startBlock, stopBlock, voidBlock, getElapsedMs };
};

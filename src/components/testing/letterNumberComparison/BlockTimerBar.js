/* src/components/testing/letterNumberComparison/BlockTimerBar.js */
import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Thin countdown bar for a timed block, driven entirely by a single CSS
 * width transition — zero per-frame React updates, so it never competes with
 * the block clock or the response hot path. On each `runKey` change it snaps
 * to 100% (transition off), then on a double-rAF sets width to 0% with a
 * `width <durationMs>ms linear` transition so the fill empties in step with
 * the block. This is purely cosmetic: scoring is bounded by useBlockTimer, not
 * by this bar.
 */
const BlockTimerBar = ({ durationMs, runKey }) => {
    const fillRef = useRef(null);

    useEffect(() => {
        const el = fillRef.current;
        if (!el) return undefined;
        // Snap full with no animation.
        el.style.transition = 'none';
        el.style.width = '100%';
        // Double-rAF: let the 100% paint commit, then animate down to empty.
        const raf1 = requestAnimationFrame(() => {
            const raf2 = requestAnimationFrame(() => {
                el.style.transition = `width ${durationMs}ms linear`;
                el.style.width = '0%';
            });
            // Store the inner id so cleanup can cancel either pending frame.
            el.dataset.raf2 = String(raf2);
        });
        return () => {
            cancelAnimationFrame(raf1);
            if (el.dataset.raf2) cancelAnimationFrame(Number(el.dataset.raf2));
        };
    }, [runKey, durationMs]);

    return (
        <div className="w-full max-w-md mx-auto h-1.5 bg-theme-bg-elevated overflow-hidden">
            <div ref={fillRef} className="h-full bg-theme-accent" style={{ width: '100%' }} />
        </div>
    );
};

BlockTimerBar.propTypes = {
    durationMs: PropTypes.number.isRequired,
    runKey: PropTypes.number.isRequired,
};

export default BlockTimerBar;

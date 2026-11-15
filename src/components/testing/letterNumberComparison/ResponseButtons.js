/* src/components/testing/letterNumberComparison/ResponseButtons.js */
import React, { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * SAME / DIFFERENT response row: two large, thumb-reachable buttons side by
 * side. Keyboard shortcuts S / D while enabled (web), shown as hints only on
 * fine-pointer devices. The handler re-checks `disabled` so a tap racing the
 * blink/expiry can't double-fire. Guard pattern cloned from
 * visualArrays/ResponseButtons.js.
 */
const ResponseButtons = ({ onRespond, disabled = false }) => {
    const showKeyHints = useMemo(() => {
        try {
            return window.matchMedia('(pointer: fine)').matches;
        } catch (e) {
            return false;
        }
    }, []);

    useEffect(() => {
        if (disabled) return undefined;
        const handleKeyDown = (event) => {
            if (event.defaultPrevented) return;
            // Browser chords (Ctrl+S save, Ctrl+D bookmark) and typing into a
            // form field (e.g. the feedback modal's textarea) must never
            // register as task responses.
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            const target = event.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
            if (event.key === 's' || event.key === 'S') {
                event.preventDefault();
                onRespond('same');
            } else if (event.key === 'd' || event.key === 'D') {
                event.preventDefault();
                onRespond('different');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [disabled, onRespond]);

    const handleClick = (response) => {
        if (disabled) return;
        onRespond(response);
    };

    const buttonClass = (extra) =>
        `min-h-[64px] flex-1 py-3 px-4 text-base font-mono uppercase tracking-wider border transition-colors duration-150 flex items-center justify-center gap-2 touch-manipulation ${
            disabled
                ? 'bg-theme-bg-secondary text-theme-text-muted/40 cursor-not-allowed border-theme-line/50'
                : extra
        }`;

    return (
        <div className="flex gap-3 w-full max-w-md mx-auto select-none [-webkit-tap-highlight-color:transparent]">
            <button
                aria-label="Same"
                onClick={() => handleClick('same')}
                disabled={disabled}
                className={buttonClass('bg-theme-bg-elevated text-theme-text border-theme-line hover:border-theme-accent hover:text-theme-accent')}
            >
                <span>Same</span>
                {showKeyHints && <span className="text-xs text-theme-text-muted">[S]</span>}
            </button>
            <button
                aria-label="Different"
                onClick={() => handleClick('different')}
                disabled={disabled}
                className={buttonClass('bg-theme-bg-elevated text-theme-text border-theme-accent/50 hover:bg-theme-accent/10 hover:border-theme-accent')}
            >
                <span>Different</span>
                {showKeyHints && <span className="text-xs text-theme-text-muted">[D]</span>}
            </button>
        </div>
    );
};

ResponseButtons.propTypes = {
    onRespond: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
};

export default ResponseButtons;

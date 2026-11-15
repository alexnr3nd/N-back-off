/* src/components/testing/antisaccade/ResponseButtons.js */
import React, { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * Q / O response row (validated tablet pattern: two large thumb-friendly
 * buttons, cloned from visualArrays/ResponseButtons). Keyboard shortcuts
 * Q / O (case-insensitive) while enabled; key hints shown only on
 * fine-pointer (mouse/trackpad) devices.
 *
 * Contract: `onRespond(letter, modality)` — letter is 'Q' | 'O', modality is
 * 'key' | 'touch'. The task logic tallies modality so the submit payload can
 * report the dominant input mode (`inputModality`).
 *
 * `responseEnabled` is set by the parent at MASK onset (mask + response
 * phases both accept responses); this component never derives it from phase.
 *
 * Both buttons intentionally share the neutral button styling (VA highlights
 * its "Different" button, but Q vs O is an unbiased 2-alternative choice and
 * neither response may be visually privileged).
 */
// Single shared enabled-state styling for BOTH buttons. Q vs O is an unbiased
// 2-alternative choice — neither response may ever be visually privileged
// (VA highlights its "Different" button; that pattern must NOT be cloned here).
const NEUTRAL_BUTTON_CLASS =
    'bg-theme-bg-elevated text-theme-text border-theme-line hover:border-theme-accent hover:text-theme-accent';

const ResponseButtons = ({ onRespond, responseEnabled = false, useArrowKeys = false }) => {
    const disabled = !responseEnabled;

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
            // Browser chords (Ctrl+Q quit, Ctrl+O open) and typing into a
            // form field (e.g. the feedback modal's textarea) must never
            // register as task responses.
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            const target = event.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
            if (useArrowKeys) {
                // Trainer: arrow keys map to the on-screen button positions
                // (left button = Q, right button = O).
                if (event.key === 'ArrowLeft') { event.preventDefault(); onRespond('Q', 'key'); }
                else if (event.key === 'ArrowRight') { event.preventDefault(); onRespond('O', 'key'); }
            } else if (event.key === 'q' || event.key === 'Q') {
                event.preventDefault();
                onRespond('Q', 'key');
            } else if (event.key === 'o' || event.key === 'O') {
                event.preventDefault();
                onRespond('O', 'key');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [disabled, onRespond, useArrowKeys]);

    // One computed string used by BOTH buttons — identical by construction.
    const buttonClass =
        `min-h-[56px] py-3 px-4 text-sm font-mono uppercase tracking-wider border transition-colors duration-150 flex items-center justify-center gap-2 touch-manipulation ${
            disabled
                ? 'bg-theme-bg-secondary text-theme-text-muted/40 cursor-not-allowed border-theme-line/50'
                : NEUTRAL_BUTTON_CLASS
        }`;

    return (
        <div className="grid grid-cols-2 gap-2 w-full max-w-md mx-auto select-none [-webkit-tap-highlight-color:transparent]">
            <button
                aria-label="Respond Q"
                onClick={() => onRespond('Q', 'touch')}
                disabled={disabled}
                className={buttonClass}
            >
                <span>Q</span>
                {showKeyHints && <span className="text-xs text-theme-text-muted">{useArrowKeys ? '[←]' : '[Q]'}</span>}
            </button>
            <button
                aria-label="Respond O"
                onClick={() => onRespond('O', 'touch')}
                disabled={disabled}
                className={buttonClass}
            >
                <span>O</span>
                {showKeyHints && <span className="text-xs text-theme-text-muted">{useArrowKeys ? '[→]' : '[O]'}</span>}
            </button>
        </div>
    );
};

ResponseButtons.propTypes = {
    onRespond: PropTypes.func.isRequired,
    responseEnabled: PropTypes.bool,
    useArrowKeys: PropTypes.bool,
};

export default ResponseButtons;

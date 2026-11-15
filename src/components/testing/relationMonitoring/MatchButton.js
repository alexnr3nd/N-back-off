/* src/components/testing/relationMonitoring/MatchButton.js */
import React, { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

/**
 * Single large MATCH response button (the task has no non-match response —
 * withholding IS the non-match response). Keyboard shortcut: Space while
 * enabled; the key hint is shown only on fine-pointer devices. Once the
 * on-screen array has been answered, the button flips to an acknowledged
 * state until the next array (first response counts; no un-pressing).
 */
const MatchButton = ({ onRespond, disabled = false, responded = false }) => {
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
            // Browser chords and typing into a form field (e.g. the feedback
            // modal's textarea) must never register as task responses.
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            const target = event.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
            if (event.key === ' ' || event.code === 'Space') {
                event.preventDefault(); // Space must not scroll the page
                onRespond();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [disabled, onRespond]);

    const stateClass = disabled
        ? 'bg-theme-bg-secondary text-theme-text-muted/40 cursor-not-allowed border-theme-line/50'
        : responded
            ? 'bg-theme-accent/20 text-theme-accent border-theme-accent'
            : 'bg-theme-bg-elevated text-theme-text border-theme-accent/50 hover:bg-theme-accent/10 hover:border-theme-accent';

    return (
        <div className="w-full max-w-md mx-auto select-none [-webkit-tap-highlight-color:transparent]">
            <button
                aria-label="Report match"
                onClick={() => onRespond()}
                disabled={disabled}
                className={`w-full min-h-[64px] py-3 px-4 text-base font-mono uppercase tracking-[0.2em] border transition-colors duration-150 flex items-center justify-center gap-3 touch-manipulation ${stateClass}`}
            >
                {responded && !disabled ? (
                    <>
                        <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                        <span>Match Logged</span>
                    </>
                ) : (
                    <>
                        <span>Match</span>
                        {showKeyHints && <span className="text-xs tracking-normal text-theme-text-muted">[SPACE]</span>}
                    </>
                )}
            </button>
        </div>
    );
};

MatchButton.propTypes = {
    onRespond: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    responded: PropTypes.bool,
};

export default MatchButton;

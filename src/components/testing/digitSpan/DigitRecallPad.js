/* src/components/testing/digitSpan/DigitRecallPad.js */
import React, { useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDeleteLeft, faCheck } from '@fortawesome/free-solid-svg-icons';
import { DIGIT_SPAN_BLOCKS } from '../../../constants/digitSpanConstants';

/**
 * On-screen keypad for digit recall (adapted from countingSpan/RecallInterface).
 * Digits 1-9 only (no 0, no blank key). Controlled component: `value` is the
 * ordered array of digits entered so far; submit is always enabled (a partial
 * response simply scores as incorrect).
 *
 * Touch standards: >= 48 px keys with 8 px gaps in a 3x3 dialer layout,
 * touch-action: manipulation + user-select: none to suppress double-tap zoom
 * during rapid serial entry, transparent tap highlight.
 */
const DigitRecallPad = ({ expectedLength, direction, onSubmit, value, onChange, inputDisabled = false }) => {
    const digits = value || [];

    const handleDigitClick = useCallback((number) => {
        if (digits.length >= expectedLength) return;
        onChange([...digits, number]);
    }, [digits, expectedLength, onChange]);

    const handleBackspaceClick = useCallback(() => {
        if (digits.length === 0) return;
        onChange(digits.slice(0, -1));
    }, [digits, onChange]);

    const handleSubmitClick = useCallback(() => {
        onSubmit();
    }, [onSubmit]);

    // Physical keyboard: digits 1-9, Backspace, Enter.
    // inputDisabled (exit modal open) and defaultPrevented (the modal's own
    // Enter-confirm handler) both block this window-level listener — otherwise
    // Enter would confirm the exit AND submit the in-flight recall.
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (inputDisabled || event.defaultPrevented) return;
            if (/^[1-9]$/.test(event.key)) {
                event.preventDefault();
                handleDigitClick(parseInt(event.key, 10));
            } else if (event.key === 'Backspace') {
                event.preventDefault();
                handleBackspaceClick();
            } else if (event.key === 'Enter') {
                event.preventDefault();
                handleSubmitClick();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleDigitClick, handleBackspaceClick, handleSubmitClick, inputDisabled]);

    const isBackward = direction === DIGIT_SPAN_BLOCKS.BACKWARD;
    const isFull = digits.length >= expectedLength;

    return (
        <div className="flex flex-col items-center w-full max-w-xs mx-auto py-4 select-none [-webkit-tap-highlight-color:transparent]">
            <p className={`mb-4 text-sm font-mono uppercase tracking-wider text-center ${isBackward ? 'text-theme-accent' : 'text-theme-text-muted'}`}>
                {isBackward
                    ? 'Enter the digits in REVERSE order: last digit first'
                    : 'Enter the digits in the order shown'}
            </p>

            {/* Entered-digit slots */}
            <div className="flex flex-wrap justify-center gap-1.5 mb-6 min-h-[2.5rem] items-end">
                {Array.from({ length: expectedLength }).map((_, index) => (
                    <span
                        key={index}
                        className={`w-9 h-10 flex items-center justify-center text-xl font-mono border transition-all duration-150 ${
                            index === digits.length
                                ? 'border-theme-accent bg-theme-accent/10 text-theme-accent'
                                : 'border-theme-line bg-theme-bg-secondary'
                        } ${digits[index] !== undefined ? 'text-theme-text' : 'text-theme-text-muted'}`}
                    >
                        {digits[index] !== undefined ? digits[index] : '_'}
                    </span>
                ))}
            </div>

            {/* 3x3 dialer pad (1-9 only) */}
            <div className="grid grid-cols-3 gap-2 mb-4 w-full touch-manipulation">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                        key={num}
                        aria-label={`Digit ${num}`}
                        onClick={() => handleDigitClick(num)}
                        disabled={isFull}
                        className={`min-h-[48px] py-3 px-4 text-lg font-mono border transition-colors duration-150 touch-manipulation ${
                            isFull
                                ? 'bg-theme-bg-secondary text-theme-text-muted/40 cursor-not-allowed border-theme-line/50'
                                : 'bg-theme-bg-elevated text-theme-text border-theme-line hover:border-theme-accent hover:text-theme-accent'
                        }`}
                    >
                        {num}
                    </button>
                ))}
            </div>

            {/* Backspace + Submit */}
            <div className="grid grid-cols-2 gap-2 w-full">
                <button
                    aria-label="Backspace"
                    onClick={handleBackspaceClick}
                    disabled={digits.length === 0}
                    className={`min-h-[48px] py-3 px-4 text-sm font-mono uppercase tracking-wider border transition-colors duration-150 flex items-center justify-center gap-2 touch-manipulation ${
                        digits.length === 0
                            ? 'bg-theme-bg-secondary text-theme-text-muted/40 cursor-not-allowed border-theme-line/50'
                            : 'bg-theme-bg-elevated text-theme-accent border-theme-accent/50 hover:bg-theme-accent/10 hover:border-theme-accent'
                    }`}
                >
                    <FontAwesomeIcon icon={faDeleteLeft} className="h-4 w-4" />
                    <span>Back</span>
                </button>

                <button
                    aria-label="Submit response"
                    onClick={handleSubmitClick}
                    className="min-h-[48px] py-3 px-4 text-sm font-mono uppercase tracking-wider border transition-colors duration-150 flex items-center justify-center gap-2 touch-manipulation bg-status-success text-white border-status-success hover:bg-status-success/90"
                >
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                    <span>Submit</span>
                </button>
            </div>
        </div>
    );
};

DigitRecallPad.propTypes = {
    expectedLength: PropTypes.number.isRequired,
    direction: PropTypes.string.isRequired,
    onSubmit: PropTypes.func.isRequired,
    value: PropTypes.arrayOf(PropTypes.number).isRequired,
    onChange: PropTypes.func.isRequired,
    inputDisabled: PropTypes.bool,
};

export default DigitRecallPad;

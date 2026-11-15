/* src/components/testing/countingSpan/RecallInterface.js */
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDeleteLeft, faCheck } from '@fortawesome/free-solid-svg-icons';

/**
 * Provides the user interface for recalling the sequence of counts.
 * Displays a number pad and input fields for the user to enter their response.
 * Acts as a controlled component, receiving the sequence via `value` and
 * reporting changes via `onChange`.
 * Redesigned with Cognitive Lab aesthetic.
 *
 * @param {object} props
 * @param {number} props.setSize - The number of items to recall for the current set.
 * @param {function} props.onSubmit - Function to call when the user submits the sequence: (sequence) => void.
 * @param {Array<number|null>} props.value - The current recall sequence state from the parent hook.
 * @param {function} props.onChange - Function to call when the sequence is modified by the user: (newSequence) => void.
 * @param {boolean} [props.wrapSlots=false] - Allow the slot row to wrap onto multiple lines.
 *   The assessment caps set size at 7, which fits one row, so it leaves this off and keeps
 *   the original single-line row. The Trainer goes up to set size 10, where a non-wrapping
 *   row squashes the slots, so it opts in.
 */
const RecallInterface = ({ setSize, onSubmit, value, onChange, wrapSlots = false }) => {
    // Internal state primarily for managing the visual focus/cursor position
    const [currentInputIndex, setCurrentInputIndex] = useState(0);

    // Use the sequence passed from the parent hook via 'value' prop.
    const recalledSequence = value || Array(setSize).fill(null);

    // Effect to update the internal cursor position based on the external `value` prop.
    useEffect(() => {
        const firstNull = recalledSequence.findIndex(val => val === null || val === undefined);
        setCurrentInputIndex(firstNull === -1 ? setSize : firstNull);
    }, [recalledSequence, setSize]);

    // --- Event Handlers ---

    // Handle number button clicks (or keyboard number input)
    const handleNumberClick = useCallback((number) => {
        const targetIndex = currentInputIndex;

        if (targetIndex < setSize) {
            const newSequence = [...recalledSequence];
            newSequence[targetIndex] = number;
            if (onChange) {
                onChange(newSequence);
            }
        }
    }, [currentInputIndex, setSize, recalledSequence, onChange]);

    // Handle backspace button click (or keyboard backspace)
    const handleBackspaceClick = useCallback(() => {
        const indexToClear = (currentInputIndex === setSize) ? setSize - 1 : currentInputIndex - 1;

        if (indexToClear >= 0) {
            const newSequence = [...recalledSequence];
            newSequence[indexToClear] = null;
            if (onChange) {
                onChange(newSequence);
            }
        }
    }, [currentInputIndex, setSize, recalledSequence, onChange]);

    // Handle submitting the sequence via the Submit button (or Enter key)
    const handleSubmitClick = useCallback(() => {
        onSubmit(recalledSequence);
    }, [onSubmit, recalledSequence]);

    // Effect to handle keyboard input for numbers, backspace, and enter
    useEffect(() => {
        const handleKeyDown = (event) => {
            const key = event.key;
            // Handle number input (0-9)
            if (!isNaN(parseInt(key)) && key.length === 1) {
                event.preventDefault();
                handleNumberClick(parseInt(key));
            }
            // Handle Backspace
            else if (key === 'Backspace') {
                event.preventDefault();
                handleBackspaceClick();
            }
            // Handle Enter for submission
            else if (key === 'Enter') {
                event.preventDefault();
                handleSubmitClick();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleNumberClick, handleBackspaceClick, handleSubmitClick]);

    // --- Rendering ---

    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

    return (
        <div className="flex flex-col items-center w-full max-w-xs mx-auto py-4">
            <p className="mb-4 text-sm font-mono text-theme-text-muted uppercase tracking-wider">Recall the counts in order</p>

            {/* Input Display Area */}
            <div className={wrapSlots
                ? "flex flex-wrap justify-center gap-2 mb-6 items-end"
                : "flex justify-center space-x-2 mb-6 h-12 items-end"}>
                {Array.from({ length: setSize }).map((_, index) => (
                    <span
                        key={index}
                        className={`w-10 h-10 flex items-center justify-center text-xl font-mono border transition-all duration-150 ${
                            // Highlight the current input position (cursor)
                            index === currentInputIndex && currentInputIndex < setSize
                                ? 'border-theme-accent bg-theme-accent/10 text-theme-accent'
                                : 'border-theme-line bg-theme-bg-secondary'
                        } ${
                            // Style filled slots differently from empty slots
                            recalledSequence[index] !== null && recalledSequence[index] !== undefined
                                ? 'text-theme-text'
                                : 'text-theme-text-muted'
                        }`}
                    >
                        {recalledSequence[index] !== null && recalledSequence[index] !== undefined
                            ? recalledSequence[index]
                            : '_'}
                    </span>
                ))}
            </div>

            {/* Number Pad */}
            <div className="grid grid-cols-3 gap-2 mb-4 w-full">
                {numbers.map((num) => (
                    <button
                        key={num}
                        onClick={() => handleNumberClick(num)}
                        disabled={currentInputIndex >= setSize}
                        className={`py-3 px-4 text-lg font-mono border transition-colors duration-150 ${
                            currentInputIndex >= setSize
                                ? 'bg-theme-bg-secondary text-theme-text-muted/40 cursor-not-allowed border-theme-line/50'
                                : 'bg-theme-bg-elevated text-theme-text border-theme-line hover:border-theme-accent hover:text-theme-accent'
                        }`}
                    >
                        {num}
                    </button>
                ))}
            </div>

            {/* Control Buttons (Backspace and Submit) */}
            <div className="grid grid-cols-2 gap-2 w-full">
                {/* Backspace Button */}
                <button
                    onClick={handleBackspaceClick}
                    disabled={currentInputIndex === 0}
                    className={`py-3 px-4 text-sm font-mono uppercase tracking-wider border transition-colors duration-150 flex items-center justify-center gap-2 ${
                        currentInputIndex === 0
                            ? 'bg-theme-bg-secondary text-theme-text-muted/40 cursor-not-allowed border-theme-line/50'
                            : 'bg-theme-bg-elevated text-theme-accent border-theme-accent/50 hover:bg-theme-accent/10 hover:border-theme-accent'
                    }`}
                >
                    <FontAwesomeIcon icon={faDeleteLeft} className="h-4 w-4" />
                    <span>Back</span>
                </button>

                {/* Submit Button */}
                <button
                    onClick={handleSubmitClick}
                    className="py-3 px-4 text-sm font-mono uppercase tracking-wider border transition-colors duration-150 flex items-center justify-center gap-2 bg-status-success text-white border-status-success hover:bg-status-success/90"
                >
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                    <span>Submit</span>
                </button>
            </div>
        </div>
    );
};

RecallInterface.propTypes = {
    setSize: PropTypes.number.isRequired,
    onSubmit: PropTypes.func.isRequired,
    value: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])])).isRequired,
    onChange: PropTypes.func.isRequired,
    wrapSlots: PropTypes.bool,
};

export default RecallInterface;

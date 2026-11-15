/* src/components/testing/operationSpan/LetterRecallGrid.js */
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDeleteLeft, faCheck, faSquare } from '@fortawesome/free-solid-svg-icons';
import { OSPAN_DEFAULTS } from '../../../constants/ospanConstants';

/**
 * 4x3 grid of 12 clickable consonant letters for OSPAN recall.
 * Supports BLANK (forgotten position) and CLEAR (restart recall).
 * Controlled component: receives sequence via `value`, reports changes via `onChange`.
 */
const LetterRecallGrid = ({ setSize, onSubmit, value, onChange }) => {
    const [currentInputIndex, setCurrentInputIndex] = useState(0);
    const recalledSequence = value || Array(setSize).fill(null);
    const letterPool = OSPAN_DEFAULTS.LETTER_POOL;

    useEffect(() => {
        const firstNull = recalledSequence.findIndex(val => val === null || val === undefined);
        setCurrentInputIndex(firstNull === -1 ? setSize : firstNull);
    }, [recalledSequence, setSize]);

    const handleLetterClick = useCallback((letter) => {
        if (currentInputIndex >= setSize) return;
        const newSequence = [...recalledSequence];
        newSequence[currentInputIndex] = letter;
        if (onChange) onChange(newSequence);
    }, [currentInputIndex, setSize, recalledSequence, onChange]);

    const handleBlankClick = useCallback(() => {
        if (currentInputIndex >= setSize) return;
        const newSequence = [...recalledSequence];
        newSequence[currentInputIndex] = '_BLANK_';
        if (onChange) onChange(newSequence);
    }, [currentInputIndex, setSize, recalledSequence, onChange]);

    const handleBackspaceClick = useCallback(() => {
        const indexToClear = (currentInputIndex === setSize) ? setSize - 1 : currentInputIndex - 1;
        if (indexToClear >= 0) {
            const newSequence = [...recalledSequence];
            newSequence[indexToClear] = null;
            if (onChange) onChange(newSequence);
        }
    }, [currentInputIndex, setSize, recalledSequence, onChange]);

    const handleClearClick = useCallback(() => {
        if (onChange) onChange(Array(setSize).fill(null));
    }, [onChange, setSize]);

    const handleSubmitClick = useCallback(() => {
        onSubmit(recalledSequence);
    }, [onSubmit, recalledSequence]);

    // Keyboard support
    useEffect(() => {
        const handleKeyDown = (event) => {
            const key = event.key.toUpperCase();
            if (letterPool.includes(key)) {
                event.preventDefault();
                handleLetterClick(key);
            } else if (key === 'BACKSPACE' || event.key === 'Backspace') {
                event.preventDefault();
                handleBackspaceClick();
            } else if (key === 'ENTER' || event.key === 'Enter') {
                event.preventDefault();
                handleSubmitClick();
            } else if (key === ' ' || event.key === ' ') {
                event.preventDefault();
                handleBlankClick();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleLetterClick, handleBackspaceClick, handleSubmitClick, handleBlankClick, letterPool]);

    const displayValue = (val) => {
        if (val === null || val === undefined) return '_';
        if (val === '_BLANK_') return '\u2013'; // en-dash for blank
        return val;
    };

    const isFilled = currentInputIndex >= setSize;

    return (
        <div className="flex flex-col items-center w-full max-w-sm mx-auto py-4">
            <p className="mb-4 text-sm font-mono text-theme-text-muted uppercase tracking-wider">
                Recall the letters in order
            </p>

            {/* Recalled sequence display */}
            <div className="flex justify-center flex-wrap gap-2 mb-6 min-h-[48px] items-end">
                {Array.from({ length: setSize }).map((_, index) => (
                    <span
                        key={index}
                        className={`w-10 h-10 flex items-center justify-center text-xl font-mono border transition-all duration-150 ${
                            index === currentInputIndex && currentInputIndex < setSize
                                ? 'border-theme-accent bg-theme-accent/10 text-theme-accent'
                                : 'border-theme-line bg-theme-bg-secondary'
                        } ${
                            recalledSequence[index] !== null && recalledSequence[index] !== undefined
                                ? 'text-theme-text'
                                : 'text-theme-text-muted'
                        }`}
                    >
                        {displayValue(recalledSequence[index])}
                    </span>
                ))}
            </div>

            {/* 4x3 Letter Grid */}
            <div className="grid grid-cols-4 gap-2 mb-3 w-full">
                {letterPool.map((letter) => (
                    <button
                        key={letter}
                        onClick={() => handleLetterClick(letter)}
                        disabled={isFilled}
                        className={`py-3 px-2 text-lg font-mono border transition-colors duration-150 ${
                            isFilled
                                ? 'bg-theme-bg-secondary text-theme-text-muted/40 cursor-not-allowed border-theme-line/50'
                                : 'bg-theme-bg-elevated text-theme-text border-theme-line hover:border-theme-accent hover:text-theme-accent'
                        }`}
                    >
                        {letter}
                    </button>
                ))}
            </div>

            {/* BLANK button */}
            <div className="w-full mb-3">
                <button
                    onClick={handleBlankClick}
                    disabled={isFilled}
                    className={`w-full py-2.5 px-4 text-sm font-mono uppercase tracking-wider border transition-colors duration-150 flex items-center justify-center gap-2 ${
                        isFilled
                            ? 'bg-theme-bg-secondary text-theme-text-muted/40 cursor-not-allowed border-theme-line/50'
                            : 'bg-theme-bg-elevated text-theme-text-muted border-theme-line hover:border-theme-accent hover:text-theme-accent'
                    }`}
                >
                    <FontAwesomeIcon icon={faSquare} className="h-3 w-3" />
                    <span>Blank</span>
                </button>
            </div>

            {/* Control Buttons */}
            <div className="grid grid-cols-3 gap-2 w-full">
                {/* Backspace */}
                <button
                    onClick={handleBackspaceClick}
                    disabled={currentInputIndex === 0}
                    className={`py-3 px-2 text-sm font-mono uppercase tracking-wider border transition-colors duration-150 flex items-center justify-center gap-1 ${
                        currentInputIndex === 0
                            ? 'bg-theme-bg-secondary text-theme-text-muted/40 cursor-not-allowed border-theme-line/50'
                            : 'bg-theme-bg-elevated text-theme-accent border-theme-accent/50 hover:bg-theme-accent/10 hover:border-theme-accent'
                    }`}
                >
                    <FontAwesomeIcon icon={faDeleteLeft} className="h-4 w-4" />
                    <span className="hidden sm:inline">Back</span>
                </button>

                {/* Clear */}
                <button
                    onClick={handleClearClick}
                    disabled={currentInputIndex === 0}
                    className={`py-3 px-2 text-sm font-mono uppercase tracking-wider border transition-colors duration-150 flex items-center justify-center ${
                        currentInputIndex === 0
                            ? 'bg-theme-bg-secondary text-theme-text-muted/40 cursor-not-allowed border-theme-line/50'
                            : 'bg-theme-bg-elevated text-status-error/70 border-status-error/30 hover:bg-status-error/10 hover:border-status-error'
                    }`}
                >
                    Clear
                </button>

                {/* Submit */}
                <button
                    onClick={handleSubmitClick}
                    className="py-3 px-2 text-sm font-mono uppercase tracking-wider border transition-colors duration-150 flex items-center justify-center gap-1 bg-status-success text-white border-status-success hover:bg-status-success/90"
                >
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                    <span className="hidden sm:inline">Submit</span>
                </button>
            </div>
        </div>
    );
};

LetterRecallGrid.propTypes = {
    setSize: PropTypes.number.isRequired,
    onSubmit: PropTypes.func.isRequired,
    value: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired,
};

export default LetterRecallGrid;

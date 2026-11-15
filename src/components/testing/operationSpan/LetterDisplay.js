/* src/components/testing/operationSpan/LetterDisplay.js */
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Displays a single letter for memorization.
 * Auto-advances after 800ms (handled by timer hook).
 */
const LetterDisplay = ({ letter }) => {
    if (!letter) return null;

    return (
        <div className="h-80 flex items-center justify-center">
            <span className="text-7xl sm:text-8xl font-mono font-bold text-theme-accent select-none">
                {letter}
            </span>
        </div>
    );
};

LetterDisplay.propTypes = {
    letter: PropTypes.string,
};

export default LetterDisplay;

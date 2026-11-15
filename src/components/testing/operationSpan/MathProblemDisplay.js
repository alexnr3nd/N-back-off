/* src/components/testing/operationSpan/MathProblemDisplay.js */
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Displays a math equation and waits for the user to press when they've solved it.
 * Entire area is tappable/clickable for both desktop and mobile.
 */
const MathProblemDisplay = ({ problem, onSolved }) => {
    if (!problem) return null;

    return (
        <div className="flex flex-col items-center w-full">
            {/* Math equation display */}
            <div className="mb-6">
                <p className="text-4xl sm:text-5xl font-mono text-theme-text text-center tracking-wide">
                    {problem.displayText} = ?
                </p>
            </div>

            {/* Tappable solve button */}
            <button
                onClick={onSolved}
                className="w-full max-w-xs py-4 px-8 text-lg font-mono uppercase tracking-wider
                    bg-theme-bg-elevated border-2 border-theme-accent text-theme-accent
                    hover:bg-theme-accent hover:text-black
                    active:scale-95 transition-all duration-150
                    cursor-pointer select-none"
            >
                I solved it
            </button>

            <p className="mt-4 text-xs font-mono text-theme-text-muted uppercase tracking-wider">
                Solve the equation in your head, then press
            </p>
        </div>
    );
};

MathProblemDisplay.propTypes = {
    problem: PropTypes.shape({
        displayText: PropTypes.string.isRequired,
    }),
    onSolved: PropTypes.func.isRequired,
};

export default MathProblemDisplay;

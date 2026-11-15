/* src/components/testing/operationSpan/MathVerificationDisplay.js */
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Displays a proposed answer with TRUE/FALSE buttons for verification.
 * This phase is untimed.
 */
const MathVerificationDisplay = ({ problem, onVerify }) => {
    if (!problem) return null;

    return (
        <div className="flex flex-col items-center w-full">
            {/* Equation with proposed answer */}
            <div className="mb-6">
                <p className="text-3xl sm:text-4xl font-mono text-theme-text text-center tracking-wide">
                    {problem.displayText} = {problem.proposedAnswer}
                </p>
            </div>

            {/* TRUE / FALSE buttons */}
            <div className="flex gap-4">
                <button
                    onClick={() => onVerify(true)}
                    className="px-8 py-3 text-lg font-mono uppercase tracking-wider
                        bg-theme-bg-elevated border border-theme-line text-theme-text
                        hover:border-status-success hover:text-status-success
                        transition-colors duration-150"
                >
                    True
                </button>
                <button
                    onClick={() => onVerify(false)}
                    className="px-8 py-3 text-lg font-mono uppercase tracking-wider
                        bg-theme-bg-elevated border border-theme-line text-theme-text
                        hover:border-status-error hover:text-status-error
                        transition-colors duration-150"
                >
                    False
                </button>
            </div>

            <p className="mt-4 text-xs font-mono text-theme-text-muted uppercase tracking-wider">
                Is this the correct answer?
            </p>
        </div>
    );
};

MathVerificationDisplay.propTypes = {
    problem: PropTypes.shape({
        displayText: PropTypes.string.isRequired,
        proposedAnswer: PropTypes.number.isRequired,
    }),
    onVerify: PropTypes.func.isRequired,
};

export default MathVerificationDisplay;

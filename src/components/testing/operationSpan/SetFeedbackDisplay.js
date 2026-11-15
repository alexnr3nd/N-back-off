/* src/components/testing/operationSpan/SetFeedbackDisplay.js */
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Shows per-set feedback after recall:
 * - Recall accuracy for this set
 * - Cumulative math accuracy
 * Auto-advances after 2000ms (handled by timer hook).
 */
const SetFeedbackDisplay = ({ recallCorrect, recallTotal, mathCorrect, mathTotal }) => {
    const mathAccuracy = mathTotal > 0 ? (mathCorrect / mathTotal) * 100 : 100;
    const isLowAccuracy = mathAccuracy < 85;

    return (
        <div className="flex flex-col items-center justify-center h-80 gap-6">
            {/* Recall accuracy */}
            <div className="text-center">
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-1">
                    Letters recalled correctly
                </p>
                <p className="text-3xl font-mono text-theme-text">
                    {recallCorrect} / {recallTotal}
                </p>
            </div>

            {/* Math accuracy */}
            <div className="text-center">
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-1">
                    Math accuracy
                </p>
                <p className={`text-3xl font-mono ${isLowAccuracy ? 'text-status-error' : 'text-theme-text'}`}>
                    {mathAccuracy.toFixed(0)}%
                </p>
                {isLowAccuracy && (
                    <p className="text-xs font-mono text-status-error mt-1">
                        Try to keep math accuracy above 85%
                    </p>
                )}
            </div>
        </div>
    );
};

SetFeedbackDisplay.propTypes = {
    recallCorrect: PropTypes.number.isRequired,
    recallTotal: PropTypes.number.isRequired,
    mathCorrect: PropTypes.number.isRequired,
    mathTotal: PropTypes.number.isRequired,
};

export default SetFeedbackDisplay;

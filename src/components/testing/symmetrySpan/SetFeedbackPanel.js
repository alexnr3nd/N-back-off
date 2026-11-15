/* src/components/testing/symmetrySpan/SetFeedbackPanel.js */
import React from 'react';
import PropTypes from 'prop-types';
import { SYMSPAN_DEFAULTS } from '../../../constants/symmetrySpanConstants';

/**
 * Per-set feedback (canonical: squares recalled, symmetry errors this set,
 * cumulative symmetry accuracy). Auto-advances after SET_FEEDBACK_MS via the
 * timer hook. Mirrors the OSPAN SetFeedbackDisplay layout.
 */
const SetFeedbackPanel = ({ recallCorrect, recallTotal, setSymmetryErrors, cumulativeCorrect, cumulativeTotal }) => {
    const accuracy = cumulativeTotal > 0 ? (cumulativeCorrect / cumulativeTotal) * 100 : 100;
    const isLowAccuracy = accuracy < SYMSPAN_DEFAULTS.PROCESSING_ACCURACY_THRESHOLD;

    return (
        <div className="flex flex-col items-center justify-center h-80 gap-6">
            <div className="text-center">
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-1">
                    Squares recalled correctly
                </p>
                <p className="text-3xl font-mono text-theme-text">
                    {recallCorrect} / {recallTotal}
                </p>
                <p className="text-xs font-mono text-theme-text-muted mt-2">
                    {setSymmetryErrors === 0
                        ? 'No symmetry errors this set'
                        : `${setSymmetryErrors} symmetry error${setSymmetryErrors === 1 ? '' : 's'} this set`}
                </p>
            </div>

            <div className="text-center">
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-1">
                    Symmetry accuracy
                </p>
                <p className={`text-3xl font-mono ${isLowAccuracy ? 'text-status-error' : 'text-theme-text'}`}>
                    {accuracy.toFixed(0)}%
                </p>
                {isLowAccuracy && (
                    <p className="text-xs font-mono text-status-error mt-1">
                        Try to keep symmetry accuracy above {SYMSPAN_DEFAULTS.PROCESSING_ACCURACY_THRESHOLD}%
                    </p>
                )}
            </div>
        </div>
    );
};

SetFeedbackPanel.propTypes = {
    recallCorrect: PropTypes.number.isRequired,
    recallTotal: PropTypes.number.isRequired,
    setSymmetryErrors: PropTypes.number.isRequired,
    cumulativeCorrect: PropTypes.number.isRequired,
    cumulativeTotal: PropTypes.number.isRequired,
};

export default SetFeedbackPanel;

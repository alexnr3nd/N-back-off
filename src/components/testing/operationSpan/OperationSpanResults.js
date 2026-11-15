/* src/components/testing/operationSpan/OperationSpanResults.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationTriangle, faFlask } from '@fortawesome/free-solid-svg-icons';

/**
 * Displays final OSPAN results with dual scoring (PCU + edit-distance).
 */
const OperationSpanResults = ({ results, onDone }) => {
    const {
        scorePCU = 0,
        scoreEditDistance = 0,
        maxScorePCU = 75,
        processingAccuracy = 0,
        flaggedLowAccuracy = false,
        isFamiliarization = false,
        error = null,
    } = results || {};

    const pcuPercent = maxScorePCU > 0 ? (scorePCU / maxScorePCU) * 100 : 0;
    const editPercent = maxScorePCU > 0 ? (scoreEditDistance / maxScorePCU) * 100 : 0;

    if (error) {
        return (
            <div className="text-center p-6">
                <div className="h-12 w-12 mx-auto mb-4 bg-status-error/20 border border-status-error flex items-center justify-center">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="h-5 w-5 text-status-error" />
                </div>
                <p className="font-serif italic text-theme-text mb-2">Assessment Error</p>
                <p className="text-sm text-theme-text-secondary mb-6">{error}</p>
                <button onClick={onDone} className="px-6 py-2 bg-theme-bg-elevated border border-theme-line text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent transition-colors text-sm font-mono uppercase tracking-wider">
                    Return to Summary
                </button>
            </div>
        );
    }

    return (
        <div className="text-center p-6 w-full max-w-md mx-auto">
            {/* Header */}
            <div className="mb-6">
                <div className={`h-12 w-12 mx-auto mb-3 border flex items-center justify-center ${isFamiliarization ? 'bg-theme-accent/20 border-theme-accent' : 'bg-status-success/20 border-status-success'}`}>
                    <FontAwesomeIcon icon={isFamiliarization ? faFlask : faCheckCircle} className={`h-5 w-5 ${isFamiliarization ? 'text-theme-accent' : 'text-status-success'}`} />
                </div>
                <p className="font-serif italic text-lg text-theme-text">
                    {isFamiliarization ? 'Familiarization Complete' : 'Assessment Complete'}
                </p>
                {isFamiliarization && (
                    <p className="text-sm text-theme-text-muted mt-1">This was a practice session. Your score is recorded but not used for tracking.</p>
                )}
            </div>

            {/* Score Cards */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                {/* PCU Score */}
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-2">PCU Score</p>
                    <p className="text-2xl font-mono text-theme-text">{scorePCU} <span className="text-sm text-theme-text-muted">/ {maxScorePCU}</span></p>
                    <div className="w-full bg-theme-bg-secondary h-2 mt-2">
                        <div className="bg-theme-accent h-2 transition-all duration-500" style={{ width: `${Math.min(pcuPercent, 100)}%` }} />
                    </div>
                </div>

                {/* Edit Distance Score */}
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-2">Edit Score</p>
                    <p className="text-2xl font-mono text-theme-text">{scoreEditDistance} <span className="text-sm text-theme-text-muted">/ {maxScorePCU}</span></p>
                    <div className="w-full bg-theme-bg-secondary h-2 mt-2">
                        <div className="bg-theme-accent h-2 transition-all duration-500" style={{ width: `${Math.min(editPercent, 100)}%` }} />
                    </div>
                </div>
            </div>

            {/* Math Accuracy */}
            <div className={`bg-theme-bg-elevated border p-4 mb-6 ${flaggedLowAccuracy ? 'border-status-error' : 'border-theme-line'}`}>
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-1">Math Accuracy</p>
                <p className={`text-2xl font-mono ${flaggedLowAccuracy ? 'text-status-error' : 'text-theme-text'}`}>
                    {processingAccuracy.toFixed(1)}%
                </p>
                {flaggedLowAccuracy && (
                    <p className="text-xs text-status-error mt-2">
                        Below 85% threshold. This may indicate the math problems were not being prioritized.
                    </p>
                )}
            </div>

            {/* Done Button */}
            <button
                onClick={onDone}
                className="btn-primary-lab w-full py-3 px-6 text-sm font-mono uppercase tracking-wider"
            >
                Finish
            </button>
        </div>
    );
};

OperationSpanResults.propTypes = {
    results: PropTypes.shape({
        scorePCU: PropTypes.number,
        scoreEditDistance: PropTypes.number,
        maxScorePCU: PropTypes.number,
        processingAccuracy: PropTypes.number,
        flaggedLowAccuracy: PropTypes.bool,
        isFamiliarization: PropTypes.bool,
        error: PropTypes.string,
    }),
    onDone: PropTypes.func.isRequired,
};

export default OperationSpanResults;

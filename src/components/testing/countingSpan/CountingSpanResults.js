/* src/components/testing/countingSpan/CountingSpanResults.js */
/* Redesigned with Cognitive Lab aesthetic */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationTriangle, faRedo, faCalculator } from '@fortawesome/free-solid-svg-icons';

/**
 * Displays the results of the completed Counting Span task.
 * Redesigned with Cognitive Lab aesthetic.
 */
const CountingSpanResults = ({ results, onDone, onRestart }) => {

    const {
        scorePCU = 0,
        maxScorePCU = 75,
        processingAccuracy = 0,
        accuracyThreshold = 85,
        flaggedLowAccuracy = false,
        isFamiliarization = false,
        error = null
    } = results || {};

    // Calculate score percentage for visual indicator
    const scorePercentage = maxScorePCU > 0 ? (scorePCU / maxScorePCU) * 100 : 0;

    return (
        <div className="text-center max-w-md mx-auto">
            {/* Header Icon */}
            <div className="mb-6">
                <div className={`h-16 w-16 mx-auto bg-theme-bg-elevated border flex items-center justify-center ${isFamiliarization ? 'border-theme-accent' : 'border-status-success'}`}>
                    <FontAwesomeIcon
                        icon={faCalculator}
                        className={`h-6 w-6 ${isFamiliarization ? 'text-theme-accent' : 'text-status-success'}`}
                    />
                </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-serif italic text-theme-text mb-2">
                {isFamiliarization ? 'Familiarization Complete' : 'Assessment Complete'}
            </h2>
            <p className="text-sm text-theme-text-muted mb-6 font-mono uppercase tracking-wider">
                Counting Span Task
            </p>

            {/* Display Error Message if present */}
            {error && (
                <div className="mb-6 p-4 bg-status-error/10 border border-status-error">
                    <div className="flex items-start gap-3">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-status-error mt-0.5" />
                        <div className="text-left">
                            <p className="text-sm font-medium text-status-error mb-1">Error Saving Results</p>
                            <p className="text-xs text-theme-text-muted">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Score Display */}
            <div className="mb-4 p-5 bg-theme-bg-elevated border border-theme-line">
                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-[0.2em] mb-2">
                    Recall Score (PCU)
                </p>
                <div className="flex items-baseline justify-center gap-1 mb-3">
                    <span className="text-4xl font-mono font-bold text-theme-accent">{scorePCU}</span>
                    <span className="text-lg font-mono text-theme-text-muted">/ {maxScorePCU}</span>
                </div>
                {/* Score Progress Bar */}
                <div className="h-1 bg-theme-bg-secondary rounded-full overflow-hidden">
                    <div
                        className="h-full bg-theme-accent transition-all duration-500"
                        style={{ width: `${scorePercentage}%` }}
                    />
                </div>
                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted mt-2 font-mono">
                    Items recalled in correct order
                </p>
            </div>

            {/* Accuracy Display */}
            <div className={`mb-6 p-5 border ${flaggedLowAccuracy ? 'bg-status-warning/10 border-status-warning' : 'bg-status-success/10 border-status-success'}`}>
                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-[0.2em] mb-2">
                    Processing Accuracy
                </p>
                <div className="flex items-center justify-center gap-2 mb-2">
                    <FontAwesomeIcon
                        icon={flaggedLowAccuracy ? faExclamationTriangle : faCheckCircle}
                        className={`text-xl ${flaggedLowAccuracy ? 'text-status-warning' : 'text-status-success'}`}
                    />
                    <span className={`text-3xl font-mono font-bold ${flaggedLowAccuracy ? 'text-status-warning' : 'text-status-success'}`}>
                        {processingAccuracy.toFixed(1)}%
                    </span>
                </div>
                {flaggedLowAccuracy ? (
                    <p className="text-sm sm:text-xs text-status-warning">
                        Below {accuracyThreshold}% threshold - may indicate prioritizing recall over counting/judging
                    </p>
                ) : (
                    <p className="text-sm sm:text-xs text-status-success">
                        Good focus on the counting/judging task
                    </p>
                )}
                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted mt-2 font-mono">
                    Odd/Even judgments correct
                </p>
            </div>

            {/* Familiarization Info */}
            {isFamiliarization && (
                <div className="mb-6 p-4 bg-theme-bg-secondary border border-theme-line">
                    <p className="text-sm text-theme-text-secondary font-serif italic">
                        This was a familiarization session. Scores may improve as you get used to the task format.
                    </p>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-3">
                <button
                    onClick={onDone}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center px-6 py-3
                        bg-theme-accent text-black
                        font-mono text-sm uppercase tracking-wider
                        hover:bg-theme-accent/90 transition-colors"
                >
                    <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
                    Finish
                </button>
                {/* Optional Restart Button */}
                {onRestart && (
                    <button
                        onClick={onRestart}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center px-6 py-3
                            bg-theme-bg-elevated border border-theme-line text-theme-text-secondary
                            font-mono text-sm uppercase tracking-wider
                            hover:border-theme-accent hover:text-theme-accent transition-colors"
                    >
                        <FontAwesomeIcon icon={faRedo} className="mr-2" />
                        Run Again
                    </button>
                )}
            </div>
        </div>
    );
};

CountingSpanResults.propTypes = {
    results: PropTypes.shape({
        scorePCU: PropTypes.number,
        maxScorePCU: PropTypes.number,
        processingAccuracy: PropTypes.number,
        accuracyThreshold: PropTypes.number,
        flaggedLowAccuracy: PropTypes.bool,
        isFamiliarization: PropTypes.bool,
        error: PropTypes.string,
    }).isRequired,
    onDone: PropTypes.func.isRequired,
    onRestart: PropTypes.func,
};

export default CountingSpanResults;

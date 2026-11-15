/* src/components/testing/symmetrySpan/SymmetrySpanResults.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationTriangle, faFlask, faRankingStar } from '@fortawesome/free-solid-svg-icons';
import { SYMSPAN_DEFAULTS } from '../../../constants/symmetrySpanConstants';

/**
 * Final Symmetry Span results: partial-credit score (primary, /42 for full
 * runs), absolute + edit-distance + symmetry accuracy (secondary), and the
 * research percentile (Redick et al. 2012 norms) for complete runs.
 * Mirrors the DigitSpanResults layout.
 */
const SymmetrySpanResults = ({ results, onDone }) => {
    const {
        scorePCU = null,
        scoreAbsolute = null,
        scoreEditDistance = null,
        maxPCU = null,
        processingAccuracy = null,
        speedErrors = null,
        accuracyErrors = null,
        flaggedLowAccuracy = false,
        percentileDisplay = null,
        percentileValid = false,
        isFamiliarization = false,
        error = null,
        feedback = '',
    } = results || {};

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

    const isPartialRun = scorePCU != null && maxPCU != null && maxPCU < SYMSPAN_DEFAULTS.MAX_PARTIAL_SCORE;

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
                    <p className="text-sm text-theme-text-muted mt-1">
                        {feedback || 'This was a practice run. The scored assessment is now available.'}
                    </p>
                )}
            </div>

            {!isFamiliarization && scorePCU != null && (
                <>
                    {/* Primary: partial-credit score */}
                    <div className="bg-theme-bg-elevated border border-theme-line p-5 mb-4">
                        <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-1">Symmetry Span Score</p>
                        <p className="text-4xl font-mono text-theme-text">
                            {scorePCU}<span className="text-xl text-theme-text-muted"> / {maxPCU ?? SYMSPAN_DEFAULTS.MAX_PARTIAL_SCORE}</span>
                        </p>
                        <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">Squares recalled in position</p>
                    </div>

                    {/* Research percentile (complete runs only) */}
                    {percentileValid && percentileDisplay && (
                        <div className="bg-theme-accent/5 border border-theme-accent/30 p-4 mb-4">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <FontAwesomeIcon icon={faRankingStar} className="h-3 w-3 text-theme-accent" />
                                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider">Research Percentile</p>
                            </div>
                            <p className="text-2xl font-mono text-theme-accent">≈ {percentileDisplay} percentile</p>
                            <p className="text-xs text-theme-text-muted mt-2">
                                Compared with published norms from university and community samples
                                (Redick et al., 2012, N = 6,018). Percentiles are approximate.
                            </p>
                        </div>
                    )}

                    {/* Secondary metrics */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-theme-bg-elevated border border-theme-line p-3">
                            <p className="text-lg font-mono text-theme-text">{scoreAbsolute ?? '—'}</p>
                            <p className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider mt-0.5">Absolute</p>
                        </div>
                        <div className="bg-theme-bg-elevated border border-theme-line p-3">
                            <p className="text-lg font-mono text-theme-text">{scoreEditDistance ?? '—'}</p>
                            <p className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider mt-0.5">Edit Dist.</p>
                        </div>
                        <div className="bg-theme-bg-elevated border border-theme-line p-3">
                            <p className={`text-lg font-mono ${flaggedLowAccuracy ? 'text-status-error' : 'text-theme-text'}`}>
                                {processingAccuracy != null ? `${processingAccuracy.toFixed(0)}%` : '—'}
                            </p>
                            <p className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider mt-0.5">Symmetry</p>
                        </div>
                    </div>

                    {/* Error breakdown */}
                    {(speedErrors != null || accuracyErrors != null) && (
                        <p className="text-xs font-mono text-theme-text-muted mb-4">
                            Symmetry errors: {accuracyErrors ?? 0} wrong, {speedErrors ?? 0} timed out
                        </p>
                    )}

                    {/* Low accuracy warning */}
                    {flaggedLowAccuracy && (
                        <div className="bg-status-error/10 border border-status-error/40 p-3 mb-4 text-left">
                            <p className="text-xs text-status-error">
                                <FontAwesomeIcon icon={faExclamationTriangle} className="h-3 w-3 mr-1.5" />
                                Symmetry accuracy fell below {SYMSPAN_DEFAULTS.PROCESSING_ACCURACY_THRESHOLD}%, so the
                                memory score may not reflect true capacity. Keeping judgments accurate matters as much
                                as remembering the squares.
                            </p>
                        </div>
                    )}

                    {/* Partial run note */}
                    {isPartialRun && (
                        <p className="text-xs text-theme-text-muted mb-4">
                            The assessment ended early, so this score covers {maxPCU} of {SYMSPAN_DEFAULTS.MAX_PARTIAL_SCORE} possible
                            squares and no research percentile is shown.
                        </p>
                    )}
                </>
            )}

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

SymmetrySpanResults.propTypes = {
    results: PropTypes.shape({
        scorePCU: PropTypes.number,
        scoreAbsolute: PropTypes.number,
        scoreEditDistance: PropTypes.number,
        maxPCU: PropTypes.number,
        processingAccuracy: PropTypes.number,
        speedErrors: PropTypes.number,
        accuracyErrors: PropTypes.number,
        flaggedLowAccuracy: PropTypes.bool,
        percentileDisplay: PropTypes.string,
        percentileValid: PropTypes.bool,
        isFamiliarization: PropTypes.bool,
        error: PropTypes.string,
        feedback: PropTypes.string,
    }),
    onDone: PropTypes.func.isRequired,
};

export default SymmetrySpanResults;

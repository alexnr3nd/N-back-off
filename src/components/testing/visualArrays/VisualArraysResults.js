/* src/components/testing/visualArrays/VisualArraysResults.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationTriangle, faFlask } from '@fortawesome/free-solid-svg-icons';

const fmtK = (k) => (typeof k === 'number' ? k.toFixed(2) : '—');

/**
 * Final Visual Arrays results: capacity k (Cowan's single-probe formula)
 * with the per-set-size breakdown and overall accuracy. Null ks (partial
 * sessions below the per-set-size trial floor) render as em dashes.
 * Mirrors the DigitSpanResults layout.
 */
const VisualArraysResults = ({ results, onDone }) => {
    const {
        scoreK = null,
        kBySetSize = null,
        overallAccuracy = null,
        flaggedLowAccuracy = false,
        isFamiliarization = false,
        completedTrialCount = 0,
        totalTrials = 120,
        error = null,
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

    const isPartial = completedTrialCount > 0 && completedTrialCount < totalTrials;

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
                    <p className="text-sm text-theme-text-muted mt-1">Practice run — recorded, but not counted in your history chart.</p>
                )}
            </div>

            {/* Headline k */}
            <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-4">
                <p className="text-4xl font-mono text-theme-text">{fmtK(scoreK)}</p>
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">Capacity k</p>
            </div>

            {/* Per-set-size + accuracy */}
            <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-theme-bg-elevated border border-theme-line p-3">
                    <p className="text-xl font-mono text-theme-text">{fmtK(kBySetSize?.[3])}</p>
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">k · Set 3</p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-3">
                    <p className="text-xl font-mono text-theme-text">{fmtK(kBySetSize?.[5])}</p>
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">k · Set 5</p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-3">
                    <p className="text-xl font-mono text-theme-text">
                        {typeof overallAccuracy === 'number' ? `${overallAccuracy.toFixed(1)}%` : '—'}
                    </p>
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">Accuracy</p>
                </div>
            </div>

            {flaggedLowAccuracy && (
                <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-3 mb-4 text-left">
                    <p className="text-xs text-theme-text-secondary">
                        Accuracy was near chance — this run may not reflect your real capacity.
                        Distractions or misreading the cue are the usual causes.
                    </p>
                </div>
            )}

            {isPartial && (
                <p className="text-xs text-theme-text-muted mb-4">
                    {completedTrialCount} of {totalTrials} trials were completed; scores are
                    computed from the completed trials only.
                </p>
            )}

            <p className="text-xs text-theme-text-muted mb-6">
                Typical scores on this selective version average around 2.5 — it runs lower
                than plain memory-span scores by design.
            </p>

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

VisualArraysResults.propTypes = {
    results: PropTypes.shape({
        scoreK: PropTypes.number,
        kBySetSize: PropTypes.object,
        overallAccuracy: PropTypes.number,
        flaggedLowAccuracy: PropTypes.bool,
        isFamiliarization: PropTypes.bool,
        completedTrialCount: PropTypes.number,
        totalTrials: PropTypes.number,
        error: PropTypes.string,
    }),
    onDone: PropTypes.func.isRequired,
};

export default VisualArraysResults;

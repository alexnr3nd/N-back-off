/* src/components/testing/relationMonitoring/RelationMonitoringResults.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationTriangle, faFlask } from '@fortawesome/free-solid-svg-icons';

const fmtPct = (v) => (typeof v === 'number' ? `${v.toFixed(1)}%` : '—');

/**
 * Final Relation Monitoring results: monitoring score (hit rate minus
 * false-alarm rate, Snodgrass & Corwin) with hit/FA breakdown and per-block
 * scores. Null values (partial sessions below the per-type trial floor)
 * render as em dashes. Mirrors the VisualArraysResults layout.
 */
const RelationMonitoringResults = ({ results, onDone }) => {
    const {
        score = null,
        hitRate = null,
        faRate = null,
        blockScores = null,
        flaggedLowValidity = false,
        isFamiliarization = false,
        completedTrialCount = 0,
        totalTrials = 108,
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

            {/* Headline score */}
            <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-4">
                <p className="text-4xl font-mono text-theme-text">{fmtPct(score)}</p>
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">Monitoring Score</p>
            </div>

            {/* Hit / FA / per-block */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-theme-bg-elevated border border-theme-line p-3">
                    <p className="text-xl font-mono text-theme-text">{fmtPct(hitRate)}</p>
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">Hit Rate</p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-3">
                    <p className="text-xl font-mono text-theme-text">{fmtPct(faRate)}</p>
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">False Alarms</p>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
                {[0, 1, 2].map((b) => (
                    <div key={b} className="bg-theme-bg-elevated border border-theme-line p-3">
                        <p className="text-lg font-mono text-theme-text">{fmtPct(blockScores?.[b])}</p>
                        <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">Block {b + 1}</p>
                    </div>
                ))}
            </div>

            {flaggedLowValidity && (
                <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-3 mb-4 text-left">
                    <p className="text-xs text-theme-text-secondary">
                        The false-alarm rate was high enough that this score may reflect a
                        respond-to-everything strategy rather than relation monitoring.
                        Responding only when a row or column genuinely shares an ending
                        digit gives an interpretable score.
                    </p>
                </div>
            )}

            {isPartial && (
                <p className="text-xs text-theme-text-muted mb-4">
                    {completedTrialCount} of {totalTrials} arrays were completed; scores are
                    computed from the completed arrays only.
                </p>
            )}

            <p className="text-xs text-theme-text-muted mb-6">
                Score = hit rate − false-alarm rate. Catching every match while never
                responding to a non-match scores 100; responding at random scores 0.
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

RelationMonitoringResults.propTypes = {
    results: PropTypes.shape({
        score: PropTypes.number,
        hitRate: PropTypes.number,
        faRate: PropTypes.number,
        blockScores: PropTypes.array,
        flaggedLowValidity: PropTypes.bool,
        isFamiliarization: PropTypes.bool,
        completedTrialCount: PropTypes.number,
        totalTrials: PropTypes.number,
        error: PropTypes.string,
    }),
    onDone: PropTypes.func.isRequired,
};

export default RelationMonitoringResults;

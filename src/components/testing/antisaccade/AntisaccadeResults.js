/* src/components/testing/antisaccade/AntisaccadeResults.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationTriangle, faFlask, faRankingStar } from '@fortawesome/free-solid-svg-icons';

const fmtPct = (p) => (typeof p === 'number' ? `${(p * 100).toFixed(1)}%` : '—');

/**
 * Final Antisaccade results: accuracy over valid scored trials (headline),
 * the research percentile (combined Draheim et al. 2021/2023 norms) when the
 * backend marks it valid, error-rate/trial-count secondary stats, and the
 * load-bearing honest caveat (practice inflation + young-adult norm samples).
 * Mirrors the VisualArraysResults layout.
 */
const AntisaccadeResults = ({ results, onDone }) => {
    const {
        scoreAccuracy = null,
        errorRate = null,
        percentileDisplay = null,
        percentileValid = false,
        atChance = false,
        flaggedLowAccuracy = false,
        isFamiliarization = false,
        completedTrialCount = 0,
        totalTrials = 72,
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
    // Backend already nulls the percentile for familiarization and at-chance
    // runs (percentileValid false); the extra guards are belt-and-suspenders.
    const showPercentile = !isFamiliarization && !atChance && percentileValid && Boolean(percentileDisplay);
    // "<5th"/">95th" bounds are already hedged — prefixing "≈" would double-hedge.
    const approxPrefix = percentileDisplay && /^[<>]/.test(percentileDisplay) ? '' : '≈ ';

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
                    <p className="text-sm text-theme-text-muted mt-1">Familiarization run — recorded, but not counted in your history chart.</p>
                )}
            </div>

            {/* Headline accuracy */}
            <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-4">
                <p className="text-4xl font-mono text-theme-text">{fmtPct(scoreAccuracy)}</p>
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">Accuracy</p>
            </div>

            {/* Research percentile (valid scored runs only) */}
            {showPercentile && (
                <div className="bg-theme-accent/5 border border-theme-accent/30 p-4 mb-4">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <FontAwesomeIcon icon={faRankingStar} className="h-3 w-3 text-theme-accent" />
                        <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider">Research Percentile</p>
                    </div>
                    <p className="text-2xl font-mono text-theme-accent">{approxPrefix}{percentileDisplay} percentile</p>
                    <p className="text-xs text-theme-text-muted mt-2">
                        Compared with combined young-adult laboratory samples
                        (Draheim et al., 2021 and 2023). Percentiles are approximate.
                    </p>
                </div>
            )}

            {/* Secondary stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-theme-bg-elevated border border-theme-line p-3">
                    <p className="text-xl font-mono text-theme-text">{fmtPct(errorRate)}</p>
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">Error Rate</p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-3">
                    <p className="text-xl font-mono text-theme-text">{completedTrialCount}/{totalTrials}</p>
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">Trials</p>
                </div>
            </div>

            {/* Validity advisories (accent-toned, never red — non-destructive) */}
            {atChance ? (
                <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-3 mb-4 text-left">
                    <p className="text-xs text-theme-text-secondary">
                        Accuracy was at or below 50% — chance level for a two-choice
                        task — so this run can't be interpreted as a measure of
                        attention control. Distractions or mixed-up Q/O buttons
                        are the usual causes.
                    </p>
                </div>
            ) : flaggedLowAccuracy ? (
                <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-3 mb-4 text-left">
                    <p className="text-xs text-theme-text-secondary">
                        Accuracy was close to chance — this run may not reflect real
                        attention control. Distractions or glancing toward the flash
                        instead of away from it are the usual causes.
                    </p>
                </div>
            ) : null}

            {isPartial && (
                <p className="text-xs text-theme-text-muted mb-4">
                    {completedTrialCount} of {totalTrials} trials were completed; the
                    score is computed from the completed trials only.
                </p>
            )}

            {/* Honest positioning (design-doc load-bearing copy) */}
            <div className="bg-theme-bg-elevated border-l-2 border-theme-line p-3 mb-6 text-left">
                <p className="text-xs text-theme-text-secondary">
                    Scores rise with repeated attempts as the task becomes familiar,
                    and the research norms come from young-adult laboratory samples.
                    Treat each result as a periodic snapshot of attention control,
                    not as proof that training is working.
                </p>
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

AntisaccadeResults.propTypes = {
    results: PropTypes.shape({
        scoreAccuracy: PropTypes.number,
        errorRate: PropTypes.number,
        percentileDisplay: PropTypes.string,
        percentileValid: PropTypes.bool,
        atChance: PropTypes.bool,
        flaggedLowAccuracy: PropTypes.bool,
        isFamiliarization: PropTypes.bool,
        completedTrialCount: PropTypes.number,
        totalTrials: PropTypes.number,
        error: PropTypes.string,
    }),
    onDone: PropTypes.func.isRequired,
};

export default AntisaccadeResults;

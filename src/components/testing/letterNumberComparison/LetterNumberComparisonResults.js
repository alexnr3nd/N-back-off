/* src/components/testing/letterNumberComparison/LetterNumberComparisonResults.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationTriangle, faFlask } from '@fortawesome/free-solid-svg-icons';

const fmtInt = (v) => (typeof v === 'number' ? String(v) : '—');
const fmtPct = (v) => (typeof v === 'number' ? `${v.toFixed(1)}%` : '—');

const BLOCK_LABELS = ['L1', 'L2', 'N1', 'N2'];

/**
 * Final Letter & Number Comparison results: total correct across the four 30s
 * blocks (the Redick et al. 2013 dependent variable), with letter/number
 * sub-scores, overall accuracy, and per-block counts. The abort variant (a
 * block interrupted twice) shows a message and no scores — nothing was saved.
 * Mirrors the RelationMonitoringResults layout.
 */
const LetterNumberComparisonResults = ({ results, onDone }) => {
    const {
        score = null,
        letterCorrect = null,
        numberCorrect = null,
        blockScores = null,
        overallAccuracy = null,
        flaggedLowValidity = false,
        isFamiliarization = false,
        abortMessage = null,
        error = null,
    } = results || {};

    if (abortMessage) {
        return (
            <div className="text-center p-6">
                <div className="h-12 w-12 mx-auto mb-4 bg-status-warning/10 border border-status-warning flex items-center justify-center">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="h-5 w-5 text-status-warning" />
                </div>
                <p className="font-serif italic text-theme-text mb-2">Assessment Stopped</p>
                <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">{abortMessage}</p>
                <button onClick={onDone} className="btn-primary-lab px-6 py-2 text-sm font-mono uppercase tracking-wider">
                    Return to Summary
                </button>
            </div>
        );
    }

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
                    <p className="text-sm text-theme-text-muted mt-1">Practice run — recorded, but not counted in your history chart.</p>
                )}
            </div>

            {/* Headline score */}
            <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-4">
                <p className="text-4xl font-mono text-theme-text">{fmtInt(score)}</p>
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">Correct</p>
            </div>

            {/* Letters / Numbers / Accuracy */}
            <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-theme-bg-elevated border border-theme-line p-3">
                    <p className="text-xl font-mono text-theme-text">{fmtInt(letterCorrect)}</p>
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">Letters</p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-3">
                    <p className="text-xl font-mono text-theme-text">{fmtInt(numberCorrect)}</p>
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">Numbers</p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-3">
                    <p className="text-xl font-mono text-theme-text">{fmtPct(overallAccuracy)}</p>
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">Accuracy</p>
                </div>
            </div>

            {/* Per-block counts */}
            <div className="grid grid-cols-4 gap-3 mb-4">
                {BLOCK_LABELS.map((label, b) => (
                    <div key={label} className="bg-theme-bg-elevated border border-theme-line p-3">
                        <p className="text-lg font-mono text-theme-text">{fmtInt(blockScores?.[b])}</p>
                        <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">{label}</p>
                    </div>
                ))}
            </div>

            {flaggedLowValidity && (
                <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-3 mb-4 text-left">
                    <p className="text-xs text-theme-text-secondary">
                        Accuracy was below 75%, so this score is flagged and excluded from
                        personal bests. Answering carefully matters more than speed — a wrong
                        answer counts against the total.
                    </p>
                </div>
            )}

            <p className="text-xs text-theme-text-muted mb-6">
                Score = total correct judgments across all four 30-second blocks. Letters
                and numbers each contribute two blocks.
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

LetterNumberComparisonResults.propTypes = {
    results: PropTypes.shape({
        score: PropTypes.number,
        letterCorrect: PropTypes.number,
        numberCorrect: PropTypes.number,
        blockScores: PropTypes.array,
        overallAccuracy: PropTypes.number,
        flaggedLowValidity: PropTypes.bool,
        isFamiliarization: PropTypes.bool,
        abortMessage: PropTypes.string,
        error: PropTypes.string,
    }),
    onDone: PropTypes.func.isRequired,
};

export default LetterNumberComparisonResults;

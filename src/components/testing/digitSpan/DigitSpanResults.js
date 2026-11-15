/* src/components/testing/digitSpan/DigitSpanResults.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationTriangle, faFlask, faArrowRight, faArrowLeft } from '@fortawesome/free-solid-svg-icons';

/**
 * Final Digit Span results: Mean Span and Max Length per block.
 * Null block scores (partial exit before the backward block) render as em
 * dash placeholders. Mirrors the OperationSpanResults layout.
 */
const DigitSpanResults = ({ results, onDone }) => {
    const {
        meanSpanForward = null,
        meanSpanBackward = null,
        maxLengthForward = null,
        maxLengthBackward = null,
        isFamiliarization = false,
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

    const blockCard = (label, icon, meanSpan, maxLength) => (
        <div className="bg-theme-bg-elevated border border-theme-line p-4">
            <div className="flex items-center justify-center gap-2 mb-2">
                <FontAwesomeIcon icon={icon} className="h-3 w-3 text-theme-text-muted" />
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider">{label}</p>
            </div>
            <p className="text-3xl font-mono text-theme-text">
                {meanSpan != null ? meanSpan.toFixed(2) : '—'}
            </p>
            <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">Mean Span</p>
            <div className="border-t border-theme-line mt-3 pt-3">
                <p className="text-lg font-mono text-theme-text">
                    {maxLength != null && maxLength > 0 ? maxLength : '—'}
                </p>
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider">Longest List</p>
            </div>
        </div>
    );

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
                    <p className="text-sm text-theme-text-muted mt-1">This was a practice run. Your score is recorded but not used for tracking.</p>
                )}
            </div>

            {/* Block Score Cards */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                {blockCard('Forward', faArrowRight, meanSpanForward, maxLengthForward)}
                {blockCard('Backward', faArrowLeft, meanSpanBackward, maxLengthBackward)}
            </div>

            {meanSpanBackward == null && meanSpanForward != null && (
                <p className="text-xs text-theme-text-muted mb-6">
                    The backward block was not completed, so only forward results were saved.
                </p>
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

DigitSpanResults.propTypes = {
    results: PropTypes.shape({
        meanSpanForward: PropTypes.number,
        meanSpanBackward: PropTypes.number,
        maxLengthForward: PropTypes.number,
        maxLengthBackward: PropTypes.number,
        isFamiliarization: PropTypes.bool,
        error: PropTypes.string,
    }),
    onDone: PropTypes.func.isRequired,
};

export default DigitSpanResults;

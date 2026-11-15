/* src/components/testing/digitSpan/TrialFeedbackDisplay.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';
import { DIGIT_SPAN_BLOCKS } from '../../../constants/digitSpanConstants';

/**
 * Post-trial feedback.
 * Practice: detailed target / expected / response breakdown with a Continue
 * button (user-paced). Scored: brief check/X only, auto-advanced by the timer.
 */
const TrialFeedbackDisplay = ({ feedback, isPractice, direction, onContinue }) => {
    if (!feedback) return null;
    const { wasCorrect, timedOut, targetDigits = [], responseDigits = [] } = feedback;

    const icon = (
        <div className={`h-14 w-14 mx-auto mb-3 border flex items-center justify-center ${
            wasCorrect
                ? 'bg-status-success/20 border-status-success'
                : 'bg-status-error/20 border-status-error'
        }`}>
            <FontAwesomeIcon
                icon={wasCorrect ? faCheck : faTimes}
                className={`h-6 w-6 ${wasCorrect ? 'text-status-success' : 'text-status-error'}`}
            />
        </div>
    );

    if (!isPractice) {
        return (
            <div className="h-80 flex flex-col items-center justify-center">
                {icon}
                {timedOut && (
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider">Time expired</p>
                )}
            </div>
        );
    }

    const isBackward = direction === DIGIT_SPAN_BLOCKS.BACKWARD;
    const expectedDigits = isBackward ? [...targetDigits].reverse() : targetDigits;
    const renderDigits = (digits) => (digits.length > 0 ? digits.join('  ') : '(nothing entered)');

    return (
        <div className="text-center py-8 max-w-md mx-auto">
            {icon}
            <p className="text-lg font-serif italic text-theme-text mb-1">
                {wasCorrect ? 'Correct' : 'Not quite'}
            </p>
            {timedOut && (
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-2">Time expired</p>
            )}

            <div className="bg-theme-bg-elevated border border-theme-line p-4 my-4 text-left space-y-2">
                <div>
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider">Digits shown</p>
                    <p className="font-mono text-theme-text">{renderDigits(targetDigits)}</p>
                </div>
                {isBackward && (
                    <div>
                        <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider">Correct answer (reversed)</p>
                        <p className="font-mono text-theme-text">{renderDigits(expectedDigits)}</p>
                    </div>
                )}
                <div>
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider">Your response</p>
                    <p className={`font-mono ${wasCorrect ? 'text-status-success' : 'text-status-error'}`}>
                        {renderDigits(responseDigits)}
                    </p>
                </div>
            </div>

            <button
                onClick={onContinue}
                className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
            >
                Continue
            </button>
        </div>
    );
};

TrialFeedbackDisplay.propTypes = {
    feedback: PropTypes.shape({
        wasCorrect: PropTypes.bool,
        timedOut: PropTypes.bool,
        targetDigits: PropTypes.arrayOf(PropTypes.number),
        responseDigits: PropTypes.arrayOf(PropTypes.number),
    }),
    isPractice: PropTypes.bool.isRequired,
    direction: PropTypes.string.isRequired,
    onContinue: PropTypes.func,
};

export default TrialFeedbackDisplay;

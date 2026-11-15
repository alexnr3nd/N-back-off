/* src/components/testing/digitSpan/DigitDisplay.js */
import React from 'react';
import PropTypes from 'prop-types';
import { DIGIT_SPAN_PHASES } from '../../../constants/digitSpanConstants';

/**
 * Stimulus display area for the digit stream.
 * Fixed-height container so fixation / digit / blank / cue swaps cause no
 * layout shift. aria-hidden: this is a visual span assessment, so the stream
 * must not be announced by screen readers (announcing digits would change the
 * construct to auditory span); the surrounding instructions state the
 * assessment requires visual attention.
 */
const DigitDisplay = ({ phase, digit }) => {
    let content = null;
    if (phase === DIGIT_SPAN_PHASES.FIXATION) {
        content = <span className="text-5xl font-mono text-theme-accent animate-pulse">+</span>;
    } else if (phase === DIGIT_SPAN_PHASES.DIGIT_SHOW && digit != null) {
        // Matches the OSPAN LetterDisplay stimulus treatment (accent memoranda)
        content = (
            <span className="text-7xl sm:text-8xl font-mono font-bold text-theme-accent">
                {digit}
            </span>
        );
    } else if (phase === DIGIT_SPAN_PHASES.RECALL_CUE) {
        content = (
            <span className="text-2xl font-mono text-theme-accent uppercase tracking-[0.3em] animate-pulse">
                Recall
            </span>
        );
    }
    // DIGIT_BLANK renders an empty box of the same height

    return (
        <div aria-hidden="true" className="h-80 flex items-center justify-center select-none">
            {content}
        </div>
    );
};

DigitDisplay.propTypes = {
    phase: PropTypes.string,
    digit: PropTypes.number,
};

export default DigitDisplay;

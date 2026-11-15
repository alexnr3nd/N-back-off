/* src/components/testing/letterNumberComparison/StringPairDisplay.js */
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Stacked comparison pair (mobile-legibility deviation from the paper's
 * side-by-side layout): top string, a horizontal dividing rule, bottom string.
 * Monospace and widely tracked; font size steps down with length so even a
 * 9-character pair stays on one line in 360px portrait. During the 100ms
 * inter-item blink the pair is hidden with `visibility: hidden` (NOT
 * unmounted) so the layout never shifts.
 */

// Size by set size; tuned so 9-char mono strings fit a 360px viewport.
const SIZE_BY_LENGTH = {
    3: 'text-4xl sm:text-5xl',
    6: 'text-3xl sm:text-4xl',
    9: 'text-2xl sm:text-3xl',
};

const StringPairDisplay = ({ item, blink }) => {
    const length = item?.a?.length || 3;
    const sizeClass = SIZE_BY_LENGTH[length] || SIZE_BY_LENGTH[9];

    return (
        <div
            className="w-full max-w-md mx-auto flex flex-col items-center select-none"
            style={{ visibility: blink ? 'hidden' : 'visible' }}
            aria-hidden={blink}
        >
            <div className={`font-mono tracking-widest text-theme-text ${sizeClass} py-3 text-center break-keep`}>
                {item?.a || ''}
            </div>
            <div className="w-32 sm:w-40 border-t border-theme-line" />
            <div className={`font-mono tracking-widest text-theme-text ${sizeClass} py-3 text-center break-keep`}>
                {item?.b || ''}
            </div>
        </div>
    );
};

StringPairDisplay.propTypes = {
    item: PropTypes.shape({
        a: PropTypes.string,
        b: PropTypes.string,
    }),
    blink: PropTypes.bool,
};

export default StringPairDisplay;

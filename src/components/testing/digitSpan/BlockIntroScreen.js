/* src/components/testing/digitSpan/BlockIntroScreen.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { DIGIT_SPAN_BLOCKS } from '../../../constants/digitSpanConstants';

/**
 * Intro screen shown before each block's practice trials.
 * The backward intro includes a worked reverse-order example.
 */
const BlockIntroScreen = ({ block, onStartPractice }) => {
    const isBackward = block === DIGIT_SPAN_BLOCKS.BACKWARD;

    return (
        <div className="text-center py-8 max-w-md mx-auto">
            <div className="h-12 w-12 mx-auto mb-4 bg-theme-accent/10 border border-theme-accent flex items-center justify-center">
                <FontAwesomeIcon icon={isBackward ? faArrowLeft : faArrowRight} className="h-5 w-5 text-theme-accent" />
            </div>
            <p className="text-xs font-mono text-theme-text-muted uppercase tracking-[0.2em] mb-1">
                {isBackward ? 'Part 2 of 2' : 'Part 1 of 2'}
            </p>
            <h2 className="text-xl font-serif italic text-theme-text mb-4">
                {isBackward ? 'Backward Span' : 'Forward Span'}
            </h2>

            <div className="text-sm text-theme-text-secondary text-left space-y-3 mb-6">
                <p>
                    Digits will appear on screen one at a time. Watch the full sequence,
                    then enter the digits {isBackward
                        ? <>in <span className="text-theme-accent font-medium">REVERSE order</span> (last digit first)</>
                        : <>in the <span className="text-theme-accent font-medium">same order</span> they appeared</>}.
                </p>
                {isBackward && (
                    <div className="bg-theme-bg-elevated border border-theme-line p-3">
                        <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-2">Example</p>
                        <p className="font-mono text-theme-text">
                            See <span className="text-theme-accent">4</span>, then <span className="text-theme-accent">7</span>, then <span className="text-theme-accent">1</span>
                        </p>
                        <p className="font-mono text-theme-text mt-1">
                            Enter <span className="text-status-success">1, 7, 4</span>
                        </p>
                    </div>
                )}
                <p>
                    The sequence gets longer each time you recall it correctly, and shorter
                    after two errors in a row. This part has a short practice, then 14 scored rounds.
                </p>
                <p className="text-theme-text-muted">
                    Keep this tab visible while the digits are showing. There is no penalty
                    for taking your time during recall.
                </p>
            </div>

            <button
                onClick={onStartPractice}
                className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
            >
                Start Practice
            </button>
        </div>
    );
};

BlockIntroScreen.propTypes = {
    block: PropTypes.string.isRequired,
    onStartPractice: PropTypes.func.isRequired,
};

export default BlockIntroScreen;

/* src/components/testing/visualArrays/ArrayDisplay.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';
import {
    VISUAL_ARRAYS_PHASES,
    VISUAL_ARRAYS_DEFAULTS,
    VISUAL_ARRAYS_COLORS,
} from '../../../constants/visualArraysConstants';

const D = VISUAL_ARRAYS_DEFAULTS;
const COLORS = VISUAL_ARRAYS_COLORS;

/**
 * Square stimulus field for every presentation phase, on the literature-
 * standard mid-gray background (isolated from app theming on purpose).
 *
 * Timing-critical contract: ALL items for the trial (memory-array layer and
 * probe layer) are mounted as soon as the trial spec arrives; phase changes
 * only flip container-level opacity between 0 and 1 (inline style, no CSS
 * transitions/animations), so the browser is never parsing or mounting DOM
 * at stimulus onset (Pronk et al. 2020).
 *
 * aria-hidden: this is a visual change-detection assessment; announcing the
 * stimuli would change the construct. Pure presentational component — the
 * parent owns sizing (containerSize in px).
 */

const rectStyle = (item, orientation, containerSize, color) => {
    const width = D.ITEM_LENGTH_NORM * containerSize;
    const height = width * D.ITEM_WIDTH_RATIO;
    return {
        position: 'absolute',
        left: item.x * containerSize,
        top: item.y * containerSize,
        width,
        height,
        transform: `translate(-50%, -50%) rotate(${orientation}deg)`,
        backgroundColor: color,
    };
};

const probeDotStyle = (containerSize) => {
    const itemHeight = D.ITEM_LENGTH_NORM * containerSize * D.ITEM_WIDTH_RATIO;
    const diameter = Math.max(4, itemHeight * 0.55);
    return {
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: diameter,
        height: diameter,
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        backgroundColor: COLORS.PROBE_DOT,
    };
};

const ArrayDisplay = ({ phase, trialSpec, containerSize, feedbackCorrect }) => {
    const showArray = phase === VISUAL_ARRAYS_PHASES.ARRAY;
    const showProbe = phase === VISUAL_ARRAYS_PHASES.PROBE;
    const showFixation = phase === VISUAL_ARRAYS_PHASES.FIXATION;
    const showCue = phase === VISUAL_ARRAYS_PHASES.CUE;
    const showFeedback = phase === VISUAL_ARRAYS_PHASES.TRIAL_FEEDBACK;

    const cueColor = trialSpec ? COLORS[trialSpec.cueColor] : null;
    const distractorColorName = trialSpec
        ? (trialSpec.cueColor === 'RED' ? 'BLUE' : 'RED')
        : null;
    const distractorColor = distractorColorName ? COLORS[distractorColorName] : null;

    return (
        <div
            aria-hidden="true"
            className="relative mx-auto select-none overflow-hidden rounded-md"
            style={{
                width: containerSize,
                height: containerSize,
                backgroundColor: COLORS.BACKGROUND,
            }}
        >
            {/* Memory array layer: targets (cue color) + distractors (other color) */}
            {trialSpec && (
                <div style={{ opacity: showArray ? 1 : 0 }}>
                    {trialSpec.targets.map((item, i) => (
                        <div key={`t${i}`} style={rectStyle(item, item.orientation, containerSize, cueColor)} />
                    ))}
                    {trialSpec.distractors.map((item, i) => (
                        <div key={`d${i}`} style={rectStyle(item, item.orientation, containerSize, distractorColor)} />
                    ))}
                </div>
            )}

            {/* Probe layer: cued-color items only; the probed item shows
                probeOrientation (== original on unchanged trials) + white dot */}
            {trialSpec && (
                <div style={{ opacity: showProbe ? 1 : 0 }}>
                    {trialSpec.targets.map((item, i) => {
                        const isProbed = i === trialSpec.probeIndex;
                        const orientation = isProbed ? trialSpec.probeOrientation : item.orientation;
                        return (
                            <div key={`p${i}`} style={rectStyle(item, orientation, containerSize, cueColor)}>
                                {isProbed && <div style={probeDotStyle(containerSize)} />}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Fixation cross */}
            <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ opacity: showFixation ? 1 : 0 }}
            >
                <span className="text-5xl font-mono" style={{ color: '#ffffff' }}>+</span>
            </div>

            {/* Cue word in its own color (word + color redundancy for CVD) */}
            <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ opacity: showCue ? 1 : 0 }}
            >
                {trialSpec && (
                    <span
                        className="text-4xl sm:text-5xl font-mono font-bold tracking-[0.2em]"
                        style={{ color: cueColor }}
                    >
                        {trialSpec.cueColor}
                    </span>
                )}
            </div>

            {/* Practice feedback overlay (mirrors TrialFeedbackDisplay icon) */}
            {showFeedback && feedbackCorrect !== null && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`h-14 w-14 border flex items-center justify-center ${
                        feedbackCorrect
                            ? 'bg-status-success/20 border-status-success'
                            : 'bg-status-error/20 border-status-error'
                    }`}>
                        <FontAwesomeIcon
                            icon={feedbackCorrect ? faCheck : faTimes}
                            className={`h-6 w-6 ${feedbackCorrect ? 'text-status-success' : 'text-status-error'}`}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

ArrayDisplay.propTypes = {
    phase: PropTypes.string,
    trialSpec: PropTypes.shape({
        cueColor: PropTypes.oneOf(['RED', 'BLUE']),
        probeIndex: PropTypes.number,
        probeOrientation: PropTypes.number,
        targets: PropTypes.arrayOf(PropTypes.shape({
            x: PropTypes.number,
            y: PropTypes.number,
            orientation: PropTypes.number,
        })),
        distractors: PropTypes.arrayOf(PropTypes.shape({
            x: PropTypes.number,
            y: PropTypes.number,
            orientation: PropTypes.number,
        })),
    }),
    containerSize: PropTypes.number.isRequired,
    feedbackCorrect: PropTypes.bool,
};

export default ArrayDisplay;

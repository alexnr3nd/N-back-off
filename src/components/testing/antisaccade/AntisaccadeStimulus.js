/* src/components/testing/antisaccade/AntisaccadeStimulus.js */
import React from 'react';
import PropTypes from 'prop-types';
import { ANTISACCADE_PHASES, ANTISACCADE_CONFIG } from '../../../constants/antisaccadeConstants';

const P = ANTISACCADE_PHASES;

// Lateral eccentricity as a CSS length. The assessment uses a fixed
// ANTISACCADE_CONFIG.ECCENTRICITY_VW (0.28 -> '28vw'); the trainer passes a
// per-trial eccentricityVw prop (its perceptual lever). Inline styles (not
// Tailwind arbitrary values) so the value never desyncs from a hardcoded class.
// (+toFixed strips float noise: 0.28 * 100 === 28.000000000000004)
const eccentricityCss = (vw) => `${+(vw * 100).toFixed(3)}vw`;

// High-contrast stimulus color shared with the main game's stimuli
// (see stimulusRenderers.js / ShapeIcon.js): near-white on the dark theme,
// near-black on the light theme.
const STIMULUS_COLOR = 'rgb(var(--color-stimulus-white))';

// Cue, target, and mask glyphs share this anchor (position, line box) so
// every layer lands on the same point with zero layout shift. Sizes are
// viewport-relative so the glyphs stay imposing on phone-landscape and
// desktop alike.
const LATERAL_GLYPH_ANCHOR = 'absolute left-1/2 top-1/2 leading-none';
const LATERAL_MONO_SIZE = 'text-[clamp(2.5rem,9vmin,5rem)]';
// The target letter renders smaller and lighter than the mono glyphs
// (owner preference): a big bold O/Q is discriminable from peripheral
// vision by sheer stroke mass alone, defeating the saccade the task
// measures. Mask coverage still holds — the mono `##` block is larger
// on both axes than the letter centered on the same anchor.
const LATERAL_LETTER_SIZE = 'text-[clamp(0.75rem,2.75vmin,1.5rem)]';

// Fonts split per glyph (owner preference): the `*` cue and `##` mask keep
// the app mono; ONLY the target letter is Rubik — Space Mono's long-tailed Q
// is identifiable from O without foveating, while Rubik's O/Q are nearly
// identical in peripheral vision, so identifying the letter forces the
// actual saccade the task measures. AntisaccadeTask warms the Rubik face on
// mount so the 100ms flash never falls back to a more-discriminable font on
// a cold cache.
const LATERAL_MONO_CLASS = `${LATERAL_GLYPH_ANCHOR} ${LATERAL_MONO_SIZE} font-mono font-bold`;
const LATERAL_LETTER_CLASS = `${LATERAL_GLYPH_ANCHOR} ${LATERAL_LETTER_SIZE} font-rubik font-normal`;

// translate(-50%, -50%) centers the glyph box on its anchor point; the
// trailing translateX is the viewport-relative lateral offset. The layout
// position (left/top) is identical for every layer and never changes, so
// phase flips touch opacity only — transforms are composited, no layout.
const lateralTransform = (side, ecc) =>
    `translate(-50%, -50%) translateX(${side === 'right' ? '' : '-'}${ecc})`;

/**
 * Stimulus field for the antisaccade trial presentation.
 *
 * Timing-critical contract (mirrors visualArrays/ArrayDisplay.js): ALL four
 * stimulus layers — fixation `+`, cue `*`, target letter, and the two-sided
 * `##` mask — are mounted unconditionally for the life of the component.
 * Phase changes flip inline `opacity` between 0 and 1 ONLY (no CSS
 * transitions/animations, no display/visibility toggles, no conditional
 * mounting), so the browser is never parsing or mounting DOM at stimulus
 * onset and there is zero layout shift between phases.
 *
 * Visibility by phase:
 * - FIXATION + TONE  -> center fixation cross `+`
 * - CUE              -> `*` at `cueSide`, offset ±ECCENTRICITY_VW·100vw
 * - TARGET           -> `letter` (Q/O, Rubik) at `targetSide`, same offset
 * - MASK             -> mono `##` at BOTH lateral positions, same anchor
 *                       as the letter (larger block) so it pattern-masks
 *                       the target location cleanly
 * - any other phase  -> blank field (RESPONSE is intentionally blank)
 *
 * There is deliberately NO `practice` prop: practice differs only in target
 * duration, which the timer hook owns — nothing is visually different.
 *
 * Layout contract for the consumer (C6 task screen): the lateral offsets are
 * VIEWPORT-relative (±28vw), so this component must be rendered horizontally
 * centered in the viewport and the glyph excursion must not be clipped — do
 * NOT place it inside a narrow `overflow-hidden` card (the Visual Arrays
 * main-card pattern would clip it on desktop); render the stimulus band
 * full-bleed instead. The field provides its own height and plain
 * theme-background; the parent owns vertical placement.
 *
 * aria-hidden: visual assessment by construct; announcing stimuli would
 * invalidate it. Pure presentational component — no state, no effects.
 */
const AntisaccadeStimulus = ({
    phase, cueSide, targetSide, letter,
    // Trainer lever overrides. Each defaults to the assessment's fixed value, so
    // omitting them renders the assessment byte-identically.
    eccentricityVw = ANTISACCADE_CONFIG.ECCENTRICITY_VW,
    fixationThroughTarget = false, // keep fixation cross on through CUE+TARGET (overlap)
}) => {
    const ecc = eccentricityCss(eccentricityVw);
    const showFixation = phase === P.FIXATION || phase === P.TONE
        || (fixationThroughTarget && (phase === P.CUE || phase === P.TARGET));
    const showCue = phase === P.CUE;
    const showTarget = phase === P.TARGET;
    const showMask = phase === P.MASK;

    return (
        <div
            aria-hidden="true"
            className="relative w-full h-[40vh] min-h-[180px] select-none bg-theme-bg"
        >
            {/* Fixation cross — center; stays up through the alerting tone */}
            <span
                className="absolute left-1/2 top-1/2 font-mono leading-none text-5xl"
                style={{
                    opacity: showFixation ? 1 : 0,
                    transform: 'translate(-50%, -50%)',
                    color: STIMULUS_COLOR,
                }}
            >
                +
            </span>

            {/* Cue asterisk at cueSide (the side the user must look AWAY from) */}
            <span
                className={LATERAL_MONO_CLASS}
                style={{
                    opacity: showCue ? 1 : 0,
                    transform: lateralTransform(cueSide, ecc),
                    color: STIMULUS_COLOR,
                }}
            >
                *
            </span>

            {/* Target letter at targetSide (opposite the cue) */}
            <span
                className={LATERAL_LETTER_CLASS}
                style={{
                    opacity: showTarget ? 1 : 0,
                    transform: lateralTransform(targetSide, ecc),
                    color: STIMULUS_COLOR,
                }}
            >
                {letter || ''}
            </span>

            {/* Backward mask at BOTH lateral positions (covers cue + target
                locations; same anchor as the letter, larger glyph box) */}
            <div style={{ opacity: showMask ? 1 : 0 }}>
                {ANTISACCADE_CONFIG.SIDES.map((side) => (
                    <span
                        key={side}
                        className={LATERAL_MONO_CLASS}
                        style={{
                            transform: lateralTransform(side, ecc),
                            color: STIMULUS_COLOR,
                        }}
                    >
                        ##
                    </span>
                ))}
            </div>
        </div>
    );
};

AntisaccadeStimulus.propTypes = {
    phase: PropTypes.string,
    cueSide: PropTypes.oneOf(ANTISACCADE_CONFIG.SIDES),
    targetSide: PropTypes.oneOf(ANTISACCADE_CONFIG.SIDES),
    letter: PropTypes.oneOf(ANTISACCADE_CONFIG.LETTERS),
    // Trainer lever overrides (optional; default to assessment values)
    eccentricityVw: PropTypes.number,
    fixationThroughTarget: PropTypes.bool,
};

export default AntisaccadeStimulus;

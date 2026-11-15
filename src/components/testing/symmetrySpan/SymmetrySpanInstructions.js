/* src/components/testing/symmetrySpan/SymmetrySpanInstructions.js */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
    faArrowLeft,
    faCheckCircle,
    faExclamationTriangle,
    faBrain,
    faTableCells,
} from '@fortawesome/free-solid-svg-icons';

/** Small illustrative 8x8 pattern (symmetric) for the instructions. */
const MiniPattern = () => {
    const left = [1, 9, 10, 18, 25, 26, 34, 41, 49, 50, 58];
    const filled = new Set(left.flatMap(i => [i, Math.floor(i / 8) * 8 + (7 - (i % 8))]));
    return (
        <div className="inline-grid gap-px bg-theme-line/60 border border-theme-line" style={{ gridTemplateColumns: 'repeat(8, 14px)' }}>
            {Array.from({ length: 64 }, (_, i) => (
                <div key={i} className={`h-3.5 ${filled.has(i) ? 'bg-theme-text' : 'bg-theme-bg-secondary'}`} />
            ))}
        </div>
    );
};

/** Small illustrative 4x4 grid with one red square. */
const MiniGrid = () => (
    <div className="inline-grid gap-px bg-theme-line/60 border border-theme-line" style={{ gridTemplateColumns: 'repeat(4, 22px)' }}>
        {Array.from({ length: 16 }, (_, i) => (
            <div key={i} className={`h-[22px] ${i === 6 ? 'bg-status-error' : 'bg-theme-bg-secondary'}`} />
        ))}
    </div>
);

const STEPS = [
    {
        title: 'What is Symmetry Span?',
        icon: faBrain,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Symmetry Span is the standard laboratory measure of visuospatial working memory:
                    holding spatial information in mind while doing something else with it. It alternates
                    between two simple jobs that compete for the same mental resources.
                </p>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    In each set: judge whether a pattern is <strong>symmetric</strong>, then remember where a
                    <strong> red square</strong> appears. After 2&ndash;5 rounds of this, recall the square
                    positions in the order they appeared.
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-xs font-mono text-theme-accent uppercase tracking-wider mb-2">Key Facts</p>
                    <ul className="text-sm text-theme-text-secondary space-y-1">
                        <li>12 scored sets of 2&ndash;5 squares each, plus short practices</li>
                        <li>Maximum score: 42 squares recalled in position</li>
                        <li>Includes a research percentile from published norms</li>
                        <li>Full session: ~10&ndash;15 minutes</li>
                    </ul>
                </div>
            </div>
        ),
    },
    {
        title: 'Step 1: Judge the Pattern',
        icon: faTableCells,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    A pattern of dark and light cells appears. Decide whether it is <strong>mirrored across its
                    vertical axis</strong> — would the left half fold exactly onto the right half? About half
                    the patterns are symmetric.
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-6 text-center">
                    <MiniPattern />
                    <p className="text-xs font-mono text-theme-text-muted mt-4 uppercase tracking-wider">This one is symmetric</p>
                </div>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Answer with the <strong>Symmetric</strong> / <strong>Not Symmetric</strong> buttons. The
                    symmetry-only practice is untimed — that stage measures your natural pace to set a personal
                    time limit. From the combined practice onward, each judgment must beat that limit. Running
                    out of time counts as an error, so judge promptly but accurately.
                </p>
            </div>
        ),
    },
    {
        title: 'Step 2: Remember the Square',
        icon: faTableCells,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Right after each judgment, a <strong>red square</strong> flashes briefly (0.65 seconds) in a
                    4&times;4 grid. Remember <strong>where</strong> it was — and keep the earlier positions of
                    the set in mind too.
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-6 text-center">
                    <MiniGrid />
                    <p className="text-xs font-mono text-theme-text-muted mt-4 uppercase tracking-wider">Each square shows for 650ms</p>
                </div>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Judgment, square, judgment, square&hellip; the alternation continues until the set ends.
                    Sets contain 2 to 5 squares, in unpredictable order.
                </p>
            </div>
        ),
    },
    {
        title: 'Step 3: Recall in Order',
        icon: faCheckCircle,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    At the end of a set, an empty grid appears. <strong>Tap the cells where the squares appeared,
                    in the order they appeared.</strong> Each tap is numbered so the sequence stays visible.
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-2 text-center">Recall Controls</p>
                    <ul className="text-sm text-theme-text-secondary space-y-2">
                        <li><span className="text-theme-accent font-mono">Blank</span> &mdash; forgot one position? Insert a placeholder and keep the rest in order</li>
                        <li><span className="text-theme-accent font-mono">Back</span> &mdash; remove the last entry</li>
                        <li><span className="text-status-error font-mono">Clear</span> &mdash; start the recall over</li>
                    </ul>
                </div>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Recall is untimed (up to 90 seconds), so accuracy beats speed. Partial credit is given for
                    every square in its correct position, even when the whole set isn't perfect.
                </p>
            </div>
        ),
    },
    {
        title: 'Important Guidelines',
        icon: faExclamationTriangle,
        content: (
            <div className="space-y-4">
                <div className="bg-status-error/10 border border-status-error/30 p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Keep symmetry accuracy at 85% or higher</p>
                    <p className="text-xs text-theme-text-secondary">
                        The judgments are what keep memory under load. Guessing on them to focus on the squares
                        invalidates the score — sessions below 85% are flagged. The running percentage is shown
                        during recall and turns red as a warning.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Practice comes first</p>
                    <p className="text-xs text-theme-text-secondary">
                        Every session starts with three short practice stages: squares only, then symmetry
                        judgments only (which calibrates your personal time limit), then both combined.
                        Already familiar with the task? On scored sessions, a skip option appears during practice.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Find a quiet moment</p>
                    <p className="text-xs text-theme-text-secondary">
                        The session cannot be paused. Allow about 10&ndash;15 minutes of uninterrupted focus,
                        and keep this tab in the foreground during the sets.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">First session is familiarization</p>
                    <p className="text-xs text-theme-text-secondary">
                        The first run-through is a familiarization session: identical to the real assessment,
                        recorded, but excluded from the trend chart. After that, one scored assessment per
                        month keeps the trend reliable.
                    </p>
                </div>
            </div>
        ),
    },
];

const SymmetrySpanInstructions = ({ onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const isLastStep = currentStep === STEPS.length - 1;
    const step = STEPS[currentStep];

    return (
        <div className="p-6">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
                {STEPS.map((_, i) => (
                    <div
                        key={i}
                        className={`h-1.5 flex-1 transition-colors duration-200 ${
                            i <= currentStep ? 'bg-theme-accent' : 'bg-theme-line'
                        }`}
                    />
                ))}
            </div>

            {/* Step header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 bg-theme-bg-elevated border border-theme-accent/50 flex items-center justify-center">
                    <FontAwesomeIcon icon={step.icon} className="text-theme-accent h-4 w-4" />
                </div>
                <div>
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider">Step {currentStep + 1} of {STEPS.length}</p>
                    <h2 className="text-lg font-serif italic text-theme-text">{step.title}</h2>
                </div>
            </div>

            {/* Step content */}
            <div className="mb-8 min-h-[300px]">
                {step.content}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-theme-line">
                <button
                    onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                    disabled={currentStep === 0}
                    className={`flex items-center gap-2 text-sm font-mono uppercase tracking-wider transition-colors ${
                        currentStep === 0
                            ? 'text-theme-text-muted/40 cursor-not-allowed'
                            : 'text-theme-text-muted hover:text-theme-accent'
                    }`}
                >
                    <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" />
                    Back
                </button>

                {isLastStep ? (
                    <button
                        onClick={onComplete}
                        className="btn-primary-lab px-6 py-2.5 text-sm flex items-center gap-2"
                    >
                        <span>Got It</span>
                        <FontAwesomeIcon icon={faCheckCircle} className="h-3 w-3" />
                    </button>
                ) : (
                    <button
                        onClick={() => setCurrentStep(prev => Math.min(STEPS.length - 1, prev + 1))}
                        className="btn-primary-lab px-6 py-2.5 text-sm flex items-center gap-2"
                    >
                        <span>Next</span>
                        <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3" />
                    </button>
                )}
            </div>
        </div>
    );
};

SymmetrySpanInstructions.propTypes = {
    onComplete: PropTypes.func.isRequired,
};

export default SymmetrySpanInstructions;

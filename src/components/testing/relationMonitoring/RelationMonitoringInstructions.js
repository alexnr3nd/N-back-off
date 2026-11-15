/* src/components/testing/relationMonitoring/RelationMonitoringInstructions.js */
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
    faBullseye,
    faClock,
} from '@fortawesome/free-solid-svg-icons';

// Static example grids rendered with the same monospace digit treatment as
// the real task. `highlight` marks the cells of a matching line; `accent`
// colors every ending digit (instructions only — the real task shows plain
// digits, per protocol).
const MockGrid = ({ values, highlight = [], accentEndings = false }) => (
    <div className="grid grid-cols-3 gap-1.5 max-w-[240px] mx-auto select-none" aria-hidden="true">
        {values.map((value, i) => (
            <div
                key={i}
                className={`aspect-square flex items-center justify-center border font-mono tabular-nums text-lg sm:text-xl ${highlight.includes(i)
                    ? 'border-theme-accent bg-theme-accent/10 text-theme-text'
                    : 'border-theme-line bg-theme-bg-secondary text-theme-text'}`}
            >
                {accentEndings ? (
                    <span>
                        {value.slice(0, 2)}
                        <span className={highlight.includes(i) ? 'text-theme-accent font-bold' : 'text-theme-accent'}>
                            {value.slice(2)}
                        </span>
                    </span>
                ) : (
                    value
                )}
            </div>
        ))}
    </div>
);
MockGrid.propTypes = {
    values: PropTypes.arrayOf(PropTypes.string).isRequired,
    highlight: PropTypes.arrayOf(PropTypes.number),
    accentEndings: PropTypes.bool,
};

const STEPS = [
    {
        title: 'What is Relation Monitoring?',
        icon: faBrain,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Relation Monitoring measures <strong>relational integration</strong>: the
                    ability to hold several pieces of information in mind and continuously
                    check the relations between them. It is the laboratory task most closely
                    tied to relational reasoning, and it predicts fluid intelligence beyond
                    memory-span and n-back tasks.
                </p>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Grids of nine three-digit numbers appear one after another, at a steady
                    pace. The job: spot the grids where a <strong>row or column</strong> of
                    numbers <strong>ends in the same digit</strong> — and respond only then.
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-xs font-mono text-theme-accent uppercase tracking-wider mb-2">Key Facts</p>
                    <ul className="text-sm text-theme-text-secondary space-y-1">
                        <li>108 grids in 3 blocks (~12 minutes), breaks between blocks</li>
                        <li>One response: MATCH. No match means do nothing</li>
                        <li>Practice grids with feedback come first</li>
                        <li>Score: hits minus false alarms</li>
                    </ul>
                </div>
            </div>
        ),
    },
    {
        title: 'The Grid',
        icon: faTableCells,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Each display is a 3 x 3 grid of three-digit numbers. Only the{' '}
                    <strong>last digit</strong> of each number matters — the first two
                    digits are noise to read past.
                </p>
                <MockGrid
                    values={['254', '871', '463', '139', '527', '906', '342', '785', '618']}
                    accentEndings
                />
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    The ending digits here are highlighted for illustration. In the real
                    task all digits look the same — extracting the endings is part of the
                    work.
                </p>
            </div>
        ),
    },
    {
        title: 'The Rule',
        icon: faBullseye,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Press <strong>MATCH</strong> when the three numbers in any{' '}
                    <strong>row or column</strong> end in the same digit. Diagonals do{' '}
                    <strong>not</strong> count.
                </p>
                <MockGrid
                    values={['254', '871', '463', '134', '524', '904', '342', '785', '618']}
                    highlight={[3, 4, 5]}
                    accentEndings
                />
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    The middle row ends 4&ndash;4&ndash;4, so this grid is a MATCH. About
                    half the grids contain exactly one matching line; the other half
                    contain none. When there is no match, the correct response is to do
                    nothing and wait for the next grid.
                </p>
            </div>
        ),
    },
    {
        title: 'The Pace',
        icon: faClock,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    The stream runs itself: each grid stays up for{' '}
                    <strong>5.5 seconds</strong>, blinks off briefly, and the next one
                    appears. There is no next button and no way to slow it down — scan the
                    rows and columns, decide, and respond before the grid disappears.
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-xs font-mono text-theme-accent uppercase tracking-wider mb-2">Responding</p>
                    <ul className="text-sm text-theme-text-secondary space-y-1">
                        <li>Tap the MATCH button, or press Space on a keyboard</li>
                        <li>Only the first press per grid counts</li>
                        <li>A press cannot be taken back — respond only when sure</li>
                    </ul>
                </div>
                <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-3">
                    <p className="text-xs text-theme-text-secondary">
                        <span className="text-theme-accent font-semibold uppercase text-xs tracking-wider">Note:</span> Keep
                        this tab visible while grids are on screen. Grids that display while
                        the tab is hidden or throttled are excluded from scoring.
                    </p>
                </div>
            </div>
        ),
    },
    {
        title: 'Important Guidelines',
        icon: faExclamationTriangle,
        content: (
            <div className="space-y-4">
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">False alarms subtract</p>
                    <p className="text-xs text-theme-text-secondary">
                        The score is hits minus false alarms. Pressing MATCH on every grid
                        scores zero — exactly like never pressing at all. Responding only to
                        genuine matches is the whole skill.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Practice comes first</p>
                    <p className="text-xs text-theme-text-secondary">
                        Five practice grids with right/wrong feedback make the rule concrete
                        before scoring begins. Scored grids show no feedback — that's the
                        research convention.
                        Already familiar with the task? On scored sessions, a skip option appears during practice.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Find a quiet moment</p>
                    <p className="text-xs text-theme-text-secondary">
                        Three blocks of 36 grids take about 12 minutes, with self-paced
                        breaks between blocks. A block cannot be paused once it starts, and
                        the tab must stay in the foreground while grids are on screen.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">First session is familiarization</p>
                    <p className="text-xs text-theme-text-secondary">
                        The first run-through is a familiarization session: identical to the
                        real assessment, recorded, but excluded from the trend chart. After
                        that, one scored assessment per month keeps the trend reliable.
                    </p>
                </div>
            </div>
        ),
    },
];

const RelationMonitoringInstructions = ({ onComplete }) => {
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

RelationMonitoringInstructions.propTypes = {
    onComplete: PropTypes.func.isRequired,
};

export default RelationMonitoringInstructions;

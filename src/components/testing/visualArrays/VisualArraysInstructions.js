/* src/components/testing/visualArrays/VisualArraysInstructions.js */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
    faArrowLeft,
    faCheckCircle,
    faExclamationTriangle,
    faBrain,
    faEye,
    faBolt,
    faCircleDot,
} from '@fortawesome/free-solid-svg-icons';
import { VISUAL_ARRAYS_COLORS } from '../../../constants/visualArraysConstants';

const C = VISUAL_ARRAYS_COLORS;

// Static example graphics rendered with the same rectangle treatment as the
// real task (small inline mock arrays; positions hardcoded).
const MockField = ({ children }) => (
    <div
        className="relative h-44 max-w-sm mx-auto rounded-md overflow-hidden select-none"
        aria-hidden="true"
        style={{ backgroundColor: C.BACKGROUND }}
    >
        {children}
    </div>
);
MockField.propTypes = { children: PropTypes.node };

const MockRect = ({ x, y, deg, color, dot = false }) => (
    <div
        style={{
            position: 'absolute',
            left: `${x}%`,
            top: `${y}%`,
            width: 44,
            height: 16,
            transform: `translate(-50%, -50%) rotate(${deg}deg)`,
            backgroundColor: color,
        }}
    >
        {dot && (
            <div
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 9,
                    height: 9,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '50%',
                    backgroundColor: C.PROBE_DOT,
                }}
            />
        )}
    </div>
);
MockRect.propTypes = {
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    deg: PropTypes.number.isRequired,
    color: PropTypes.string.isRequired,
    dot: PropTypes.bool,
};

const STEPS = [
    {
        title: 'What is Visual Arrays?',
        icon: faBrain,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Visual Arrays measures <strong>attention control</strong> and visual working
                    memory: the ability to focus on what matters and filter out what doesn't.
                    It is one of the best-established laboratory measures of that ability.
                </p>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    On each trial a set of <span style={{ color: C.RED }} className="font-semibold">red</span> and{' '}
                    <span style={{ color: C.BLUE }} className="font-semibold">blue</span> rectangles flashes
                    briefly. Only ONE color matters on each trial — the other is there purely to distract.
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-xs font-mono text-theme-accent uppercase tracking-wider mb-2">Key Facts</p>
                    <ul className="text-sm text-theme-text-secondary space-y-1">
                        <li>120 quick trials (~10 minutes), short break halfway</li>
                        <li>Unspeeded answers: SAME or DIFFERENT</li>
                        <li>Practice trials with feedback come first</li>
                        <li>Score: capacity k, how many items you can hold</li>
                    </ul>
                </div>
            </div>
        ),
    },
    {
        title: 'Step 1: The Cue',
        icon: faEye,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Each trial starts with a cross to fixate, then a one-word cue:{' '}
                    <strong>RED</strong> or <strong>BLUE</strong>. That word tells you which
                    color to remember. Ignore the other color completely.
                </p>
                <MockField>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl font-mono font-bold tracking-[0.2em]" style={{ color: C.RED }}>RED</span>
                    </div>
                </MockField>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Here, only the red rectangles matter on this trial — the blue ones are
                    distractors and are never tested.
                </p>
            </div>
        ),
    },
    {
        title: 'Step 2: The Flash',
        icon: faBolt,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    The rectangles appear for only a <strong>quarter of a second</strong>.
                    Remember the <strong>tilt</strong> (orientation) of each cued-color rectangle —
                    flat, upright, or diagonal.
                </p>
                <MockField>
                    <MockRect x={22} y={28} deg={45} color={C.RED} />
                    <MockRect x={62} y={20} deg={0} color={C.BLUE} />
                    <MockRect x={82} y={42} deg={90} color={C.RED} />
                    <MockRect x={35} y={62} deg={135} color={C.BLUE} />
                    <MockRect x={58} y={75} deg={90} color={C.RED} />
                    <MockRect x={15} y={80} deg={0} color={C.BLUE} />
                </MockField>
                <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-3">
                    <p className="text-xs text-theme-text-secondary">
                        <span className="text-theme-accent font-semibold uppercase text-xs tracking-wider">Note:</span> Keep
                        this tab visible while the rectangles are flashing. If the tab loses focus
                        mid-trial, that trial restarts with a fresh array.
                    </p>
                </div>
            </div>
        ),
    },
    {
        title: 'Step 3: The Test',
        icon: faCircleDot,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    After a short blank delay, the cued-color rectangles come back — and exactly
                    one of them has a <strong>white dot</strong>. Did the dotted rectangle keep
                    its tilt, or change it?
                </p>
                <MockField>
                    <MockRect x={22} y={28} deg={135} color={C.RED} dot />
                    <MockRect x={82} y={42} deg={90} color={C.RED} />
                    <MockRect x={58} y={75} deg={90} color={C.RED} />
                </MockField>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    This dotted rectangle was tilted the other way during the flash, so the answer
                    is <strong>DIFFERENT</strong>. Press <strong>SAME</strong> or{' '}
                    <strong>DIFFERENT</strong> (keys S / D also work). Half the trials are
                    same, half are different.
                </p>
            </div>
        ),
    },
    {
        title: 'Important Guidelines',
        icon: faExclamationTriangle,
        content: (
            <div className="space-y-4">
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Accuracy matters, speed doesn't</p>
                    <p className="text-xs text-theme-text-secondary">
                        There is no answer deadline pressure — take a moment and answer what you
                        actually remember. Guessing is fine when unsure; that's part of the measure.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Practice comes first</p>
                    <p className="text-xs text-theme-text-secondary">
                        Eight short practice trials with feedback make the rules clear before
                        scoring begins. Scored trials show no feedback — that's the research convention.
                        Already familiar with the task? On scored sessions, a skip option appears during practice.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Find a quiet moment</p>
                    <p className="text-xs text-theme-text-secondary">
                        120 quick trials take about 10 minutes with a self-paced break at the halfway
                        point. The session cannot be paused, and the tab must stay in the foreground
                        while arrays are on screen.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">First session is familiarization</p>
                    <p className="text-xs text-theme-text-secondary">
                        The first run-through is a familiarization session: identical to the real
                        assessment, recorded, but excluded from the trend chart. After that, one
                        scored assessment per month keeps the trend reliable.
                    </p>
                </div>
            </div>
        ),
    },
];

const VisualArraysInstructions = ({ onComplete }) => {
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

VisualArraysInstructions.propTypes = {
    onComplete: PropTypes.func.isRequired,
};

export default VisualArraysInstructions;

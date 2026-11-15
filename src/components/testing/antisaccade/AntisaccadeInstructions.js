/* src/components/testing/antisaccade/AntisaccadeInstructions.js */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
    faArrowLeft,
    faCheckCircle,
    faExclamationTriangle,
    faBrain,
    faCrosshairs,
    faArrowsLeftRight,
    faKeyboard,
} from '@fortawesome/free-solid-svg-icons';

// Static example graphics rendered with the same glyph treatment as the real
// task (mono cue/cross, Rubik letter; positions hardcoded). Rubik on the
// letter matters: the demo must preview the exact glyph shape the user will
// have to discriminate (see the font-split rationale in
// AntisaccadeStimulus.js). STIMULUS_COLOR mirrors AntisaccadeStimulus.js:
// near-white on the dark theme, near-black on the light theme.
const STIMULUS_COLOR = 'rgb(var(--color-stimulus-white))';

const MockField = ({ children }) => (
    <div
        className="relative h-28 max-w-sm mx-auto rounded-md overflow-hidden select-none bg-theme-bg border border-theme-line"
        aria-hidden="true"
    >
        {children}
    </div>
);
MockField.propTypes = { children: PropTypes.node };

const MockGlyph = ({ x, dim = false, rubik = false, children }) => (
    <span
        className={`absolute top-1/2 leading-none ${rubik ? 'text-base font-rubik font-normal' : 'text-2xl font-mono font-bold'}`}
        style={{
            left: `${x}%`,
            transform: 'translate(-50%, -50%)',
            color: STIMULUS_COLOR,
            opacity: dim ? 0.35 : 1,
        }}
    >
        {children}
    </span>
);
MockGlyph.propTypes = {
    x: PropTypes.number.isRequired,
    dim: PropTypes.bool,
    rubik: PropTypes.bool,
    children: PropTypes.node.isRequired,
};

const STEPS = [
    {
        title: 'What is Antisaccade?',
        icon: faBrain,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Antisaccade measures <strong>attention control</strong>: the ability to
                    resist a reflexive glance and look the other way on purpose. It is one
                    of the most widely used laboratory measures of that ability.
                </p>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    On each trial a flash pulls the eyes toward one side of the screen.
                    The whole task is refusing that pull — what needs to be caught always
                    appears on the <strong>opposite</strong> side.
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-xs font-mono text-theme-accent uppercase tracking-wider mb-2">Key Facts</p>
                    <ul className="text-sm text-theme-text-secondary space-y-1">
                        <li>72 quick trials (~10 minutes), short break halfway</li>
                        <li>Unspeeded answers: Q or O</li>
                        <li>Slower practice trials with feedback come first</li>
                        <li>Score: accuracy — how reliably the reflex is resisted</li>
                    </ul>
                </div>
            </div>
        ),
    },
    {
        title: 'Step 1: Stare at the Cross',
        icon: faCrosshairs,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Each trial starts with a <strong>+</strong> at the center of the
                    screen. Keep the eyes locked on it. A short beep signals that the
                    trial is about to start.
                </p>
                <MockField>
                    <MockGlyph x={50}>+</MockGlyph>
                    {/* Dimmed: depicts the NEXT moment — the real screen never
                        shows the cross and asterisk at full opacity together. */}
                    <MockGlyph x={18} dim>*</MockGlyph>
                </MockField>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Then an asterisk <strong>*</strong> flashes on ONE side. It pulls the
                    eyes toward it automatically — that's the trap. Do not follow it.
                </p>
            </div>
        ),
    },
    {
        title: 'Step 2: Look the Other Way',
        icon: faArrowsLeftRight,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    The letter — <strong>Q</strong> or <strong>O</strong> — appears on the
                    side <strong>opposite</strong> the asterisk, for only a{' '}
                    <strong>tenth of a second</strong> before <strong>##</strong> covers
                    it. Look away from the flash, toward the other side, to catch it.
                </p>
                <MockField>
                    <MockGlyph x={18} dim>*</MockGlyph>
                    <MockGlyph x={82} rubik>Q</MockGlyph>
                </MockField>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Here the asterisk flashed on the left, so the letter appears on the
                    right. Glance toward the flash and the letter is gone before the eyes
                    arrive.
                </p>
            </div>
        ),
    },
    {
        title: 'Step 3: Report the Letter',
        icon: faKeyboard,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    After the mask, press <strong>←</strong> (for Q) or <strong>→</strong> (for O) on the
                    keyboard, or tap the buttons, to report which letter appeared.{' '}
                    <strong>Accuracy matters, not speed</strong> — answers are unspeeded,
                    so take a moment.
                </p>
                <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto select-none" aria-hidden="true">
                    <div className="min-h-[48px] py-3 px-4 text-sm font-mono uppercase tracking-wider border bg-theme-bg-elevated text-theme-text border-theme-line flex items-center justify-center gap-2">
                        <span>Q</span><span className="text-xs text-theme-text-muted">[←]</span>
                    </div>
                    <div className="min-h-[48px] py-3 px-4 text-sm font-mono uppercase tracking-wider border bg-theme-bg-elevated text-theme-text border-theme-line flex items-center justify-center gap-2">
                        <span>O</span><span className="text-xs text-theme-text-muted">[→]</span>
                    </div>
                </div>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Missed the letter? Guess — guessing when unsure is fine and is part of
                    the measure.
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
                    <p className="text-sm text-theme-text font-medium mb-2">It's hard and fast by design</p>
                    <p className="text-xs text-theme-text-secondary">
                        The letter shows for a tenth of a second and the pull of the flash
                        is automatic — everyone misses some. Just do your best on every
                        trial.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Practice comes first</p>
                    <p className="text-xs text-theme-text-secondary">
                        Sixteen slower practice rounds with feedback come first — the
                        letter stays on screen longer while learning. Scored trials run at
                        full speed and show no feedback; that's the research convention.
                        Already familiar with the task? On scored sessions, a skip option appears during practice.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Find a quiet moment</p>
                    <p className="text-xs text-theme-text-secondary">
                        72 scored trials take about 10 minutes with a self-paced break at
                        the halfway point. Sound on helps — a beep marks each trial — and
                        the tab must stay in the foreground while stimuli are on screen;
                        if it loses focus mid-trial, that trial restarts.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">First session is familiarization</p>
                    <p className="text-xs text-theme-text-secondary">
                        The first run-through is a familiarization session: identical to
                        the real assessment, recorded, but excluded from the trend chart.
                        After that, one scored assessment per month keeps the trend
                        reliable.
                    </p>
                </div>
            </div>
        ),
    },
];

const AntisaccadeInstructions = ({ onComplete }) => {
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

AntisaccadeInstructions.propTypes = {
    onComplete: PropTypes.func.isRequired,
};

export default AntisaccadeInstructions;

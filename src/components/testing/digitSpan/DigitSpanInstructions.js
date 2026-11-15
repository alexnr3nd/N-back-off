/* src/components/testing/digitSpan/DigitSpanInstructions.js */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
    faArrowLeft,
    faCheckCircle,
    faExclamationTriangle,
    faBrain,
    faListOl,
} from '@fortawesome/free-solid-svg-icons';

const STEPS = [
    {
        title: 'What is Digit Span?',
        icon: faBrain,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Digit Span is one of the oldest and most widely used assessments of short-term and working
                    memory, dating back over a century and still part of modern clinical batteries.
                </p>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Digits appear on screen one at a time. After the sequence ends, recall it on a keypad.
                    The assessment has two parts: recall in the <strong>same order</strong> (forward block),
                    then in <strong>reverse order</strong> (backward block).
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-xs font-mono text-theme-accent uppercase tracking-wider mb-2">Key Facts</p>
                    <ul className="text-sm text-theme-text-secondary space-y-1">
                        <li>Two blocks: forward, then backward</li>
                        <li>14 scored rounds per block, plus short practices</li>
                        <li>Sequence length adapts to your performance</li>
                        <li>Full session: ~10&ndash;15 minutes</li>
                    </ul>
                </div>
            </div>
        ),
    },
    {
        title: 'Step 1: Watch the Digits',
        icon: faListOl,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Each round starts with a fixation cross, then digits appear one at a time
                    (one digit per second). Watch the whole sequence; nothing needs to be pressed yet.
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-8 text-center">
                    <p className="text-7xl font-mono font-bold text-theme-accent">7</p>
                    <p className="text-xs font-mono text-theme-text-muted mt-4 uppercase tracking-wider">Each digit shows for 800ms</p>
                </div>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Digits 1&ndash;9 are used, each at most once per sequence. A "Recall" cue marks the
                    end of the sequence.
                </p>
                <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-3">
                    <p className="text-xs text-theme-text-secondary">
                        <span className="text-theme-accent font-semibold uppercase text-xs tracking-wider">Note:</span> Keep
                        this tab visible and in the foreground while digits are showing. If the tab loses focus
                        mid-sequence, that round restarts with a fresh sequence.
                    </p>
                </div>
            </div>
        ),
    },
    {
        title: 'Step 2: Recall on the Keypad',
        icon: faCheckCircle,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    After the cue, enter the digits on the keypad (or with your keyboard's number keys).
                    In the <strong>forward block</strong>, enter them in the order shown.
                    In the <strong>backward block</strong>, enter them in reverse order.
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-2 text-center">Backward Example</p>
                    <p className="font-mono text-theme-text text-center">
                        See <span className="text-theme-accent">4</span>, then <span className="text-theme-accent">7</span>, then <span className="text-theme-accent">1</span>
                    </p>
                    <p className="font-mono text-theme-text text-center mt-1">
                        Enter <span className="text-status-success">1, 7, 4</span>
                    </p>
                </div>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Use <strong>Back</strong> to correct mistakes before submitting. There is no time pressure
                    during recall (up to 90 seconds), so accuracy beats speed.
                </p>
            </div>
        ),
    },
    {
        title: 'Adaptive Difficulty & Scoring',
        icon: faBrain,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    The sequence length adapts after every round:
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <ul className="text-sm text-theme-text-secondary space-y-2">
                        <li><span className="text-status-success font-mono">Correct</span> &rarr; next sequence is one digit longer</li>
                        <li><span className="text-status-error font-mono">One error</span> &rarr; same length again</li>
                        <li><span className="text-status-error font-mono">Two errors in a row</span> &rarr; one digit shorter</li>
                    </ul>
                </div>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Errors are expected; the staircase is designed to keep the task close to your limit.
                    The score, <strong>Mean Span</strong>, summarizes the whole run rather than just the
                    longest list, which makes it a more reliable measure.
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
                    <p className="text-sm text-theme-text font-medium mb-2">Do not write anything down</p>
                    <p className="text-xs text-theme-text-secondary">
                        The task measures memory, not note-taking. Writing digits down invalidates the results.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Practice comes first</p>
                    <p className="text-xs text-theme-text-secondary">
                        Each block starts with two short unscored practice rounds with detailed feedback,
                        so the rules are clear before scoring begins.
                        Already familiar with the task? On scored sessions, a skip option appears during practice.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Find a quiet moment</p>
                    <p className="text-xs text-theme-text-secondary">
                        The session cannot be paused. Allow about 10&ndash;15 minutes of uninterrupted focus,
                        and keep this tab in the foreground while digits are on screen.
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

const DigitSpanInstructions = ({ onComplete }) => {
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

DigitSpanInstructions.propTypes = {
    onComplete: PropTypes.func.isRequired,
};

export default DigitSpanInstructions;

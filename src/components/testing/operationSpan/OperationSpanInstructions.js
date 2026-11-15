/* src/components/testing/operationSpan/OperationSpanInstructions.js */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
    faArrowLeft,
    faSuperscript,
    faCheckCircle,
    faExclamationTriangle,
    faBrain,
} from '@fortawesome/free-solid-svg-icons';
import { OSPAN_DEFAULTS } from '../../../constants/ospanConstants';

const STEPS = [
    {
        title: 'What is Operation Span?',
        icon: faBrain,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    The Operation Span (OSPAN) task is a gold-standard assessment of working memory capacity used in cognitive science research since 1989.
                </p>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    You will alternate between solving simple math equations and remembering letters. After each set of math-letter pairs, you will recall the letters in the order they appeared.
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-xs font-mono text-theme-accent uppercase tracking-wider mb-2">Key Facts</p>
                    <ul className="text-sm text-theme-text-secondary space-y-1">
                        <li>15 sets with 3 to 7 math-letter pairs each</li>
                        <li>Maximum score: 75 points</li>
                        <li>Familiarization: ~5 min &middot; Monthly assessment: ~20 min</li>
                        <li>Your math speed is individually calibrated</li>
                    </ul>
                </div>
            </div>
        ),
    },
    {
        title: 'Step 1: Solve the Math',
        icon: faSuperscript,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    A math equation will appear on screen. Solve it in your head, then press the button when you have the answer ready.
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-6 text-center">
                    <p className="text-3xl font-mono text-theme-text mb-3">(7 &times; 3) &minus; 4 = ?</p>
                    <div className="inline-block px-6 py-2 border-2 border-theme-accent text-theme-accent font-mono text-sm uppercase tracking-wider">
                        I solved it
                    </div>
                </div>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    After pressing, a proposed answer will appear. You must judge whether it is <strong>True</strong> or <strong>False</strong>.
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-6 text-center">
                    <p className="text-2xl font-mono text-theme-text mb-3">(7 &times; 3) &minus; 4 = 17</p>
                    <div className="flex gap-4 justify-center">
                        <span className="px-6 py-2 border border-status-success text-status-success font-mono text-sm uppercase">True</span>
                        <span className="px-6 py-2 border border-status-error text-status-error font-mono text-sm uppercase">False</span>
                    </div>
                </div>
                <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-3">
                    <p className="text-xs text-theme-text-secondary">
                        <span className="text-theme-accent font-semibold uppercase text-xs tracking-wider">Note:</span> The math must be solved within your personal time limit. If you run out of time, it will count as an error and the task will advance automatically.
                    </p>
                </div>
            </div>
        ),
    },
    {
        title: 'Step 2: Remember the Letter',
        icon: faBrain,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    After each math problem, a single letter will appear briefly on screen. Try to remember it.
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-8 text-center">
                    <p className="text-7xl font-mono font-bold text-theme-accent">F</p>
                    <p className="text-xs font-mono text-theme-text-muted mt-4 uppercase tracking-wider">Displayed for 800ms</p>
                </div>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Letters are drawn from a pool of 12 consonants: <span className="font-mono text-theme-accent">{OSPAN_DEFAULTS.LETTER_POOL.join(', ')}</span>
                </p>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    This math-then-letter sequence repeats for each item in the set. A set of size 5 means 5 math problems and 5 letters to remember.
                </p>
            </div>
        ),
    },
    {
        title: 'Step 3: Recall the Letters',
        icon: faCheckCircle,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    After all items in a set, a grid of all 12 letters will appear. Click the letters in the order they were shown.
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <div className="grid grid-cols-4 gap-1 max-w-xs mx-auto mb-3">
                        {OSPAN_DEFAULTS.LETTER_POOL.map(l => (
                            <div key={l} className="py-2 px-1 text-center font-mono text-sm border border-theme-line bg-theme-bg-secondary text-theme-text">
                                {l}
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-center font-mono text-theme-text-muted">Click letters in the order you remember them</p>
                </div>
                <div className="space-y-2">
                    <p className="text-sm text-theme-text-secondary leading-relaxed">
                        <strong>Blank:</strong> If you forgot a letter at a specific position, press Blank to preserve the order of the other letters.
                    </p>
                    <p className="text-sm text-theme-text-secondary leading-relaxed">
                        <strong>Clear:</strong> Resets your entire recall sequence so you can start over.
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
                <div className="bg-status-error/10 border border-status-error/30 p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Do not write anything down</p>
                    <p className="text-xs text-theme-text-secondary">
                        The task measures your working memory. Writing down letters defeats the purpose and invalidates your results.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Maintain math accuracy above 85%</p>
                    <p className="text-xs text-theme-text-secondary">
                        Your cumulative math accuracy is displayed after each set. If you ignore the math to focus only on letters, your results won't be valid. Both tasks matter.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Practice phases come first</p>
                    <p className="text-xs text-theme-text-secondary">
                        Before the scored assessment, you'll complete three practice rounds: letter recall only, math calibration (to set your personal time limit), and a combined practice. These help you learn the task and are not scored. Already familiar with the task? On scored sessions, a skip option appears during practice.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Work at a steady pace</p>
                    <p className="text-xs text-theme-text-secondary">
                        Don't rush through the math, but don't deliberately slow down either. Your practice speed determines your deadline for the real test.
                    </p>
                </div>
            </div>
        ),
    },
];

const OperationSpanInstructions = ({ onComplete }) => {
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

OperationSpanInstructions.propTypes = {
    onComplete: PropTypes.func.isRequired,
};

export default OperationSpanInstructions;

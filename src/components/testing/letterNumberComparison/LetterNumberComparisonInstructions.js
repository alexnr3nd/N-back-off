/* src/components/testing/letterNumberComparison/LetterNumberComparisonInstructions.js */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
    faArrowLeft,
    faCheckCircle,
    faBrain,
    faCodeCompare,
    faStopwatch,
    faListCheck,
} from '@fortawesome/free-solid-svg-icons';

// A static example pair rendered with the same stacked monospace treatment as
// the real StringPairDisplay. `diffIndex` (when set) accents the one differing
// character in the bottom string.
const MockPair = ({ a, b, diffIndex = null }) => (
    <div className="flex flex-col items-center select-none" aria-hidden="true">
        <div className="font-mono tracking-widest text-2xl sm:text-3xl text-theme-text py-1">{a}</div>
        <div className="w-24 border-t border-theme-line my-1" />
        <div className="font-mono tracking-widest text-2xl sm:text-3xl text-theme-text py-1">
            {diffIndex === null ? b : (
                <>
                    {b.slice(0, diffIndex)}
                    <span className="text-theme-accent font-bold">{b.slice(diffIndex, diffIndex + 1)}</span>
                    {b.slice(diffIndex + 1)}
                </>
            )}
        </div>
    </div>
);
MockPair.propTypes = {
    a: PropTypes.string.isRequired,
    b: PropTypes.string.isRequired,
    diffIndex: PropTypes.number,
};

const Verdict = ({ label, tone }) => (
    <span className={`mt-3 inline-block px-3 py-1 text-xs font-mono uppercase tracking-wider border ${
        tone === 'same'
            ? 'border-status-success text-status-success'
            : 'border-theme-accent text-theme-accent'
    }`}>
        {label}
    </span>
);
Verdict.propTypes = {
    label: PropTypes.string.isRequired,
    tone: PropTypes.oneOf(['same', 'different']).isRequired,
};

const STEPS = [
    {
        title: 'What is Letter & Number Comparison?',
        icon: faBrain,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    This assessment measures <strong>perceptual speed</strong> — how quickly
                    simple visual comparisons can be made accurately. It is the classic
                    letter and number comparison task from the cognitive-aging literature
                    (Salthouse &amp; Babcock, 1991).
                </p>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    On each item, two short strings appear — one above the other, separated
                    by a line:
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-4 flex justify-center">
                    <MockPair a="BQK" b="BQK" />
                </div>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    The only question: are the two strings exactly the same, or do they
                    differ?
                </p>
            </div>
        ),
    },
    {
        title: 'Same or Different?',
        icon: faCodeCompare,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Tap <strong>SAME</strong> if the two strings match exactly. Tap{' '}
                    <strong>DIFFERENT</strong> if they differ — a "different" pair always
                    differs in exactly one character.
                </p>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-theme-bg-elevated border border-theme-line p-4 flex flex-col items-center">
                        <MockPair a="BQK" b="BQK" />
                        <Verdict label="Same" tone="same" />
                    </div>
                    <div className="bg-theme-bg-elevated border border-theme-line p-4 flex flex-col items-center">
                        <MockPair a="BQK" b="BQX" diffIndex={2} />
                        <Verdict label="Different" tone="different" />
                    </div>
                </div>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Strings come in three lengths (3, 6, or 9 characters), as letters or as
                    digits. Half are the same and half are different.
                </p>
            </div>
        ),
    },
    {
        title: 'Beat the Clock',
        icon: faStopwatch,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Each block lasts <strong>30 seconds</strong>. Judge as many pairs as you
                    can before time runs out — the next pair appears the instant you answer.
                    There is no per-item timer; the only clock is the 30-second block clock.
                </p>
                <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-3">
                    <p className="text-xs text-theme-text-secondary">
                        <span className="text-theme-accent font-semibold uppercase text-xs tracking-wider">Accuracy counts:</span>{' '}
                        a wrong answer subtracts from the total, so one wrong answer costs more
                        than one slow answer. If overall accuracy falls below 75%, the score is
                        flagged. Go fast, but only as fast as you can stay accurate.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-xs font-mono text-theme-accent uppercase tracking-wider mb-2">Responding</p>
                    <ul className="text-sm text-theme-text-secondary space-y-1">
                        <li>Tap SAME or DIFFERENT (or press S / D on a keyboard)</li>
                        <li>Keep the app visible — a block cannot be paused once it starts</li>
                    </ul>
                </div>
            </div>
        ),
    },
    {
        title: 'How a Session Runs',
        icon: faListCheck,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    A full session is four 30-second blocks — two with letters, two with
                    numbers — with short practice before each task and a self-paced break
                    between same-task blocks:
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <ol className="text-sm text-theme-text-secondary space-y-1 list-decimal list-inside">
                        <li>Letter practice (5 items, with feedback)</li>
                        <li>Letter Block 1 &middot; break &middot; Letter Block 2</li>
                        <li>Number practice (5 items, with feedback)</li>
                        <li>Number Block 1 &middot; break &middot; Number Block 2</li>
                    </ol>
                </div>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    The whole thing takes about 5 minutes. Your first run-through is a{' '}
                    <strong>familiarization session</strong> — recorded, but excluded from
                    the trend chart. After that, one scored assessment per month keeps the
                    trend reliable.
                </p>
            </div>
        ),
    },
];

const LetterNumberComparisonInstructions = ({ onComplete }) => {
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

LetterNumberComparisonInstructions.propTypes = {
    onComplete: PropTypes.func.isRequired,
};

export default LetterNumberComparisonInstructions;

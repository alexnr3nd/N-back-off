/* src/components/testing/faceNameMemory/FaceNameMemoryInstructions.js */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
    faArrowLeft,
    faCheckCircle,
    faExclamationTriangle,
    faBrain,
    faAddressCard,
    faCalculator,
    faHandPointer,
    faVolumeHigh,
} from '@fortawesome/free-solid-svg-icons';

// Static example graphics that echo the look of the real task without pulling
// in any face assets. A simple silhouette stands in for the study face.
const MockFace = ({ name, speaker = false }) => (
    <div
        className="flex flex-col items-center gap-2 select-none"
        aria-hidden="true"
    >
        <div className="h-20 w-20 rounded-md bg-theme-bg-base border border-theme-line flex items-center justify-center">
            <FontAwesomeIcon icon={faAddressCard} className="text-theme-text-muted h-9 w-9" />
        </div>
        {name && (
            <span className="text-base font-mono font-semibold tracking-wide text-theme-text">
                {name}
            </span>
        )}
        {speaker && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-theme-accent uppercase tracking-wider">
                <FontAwesomeIcon icon={faVolumeHigh} className="h-3 w-3" /> name spoken
            </span>
        )}
    </div>
);
MockFace.propTypes = { name: PropTypes.string, speaker: PropTypes.bool };

const MockNamePill = ({ label, highlight = false }) => (
    <div
        aria-hidden="true"
        className={`px-3 py-2 text-sm font-mono text-center border ${
            highlight
                ? 'border-theme-accent text-theme-accent bg-theme-accent/10'
                : 'border-theme-line text-theme-text-secondary bg-theme-bg-base'
        }`}
    >
        {label}
    </div>
);
MockNamePill.propTypes = {
    label: PropTypes.string.isRequired,
    highlight: PropTypes.bool,
};

const STEPS = [
    {
        title: 'What is Face-Name Memory?',
        icon: faBrain,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Face-Name Memory measures <strong>associative memory</strong>: the ability to
                    bind two pieces of information together and recall one when shown the other.
                    Putting a name to a face is an everyday example of that ability.
                </p>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    First you study a set of face-and-name pairs. Then, after a short break, each
                    face comes back on its own and the task is to recall the name that went with it.
                </p>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-xs font-mono text-theme-accent uppercase tracking-wider mb-2">Key Facts</p>
                    <ul className="text-sm text-theme-text-secondary space-y-1">
                        <li>Each name is spoken aloud as you study the face (shown twice)</li>
                        <li>A short timed arithmetic break in the middle</li>
                        <li>Recall the name by tapping it from a grid</li>
                        <li>Tested right away, then again after the break</li>
                    </ul>
                </div>
            </div>
        ),
    },
    {
        title: 'Step 1: Study the Pairs',
        icon: faAddressCard,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Each face appears and its name is <strong>spoken aloud</strong> — the name is not
                    shown as text. Listen and link the sound of the name to the face. Every pair is
                    shown <strong>twice</strong>, so there is a second chance to lock in the ones that
                    did not stick.
                </p>
                <div className="bg-theme-bg-base border border-theme-line p-6 flex items-center justify-center">
                    <MockFace speaker />
                </div>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Tap the speaker to replay a name. There is nothing to answer yet during study, and
                    each face stays for a fixed time — there is no skipping ahead.
                </p>
            </div>
        ),
    },
    {
        title: 'Step 2: The Arithmetic Break',
        icon: faCalculator,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    After studying, a short <strong>timed arithmetic break</strong> fills a brief
                    delay. Solving a few quick sums keeps the names from being rehearsed in the
                    moment, so the second test reflects what was actually remembered.
                </p>
                <div className="bg-theme-bg-base border border-theme-line p-6 flex items-center justify-center">
                    <span className="text-3xl font-mono font-bold tracking-wider text-theme-text">
                        7 + 6 = ?
                    </span>
                </div>
                <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-3">
                    <p className="text-xs text-theme-text-secondary">
                        <span className="text-theme-accent font-semibold uppercase text-xs tracking-wider">Note:</span> The
                        arithmetic itself is not scored. It is only there to fill the delay between
                        the two name tests.
                    </p>
                </div>
            </div>
        ),
    },
    {
        title: 'Step 3: Recall the Names',
        icon: faHandPointer,
        content: (
            <div className="space-y-4">
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Each studied face comes back on its own, and a grid of names appears below it.
                    <strong> Tap the name</strong> that went with the face. This happens once right
                    away, and once more after the arithmetic break.
                </p>
                <div className="bg-theme-bg-base border border-theme-line p-6 flex flex-col items-center gap-4">
                    <MockFace />
                    <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
                        <MockNamePill label="Marcus" />
                        <MockNamePill label="Hannah" highlight />
                        <MockNamePill label="Diego" />
                        <MockNamePill label="Priya" />
                        <MockNamePill label="Owen" />
                        <MockNamePill label="Leah" />
                    </div>
                </div>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    The grid only contains names that were <strong>actually studied</strong> — so the
                    right name is always there. The work is remembering which name went with which
                    face, not recognising whether a name is familiar.
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
                        There is no rush on the name grid — take a moment and tap the name that
                        actually fits the face. Make a best guess when unsure; that is part of the
                        measure.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Two tests per session</p>
                    <p className="text-xs text-theme-text-secondary">
                        The headline result is how many names are recalled <strong>after the break</strong>.
                        The immediate test right after study is recorded too, and the change between
                        the two shows how well the pairs held up over the short delay.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">Find a quiet moment</p>
                    <p className="text-xs text-theme-text-secondary">
                        The session runs straight through — study, break, then the two name tests. It
                        cannot be paused once it starts, so set aside a few uninterrupted minutes.
                    </p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-4">
                    <p className="text-sm text-theme-text font-medium mb-2">First session is familiarization</p>
                    <p className="text-xs text-theme-text-secondary">
                        The first run-through is a familiarization session: identical to the real
                        assessment, but excluded from the trend chart. After that, one scored
                        assessment per month keeps the trend reliable.
                    </p>
                </div>
            </div>
        ),
    },
];

const FaceNameMemoryInstructions = ({ onComplete }) => {
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

FaceNameMemoryInstructions.propTypes = {
    onComplete: PropTypes.func.isRequired,
};

export default FaceNameMemoryInstructions;

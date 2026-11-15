/* src/components/testing/digitSpan/trainer/DigitSpanTrainerPanel.js */
/**
 * Digit Span Trainer landing panel. Adds a Forward/Backward sub-toggle (the two
 * directions are SEPARATE adaptive ladders — different constructs) above the
 * shared generic TrainerPanel chassis, passing a direction-keyed config so the
 * chassis re-fetches that ladder's progress/chart/sessions.
 */
import React, { useState, useMemo } from 'react';
import TrainerPanel from '../../trainer/TrainerPanel';
import { DIGIT_SPAN_BLOCKS, boundsFor, formatSpan } from '../../../../constants/digitSpanTrainerConstants';

const DIRECTIONS = [
    { key: DIGIT_SPAN_BLOCKS.FORWARD, label: 'Forward' },
    { key: DIGIT_SPAN_BLOCKS.BACKWARD, label: 'Backward' },
];

const FAQS_BASE = [
    {
        q: 'What is the Digit Span Trainer?',
        a: 'Adaptive practice of digit span in short sessions. Digits flash one per second; you recall the sequence in order (Forward) or in reverse (Backward). The span — how many digits — adjusts to keep you near your edge (around 75–80% correct).',
    },
    {
        q: 'Why are Forward and Backward separate?',
        a: 'Forward recall is a measure of verbal short-term storage; Backward recall also requires holding and reversing the sequence, which recruits more attention control. They are tracked as separate spans because backward is typically one to two digits shorter.',
    },
    {
        q: 'How does the Span work?',
        a: 'A single span length set by an adaptive staircase: two correct lists in a row lengthen the next list by one digit, and any miss shortens it. Your span carries over between sessions for each direction, so you resume where you left off.',
    },
    {
        q: 'Will training change my monthly Assessment score?',
        a: 'Yes. Because it is the same task, practicing here raises your Digit Span Assessment scores through practice — so the Assessment then reflects trained skill rather than an untrained baseline. If you want the Assessment to track a clean baseline, keep practice separate from it.',
    },
    {
        q: 'Does this improve my memory in general?',
        a: 'Research has not shown that it does, so it should not be counted on for that. What practice reliably improves is digit span and closely similar digit-recall tasks; whether that carries over to general memory, focus, or other thinking has not been demonstrated either way. Treat it as a specific skill to sharpen and track. It is not a medical or diagnostic tool and does not detect, screen for, prevent, or treat any condition.',
    },
];

const DigitSpanTrainerPanel = () => {
    const [direction, setDirection] = useState(DIGIT_SPAN_BLOCKS.FORWARD);
    const isBackward = direction === DIGIT_SPAN_BLOCKS.BACKWARD;
    const dirLabel = isBackward ? 'Backward' : 'Forward';

    const config = useMemo(() => ({
        title: 'Digit Span Trainer',
        subtitle: `${dirLabel} · Adaptive Practice`,
        faqSubtitle: 'Digit Span Trainer',
        description: isBackward
            ? 'Short sessions of digits flashed one per second. Recall each sequence in REVERSE order. The span adjusts to keep the challenge near your edge.'
            : 'Short sessions of digits flashed one per second. Recall each sequence in the SAME order. The span adjusts to keep the challenge near your edge.',
        footnote:
            'Digit span is a research measure of verbal short-term memory. This Trainer is a way to practice that same task. Practicing improves your digit-span recall and similar digit-recall tasks; studies have not shown it improves general memory, focus, or thinking. And since it is the same task as the Assessment, practicing here raises your Assessment scores through practice, so the monthly Assessment then reflects trained skill rather than an untrained baseline.',
        levelLabel: 'Span',
        levelTag: 'Span ',
        maxLevel: boundsFor(direction).MAX_SPAN,
        showMaxBadge: true,
        formatLevel: formatSpan,
        progressFnName: 'getDigitSpanTrainerProgress',
        progressData: { direction },
        fetchKey: `digitSpan_${direction}`,
        startRoute: '/testing/digit-span/train',
        startNavState: { autoStart: true, direction },
        locked: {
            title: 'Digit Span Trainer',
            body: 'Adaptive digit-span practice is a Pro feature. It tunes the span to keep you near your edge across short, repeatable sessions.',
            upgradeRoute: '/testing/digit-span?showUpgrade=true',
        },
        faqs: FAQS_BASE,
    }), [direction, isBackward, dirLabel]);

    return (
        <div>
            <div className="flex mb-6" role="group" aria-label="Recall direction">
                {DIRECTIONS.map((opt, i) => (
                    <button
                        key={opt.key}
                        type="button"
                        onClick={() => setDirection(opt.key)}
                        aria-pressed={direction === opt.key}
                        className={`px-4 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors ${i === 0 ? '' : 'border-l-0'} ${direction === opt.key ? 'bg-theme-accent/20 text-theme-accent border-theme-accent/50' : 'border-theme-line text-theme-text-muted hover:text-theme-text hover:border-theme-accent/50'}`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
            <TrainerPanel config={config} />
        </div>
    );
};

export default DigitSpanTrainerPanel;

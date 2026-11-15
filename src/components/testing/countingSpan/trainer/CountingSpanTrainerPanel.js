/* src/components/testing/countingSpan/trainer/CountingSpanTrainerPanel.js */
/**
 * Counting Span Trainer landing panel — a thin per-task config wrapper around
 * the shared generic TrainerPanel chassis (Set Size noun, single ladder, no
 * sub-modes). Pro-gated: `requiresPro` is deliberately omitted so the chassis
 * default (true) applies, matching the Pro Counting Span assessment.
 */
import React, { useMemo } from 'react';
import TrainerPanel from '../../trainer/TrainerPanel';
import { CST_TRAINER, formatSetSize } from '../../../../constants/countingSpanTrainerConstants';

const FAQS = [
    {
        q: 'What is the Counting Span Trainer?',
        a: 'Adaptive practice of the counting span task in short sessions. Each set shows a series of cards: count the blue circles among the green circles and blue squares, answer odd or even, and after the last card recall every count in order. The set size — how many cards per set — adjusts to keep you near your edge.',
    },
    {
        q: 'How does the Set Size work?',
        a: 'A single set size driven by an adaptive staircase: two correct sets in a row add one card to the next set, and any missed set removes one. A set counts as correct only when every count is recalled in its exact position and at least 75% of its odd-or-even answers are right. Your set size carries over between sessions, so you resume where you left off.',
    },
    {
        q: 'Why do the odd-or-even answers matter?',
        a: 'Counting each card is what makes counting span a working memory task rather than simple memorization: the count has to be worked out before it can be stored. The odd-or-even answer confirms each card was actually counted, and a card that runs past its 10-second limit counts as a wrong answer. A set cannot count as correct below 75% odd-or-even accuracy, so recall cannot be improved by skipping the counting.',
    },
    {
        q: 'Will training change my monthly Assessment score?',
        a: 'Yes. Because it is the same task, practicing here raises your Counting Span Assessment scores through practice — so the Assessment then reflects trained skill rather than an untrained baseline. If you want the Assessment to track a clean baseline, keep practice separate from it.',
    },
    {
        q: 'Does this improve my memory in general?',
        a: 'Research has not shown that it does, so it should not be counted on for that. What practice reliably improves is counting span and closely similar span tasks; whether that carries over to general memory, focus, or other thinking has not been demonstrated either way. Treat it as a specific skill to sharpen and track. It is not a medical or diagnostic tool and does not detect, screen for, prevent, or treat any condition.',
    },
];

const CountingSpanTrainerPanel = () => {
    const config = useMemo(() => ({
        title: 'Counting Span Trainer',
        subtitle: 'Adaptive Practice',
        faqSubtitle: 'Counting Span Trainer',
        description: 'Short sessions of the same count-and-remember task as the Assessment. Count the blue circles on each card, answer odd or even, then recall every count in order. The set size adjusts to keep the challenge near your edge.',
        footnote:
            'Counting span is a research measure of working memory: holding a series of counts in order while counting the next card. This Trainer is a way to practice that same task. Practicing improves your performance on this task and structurally similar span tasks; studies have not shown it improves general memory, focus, or thinking. And since it is the same task as the Assessment, practicing here raises your Assessment scores through practice, so the monthly Assessment then reflects trained skill rather than an untrained baseline.',
        levelLabel: 'Set Size',
        levelTag: 'Size ',
        maxLevel: CST_TRAINER.MAX_SET_SIZE,
        showMaxBadge: true,
        formatLevel: formatSetSize,
        progressFnName: 'getCountingSpanTrainerProgress',
        progressData: {},
        fetchKey: 'countingSpan',
        startRoute: '/testing/counting-span/train',
        startNavState: { autoStart: true },
        // requiresPro intentionally omitted -> chassis default (true).
        locked: {
            title: 'Counting Span Trainer',
            body: 'Adaptive counting-span practice is a Pro feature. It tunes the set size to keep you near your edge across short, repeatable sessions.',
            upgradeRoute: '/testing/counting-span?showUpgrade=true',
        },
        faqs: FAQS,
    }), []);

    return <TrainerPanel config={config} />;
};

export default CountingSpanTrainerPanel;

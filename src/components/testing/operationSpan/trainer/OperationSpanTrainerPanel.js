/* src/components/testing/operationSpan/trainer/OperationSpanTrainerPanel.js */
/**
 * Operation Span Trainer landing panel — a thin per-task config wrapper around
 * the shared generic TrainerPanel chassis (Set Size noun, single ladder, no
 * sub-modes). FREE for all users (requiresPro: false) — the Operation Span
 * assessment is free, so its trainer is too.
 */
import React, { useMemo } from 'react';
import TrainerPanel from '../../trainer/TrainerPanel';
import { OSPAN_TRAINER, formatSetSize } from '../../../../constants/ospanTrainerConstants';

const FAQS = [
    {
        q: 'What is the Operation Span Trainer?',
        a: 'Adaptive practice of the operation span task in short sessions. Each set interleaves simple equations with letters: solve the equation, remember the letter, and after the last pair recall the letters in order. The set size — how many equation-letter pairs — adjusts to keep you near your edge.',
    },
    {
        q: 'How does the Set Size work?',
        a: 'A single set size driven by an adaptive staircase: two correct sets in a row lengthen the next set by one letter, and any missed set shortens it by one. A set counts as correct only when every letter is recalled in its exact position and at least 75% of its equations are answered correctly. Your set size carries over between sessions, so you resume where you left off.',
    },
    {
        q: 'Why does the math matter?',
        a: 'The equations are what make operation span a working memory task rather than simple memorization — they interrupt rehearsal between letters. A set cannot count as correct when its equations fall below 75% accuracy, so recall cannot be improved by skipping the math. Aiming above 85% math accuracy, the standard used in research versions of this task, keeps practice honest.',
    },
    {
        q: 'Where does the math time limit come from?',
        a: 'The time limit is calibrated from the math practice block of the Operation Span Assessment: average solving speed plus a margin, so it discourages rehearsing letters during the math without rushing anyone. Completing the Assessment once (including its practice block) sets a personalized limit; until then a generous 10-second default applies.',
    },
    {
        q: 'Will training change my monthly Assessment score?',
        a: 'Yes. Because it is the same task, practicing here raises your Operation Span Assessment scores through practice — so the Assessment then reflects trained skill rather than an untrained baseline. If you want the Assessment to track a clean baseline, keep practice separate from it.',
    },
    {
        q: 'Does this improve my memory in general?',
        a: 'Research has not shown that it does, so it should not be counted on for that. What practice reliably improves is operation span and closely similar span tasks; whether that carries over to general memory, focus, or other thinking has not been demonstrated either way. Treat it as a specific skill to sharpen and track. It is not a medical or diagnostic tool and does not detect, screen for, prevent, or treat any condition.',
    },
];

const OperationSpanTrainerPanel = () => {
    const config = useMemo(() => ({
        title: 'Operation Span Trainer',
        subtitle: 'Adaptive Practice',
        faqSubtitle: 'Operation Span Trainer',
        description: 'Short sessions of the same equation-and-letter task as the Assessment. Solve each equation, remember each letter, then recall the set in order. The set size adjusts to keep the challenge near your edge.',
        footnote:
            'Operation span is a research measure of working memory: holding items in order while doing something else. This Trainer is a way to practice that same task. Practicing improves your performance on this task and structurally similar span tasks; studies have not shown it improves general memory, focus, or thinking. And since it is the same task as the Assessment, practicing here raises your Assessment scores through practice, so the monthly Assessment then reflects trained skill rather than an untrained baseline.',
        levelLabel: 'Set Size',
        levelTag: 'Size ',
        maxLevel: OSPAN_TRAINER.MAX_SET_SIZE,
        showMaxBadge: true,
        formatLevel: formatSetSize,
        progressFnName: 'getOspanTrainerProgress',
        progressData: {},
        fetchKey: 'operationSpan',
        startRoute: '/testing/operation-span/train',
        startNavState: { autoStart: true },
        requiresPro: false,
        faqs: FAQS,
    }), []);

    return <TrainerPanel config={config} />;
};

export default OperationSpanTrainerPanel;

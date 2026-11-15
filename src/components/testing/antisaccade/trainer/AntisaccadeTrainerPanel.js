/* src/components/testing/antisaccade/trainer/AntisaccadeTrainerPanel.js */
/**
 * Antisaccade Trainer landing panel — a thin config wrapper around the shared
 * generic TrainerPanel chassis. All layout/fetch/chart/recent-sessions logic
 * lives in the chassis; this file supplies only the antisaccade copy, level
 * formatting, callable name, start route and FAQ.
 */
import React, { useMemo } from 'react';
import TrainerPanel from '../../trainer/TrainerPanel';
import { unlockAudio } from '../hooks/antisaccadeHelpers';
import { MAX_LEVEL } from '../../../../constants/antisaccadeTrainerConstants';

const FAQS = [
    {
        q: 'What is the Antisaccade Trainer?',
        a: 'Adaptive practice of the antisaccade task in short sessions of about a minute. When the asterisk flashes, you look the opposite way and identify the briefly-flashed letter. Difficulty adjusts up and down to keep you near your edge (around 80% accuracy).',
    },
    {
        q: 'Is this the same as the Antisaccade assessment?',
        a: 'It is the same task. The Assessment is a periodic, fixed-difficulty measurement you take about once a month to see where you stand against research norms. The Trainer is the same task made adaptive and repeatable, for practice rather than measurement.',
    },
    {
        q: 'How does the Level work?',
        a: 'A single rising Level (1–26) set by an adaptive staircase: three correct answers in a row make the next trial harder, and any miss makes it easier, aiming for roughly 80% accuracy. Your Level carries over between sessions, so you resume where you left off.',
    },
    {
        q: 'Will training change my monthly Assessment score?',
        a: 'Yes. Because it is the same task, practicing here raises your Assessment scores through practice — so the Assessment will then reflect trained skill rather than an untrained baseline. If you want the Assessment to track a clean baseline, keep practice separate from it.',
    },
];

const AntisaccadeTrainerPanel = () => {
    const config = useMemo(() => ({
        title: 'Antisaccade Trainer',
        subtitle: 'Adaptive Practice',
        faqSubtitle: 'Antisaccade Trainer',
        description:
            'Short sessions of about a minute: when the asterisk flashes, look the other way and catch the briefly-flashed letter. Difficulty adjusts to keep the challenge near your edge.',
        footnote:
            'The antisaccade task is normally an assessment: a research measure of attention and impulse control. This Trainer is an experimental way to practice that same task. Studies have not yet shown that training it improves general focus or thinking, so treat it as a skill to sharpen and track. And since it is the same task as the Assessment, practicing here will raise your Assessment scores through practice, so the monthly Assessment then reflects trained skill rather than an untrained baseline.',
        levelLabel: 'Level',
        levelTag: 'L',
        maxLevel: MAX_LEVEL,
        showMaxBadge: true,
        formatLevel: (n) => `Level ${n}`,
        progressFnName: 'getAntisaccadeTrainerProgress',
        progressData: {},
        fetchKey: 'antisaccade',
        startRoute: '/testing/antisaccade/train',
        startNavState: { autoStart: true },
        beforeStart: unlockAudio,
        locked: {
            title: 'Antisaccade Trainer',
            body: 'Adaptive antisaccade practice is a Pro feature. It tunes difficulty to keep you near your edge across short, repeatable sessions.',
            upgradeRoute: '/testing/antisaccade?showUpgrade=true',
        },
        faqs: FAQS,
    }), []);

    return <TrainerPanel config={config} />;
};

export default AntisaccadeTrainerPanel;

/* src/components/testing/faceNameMemory/trainer/FaceNameMemoryTrainerPanel.js */
/**
 * Face-Name Memory Trainer landing panel. Thin wrapper that hands a task-specific config
 * to the shared generic TrainerPanel chassis (which owns the Pro-gate / locked card,
 * progress fetch, chart, recent sessions, and FAQ). No sub-toggle (single set-size
 * ladder). HIGHEST-framing-risk trainer in the suite: copy is strictly task-specific —
 * no memory / IQ / clinical / real-world-names / "scientifically proven" claims.
 * (Owner copy-review gate before soft-launch.)
 */
import React, { useMemo } from 'react';
import TrainerPanel from '../../trainer/TrainerPanel';
import { FACE_NAME_TRAINER as T, formatSetSize } from '../../../../constants/faceNameMemoryTrainerConstants';
import { faAddressCard } from '@fortawesome/free-solid-svg-icons';

const FAQS = [
    {
        q: 'What is the Face-Name Memory Trainer?',
        a: 'Adaptive practice at learning face-and-name pairs. You study a set of faces, each with a spoken name, then recall those names in a later session. The number of faces adjusts to keep you near your edge (around 70-80% recalled).',
    },
    {
        q: 'Why do I recall before I study?',
        a: 'The faces you recall are the ones you studied last session. Recalling them after the gap between sessions, rather than right away, is the point: it is practice at retrieving a learned pair after a delay. After recalling, you study a fresh set for next time.',
    },
    {
        q: 'Why is the name spoken instead of shown?',
        a: 'During study the name is heard, not read, so you link the sound of the name to the face. Tap the speaker to replay it.',
    },
    {
        q: 'How does the set size work?',
        a: 'A single number set by an adaptive staircase: recall most of a set and the next set grows by one face; recall few and it shrinks. Your set size carries over between sessions, so you resume where you left off.',
    },
    {
        q: 'Will training change my Face-Name Memory Assessment score?',
        a: 'Yes. Because it is the same task, practicing here raises your Face-Name Memory Assessment scores through practice, so the Assessment then reflects trained skill rather than an untrained baseline. To keep the Assessment as a clean baseline, keep practice separate from it.',
    },
    {
        q: 'Does this improve my memory in everyday life?',
        a: 'Research has not shown that it does, so it should not be counted on for that. What practice reliably improves is how well you do this face-name task and closely similar tasks; whether that carries over to remembering people you meet, or to general memory, has not been demonstrated either way. Treat it as practice at a specific skill. It is not a medical or diagnostic tool and does not detect, screen for, prevent, or treat any condition.',
    },
];

const FaceNameMemoryTrainerPanel = () => {
    const config = useMemo(() => ({
        title: 'Face-Name Memory Trainer',
        subtitle: 'Adaptive Practice',
        faqSubtitle: 'Face-Name Memory Trainer',
        description: 'Study a set of faces with their spoken names, then recall them in a later session. The number of faces adjusts to keep the challenge near your edge.',
        footnote:
            "This is task-specific practice: it improves how well you recall faces and names in this exercise. It is not known to carry over to remembering the names of people you meet in everyday life. It is not a medical or diagnostic tool, does not detect or screen for any condition, and is not claimed to prevent, delay, treat, or reduce the risk of memory loss, dementia, Alzheimer's disease, or any age-related cognitive change.",
        levelLabel: 'Set',
        levelTag: 'Set ',
        maxLevel: T.MAX_SET,
        showMaxBadge: true,
        formatLevel: formatSetSize,
        icon: faAddressCard,
        progressFnName: 'getFaceNameMemoryTrainerProgress',
        progressData: {},
        fetchKey: 'faceNameMemory',
        startRoute: '/testing/face-name-memory/train',
        startNavState: { autoStart: true },
        locked: {
            title: 'Face-Name Memory Trainer',
            body: 'Adaptive face-name practice is a Pro feature. It tunes the number of faces to keep you near your edge across short, repeatable sessions.',
            upgradeRoute: '/testing/face-name-memory?showUpgrade=true',
        },
        faqs: FAQS,
    }), []);

    return <TrainerPanel config={config} />;
};

export default FaceNameMemoryTrainerPanel;

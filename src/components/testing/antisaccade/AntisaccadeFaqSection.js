/* src/components/testing/antisaccade/AntisaccadeFaqSection.js */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

const FAQS = [
    {
        q: 'What does this assessment measure?',
        a: 'Antisaccade measures attention control: the ability to suppress a reflexive glance toward a flash and deliberately look the opposite way. In large individual-differences studies (Draheim et al. 2021, 2023), antisaccade performance was among the strongest single predictors connecting working memory and fluid intelligence — in those studies, attention control fully explained the link between the two.',
    },
    {
        q: 'Why is there no eye tracker?',
        a: 'The classic laboratory version tracks eye movements directly. The modern accuracy-based version used in large individual-differences studies replaces the tracker with a briefly flashed, immediately masked letter: the letter can only be identified if attention moved away from the flash in time, so letter accuracy serves as the measure of inhibition. Because the mask — not the exact moment the letter disappears — ends processing, the task works reliably in a browser.',
    },
    {
        q: 'Why is it so fast and so hard?',
        a: 'The letter appears for about a tenth of a second on the side opposite the flash, then a mask covers it. Catching it requires resisting the reflexive pull of the flash, and that pull is automatic for everyone. Missing many letters is completely normal; with two response options, pure guessing already lands at 50%.',
    },
    {
        q: 'Why do scores improve with repeated attempts?',
        a: 'Task-specific practice. Antisaccade accuracy rises with familiarity regardless of any training, so a higher score on a later attempt is not the same as improved attention control transferring from n-back training — meta-analyses find that transfer to cognitive control measures is small. Treat results as periodic snapshots of attention control, not as a training-effectiveness meter.',
    },
    {
        q: 'How does the percentile work?',
        a: 'Scores are compared against published research norms: combined samples of roughly 700 young adults from the 2021 and 2023 toolbox studies, with a mean around 80% accuracy and most scores clustered high. Because the test has a ceiling, top scores display as ">95th" rather than an exact figure. The norms come from young-adult lab samples, so older or younger users should read percentiles loosely.',
    },
    {
        q: 'How often can it be taken?',
        a: 'After the familiarization run, once a month. Attention-control scores stabilize after the first few administrations, so early changes are partly practice effects rather than genuine change. Monthly spacing keeps the trend interpretable. Earlier retakes are possible but flagged with a warning.',
    },
];

/**
 * FAQ specimen card for the Antisaccade summary page.
 * Split out of the summary page per the ~400-line file guideline.
 */
const AntisaccadeFaqSection = () => (
    <section className="mb-8">
        <div className="specimen-card">
            <div className="px-5 py-4 border-b border-theme-line bg-theme-bg-elevated/50">
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faInfoCircle} className="text-theme-accent h-4 w-4" />
                    <h2 className="text-sm font-serif italic text-theme-text">Frequently Asked Questions</h2>
                </div>
            </div>

            <div className="p-5">
                <div className="space-y-0">
                    {FAQS.map((faq, index) => (
                        <details key={index} className="group border-b border-theme-line last:border-b-0">
                            <summary className="flex justify-between items-center cursor-pointer list-none py-4 hover:bg-theme-bg-elevated/30 px-2 -mx-2 transition-colors">
                                <span className="text-base text-theme-text font-serif">{faq.q}</span>
                                <span className="transition-transform group-open:rotate-180 ml-4 flex-shrink-0">
                                    <svg className="fill-current h-4 w-4 text-theme-text-muted" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                    </svg>
                                </span>
                            </summary>
                            <div className="pb-4 px-2 -mx-2">
                                <p className="text-sm text-theme-text-secondary leading-relaxed">{faq.a}</p>
                            </div>
                        </details>
                    ))}
                </div>
            </div>
        </div>
    </section>
);

export default AntisaccadeFaqSection;

/* src/components/testing/visualArrays/VisualArraysFaqSection.js */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

const FAQS = [
    {
        q: 'What does this assessment measure?',
        a: 'Visual Arrays measures attention control: the ability to direct visual working memory at what matters and filter out what doesn\'t. Each trial flashes a mixed array of red and blue rectangles, but only the cued color is ever tested. Holding the relevant items while ignoring equally salient distractors is exactly the filtering ability the score captures.',
    },
    {
        q: 'Why do I have to ignore half the rectangles?',
        a: 'The filtering demand is the point. A version where every item matters would measure pure storage capacity. By making half the display irrelevant, the task separates people who can selectively gate what enters memory from people who store everything indiscriminately. That selective-filtering ability is what distinguishes this assessment from span tasks.',
    },
    {
        q: 'Why is my score lower than the famous "7 ± 2" memory span?',
        a: 'Different scale, different construct. The "magical number seven" describes verbal span with rehearsal. Visual working memory holds only 3-4 simple objects, and on this selective version typical scores average around k = 2.5. A score that looks small next to span numbers is completely normal here.',
    },
    {
        q: 'What is k and how is it calculated?',
        a: 'k estimates how many of the cued items were actually held in memory. It uses Cowan\'s formula: k = N x (hit rate + correct rejection rate - 1), where N is the number of cued items. Answering perfectly yields k = N; pure guessing yields k = 0. It is computed separately at set sizes 3 and 5, then averaged.',
    },
    {
        q: 'Why doesn\'t the difficulty adapt like the training game?',
        a: 'Estimating k requires fixed set sizes: the formula needs many trials at the same N to compare hit and correct-rejection rates. An adaptive staircase would produce a threshold score, not a capacity estimate, and no validated adaptive protocol exists for this task. Fixed set sizes 3 and 5 are the published standard.',
    },
    {
        q: 'How often should I retake it?',
        a: 'After the familiarization run, once a month. Attention-control scores stabilize after the first few administrations, so early changes are partly practice effects rather than genuine change. Monthly spacing keeps the trend interpretable. Earlier retakes are possible but flagged with a warning.',
    },
    {
        q: 'Why can\'t I pause?',
        a: 'The arrays flash for exactly a quarter of a second and the blank retention interval is precisely timed; that timing is what makes scores comparable across sessions and against published norms. Pausing or switching tabs mid-trial breaks it, so interrupted trials are voided and redone with a fresh array. The full session takes about 10 minutes with one self-paced break at the halfway point.',
    },
];

/**
 * FAQ specimen card for the Visual Arrays summary page.
 * Split out of the summary page per the ~400-line file guideline.
 */
const VisualArraysFaqSection = () => (
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

export default VisualArraysFaqSection;

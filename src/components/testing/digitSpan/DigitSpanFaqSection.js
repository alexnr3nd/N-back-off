/* src/components/testing/digitSpan/DigitSpanFaqSection.js */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

const FAQS = [
    {
        q: 'What is the Digit Span task?',
        a: 'Digit Span is one of the oldest and most widely used measures of short-term and working memory. Digits appear on screen one at a time, and the full sequence is then recalled on a keypad. The assessment has two parts: a forward block (recall the digits in the order shown) and a backward block (recall them in reverse order).',
    },
    {
        q: 'What is the difference between forward and backward span?',
        a: 'Forward span primarily measures short-term storage capacity: holding a sequence briefly and reporting it back. Backward span adds a manipulation requirement, since the sequence has to be mentally reversed before responding, which draws more heavily on working memory. Backward spans are typically about one digit shorter than forward spans.',
    },
    {
        q: 'Why does the sequence length keep changing?',
        a: 'The assessment is adaptive (Woods et al., 2011): a correct recall makes the next list one digit longer, and two consecutive errors at the same length make it one digit shorter. This keeps the task working near your limit, which produces a more precise measurement in fewer trials than fixed-length versions.',
    },
    {
        q: 'How is the Mean Span score calculated?',
        a: 'Mean Span summarizes the whole adaptive run, not just the longest list. It starts from the block\'s starting length minus 0.5 and adds the proportion of correct recalls at each list length attempted. A score of 7.08, for example, means performance was balanced around lists of about 7 digits. Mean Span is more reliable than the traditional "longest list" score because every trial contributes.',
    },
    {
        q: 'What is the familiarization session for?',
        a: 'The first session is for familiarization. Cognitive tasks often show rapid improvement initially as you learn the rules and pacing. That session gets the steep part of the learning curve out of the way so later assessments better reflect stable capacity. The familiarization score is recorded but excluded from the trend chart.',
    },
    {
        q: 'How often can I take the assessment?',
        a: 'After familiarization, one scored assessment per month is recommended. Monthly spacing keeps practice effects small so the trend reflects genuine change. Earlier retakes are possible, but a warning is shown because they can inflate scores.',
    },
    {
        q: 'Can I pause the task?',
        a: 'No. Span tasks require sustained attention, and pausing mid-sequence would invalidate the measurement. Each digit also appears on a precise schedule, so keep the tab visible and in the foreground while the digits are showing; a round that loses focus during presentation restarts with a fresh sequence. A full session takes about 10-15 minutes.',
    },
];

/**
 * FAQ specimen card for the Digit Span summary page.
 * Split out of the summary page per the ~400-line file guideline.
 */
const DigitSpanFaqSection = () => (
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

export default DigitSpanFaqSection;

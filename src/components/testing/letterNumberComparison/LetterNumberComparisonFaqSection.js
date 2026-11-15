/* src/components/testing/letterNumberComparison/LetterNumberComparisonFaqSection.js */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

const FAQS = [
    {
        q: 'What does this assessment measure?',
        a: 'Letter & Number Comparison measures perceptual speed — how quickly simple visual comparisons can be made accurately. It is the computerized letter and number comparison paradigm of Salthouse & Babcock (1991), administered exactly as in the Redick et al. (2013) transfer battery: two strings appear, one above the other, and the task is to decide whether they are the same or differ in a single character. Perceptual speed is one of the broad cognitive abilities that working-memory training studies track, which is why it sits in this suite.',
    },
    {
        q: 'How is it scored?',
        a: 'Score = the total number of correct judgments across four 30-second blocks (two with letter strings, two with number strings). This is the dependent variable used in the source studies. Speed and accuracy both matter: more answers means more chances to score, but a wrong answer counts against the total, and an overall accuracy below 75% flags the attempt as low-validity and excludes it from your personal best.',
    },
    {
        q: 'Why is there no percentile?',
        a: 'No published normative table exists for this exact computerized format that would support an honest general-population percentile. The score is meaningful as a personal trajectory over time rather than as a rank against others. A percentile may be added later if suitable norms become available.',
    },
    {
        q: 'Why does the first score typically improve on retake?',
        a: 'Perceptual-speed tasks show practice effects: the first few administrations improve from familiarity with the format and rhythm alone, not from a real change in processing speed. That is why the first session is recorded as familiarization and excluded from the chart, and why monthly spacing is recommended — frequent retakes make practice effects hard to separate from genuine change. Treat early sessions as a baseline, not a verdict.',
    },
    {
        q: 'What happens if a block gets interrupted?',
        a: 'A block clock cannot pause. If the tab is hidden, an overlay opens, or the app freezes mid-block, that block is voided and one fresh redo (with new items) is offered. If the same block is interrupted a second time, the session ends without saving — nothing is recorded and the monthly cooldown is not used, so a count-based score is never stored against a missing block.',
    },
];

/**
 * FAQ specimen card for the Letter & Number Comparison summary page.
 * Split out of the summary page per the ~400-line file guideline.
 */
const LetterNumberComparisonFaqSection = () => (
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

export default LetterNumberComparisonFaqSection;

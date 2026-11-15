/* src/components/testing/relationMonitoring/RelationMonitoringFaqSection.js */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

const FAQS = [
    {
        q: 'What does this assessment measure?',
        a: 'Relation Monitoring measures relational integration: holding several elements in working memory and continuously checking the relations among them, rather than the elements themselves. In large factor-analytic studies it is the working-memory ability with the strongest unique link to fluid intelligence — it predicts reasoning beyond memory span, n-back, and attention-control tasks. Practically: the digits themselves are easy; the work is binding nine of them into rows and columns and noticing when three line up.',
    },
    {
        q: 'How is it scored?',
        a: 'Score = hit rate minus false-alarm rate (the Snodgrass & Corwin correction used in the source studies). Pressing MATCH on a grid that contains a matching line is a hit; pressing on one that doesn\'t is a false alarm. Catching every match with no false alarms scores 100; pressing on everything, or never pressing, scores 0. This is why a trigger-happy strategy can\'t inflate the score.',
    },
    {
        q: 'Is this the same as the RRT or Syllogimous?',
        a: 'Related construct, different lineage. The community\'s Relational Reasoning Training tools (Syllogimous and similar) build self-referential logic puzzles and are training-first projects without published validation. This task is the Relation Monitoring paradigm from the experimental literature (Oberauer 2003; Chuderski 2014; Bateman & Birney 2019), implemented from the published construction rules: validated as a measurement instrument, with known correlations to reasoning. As for the commercial SMART/RAI relational-training programs: the published trials behind their IQ-gain claims have serious methodological problems (no adequate baseline controls; gains disappear when controls are added), which is one reason this launches as an assessment, not a trainer.',
    },
    {
        q: 'How does this differ from the published laboratory versions?',
        a: 'Four documented deviations: 3 blocks of 36 arrays instead of the 6 blocks used in Bateman & Birney 2019 (shorter, slightly lower reliability); only the "three-same digits" rule condition (the condition that carried the prediction of reasoning in that study); touch/keyboard input instead of a lab response box; and unsupervised web administration. Timing (5.5-second arrays, 100 ms blink), grid construction, match rates, and scoring follow Chuderski 2014 exactly.',
    },
    {
        q: 'Why is there no percentile?',
        a: 'No general-adult norms exist for this task — published samples are university students under lab conditions, and mapping a web score onto those would be misleading. The score is meaningful in absolute terms (100 = perfect monitoring, 0 = chance-level responding) and as a personal trajectory over time.',
    },
    {
        q: 'Why is my first score likely to improve on retake?',
        a: 'The first administration is partly a familiarization baseline: early gains reflect learning the task format (where to look, the rhythm of the stream) rather than improved relational integration. That\'s why the first session is recorded as familiarization and excluded from the chart, and why monthly spacing is recommended — frequent retakes make practice effects hard to separate from real change.',
    },
    {
        q: 'Why can\'t I pause?',
        a: 'The arrays replace each other every 5.5 seconds by design — the time pressure is what forces continuous monitoring instead of leisurely checking. Pausing would break comparability across sessions. Blocks are short (about 3.5 minutes), with self-paced breaks between them, and grids shown while the tab is hidden are automatically excluded from scoring.',
    },
    {
        q: 'Why is this a Pro assessment?',
        a: 'Relation Monitoring is part of the Pro assessment suite alongside Counting Span, Digit Span, Symmetry Span, Visual Arrays, and Antisaccade. Operation Span and the Reasoning Check remain free for everyone.',
    },
];

/**
 * FAQ specimen card for the Relation Monitoring summary page.
 * Split out of the summary page per the ~400-line file guideline.
 */
const RelationMonitoringFaqSection = () => (
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

export default RelationMonitoringFaqSection;

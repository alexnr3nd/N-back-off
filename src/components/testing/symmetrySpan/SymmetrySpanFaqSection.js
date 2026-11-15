/* src/components/testing/symmetrySpan/SymmetrySpanFaqSection.js */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

const FAQS = [
    {
        q: 'What is the Symmetry Span task?',
        a: 'Symmetry Span is a complex span task that measures visuospatial working memory: holding spatial information in mind while doing something else. Each set alternates between judging whether a pattern is symmetric and remembering where a red square appeared. After the set, the square positions are recalled in order. The protocol follows the automated version used in published research (Kane et al., 2004; Unsworth et al., 2009; Redick et al., 2012).',
    },
    {
        q: 'How is this different from Counting Span and Operation Span?',
        a: 'All three are complex span tasks, but they tax different systems. Operation Span stores letters (verbal) while solving math; Counting Span stores counts while counting shapes. Symmetry Span stores spatial locations while making spatial judgments, making it the suite\'s purest measure of visuospatial working memory.',
    },
    {
        q: 'Why is there a time limit on the symmetry judgments?',
        a: 'During the symmetry-only practice, response times are measured, and from the combined practice onward each judgment is allowed your average time plus 2.5 standard deviations. This personalized limit, taken from the published protocol, prevents pausing on the judgment to rehearse the square positions, which would change what the task measures. Running out of time counts as a symmetry error, but the red square still appears.',
    },
    {
        q: 'Why does symmetry accuracy matter if it is a memory test?',
        a: 'The judgments are what keep memory under load. If they are sacrificed to focus on the squares, the score stops being comparable to the research norms. The published criterion is to keep symmetry accuracy at or above 85%; sessions below that are flagged, and the running percentage turns red during recall as a reminder.',
    },
    {
        q: 'How is the score calculated?',
        a: 'The primary score is the partial-credit score: across all 12 sets, every square recalled in its correct position counts one point, for a maximum of 42. Research recommends this over all-or-nothing scoring because it is more reliable. An absolute score (perfect sets only) and an edit-distance score (which tolerates order slips) are also recorded.',
    },
    {
        q: 'What does the research percentile mean?',
        a: 'Complete assessments are compared against published norms from Redick et al. (2012), a sample of 6,018 people, mostly young adults from university and community samples. The percentile is approximate, interpolated between the published anchor points, and is meant as orientation rather than a clinical judgment.',
    },
    {
        q: 'What is the familiarization session for?',
        a: 'The first session is for familiarization. Cognitive tasks often show rapid improvement initially as the rules and pacing are learned. That session gets the steep part of the learning curve out of the way so later assessments better reflect stable capacity. The familiarization score is recorded but excluded from the trend chart.',
    },
    {
        q: 'How often can I take the assessment?',
        a: 'After familiarization, one scored assessment per month is recommended. Monthly spacing keeps practice effects small (research finds gains of only 2-3 points between sessions) so the trend reflects genuine change. Earlier retakes are possible, but a warning is shown because they can inflate scores. The patterns and square positions are freshly generated every session.',
    },
    {
        q: 'Can I pause the task?',
        a: 'No. Complex span tasks require sustained attention, and pausing mid-set would invalidate the measurement. The squares appear on a precise schedule, so keep the tab visible during a set. A full session takes about 10-15 minutes including practice.',
    },
];

/**
 * FAQ specimen card for the Symmetry Span summary page.
 * Split out of the summary page per the ~400-line file guideline.
 */
const SymmetrySpanFaqSection = () => (
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

export default SymmetrySpanFaqSection;

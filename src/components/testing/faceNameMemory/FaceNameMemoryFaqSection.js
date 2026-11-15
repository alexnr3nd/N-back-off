/* src/components/testing/faceNameMemory/FaceNameMemoryFaqSection.js */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

const FAQS = [
    {
        q: 'What does this assessment measure?',
        a: 'Face-Name Memory measures associative memory: the ability to bind a new name to a new face and pull it back later. Each face is paired with a name to learn, then after a short delay the name has to be recalled from that face alone. This is the everyday memory behind "I know the face but I can\'t remember the name" — linking two unrelated pieces of information and retrieving one from the other.',
    },
    {
        q: 'Why is there a math break between learning and recall?',
        a: 'The brief arithmetic task between studying the pairs and recalling them keeps short-term memory busy. Without a filled gap, the names could be silently rehearsed right up to the moment of recall, and the score would reflect rehearsal rather than memory. By occupying attention during the gap, the delayed recall reflects what was genuinely stored rather than what was just held on the tip of the tongue.',
    },
    {
        q: 'Why is there no percentile or comparison to other people?',
        a: 'This assessment tracks each result against the personal baseline over time, not against a population. There is no published norm sample behind these exact faces and names, so a percentile would be invented rather than earned. It is not a clinical or diagnostic test and is not a measure of memory health — it is a self-comparison tool for watching the personal trend across sessions.',
    },
    {
        q: 'Are these real people?',
        a: 'No. The faces are AI-generated synthetic portraits that do not depict any real individual, and the names are drawn from common public name lists. Pairing a fictional name with a generated face keeps every association brand new, which is what makes the recall score a clean measure of learning rather than recognition of someone already familiar.',
    },
    {
        q: 'Why do the names fit each face, and how are the answer choices picked?',
        a: 'Each face is paired with a name that fits its apparent background, so every link is plausible and none stands out as the odd one before any learning happens. At recall, most of the choices offered for a face share that same background, and a couple are names studied earlier in the same session that come from other backgrounds. The matched-background choices stop appearance from giving the answer away: if the correct name were the only one that fit the face, it could often be guessed from looks alone, and that shortcut would help more for some faces than others, inflating the score. The few studied names from other backgrounds keep the choice honest in the other direction — because they were genuinely seen this session, landing on the right name takes remembering which name went with which face, not just which names look familiar. This is a fairness measure, not a statement about who holds which name: building wrong answers that differ from the correct one only on the thing being measured is a standard principle in memory and cognitive testing.',
    },
    {
        q: 'What is the headline number?',
        a: 'The headline is the delayed recall rate: the percentage of names correctly remembered from each face after the math break. The immediate recall rate (before the delay) and the retention change between the two are also tracked, so a session shows both how much was learned and how much survived the delay.',
    },
    {
        q: 'How often should I retake it?',
        a: 'About once every 30 days. Spacing sessions out keeps practice effects from inflating the trend and gives the personal baseline time to mean something. Earlier retakes are possible but flagged with a warning, since back-to-back runs reuse familiarity rather than testing fresh memory.',
    },
];

/**
 * FAQ specimen card for the Face-Name Memory summary page.
 * Split out of the summary page per the ~400-line file guideline.
 */
const FaceNameMemoryFaqSection = () => (
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

export default FaceNameMemoryFaqSection;

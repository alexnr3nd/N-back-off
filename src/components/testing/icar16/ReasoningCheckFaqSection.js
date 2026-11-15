/* src/components/testing/icar16/ReasoningCheckFaqSection.js */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

const FAQS = [
    {
        q: 'What is the Reasoning Check?',
        a: 'A 16-item assessment of fluid reasoning — the ability to recognise patterns, follow logical relationships, and solve novel problems. Items come from four categories (verbal reasoning, letter series, matrix reasoning, and 3-D rotation), four of each, presented in random order. There is no per-question time limit; a full run takes about 10-15 minutes.',
    },
    {
        q: 'What kinds of questions are there?',
        a: 'Four types, four items each: verbal reasoning (logic, simple math, and word problems), letter series (find the next letter in a sequence), matrix reasoning (a 3×3 grid of shapes with one cell missing), and 3-D rotation (pick which answer cube could be a rotation of a reference cube, or "none of the above"). Each item shows its own instructions, and every question is multiple-choice.',
    },
    {
        q: 'What does the score mean?',
        a: 'The score is a raw count of correct answers out of 16, with a breakdown across the four item types. In published research samples typical scores are around 8 of 16, and the 3-D rotation items are by far the hardest — most participants get fewer than 1 in 4 right. The score is not converted to an IQ; treat it as a snapshot of current reasoning performance.',
    },
    {
        q: 'Is this an IQ test?',
        a: 'No. The Reasoning Check is a research-grade brief measure, not a diagnostic instrument. Its items come from the ICAR Sample Test (Condon & Revelle, 2014), and the full 16-item set correlates strongly (r = .81) with WAIS-IV Full-Scale IQ (Young & Keith, 2020) — but a short online test cannot replace a professionally administered assessment.',
    },
    {
        q: 'Why is it recommended only once a year?',
        a: 'The test reuses the same 16 items, so retakes within weeks mostly measure memory of the specific items rather than any change in reasoning ability. Research on retesting shows scores rise for the first two or three attempts and that the inflation persists for months. Fluid reasoning is also relatively stable in adults, so an annual baseline captures what matters without contaminating future scores.',
    },
    {
        q: 'Why is there no familiarization session?',
        a: 'Span tasks include a familiarization run because their pacing and controls take practice. The Reasoning Check is self-paced with simple multiple-choice answers, and — unlike span tasks, which generate fresh sequences every run — every exposure to these 16 items affects future scores. The first attempt counts, so the question types are described on this page instead.',
    },
    {
        q: 'Can the test be paused?',
        a: 'No. Once started, the test runs to completion, and closing the tab discards progress. Questions can be skipped, but a skipped item counts as wrong. Plan for about 10-15 minutes of uninterrupted focus.',
    },
    {
        q: 'Where do the items come from?',
        a: 'All 16 items are from the ICAR Sample Test, a public-domain item set published by the International Cognitive Ability Resource project (Condon & Revelle, 2014). The set has been validated in very large online samples and is widely used in psychological research.',
    },
];

/**
 * FAQ specimen card for the Reasoning Check summary page.
 * Mirrors DigitSpanFaqSection; split out per the ~400-line file guideline.
 */
const ReasoningCheckFaqSection = () => (
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

export default ReasoningCheckFaqSection;

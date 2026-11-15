/* src/components/testing/trainer/TrainerFaq.js */
/**
 * Generic FAQ card for adaptive Trainers (shared chassis). Per-task `faqs` array
 * + `subtitle`. Mirrors the assessment FAQ's <details> accordion. Honest framing:
 * task-specific practice, never a cognitive/medical intervention.
 */
import React from 'react';
import PropTypes from 'prop-types';

const TrainerFaq = ({ faqs, subtitle }) => (
    <section className="specimen-card p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-8 bg-theme-accent" />
            <div>
                <h2 className="text-lg font-serif italic text-theme-text">Frequently Asked Questions</h2>
                <p className="text-[0.6875rem] font-mono text-theme-text-muted uppercase tracking-wider">{subtitle}</p>
            </div>
        </div>

        <div className="space-y-0">
            {faqs.map((faq, index) => (
                <details key={index} className="group border-b border-theme-line last:border-b-0">
                    <summary className="flex justify-between items-center cursor-pointer list-none py-3.5 hover:bg-theme-bg-elevated/30 px-2 -mx-2 transition-colors">
                        <span className="text-sm sm:text-base text-theme-text font-serif pr-2">{faq.q}</span>
                        <span className="transition-transform group-open:rotate-180 ml-2 flex-shrink-0">
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
    </section>
);

TrainerFaq.propTypes = {
    faqs: PropTypes.arrayOf(PropTypes.shape({ q: PropTypes.string, a: PropTypes.string })).isRequired,
    subtitle: PropTypes.string,
};
TrainerFaq.defaultProps = { subtitle: 'Trainer' };

export default TrainerFaq;

/* src/components/testing/icar16/ReasoningCheckResults.js */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCheckCircle,
    faExclamationTriangle,
    faChartBar,
    faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { ICAR_TOTAL_ITEMS, ICAR_ITEMS_PER_SUBTEST } from '../../../constants/icarConstants';

const SUBTEST_ORDER = [
    { key: 'verbal',   label: 'Verbal Reasoning' },
    { key: 'series',   label: 'Letter Series' },
    { key: 'matrix',   label: 'Matrix Reasoning' },
    { key: 'rotation', label: '3-D Rotation' },
];

/**
 * Renders the post-submission results screen.
 *
 * Shows:
 *   - Headline raw score (N/16)
 *   - Per-subtest breakdown (4 horizontal bars)
 *   - Attribution footer (required by plan)
 *   - CTAs (Back to Testing, View Insights)
 *   - Save-failure banner if applicable (offline retry)
 */
const ReasoningCheckResults = ({ results, error, pendingSaveBanner, onDone }) => {
    if (!results && !error) return null;

    const rawScore = results?.rawScore ?? 0;
    const maxScore = results?.maxScore ?? ICAR_TOTAL_ITEMS;
    const subtestScores = results?.subtestScores || { verbal: 0, series: 0, matrix: 0, rotation: 0 };

    return (
        <div className="w-full max-w-2xl mx-auto">
            {/* Save-failure banner */}
            {pendingSaveBanner && (
                <div className="mb-6 p-4 bg-status-warning/10 border-l-2 border-status-warning">
                    <div className="flex items-start gap-3">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-status-warning h-4 w-4 mt-0.5" />
                        <div>
                            <p className="text-sm text-theme-text font-medium mb-1">Couldn't save right now</p>
                            <p className="text-xs text-theme-text-secondary">
                                Your responses are stored locally and will retry next visit.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Headline score */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center h-12 w-12 mx-auto mb-4 bg-theme-accent/20 border border-theme-accent text-theme-accent">
                    <FontAwesomeIcon icon={faCheckCircle} className="h-5 w-5" />
                </div>
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-[0.2em] mb-2">Reasoning Check Complete</p>
                <div className="font-mono text-theme-text">
                    <span className="text-5xl sm:text-6xl">{rawScore}</span>
                    <span className="text-2xl text-theme-text-muted ml-2">/ {maxScore}</span>
                </div>
                <p className="text-sm text-theme-text-secondary mt-3">
                    {rawScore} item{rawScore === 1 ? '' : 's'} answered correctly out of {maxScore}.
                </p>
            </div>

            {/* Subtest breakdown */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                    <FontAwesomeIcon icon={faChartBar} className="text-theme-accent h-4 w-4" />
                    <h2 className="text-sm font-mono text-theme-text-muted uppercase tracking-wider">By Category</h2>
                </div>
                <div className="space-y-3">
                    {SUBTEST_ORDER.map(({ key, label }) => {
                        const score = subtestScores[key] ?? 0;
                        const pct = (score / ICAR_ITEMS_PER_SUBTEST) * 100;
                        return (
                            <div key={key}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-theme-text">{label}</span>
                                    <span className="text-sm font-mono text-theme-text-secondary">
                                        {score} <span className="text-theme-text-muted">/ {ICAR_ITEMS_PER_SUBTEST}</span>
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-theme-bg-elevated border border-theme-line">
                                    <div
                                        className="h-full bg-theme-accent transition-all duration-500"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Note: no community percentile yet — Phase 1.5 once N≥100 */}
            <div className="mb-8 p-4 bg-theme-bg-elevated border border-theme-line">
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-1">A note on your score</p>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                    Raw scores are most useful as a personal baseline you can compare against
                    a future retake. Community percentiles will be added once enough people
                    have completed the test.
                </p>
            </div>

            {/* Attribution */}
            <div className="mb-8 pt-6 border-t border-theme-line">
                <p className="text-xs text-theme-text-muted leading-relaxed">
                    Based on the <span className="text-theme-text-secondary">ICAR Sample Test</span>{' '}
                    (Condon &amp; Revelle, 2014). Validated against WAIS-IV (<span className="text-theme-text-secondary">r = .81</span>;
                    Young &amp; Keith, 2020). This is not a clinical IQ test.
                </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
                <button
                    onClick={onDone}
                    className="btn-primary-lab flex-1 px-6 py-3 text-sm font-mono uppercase tracking-wider flex items-center justify-center gap-2"
                >
                    <FontAwesomeIcon icon={faChevronRight} className="h-3 w-3" />
                    Done
                </button>
            </div>
        </div>
    );
};

export default ReasoningCheckResults;

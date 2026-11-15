/* src/components/testing/icar16/ReasoningScoreContextCard.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine, faInfoCircle, faBookOpen } from '@fortawesome/free-solid-svg-icons';
import {
    ICAR_SUBTEST,
    ICAR_TOTAL_ITEMS,
    ICAR_ITEMS_PER_SUBTEST,
} from '../../../constants/icarConstants';

// Expected per-subtest scores derived from per-item proportion correct in the
// ICAR validation sample (Condon & Revelle, 2014, N ≈ 97,000): verbal .64,
// series .59, matrix .52, rotation .19 — each times 4 items. Derived values,
// not directly published means, hence "typical ~" phrasing in the UI.
const SUBTEST_NORMS = [
    { key: ICAR_SUBTEST.VERBAL, label: 'Verbal', typical: 2.6 },
    { key: ICAR_SUBTEST.SERIES, label: 'Series', typical: 2.4 },
    { key: ICAR_SUBTEST.MATRIX, label: 'Matrix', typical: 2.1 },
    { key: ICAR_SUBTEST.ROTATION, label: 'Rotation', typical: 0.8 },
];
const TYPICAL_TOTAL = 8;

// Pre-first-attempt primer (replaces the deleted tutorial page).
const ITEM_TYPES = [
    {
        n: 1,
        title: 'Verbal reasoning',
        desc: 'Logic, simple math, and word problems. e.g. "If the day after tomorrow is two days before Thursday, what day is it today?"',
    },
    {
        n: 2,
        title: 'Letter series',
        desc: 'Find the next letter in a sequence. e.g. K N P S U …',
    },
    {
        n: 3,
        title: 'Matrix reasoning',
        desc: 'A 3×3 grid of shapes with one cell missing. Pick the shape from six options that completes the pattern.',
    },
    {
        n: 4,
        title: '3-D rotation',
        desc: 'A reference cube with a unique image on each face. Pick which answer cube could be a rotation of the reference, or "none of the above" if no cube works.',
    },
];

/**
 * Right-column specimen card for the Reasoning Check summary page, filling the
 * canonical xl:col-span-2 slot the span pages use for a trend chart. A trend
 * chart is deliberately NOT used here: the test reuses a fixed 16-item bank,
 * so a "watch your score grow" chart would mostly reward item memory.
 *
 * Before the first attempt it shows the four item types (the launch flow has
 * no tutorial page); once a score exists it shows the norm comparison.
 */
const ReasoningScoreContextCard = ({ latestAttempt = null }) => (
    <div className="xl:col-span-2">
        <div className="specimen-card">
            <div className="px-5 py-4 border-b border-theme-line bg-theme-bg-elevated/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={latestAttempt ? faChartLine : faBookOpen} className="text-theme-accent h-4 w-4" />
                    <h2 className="text-sm font-serif italic text-theme-text">
                        {latestAttempt ? 'Score Context' : "What You'll See"}
                    </h2>
                </div>
                {latestAttempt ? (
                    <span className="group relative cursor-help flex items-center gap-1 text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted">
                        <FontAwesomeIcon icon={faInfoCircle} className="h-3 w-3" />
                        <span>Research Norms</span>
                        <span className="absolute top-full right-0 mt-2 w-56 p-2 bg-theme-bg-elevated border border-theme-line text-theme-text-secondary text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                            Typical values from the ICAR validation sample (Condon &amp; Revelle, 2014, N &asymp; 97,000). Not age-adjusted.
                        </span>
                    </span>
                ) : (
                    <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">
                        16 items &middot; 4 types
                    </span>
                )}
            </div>

            <div className="p-6 min-h-[300px] flex items-center justify-center">
                {latestAttempt ? (
                    <div className="w-full">
                        {/* Latest total vs typical */}
                        <div className="flex items-baseline justify-between mb-6">
                            <div>
                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-1">Latest Score</div>
                                <div className="text-2xl font-mono text-theme-text">
                                    {latestAttempt.rawScore}
                                    <span className="text-sm text-theme-text-muted ml-1">/ {latestAttempt.maxScore || ICAR_TOTAL_ITEMS}</span>
                                </div>
                            </div>
                            <div className="text-sm font-mono text-theme-text-muted">typical &asymp; {TYPICAL_TOTAL} / {ICAR_TOTAL_ITEMS}</div>
                        </div>

                        {/* Per-subtest bars with a norm tick */}
                        <div className="space-y-4">
                            {SUBTEST_NORMS.map(({ key, label, typical }) => {
                                const score = typeof latestAttempt.subtestScores?.[key] === 'number'
                                    ? latestAttempt.subtestScores[key]
                                    : null;
                                return (
                                    <div key={key}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm sm:text-xs font-mono text-theme-text-muted uppercase tracking-wider">{label}</span>
                                            <span className="text-sm font-mono text-theme-accent">
                                                {score ?? '—'} / {ICAR_ITEMS_PER_SUBTEST}
                                                <span className="text-theme-text-muted"> &middot; typical ~{typical}</span>
                                            </span>
                                        </div>
                                        <div className="relative w-full bg-theme-bg-surface h-2">
                                            <div
                                                className="bg-theme-accent h-2 transition-all duration-500"
                                                style={{ width: `${((score ?? 0) / ICAR_ITEMS_PER_SUBTEST) * 100}%` }}
                                            ></div>
                                            <div
                                                className="absolute inset-y-0 w-px bg-theme-text-muted"
                                                style={{ left: `${(typical / ICAR_ITEMS_PER_SUBTEST) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <p className="mt-5 text-xs text-theme-text-muted">
                            Tick marks show typical scores in the research sample. Rotation items are by far the
                            hardest — most participants get fewer than 1 in 4 right.
                        </p>
                    </div>
                ) : (
                    <div className="w-full">
                        <p className="text-sm text-theme-text-secondary mb-5">
                            Items come from four categories — four of each, in random order.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                            {ITEM_TYPES.map(({ n, title, desc }) => (
                                <div key={n} className="flex gap-3">
                                    <span className="flex-shrink-0 h-6 w-6 bg-theme-accent/20 text-theme-accent border border-theme-accent flex items-center justify-center text-xs font-mono">{n}</span>
                                    <div>
                                        <p className="text-sm text-theme-text font-medium mb-0.5">{title}</p>
                                        <p className="text-sm text-theme-text-secondary">{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="mt-5 text-xs text-theme-text-muted">
                            There is no per-question time limit — go at your own pace. Unsure answers can be
                            skipped (they count as wrong).
                        </p>
                    </div>
                )}
            </div>
        </div>
    </div>
);

ReasoningScoreContextCard.propTypes = {
    latestAttempt: PropTypes.object,
};

export default ReasoningScoreContextCard;

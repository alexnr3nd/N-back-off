/* src/components/testing/countingSpan/trainer/CountingSpanSetFeedback.js */
import React from 'react';
import PropTypes from 'prop-types';
import { CST_TRAINER } from '../../../../constants/countingSpanTrainerConstants';

/**
 * Trainer-only per-set feedback (the assessment shows none). It does NOT
 * auto-advance: the task renders a Next Set button under it and the session hook
 * leaves SET_FEEDBACK untimed, so the screen sits until the user is done reading.
 *
 * The comparison table is the point: one full row for what was entered and one
 * for what was actually on the cards, both at the same glyph size as the
 * RecallInterface slots, so a miss shows WHICH count was wrong and what it
 * should have been. (The previous layout put the correct count in a 10px
 * subscript on a screen that vanished after 2s — unreadable, which is exactly
 * what a 71-year-old user reported.) Positions are chunked 5 at a time so a
 * size-10 set still fits a 360px phone without wrapping mid-row.
 *
 * Two odd/even numbers, deliberately: this set's count (what just happened) and
 * the session-cumulative accuracy that the 75% gate is actually measured on.
 * Both counts are computed in the hook — this component only renders them.
 */
const GATE_PCT = Math.round(CST_TRAINER.JUDGMENT_GATE_ACCURACY * 100);

// Positions per row. A chunk of 5 at the mobile classes measures
// 72 label + 5x36 boxes + 5x4 gaps = 272px. Content width is the viewport minus
// 16x2 page padding and 24x2 card padding: 280px at 360, 295px at 375, 240px at
// 320. So 360 has 8px of slack and 320 overflows by 32 — hence the
// overflow-x-auto wrapper below rather than a squeeze or a wrap.
const CHUNK = 5;

const ROW_CLASS = 'flex items-center gap-1 sm:gap-2';
const LABEL_CELL_CLASS = 'text-xs font-mono uppercase tracking-wider text-theme-text-muted text-right pr-2 w-[4.5rem] sm:w-24 shrink-0';
const BOX_CLASS = 'w-9 h-9 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center text-xl font-mono border';

const CountingSpanSetFeedback = ({
    presentedCounts, recalledCounts, recallCorrect,
    setJudgmentCorrect, judgmentCorrect, judgmentTotal,
}) => {
    const presented = Array.isArray(presentedCounts) ? presentedCounts : [];
    const recalled = Array.isArray(recalledCounts) ? recalledCounts : [];

    const judgmentAccuracy = judgmentTotal > 0 ? (judgmentCorrect / judgmentTotal) * 100 : 100;
    const isLowAccuracy = judgmentAccuracy < GATE_PCT;

    const chunkStarts = [];
    for (let start = 0; start < presented.length; start += CHUNK) chunkStarts.push(start);

    return (
        <div className="flex flex-col items-center justify-center gap-6 w-full">
            {/* Recall accuracy */}
            <div className="text-center w-full">
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-1">
                    Counts recalled correctly
                </p>
                <p className="text-3xl font-mono text-theme-text mb-3">
                    {recallCorrect} / {presented.length}
                </p>

                {/* Position-by-position comparison: what was entered over what
                    was actually on the card, position aligned. The card wrapper is
                    overflow-hidden and a centred flex child would be clipped on BOTH
                    sides, so this is a full-width scroller around a w-max column:
                    centred when the rows fit, swipeable when they don't. */}
                <div className="w-full overflow-x-auto">
                    <div className="w-max mx-auto flex flex-col gap-3">
                        {chunkStarts.map((start) => {
                            const slice = presented.slice(start, start + CHUNK);
                            return (
                                <div
                                    key={start}
                                    data-testid="cst-chunk"
                                    role="table"
                                    aria-label={`Positions ${start + 1} to ${start + slice.length}`}
                                    className="flex flex-col gap-1 sm:gap-2"
                                >
                                    {/* Position numbers, continuing across chunks */}
                                    <div className={ROW_CLASS} role="row">
                                        <span className={LABEL_CELL_CLASS} aria-hidden="true" />
                                        {slice.map((_, i) => (
                                            <span
                                                key={start + i}
                                                data-testid={`cst-position-${start + i}`}
                                                role="columnheader"
                                                className="w-9 sm:w-10 shrink-0 text-center text-xs font-mono text-theme-text-muted"
                                            >
                                                {start + i + 1}
                                            </span>
                                        ))}
                                    </div>

                                    {/* What the user typed */}
                                    <div className={ROW_CLASS} role="row">
                                        <span className={LABEL_CELL_CLASS} role="rowheader">Entered</span>
                                        {slice.map((count, i) => {
                                            const index = start + i;
                                            const entry = recalled[index];
                                            const filled = typeof entry === 'number';
                                            const isCorrect = filled && entry === count;
                                            return (
                                                <span
                                                    key={index}
                                                    data-testid={`cst-entered-${index}`}
                                                    role="cell"
                                                    className={`${BOX_CLASS} ${
                                                        isCorrect
                                                            ? 'border-status-success text-status-success'
                                                            : 'border-status-error text-status-error'
                                                    }`}
                                                >
                                                    {filled ? entry : '_'}
                                                </span>
                                            );
                                        })}
                                    </div>

                                    {/* What was actually on the cards */}
                                    <div className={ROW_CLASS} role="row">
                                        <span className={LABEL_CELL_CLASS} role="rowheader">Correct</span>
                                        {slice.map((count, i) => (
                                            <span
                                                key={start + i}
                                                data-testid={`cst-correct-${start + i}`}
                                                role="cell"
                                                className={`${BOX_CLASS} border-theme-line text-theme-text`}
                                            >
                                                {count}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <p className="mt-3 text-xs font-mono text-theme-text-muted uppercase tracking-wider">
                    This set: {setJudgmentCorrect} / {presented.length} odd-even
                </p>
            </div>

            {/* Odd/even accuracy (cumulative this session) */}
            <div className="text-center">
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-1">
                    Odd/Even accuracy
                </p>
                <p className={`text-3xl font-mono ${isLowAccuracy ? 'text-status-error' : 'text-theme-text'}`}>
                    {judgmentAccuracy.toFixed(0)}%
                </p>
                {isLowAccuracy && (
                    <p className="text-xs font-mono text-status-error mt-1">
                        Try to keep odd/even accuracy above {GATE_PCT}%
                    </p>
                )}
            </div>
        </div>
    );
};

CountingSpanSetFeedback.propTypes = {
    presentedCounts: PropTypes.arrayOf(PropTypes.number).isRequired,
    recalledCounts: PropTypes.arrayOf(
        PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])])
    ).isRequired,
    recallCorrect: PropTypes.number.isRequired,
    setJudgmentCorrect: PropTypes.number.isRequired,
    judgmentCorrect: PropTypes.number.isRequired,
    judgmentTotal: PropTypes.number.isRequired,
};

export default CountingSpanSetFeedback;

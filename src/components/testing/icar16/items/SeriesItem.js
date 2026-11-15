/* src/components/testing/icar16/items/SeriesItem.js */
import React from 'react';

/**
 * Renders a Letter & Number Series item — extracts the alphanumeric
 * sequence from the prompt and displays it prominently in monospace,
 * then offers 6 single-letter choices in a grid.
 *
 * Prompt format from item bank:
 *   "In the following alphanumeric series, what letter comes next? K N P S U"
 */
const SeriesItem = ({ item, onResponse, disabled }) => {
    if (!item) return null;

    // Split prompt at the question-mark to separate instruction from series.
    const [instructionRaw, seriesRaw] = item.prompt.includes('?')
        ? item.prompt.split('?')
        : [item.prompt, ''];
    const instruction = instructionRaw.trim() + '?';
    const series = (seriesRaw || '').trim();

    return (
        <div className="w-full">
            <p className="text-sm sm:text-base text-theme-text-secondary mb-4">
                {instruction}
            </p>

            {series && (
                <div className="bg-theme-bg-elevated border border-theme-line py-6 px-4 mb-6 text-center">
                    <p className="text-2xl sm:text-3xl font-mono text-theme-text tracking-[0.4em] sm:tracking-[0.5em]">
                        {series}
                    </p>
                </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {item.choices.map((choice, idx) => (
                    <button
                        key={choice.label}
                        onClick={() => onResponse(idx + 1)}
                        disabled={disabled}
                        className="aspect-square flex flex-col items-center justify-center bg-theme-bg-elevated border border-theme-line hover:border-theme-accent hover:bg-theme-accent/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider">
                            {choice.label}
                        </span>
                        <span className="text-2xl sm:text-3xl font-mono text-theme-text mt-1">
                            {choice.text}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SeriesItem;

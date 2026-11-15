/* src/components/testing/icar16/items/MatrixItem.js */
import React from 'react';
import { ITEM_FIGURES } from './itemAssets';

/**
 * Renders a Matrix Reasoning item.
 *
 * Layout:
 *   - Instruction line on top.
 *   - Canonical figure (3×3 stem grid + A–F answer-choice strip baked
 *     together; the user reads the visual to decide).
 *   - 6 labeled answer buttons (A–F) below for tap selection.
 */
const MatrixItem = ({ item, onResponse, disabled }) => {
    if (!item) return null;
    const figure = ITEM_FIGURES[item.id];

    return (
        <div className="w-full">
            <p className="text-sm sm:text-base text-theme-text-secondary mb-4">
                {item.prompt}
            </p>

            {figure && (
                <div className="flex justify-center mb-6 bg-white border border-theme-line p-3">
                    <img
                        src={figure}
                        alt={`Matrix reasoning item ${item.id}`}
                        className="max-w-full h-auto"
                        draggable={false}
                    />
                </div>
            )}

            <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-3">
                Select an answer
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {item.choices.map((choice, idx) => (
                    <button
                        key={choice.label}
                        onClick={() => onResponse(idx + 1)}
                        disabled={disabled}
                        className="aspect-square flex items-center justify-center bg-theme-bg-elevated border border-theme-line hover:border-theme-accent hover:bg-theme-accent/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-2xl sm:text-3xl font-mono text-theme-text"
                    >
                        {choice.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default MatrixItem;

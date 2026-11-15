/* src/components/testing/icar16/items/RotationItem.js */
import React from 'react';
import { ITEM_FIGURES } from './itemAssets';

/**
 * Renders a 3-D Rotation item.
 *
 * Choices A, B, C, E, F, G are visual cubes (read from the figure).
 * Choices D and H are text-only:
 *   D = "None of the cubes could be a rotation"
 *   H = "I do not know the solution"
 *
 * Layout:
 *   - Instruction line.
 *   - Canonical figure (cube X + 6 candidate cubes + 2 text boxes).
 *   - Two columns of buttons matching the figure's grouping:
 *     visual choices (A,B,C,E,F,G) as labeled tiles, plus the two
 *     text choices (D, H) below as wider buttons.
 */
const RotationItem = ({ item, onResponse, disabled }) => {
    if (!item) return null;
    const figure = ITEM_FIGURES[item.id];

    const visualChoices = item.choices.filter((c) => !c.text);
    const textChoices = item.choices.filter((c) => c.text);

    return (
        <div className="w-full">
            <p className="text-sm sm:text-base text-theme-text-secondary mb-4">
                {item.prompt}
            </p>

            {figure && (
                <div className="flex justify-center mb-6 bg-white border border-theme-line p-3">
                    <img
                        src={figure}
                        alt={`3-D rotation item ${item.id}`}
                        className="max-w-full h-auto"
                        draggable={false}
                    />
                </div>
            )}

            <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mb-3">
                Select an answer
            </p>

            {/* Visual choice tiles */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-3">
                {visualChoices.map((choice) => {
                    // Look up the original index in item.choices for the 1-based response code
                    const originalIdx = item.choices.findIndex((c) => c.label === choice.label);
                    return (
                        <button
                            key={choice.label}
                            onClick={() => onResponse(originalIdx + 1)}
                            disabled={disabled}
                            className="aspect-square flex items-center justify-center bg-theme-bg-elevated border border-theme-line hover:border-theme-accent hover:bg-theme-accent/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-2xl sm:text-3xl font-mono text-theme-text"
                        >
                            {choice.label}
                        </button>
                    );
                })}
            </div>

            {/* Text choices (D = None, H = I don't know) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {textChoices.map((choice) => {
                    const originalIdx = item.choices.findIndex((c) => c.label === choice.label);
                    return (
                        <button
                            key={choice.label}
                            onClick={() => onResponse(originalIdx + 1)}
                            disabled={disabled}
                            className="text-left px-4 py-3 bg-theme-bg-elevated border border-theme-line hover:border-theme-accent hover:bg-theme-accent/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                        >
                            <span className="flex-shrink-0 h-7 w-7 border border-theme-line text-theme-text-muted font-mono text-sm flex items-center justify-center">
                                {choice.label}
                            </span>
                            <span className="text-sm text-theme-text">{choice.text}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default RotationItem;

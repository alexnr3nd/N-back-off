/* src/components/testing/icar16/items/VerbalItem.js */
import React from 'react';

/**
 * Renders a Verbal Reasoning item — text prompt + text-labeled choices.
 * Choices stack vertically on mobile, 2 columns on desktop.
 */
const VerbalItem = ({ item, onResponse, disabled }) => {
    if (!item) return null;

    return (
        <div className="w-full">
            <p className="text-base sm:text-lg text-theme-text font-serif leading-relaxed mb-6">
                {item.prompt}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {item.choices.map((choice, idx) => (
                    <button
                        key={choice.label}
                        onClick={() => onResponse(idx + 1)}
                        disabled={disabled}
                        className="text-left px-4 py-3 bg-theme-bg-elevated border border-theme-line hover:border-theme-accent hover:bg-theme-accent/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                    >
                        <span className="flex-shrink-0 h-7 w-7 border border-theme-line text-theme-text-muted font-mono text-sm flex items-center justify-center">
                            {choice.label}
                        </span>
                        <span className="text-sm text-theme-text">{choice.text}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default VerbalItem;

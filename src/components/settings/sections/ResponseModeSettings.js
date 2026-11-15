/* src/components/settings/sections/ResponseModeSettings.js */
/* Response Mode (Match / Recall) for single-stimulus game modes.
 * Shown only when the active game mode supports Recall (singleColor for now). */

import React from 'react';

const OPTIONS = [
    { key: 'match', label: 'Match', description: 'Press the button when the color matches n trials back.' },
    { key: 'recall', label: 'Recall', description: 'Report WHICH color appeared n trials back — pick from all 8 colors every trial.' },
];

const ResponseModeSettings = ({ responseMode = 'match', onChange, disabled = false, modeLabel = 'Single Color N-Back' }) => (
    <div className="mt-6 pt-6 border-t border-theme-line">
        <div className="text-[0.6875rem] font-mono uppercase tracking-[0.2em] text-theme-text-muted mb-1">
            Response Mode <span className="text-theme-accent">&middot; {modeLabel}</span>
        </div>
        <p className="text-xs text-theme-text-secondary mb-3">
            Applies to {modeLabel} only — every other mode keeps the standard match
            button. Recall replaces that button with the full color pool: report which
            color appeared n trials ago. Progress is tracked on its own level, separate
            from Match.
        </p>
        <div className="grid grid-cols-2 gap-2 max-w-md" role="group" aria-label="Response Mode">
            {OPTIONS.map((opt) => (
                <button
                    key={opt.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange?.(opt.key)}
                    className={`px-3 py-2.5 text-sm font-mono uppercase tracking-wider border transition-colors ${
                        responseMode === opt.key
                            ? 'bg-theme-accent/20 border-theme-accent text-theme-accent'
                            : 'bg-theme-bg-elevated border-theme-line text-theme-text-secondary hover:border-theme-accent/50'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    aria-pressed={responseMode === opt.key}
                >
                    {opt.label}
                </button>
            ))}
        </div>
        <p className="text-xs text-theme-text-muted mt-2">
            {OPTIONS.find(o => o.key === responseMode)?.description}
        </p>
    </div>
);

export default ResponseModeSettings;

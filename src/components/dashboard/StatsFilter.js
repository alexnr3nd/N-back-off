/* File: src/components/dashboard/StatsFilter.js */
/* Inline filter toggle for stats: All / Dual / Triple / Quad */
/* Only shows modes the user has actually played. Hidden if only one mode. */

import React from 'react';
import { MODE_FILTER_OPTIONS, MODE_FILTER_COLORS } from '../../constants/modeStyles';

const ALL_MODES = MODE_FILTER_OPTIONS.map(({ key, label }) => ({ key, label }));

/**
 * @param {string} value - Current filter value
 * @param {function} onChange - Callback when filter changes
 * @param {Set|Array} availableModes - Modes the user has played (e.g., ['dual', 'triple'])
 */
const StatsFilter = ({ value, onChange }) => {
    const options = ALL_MODES;

    return (
        <div className="tab-pill-group inline-flex bg-theme-bg-elevated border border-theme-line">
            {options.map((option, index) => {
                const isActive = value === option.key;
                return (
                    <button
                        key={option.key}
                        onClick={() => onChange(option.key)}
                        className={`
                            relative px-3 py-1.5
                            text-xs font-mono uppercase tracking-wider
                            transition-all duration-200
                            ${index > 0 ? 'border-l border-theme-line' : ''}
                            ${isActive
                                ? MODE_FILTER_COLORS[option.key].active
                                : 'text-theme-text-muted hover:text-theme-text-secondary hover:bg-theme-bg-surface'
                            }
                            cursor-pointer
                            focus:outline-none focus:ring-1 focus:ring-theme-accent/50
                        `}
                    >
                        {option.label}
                        {isActive && (
                            <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${MODE_FILTER_COLORS[option.key].indicator}`} />
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default StatsFilter;

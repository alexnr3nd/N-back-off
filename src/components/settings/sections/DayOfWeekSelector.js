/* src/components/settings/sections/DayOfWeekSelector.js */
/* Cognitive Lab theme - Day of week toggle buttons */
import React from 'react';

const DAYS = [
    { value: 0, label: 'S', fullLabel: 'Sunday' },
    { value: 1, label: 'M', fullLabel: 'Monday' },
    { value: 2, label: 'T', fullLabel: 'Tuesday' },
    { value: 3, label: 'W', fullLabel: 'Wednesday' },
    { value: 4, label: 'T', fullLabel: 'Thursday' },
    { value: 5, label: 'F', fullLabel: 'Friday' },
    { value: 6, label: 'S', fullLabel: 'Saturday' },
];

/**
 * Day of week selector component with toggle buttons for each day.
 *
 * @param {Object} props
 * @param {string} props.label - Label for the selector
 * @param {number[]} props.selectedDays - Array of selected day values (0-6)
 * @param {Function} props.onChange - Callback when selection changes
 * @param {boolean} props.disabled - Whether the selector is disabled
 */
const DayOfWeekSelector = ({ label, selectedDays = [], onChange, disabled = false }) => {
    const handleToggle = (dayValue) => {
        if (disabled) return;

        const isSelected = selectedDays.includes(dayValue);

        if (isSelected) {
            // Don't allow deselecting if it's the last day
            if (selectedDays.length === 1) return;
            onChange(selectedDays.filter(d => d !== dayValue));
        } else {
            onChange([...selectedDays, dayValue].sort((a, b) => a - b));
        }
    };

    return (
        <div className="py-3">
            <label className="block text-sm font-mono text-theme-text-secondary mb-3">
                {label}
            </label>
            <div className="flex gap-2">
                {DAYS.map((day) => {
                    const isSelected = selectedDays.includes(day.value);
                    return (
                        <button
                            key={day.value}
                            type="button"
                            onClick={() => handleToggle(day.value)}
                            disabled={disabled}
                            className={`
                                w-10 h-10 flex items-center justify-center
                                text-sm font-mono uppercase tracking-wider
                                border rounded-lab
                                transition-all duration-200
                                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                ${isSelected
                                    ? 'bg-theme-accent text-theme-bg border-theme-accent'
                                    : 'bg-theme-bg-elevated text-theme-text-muted border-theme-line hover:border-theme-border hover:text-theme-text-secondary'
                                }
                                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal focus:ring-theme-accent
                            `}
                            aria-label={`${day.fullLabel}${isSelected ? ' (selected)' : ''}`}
                            aria-pressed={isSelected}
                        >
                            {day.label}
                        </button>
                    );
                })}
            </div>
            <p className="mt-2 text-xs font-mono text-theme-text-muted">
                {selectedDays.length === 7
                    ? 'Every day'
                    : selectedDays.length === 5 && selectedDays.every(d => d >= 1 && d <= 5)
                        ? 'Weekdays only'
                        : `${selectedDays.length} day${selectedDays.length !== 1 ? 's' : ''} selected`
                }
            </p>
        </div>
    );
};

export default DayOfWeekSelector;

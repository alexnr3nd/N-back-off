/* src/components/program/CohortSettings.js */

/**
 * Cohort settings tab — privacy toggles for online presence visibility.
 * Uses SettingsContext for persistence (profile-level, persists across cohorts).
 */

import React, { useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faGamepad } from '@fortawesome/free-solid-svg-icons';
import { useSettings } from '../../contexts/SettingsContext';

const CohortSettings = () => {
    const { settings, updateSetting } = useSettings();

    const showOnlineStatus = settings?.cohortPrivacy?.showOnlineStatus !== false;
    const showGameActivity = settings?.cohortPrivacy?.showGameActivity !== false;

    const handleToggle = useCallback((key) => {
        const current = settings?.cohortPrivacy || { showOnlineStatus: true, showGameActivity: true };
        const newValue = !current[key];
        const updated = { ...current, [key]: newValue };
        // If turning off online status, also turn off game activity
        if (key === 'showOnlineStatus' && !newValue) {
            updated.showGameActivity = false;
        }
        updateSetting('cohortPrivacy', updated);
    }, [settings?.cohortPrivacy, updateSetting]);

    return (
        <div className="space-y-6">
            {/* Visibility section */}
            <div>
                <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-theme-text-muted mb-4">
                    Visibility
                </h3>
                <div className="space-y-3">
                    {/* Show online status toggle */}
                    <ToggleRow
                        icon={faEye}
                        label="Show when I'm online"
                        description="Other cohort members will see a green dot when you're active"
                        checked={showOnlineStatus}
                        onChange={() => handleToggle('showOnlineStatus')}
                    />

                    {/* Show game activity toggle */}
                    <ToggleRow
                        icon={faGamepad}
                        label="Show game activity"
                        description="Others can see your current trial and difficulty while you play"
                        checked={showGameActivity}
                        disabled={!showOnlineStatus}
                        onChange={() => handleToggle('showGameActivity')}
                    />
                </div>
            </div>
        </div>
    );
};

/** Reusable toggle row with icon, label, description */
const ToggleRow = ({ icon, label, description, checked, disabled, onChange }) => (
    <div className={`flex items-start gap-3 p-3 rounded transition-colors ${
        disabled ? 'opacity-50' : ''
    }`}>
        <div className="flex-shrink-0 mt-0.5">
            <FontAwesomeIcon icon={icon} className="h-4 w-4 text-theme-text-muted" />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm text-theme-text font-medium">{label}</p>
            <p className="text-xs text-theme-text-muted mt-0.5">{description}</p>
        </div>
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={onChange}
            className={`relative flex-shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-theme-accent focus:ring-offset-2 focus:ring-offset-theme-bg-secondary ${
                checked ? 'bg-theme-accent' : 'bg-theme-line'
            } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    checked ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
        </button>
    </div>
);

export default CohortSettings;

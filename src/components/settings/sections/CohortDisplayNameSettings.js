/* src/components/settings/sections/CohortDisplayNameSettings.js */
/* Cohort display name editing — follows DisplayNameSettings.js pattern */
import React, { useState, useCallback, useEffect } from 'react';
import {
    SectionCard,
    SaveButtonArea,
    StatusMessage
} from '../SettingSectionComponents';
import ButtonSpinner from '../../ui/ButtonSpinner';

const MAX_LENGTH = 25;
const MIN_LENGTH = 3;
const VALID_PATTERN = /^[a-zA-Z0-9\s_\-.]+$/;

const CohortDisplayNameSettings = ({
    localCohortDisplayName,
    onNameChange,
    currentName,
    isDisabled,
    isSaving,
    saveStatus,
    onSave
}) => {
    const [validationError, setValidationError] = useState(null);

    const handleNameChange = useCallback((value) => {
        onNameChange(value);

        if (value.trim()) {
            const trimmed = value.trim();
            if (trimmed.length < MIN_LENGTH) {
                setValidationError(`Must be at least ${MIN_LENGTH} characters.`);
            } else if (trimmed.length > MAX_LENGTH) {
                setValidationError(`Must be ${MAX_LENGTH} characters or fewer.`);
            } else if (!VALID_PATTERN.test(trimmed)) {
                setValidationError('Only letters, numbers, spaces, underscores, hyphens, and periods allowed.');
            } else {
                setValidationError(null);
            }
        } else {
            setValidationError(null);
        }
    }, [onNameChange]);

    // Clear validation error when currentName changes (after successful save)
    useEffect(() => {
        if (currentName && localCohortDisplayName === currentName) {
            setValidationError(null);
        }
    }, [currentName, localCohortDisplayName]);

    const trimmed = localCohortDisplayName.trim();
    const hasChanges = trimmed !== (currentName || '');
    const isValid = trimmed.length >= MIN_LENGTH && trimmed.length <= MAX_LENGTH && VALID_PATTERN.test(trimmed);
    const canSave = hasChanges && isValid;

    return (
        <SectionCard>
            <div className="space-y-4">
                <div>
                    <label
                        htmlFor="cohort-display-name"
                        className="block text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-2"
                    >
                        Cohort Display Name
                    </label>
                    <input
                        type="text"
                        id="cohort-display-name"
                        value={localCohortDisplayName}
                        onChange={(e) => handleNameChange(e.target.value)}
                        className={`w-full px-4 py-3 bg-theme-bg-secondary border rounded-lab
                            text-theme-text placeholder-warm-muted/50 font-mono text-sm
                            transition-all duration-200 hover:border-theme-border
                            focus:outline-none focus:ring-1
                            disabled:opacity-50 disabled:cursor-not-allowed ${
                                validationError
                                    ? 'border-neural-synapse focus:ring-neural-synapse focus:border-neural-synapse'
                                    : 'border-theme-line focus:ring-theme-accent focus:border-theme-accent'
                            }`}
                        placeholder="Choose a display name"
                        maxLength={MAX_LENGTH}
                        disabled={isDisabled}
                    />
                    {validationError ? (
                        <p className="mt-2 text-xs text-neural-synapse font-mono">
                            {validationError}
                        </p>
                    ) : (
                        <p className="mt-2 text-xs text-theme-text-muted font-mono">
                            This is how other cohort members will see you.
                        </p>
                    )}
                </div>
            </div>

            <SaveButtonArea>
                {saveStatus.section === 'cohortDisplayName' && (
                    <StatusMessage status={saveStatus} />
                )}
                <button
                    onClick={onSave}
                    disabled={isDisabled || isSaving || !canSave}
                    className="min-w-[120px] px-6 py-2.5 bg-theme-accent text-theme-bg font-mono text-sm
                        uppercase tracking-wider rounded-lab transition-all duration-200
                        hover:bg-amber-highlight disabled:opacity-50 disabled:cursor-not-allowed
                        focus:outline-none focus:ring-2 focus:ring-offset-2
                        focus:ring-offset-charcoal-surface focus:ring-theme-accent
                        flex items-center justify-center gap-2"
                >
                    {isSaving ? (
                        <>
                            <ButtonSpinner color="charcoal" />
                            <span>Updating...</span>
                        </>
                    ) : (
                        'Update Name'
                    )}
                </button>
            </SaveButtonArea>
        </SectionCard>
    );
};

export default CohortDisplayNameSettings;

/* src/components/settings/sections/DisplayNameSettings.js */
/* Cognitive Lab theme - Display name editing with validation */
import React, { useState, useCallback, useEffect } from 'react';
import {
    SectionCard,
    SaveButtonArea,
    StatusMessage
} from '../SettingSectionComponents';
import ButtonSpinner from '../../ui/ButtonSpinner';
import { validateName, NAME_MAX_LENGTH } from '../../../utils/nameValidation';

const DisplayNameSettings = ({
    localName,
    onNameChange,
    currentName,
    isDisabled,
    isSaving,
    saveStatus,
    onSaveName
}) => {
    const [validationError, setValidationError] = useState(null);

    // Validate on name change
    const handleNameChange = useCallback((value) => {
        onNameChange(value);

        // Only show validation error if there's content
        if (value.trim()) {
            const { isValid, error } = validateName(value);
            setValidationError(isValid ? null : error);
        } else {
            setValidationError(null);
        }
    }, [onNameChange]);

    // Clear validation error when currentName changes (e.g., after successful save)
    useEffect(() => {
        if (currentName && localName === currentName) {
            setValidationError(null);
        }
    }, [currentName, localName]);

    const hasChanges = localName.trim() !== (currentName || '');
    const { isValid } = validateName(localName);
    const canSave = hasChanges && isValid && localName.trim().length > 0;

    return (
        <SectionCard>
            <div className="space-y-4">
                {/* Name Input */}
                <div>
                    <label
                        htmlFor="profile-name"
                        className="block text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-2"
                    >
                        Name
                    </label>
                    <input
                        type="text"
                        id="profile-name"
                        value={localName}
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
                        placeholder="How should we address you?"
                        maxLength={NAME_MAX_LENGTH}
                        disabled={isDisabled}
                    />
                    {validationError ? (
                        <p className="mt-2 text-xs text-neural-synapse font-mono">
                            {validationError}
                        </p>
                    ) : (
                        <p className="mt-2 text-xs text-theme-text-muted font-mono">
                            Only letters, spaces, hyphens, apostrophes, and periods allowed.
                        </p>
                    )}
                </div>

            </div>

            <SaveButtonArea>
                {saveStatus.section === 'profile' && (
                    <StatusMessage status={saveStatus} />
                )}
                <button
                    onClick={onSaveName}
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

export default DisplayNameSettings;

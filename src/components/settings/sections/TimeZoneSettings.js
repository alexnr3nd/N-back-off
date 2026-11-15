/* src/components/settings/sections/TimeZoneSettings.js */
/* Updated: Cognitive Lab dark theme with change limit info */
import React from 'react';
import {
    SectionCard,
    DropdownInput,
    SaveButton,
    SaveButtonArea,
    StatusMessage
} from '../SettingSectionComponents';

const TimeZoneSettings = ({
    localTimezone,
    onTimezoneChange,
    timezoneOptions,
    currentLocalTime,
    currentLocalDate,
    isGeneralSectionDisabled,
    isSavingAppSettings,
    appSaveStatus,
    onSaveTimeZone,
    timezoneChangeStatus = { canChange: true, freeChangesRemaining: 3, hoursUntilNextChange: 0, isLoading: false }
}) => {
    const { canChange, hoursUntilNextChange, isLoading } = timezoneChangeStatus;

    // Only show message when user has exceeded the limit
    const getChangeLimitMessage = () => {
        if (isLoading) return null;

        if (!canChange) {
            return {
                text: `Next change available in ${hoursUntilNextChange} hour${hoursUntilNextChange !== 1 ? 's' : ''}`,
                type: 'warning'
            };
        }

        return null;
    };

    const changeLimitMessage = getChangeLimitMessage();

    return (
        <SectionCard>
            <div className="space-y-4">
                <DropdownInput
                    label="Time Zone"
                    id="timezone"
                    value={localTimezone}
                    onChange={onTimezoneChange}
                    options={timezoneOptions}
                    disabled={isGeneralSectionDisabled}
                />

                {/* Current Time Display */}
                <div className="bg-theme-bg-elevated p-4 rounded-lab border border-theme-line">
                    <div className="text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-2">
                        Current Local Time
                    </div>
                    <div className="text-2xl font-mono text-theme-accent tabular-nums">
                        {currentLocalTime}
                    </div>
                    <div className="mt-2 text-sm font-mono text-theme-text-secondary">
                        {currentLocalDate}
                    </div>
                </div>

                {/* Warning shown only when change limit exceeded */}
                {changeLimitMessage && (
                    <div className="p-3 rounded-lab border bg-neural-synapse/10 border-neural-synapse/30">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-neural-synapse rounded-full flex-shrink-0"></div>
                            <span className="text-xs font-mono text-neural-synapse">
                                {changeLimitMessage.text}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <SaveButtonArea>
                {appSaveStatus.section === 'timezone' && (
                    <StatusMessage status={appSaveStatus} />
                )}
                <SaveButton
                    onClick={onSaveTimeZone}
                    disabled={isGeneralSectionDisabled}
                    isSaving={isSavingAppSettings && appSaveStatus.section === 'timezone'}
                    text="Save"
                    minWidth="120px"
                />
            </SaveButtonArea>
        </SectionCard>
    );
};

export default TimeZoneSettings;

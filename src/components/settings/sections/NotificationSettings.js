/* src/components/settings/sections/NotificationSettings.js */
/* Cognitive Lab theme - Notification preferences section */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import {
    SectionCard,
    ToggleSwitch,
    DropdownInput,
    SaveButton,
    SaveButtonArea,
    StatusMessage
} from '../SettingSectionComponents';
import DayOfWeekSelector from './DayOfWeekSelector';

const TIME_BLOCK_OPTIONS = [
    { value: 'morning', label: 'Morning (8:00 AM)' },
    { value: 'afternoon', label: 'Afternoon (2:00 PM)' },
    { value: 'evening', label: 'Evening (7:00 PM)' },
];

/**
 * Notification settings section for daily reminder preferences.
 */
const NotificationSettings = ({
    localRemindersEnabled,
    onRemindersEnabledChange,
    localTimeBlock,
    onTimeBlockChange,
    localDaysOfWeek,
    onDaysOfWeekChange,
    userTimezone,
    isDisabled,
    isSaving,
    saveStatus,
    onSave,
    localMarketingOptIn,
    onMarketingOptInChange,
    isSavingMarketing,
    onSaveMarketing
}) => {
    return (
        <SectionCard>
            {/* Info Banner */}
            <div className="bg-theme-bg-elevated border border-theme-line rounded-lab p-4 mb-6">
                <div className="flex items-start gap-3">
                    <FontAwesomeIcon icon={faEnvelope} className="h-5 w-5 text-theme-accent flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-mono text-theme-text">
                            Daily Training Reminders
                        </p>
                        <p className="text-xs font-mono text-theme-text-muted mt-1">
                            Receive email reminders to help you maintain your training habit.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {/* Master Toggle */}
                <ToggleSwitch
                    label="Enable Daily Reminders"
                    description="Receive an email reminder to train each day."
                    checked={localRemindersEnabled}
                    onChange={onRemindersEnabledChange}
                    disabled={isDisabled}
                />

                {/* Conditional Options - Only show when enabled */}
                {localRemindersEnabled && (
                    <div className="pl-4 border-l-2 border-theme-line space-y-4 mt-4">
                        {/* Time Block Selection */}
                        <DropdownInput
                            label="Reminder Time"
                            id="notification-time-block"
                            value={localTimeBlock}
                            onChange={(e) => onTimeBlockChange(e.target.value)}
                            options={TIME_BLOCK_OPTIONS}
                            disabled={isDisabled}
                            description={userTimezone ? `Based on your timezone (${userTimezone})` : null}
                        />

                        {/* Day of Week Selection */}
                        <DayOfWeekSelector
                            label="Reminder Days"
                            selectedDays={localDaysOfWeek}
                            onChange={onDaysOfWeekChange}
                            disabled={isDisabled}
                        />
                    </div>
                )}
            </div>

            <SaveButtonArea>
                {saveStatus.section === 'notifications' && (
                    <StatusMessage status={saveStatus} />
                )}
                <SaveButton
                    onClick={onSave}
                    disabled={isDisabled || isSaving}
                    isSaving={isSaving}
                    text="Save"
                    minWidth="120px"
                />
            </SaveButtonArea>

            {/* Marketing Emails Section */}
            <div className="border-t border-theme-line pt-6 mt-6">
                <div className="bg-theme-bg-elevated border border-theme-line rounded-lab p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <FontAwesomeIcon icon={faBell} className="h-5 w-5 text-theme-accent flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-mono text-theme-text">
                                Marketing Emails
                            </p>
                            <p className="text-xs font-mono text-theme-text-muted mt-1">
                                Receive emails about new features, training tips, and product updates.
                            </p>
                        </div>
                    </div>
                </div>

                <ToggleSwitch
                    label="Product Updates & Training Tips"
                    checked={localMarketingOptIn}
                    onChange={onMarketingOptInChange}
                    disabled={isDisabled}
                />

                <SaveButtonArea>
                    {saveStatus.section === 'marketing' && (
                        <StatusMessage status={saveStatus} />
                    )}
                    <SaveButton
                        onClick={onSaveMarketing}
                        disabled={isDisabled || isSavingMarketing}
                        isSaving={isSavingMarketing}
                        text="Save"
                        minWidth="120px"
                    />
                </SaveButtonArea>
            </div>
        </SectionCard>
    );
};

export default NotificationSettings;

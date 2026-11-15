/* src/components/settings/sections/AdvancedSettingsSection.js */
/* Updated: Cognitive Lab dark theme */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFlask } from '@fortawesome/free-solid-svg-icons';
import {
    SectionCard,
    ToggleSwitch,
    SaveButton,
    SaveButtonArea,
    StatusMessage
} from '../SettingSectionComponents';

const AdvancedSettingsSection = ({
    localEnableExperimentalFeatures,
    onEnableExperimentalFeaturesChange,
    isGeneralSectionDisabled,
    isSavingAppSettings,
    appSaveStatus,
    onSaveAdvancedSettings
}) => {
    return (
        <SectionCard>
            {/* Warning Banner */}
            <div className="bg-theme-accent/10 border border-theme-accent/30 rounded-lab p-4 mb-6">
                <div className="flex items-start gap-3">
                    <FontAwesomeIcon icon={faFlask} className="h-5 w-5 text-theme-accent flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-mono text-theme-accent">
                            Experimental Features
                        </p>
                        <p className="text-xs font-mono text-theme-text-muted mt-1">
                            These features are under development and may be unstable or change frequently.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <ToggleSwitch
                    label="Enable Experimental Features"
                    description="Access beta features and experimental game modes."
                    checked={localEnableExperimentalFeatures}
                    onChange={onEnableExperimentalFeaturesChange}
                    disabled={isGeneralSectionDisabled}
                />
            </div>

            <SaveButtonArea>
                {appSaveStatus.section === 'advanced' && (
                    <StatusMessage status={appSaveStatus} />
                )}
                <SaveButton
                    onClick={onSaveAdvancedSettings}
                    disabled={isGeneralSectionDisabled}
                    isSaving={isSavingAppSettings && appSaveStatus.section === 'advanced'}
                    text="Save"
                    minWidth="120px"
                />
            </SaveButtonArea>
        </SectionCard>
    );
};

export default AdvancedSettingsSection;

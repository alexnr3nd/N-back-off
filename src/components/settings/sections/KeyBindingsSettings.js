/* src/components/settings/sections/KeyBindingsSettings.js */
/* Updated: Cognitive Lab dark theme */
import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import {
    SectionCard,
    KeyBindingInput,
    SaveButton,
    SaveButtonArea,
    StatusMessage
} from '../SettingSectionComponents';

const KeyBindingsSettings = ({
    localKeyBindings,
    settingKey,
    onStartSettingKey,
    isGeneralSectionDisabled,
    isSavingAppSettings,
    appSaveStatus,
    onSaveKeyBindings,
    activeGameMode
}) => {
    const [showAdvancedKeys, setShowAdvancedKeys] = useState(false);

    const isTriple = activeGameMode === 'triple';
    const isQuad = activeGameMode === 'quad';

    // Determine dropdown label based on mode
    const dropdownLabel = isTriple ? 'Quad Mode Key' : 'Triple & Quad Mode Keys';

    return (
        <SectionCard>
            <p className="text-sm text-theme-text-muted font-mono mb-6">
                Customize the keys used for matching during the game. Click a button, then press the desired key.
            </p>
            <div className="space-y-1">
                <KeyBindingInput
                    label="Position Match Key"
                    currentKey={localKeyBindings.visual}
                    isSetting={settingKey === 'visual'}
                    onStartSetting={() => onStartSettingKey('visual')}
                    disabled={isGeneralSectionDisabled}
                />
                <KeyBindingInput
                    label="Audio Match Key"
                    currentKey={localKeyBindings.audio}
                    isSetting={settingKey === 'audio'}
                    onStartSetting={() => onStartSettingKey('audio')}
                    disabled={isGeneralSectionDisabled}
                />

                {/* Triple/Quad mode: show Color key directly */}
                {(isTriple || isQuad) && (
                    <KeyBindingInput
                        label="Color Match Key"
                        currentKey={localKeyBindings.color}
                        isSetting={settingKey === 'color'}
                        onStartSetting={() => onStartSettingKey('color')}
                        disabled={isGeneralSectionDisabled}
                    />
                )}

                {/* Quad mode: show Shape key directly */}
                {isQuad && (
                    <KeyBindingInput
                        label="Shape Match Key"
                        currentKey={localKeyBindings.shape}
                        isSetting={settingKey === 'shape'}
                        onStartSetting={() => onStartSettingKey('shape')}
                        disabled={isGeneralSectionDisabled}
                    />
                )}
            </div>

            {/* Show collapsible section if not in quad mode (quad has all keys visible) */}
            {!isQuad && (
                <>
                    <button
                        type="button"
                        onClick={() => setShowAdvancedKeys(!showAdvancedKeys)}
                        className="flex items-center gap-2 text-xs text-theme-text-muted hover:text-theme-text font-mono mt-4 mb-2 transition-colors"
                    >
                        <FontAwesomeIcon
                            icon={faChevronRight}
                            className={`transition-transform duration-200 ${showAdvancedKeys ? 'rotate-90' : ''}`}
                        />
                        {dropdownLabel}
                    </button>

                    {showAdvancedKeys && (
                        <div className="space-y-1 pl-4 border-l border-theme-line">
                            {/* Dual mode: show both Color and Shape in dropdown */}
                            {!isTriple && (
                                <KeyBindingInput
                                    label="Color Match Key"
                                    currentKey={localKeyBindings.color}
                                    isSetting={settingKey === 'color'}
                                    onStartSetting={() => onStartSettingKey('color')}
                                    disabled={isGeneralSectionDisabled}
                                />
                            )}
                            {/* Both Dual and Triple: show Shape in dropdown */}
                            <KeyBindingInput
                                label="Shape Match Key"
                                currentKey={localKeyBindings.shape}
                                isSetting={settingKey === 'shape'}
                                onStartSetting={() => onStartSettingKey('shape')}
                                disabled={isGeneralSectionDisabled}
                            />
                        </div>
                    )}
                </>
            )}

            {settingKey && (
                <p className="mt-4 text-xs text-theme-accent font-mono animate-pulse">
                    Press any key to bind (Escape or Tab to cancel)
                </p>
            )}

            <SaveButtonArea>
                {appSaveStatus.section === 'keyBindings' && (
                    <StatusMessage status={appSaveStatus} />
                )}
                <SaveButton
                    onClick={onSaveKeyBindings}
                    disabled={isGeneralSectionDisabled}
                    isSaving={isSavingAppSettings && appSaveStatus.section === 'keyBindings'}
                    text="Save"
                    minWidth="120px"
                />
            </SaveButtonArea>
        </SectionCard>
    );
};

export default KeyBindingsSettings;

/* src/components/settings/sections/AppearanceSettings.js */
/* Theme selection settings - extracted from GameplayAudioSettings */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon, faDesktop } from '@fortawesome/free-solid-svg-icons';
import {
    SectionCard,
    SaveButton,
    SaveButtonArea,
    StatusMessage,
    ToggleSwitch
} from '../SettingSectionComponents';

const THEME_OPTIONS = [
    { value: 'light', label: 'Light', icon: faSun },
    { value: 'dark', label: 'Dark', icon: faMoon },
    { value: 'system', label: 'System', icon: faDesktop },
];

// Text Size (Settings > Appearance). `sample` is the size of the "Aa" preview glyph
// inside each button, so the choice is legible before it is made.
const TEXT_SIZE_OPTIONS = [
    { value: 'default', label: 'Default', sample: 'text-sm' },
    { value: 'large', label: 'Large', sample: 'text-base' },
    { value: 'larger', label: 'Larger', sample: 'text-lg' },
];

const AppearanceSettings = ({
    localTheme,
    onThemeChange,
    localAutoHideCursor,
    onAutoHideCursorChange,
    localTextScale,
    onTextScaleChange,
    isDisabled,
    isSaving,
    saveStatus,
    onSave
}) => {
    return (
        <SectionCard>
            <div className="space-y-2">
                {/* Theme Selection */}
                <div>
                    <div className="mb-4">
                        <span className="text-sm font-mono text-theme-text">Color Scheme</span>
                        <span className="block text-xs text-theme-text-muted mt-1 font-mono">
                            Choose your preferred appearance. System will match your device settings.
                        </span>
                    </div>

                    {/* Theme selector buttons */}
                    <div className="grid grid-cols-3 gap-3">
                        {THEME_OPTIONS.map((option) => {
                            const isSelected = localTheme === option.value;
                            return (
                                <button
                                    key={option.value}
                                    onClick={() => !isDisabled && onThemeChange(option.value)}
                                    disabled={isDisabled}
                                    className={`
                                        flex flex-col items-center gap-2 px-4 py-3 rounded-lab border transition-all duration-200
                                        ${isSelected
                                            ? 'bg-theme-accent/20 border-theme-accent text-theme-accent'
                                            : 'bg-theme-bg-elevated border-theme-line text-theme-text-secondary hover:border-theme-accent/50 hover:text-theme-text'
                                        }
                                        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                    `}
                                >
                                    <FontAwesomeIcon icon={option.icon} className="h-5 w-5" />
                                    <span className="text-xs font-mono uppercase tracking-wider">{option.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Text Size */}
                <div className="border-t border-theme-line pt-4 mt-4">
                    <div className="mb-4">
                        <span className="text-sm font-mono text-theme-text">Text Size</span>
                        <span className="block text-xs text-theme-text-muted mt-1 font-mono">
                            Larger sizes scale text across the whole site. Default keeps the standard size.
                        </span>
                    </div>

                    {/* Text size selector buttons */}
                    <div className="grid grid-cols-3 gap-3">
                        {TEXT_SIZE_OPTIONS.map((option) => {
                            const isSelected = localTextScale === option.value;
                            return (
                                <button
                                    key={option.value}
                                    onClick={() => !isDisabled && onTextScaleChange(option.value)}
                                    disabled={isDisabled}
                                    aria-pressed={isSelected}
                                    className={`
                                        flex flex-col items-center gap-2 px-4 py-3 rounded-lab border transition-all duration-200
                                        ${isSelected
                                            ? 'bg-theme-accent/20 border-theme-accent text-theme-accent'
                                            : 'bg-theme-bg-elevated border-theme-line text-theme-text-secondary hover:border-theme-accent/50 hover:text-theme-text'
                                        }
                                        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                    `}
                                >
                                    {/* Decorative size preview; the label below is the accessible name. */}
                                    <span aria-hidden="true" className={`font-serif leading-none ${option.sample}`}>Aa</span>
                                    <span className="text-xs font-mono uppercase tracking-wider">{option.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-theme-line pt-4 mt-4">
                    <ToggleSwitch
                        label="Auto-hide cursor during gameplay"
                        description="Hides the mouse cursor while actively playing. Moving the mouse will temporarily show it."
                        checked={localAutoHideCursor}
                        onChange={onAutoHideCursorChange}
                        disabled={isDisabled}
                    />
                </div>
            </div>

            <SaveButtonArea>
                {saveStatus.section === 'appearance' && (
                    <StatusMessage status={saveStatus} />
                )}
                <SaveButton
                    onClick={onSave}
                    disabled={isDisabled}
                    isSaving={isSaving && saveStatus.section === 'appearance'}
                    text="Save"
                    minWidth="120px"
                />
            </SaveButtonArea>
        </SectionCard>
    );
};

export default AppearanceSettings;

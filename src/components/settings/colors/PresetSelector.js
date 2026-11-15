/* src/components/settings/colors/PresetSelector.js */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faCircle, faEye, faPalette, faSliders } from '@fortawesome/free-solid-svg-icons';

const PRESET_OPTIONS = [
    { id: 'default', label: 'Default', icon: faPalette, description: 'Original 8 colors' },
    { id: 'cvd-safe', label: 'Color-blind friendly', icon: faEye, description: 'Distinguishable across deuteranopia, protanopia, tritanopia' },
    { id: 'custom', label: 'Custom', icon: faSliders, description: 'Tap any swatch in the preview to customize' },
];

const PresetSelector = ({ paletteId, onSelectPreset }) => {
    const handleClick = (id) => {
        if (id === paletteId) return;
        onSelectPreset(id);
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PRESET_OPTIONS.map((opt) => {
                const isSelected = paletteId === opt.id;
                return (
                    <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleClick(opt.id)}
                        className={`
                            flex flex-col items-start gap-1.5 px-3 py-3 rounded-lab border text-left
                            transition-all duration-200 cursor-pointer
                            ${isSelected
                                ? 'bg-theme-accent/15 border-theme-accent text-theme-text'
                                : 'bg-theme-bg-elevated border-theme-line text-theme-text-secondary hover:border-theme-accent/50 hover:text-theme-text'}
                        `}
                    >
                        <div className="flex items-center gap-2 w-full">
                            <FontAwesomeIcon
                                icon={isSelected ? faCircleCheck : faCircle}
                                className={`h-3 w-3 ${isSelected ? 'text-theme-accent' : 'text-theme-text-muted'}`}
                            />
                            <FontAwesomeIcon icon={opt.icon} className="h-3.5 w-3.5" />
                            <span className="text-xs font-mono uppercase tracking-wider">{opt.label}</span>
                        </div>
                        <span className={`text-[0.6875rem] font-mono leading-snug ${isSelected ? 'text-theme-text-secondary' : 'text-theme-text-muted'}`}>
                            {opt.description}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default PresetSelector;

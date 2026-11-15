/* src/components/settings/colors/LivePreview.js */

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon } from '@fortawesome/free-solid-svg-icons';
import { COLOR_NAMES } from '../../../constants/colorPresets';
import { THEME_BG_HEX } from '../../../utils/colorContrast';

/**
 * 8-tile preview rendered on the actual game-bg color, with a dark/light
 * toggle that previews both themes WITHOUT changing the user's app theme.
 *
 * Tiles double as the customization editor: when an `onSlotClick` callback
 * is provided, each tile becomes a button that opens the picker for that
 * slot.
 */
const LivePreview = ({
    paletteForDark,    // resolved hex map for dark theme
    paletteForLight,   // resolved hex map for light theme
    initialPreviewTheme = 'dark',
    onSlotClick,       // optional (slotName) => void; when provided, tiles are interactive
}) => {
    const [previewTheme, setPreviewTheme] = useState(initialPreviewTheme);
    const palette = previewTheme === 'dark' ? paletteForDark : paletteForLight;
    const bgHex = THEME_BG_HEX[previewTheme];

    return (
        <div>
            {/* Theme toggle */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">
                    Your palette
                </span>
                <div className="inline-flex bg-theme-bg-elevated border border-theme-line rounded-lab overflow-hidden">
                    {[
                        { id: 'dark', label: 'Dark', icon: faMoon },
                        { id: 'light', label: 'Light', icon: faSun },
                    ].map((opt) => {
                        const active = previewTheme === opt.id;
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setPreviewTheme(opt.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono
                                    uppercase tracking-wider transition-colors duration-150
                                    ${active
                                        ? 'bg-theme-accent/15 text-theme-accent'
                                        : 'text-theme-text-muted hover:text-theme-text'}`}
                                aria-pressed={active}
                            >
                                <FontAwesomeIcon icon={opt.icon} className="h-3 w-3" />
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tile strip on actual bg */}
            <div
                className="rounded-lab border border-theme-line p-4"
                style={{ backgroundColor: bgHex }}
            >
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 justify-items-center">
                    {COLOR_NAMES.map((name, idx) => {
                        const tileSwatch = (
                            <div
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full shadow"
                                style={{ backgroundColor: palette[name] }}
                                aria-hidden={onSlotClick ? undefined : true}
                            />
                        );
                        const labelColor = previewTheme === 'dark' ? '#A39E96' : '#5C5955';
                        const label = (
                            <span className="text-[0.625rem] font-mono" style={{ color: labelColor }}>
                                {idx + 1}
                            </span>
                        );
                        if (onSlotClick) {
                            return (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => onSlotClick(name)}
                                    aria-label={`Swatch ${idx + 1}: ${(palette[name] || '').toUpperCase()}. Tap to customize.`}
                                    className="flex flex-col items-center gap-1 group focus:outline-none rounded-md
                                        focus-visible:ring-2 focus-visible:ring-theme-accent
                                        transition-transform duration-150 hover:scale-110"
                                >
                                    {tileSwatch}
                                    {label}
                                </button>
                            );
                        }
                        return (
                            <div key={name} className="flex flex-col items-center gap-1">
                                {tileSwatch}
                                {label}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default LivePreview;

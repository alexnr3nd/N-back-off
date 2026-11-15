/* src/components/settings/ColorPreferencesSection.js */
/* Inline color customization, embedded in the Appearance tab. */

import React, { useMemo, useState } from 'react';

import {
    useColorPreferences,
    useResolvedTheme,
} from '../../contexts/ColorPreferencesContext';
import {
    COLOR_NAMES,
    DEFAULT_PALETTE,
    CVD_SAFE_PALETTE,
    getPresetPalette,
} from '../../constants/colorPresets';

import PresetSelector from './colors/PresetSelector';
import LivePreview from './colors/LivePreview';
import ColorPickerModal from './colors/ColorPickerModal';

const ColorPreferencesSection = () => {
    const { paletteId, customPalette, savePreference } = useColorPreferences();
    const resolvedTheme = useResolvedTheme();
    const [pickerSlotName, setPickerSlotName] = useState(null);

    // Currently displayed palette (per-theme for presets; the user's hex map for custom)
    const currentPalette = useMemo(() => {
        if (paletteId === 'custom' && customPalette) {
            return customPalette;
        }
        return getPresetPalette(paletteId, resolvedTheme);
    }, [paletteId, customPalette, resolvedTheme]);

    // Preview palettes — show both themes regardless of which is active
    const previewPalettes = useMemo(() => {
        if (paletteId === 'custom' && customPalette) {
            return { dark: customPalette, light: customPalette };
        }
        if (paletteId === 'cvd-safe') {
            return { dark: CVD_SAFE_PALETTE.dark, light: CVD_SAFE_PALETTE.light };
        }
        return { dark: DEFAULT_PALETTE.dark, light: DEFAULT_PALETTE.light };
    }, [paletteId, customPalette]);

    // Materialize 8 canonical slots from a hex map
    const materializeFrom = (hexMap) => {
        const out = {};
        for (const name of COLOR_NAMES) {
            out[name] = hexMap[name];
        }
        return out;
    };

    const handlePresetSelect = (id) => {
        if (id === 'custom') {
            // Restore previously-saved custom palette if one exists; otherwise
            // materialize from the currently-active preset so the user has an
            // explicit hex map to start editing from.
            if (customPalette) {
                savePreference({ paletteId: 'custom' });
            } else {
                const seed = getPresetPalette(paletteId, resolvedTheme);
                savePreference({ paletteId: 'custom', customPalette: materializeFrom(seed) });
            }
            return;
        }
        // Switch to a preset WITHOUT clearing customPalette — the user can
        // round-trip back to Custom and find their saved values intact.
        savePreference({ paletteId: id });
    };

    const handleApplyHex = (slotName, newHex) => {
        if (paletteId === 'custom' && customPalette) {
            // In Custom mode: update one slot in the existing customPalette.
            savePreference({
                paletteId: 'custom',
                customPalette: { ...customPalette, [slotName]: newHex },
            });
        } else {
            // Auto-promote: user edited a tile while on a preset. Materialize
            // the currently-displayed preset and set the edited slot.
            const presetHex = getPresetPalette(paletteId, resolvedTheme);
            savePreference({
                paletteId: 'custom',
                customPalette: { ...materializeFrom(presetHex), [slotName]: newHex },
            });
        }
        setPickerSlotName(null);
    };

    // For the picker modal's "Reset to preset" link: only meaningful when on
    // a preset. In Custom mode pass null and the link hides.
    const presetHexForActiveSlot = pickerSlotName && paletteId !== 'custom'
        ? getPresetPalette(paletteId, resolvedTheme)[pickerSlotName]
        : null;

    return (
        <div className="space-y-4">
            <div>
                <span className="text-sm font-mono text-theme-text">Stimulus Colors</span>
                <span className="block text-xs text-theme-text-muted mt-1 font-mono">
                    Choose a preset or tap any swatch in the preview to customize it.
                </span>
            </div>

            <PresetSelector
                paletteId={paletteId}
                onSelectPreset={handlePresetSelect}
            />

            <LivePreview
                paletteForDark={previewPalettes.dark}
                paletteForLight={previewPalettes.light}
                initialPreviewTheme={resolvedTheme}
                onSlotClick={(slotName) => setPickerSlotName(slotName)}
            />

            <div className="font-mono text-theme-text-muted leading-relaxed space-y-3">
                <p className="text-xs">
                    Changes save automatically. Sessions store the colors you saw at play time,
                    so replays always render with the original palette.
                    {paletteId === 'custom' && ' Custom colors apply to both light and dark mode.'}
                </p>
                {paletteId === 'cvd-safe' && (
                    <p className="text-xs">
                        The Color-blind friendly preset uses the Okabe-Ito palette (Wong, Nature
                        Methods 2011), designed so all 8 colors stay distinguishable under
                        deuteranopia, protanopia, and tritanopia. Some pairs (e.g. the two blues,
                        the two oranges) look similar to normal vision but read as distinct to
                        users with color-vision deficiency.
                    </p>
                )}
            </div>

            <ColorPickerModal
                isOpen={pickerSlotName !== null}
                initialHex={pickerSlotName ? currentPalette[pickerSlotName] : '#000000'}
                presetHex={presetHexForActiveSlot}
                slotLabel={pickerSlotName ? `Swatch ${COLOR_NAMES.indexOf(pickerSlotName) + 1}` : ''}
                onApply={(newHex) => {
                    if (pickerSlotName) handleApplyHex(pickerSlotName, newHex);
                }}
                onClose={() => setPickerSlotName(null)}
            />
        </div>
    );
};

export default ColorPreferencesSection;

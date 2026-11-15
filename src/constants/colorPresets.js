/* src/constants/colorPresets.js */
/* Stimulus color palettes for the customization feature.
 *
 * Slot names (red, blue, ...) are internal identifiers — the sequence
 * generator and replay data store these as opaque tokens. Under the
 * CVD-safe preset, the rendered hex no longer matches the slot name
 * (e.g., 'red' renders as vermillion #D55E00). Slot names are never
 * shown to users; the customization UI displays "Swatch 1" through
 * "Swatch 8" with hex values.
 *
 * Legacy color names (yellow, cyan, magenta) are included in every
 * palette so old replay data — which may reference them — continues
 * to render correctly through the boundary normalizer.
 *
 * Validation: 28 pairs >= dE 10 across deuteranopia/protanopia/
 * tritanopia for both dark and light CVD-safe palettes. Mustard
 * #998200 sits at 3.78:1 contrast on the light bg — documented
 * exception (passes WCAG 3:1 floor for graphical objects).
 */

export const COLOR_NAMES = ['red', 'blue', 'green', 'gold', 'purple', 'teal', 'orange', 'white'];
export const LEGACY_COLOR_NAMES = ['yellow', 'cyan', 'magenta'];

const LEGACY = {
    yellow: '#eab308',
    cyan: '#06b6d4',
    magenta: '#ec4899',
};

export const DEFAULT_PALETTE = {
    dark: {
        red: '#D93526',
        blue: '#2962FF',
        green: '#1B9E42',
        gold: '#A8A800',
        purple: '#8E24AA',
        teal: '#0097A7',
        orange: '#E8710A',
        white: '#F0ECE6',
        ...LEGACY,
    },
    light: {
        red: '#D93526',
        blue: '#2962FF',
        green: '#1B9E42',
        gold: '#A8A800',
        purple: '#8E24AA',
        teal: '#0097A7',
        orange: '#E8710A',
        white: '#1A1815',
        ...LEGACY,
    },
};

// True Okabe-Ito palette (Wong 2011, Nature Methods) — the canonical CVD-safe
// 8-color set. The two blues (#0072B2 + #56B4E9) and two oranges (#D55E00 +
// #E69F00) read as visually clustered to normal vision but are distinguishable
// to users with deuteranopia, protanopia, and tritanopia (the actual audience
// for this preset). The single substitution is #000000 → #DDDDDD for the
// neutral slot, since pure black is invisible against the dark theme bg.
//
// Light-theme variants darken the slots that fail WCAG 3:1 contrast against
// the cream bg (#FDFBF8). Slot identity is preserved across themes; lightness
// is adjusted, hue family is not.
export const CVD_SAFE_PALETTE = {
    dark: {
        red: '#D55E00',
        blue: '#0072B2',
        green: '#009E73',
        gold: '#F0E442',
        purple: '#CC79A7',
        teal: '#56B4E9',
        orange: '#E69F00',
        white: '#DDDDDD',
        ...LEGACY,
    },
    light: {
        red: '#B84F00',
        blue: '#0072B2',
        green: '#117733',
        gold: '#998200',
        purple: '#A14B7D',
        teal: '#1F6FA8',
        orange: '#B45A1F',
        white: '#1A1A1A',
        ...LEGACY,
    },
};

export const PALETTE_IDS = ['default', 'cvd-safe', 'custom'];

/**
 * Resolve a paletteId + theme to a concrete hex map.
 * Custom palettes are caller's responsibility (they already have explicit hex).
 *
 * @param {string} paletteId 'default' | 'cvd-safe'
 * @param {string} theme 'dark' | 'light'
 * @returns {Object} hex map (8 canonical keys + 3 legacy keys)
 */
export function getPresetPalette(paletteId, theme) {
    const safeTheme = theme === 'light' ? 'light' : 'dark';
    if (paletteId === 'cvd-safe') return CVD_SAFE_PALETTE[safeTheme];
    return DEFAULT_PALETTE[safeTheme];
}

/**
 * Stable, non-cryptographic identity for a palette — joins canonical-order
 * hex values with a delimiter. Used as paletteHash for analytics bucketing.
 * Small enough to be human-readable in Firestore.
 *
 * @param {Object} palette hex map
 * @returns {string|null}
 */
export function computePaletteFingerprint(palette) {
    if (!palette || typeof palette !== 'object') return null;
    return COLOR_NAMES.map((name) => String(palette[name] || '').toUpperCase()).join('|');
}

/* src/utils/colorContrast.js */
/* WCAG 2.x contrast ratio computation for color customization advisories. */

/**
 * Parse a hex color (#RRGGBB or #RGB) to an [r, g, b] tuple in 0-255.
 * Returns null if the input doesn't parse cleanly.
 */
export function parseHex(hex) {
    if (typeof hex !== 'string') return null;
    let h = hex.trim();
    if (h.startsWith('#')) h = h.slice(1);
    if (h.length === 3) {
        h = h.split('').map(c => c + c).join('');
    }
    if (h.length !== 6) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return [r, g, b];
}

/**
 * Relative luminance per WCAG 2.x: L = 0.2126*R + 0.7152*G + 0.0722*B
 * with sRGB gamma correction.
 */
function relativeLuminance([r, g, b]) {
    const channel = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * WCAG contrast ratio between two hex colors.
 * Result is in [1.0, 21.0]. Returns NaN if either input is invalid.
 *
 * Threshold guidance:
 *  - 3:1   = WCAG 2.x SC 1.4.11 minimum for non-text graphical objects
 *  - 4.5:1 = WCAG 2.x SC 1.4.3 minimum for normal text
 *  - 7:1   = WCAG 2.x SC 1.4.6 enhanced
 */
export function wcagContrast(hex1, hex2) {
    const a = parseHex(hex1);
    const b = parseHex(hex2);
    if (!a || !b) return NaN;
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const lighter = Math.max(la, lb);
    const darker = Math.min(la, lb);
    return (lighter + 0.05) / (darker + 0.05);
}

/* Theme background hex values used by the contrast advisory.
 * Mirrors the resolved values of --color-bg-primary in index.css.
 */
export const THEME_BG_HEX = {
    dark: '#0D0B09',   // rgb(13 11 9)
    light: '#FDFBF8',  // rgb(253 251 248)
};

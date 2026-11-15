/* src/utils/textScale.js */
/**
 * Text Size (Settings > Appearance > Text Size).
 *
 * The whole feature hangs off one attribute on <html>. Every CSS rule that
 * implements it is scoped under `html[data-text-scale…]` (see src/index.css), so
 * a user who never enables the setting carries NO attribute, matches NO rule, and
 * sees the site exactly as before. That is why 'default' — and anything invalid —
 * REMOVES the attribute rather than setting a sentinel value: an attribute of
 * `data-text-scale="default"` would still match `html[data-text-scale]` selectors.
 *
 * Kept pure and dependency-free so it can be called from the SettingsProvider
 * effect, from the settings page's live preview, and from tests. The pre-paint
 * script in public/index.html mirrors the same logic inline (it must run before
 * any bundle loads); keep the two in step.
 */

/** The attribute stamped on document.documentElement. */
export const TEXT_SCALE_ATTR = 'data-text-scale';

/** The stored/persisted values, in display order. */
export const TEXT_SCALE_OPTIONS = ['default', 'large', 'larger'];

/**
 * Coerce any stored value to a known option.
 * @param {*} value
 * @returns {'default'|'large'|'larger'}
 */
export const normalizeTextScale = (value) => (
    TEXT_SCALE_OPTIONS.includes(value) ? value : 'default'
);

/**
 * Set or clear the root attribute. 'default' (or anything invalid) clears it.
 * @param {*} value
 * @param {Element} [root] defaults to <html>
 */
export const applyTextScale = (value, root = document.documentElement) => {
    if (!root) return;
    const normalized = normalizeTextScale(value);
    if (normalized === 'default') {
        root.removeAttribute(TEXT_SCALE_ATTR);
    } else {
        root.setAttribute(TEXT_SCALE_ATTR, normalized);
    }
};

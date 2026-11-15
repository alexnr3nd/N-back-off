/* src/components/admin/ui/adminStyles.js */
/**
 * Shared Tailwind class strings for the admin panel (Cognitive Lab theme).
 *
 * Note: the index.css base layer forces styles on every <input> (padding, a charcoal
 * border, a softer corner radius, an amber focus ring), so INPUT must explicitly
 * re-specify border-theme-line and rounded-lab in order to win.
 */

export const EYEBROW = 'text-xs font-mono uppercase tracking-[0.2em] text-theme-text-muted';
export const LABEL = 'block text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-1';
export const INPUT = 'w-full px-3 py-2 bg-theme-bg-elevated border border-theme-line rounded-lab text-sm text-theme-text placeholder-theme-text-muted focus:outline-none focus:ring-1 focus:ring-theme-accent/50 focus:border-theme-accent';
export const SELECT = `${INPUT} appearance-none cursor-pointer`;
export const TEXTAREA = `${INPUT} leading-relaxed`;
export const LINK = 'text-theme-accent hover:text-amber-highlight underline-offset-2 hover:underline transition-colors';
export const DL_TERM = 'text-[0.6875rem] font-mono uppercase tracking-wider text-theme-text-muted';
export const DL_VALUE = 'text-sm text-theme-text font-mono mt-0.5';
export const AVATAR = 'flex-shrink-0 flex items-center justify-center rounded-lab bg-theme-accent/15 border border-theme-accent/30 text-theme-accent font-mono';

/* File: src/constants/modeStyles.js */
/* Shared UI constants for game-mode presentation.
 *
 * Consolidates labels, colors, and modality lists that were previously
 * duplicated across ~10 components (ModeSelector, StatsFilter,
 * ProfileDashboard, the Insights hooks/cards, etc.).
 *
 * Different contexts use different color palettes for the same mode:
 *   - Filter-pill style (ModeSelector / StatsFilter / ProfileDashboard)
 *     uses yellow/purple/cyan tailwind pairs.
 *   - Insights-card style (PersonalBestCard / LevelUpMomentsCard) uses
 *     text-theme-accent for dual and keeps purple/cyan for triple/quad.
 *   - Recharts (LevelTrajectoryChart) needs hex / CSS-var strings.
 *
 * When adding a new mode, add entries to MODE_LABELS, MODE_FILTER_COLORS,
 * MODE_CARD_COLORS, MODE_CHART_COLORS, and MODE_MODALITIES together.
 */

// Canonical ordered list of primary game modes.
// NOTE: 'singleColorRecall' is deliberately ABSENT here and from SINGLE_MODE_KEYS —
// it is an internal session gameMode resolved at game start (singleColor + Recall
// response-mode setting), never a selectable activeGameMode. Do not "fix" the
// asymmetry with the label maps below.
export const MODE_KEYS = ['dual', 'triple', 'quad', 'dynamic', 'singleVisual', 'singleAudio', 'singleColor', 'singleShape'];

// Just the four single-modality modes.
export const SINGLE_MODE_KEYS = ['singleVisual', 'singleAudio', 'singleColor', 'singleShape'];

// Human labels per mode.
export const MODE_LABELS = {
    dual: 'Dual',
    triple: 'Triple',
    quad: 'Quad',
    dynamic: 'Dynamic',
    single: 'Single',
    singleVisual: 'Single Position',
    singleAudio: 'Single Audio',
    singleColor: 'Single Color',
    singleColorRecall: 'Color Recall',
    singleShape: 'Single Shape',
};

// Compact labels for crowded UIs (filter bars, etc.).
export const MODE_SHORT_LABELS = {
    dual: 'Dual',
    triple: 'Triple',
    quad: 'Quad',
    dynamic: 'Dynamic',
    single: 'Single',
    singleVisual: 'S-Position',
    singleAudio: 'S-Audio',
    singleColor: 'S-Color',
    singleColorRecall: 'S-Recall',
    singleShape: 'S-Shape',
};

// Font Awesome icon classes per mode.
export const MODE_ICONS = {
    dual: 'fa-solid fa-grip',
    triple: 'fa-solid fa-layer-group',
    quad: 'fa-solid fa-bullseye',
    dynamic: 'fa-solid fa-shuffle',
    singleVisual: 'fa-solid fa-location-dot',
    singleAudio: 'fa-solid fa-volume-high',
    singleColor: 'fa-solid fa-palette',
    singleColorRecall: 'fa-solid fa-eye-dropper',
    singleShape: 'fa-solid fa-shapes',
};

// Filter-pill colors: used by ModeSelector / StatsFilter / ProfileDashboard.
// "active" is the bg+text class pair applied when the pill is selected.
// "indicator" is the underline bar shown beneath the active pill.
export const MODE_FILTER_COLORS = {
    dual:    { active: 'bg-yellow-500/20 text-yellow-400', indicator: 'bg-yellow-400' },
    triple:  { active: 'bg-purple-500/20 text-purple-400', indicator: 'bg-purple-400' },
    quad:    { active: 'bg-cyan-500/20 text-cyan-400',     indicator: 'bg-cyan-400'   },
    dynamic: { active: 'bg-theme-accent/20 text-theme-accent', indicator: 'bg-theme-accent' },
    // "all" filter reuses the dual (yellow) palette — matches prior behavior
    // in StatsFilter.js and ProfileDashboard.js.
    all:     { active: 'bg-yellow-500/20 text-yellow-400', indicator: 'bg-yellow-400' },
    // Singles: match the modality colors used by the Insights charts
    // (responseTimeShared.js MODALITY_COLORS) — visual=accent, audio=blue,
    // color=purple, shape=cyan. Intentional overlap with Dual/Triple/Quad
    // pill colors: the modality-color mapping wins here so singles are
    // instantly recognizable by their modality.
    singleVisual: { active: 'bg-theme-accent/20 text-theme-accent', indicator: 'bg-theme-accent' },
    singleAudio:  { active: 'bg-blue-500/20 text-blue-400',   indicator: 'bg-blue-400'    },
    singleColor:  { active: 'bg-purple-500/20 text-purple-400', indicator: 'bg-purple-400' },
    singleColorRecall: { active: 'bg-purple-500/20 text-purple-400', indicator: 'bg-purple-400' },
    singleShape:  { active: 'bg-cyan-500/20 text-cyan-400',   indicator: 'bg-cyan-400'    },
    // "single" parent pill (aggregate of the four singles) — emerald keeps
    // it visually distinct from the four modality-colored sub-pills
    // (yellow/blue/purple/cyan) and from the existing Dual/Triple/Quad/
    // Dynamic mode colors, while staying cool-toned to harmonize with the
    // rest of the palette on the dark theme.
    single:       { active: 'bg-emerald-500/20 text-emerald-400', indicator: 'bg-emerald-400' },
};

// Insights-card colors: used by PersonalBestCard / LevelUpMomentsCard.
// Dual uses the theme accent (yellow by default) rather than a hard-coded
// yellow, so it follows the user's active theme.
export const MODE_CARD_COLORS = {
    dual:   { color: 'text-theme-accent', border: 'border-theme-accent/40' },
    triple: { color: 'text-purple-400',   border: 'border-purple-500/40'   },
    quad:   { color: 'text-cyan-400',     border: 'border-cyan-500/40'     },
    // 'single' aggregate — emerald keeps it visually distinct from the
    // four modality-colored sub-modes. Individual singles mirror Insights
    // modality colors (responseTimeShared.js MODALITY_COLORS).
    single:       { color: 'text-emerald-400', border: 'border-emerald-500/40' },
    singleVisual: { color: 'text-theme-accent', border: 'border-theme-accent/40' },
    singleAudio:  { color: 'text-blue-400',    border: 'border-blue-500/40'    },
    singleColor:  { color: 'text-purple-400',  border: 'border-purple-500/40'  },
    singleColorRecall: { color: 'text-purple-400', border: 'border-purple-500/40' },
    singleShape:  { color: 'text-cyan-400',    border: 'border-cyan-500/40'    },
};

// Recharts stroke / fill colors. LevelTrajectoryChart needs raw color
// strings (not tailwind classes). Uses the CSS variable for dual so it
// follows the active theme.
export const MODE_CHART_COLORS = {
    dual:   'rgb(var(--color-accent))',
    triple: '#c084fc',
    quad:   '#22d3ee',
    // 'single' aggregate is emerald to keep it distinct from the four
    // modality-colored sub-modes. Individual singles match the modality
    // colors used in the Strengths charts (responseTimeShared.js
    // MODALITY_COLORS) so Visual/Audio/Color/Shape read consistently
    // across the app.
    single:        '#34d399',
    singleVisual:  'rgb(var(--color-accent))',
    singleAudio:   '#60a5fa',
    singleColor:   '#c084fc',
    singleColorRecall: '#c084fc',
    singleShape:   '#22d3ee',
};

// Modality keys valid for each game mode (frontend view — independent of
// the sequence-generator's spatial/audio/color/shape arrays in
// functions/gameConstants.js).
export const MODE_MODALITIES = {
    dual:   ['visual', 'audio'],
    triple: ['visual', 'audio', 'color'],
    quad:   ['visual', 'audio', 'color', 'shape'],
    singleVisual: ['visual'],
    singleAudio:  ['audio'],
    singleColor:  ['color'],
    singleColorRecall: ['color'],
    singleShape:  ['shape'],
};

// {key, label} option lists for segmented / pill controls.
// GAME_MODE_OPTIONS excludes "dynamic" and "all" — it's the set of game
// modes the Insights page filters cover (dual/triple/quad).
// Singles live under a separate "single" parent pill (see SINGLE_MODE_OPTIONS).
export const GAME_MODE_OPTIONS = [
    { key: 'dual',   label: MODE_LABELS.dual   },
    { key: 'triple', label: MODE_LABELS.triple },
    { key: 'quad',   label: MODE_LABELS.quad   },
];

export const GAME_MODE_KEYS = GAME_MODE_OPTIONS.map(o => o.key);

// Sub-options shown when the "Single" parent pill is active.
// In sub-row context the parent already says "Single", so drop the "S-"
// prefix and just show the modality name ("Visual" / "Audio" / ...).
const SINGLE_SUB_LABELS = {
    singleVisual: 'Position',
    singleAudio: 'Audio',
    singleColor: 'Color',
    singleShape: 'Shape',
};
export const SINGLE_MODE_OPTIONS = SINGLE_MODE_KEYS.map(k => ({
    key: k,
    label: SINGLE_SUB_LABELS[k] || MODE_SHORT_LABELS[k],
}));

// Options for the dashboard/ProfileDashboard mode filter: includes "all".
// Each option carries its pill+indicator classes for inline rendering.
export const MODE_FILTER_OPTIONS = [
    { key: 'single', label: 'Single',           activeColor: MODE_FILTER_COLORS.single.active, indicator: MODE_FILTER_COLORS.single.indicator },
    { key: 'dual',   label: MODE_LABELS.dual,   activeColor: MODE_FILTER_COLORS.dual.active,   indicator: MODE_FILTER_COLORS.dual.indicator   },
    { key: 'triple', label: MODE_LABELS.triple, activeColor: MODE_FILTER_COLORS.triple.active, indicator: MODE_FILTER_COLORS.triple.indicator },
    { key: 'quad',   label: MODE_LABELS.quad,   activeColor: MODE_FILTER_COLORS.quad.active,   indicator: MODE_FILTER_COLORS.quad.indicator   },
    { key: 'all',    label: 'All',              activeColor: MODE_FILTER_COLORS.all.active,    indicator: MODE_FILTER_COLORS.all.indicator    },
];

// Predicate: is this a single-modality mode key?
export const isSingleMode = (key) => SINGLE_MODE_KEYS.includes(key);

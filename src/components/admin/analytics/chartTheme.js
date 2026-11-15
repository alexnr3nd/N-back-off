/* src/components/admin/analytics/chartTheme.js */
/* Recharts needs concrete color strings; SVG presentation attributes accept
 * var(), so these follow the active theme with no JS. Same pattern as
 * src/constants/modeStyles.js MODE_CHART_COLORS. */
export const CHART = {
    grid:   'rgb(var(--color-line))',
    axis:   'rgb(var(--color-text-muted))',
    text:   'rgb(var(--color-text-secondary))',
    accent: 'rgb(var(--color-accent))',
    blue:   'rgb(var(--color-neural-blue))',
    green:  'rgb(var(--color-neural-green))',
    red:    'rgb(var(--color-neural-red))',
};

export const SERIES = [CHART.accent, CHART.blue, '#c084fc', '#22d3ee', CHART.green];

export const accentRamp = (i, n) =>
    `rgb(var(--color-accent) / ${(0.35 + 0.65 * (n <= 1 ? 1 : i / (n - 1))).toFixed(2)})`;

export const AXIS_TICK = { fontSize: 11, fill: CHART.axis, fontFamily: "'Space Mono', monospace" };
export const GRID_PROPS = { stroke: CHART.grid, strokeOpacity: 0.4, strokeDasharray: '2 3' };
export const BAR_RADIUS = [2, 2, 0, 0];
export const TOOLTIP_CLASS = 'bg-theme-bg-elevated border border-theme-line rounded-lab px-3 py-2 text-xs font-mono shadow-lab';

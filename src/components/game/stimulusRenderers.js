/* src/components/game/stimulusRenderers.js */
/* Shared stimulus rendering helpers used by PositionGrid. */

import React from 'react';
import ShapeIcon from './ShapeIcon';

// Color mapping for triple mode colored dots (hex for inline styles)
// Kept in sync with the map in ShapeIcon.js.
export const colorToHex = {
  // Active colors (colorblind-safe)
  red: '#D93526',
  blue: '#2962FF',
  green: '#1B9E42',
  gold: '#A8A800',
  purple: '#8E24AA',
  teal: '#0097A7',
  orange: '#E8710A',
  white: 'rgb(var(--color-stimulus-white))',
  // Legacy colors (for old replay data)
  yellow: '#eab308',
  cyan: '#06b6d4',
  magenta: '#ec4899',
};

/**
 * renderStimulusForMode - Produce the JSX for a visual stimulus cell,
 * branching on the current game mode.
 *
 * This function is a verbatim extraction of the mode-aware rendering
 * previously inlined in PositionGrid.js. Inputs are intentionally minimal
 * so it can be reused by any view that presents a position stimulus
 * (2D grid, 3D room, etc.).
 *
 * @param {Object}  params
 * @param {string}  params.gameMode  'dual' | 'triple' | 'quad'
 * @param {?string} params.stimColor Color name from stimulus (e.g., 'red'). Nullable.
 * @param {?string} params.stimShape Shape name from stimulus (e.g., 'circle'). Nullable.
 * @param {boolean} params.isPulsing Whether to apply the lab-pulse animation.
 * @param {string}  params.dotColor  Tailwind bg-* class applied to the dual-mode amber dot.
 * @param {Object}  [params.palette] Color name -> hex map. Defaults to the legacy
 *                                    colorToHex constant for backwards compat
 *                                    with call sites that haven't been updated.
 * @returns {React.ReactNode}
 */
export function renderStimulusForMode({
  gameMode,
  stimColor,
  stimShape,
  isPulsing,
  dotColor,
  palette = colorToHex,
}) {
  // Quad mode: Render colored shape
  if (gameMode === 'quad' && stimShape && stimColor) {
    return (
      <div
        className={`
          w-[50%] h-[50%]
          flex items-center justify-center
          ${isPulsing ? 'lab-pulse-animation' : ''}
          transition-all duration-150
        `}
      >
        <ShapeIcon
          shape={stimShape}
          color={stimColor}
          size={64}
          className="w-full h-full"
          palette={palette}
        />
      </div>
    );
  }

  // Triple mode: Render colored dot
  if (gameMode === 'triple' && stimColor) {
    return (
      <div
        className={`
          w-[50%] h-[50%] rounded-full
          ${isPulsing ? 'lab-pulse-animation' : ''}
          transition-all duration-150
        `}
        style={{ backgroundColor: palette[stimColor] || colorToHex[stimColor] || '#D97706' }}
        aria-hidden="true"
      />
    );
  }

  // Dual mode (default): Render amber dot
  return (
    <div
      className={`
        w-[50%] h-[50%] rounded-full
        ${dotColor}
        ${isPulsing ? 'lab-pulse-animation' : ''}
        transition-all duration-150
      `}
      aria-hidden="true"
    />
  );
}

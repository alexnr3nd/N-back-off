/* File: src/components/game/ShapeIcon.js */
/* SVG shape renderer for Quad N-Back mode */

import React from 'react';

// Color mapping from stimulus color names to CSS colors
const colorMap = {
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
 * ShapeIcon - Renders one of 8 shapes with a specified color
 * Used in Quad N-Back mode where the shape itself is the stimulus
 */
const ShapeIcon = ({
  shape,
  color = 'amber',
  size = 48,
  className = '',
  animated = false,
  palette,
}) => {
  // Prefer the per-session/per-user palette (color customization). Fall back
  // to the local legacy colorMap for: (1) call sites that haven't been updated
  // to pass a palette, and (2) old replay data that uses legacy color names
  // (yellow/cyan/magenta) — those keys are also in modern palette objects.
  const fillColor = (palette && palette[color]) || colorMap[color] || color;

  const commonProps = {
    fill: fillColor,
    stroke: 'none',
  };

  // If className contains width/height utilities, let CSS handle sizing
  const usesCssSizing = className.includes('w-') || className.includes('h-');

  const svgProps = {
    width: usesCssSizing ? '100%' : size,
    height: usesCssSizing ? '100%' : size,
    viewBox: '0 0 48 48',
    className: `${className} ${animated ? 'animate-pulse' : ''}`.trim(),
    style: { display: 'block' }
  };

  const renderShape = () => {
    switch (shape) {
      case 'circle':
        return (
          <svg {...svgProps}>
            <circle cx="24" cy="24" r="20" {...commonProps} />
          </svg>
        );

      case 'square':
        return (
          <svg {...svgProps}>
            <rect x="4" y="4" width="40" height="40" rx="2" {...commonProps} />
          </svg>
        );

      case 'triangle':
        return (
          <svg {...svgProps}>
            <polygon points="24,4 44,44 4,44" {...commonProps} />
          </svg>
        );

      case 'diamond':
        return (
          <svg {...svgProps}>
            <polygon points="24,2 46,24 24,46 2,24" {...commonProps} />
          </svg>
        );

      case 'star':
        // 5-pointed star
        return (
          <svg {...svgProps}>
            <polygon
              points="24,2 29,18 46,18 33,28 38,44 24,34 10,44 15,28 2,18 19,18"
              {...commonProps}
            />
          </svg>
        );

      case 'cross':
        return (
          <svg {...svgProps}>
            <path
              d="M18,4 L30,4 L30,18 L44,18 L44,30 L30,30 L30,44 L18,44 L18,30 L4,30 L4,18 L18,18 Z"
              {...commonProps}
            />
          </svg>
        );

      case 'heart':
        return (
          <svg {...svgProps}>
            <path
              d="M24,44 C24,44 4,30 4,16 C4,9 9,4 16,4 C20,4 23,6 24,9 C25,6 28,4 32,4 C39,4 44,9 44,16 C44,30 24,44 24,44 Z"
              {...commonProps}
            />
          </svg>
        );

      case 'arrow':
        return (
          <svg {...svgProps}>
            <polygon
              points="6,18 30,18 30,6 46,24 30,42 30,30 6,30"
              {...commonProps}
            />
          </svg>
        );

      case 'pentagon':
        // Legacy shape (for old replay data)
        return (
          <svg {...svgProps}>
            <polygon
              points="24,4 44,18 38,42 10,42 4,18"
              {...commonProps}
            />
          </svg>
        );

      case 'hexagon':
        // Legacy shape (for old replay data)
        return (
          <svg {...svgProps}>
            <polygon
              points="24,4 42,14 42,34 24,44 6,34 6,14"
              {...commonProps}
            />
          </svg>
        );

      default:
        // Fallback to circle
        return (
          <svg {...svgProps}>
            <circle cx="24" cy="24" r="20" {...commonProps} />
          </svg>
        );
    }
  };

  return renderShape();
};

export default ShapeIcon;

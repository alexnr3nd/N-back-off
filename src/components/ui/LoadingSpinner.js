/* src/components/ui/LoadingSpinner.js */
import React, { useState, useEffect, useRef } from 'react';

// Dark theme colors (hardcoded for dark-only pages)
// Note: Keep in sync with LoadingScreen.js
const DARK_COLORS = {
  bg: '#0D0B09',
  elevated: '#1E1B18',
  line: '#3A352F',
  text: '#A39E96',
  accent: '#E4B85C',
};

/**
 * N-back themed loading spinner with 3x3 grid animation.
 * One square lights up at a time in random positions.
 *
 * @param {string} theme - "dark" (default, hardcoded dark) or "auto" (uses CSS variables for theme-aware)
 */
const LoadingSpinner = ({
  message,
  small = false,
  fullScreen = false,
  className = "",
  containerHeight = null,
  theme = "dark", // "dark" = hardcoded dark colors, "auto" = CSS variables
}) => {
  const [activeCell, setActiveCell] = useState(null);
  const lastCell = useRef(null);

  useEffect(() => {
    const pickRandomCell = () => {
      const outerCells = [0, 1, 2, 3, 5, 6, 7, 8];
      let newCell;
      do {
        newCell = outerCells[Math.floor(Math.random() * outerCells.length)];
      } while (newCell === lastCell.current);
      lastCell.current = newCell;
      setActiveCell(newCell);

      // Turn off after duration
      setTimeout(() => setActiveCell(null), 400);
    };

    // Initial flash after short delay
    const initialTimeout = setTimeout(pickRandomCell, 100);

    // Continue flashing - slower pace with clear gaps
    const interval = setInterval(pickRandomCell, 1000);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const cellSize = small ? 8 : 24;
  const gap = small ? 2 : 6;
  const gridSize = cellSize * 3 + gap * 2;

  // Color values based on theme
  // Note: For "auto" theme, we use --color-line for inactive tiles instead of --color-bg-elevated
  // because in light mode, elevated is too close to the background color
  // CSS variables contain RGB values (e.g., "201 196 186") so we wrap them in rgb()
  const colors = theme === "auto" ? {
    bg: 'rgb(var(--color-bg-primary))',
    tile: 'rgb(var(--color-line))',           // Inactive tile background - use line for better contrast
    tileBorder: 'rgb(var(--color-text-muted))',   // Inactive tile border - text-muted contrasts with tile in both themes
    text: 'rgb(var(--color-text-secondary))',
    accent: 'rgb(var(--color-accent))',
  } : {
    ...DARK_COLORS,
    tile: DARK_COLORS.elevated,
    tileBorder: DARK_COLORS.line,
  };

  const containerClasses = fullScreen
    ? `fixed inset-0 flex items-center justify-center z-50 ${className}`
    : `flex items-center justify-center p-4 ${className}`;

  const containerStyle = {
    ...(containerHeight ? { height: containerHeight } : {}),
    ...(fullScreen ? { backgroundColor: colors.bg } : {}),
  };

  return (
    <div className={containerClasses} style={containerStyle}>
      {fullScreen && (
        <div className="absolute inset-0 lab-grid opacity-30 pointer-events-none" />
      )}

      <div className="relative flex flex-col items-center gap-4">
        <div
          className="grid grid-cols-3"
          style={{ gap: `${gap}px`, width: gridSize, height: gridSize }}
        >
          {[...Array(9)].map((_, i) => {
            if (i === 4) {
              return (
                <div
                  key={i}
                  className="flex items-center justify-center"
                  style={{ width: cellSize, height: cellSize }}
                >
                  {!small && <span style={{ color: colors.tileBorder, fontSize: 14, fontWeight: 300, userSelect: 'none' }}>+</span>}
                </div>
              );
            }
            const isActive = activeCell === i;
            return (
              <div
                key={i}
                className="rounded-sm"
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: isActive ? colors.accent : colors.tile,
                  border: `1px solid ${isActive ? colors.accent : colors.tileBorder}`,
                  boxShadow: isActive ? '0 0 8px rgba(228, 184, 92, 0.6)' : 'none',
                  transition: 'all 0.08s ease-out',
                }}
              />
            );
          })}
        </div>

        {message && (
          <p
            className={`${small ? 'text-xs' : 'text-base'} font-serif italic`}
            style={{ color: colors.text }}
            role="status"
          >
            {message.replace(/\.+$/, '')}<span className="loading-dots"></span>
          </p>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;

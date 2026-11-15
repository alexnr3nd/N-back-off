/* File: src/components/dashboard/ModeSelector.js */
/* Mode selector tabs for switching between Dual, Triple, Quad, Dynamic, and Single N-Back modes */

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../../contexts/UserContext';
import {
  MODE_FILTER_COLORS,
  MODE_LABELS,
  MODE_ICONS,
  SINGLE_MODE_KEYS,
} from '../../constants/modeStyles';
import DynamicModeExplainer from './DynamicModeExplainer';

const SINGLES_STORAGE_KEY = 'modeSelectorSinglesExpanded';
const LAST_SINGLE_STORAGE_KEY = 'modeSelectorLastSingleMode';

// Read the last single-mode the user was on (persisted in localStorage).
// Falls back to singleVisual if nothing stored or storage unavailable.
const readLastSingleMode = () => {
  try {
    const stored = window.localStorage.getItem(LAST_SINGLE_STORAGE_KEY);
    if (SINGLE_MODE_KEYS.includes(stored)) return stored;
  } catch (e) {
    // localStorage unavailable
  }
  return 'singleVisual';
};

// Short names shown in the expanded sub-row (the group header already says
// "Single N-Back", so we drop the "Single" prefix to reduce redundancy).
const SINGLE_SUB_LABELS = {
  singleVisual: 'Position',
  singleAudio: 'Audio',
  singleColor: 'Color',
  singleShape: 'Shape',
};

// Longer hover descriptions for the sub-pills — useful for discoverability.
const SINGLE_SUB_DESCRIPTIONS = {
  singleVisual: 'Single modality: Position',
  singleAudio: 'Single modality: Audio',
  singleColor: 'Single modality: Color',
  singleShape: 'Single modality: Shape',
};

const readInitialSinglesExpanded = (activeGameMode) => {
  if (typeof activeGameMode === 'string' && activeGameMode.startsWith('single')) {
    return true;
  }
  try {
    const stored = window.localStorage.getItem(SINGLES_STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch (e) {
    // localStorage unavailable (SSR, privacy mode, etc.) — fall through to default.
  }
  return false;
};

/**
 * ModeSelector - Tab-style mode switcher for the dashboard
 * Allows users to switch between Dual, Triple, Quad, Dynamic, and the four
 * Single-modality N-Back modes.
 */

const ModeSelector = () => {
  const {
    activeGameMode,
    switchGameMode,
    isLoading,
  } = useUser();

  const modes = [
    { key: 'dual', label: 'Dual', description: 'Position + Audio' },
    { key: 'triple', label: 'Triple', description: 'Position + Audio + Color' },
    { key: 'quad', label: 'Quad', description: 'Position + Audio + Color + Shape' },
    { key: 'dynamic', label: 'Dynamic', description: 'Dual → Triple → Quad Progressive' },
  ];

  const isSingleActive = typeof activeGameMode === 'string' && activeGameMode.startsWith('single');

  const [singlesExpanded, setSinglesExpanded] = useState(() => readInitialSinglesExpanded(activeGameMode));

  // Keep the sub-row in sync with the active mode: expand when a single is
  // active, collapse when switching back to a non-single mode.
  useEffect(() => {
    setSinglesExpanded(isSingleActive);
  }, [isSingleActive]);

  // Persist expand/collapse state.
  useEffect(() => {
    try {
      window.localStorage.setItem(SINGLES_STORAGE_KEY, singlesExpanded ? 'true' : 'false');
    } catch (e) {
      // Ignore — storage unavailable.
    }
  }, [singlesExpanded]);

  const handleModeClick = useCallback((modeKey) => {
    if (!isLoading && modeKey !== activeGameMode) {
      switchGameMode(modeKey);
    }
  }, [isLoading, activeGameMode, switchGameMode]);

  const toggleSingles = useCallback(() => {
    setSinglesExpanded((prev) => {
      const next = !prev;
      // When expanding from a non-single active mode, restore the user's
      // last-used single mode (defaults to singleVisual on first use).
      if (next && !isLoading && !isSingleActive) {
        switchGameMode(readLastSingleMode());
      }
      return next;
    });
  }, [isLoading, isSingleActive, switchGameMode]);

  // Persist the most recent single-mode selection so the next "Single"
  // click restores it instead of defaulting to singleVisual.
  useEffect(() => {
    if (typeof activeGameMode === 'string' && activeGameMode.startsWith('single')) {
      try {
        window.localStorage.setItem(LAST_SINGLE_STORAGE_KEY, activeGameMode);
      } catch (e) {
        // localStorage unavailable — fine, just don't persist.
      }
    }
  }, [activeGameMode]);

  const singleHeaderActiveClasses = MODE_FILTER_COLORS.single.active;
  const singleHeaderIndicatorClass = MODE_FILTER_COLORS.single.indicator;

  return (
    <div className="mb-6">
      {/* Mode Label */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-theme-line" />
        <span className="text-[0.6875rem] font-mono uppercase tracking-[0.2em] text-theme-text-muted">
          Training Mode
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-theme-line" />
      </div>

      {/* Mode Tabs */}
      <div className="flex justify-center items-center flex-wrap gap-y-2 px-2 sm:px-0">
        <div className="tab-pill-group inline-flex bg-theme-bg-elevated border border-theme-line max-w-full">
          {/* Single group header pill — first position */}
          <button
            type="button"
            onClick={toggleSingles}
            disabled={isLoading}
            aria-expanded={singlesExpanded}
            aria-controls="single-modes-submenu"
            className={`
              relative px-3 py-2 sm:px-6 sm:py-3
              text-xs sm:text-sm font-mono uppercase tracking-normal sm:tracking-wider
              transition-colors duration-200
              ${isSingleActive
                ? singleHeaderActiveClasses
                : 'text-theme-text-muted hover:text-theme-text-secondary hover:bg-theme-bg-surface'
              }
              ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              outline-none focus-visible:ring-1 focus-visible:ring-current
            `}
            title="Single N-Back modes (Visual, Audio, Color, Shape)"
          >
            <span>Single</span>

            {/* Active indicator bar when a single sub-mode is selected */}
            {isSingleActive && (
              <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${singleHeaderIndicatorClass}`} />
            )}
          </button>

          {modes.map((mode) => {
            const isActive = activeGameMode === mode.key;

            return (
              <button
                key={mode.key}
                onClick={() => handleModeClick(mode.key)}
                disabled={isLoading}
                className={`
                  relative px-3 py-2 sm:px-6 sm:py-3
                  text-xs sm:text-sm font-mono uppercase tracking-normal sm:tracking-wider
                  transition-colors duration-200
                  border-l border-theme-line
                  ${isActive
                    ? MODE_FILTER_COLORS[mode.key].active
                    : 'text-theme-text-muted hover:text-theme-text-secondary hover:bg-theme-bg-surface'
                  }
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  outline-none focus-visible:ring-1 focus-visible:ring-current
                `}
                title={mode.description}
              >
                {/* Show full label on all screen sizes */}
                <span>{mode.label}</span>

                {/* Active indicator line */}
                {isActive && mode.key === 'dynamic' ? (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(to right, #EAB308 0%, #EAB308 33%, #A855F7 33%, #A855F7 66%, #06B6D4 66%, #06B6D4 100%)' }} />
                ) : isActive ? (
                  <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${MODE_FILTER_COLORS[mode.key].indicator}`} />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Single sub-menu */}
      {singlesExpanded && (
        <div
          id="single-modes-submenu"
          role="group"
          aria-label="Single N-Back modes"
          className="mt-2 flex justify-center"
        >
          <div className="pl-4 ml-2 border-l-2 border-theme-line flex flex-wrap gap-2">
            {SINGLE_MODE_KEYS.map((key) => {
              const isActive = activeGameMode === key;
              const colors = MODE_FILTER_COLORS[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleModeClick(key)}
                  disabled={isLoading}
                  className={`
                    relative px-3 py-2 sm:px-4 sm:py-2
                    text-xs font-mono uppercase tracking-wider
                    border border-theme-line
                    transition-colors duration-200
                    inline-flex items-center gap-2
                    ${isActive
                      ? colors.active
                      : 'text-theme-text-muted hover:text-theme-text-secondary hover:bg-theme-bg-surface'
                    }
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    outline-none focus-visible:ring-1 focus-visible:ring-current
                  `}
                  title={SINGLE_SUB_DESCRIPTIONS[key] || MODE_LABELS[key]}
                  aria-pressed={isActive}
                >
                  <i className={`${MODE_ICONS[key]} text-[0.6875rem]`} aria-hidden="true" />
                  <span>{SINGLE_SUB_LABELS[key]}</span>

                  {isActive && (
                    <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${colors.indicator}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mode Description */}
      {activeGameMode === 'dynamic' ? (
        <DynamicModeExplainer isActive={true} />
      ) : (
        <div className="hidden sm:block mt-2 text-center">
          <span className="text-xs font-mono text-theme-text-muted">
            {modes.find(m => m.key === activeGameMode)?.description
              || SINGLE_SUB_DESCRIPTIONS[activeGameMode]
              || 'Position + Audio'}
          </span>
        </div>
      )}
    </div>
  );
};

export default ModeSelector;

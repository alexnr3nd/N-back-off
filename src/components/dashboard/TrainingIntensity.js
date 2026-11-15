/* src/components/dashboard/TrainingIntensity.js */
/* Cognitive Lab Aesthetic - Scientific Instrument Panel */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPencil, faCheck, faXmark, faSpinner, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { formatCombinedDifficulty, calculateModifierLevels } from '../../contexts/gameHelpers';
import { MODE_LABELS } from '../../constants/modeStyles';
import StepperControl from '../ui/StepperControl';
import {
  FREE_TIER_DIFFICULTY_STEPS as FREE_TIER_STEPS_GRANDFATHERED,
  FREE_TIER_DIFFICULTY_STEPS_NEW as FREE_TIER_STEPS_NEW,
} from '../../constants/gameConstants';

// Tooltip descriptions for each modifier
const MODIFIER_TOOLTIPS = {
  'Pace': 'Time between each stimulus. Faster pace means less time to process and respond.',
  'Display Time': 'How long visual stimuli are shown. Shorter display requires faster recognition.',
  'Dual Mode': 'Two simultaneous streams (position + audio). Matches on both add cognitive load.',
  'Triple Mode': 'Three simultaneous streams (position + audio + color). Matches on all three add cognitive load.',
  'Quad Mode': 'Four simultaneous streams (position + audio + color + shape). The densest multi-modal load.',
  'Dynamic Mode': 'Progressive difficulty ladder — dual → triple → quad as you advance.',
  'Single Mode': 'One modality only. Not part of the difficulty modifier; listed here for orientation.',
  'Decoys': 'Near-miss patterns (n±1) that aren\'t true matches. Tests your discrimination accuracy.',
  'Timing Jitter': 'Random variation in timing. Prevents relying on rhythm, requires active attention.',
  'Session Length': 'Total number of trials per session. Longer sessions require more endurance.',
  'Match Density': 'Per-modality match rate — the percentage of trials where each individual modality has a match.',
};

// Label that reflects the currently-selected training mode.
const getModeModifierLabel = (gameMode) => {
  if (typeof gameMode !== 'string') return 'Dual Mode';
  if (gameMode.startsWith('single')) return 'Single Mode';
  if (gameMode === 'triple') return 'Triple Mode';
  if (gameMode === 'quad') return 'Quad Mode';
  if (gameMode === 'dynamic') return 'Dynamic Mode';
  return 'Dual Mode';
};

/**
 * ModifierBar - Graduated intensity indicator with scientific styling
 * Displays level as filled segments with animated transitions
 * Includes hover tooltip explaining the modifier
 */
const ModifierBar = ({ level, maxLevel, value, label, delay = 0 }) => {
  const [animatedLevel, setAnimatedLevel] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedLevel(level);
    }, delay);
    return () => clearTimeout(timer);
  }, [level, delay]);

  const isActive = level > 0;
  const tooltip = MODIFIER_TOOLTIPS[label] || '';

  return (
    <div
      className="group border-b border-theme-line/30 last:border-b-0 py-1.5 relative"
      style={{ animationDelay: `${delay}ms` }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Label */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 cursor-help">
          <div className={`w-1 h-1 rounded-full transition-colors duration-300 flex-shrink-0 ${
            isActive ? 'bg-theme-accent' : 'bg-theme-line'
          }`} />
          <span className={`text-[0.6875rem] font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.08em] transition-colors duration-300 truncate ${
            isActive ? 'text-theme-text-secondary' : 'text-theme-text-muted'
          }`}>
            {label}
          </span>
        </div>

        {/* Bar + Value */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Segmented bar */}
          <div className="flex gap-0.5">
            {Array.from({ length: maxLevel }).map((_, i) => (
              <div
                key={i}
                className={`
                  w-2 h-2.5 sm:w-2.5 sm:h-3 transition-all duration-300
                  ${i < animatedLevel
                    ? 'bg-theme-accent shadow-[0_0_6px_rgba(228,184,92,0.3)]'
                    : 'bg-theme-bg-secondary border border-theme-line/40'
                  }
                `}
                style={{
                  transitionDelay: `${i * 40}ms`,
                  clipPath: 'polygon(15% 0, 100% 0, 85% 100%, 0% 100%)'
                }}
              />
            ))}
          </div>

          {/* Value readout */}
          <span className={`text-sm sm:text-xs font-mono min-w-[3rem] sm:min-w-[3.5rem] text-right transition-colors duration-300 ${
            isActive ? 'text-theme-text' : 'text-theme-text-muted'
          }`}>
            {value}
          </span>
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip && tooltip && (
        <div className="absolute left-0 right-0 bottom-full mb-1 z-20 pointer-events-none">
          <div className="bg-theme-bg-secondary border border-theme-line px-2 py-1.5 shadow-lab text-sm sm:text-[0.6875rem] text-theme-text-secondary font-mono leading-relaxed">
            {tooltip}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * IntensitySummaryBar - Visual indicator of overall intensity
 */
const IntensitySummaryBar = ({ percent, label }) => {
  const [animatedPercent, setAnimatedPercent] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPercent(percent), 100);
    return () => clearTimeout(timer);
  }, [percent]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.15em] font-mono">
          Overall Intensity
        </span>
        <span className="text-sm sm:text-xs font-mono text-theme-accent">
          {label}
        </span>
      </div>
      <div className="relative h-2 bg-theme-bg border border-theme-line/50 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-theme-accent transition-all duration-1000 ease-out"
          style={{ width: `${animatedPercent}%` }}
        />
        {/* Tick marks */}
        {[25, 50, 75].map(tick => (
          <div
            key={tick}
            className="absolute top-0 bottom-0 w-px bg-theme-line/30"
            style={{ left: `${tick}%` }}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * TrainingIntensity - Laboratory-style training parameters display
 * Shows N-back level, overall intensity, and all 8 training modifiers
 */
const DYNAMIC_SUB_MODES = [
  { key: 'dual', label: 'Dual' },
  { key: 'triple', label: 'Triple' },
  { key: 'quad', label: 'Quad' },
];


const TrainingIntensity = ({
  difficulty = 0,
  nBack = 2,
  classicNBack = 2,
  classicDifficulty = 0.50,
  onLevelChange = null,
  isSaving = false,
  isFreeTier = false,
  isGrandfathered = false,
  isDynamic = false,
  currentSubMode = null,
  onSubModeChange = null,
  activeGameMode = 'dual',
  isAdaptiveUser = false,
  hasClassicAccess = true,
}) => {
  const freeTierSteps = isGrandfathered ? FREE_TIER_STEPS_GRANDFATHERED : FREE_TIER_STEPS_NEW;
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  // For Pro users: toggle between Classic and Adaptive view
  // Persists across refresh and auto-switches based on last game played
  const [viewMode, setViewMode] = useState(() => {
    // Cohorts without Classic access never open in Classic view, even if a stale
    // 'classic' is persisted from before the toggle was gated.
    if (!hasClassicAccess) return 'adaptive';
    const saved = localStorage.getItem('trainingIntensityViewMode');
    if (saved === 'classic' || saved === 'adaptive') return saved;
    return isAdaptiveUser ? 'adaptive' : 'classic';
  });

  // Self-heal: the initializer above runs once on mount, so if hasClassicAccess
  // resolves to false only after the user doc loads, force Adaptive and purge the
  // stale key. Without this, isViewingClassic stays true and the Classic save
  // route in handleConfirm can still write classicProgression for this cohort.
  useEffect(() => {
    if (hasClassicAccess) return;
    if (viewMode !== 'adaptive') {
      setViewMode('adaptive');
      setIsEditing(false);
    }
    // Purge unconditionally: the initializer already coerces to 'adaptive', so a
    // viewMode check alone would leave the stale key in place forever.
    if (localStorage.getItem('trainingIntensityViewMode') === 'classic') {
      localStorage.setItem('trainingIntensityViewMode', 'adaptive');
    }
  }, [hasClassicAccess, viewMode]);

  const isViewingClassic = viewMode === 'classic';
  const displayNBack = isViewingClassic ? classicNBack : nBack;
  const displayDifficulty = isViewingClassic ? classicDifficulty : difficulty;
  const [selectedNBack, setSelectedNBack] = useState(nBack);
  const [selectedDifficulty, setSelectedDifficulty] = useState(difficulty);
  const [selectedSubMode, setSelectedSubMode] = useState(currentSubMode || 'dual');

  // Reset selected values and close editor when props change (e.g., mode switch)
  useEffect(() => {
    setSelectedNBack(nBack);
    setSelectedDifficulty(difficulty);
    if (currentSubMode) setSelectedSubMode(currentSubMode);
    setIsEditing(false);
  }, [nBack, difficulty, currentSubMode, activeGameMode]);

  // Calculate modifier levels using helper (now with nBack for session length)
  const modifiers = useMemo(
    () => calculateModifierLevels(displayDifficulty, displayNBack, activeGameMode),
    [displayDifficulty, displayNBack, activeGameMode]
  );

  // Format difficulty for display (just the decimal portion)
  const difficultyDisplay = useMemo(() => {
    const formatted = formatCombinedDifficulty(displayNBack, displayDifficulty);
    return formatted.split('.')[1] || '00';
  }, [displayNBack, displayDifficulty]);

  // Format selected difficulty for stepper display
  const selectedDifficultyDisplay = useMemo(() => {
    return '.' + String(Math.round(selectedDifficulty * 100)).padStart(2, '0');
  }, [selectedDifficulty]);

  // All 7 modifiers in display order (Audio Clarity removed - single letter set used)
  // The "Dual Mode" modifier label reflects the active training mode
  // (shows "Single Mode" / "Triple Mode" / etc. when appropriate).
  const modeModifier = useMemo(() => ({
    ...modifiers.dualMode,
    label: getModeModifierLabel(activeGameMode),
  }), [modifiers.dualMode, activeGameMode]);

  const allModifiers = [
    modifiers.pace,
    modifiers.displayTime,
    modeModifier,
    modifiers.decoys,
    modifiers.timingVariance,
    modifiers.sessionLength,
    modifiers.matchDensity,
  ];

  const handleEditClick = () => {
    setSelectedNBack(displayNBack);
    setSelectedDifficulty(displayDifficulty);
    if (currentSubMode) setSelectedSubMode(currentSubMode);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setSelectedNBack(displayNBack);
    setSelectedDifficulty(displayDifficulty);
    if (currentSubMode) setSelectedSubMode(currentSubMode);
    setIsEditing(false);
  };

  const handleConfirm = async () => {
    const levelChanged = selectedNBack !== displayNBack || Math.abs(selectedDifficulty - displayDifficulty) > 0.001;
    const subModeChanged = isDynamic && selectedSubMode !== currentSubMode;
    if (levelChanged && onLevelChange) {
      // Route to classicProgression or modeProgression based on current view
      await onLevelChange(selectedNBack, isViewingClassic ? 0.50 : selectedDifficulty, isViewingClassic ? 'classic' : 'adaptive');
    }
    if (subModeChanged && onSubModeChange) {
      await onSubModeChange(selectedSubMode);
    }
    setIsEditing(false);
  };

  // N-Back stepper handlers (range: 1-9)
  const decrementNBack = () => setSelectedNBack(prev => Math.max(1, prev - 1));
  const incrementNBack = () => setSelectedNBack(prev => Math.min(9, prev + 1));

  // Difficulty stepper handlers
  // Free tier: step through [0.00, 0.25, 0.50, 0.75, 0.99]
  // Pro tier: 0.05 steps with 0.95->0.99 final step
  const decrementDifficulty = () => setSelectedDifficulty(prev => {
    if (isFreeTier) {
      const idx = freeTierSteps.findIndex(s => s >= prev);
      return freeTierSteps[Math.max(0, (idx > 0 ? idx : freeTierSteps.length) - 1)];
    }
    if (prev > 0.95) return 0.95;
    return Math.max(0, Math.round((prev - 0.05) * 100) / 100);
  });
  const incrementDifficulty = () => setSelectedDifficulty(prev => {
    if (isFreeTier) {
      const idx = freeTierSteps.findIndex(s => s > prev);
      return idx === -1 ? freeTierSteps[freeTierSteps.length - 1] : freeTierSteps[idx];
    }
    if (prev >= 0.95) return 0.99;
    return Math.round((prev + 0.05) * 100) / 100;
  });

  const hasChanges = selectedNBack !== displayNBack || Math.abs(selectedDifficulty - displayDifficulty) > 0.001 || (isDynamic && selectedSubMode !== currentSubMode);

  return (
    <div className="relative">
      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">

        {/* Left Column - N-Back Level & Intensity Summary */}
        <div className="lg:col-span-5">
          <div className="bg-theme-bg-elevated border border-theme-line p-4 sm:p-5 relative overflow-hidden h-full">
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-3 h-3 border-l border-t border-theme-accent/40" />
            <div className="absolute top-0 right-0 w-3 h-3 border-r border-t border-theme-accent/40" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-l border-b border-theme-accent/40" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-theme-accent/40" />

            {/* Classic / Adaptive toggle — only for cohorts that can actually play
                Classic. isAdaptiveUser is true for limited_modern too, so it alone
                is not a sufficient gate. */}
            {isAdaptiveUser && hasClassicAccess && (
              <div className="flex justify-center mb-3">
                <div className="inline-flex bg-theme-bg-secondary border border-theme-line">
                  <button
                    onClick={() => { setViewMode('adaptive'); setIsEditing(false); localStorage.setItem('trainingIntensityViewMode', 'adaptive'); }}
                    className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
                      viewMode === 'adaptive' ? 'bg-theme-accent/20 text-theme-accent' : 'text-theme-text-muted hover:text-theme-text-secondary'
                    }`}
                  >
                    Adaptive
                  </button>
                  <button
                    onClick={() => { setViewMode('classic'); setIsEditing(false); localStorage.setItem('trainingIntensityViewMode', 'classic'); }}
                    className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border-l border-theme-line transition-colors ${
                      viewMode === 'classic' ? 'bg-theme-accent/20 text-theme-accent' : 'text-theme-text-muted hover:text-theme-text-secondary'
                    }`}
                  >
                    Classic
                  </button>
                </div>
              </div>
            )}

            {/* N-Back Level - Large Display */}
            <div className="text-center relative mb-4">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">
                  {isDynamic && currentSubMode
                    ? `${MODE_LABELS[currentSubMode] || 'Dual'} N-Back Level`
                    : `${MODE_LABELS[activeGameMode] || 'Dual'} N-Back Level`
                  }
                </span>
                {onLevelChange && !isEditing && !isSaving && (
                  <button
                    onClick={handleEditClick}
                    className="p-1 text-theme-text-muted hover:text-theme-accent transition-colors"
                    title="Adjust training level"
                  >
                    <FontAwesomeIcon icon={faPencil} className="h-3 w-3" />
                  </button>
                )}
                {isSaving && (
                  <FontAwesomeIcon icon={faSpinner} className="h-3 w-3 text-theme-accent animate-spin" />
                )}
              </div>

              {!isEditing ? (
                <>
                  {isViewingClassic ? (
                    <div className="text-center">
                      <span className="text-5xl sm:text-6xl font-mono text-theme-accent leading-none tracking-tight">
                        {displayNBack}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl sm:text-6xl font-mono text-theme-accent leading-none tracking-tight">
                        {displayNBack}
                      </span>
                      <span className="text-3xl sm:text-4xl font-mono text-theme-accent/60 leading-none">
                        .{difficultyDisplay}
                      </span>
                    </div>
                  )}
                  {!isViewingClassic && Math.abs(displayDifficulty - 0.50) < 0.01 && (
                    <p className="text-xs font-mono text-theme-text-muted text-center mt-2">0.50 = standard Jaeggi difficulty</p>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  {/* Dynamic Mode selector (only when editing in Dynamic mode) */}
                  {isDynamic && (
                    <div>
                      <div className="text-[0.6875rem] font-medium sm:text-[0.5625rem] sm:font-normal text-theme-text-muted uppercase tracking-wider font-mono mb-1.5">Mode</div>
                      <div className="flex justify-center">
                        <div className="inline-flex bg-theme-bg-secondary border border-theme-line">
                          {DYNAMIC_SUB_MODES.map((mode, index) => {
                            const isActive = selectedSubMode === mode.key;
                            return (
                              <button
                                key={mode.key}
                                onClick={() => setSelectedSubMode(mode.key)}
                                disabled={isSaving}
                                className={`
                                  relative px-3 py-1.5
                                  text-xs font-mono uppercase tracking-wider
                                  transition-all duration-200
                                  ${index > 0 ? 'border-l border-theme-line' : ''}
                                  ${isActive
                                    ? 'bg-theme-accent/20 text-theme-accent'
                                    : 'text-theme-text-muted hover:text-theme-text-secondary hover:bg-theme-bg-surface'
                                  }
                                  ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                `}
                              >
                                {mode.label}
                                {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-theme-accent" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* N-Back stepper */}
                  <div>
                    <div className="text-[0.6875rem] font-medium sm:text-[0.5625rem] sm:font-normal text-theme-text-muted uppercase tracking-wider font-mono mb-1.5">N-Back</div>
                    <StepperControl
                      value={selectedNBack}
                      onDecrement={decrementNBack}
                      onIncrement={incrementNBack}
                      canDecrement={selectedNBack > 1}
                      canIncrement={selectedNBack < 9}
                      size="large"
                    />
                  </div>

                  {/* Difficulty stepper — Adaptive only */}
                  {!isViewingClassic && (
                    <div>
                      <div className="text-[0.6875rem] font-medium sm:text-[0.5625rem] sm:font-normal text-theme-text-muted uppercase tracking-wider font-mono mb-1.5">Difficulty</div>
                      <StepperControl
                        value={selectedDifficultyDisplay}
                        onDecrement={decrementDifficulty}
                        onIncrement={incrementDifficulty}
                        canDecrement={selectedDifficulty > 0}
                        canIncrement={selectedDifficulty < 0.99}
                        size="small"
                      />
                    </div>
                  )}

                  {/* Free tier upsell hint (Adaptive view only) */}
                  {isFreeTier && !isViewingClassic && (
                    <button
                      onClick={() => navigate('/subscribe')}
                      className="text-xs font-mono text-theme-text-muted hover:text-theme-accent transition-colors"
                    >
                      {isGrandfathered ? 'Unlock 0.01 precision' : 'Unlock all difficulty levels'} <FontAwesomeIcon icon={faArrowRight} className="ml-0.5" />
                    </button>
                  )}

                  {/* Confirm/Cancel buttons */}
                  <div className="flex justify-center gap-2 pt-2">
                    <button
                      onClick={handleCancel}
                      className="px-3 py-2 sm:py-1.5 text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider
                        bg-theme-bg-secondary border border-theme-line text-theme-text-muted
                        hover:text-theme-text-secondary hover:border-theme-border transition-colors
                        flex items-center gap-1.5"
                    >
                      <FontAwesomeIcon icon={faXmark} className="h-2.5 w-2.5" />
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={!hasChanges}
                      className="px-3 py-2 sm:py-1.5 text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider
                        bg-theme-accent/20 border border-theme-accent/50 text-theme-accent
                        hover:bg-theme-accent/30 transition-colors
                        disabled:opacity-40 disabled:cursor-not-allowed
                        flex items-center gap-1.5"
                    >
                      <FontAwesomeIcon icon={faCheck} className="h-2.5 w-2.5" />
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Overall Intensity Summary */}
            <div className="mt-4 pt-4 border-t border-theme-line/50">
              <IntensitySummaryBar
                percent={modifiers.overallIntensity.percent}
                label={modifiers.overallIntensity.label}
              />
            </div>
          </div>
        </div>

        {/* Right Column - Training Parameters (Always Visible) */}
        <div className="lg:col-span-7">
          <div className="bg-theme-bg-elevated border border-theme-line h-full p-4 sm:p-5">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-theme-line/30">
              <div className="w-1.5 h-1.5 bg-theme-accent rounded-full" />
              <span className="text-sm sm:text-xs uppercase tracking-[0.2em] text-theme-text-muted font-mono">
                Training Parameters
              </span>
              <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted/60 font-mono">
                ({allModifiers.filter(m => m.level > 0).length} active)
              </span>
            </div>

            {/* Modifier Grid - 2 columns on larger screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              {allModifiers.map((mod, index) => (
                <ModifierBar
                  key={mod.label}
                  label={mod.label}
                  level={mod.level}
                  maxLevel={mod.maxLevel}
                  value={mod.value}
                  delay={index * 50}
                />
              ))}
            </div>

            {/* Info line */}
            <div className="mt-3 pt-3 border-t border-theme-line/20">
              <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono text-center">
                {isViewingClassic
                  ? 'Fixed parameters from Jaeggi et al. (2008)'
                  : `Parameters scale with difficulty level (.${difficultyDisplay})`
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainingIntensity;

/* File: src/contexts/gameHelpers.js */
// Frontend helpers - should primarily contain utilities needed by the UI or frontend game logic.

// Import only the constants needed by the REMAINING helper functions
import { DIFFICULTY_TIERS, PROGRESSION_PARAMS, TRAINING_MODES } from '../constants/gameConstants'; // Keep DIFFICULTY_TIERS for tier helpers

/**
 * Interpolates the "very good" d-prime threshold between the dynamic good and
 * excellent thresholds. Single source of truth — this value gates Adaptive early
 * promotion (progressionLogic RULE 1 clause A), free-tier difficulty snapping, and
 * the results-screen performance category, which must all agree.
 *
 * Mirrored verbatim in functions/gameHelpers.js.
 *
 * @param {object} thresholds - { goodThreshold, excellentThreshold }
 * @returns {number|null} The very-good threshold, or null if inputs are unusable.
 */
export const computeVeryGoodThreshold = (thresholds) => {
  const good = thresholds?.goodThreshold;
  const excellent = thresholds?.excellentThreshold;
  if (typeof good !== 'number' || isNaN(good) || typeof excellent !== 'number' || isNaN(excellent)) {
    return null;
  }
  return good + (excellent - good) * PROGRESSION_PARAMS.VERY_GOOD_INTERPOLATION_FACTOR;
};

/**
 * Helper function to get tier object (name, color, etc.) from the precise difficulty score.
 * Uses the DIFFICULTY_TIERS_DISPLAY definition (which is the default export DIFFICULTY_TIERS).
 * SAFE TO KEEP ON FRONTEND: Used for UI display (FocusMeter).
 *
 * @param {number} difficulty - The precise difficulty score (0.00 - 0.95).
 * @returns {object} The tier object (e.g., { name: "Phase I", min: 0.00, max: 0.15, color: "phase-i" }).
 */
export const getTierFromDifficulty = (difficulty) => {
  // Clamp difficulty to the expected display range (adjust max if necessary, e.g., 0.99)
  const clampedDifficulty = Math.max(0.00, Math.min(0.99, difficulty ?? 0.00));

  // Check ranges defined in DIFFICULTY_TIERS
  if (clampedDifficulty >= 0.80) return DIFFICULTY_TIERS.PHASE_V;
  if (clampedDifficulty >= 0.60) return DIFFICULTY_TIERS.PHASE_IV;
  if (clampedDifficulty >= 0.40) return DIFFICULTY_TIERS.PHASE_III;
  if (clampedDifficulty >= 0.20) return DIFFICULTY_TIERS.PHASE_II;
  return DIFFICULTY_TIERS.PHASE_I; // Default
};

/**
 * Helper function to get only the tier name from the precise difficulty score.
 * Uses the getTierFromDifficulty helper.
 * SAFE TO KEEP ON FRONTEND: Used for UI display (FocusMeter, Results).
 *
 * @param {number} difficulty - The precise difficulty score (0.00 - 0.95).
 * @returns {string} The name of the difficulty tier (e.g., "Phase I").
 */
export const getTierName = (difficulty) => {
  return getTierFromDifficulty(difficulty).name;
};


// Stimulus key map for multi-modality support
const stimulusKeyMap = {
    visual: 'position',
    audio: 'letter',
    color: 'color',
    shape: 'shape'
};

/**
 * Helper to determine if a trial constitutes a true match for a specific stimulus type.
 * This function directly compares stimuli values in the sequence array.
 * SAFE TO KEEP ON FRONTEND: Used by useGameResponses for instant feedback.
 *
 * @param {Array|null} sequence - The game sequence array.
 * @param {number} trialIndex - The index of the trial to check.
 * @param {number} nBack - The current n-back level.
 * @param {'visual' | 'audio' | 'color' | 'shape'} type - The modality type to check.
 * @returns {boolean} True if the trial is a match of the specified type, false otherwise.
 */
export const isTrialMatch = (sequence, trialIndex, nBack, type) => {
    // Basic validation and boundary checks
    if (!sequence || !Array.isArray(sequence) || trialIndex < nBack || trialIndex >= sequence.length || nBack < 1) {
        return false;
    }

    // Validate modality type - explicit check instead of silent fallback
    const stimKey = stimulusKeyMap[type];
    if (!stimKey) {
        console.error(`[isTrialMatch Util] Invalid modality type: "${type}". Valid types: ${Object.keys(stimulusKeyMap).join(', ')}`);
        return false;
    }

    const currentItem = sequence[trialIndex];
    const nBackItem = sequence[trialIndex - nBack];

    // Check if items exist at those indices
    if (!currentItem || !nBackItem) {
        return false;
    }

    // Determine which stimulus property to compare based on 'type'
    const currentStimulus = currentItem[stimKey];
    const nBackStimulus = nBackItem[stimKey];

    // Check for null/undefined stimuli which cannot match
    if (currentStimulus === null || currentStimulus === undefined || nBackStimulus === null || nBackStimulus === undefined) {
        return false;
    }

    // Perform the actual comparison
    const isMatchResult = currentStimulus === nBackStimulus;
    return isMatchResult;
};


/**
 * Helper to determine if a trial is a lure for a specific type (n+1 or n-1 matches).
 * SAFE TO KEEP ON FRONTEND (for now): Potentially used for advanced feedback/analysis if needed.
 * Currently not essential if backend handles lure generation correctly.
 *
 * @param {Array|null} sequence - The game sequence array.
 * @param {number} trialIndex - The index of the trial to check.
 * @param {number} nBack - The current n-back level.
 * @param {'visual' | 'audio' | 'color' | 'shape'} type - The modality type to check.
 * @returns {boolean} True if the trial is a lure of the specified type, false otherwise.
 */
export const isTrialLure = (sequence, trialIndex, nBack, type) => {
  // Need at least n-1 trials before the current one for n-1 check, and nBack must be >= 1
  if (!sequence || !Array.isArray(sequence) || trialIndex < (nBack > 1 ? nBack - 1 : 0) || trialIndex >= sequence.length || nBack < 1) {
    return false;
  }

  // Validate modality type - explicit check instead of silent fallback
  const stimKey = stimulusKeyMap[type];
  if (!stimKey) {
    console.error(`[isTrialLure Util] Invalid modality type: "${type}". Valid types: ${Object.keys(stimulusKeyMap).join(', ')}`);
    return false;
  }

  const currentItem = sequence[trialIndex];
  if (!currentItem) return false;

  const currentStimulus = currentItem[stimKey];

  // If current stimulus is null, it can't be a lure match
  if (currentStimulus === null || currentStimulus === undefined) {
      return false;
  }

  // Check n-1 position (only if nBack > 1)
  let isNMinus1Lure = false;
  if (nBack > 1) {
      const nMinus1Index = trialIndex - (nBack - 1);
      if (nMinus1Index >= 0) {
          const nMinus1Item = sequence[nMinus1Index];
          if (nMinus1Item) {
              const nMinus1Stimulus = nMinus1Item[stimKey];
              isNMinus1Lure = nMinus1Stimulus !== null && nMinus1Stimulus !== undefined && currentStimulus === nMinus1Stimulus;
          }
      }
  }

  // Check n+1 position
  let isNPlus1Lure = false;
  const nPlus1Index = trialIndex - (nBack + 1);
  // Check if n+1 index is valid *and* if sequence has item at that index
  if (nPlus1Index >= 0) {
       const nPlus1Item = sequence[nPlus1Index];
       if (nPlus1Item) {
           const nPlus1Stimulus = nPlus1Item[stimKey];
           isNPlus1Lure = nPlus1Stimulus !== null && nPlus1Stimulus !== undefined && currentStimulus === nPlus1Stimulus;
       }
   }

  // A lure is a match at n-1 OR n+1, but NOT an actual n-back match
  const isLureMatch = isNMinus1Lure || isNPlus1Lure;
  // Check if it's a true n-back match using the other helper
  const isTrueNBackMatch = isTrialMatch(sequence, trialIndex, nBack, type);

  return isLureMatch && !isTrueNBackMatch;
};

/**
 * Returns which lure type(s) a trial belongs to for a given modality.
 * A trial can be BOTH n-1 and n+1 if those positions hold the same stimulus.
 * Trials that are also true n-back matches are never counted as lures.
 *
 * @param {Array|null} sequence - The game sequence.
 * @param {number} trialIndex - Index of the trial.
 * @param {number} nBack - Current n-back level.
 * @param {'visual' | 'audio' | 'color' | 'shape'} type - Modality.
 * @returns {{ nMinus1: boolean, nPlus1: boolean }}
 */
export const getTrialLureTypes = (sequence, trialIndex, nBack, type) => {
    const empty = { nMinus1: false, nPlus1: false };
    if (!sequence || !Array.isArray(sequence) || trialIndex < 0 || trialIndex >= sequence.length || nBack < 1) {
        return empty;
    }
    const stimKey = stimulusKeyMap[type];
    if (!stimKey) return empty;

    const currentItem = sequence[trialIndex];
    if (!currentItem) return empty;
    const currentStimulus = currentItem[stimKey];
    if (currentStimulus === null || currentStimulus === undefined) return empty;

    let nMinus1 = false;
    if (nBack > 1) {
        const idx = trialIndex - (nBack - 1);
        if (idx >= 0 && sequence[idx]) {
            const v = sequence[idx][stimKey];
            nMinus1 = v !== null && v !== undefined && v === currentStimulus;
        }
    }

    let nPlus1 = false;
    const idxP = trialIndex - (nBack + 1);
    if (idxP >= 0 && sequence[idxP]) {
        const v = sequence[idxP][stimKey];
        nPlus1 = v !== null && v !== undefined && v === currentStimulus;
    }

    if (!nMinus1 && !nPlus1) return empty;
    if (isTrialMatch(sequence, trialIndex, nBack, type)) return empty;
    return { nMinus1, nPlus1 };
};


/**
 * Formats n-back and difficulty into a combined "N.DD" string.
 * Ensures difficulty (0.00-0.99 range allowed for display) is padded correctly.
 * SAFE TO KEEP ON FRONTEND: Pure UI formatting utility.
 *
 * @param {number} nBack - The n-back level (integer >= 1).
 * @param {number} difficulty - The difficulty (0.00 to 0.99).
 * @returns {string} Formatted string e.g., "2.05", "7.99". Returns "?.??" if inputs are invalid.
 */
export const formatCombinedDifficulty = (nBack, difficulty) => {
    // Validate inputs
    if (typeof nBack !== 'number' || !Number.isInteger(nBack) || nBack < 1 ||
    typeof difficulty !== 'number' || Number.isNaN(difficulty) || difficulty < -0.005 || difficulty > 0.995) { // Allow tolerance around 0.00-0.99
        // console.warn(`Invalid input to formatCombinedDifficulty: nBack=${nBack}, difficulty=${difficulty}`);
        return "?.??"; // Placeholder for invalid input
    }

    // Clamp difficulty strictly to 0.00-0.99 before formatting
    const clampedDifficulty = Math.max(0, Math.min(0.99, difficulty));
    // Multiply by 100 and round to get integer 0-99
    const difficultyHundredths = Math.round(clampedDifficulty * 100);
    // Pad with leading zero if needed (e.g., 5 becomes "05")
    const formattedDifficulty = String(difficultyHundredths).padStart(2, '0');

    return `${nBack}.${formattedDifficulty}`;
};


/**
 * Combined N.DD level stepper with N-boundary rollover. direction: +1 | -1.
 * freeTierSteps: null for full 0.05 precision, or a snapped difficulty grid
 * (e.g. [0.00, 0.25, 0.50, 0.75, 0.99]) for coarse free-tier stepping.
 * Clamps N-back to 1..9: at the rails the input is returned unchanged,
 * so callers can detect "can't step" by comparing to the input.
 *
 * @param {number} nBack - Current n-back level (1-9).
 * @param {number} difficulty - Current difficulty (0.00-0.99).
 * @param {number} direction - +1 to step up, -1 to step down.
 * @param {number[]|null} [freeTierSteps=null] - Optional coarse free-tier grid.
 * @returns {{nBack: number, difficulty: number}} The stepped level, or the input unchanged at the rails.
 */
export const stepCombinedLevel = (nBack, difficulty, direction, freeTierSteps = null) => {
    const unchanged = { nBack, difficulty };
    const rollover = (n, d) => (n < 1 || n > 9) ? unchanged : { nBack: n, difficulty: d };
    const d100 = Math.round((difficulty ?? 0) * 100);
    if (Array.isArray(freeTierSteps) && freeTierSteps.length > 0) {
        const steps = freeTierSteps.map(s => Math.round(s * 100));
        if (direction > 0) {
            const next = steps.find(s => s > d100);
            return next !== undefined ? { nBack, difficulty: next / 100 }
                                      : rollover(nBack + 1, steps[0] / 100);
        }
        const lower = [...steps].reverse().find(s => s < d100);
        return lower !== undefined ? { nBack, difficulty: lower / 100 }
                                   : rollover(nBack - 1, steps[steps.length - 1] / 100);
    }
    if (direction > 0) {
        if (d100 >= 99) return rollover(nBack + 1, 0.00);   // 4.99 -> 5.00
        if (d100 >= 95) return { nBack, difficulty: 0.99 }; // 4.95 -> 4.99
        return { nBack, difficulty: (d100 + 5) / 100 };
    }
    if (d100 <= 0) return rollover(nBack - 1, 0.99);        // 4.00 -> 3.99
    if (d100 > 95) return { nBack, difficulty: 0.95 };      // 4.99 -> 4.95
    return { nBack, difficulty: Math.max(0, d100 - 5) / 100 };
};


/**
 * Per-modality match density parameters by game mode. Mirror the values in
 * functions/gameConstants.js MODE_ALGORITHM_PARAMS, scaled to the dual fallback
 * for single modes (harmonized).
 */
const MATCH_DENSITY_BY_MODE = {
  triple: { MAX: 0.22, BP_VAL: 0.22, MIN: 0.19 },
  quad:   { MAX: 0.16, BP_VAL: 0.16, MIN: 0.14 },
  // dual + single*: dual values (per-modality)
  dual:   { MAX: 0.30, BP_VAL: 0.27, MIN: 0.22 },
};

const getMatchDensityParams = (gameMode) => {
  if (gameMode === 'triple') return MATCH_DENSITY_BY_MODE.triple;
  if (gameMode === 'quad') return MATCH_DENSITY_BY_MODE.quad;
  return MATCH_DENSITY_BY_MODE.dual;
};

/**
 * Calculate modifier levels from difficulty for the TrainingIntensity component.
 * Returns graduated intensity levels for all 8 game modifiers plus overall intensity.
 * SAFE TO KEEP ON FRONTEND: Pure UI calculation for display purposes.
 *
 * @param {number} difficulty - The difficulty (0.00 to 0.99).
 * @param {number} nBack - The n-back level (for session length calculation).
 * @param {string} [gameMode='dual'] - Active game mode (drives Match Density and overlap display).
 * @returns {object} Modifier states with level, maxLevel, display value, and overall intensity.
 */
export const calculateModifierLevels = (difficulty, nBack = 2, gameMode = 'dual') => {
  const d = Math.max(0, Math.min(0.99, difficulty ?? 0));
  const safeNBack = Math.max(1, nBack);
  const isSingleMode = typeof gameMode === 'string' && gameMode.startsWith('single');

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PACE (ISI: piecewise — 3.5s→3.0s gentle, then 3.0s→1.5s steep at d=0.50)
  // ═══════════════════════════════════════════════════════════════════════════
  const ISI_MIN = 1.5, ISI_MAX = 3.5, ISI_BP = 0.50, ISI_BP_VAL = 3.0;
  let calculatedISI;
  if (d <= ISI_BP) {
    const t = d / ISI_BP;
    calculatedISI = ISI_MAX - t * (ISI_MAX - ISI_BP_VAL);
  } else {
    const t = (d - ISI_BP) / (1.0 - ISI_BP);
    calculatedISI = ISI_BP_VAL - t * (ISI_BP_VAL - ISI_MIN);
  }

  let paceLevel = 1;
  if (d >= 0.90) paceLevel = 5;
  else if (d >= 0.75) paceLevel = 4;
  else if (d >= 0.50) paceLevel = 3;
  else if (d >= 0.25) paceLevel = 2;

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. DISPLAY TIME (Stimulus Duration: piecewise — 3500ms→500ms, then flat 500ms at d=0.50)
  // ═══════════════════════════════════════════════════════════════════════════
  const STIM_BP = 0.50, STIM_AT_MIN = 3500, STIM_AT_BP = 500, STIM_AT_MAX = 500;
  let displayTimeMs;
  if (d <= STIM_BP) {
    const t = d / STIM_BP;
    displayTimeMs = Math.round(STIM_AT_MIN - t * (STIM_AT_MIN - STIM_AT_BP));
  } else {
    displayTimeMs = STIM_AT_MAX;
  }

  let displayTimeLevel = 1;
  if (d >= 0.90) displayTimeLevel = 5;
  else if (d >= 0.70) displayTimeLevel = 4;
  else if (d >= 0.50) displayTimeLevel = 3;
  else if (d >= 0.25) displayTimeLevel = 2;

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. AUDIO CLARITY (Letter Similarity: thresholds at 0.30, 0.70)
  // ═══════════════════════════════════════════════════════════════════════════
  let clarityLevel = 1;
  let clarityLabel = 'Clear';
  if (d >= 0.90) { clarityLevel = 5; clarityLabel = 'Hard'; }
  else if (d >= 0.70) { clarityLevel = 4; clarityLabel = 'Alike'; }
  else if (d >= 0.50) { clarityLevel = 3; clarityLabel = 'Similar'; }
  else if (d >= 0.30) { clarityLevel = 2; clarityLabel = 'Mixed'; }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. MULTI-MOD OVERLAP (expected count of trials with matches in 2+ modalities
  // per session: 0 below d=0.20, ramps to 2 at d=0.50 (Jaeggi), to 3 at d=0.99)
  // Single modes have only 1 modality → no overlap.
  // ═══════════════════════════════════════════════════════════════════════════
  const OVERLAP_MIN_DIFF = 0.20;
  const OVERLAP_BP_DIFF = 0.50;
  const OVERLAP_BP_VAL = 2;
  const OVERLAP_MAX_VAL = 3;
  let dualModeLevel = 0;
  let overlapExpected = 0;
  if (!isSingleMode && d > OVERLAP_MIN_DIFF) {
    if (d <= OVERLAP_BP_DIFF) {
      const t = (d - OVERLAP_MIN_DIFF) / (OVERLAP_BP_DIFF - OVERLAP_MIN_DIFF);
      overlapExpected = t * OVERLAP_BP_VAL;
    } else {
      const t = (d - OVERLAP_BP_DIFF) / (0.99 - OVERLAP_BP_DIFF);
      overlapExpected = OVERLAP_BP_VAL + t * (OVERLAP_MAX_VAL - OVERLAP_BP_VAL);
    }
    const levelT = (d - OVERLAP_MIN_DIFF) / (0.99 - OVERLAP_MIN_DIFF);
    dualModeLevel = Math.min(4, Math.max(0, Math.ceil(levelT * 4)));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. DECOYS (Lures: 0 → 4, now probabilistic for smoother progression)
  // ═══════════════════════════════════════════════════════════════════════════
  const expectedLures = d * 4; // Expected value (0.0 to 4.0)
  const decoyLevel = Math.round(expectedLures); // Round for level indicator

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. TIMING VARIANCE (Proportional ISI Jitter: 5-15% of ISI, starts at 0.51)
  // Based on Wodka et al. (2009): 10% jitter optimal, excessive jitter degrades performance
  // Starts at 0.51 so d=0.50 has zero jitter (Jaeggi match)
  // ═══════════════════════════════════════════════════════════════════════════
  let timingVarianceLevel = 0;
  let timingVarianceLabel = 'Off';
  let jitterPercent = 0;
  if (d >= 0.51) {
    // Calculate proportional jitter: 5% at D=0.51 → 15% at D=0.99
    const t = (d - 0.51) / (0.99 - 0.51);
    jitterPercent = Math.round((5 + t * 10)); // 5% to 15%

    if (jitterPercent >= 12) {
      timingVarianceLevel = 4;
      timingVarianceLabel = jitterPercent + '%';
    } else if (jitterPercent >= 9) {
      timingVarianceLevel = 3;
      timingVarianceLabel = jitterPercent + '%';
    } else if (jitterPercent >= 6) {
      timingVarianceLevel = 2;
      timingVarianceLabel = jitterPercent + '%';
    } else {
      timingVarianceLevel = 1;
      timingVarianceLabel = jitterPercent + '%';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. SESSION LENGTH (Trials: 14-46 base at N=2, ±1 per N level from N=2, quadratic scaling)
  // Mirrors functions/gameHelpers.js calculateTrials, including its N+5 minimum clamp.
  // ═══════════════════════════════════════════════════════════════════════════
  const BASE_N2_MIN = 14, BASE_N2_MAX = 46, N_FACTOR = 1;
  const baseTrials = BASE_N2_MIN + d * d * (BASE_N2_MAX - BASE_N2_MIN);
  const totalTrials = Math.max(safeNBack + 5, Math.round(baseTrials + N_FACTOR * (safeNBack - 2)));

  let sessionLengthLevel = 1;
  if (d >= 0.90) sessionLengthLevel = 5;
  else if (d >= 0.70) sessionLengthLevel = 4;
  else if (d >= 0.50) sessionLengthLevel = 3;
  else if (d >= 0.25) sessionLengthLevel = 2;

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. MATCH DENSITY (per-modality rate; piecewise; mode-specific)
  //   dual + single*: 30% → 27% → 22% (Jaeggi-exact at d=0.50)
  //   triple:         22% → 22% → 19% (flat 0→0.5, descends 0.5→0.99)
  //   quad:           16% → 16% → 14% (flat 0→0.5, descends 0.5→0.99)
  // ═══════════════════════════════════════════════════════════════════════════
  const { MAX: MD_MAX, BP_VAL: MD_BP_VAL, MIN: MD_MIN } = getMatchDensityParams(gameMode);
  const MD_BP = 0.50;
  let matchDensity;
  if (d <= MD_BP) {
    const t = d / MD_BP;
    matchDensity = MD_MAX - t * (MD_MAX - MD_BP_VAL);
  } else {
    const t = (d - MD_BP) / (1.0 - MD_BP);
    matchDensity = MD_BP_VAL - t * (MD_BP_VAL - MD_MIN);
  }
  const matchDensityPercent = Math.round(matchDensity * 100);

  let matchDensityLevel = 1;
  if (d >= 0.90) matchDensityLevel = 5;
  else if (d >= 0.70) matchDensityLevel = 4;
  else if (d >= 0.50) matchDensityLevel = 3;
  else if (d >= 0.25) matchDensityLevel = 2;

  // ═══════════════════════════════════════════════════════════════════════════
  // OVERALL INTENSITY (Weighted aggregate of all modifiers)
  // ═══════════════════════════════════════════════════════════════════════════
  // Calculate as percentage based on difficulty (0.00 = 0%, 0.99 = 100%)
  // Scale so that max difficulty (0.99) shows as full 100%
  const overallPercent = Math.min(100, Math.round((d / 0.99) * 100));
  let overallLabel = 'Relaxed';
  if (overallPercent >= 76) overallLabel = 'Intense';
  else if (overallPercent >= 51) overallLabel = 'Challenging';
  else if (overallPercent >= 26) overallLabel = 'Moderate';

  return {
    // Core gameplay modifiers
    pace: {
      level: paceLevel,
      maxLevel: 5,
      value: calculatedISI.toFixed(1) + 's',
      label: 'Pace'
    },
    displayTime: {
      level: displayTimeLevel,
      maxLevel: 5,
      value: (displayTimeMs / 1000).toFixed(1) + 's',
      label: 'Display Time'
    },
    audioClarity: {
      level: clarityLevel,
      maxLevel: 5,
      value: clarityLabel,
      label: 'Audio Clarity'
    },
    dualMode: {
      level: dualModeLevel,
      maxLevel: 4,
      value: overlapExpected > 0 ? '~' + overlapExpected.toFixed(1) + ' avg' : 'Off',
      label: 'Dual Mode'
    },
    decoys: {
      level: decoyLevel,
      maxLevel: 4,  // Max achievable: round(0.99 * 4) = 4
      value: expectedLures > 0 ? '~' + expectedLures.toFixed(1) + ' avg' : 'None',
      label: 'Decoys'
    },
    timingVariance: {
      level: timingVarianceLevel,
      maxLevel: 4,
      value: timingVarianceLabel,
      label: 'Timing Jitter'
    },
    sessionLength: {
      level: sessionLengthLevel,
      maxLevel: 5,
      value: totalTrials + ' trials',
      label: 'Session Length'
    },
    matchDensity: {
      level: matchDensityLevel,
      maxLevel: 5,
      value: matchDensityPercent + '%',
      label: 'Match Density'
    },
    // Overall intensity summary
    overallIntensity: {
      percent: overallPercent,
      label: overallLabel
    }
  };
};


/**
 * Canonical protocol bucket for a session.
 *
 * Accepts either a session-like object (reads `.trainingMode`) or a bare
 * trainingMode string. Anything that is not an explicit 'classic' or 'manual'
 * — including the legacy 'dynamic' sentinel, '', null, undefined and unknown
 * values — is Adaptive, which matches today's Insights/dashboard rule.
 *
 * Mirrored verbatim in functions/gameHelpers.js.
 *
 * @param {object|string|null|undefined} sessionOrMode - Session doc or trainingMode string.
 * @returns {'classic'|'manual'|'adaptive'}
 */
export const getSessionProtocol = (sessionOrMode) => {
  const mode = (typeof sessionOrMode === 'string')
    ? sessionOrMode
    : sessionOrMode?.trainingMode;
  if (mode === TRAINING_MODES.CLASSIC) return TRAINING_MODES.CLASSIC;
  if (mode === TRAINING_MODES.MANUAL) return TRAINING_MODES.MANUAL;
  return TRAINING_MODES.ADAPTIVE;
};


// --- REMOVED Backend-Specific Helpers ---
// calculateISI, getStimulusDuration, calculateTrials, calculateMatches,
// calculateLures, calculateOverlap, getStimuliSet, calculateSessionParameters
// These are now handled exclusively by the backend in functions/gameHelpers.js
// ------------------------------------------


// --- Default Export (Optional but common) ---
// Export the remaining frontend-relevant helpers
export default {
  computeVeryGoodThreshold,
  getTierFromDifficulty,
  getTierName,
  isTrialMatch,
  isTrialLure,
  formatCombinedDifficulty,
  stepCombinedLevel,
  calculateModifierLevels,
  getSessionProtocol
};
/* File: functions/gameHelpers.js */

// Import constants using require for the Cloud Functions environment
const { ALGORITHM_PARAMS, DIFFICULTY_TIERS_DISPLAY, STIMULI, LANGUAGE_AUDIO_LETTERS, MODE_ALGORITHM_PARAMS, TRAINING_MODES } = require('./gameConstants');
// Use the more specific name for clarity
const DIFFICULTY_TIERS = DIFFICULTY_TIERS_DISPLAY;

/**
 * Helper function to get tier object (name, color, etc.) from the precise difficulty score.
 * Uses the DIFFICULTY_TIERS_DISPLAY definition (assuming DIFFICULTY_TIERS points to it).
 *
 * @param {number} difficulty - The precise difficulty score (0.00 - 0.99 or 0.0 - 1.0 seed).
 * @returns {object} The tier object (e.g., { name: "Phase I", min: 0.00, max: 0.19, color: "phase-i" }).
 */
const getTierFromDifficulty = (difficulty) => {
  // Accepts either 0.00-0.99 or 0.0-1.0 seed. Clamps based on typical display range 0.00-0.99 for safety.
  const clampedDifficulty = Math.max(0.00, Math.min(0.99, difficulty ?? 0.00));

  // Check ranges defined in DIFFICULTY_TIERS
  if (clampedDifficulty >= 0.80) return DIFFICULTY_TIERS.PHASE_V;
  if (clampedDifficulty >= 0.60) return DIFFICULTY_TIERS.PHASE_IV;
  if (clampedDifficulty >= 0.40) return DIFFICULTY_TIERS.PHASE_III;
  if (clampedDifficulty >= 0.20) return DIFFICULTY_TIERS.PHASE_II;
  return DIFFICULTY_TIERS.PHASE_I; // Anything else falls into Phase I
};

/**
 * Helper function to get only the tier name from the precise difficulty score.
 * Uses the getTierFromDifficulty helper.
 *
 * @param {number} difficulty - The precise difficulty score (0.00 - 0.99 or 0.0 - 1.0 seed).
 * @returns {string} The name of the difficulty tier (e.g., "Phase I").
 */
const getTierName = (difficulty) => {
  return getTierFromDifficulty(difficulty).name;
};


/**
 * Calculate ISI (Interstimulus Interval) in seconds based on difficulty.
 * Piecewise linear with breakpoint at d=0.50 (Jaeggi match):
 *   d=0.00→0.50: gentle 3.5s→3.0s  (easy ramp)
 *   d=0.50→0.99: steep  3.0s→1.5s  (pace acceleration)
 * @param {number} difficultySeed - The difficulty seed (0.0 - 1.0).
 * @returns {number} The calculated ISI in seconds.
 */
const calculateISI = (difficultySeed) => {
  const d = Math.max(0, Math.min(1, difficultySeed ?? 0));
  const { MIN, MAX, BREAKPOINT_DIFF, BREAKPOINT_VALUE } = ALGORITHM_PARAMS.SCALING.ISI;

  if (d <= BREAKPOINT_DIFF) {
    const t = d / BREAKPOINT_DIFF;
    return MAX - t * (MAX - BREAKPOINT_VALUE);
  } else {
    const t = (d - BREAKPOINT_DIFF) / (1.0 - BREAKPOINT_DIFF);
    return BREAKPOINT_VALUE - t * (BREAKPOINT_VALUE - MIN);
  }
};

/**
 * Calculate stimulus display duration in milliseconds based on difficulty.
 * Piecewise linear with breakpoint at d=0.50 (Jaeggi match):
 *   d=0.00→0.50: 3500ms→500ms  (stimulus shrinks, blank gap grows)
 *   d=0.50→0.99: flat 500ms    (Jaeggi value; pace does the difficulty work)
 * @param {number} difficultySeed - The difficulty seed (0.0 - 1.0).
 * @returns {number} Duration in milliseconds.
 */
const getStimulusDuration = (difficultySeed) => {
  const d = Math.max(0, Math.min(1, difficultySeed ?? 0));
  const { BREAKPOINT_DIFF, AT_MIN_DIFF_MS, AT_BREAKPOINT_MS, AT_MAX_DIFF_MS } = ALGORITHM_PARAMS.SCALING.STIMULUS_DURATION;

  if (d <= BREAKPOINT_DIFF) {
    const t = d / BREAKPOINT_DIFF;
    return Math.round(AT_MIN_DIFF_MS - t * (AT_MIN_DIFF_MS - AT_BREAKPOINT_MS));
  } else {
    return AT_MAX_DIFF_MS;
  }
};


/**
 * Calculate number of trials based on difficulty AND n-back level using the
 * derived formula anchored at N=2.
 * Uses conceptual difficulty 0-1 for scaling calculation.
 * Formula: round(BASE_N2_MIN + (difficultyRange * ConceptualDifficulty²) + N_FACTOR * (NBack - 2))
 *
 * @param {number} difficultySeed - Conceptual difficulty seed (0.0 - 1.0).
 * @param {number} nBack - Current n-back level (must be >= 1, formula adjusts for N=1 internally).
 * @returns {number} Calculated number of trials for the session.
 */
const calculateTrials = (difficultySeed, nBack) => {
  // Expects difficultySeed already in 0-1 range
  const conceptualDifficulty = Math.max(0, Math.min(1, difficultySeed ?? 0));

  // Ensure nBack is at least 1
  const safeNBack = Math.max(1, nBack);

  const { BASE_N2_MIN, BASE_N2_MAX, N_FACTOR } = ALGORITHM_PARAMS.SCALING.TRIALS;
  const difficultyRange = BASE_N2_MAX - BASE_N2_MIN;

  // Calculate the base trials for N=2 at the given conceptual difficulty
  // Quadratic scaling: concentrates extra trials at high difficulty to compensate for faster ISI
  const baseTrialsN2 = BASE_N2_MIN + conceptualDifficulty * conceptualDifficulty * difficultyRange;

  // Calculate the adjustment relative to N=2
  // If N=1, adjustment is negative. If N=2, adjustment is 0. If N>2, adjustment is positive.
  const nBackAdjustment = N_FACTOR * (safeNBack - 2);

  const totalTrials = baseTrialsN2 + nBackAdjustment;

  // Ensure a minimum number of trials (e.g., N-back level + a buffer, or a fixed min)
  const minTrials = safeNBack + 5; // Example: At least N + 5 trials
  const finalTrials = Math.max(minTrials, Math.round(totalTrials));

  return finalTrials;
};


/**
 * Compute per-modality match RATE (0-1) for a given mode and difficulty.
 * Piecewise linear with breakpoint at d=0.50. Mode-specific curves:
 *   Dual:   d=0.00→0.50: 30%→27%, d=0.50→0.99: 27%→22%   (descending throughout)
 *   Triple: d=0.00→0.50: 22%→22%, d=0.50→0.99: 22%→19%   (flat then descending)
 *   Quad:   d=0.00→0.50: 16%→16%, d=0.50→0.99: 16%→14%   (flat then descending)
 *   Single*: harmonized to dual values
 *
 * @param {number} difficultySeed - Conceptual difficulty seed (0.0 - 1.0).
 * @param {string} [gameMode='dual'] - The game mode key (dual/triple/quad/single*).
 * @returns {number} Per-modality match rate as a fraction (0-1).
 */
const getPerModalityMatchRate = (difficultySeed, gameMode = 'dual') => {
  const d = Math.max(0, Math.min(1, difficultySeed ?? 0));
  const modeParams = MODE_ALGORITHM_PARAMS[gameMode] || MODE_ALGORITHM_PARAMS.dual;
  const { MIN, MAX, BREAKPOINT_DIFF, BREAKPOINT_VALUE } = modeParams.MATCH_DENSITY;

  if (d <= BREAKPOINT_DIFF) {
    const t = BREAKPOINT_DIFF > 0 ? d / BREAKPOINT_DIFF : 0;
    return MAX - t * (MAX - BREAKPOINT_VALUE);
  } else {
    const t = (d - BREAKPOINT_DIFF) / (1.0 - BREAKPOINT_DIFF);
    return BREAKPOINT_VALUE - t * (BREAKPOINT_VALUE - MIN);
  }
};

/**
 * Calculate the per-modality target match count using stochastic rounding.
 * Each modality (visual/audio/color/shape) independently aims for this count.
 *
 * @param {number} possibleTargetTrials - Total trials in which a match can occur (trials - nBack).
 * @param {number} difficultySeed - Conceptual difficulty seed (0.0 - 1.0).
 * @param {string} [gameMode='dual'] - The game mode key.
 * @returns {number} Target match count for ONE modality (probabilistically rounded).
 */
const calculatePerModalityMatchCount = (possibleTargetTrials, difficultySeed, gameMode = 'dual') => {
  const safeTrials = Math.max(0, possibleTargetTrials);
  if (safeTrials === 0) return 0;
  const rate = getPerModalityMatchRate(difficultySeed, gameMode);
  const expected = safeTrials * rate;
  const base = Math.floor(expected);
  const extraProb = expected - base;
  const stochastic = base + (Math.random() < extraProb ? 1 : 0);
  // Hard cap at 75% of possible target trials to keep some non-match trials.
  return Math.min(stochastic, Math.floor(safeTrials * 0.75));
};

/**
 * Calculate target number of lure trials based on difficulty.
 * Uses probabilistic rounding to smooth transitions at difficulty walls (0.25, 0.50, 0.75).
 * @param {number} difficultySeed - Conceptual difficulty seed (0.0 - 1.0).
 * @returns {number} Target number of lure trials (probabilistically rounded).
 */
const calculateLures = (difficultySeed) => {
  // Expects difficultySeed already in 0-1 range
  const conceptualDifficulty = Math.max(0, Math.min(1, difficultySeed ?? 0));
  const { MAX } = ALGORITHM_PARAMS.SCALING.LURES;
  // Calculate expected lures with probabilistic rounding to smooth transitions
  const expectedLures = conceptualDifficulty * MAX; // 0.0 → 0, 1.0 → 4
  const baseLures = Math.floor(expectedLures);
  const extraLureProbability = expectedLures - baseLures;
  // Roll for the fractional lure - creates gradual difficulty increase
  return baseLures + (Math.random() < extraLureProbability ? 1 : 0);
};

/**
 * Calculate the EXPECTED count of overlap trials (matches in 2+ modalities) per session.
 * Returns a float; caller is responsible for stochastic rounding to an integer.
 * Piecewise linear:
 *   d ≤ MIN_DIFFICULTY (0.20): 0
 *   d in (MIN_DIFFICULTY, 0.50]: 0 → BREAKPOINT_VALUE
 *   d in (0.50, 0.99]:           BREAKPOINT_VALUE → MAX
 * Mode-agnostic (same shape for dual/triple/quad). Single-modality modes get 0
 * structurally since they have no second modality to overlap with.
 *
 * @param {number} difficultySeed - Conceptual difficulty seed (0.0 - 1.0).
 * @param {string} [gameMode='dual'] - The game mode key.
 * @returns {number} Expected overlap trial count (float, before rounding).
 */
const calculateExpectedOverlapCount = (difficultySeed, gameMode = 'dual') => {
  const d = Math.max(0, Math.min(1, difficultySeed ?? 0));
  const modeParams = MODE_ALGORITHM_PARAMS[gameMode] || MODE_ALGORITHM_PARAMS.dual;
  const overlapParams = modeParams.OVERLAP_COUNT || ALGORITHM_PARAMS.SCALING.OVERLAP_COUNT;
  const { MIN_DIFFICULTY, BREAKPOINT_DIFF, BREAKPOINT_VALUE, MAX } = overlapParams;

  if (d <= MIN_DIFFICULTY) return 0;
  if (d <= BREAKPOINT_DIFF) {
    // Linear ramp 0 → BREAKPOINT_VALUE over (MIN_DIFFICULTY, BREAKPOINT_DIFF]
    const span = BREAKPOINT_DIFF - MIN_DIFFICULTY;
    if (span <= 0) return BREAKPOINT_VALUE;
    const t = (d - MIN_DIFFICULTY) / span;
    return t * BREAKPOINT_VALUE;
  }
  // Linear ramp BREAKPOINT_VALUE → MAX over (BREAKPOINT_DIFF, 0.99]
  const span = 0.99 - BREAKPOINT_DIFF;
  if (span <= 0) return MAX;
  const t = Math.min(1, (d - BREAKPOINT_DIFF) / span);
  return BREAKPOINT_VALUE + t * (MAX - BREAKPOINT_VALUE);
};

/**
 * Calculate overlap depth distribution probabilities for a given mode and difficulty.
 * Returns probabilities summing to 1.0 for choosing how many modalities participate
 * in each overlap trial.
 *   - Dual: always { p2: 1, p3: 0, p4: 0 } (only 2 modalities exist).
 *   - Triple: p3 ramps 0 → P3_AT_MAX over (BREAKPOINT_DIFF, 0.99]; p2 = 1 - p3.
 *   - Quad: p3 and p4 ramp independently; p2 = residual (1 - p3 - p4).
 *
 * @param {number} difficultySeed - Conceptual difficulty seed (0.0 - 1.0).
 * @param {string} [gameMode='dual'] - The game mode key.
 * @returns {{p2: number, p3: number, p4: number}} Probabilities summing to 1.0.
 */
const calculateOverlapDepth = (difficultySeed, gameMode = 'dual') => {
  const d = Math.max(0, Math.min(1, difficultySeed ?? 0));
  const modeParams = MODE_ALGORITHM_PARAMS[gameMode] || MODE_ALGORITHM_PARAMS.dual;
  const depthParams = modeParams.OVERLAP_DEPTH;

  // Dual / single / any mode without OVERLAP_DEPTH → always 2-mod.
  if (!depthParams) return { p2: 1, p3: 0, p4: 0 };

  const { BREAKPOINT_DIFF, P3_AT_BREAKPOINT, P3_AT_MAX } = depthParams;
  const P4_AT_BREAKPOINT = depthParams.P4_AT_BREAKPOINT ?? 0;
  const P4_AT_MAX = depthParams.P4_AT_MAX ?? 0;

  // Below breakpoint, depth is the breakpoint value (0 by spec).
  let p3, p4;
  if (d <= BREAKPOINT_DIFF) {
    p3 = P3_AT_BREAKPOINT;
    p4 = P4_AT_BREAKPOINT;
  } else {
    const span = 0.99 - BREAKPOINT_DIFF;
    const t = span > 0 ? Math.min(1, (d - BREAKPOINT_DIFF) / span) : 1;
    p3 = P3_AT_BREAKPOINT + t * (P3_AT_MAX - P3_AT_BREAKPOINT);
    p4 = P4_AT_BREAKPOINT + t * (P4_AT_MAX - P4_AT_BREAKPOINT);
  }

  // Defensive clamp; residual goes to p2.
  p3 = Math.max(0, Math.min(1, p3));
  p4 = Math.max(0, Math.min(1, p4));
  if (p3 + p4 > 1) {
    const scale = 1 / (p3 + p4);
    p3 *= scale;
    p4 *= scale;
  }
  const p2 = 1 - p3 - p4;
  return { p2, p3, p4 };
};

/**
 * Get the appropriate stimuli set (audio letters) based on difficulty AND LANGUAGE.
 * For English, it always uses a specific single set.
 * For other languages, it always uses the *first* defined set for that language.
 * The conceptualDifficulty parameter is now largely unused for set selection but kept for consistency.
 * @param {number} difficultySeed - Conceptual difficulty seed (0.0 - 1.0).
 * @param {string} [languageCode='en'] - The language code (e.g., 'en', 'cmn-TW', 'ar-XA'). Defaults to 'en'.
 * @returns {Array<string>} Array of audio letters for the current language.
 */
const getStimuliSet = (difficultySeed, languageCode = 'en') => {
  // Expects difficultySeed already in 0-1 range
  // const conceptualDifficulty = Math.max(0, Math.min(1, difficultySeed ?? 0)); // This line is no longer needed for letter set selection logic

  let letterSource;
  const effectiveLanguageCode = typeof languageCode === 'string' && languageCode.trim() !== '' ? languageCode : 'en';


  // Try to get language-specific letters first
  if (LANGUAGE_AUDIO_LETTERS && LANGUAGE_AUDIO_LETTERS[effectiveLanguageCode] && LANGUAGE_AUDIO_LETTERS[effectiveLanguageCode].letters) {
    letterSource = LANGUAGE_AUDIO_LETTERS[effectiveLanguageCode].letters;
    // console.log(`getStimuliSet (Backend): Using '${LANGUAGE_AUDIO_LETTERS[effectiveLanguageCode].name}' letter set for lang='${effectiveLanguageCode}'`);
  } else {
    // Fallback to default English stimuli if language not found or not specified
    letterSource = STIMULI.AUDIO_LETTERS; // This will now be the new single English set
    if (effectiveLanguageCode !== 'en') { // Only warn if a specific non-English language was requested but not found
      console.warn(`getStimuliSet (Backend): Language '${effectiveLanguageCode}' not found in LANGUAGE_AUDIO_LETTERS or letters missing. Falling back to default English.`);
    }
  }

  // --- New Logic ---
  // For English: The `letterSource` (either from LANGUAGE_AUDIO_LETTERS.en or STIMULI.AUDIO_LETTERS)
  // already contains only one array as per the changes in gameConstants.js. So, letterSource[0] will give the desired set.
  // For other languages: Always use the first array in their `letters` definition.
  // The structure of letterSource is now [ ['L', 'E', 'T', 'T', 'E', 'R', 'S'] ] for all languages.
  if (letterSource && letterSource.length > 0 && Array.isArray(letterSource[0])) {
    return letterSource[0]; // Return the first (and now only) array of letters
  } else {
    // Fallback if letterSource is not in the expected format (e.g., empty or not an array of arrays)
    console.error(`getStimuliSet (Backend): letterSource for '${effectiveLanguageCode}' is invalid or empty. Returning a default minimal set.`);
    return ['A', 'B', 'C']; // Provide a very basic fallback to prevent crashes
  }
};

/**
 * Helper to determine if a trial constitutes a true match for a specific stimulus type.
 * @param {Array<object>} sequence - The game sequence array.
 * @param {number} trialIndex - The index of the trial to check.
 * @param {number} nBack - The current n-back level.
 * @param {'visual' | 'audio' | 'color' | 'shape'} type - The stimulus type.
 * @returns {boolean} True if it's a match, false otherwise.
 */
const isTrialMatch = (sequence, trialIndex, nBack, type) => {
  if (!sequence || trialIndex < nBack || !sequence[trialIndex] || !sequence[trialIndex - nBack]) {
    return false;
  }
  const currentItem = sequence[trialIndex];
  const nBackItem = sequence[trialIndex - nBack];

  // Map modality type to stimulus property
  const stimulusKeyMap = {
    visual: 'position',
    audio: 'letter',
    color: 'color',
    shape: 'shape'
  };
  const stimKey = stimulusKeyMap[type] || 'position';

  const currentStimulus = currentItem[stimKey];
  const nBackStimulus = nBackItem[stimKey];
  if (currentStimulus === null || currentStimulus === undefined || nBackStimulus === null || nBackStimulus === undefined) {
      return false;
  }
  return currentStimulus === nBackStimulus;
};

/**
 * Helper to determine if a trial is a lure (n+1 or n-1 match) for a specific type,
 * ensuring it's not also a true n-back match.
 * @param {Array<object>} sequence - The game sequence array.
 * @param {number} trialIndex - The index of the trial to check.
 * @param {number} nBack - The current n-back level.
 * @param {'visual' | 'audio' | 'color' | 'shape'} type - The stimulus type.
 * @returns {boolean} True if it's a lure, false otherwise.
 */
const isTrialLure = (sequence, trialIndex, nBack, type) => {
  if (!sequence || (nBack > 0 && trialIndex < nBack - 1) || (nBack === 0 && trialIndex < 0) || !sequence[trialIndex]) {
    return false;
  }
  const currentItem = sequence[trialIndex];

  // Map modality type to stimulus property
  const stimulusKeyMap = {
    visual: 'position',
    audio: 'letter',
    color: 'color',
    shape: 'shape'
  };
  const stimKey = stimulusKeyMap[type] || 'position';

  const currentStimulus = currentItem[stimKey];
  if (currentStimulus === null || currentStimulus === undefined) {
      return false;
  }

  // Check n-1 lure (only if nBack > 0)
  let isNMinus1Lure = false;
  if (nBack > 0) {
      const nMinus1Index = trialIndex - (nBack - 1);
      if (nMinus1Index >= 0 && sequence[nMinus1Index]) {
          const nMinus1Stimulus = sequence[nMinus1Index][stimKey];
          isNMinus1Lure = nMinus1Stimulus !== null && nMinus1Stimulus !== undefined && currentStimulus === nMinus1Stimulus;
      }
  }

  // Check n+1 lure
  const nPlus1Index = trialIndex - (nBack + 1);
  let isNPlus1Lure = false;
  if (nPlus1Index >= 0 && sequence[nPlus1Index]) {
      const nPlus1Stimulus = sequence[nPlus1Index][stimKey];
      isNPlus1Lure = nPlus1Stimulus !== null && nPlus1Stimulus !== undefined && currentStimulus === nPlus1Stimulus;
  }

  // It's a lure IF it matches n-1 OR n+1, AND it does NOT match n-back
  const isLureMatch = isNMinus1Lure || isNPlus1Lure;
  const isTrueNBackMatch = isTrialMatch(sequence, trialIndex, nBack, type);

  return isLureMatch && !isTrueNBackMatch;
};

/**
 * Returns which lure type(s) a trial belongs to for a given modality.
 * A trial can be BOTH n-1 and n+1 if the two positions hold the same stimulus.
 * Trials that are also true n-back matches are never counted as lures.
 *
 * @param {Array<object>} sequence - The game sequence array.
 * @param {number} trialIndex - Index of the trial to classify.
 * @param {number} nBack - Current n-back level.
 * @param {'visual' | 'audio' | 'color' | 'shape'} type - Modality.
 * @returns {{ nMinus1: boolean, nPlus1: boolean }}
 */
const getTrialLureTypes = (sequence, trialIndex, nBack, type) => {
    const empty = { nMinus1: false, nPlus1: false };
    if (!sequence || !Array.isArray(sequence) || trialIndex < 0 || trialIndex >= sequence.length || nBack < 1) {
        return empty;
    }
    const stimulusKeyMap = { visual: 'position', audio: 'letter', color: 'color', shape: 'shape' };
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
 * Formats n-back and difficulty (0.00-0.99) into a combined "N.DD" string.
 * @param {number} nBack - The n-back level (integer >= 1).
 * @param {number} difficulty - The precise difficulty (0.00 to 0.99).
 * @returns {string} Formatted string e.g., "2.05", "7.99". Returns "?.??" if inputs are invalid.
 */
const formatCombinedDifficulty = (nBack, difficulty) => {
    if (typeof nBack !== 'number' || !Number.isInteger(nBack) || nBack < 1 ||
      typeof difficulty !== 'number' || Number.isNaN(difficulty) || difficulty < -0.005 || difficulty > 0.995) {
        return "?.??";
    }
    const clampedDifficulty = Math.max(0, Math.min(0.99, difficulty)); // Allow formatting up to .99 if needed
    const difficultyHundredths = Math.round(clampedDifficulty * 100);
    const formattedDifficulty = String(difficultyHundredths).padStart(2, '0');
    return `${nBack}.${formattedDifficulty}`;
};


/**
 * Combined N.DD level stepper with N-boundary rollover. direction: +1 | -1.
 * freeTierSteps: null for full 0.05 precision, or a snapped difficulty grid
 * (e.g. [0.00, 0.25, 0.50, 0.75, 0.99]) for coarse free-tier stepping.
 * Clamps N-back to 1..9: at the rails the input is returned unchanged,
 * so callers can detect "can't step" by comparing to the input.
 * Mirrored from src/contexts/gameHelpers.js (pure function, harmless server-side).
 *
 * @param {number} nBack - Current n-back level (1-9).
 * @param {number} difficulty - Current difficulty (0.00-0.99).
 * @param {number} direction - +1 to step up, -1 to step down.
 * @param {number[]|null} [freeTierSteps=null] - Optional coarse free-tier grid.
 * @returns {{nBack: number, difficulty: number}} The stepped level, or the input unchanged at the rails.
 */
const stepCombinedLevel = (nBack, difficulty, direction, freeTierSteps = null) => {
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


// ============================================================================
// === calculateSessionParameters FUNCTION (REVISED FOR SMOOTHER ISI LOGIC) ===
// ============================================================================
/**
 * Calculates and bundles all relevant parameters for a game session based on n-back and difficulty.
 * Allows overrides for specific parameters, typically used in playground mode.
 * Incorporates ISI variability based on difficulty with smoother transitions.
 *
 * @param {number} nBack - The n-back level (e.g., 2).
 * @param {number} difficultySeed - The difficulty seed (0.0-1.0).
 * @param {number|null} [overrideISI=null] - Optional override for ISI (in seconds).
 * @param {number|null} [overrideStimDurationMs=null] - Optional override for stimulus duration (in ms).
 * @param {number|null} [overrideTrials=null] - Optional override for total trials.
 * @returns {object} An object containing calculated parameters.
 */
const calculateSessionParameters = (nBack, difficultySeed, overrideISI = null, overrideStimDurationMs = null, overrideTrials = null) => {
    // Ensure difficultySeed is clamped to 0-1 range
    const clampedSeed = Math.max(0, Math.min(1.0, difficultySeed ?? 0.0));

    // --- Calculate Base Parameters ---
    const baseCalculatedISI_seconds = (overrideISI !== null && typeof overrideISI === 'number' && overrideISI > 0)
                                ? overrideISI
                                : calculateISI(clampedSeed); 

    const stimulusDuration_ms = (overrideStimDurationMs !== null && typeof overrideStimDurationMs === 'number' && overrideStimDurationMs > 0)
                                   ? overrideStimDurationMs
                                   : getStimulusDuration(clampedSeed);

    const totalTrialsValue = (overrideTrials !== null && typeof overrideTrials === 'number' && overrideTrials > 0)
                              ? overrideTrials
                              : calculateTrials(clampedSeed, nBack);

    // --- Proportional ISI Jitter Logic ---
    // Based on Wodka et al. (2009): 10% jitter is optimal, 40-50% degrades performance
    // Uses proportional jitter (% of ISI) rather than fixed milliseconds
    // Jitter engages temporal prediction circuits and sustained attention (Koppe et al. 2014)
    let baseVariabilityOffsetMs = 0;
    let maxRandomVariabilityOffsetMs = 0;
    const effectiveDifficulty = clampedSeed;

    const JITTER_START_DIFF = 0.51;  // Start jitter above d=0.50 (Jaeggi has zero jitter)
    const JITTER_END_DIFF = 0.99;
    const MIN_JITTER_PERCENT = 0.05; // 5% jitter at start
    const MAX_JITTER_PERCENT = 0.15; // 15% jitter at max difficulty

    if (effectiveDifficulty >= JITTER_START_DIFF) {
        // Linear ramp: 5% at D=0.51 → 15% at D=0.99
        const t = (effectiveDifficulty - JITTER_START_DIFF) / (JITTER_END_DIFF - JITTER_START_DIFF);
        const jitterPercent = MIN_JITTER_PERCENT + t * (MAX_JITTER_PERCENT - MIN_JITTER_PERCENT);
        // Apply as percentage of current ISI (in ms)
        const isiMs = baseCalculatedISI_seconds * 1000;
        maxRandomVariabilityOffsetMs = Math.round(isiMs * jitterPercent);
    }

    maxRandomVariabilityOffsetMs = Math.max(0, maxRandomVariabilityOffsetMs);
    // --- End Proportional ISI Jitter Logic ---

    return {
        calculatedISI: parseFloat(baseCalculatedISI_seconds.toFixed(3)), 
        stimulusDuration: stimulusDuration_ms,                           
        totalTrials: totalTrialsValue,                                   
        baseVariabilityOffsetMs: baseVariabilityOffsetMs, // Will be 0
        maxRandomVariabilityOffsetMs: maxRandomVariabilityOffsetMs,      
    };
};
// ============================================================================
// === END REVISED FUNCTION ==================================================
// ============================================================================


/**
 * Whether the Dynamic-mode sub-mode intercept (rotation) should run for this save.
 *
 * Runs only for normal single Dynamic sessions (currentSubMode present). Continuous
 * chains send currentSubMode too (for progression-bucket routing) but mark every
 * per-block save with chainStillInProgress — their sub-mode rotation is decided
 * exactly once at chain end, client-side, not per block.
 *
 * @param {object} params
 * @param {string|null} params.currentSubMode - sessionData.currentSubMode
 * @param {boolean} params.hasCalculatedResults - calculatedResults is non-null
 * @param {boolean} params.chainStillInProgress - sessionData.chainStillInProgress (chain per-block save)
 * @returns {boolean}
 */
const shouldApplyDynamicSubModeIntercept = ({ currentSubMode, hasCalculatedResults, chainStillInProgress }) => {
    return !!currentSubMode && !!hasCalculatedResults && !chainStillInProgress;
};


/**
 * Interpolates the "very good" d-prime threshold between the dynamic good and
 * excellent thresholds. Single source of truth — this value gates Adaptive early
 * promotion (progressionLogic RULE 1 clause A), free-tier difficulty snapping, and
 * the results-screen performance category, which must all agree.
 *
 * Mirrored verbatim in src/contexts/gameHelpers.js.
 *
 * @param {object} thresholds - { goodThreshold, excellentThreshold }
 * @returns {number|null} The very-good threshold, or null if inputs are unusable.
 */
const computeVeryGoodThreshold = (thresholds) => {
  const good = thresholds?.goodThreshold;
  const excellent = thresholds?.excellentThreshold;
  if (typeof good !== 'number' || isNaN(good) || typeof excellent !== 'number' || isNaN(excellent)) {
    return null;
  }
  return good + (excellent - good) * ALGORITHM_PARAMS.VERY_GOOD_INTERPOLATION_FACTOR;
};

/**
 * Canonical protocol bucket for a session.
 *
 * Accepts either a session-like object (reads `.trainingMode`) or a bare
 * trainingMode string. Anything that is not an explicit 'classic' or 'manual'
 * — including the legacy 'dynamic' sentinel, '', null, undefined and unknown
 * values — is Adaptive, which matches today's Insights/dashboard rule.
 *
 * Mirrored verbatim in src/contexts/gameHelpers.js.
 *
 * @param {object|string|null|undefined} sessionOrMode - Session doc or trainingMode string.
 * @returns {'classic'|'manual'|'adaptive'}
 */
const getSessionProtocol = (sessionOrMode) => {
  const mode = (typeof sessionOrMode === 'string')
    ? sessionOrMode
    : sessionOrMode?.trainingMode;
  if (mode === TRAINING_MODES.CLASSIC) return TRAINING_MODES.CLASSIC;
  if (mode === TRAINING_MODES.MANUAL) return TRAINING_MODES.MANUAL;
  return TRAINING_MODES.ADAPTIVE;
};

// --- Export for Cloud Functions (CommonJS) ---
module.exports = {
  computeVeryGoodThreshold,
  getTierFromDifficulty,
  getTierName,
  calculateISI,
  getStimulusDuration,
  calculateTrials,
  getPerModalityMatchRate,
  calculatePerModalityMatchCount,
  calculateLures,
  calculateExpectedOverlapCount,
  calculateOverlapDepth,
  getStimuliSet, // This function is now language-aware
  isTrialMatch,
  isTrialLure,
  getTrialLureTypes,
  formatCombinedDifficulty,
  stepCombinedLevel,
  calculateSessionParameters, // This function now includes the revised ISI variability logic
  shouldApplyDynamicSubModeIntercept,
  getSessionProtocol
};
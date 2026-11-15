/* File: src/constants/gameConstants.js */

/* src/constants/gameConstants.js */

// --- Conceptual Difficulty Tiers (Based on 0.0 - 1.0 scale) ---
// Used for calculations where a 0-1 range provides a smoother scaling factor.
// IMPORTANT: Core scaling logic is now backend, but these might be useful
// for frontend understanding or potential future visualisations.
export const DIFFICULTY_TIERS_CONCEPTUAL = {
  PHASE_I: { name: "Phase I", range: [0.0, 0.2], color: "phase-i" },
  PHASE_II: { name: "Phase II", range: [0.2, 0.4], color: "phase-ii" },
  PHASE_III: { name: "Phase III", range: [0.4, 0.6], color: "phase-iii" },
  PHASE_IV: { name: "Phase IV", range: [0.6, 0.8], color: "phase-iv" },
  PHASE_V: { name: "Phase V", range: [0.8, 1.0], color: "phase-v" },
};

// --- Precise Difficulty Tiers (Based on 0.00 - 0.95 scale) ---
// Used primarily for the FocusMeter display text, label highlighting, etc.
// This is safe to keep on the frontend for UI purposes.
export const DIFFICULTY_TIERS_DISPLAY = {
  PHASE_I: {         // Levels: N.00, N.05, N.10, N.15
    name: "Phase I",
    min: 0.00,
    max: 0.15,
    color: "phase-i" // Tailwind class association (defined in tailwind.config.js)
  },
  PHASE_II: {     // Levels: N.20, N.25, N.30, N.35
    name: "Phase II",
    min: 0.20,
    max: 0.35,
    color: "phase-ii"
  },
  PHASE_III: {          // Levels: N.40, N.45, N.50, N.55
    name: "Phase III",
    min: 0.40,
    max: 0.55,
    color: "phase-iii"
  },
  PHASE_IV: {         // Levels: N.60, N.65, N.70, N.75
    name: "Phase IV",
    min: 0.60,
    max: 0.75,
    color: "phase-iv"
  },
  PHASE_V: {         // Levels: N.80, N.85, N.90, N.95
    name: "Phase V",
    min: 0.80,
    max: 0.99,
    color: "phase-v"
  }
};

// Default export: Use the DISPLAY tiers for components like FocusMeter
export const DIFFICULTY_TIERS = DIFFICULTY_TIERS_DISPLAY;

// --- Feedback Messages ---
// Used by frontend (GameResults) to display feedback text received from backend/context.
// Safe to keep on frontend.
export const FEEDBACK_MESSAGES = {
  DIFFICULTY_INCREASE: {
    SMALL: [
      "Focus improving! Keep it up.",
      "Good progress! Challenge slightly increased.",
      "You're getting better! Difficulty adjusted up."
    ],
    LARGE: [
      "Excellent progress! Challenge increased.",
      "Outstanding performance! Difficulty boosted.",
      "Impressive focus! Challenge level raised."
    ]
  },
  DIFFICULTY_MAINTAINED: [
    "Maintaining {tierName} level.", // {tierName} will be filled by getTierName(preciseDifficulty)
    "Consistent performance. Keep practicing.",
    "Steady progress at {tierName} level."
  ],
  DIFFICULTY_DECREASE: {
    SMALL: [
      "Let's adjust the challenge slightly.",
      "Small adjustment to help you improve.",
      "Recalibrating for better learning."
    ],
    MEDIUM: [
      "Recalibrating difficulty for better learning.",
      "Adjusting challenge to optimize learning.",
      "Reducing difficulty to build stronger foundations."
    ],
    LARGE: [
      "Adjusting to help you build mastery.",
      "Recalibrating for improved learning.",
      "Setting a more suitable challenge level."
    ]
  }
};

// --- Feature Introduction Messages ---
// Used by frontend (GameResults) based on NEW difficulty level.
// Safe to keep on frontend.
export const FEATURE_INTRODUCTION = {
  0.2: "Audio speed is faster (1.25x). Trust your quick hearing.",
  0.3: "Audio letters sound more alike. Trust your ear to distinguish.",
  0.4: "Audio speed increases again (1.5x). Adapt to the rhythm.",
  0.45: "Visual & audio matches can occur together. Broaden your awareness.",
  0.5: "The overall pace is quicker.",
  0.6: "Audio speed increases (1.75x). Handle 'near misses' (lures) by trusting the true {n}-back signal.",
  0.7: "Audio letters are highly similar. Trust your sharpest perception.",
  0.8: "Audio speed is at maximum (2x). Stay present and centered.",
};

// --- Protocol Tips ---
// Displayed randomly during countdown before each session.
export const PROTOCOL_TIPS = [
  "Real gains emerge over months, not days.",
  "Consistency beats intensity.",
  "Your brain consolidates gains while you sleep.",
  "Most research protocols use 20-25 minute sessions.",
  "Track your weekly averages, not daily scores.",
  "The struggle is the training. If it feels easy, you're not improving.",
  "Schedule training at the same time daily.",
  "Frustration is information: it means you're at the edge of your ability, where growth happens.",
  "A bad session doesn't erase previous gains. Cognitive performance fluctuates naturally.",
  "Phone on airplane mode, notifications silenced—divided attention defeats the purpose of training.",
  "Skip training when severely sleep-deprived. You'll just see artificially low scores.",
  "If you're relying on verbal rehearsal, try letting responses become more automatic and intuitive.",
  "If you've plateaued for weeks, try a 3-5 day break, then return fresh.",
  "Mental fatigue reduces training effectiveness. Rest and return fresh.",
  "Prioritize 7-9 hours of sleep. It's when your brain consolidates training gains.",
  "A focused 15-minute session beats a fatigued 30-minute one.",
  "A few deep breaths can help you shift into a focused, calm state.",
  "Focus on weekly trends, not daily scores. Progress is visible across weeks, not sessions.",
  "Treat this like meditation. When attention drifts, simply return to the task without judgment.",
  "Weekly trends tell the real story; single-session scores are just noise.",
  "Missed one? Let it go. The next trial is all that matters.",
  "Dwelling on errors uses the same mental resources you need for the task.",
  "Errors are information, not failures.",
  "Phone silenced? Distractions cleared? Good. Let's focus.",
  "The difficulty adapts to you, trust the system and focus on the task.",
  "A short session you actually do beats a long session you skip.",
  "Some training is always better than no training.",
  "Your worst session still beats the one you didn't do.",
  "Results come from weeks of consistency, not single heroic sessions.",
  "Show up today. Let the weeks add up.",
  "Show up. That's the whole secret.",
  "Expect to fail sometimes, that's how your brain knows to adapt.",
  "Well-rested brains train better. Sleep is part of the program.",
  "20-25 focused minutes beats 45 fatigued ones.",
  "Your brain consolidates gains while you sleep tonight.",
  "Small improvements compound. Trust the process.",
  "The challenge is the feature, not the bug.",
];

// --- D-prime (d′) thresholds for *interpreting* performance (used in results screen text) ---
// This is needed by the frontend GameResults component for display text. Safe to keep.
export const DPRIME_THRESHOLDS_INTERPRETATION = {
    EXCELLENT: 3.5,
    VERY_GOOD: 2.8, // Note: Backend uses dynamic 'goodThreshold' for progression, this is for display text only
    GOOD: 2.0,
    FAIR: 1.5,
    POOR: 1.0
};

// --- Progression formula params (mirrors functions/gameConstants.js ALGORITHM_PARAMS) ---
// These are gameplay mechanics, not algorithm secrets — safe to expose client-side
// so continuous-mode chain advancement can compute next-session level locally
// using the same formula as the server's determineProgression.
export const PROGRESSION_PARAMS = {
    MAX_DIFFICULTY_PER_LEVEL: 0.99,
    DIFFICULTY_INCREMENT: 0.01,
    ADVANCEMENT_CONSECUTIVE_ROUNDS: 1, // matches functions/gameConstants.js ADVANCEMENT_CRITERIA.CONSECUTIVE_ROUNDS
    // Early-promotion clause (Aug 2026) — mirrors functions/gameConstants.js ALGORITHM_PARAMS.
    // Promotion fires on (difficulty >= PROMOTION_MIN_DIFFICULTY AND d' >= veryGood)
    // OR (difficulty >= MAX_DIFFICULTY_PER_LEVEL AND d' >= good).
    PROMOTION_MIN_DIFFICULTY: 0.50,
    EARLY_PROMOTION_SESSIONS: 3, // matches functions/gameConstants.js ALGORITHM_PARAMS.EARLY_PROMOTION_SESSIONS
    VERY_GOOD_INTERPOLATION_FACTOR: 0.6,
};

// Per-progression-range adjustment deltas (mirrors functions/game.js:428-432 CONTINUOUS_RANGES)
// Used by client-side determineProgression to compute next-block level inside a continuous chain.
export const CONTINUOUS_RANGES = {
    standard:    { min: -0.03, max: 0.07 },
    accelerated: { min: -0.07, max: 0.15 },
    aggressive:  { min: -0.12, max: 0.25 },
};

// --- Configurable Difficulty Adjustment Ranges (display only — numeric values stay server-side) ---
export const DIFFICULTY_ADJUSTMENT_RANGE_OPTIONS = [
  { key: 'standard',    label: 'Standard',    description: 'Gradual, steady progression',    detail: '−3 to +7 per session · e.g. 2.50 → 2.47–2.57',  range: { min: -0.03, max: 0.07 } },
  { key: 'accelerated', label: 'Accelerated', description: 'Faster ups and downs',           detail: '−7 to +15 per session · e.g. 2.50 → 2.43–2.65', range: { min: -0.07, max: 0.15 } },
  { key: 'aggressive',  label: 'Aggressive',  description: 'Large swings, rapid progression', detail: '−12 to +25 per session · e.g. 2.50 → 2.38–2.75', range: { min: -0.12, max: 0.25 } },
];

// --- FAR Normalization ---
// Reference density for normalizing false alarm rate across difficulty levels.
// Uses lowest difficulty density (33%) as baseline to maintain consistent FA tolerance.
export const FAR_REFERENCE_DENSITY = 0.33;

// --- Default Profiles (Keep for potential local dev/initialization fallback) ---
// This is only used if ProfileContext fails or for initial setup, not core logic.
export const DEFAULT_PROFILES = [
  {
    id: "profile1",
    name: "Allen",
    currentNBack: 3,
    currentDifficulty: 0.75,
    highestNBack: 3,
    consecutiveSuccesses: 0,
    sessions: [
      { date: "2025-03-24T10:00:00Z", nBack: 3, difficulty: 0.70, accuracy: 85, overallDprime: 2.9, newNBack: 3, newDifficulty: 0.75, consecutiveSuccesses: 0 },
      { date: "2025-03-23T15:30:00Z", nBack: 3, difficulty: 0.75, accuracy: 92, overallDprime: 3.6, newNBack: 3, newDifficulty: 0.75, consecutiveSuccesses: 0 }
    ]
  },
  {
    id: "profile2",
    name: "Monica",
    currentNBack: 2,
    currentDifficulty: 0.15,
    highestNBack: 2,
    consecutiveSuccesses: 0,
    sessions: [
       { date: "2025-03-24T11:00:00Z", nBack: 2, difficulty: 0.15, accuracy: 78, overallDprime: 1.8, newNBack: 2, newDifficulty: 0.15, consecutiveSuccesses: 0 },
       { date: "2025-03-23T16:00:00Z", nBack: 2, difficulty: 0.10, accuracy: 82, overallDprime: 2.1, newNBack: 2, newDifficulty: 0.15, consecutiveSuccesses: 0 }
    ]
  },
];

// --- Stimuli (Default English Set) ---
// This is the fallback if language-specific letters aren't used or for English.
// The backend (sequence generator) will primarily use LANGUAGE_AUDIO_LETTERS if language is specified.
export const STIMULI = {
  AUDIO_LETTERS: [
    // New single letter set for English (and default fallback on frontend)
    // Used for all N.DD difficulty levels.
    ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T']
  ],
  // Visual grid positions remain the same
  VISUAL_POSITIONS: [0, 1, 2, 3, 4, 5, 6, 7, 8]
};

// --- Spatial Pool ---
// Always uses outer positions only (center tile excluded, per Jaeggi standard).
export const SPATIAL_POOL = {
  MAX_SIZE: 8,                                // Total outer positions
  OUTER_POSITIONS: [0, 1, 2, 3, 5, 6, 7, 8], // All non-center positions
};

// --- Color Stimuli for Triple/Quad N-Back ---
export const COLOR_STIMULI = ['red', 'blue', 'green', 'gold', 'purple', 'teal', 'orange', 'white'];

// --- Shape Stimuli for Quad N-Back ---
export const SHAPE_STIMULI = ['circle', 'triangle', 'square', 'diamond', 'star', 'cross', 'heart', 'arrow'];

// --- Game Mode Definitions ---
export const GAME_MODES = {
  dual: {
    name: 'Dual N-Back',
    modalities: ['visual', 'audio'],
    stimuliCount: 2,
    description: 'Position + Audio'
  },
  triple: {
    name: 'Triple N-Back',
    modalities: ['visual', 'audio', 'color'],
    stimuliCount: 3,
    description: 'Position + Audio + Color'
  },
  quad: {
    name: 'Quad N-Back',
    modalities: ['visual', 'audio', 'color', 'shape'],
    stimuliCount: 4,
    description: 'Position + Audio + Color + Shape'
  },
  singleVisual: {
    name: 'Single N-Back (Visual)',
    modalities: ['visual'],
    stimuliCount: 1,
    description: 'Position only'
  },
  singleAudio: {
    name: 'Single N-Back (Audio)',
    modalities: ['audio'],
    stimuliCount: 1,
    description: 'Audio only'
  },
  singleColor: {
    name: 'Single N-Back (Color)',
    modalities: ['color'],
    stimuliCount: 1,
    description: 'Color only'
  },
  singleShape: {
    name: 'Single N-Back (Shape)',
    modalities: ['shape'],
    stimuliCount: 1,
    description: 'Shape only'
  },
  // Internal session mode: singleColor played with the Recall response mode. Never an activeGameMode; not in MODE_KEYS/SINGLE_MODE_KEYS; sequences are generated as 'singleColor'.
  singleColorRecall: {
    name: 'Single N-Back (Color Recall)',
    modalities: ['color'],
    stimuliCount: 1,
    description: 'Color recall — report the color from n back'
  },
  dynamic: {
    name: 'Dynamic N-Back',
    modalities: null, // Determined by currentSubMode at runtime
    stimuliCount: null,
    description: 'Dual → Triple → Quad Progressive'
  }
};

// --- Dynamic Mode Sub-Mode Order ---
export const DYNAMIC_SUB_MODE_ORDER = ['dual', 'triple', 'quad'];

// --- Training Protocols + Manual Mode (mirrored verbatim between
// src/constants/gameConstants.js and functions/gameConstants.js) ---
// TRAINING_MODES is the canonical set of values a session's `trainingMode`
// field can hold. 'dynamic' is a meta-mode tag the client writes while Dynamic
// cycling is on (the backend reads it for sub-mode rotation); it is not a
// protocol, and every protocol reader treats it as Adaptive. Old session docs
// may also carry null/absent.
export const TRAINING_MODES = Object.freeze({
  ADAPTIVE: 'adaptive',
  CLASSIC: 'classic',
  MANUAL: 'manual',
  DYNAMIC: 'dynamic', // meta-mode tag written while Dynamic cycling is on; not a protocol — protocol readers treat it as Adaptive
});

// Manual mode: the generator still needs a seed for the internals that stay
// fixed in v1 (overlap depth, decoy hardness, shuffle bias). 0.50 = Jaeggi behavior.
export const MANUAL_INTERNAL_SEED = 0.5;

export const MANUAL_PARAM_RANGES = Object.freeze({
  nBack: Object.freeze({ min: 1, max: 9 }),
  trials: Object.freeze({ min: 10, max: 100, step: 1 }),
  isiSeconds: Object.freeze({ min: 1.0, max: 6.0, step: 0.1 }),
  stimulusMs: Object.freeze({ min: 100, max: 3000, step: 50, gapBelowIsiMs: 100 }), // effective max = min(3000, isiMs - 100)
  matchRate: Object.freeze({ min: 0.10, max: 0.50, step: 0.01 }),                   // fraction per active modality
  overlapCount: Object.freeze({ min: 0, max: 10 }),                                 // effective max = trials - nBack
  lureCount: Object.freeze({ min: 0, max: 10 }),
  jitterPercent: Object.freeze({ min: 0, max: 25, step: 1 }),                       // integer percent of ISI
});

export const MANUAL_CLASSIC_DEFAULTS = Object.freeze({
  isiSeconds: 3.0,
  stimulusMs: 500,
  matchRateByMode: Object.freeze({ dual: 0.27, triple: 0.22, quad: 0.16 }),
  overlapCount: 2,
  lureCount: 2,
  jitterPercent: 0,
  trialsForNBack: (nBack) => 20 + nBack,
});

export const MANUAL_PRESETS = Object.freeze({
  LAST_USED: 'last_used',
  CLASSIC_STANDARD: 'classic_standard',
  ADAPTIVE_LEVEL: 'adaptive_level',
  CUSTOM: 'custom',
});
// --- End Manual Mode constants ---

// --- Classic Mode (Jaeggi Protocol, Brain Workshop-style) ---
export const CLASSIC_ADVANCE_THRESHOLD = 0.90;   // min(modality accuracies) ≥ 90% to advance (BW Jaeggi)
export const CLASSIC_DEMOTE_THRESHOLD = 0.75;    // min < 75% counts as a strike (BW Jaeggi)
export const CLASSIC_DEMOTE_CONSECUTIVE = 3;     // Three consecutive strikes → demote
export const CLASSIC_FIXED_DIFFICULTY = 0.50;    // Fixed difficulty for all Classic sessions

// --- Classic Recall (singleColorRecall) cutoffs ---
// Mirrors functions/gameConstants.js ALGORITHM_PARAMS.RECALL_CLASSIC_*. Classic recall
// scores exact 8AFC identification (chance = 12.5%), not Jaeggi match accuracy, so the
// 0.90/0.75 cutoffs above don't apply; these hold the same d′ anchors (~2.2 advance,
// ~0.9 strike) constant across the two response formats via the mAFC model.
// Server-authoritative — kept here only for the cross-file sync discipline.
export const RECALL_CLASSIC_ADVANCE_THRESHOLD = 0.76; // exact-recall proportion ≥ 76% to advance
export const RECALL_CLASSIC_DEMOTE_THRESHOLD = 0.35;  // exact-recall proportion < 35% = a strike

// --- Daily Adaptive Session Cap (free-tier monetization) ---
// Mirrors functions/gameConstants.js DAILY_ADAPTIVE_CAP. Used by the dashboard counter
// chip and the pre-start gate; backend is the source of truth for enforcement.
export const DAILY_ADAPTIVE_CAP = 10;

// --- Free Tier Difficulty Steps ---
// Mirrors functions/gameConstants.js FREE_TIER_DIFFICULTY_STEPS / _NEW.
// Free users have difficulty snapped to these coarse steps;
// Pro users get full 0.01 increment precision (100 levels per N-Back).
export const FREE_TIER_DIFFICULTY_STEPS = [0.00, 0.25, 0.50, 0.75, 0.99]; // Grandfathered users (preMonetizationChange: true)
export const FREE_TIER_DIFFICULTY_STEPS_NEW = [0.00, 0.50]; // New free users (2 levels per N-Back)

// --- Color Hex Map (for PositionGrid, ShapeIcon, SequenceTimeline) ---
export const COLOR_HEX_MAP = {
  // Active colors (colorblind-safe, maximally distinct)
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


// --- Language-Specific Audio Letter Sets (Native Characters) ---
// This section now contains the native character sets you provided.
export const LANGUAGE_AUDIO_LETTERS = {
  'en': { 
    name: 'English',
    letters: [
      // New single letter set for English, used for all N.DD difficulty levels.
      ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T']
    ]
  },
  'cmn-TW': {
    name: 'Mandarin (Zhuyin)',
    letters: [ 
      ['ㄅ', 'ㄘ', 'ㄉ', 'ㄍ', 'ㄏ', 'ㄎ', 'ㄇ', 'ㄙ']
    ]
  },
  'es-ES': {
    name: 'Spanish (Spain)',
    letters: [ 
      ['K', 'Z', 'Ñ', 'J', 'V', 'X', 'Y', 'F']
    ]
  },
  'hi-IN': {
    name: 'Hindi (India)',
    letters: [ 
      ['क', 'झ', 'ङ', 'ठ', 'घ', 'फ', 'ञ', 'श']
    ]
  },
  'ar-XA': {
    name: 'Arabic (Standard)',
    letters: [ 
      ['خ', 'ق', 'ح', 'ذ', 'ش', 'ظ', 'غ', 'ض']
    ]
  },
  'bn-IN': {
    name: 'Bengali (India)',
    letters: [ 
      ['ঙ', 'ঠ', 'ঝ', 'ঘ', 'ছ', 'ফ', 'ষ', 'হ']
    ]
  },
  'pt-PT': {
    name: 'Portuguese (Portugal)',
    letters: [ 
      ['V', 'Z', 'J', 'Q', 'X', 'Ç', 'NH', 'LH']
    ]
  },
  'ja-JP': {
    name: 'Japanese (Japan)',
    letters: [ 
      ['ら', 'ぬ', 'も', 'け', 'や', 'ふ', 'ち', 'ぜ']
      ]
  },
  'de-DE': {
    name: 'German (Germany)',
    letters: [ 
      ['Z', 'W', 'J', 'Ü', 'Ä', 'Ö', 'Q', 'X']
      ]
  },
  'fr-FR': {
    name: 'French (France)',
    letters: [ 
      ['J', 'Z', 'U', 'Y', 'Q', 'X', 'É', 'H']
      ]
  },
  'it-IT': {
    name: 'Italian (Italy)',
    letters: [ 
      ['Z', 'Q', 'H', 'V', 'U', 'J', 'Y', 'X']
    ]
  },
  'pl-PL': {
    name: 'Polish (Poland)',
    letters: [ 
      ['Ł', 'Ć', 'Ń', 'Ś', 'Ó', 'Ę', 'H', 'Ź']
    ]
  }
};

// --- ALGORITHM_PARAMS is REMOVED from Frontend Constants ---
// The sensitive algorithm parameters defining progression and scaling
// are now only present in `functions/gameConstants.js`
/* functions/gameConstants.js */
// Using CommonJS export style as presumed from user feedback

// --- Conceptual Difficulty Tiers (Preserved) ---
const DIFFICULTY_TIERS_CONCEPTUAL = {
  PHASE_I: { name: "Phase I", range: [0.0, 0.2], color: "phase-i" },
  PHASE_II: { name: "Phase II", range: [0.2, 0.4], color: "phase-ii" },
  PHASE_III: { name: "Phase III", range: [0.4, 0.6], color: "phase-iii" },
  PHASE_IV: { name: "Phase IV", range: [0.6, 0.8], color: "phase-iv" },
  PHASE_V: { name: "Phase V", range: [0.8, 1.0], color: "phase-v" },
};

// --- Precise Difficulty Tiers (Preserved - Note: Max display value was 0.95) ---
// This defines tiers for display, the actual max logic uses 0.99 now.
const DIFFICULTY_TIERS_DISPLAY = {
  PHASE_I:   { name: "Phase I",   min: 0.00, max: 0.19, color: "phase-i" },   // Covers 0.00 - 0.19
  PHASE_II:  { name: "Phase II",  min: 0.20, max: 0.39, color: "phase-ii" },  // Covers 0.20 - 0.39
  PHASE_III: { name: "Phase III", min: 0.40, max: 0.59, color: "phase-iii" }, // Covers 0.40 - 0.59
  PHASE_IV:  { name: "Phase IV",  min: 0.60, max: 0.79, color: "phase-iv" },  // Covers 0.60 - 0.79
  PHASE_V:   { name: "Phase V",   min: 0.80, max: 0.99, color: "phase-v" }    // Covers 0.80 - 0.99
};

// --- Feedback Messages (Preserved - Assuming original content) ---
const FEEDBACK_MESSAGES = {
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
    "Maintaining {tierName} level.",
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
      "Resetting to build stronger foundations."
    ],
    LARGE: [
      "Adjusting to help you build mastery.",
      "Recalibrating for improved learning.",
      "Setting a more suitable challenge level."
    ]
  }
};

// --- Feature Introduction Messages (Preserved - Assuming original content) ---
const FEATURE_INTRODUCTION = {
  0.3: "Notice: Letters and sounds may become more similar.",
  0.4: "New challenge: Some matches may occur in both visual and audio.",
  0.5: "Speed increasing. Faster responses required.",
  0.7: "Advanced challenge: Watch for misleading patterns."
};

// --- Coaching Messages (Preserved - Assuming original content) ---
const COACHING_MESSAGES = {
  NOVICE: [
    "Tip: Press ← for visual, → for audio matches from {n} trials ago.",
    "Remember: You're looking for matches that repeat after exactly {n} positions."
  ],
  APPRENTICE: [
    "Strategy: Try to name or label each position mentally.",
    "Focus on maintaining a rhythm as you track positions."
  ],
  ADEPT: [
    "Technique: Keep your attention divided between visual and audio cues.",
    "Beware of similar-looking or sounding stimuli."
  ],
  EXPERT: [
    "Advanced: Watch for patterns that are almost but not quite matches.",
    "Maintain your focus even when the pace increases."
  ],
  MASTER: [
     "Mastery tip: Trust your instincts for rapid recognition.",
    "The key now is maintaining consistent performance."
  ]
};

// --- Counting Span Task Constants (Preserved - Assuming original content & names) ---
// NEW ASSESSMENTS: save results via cstHistory arrayUnion with a distinct
// testType (the pattern every assessment here follows) and the admin
// Assessments page picks them up automatically — see the contract note in
// functions/adminAssessmentUtils.js (a label there is optional polish).
const CST_TEST_TYPES = {
    COUNTING_SPAN: 'countingSpan',
    OPERATION_SPAN: 'OPERATION_SPAN',
    DIGIT_SPAN: 'DIGIT_SPAN',
    SYMMETRY_SPAN: 'SYMMETRY_SPAN',
    VISUAL_ARRAYS: 'VISUAL_ARRAYS',
    ANTISACCADE: 'ANTISACCADE',
    RELATION_MONITORING: 'RELATION_MONITORING',
    LETTER_NUMBER_COMPARISON: 'LETTER_NUMBER_COMPARISON',
    FACE_NAME_MEMORY: 'FACE_NAME_MEMORY',
};
const COUNTING_SPAN_DEFAULTS = {
    MIN_SET_SIZE: 3,
    MAX_SET_SIZE: 7,
    TRIALS_PER_SET_SIZE: 3,
    DISPLAY_TIME_MS: 1000,
    TARGET_COLOR: 'blue',
    DISTRACTOR_COLOR: 'green',
    MIN_COUNT: 3,
    MAX_COUNT: 9
};

// --- Operation Span Task Constants ---
const OPERATION_SPAN_DEFAULTS = {
    // Letter pool (12 consonants per Unsworth et al. 2005)
    LETTER_POOL: ['F', 'H', 'J', 'K', 'L', 'N', 'P', 'Q', 'R', 'S', 'T', 'Y'],
    // Set structure
    MIN_SET_SIZE: 3,
    MAX_SET_SIZE: 7,
    TRIALS_PER_SIZE: 3,           // 3 sets per size = 15 total, max score 75
    // Timing
    LETTER_DISPLAY_MS: 800,
    SET_FEEDBACK_MS: 2500,
    FIXATION_MS: 500,
    RECALL_TIMEOUT_MS: 90000,
    // Calibration
    MATH_CALIBRATION_SD_MULTIPLIER: 2.5,
    MATH_DEADLINE_FLOOR_MS: 1500,
    MATH_DEADLINE_CEILING_MS: 10000,
    MATH_PRACTICE_COUNT: 15,
    // Practice
    LETTER_PRACTICE_SET_SIZES: [2, 2, 3, 3],
    COMBINED_PRACTICE_SETS: 3,
    COMBINED_PRACTICE_SIZE: 2,
    // Scoring
    PROCESSING_ACCURACY_THRESHOLD: 85,
    REQUIRED_FAMILIARIZATION_COUNT: 1,
    DEFAULT_TIMEZONE: 'UTC',
    // Math problem generation
    MATH_OPERAND_MIN: 1,
    MATH_OPERAND_MAX: 9,
    MATH_INCORRECT_OFFSET_MIN: 1,
    MATH_INCORRECT_OFFSET_MAX: 4,
    MATH_CORRECT_PROBABILITY: 0.5,
};

// --- Digit Span Task Constants (Woods et al. 2011 adaptive protocol) ---
const DIGIT_SPAN_DEFAULTS = {
    // Block structure (staircase: 1 correct → +1, 2 consecutive errors → −1)
    FORWARD_START_LENGTH: 3,
    FORWARD_MAX_LENGTH: 9,
    BACKWARD_START_LENGTH: 2,
    BACKWARD_MAX_LENGTH: 8,
    TRIALS_PER_BLOCK: 14,
    // Each tab-hidden interruption redo draws an extra sequence at the same
    // length, so the worst case is all 14 trials parked at one length PLUS the
    // full redo budget: must be >= TRIALS_PER_BLOCK + MAX_TRIAL_REDOS_PER_BLOCK.
    SEQUENCES_PER_LENGTH: 17,
    MAX_TRIAL_REDOS_PER_BLOCK: 3, // canonical; mirrored in src/constants/digitSpanConstants.js
    // Stimuli
    DIGIT_POOL: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    // Timing (1 digit/sec presentation)
    DIGIT_DISPLAY_MS: 800,
    DIGIT_BLANK_MS: 200,
    FIXATION_DURATION_MS: 500,
    TRIAL_FEEDBACK_MS: 1200,
    RECALL_TIMEOUT_MS: 90000,
    // Eligibility
    REQUIRED_FAMILIARIZATION_COUNT: 1,
    DEFAULT_TIMEZONE: 'UTC',
    // Sequence generation fallback bounds
    MAX_GENERATION_ATTEMPTS: 100,
    MAX_RELAXED_ATTEMPTS: 100,
    MAX_DEDUP_ATTEMPTS: 20,
};

// --- Symmetry Span Task Constants (canonical automated protocol:
// Unsworth, Redick, Heitz, Broadway & Engle 2009; Redick et al. 2012) ---
const SYMMETRY_SPAN_DEFAULTS = {
    // Set structure: 12 trials = set sizes 2-5 x 3 each, max partial score 42
    MIN_SET_SIZE: 2,
    MAX_SET_SIZE: 5,
    TRIALS_PER_SIZE: 3,
    MAX_PARTIAL_SCORE: 42,
    // Stimuli
    MATRIX_DIM: 8,                 // 8x8 symmetry-judgment matrix
    GRID_DIM: 4,                   // 4x4 red-square storage grid (cells 0..15)
    PATTERN_FILL_MIN: 17,          // cells sampled in the LEFT half (mirrored for total fill 34-38)
    PATTERN_FILL_MAX: 19,
    FOIL_PERTURB_MIN: 3,           // left-half cells removed AND added to build asymmetric foils
    FOIL_PERTURB_MAX: 4,
    SYMMETRIC_PROBABILITY: 0.5,
    // Timing
    FIXATION_MS: 500,
    SQUARE_DISPLAY_MS: 650,        // canonical 650 ms (Unsworth et al. 2009)
    PRE_SQUARE_BLANK_MS: 250,
    POST_SQUARE_BLANK_MS: 250,
    SET_FEEDBACK_MS: 2500,
    RECALL_TIMEOUT_MS: 90000,
    // Calibration (judgment deadline = practice mean RT + 2.5 SD, clamped)
    SYMMETRY_CALIBRATION_SD_MULTIPLIER: 2.5,
    SYMMETRY_DEADLINE_FLOOR_MS: 1500,
    SYMMETRY_DEADLINE_CEILING_MS: 10000,
    SYMMETRY_PRACTICE_COUNT: 15,
    // Practice
    STORAGE_PRACTICE_SET_SIZES: [2, 2, 3, 3],
    COMBINED_PRACTICE_SETS: 3,
    COMBINED_PRACTICE_SIZE: 2,
    // Scoring / eligibility
    PROCESSING_ACCURACY_THRESHOLD: 85,
    REQUIRED_FAMILIARIZATION_COUNT: 1,
    DEFAULT_TIMEZONE: 'UTC',
    // Foil generation guard
    MAX_FOIL_ATTEMPTS: 10,
    // Published norms (Redick et al. 2012, Tables 3-4, N = 6,018):
    // [partial score, percentile] anchors for linear interpolation
    NORM_PERCENTILE_ANCHORS: [[13, 5], [23, 25], [29, 50], [34, 75], [39, 95]],
    NORM_MEAN: 27.87,
    NORM_SD: 8.26,
};

// --- Visual Arrays (selective change detection, Draheim et al. 2023 "Color VA") ---
// Protocol parameters are verified against the published paper — do not tweak
// without re-reading docs/plans/2026-06-10-visual-arrays-assessment-design.md.
const VISUAL_ARRAYS_DEFAULTS = {
    SET_SIZES: [3, 5],              // number of TARGET items; total items = setSize * 2
    TRIALS_PER_SET_SIZE: 60,        // 120 scored trials total
    SPARE_TRIALS_PER_SET_SIZE: 6,   // interruption-redo pool
    MAX_TRIAL_REDOS: 6,             // per session, across both set sizes
    ORIENTATIONS: [0, 45, 90, 135], // degrees; CSS rotate values
    CUE_COLORS: ['RED', 'BLUE'],
    BREAK_AFTER_TRIAL: 60,          // self-paced rest break halfway
    // Timing (ms) — fixed protocol values
    FIXATION_MS: 800,
    CUE_MS: 250,
    CUE_GAP_MS: 100,
    ARRAY_MS: 250,
    RETENTION_MS: 900,
    ITI_MS: 500,
    RESPONSE_TIMEOUT_MS: 30000,     // unspeeded in protocol; generous bound, timeout = incorrect
    // Layout (normalized 0-1 coordinates; client scales to viewport square)
    ITEM_LENGTH_NORM: 0.11,         // rectangle long side
    ITEM_WIDTH_RATIO: 0.36,         // short side = long side * ratio
    MIN_SEPARATION_NORM: 0.16,      // min center-to-center distance
    LAYOUT_MAX_TRIES: 200,
    // Scoring
    LOW_ACCURACY_THRESHOLD: 55,     // % overall accuracy; chance = 50
    MIN_TRIALS_PER_SET_SIZE_FOR_K: 8, // below this, kBySetSize entry is null (partial sessions)
    // Practice (client-generated; counts are our choice — unspecified in source papers)
    PRACTICE_BLOCKS: [
        { setSize: 2, count: 4 },
        { setSize: 3, count: 4 },
    ],
};

// --- Antisaccade (attention control; Draheim, Tsukahara, Martin, Mashburn &
// Engle 2021 "toolbox" antisaccade — accuracy-based masked-letter version).
// Protocol values verified verbatim against the published paper — do not tweak
// without re-reading docs/plans/2026-06-11-antisaccade-assessment-design.md.
const ANTISACCADE_DEFAULTS = {
    SCORED_TRIALS: 72,
    PRACTICE_TRIALS: 16,            // slower-paced, client-generated, never scored
    SPARE_TRIALS: 12,              // interruption-redo pool
    MAX_TRIAL_REDOS: 8,            // per session
    BREAK_AFTER_TRIAL: 36,         // self-paced rest break halfway
    LETTERS: ['Q', 'O'],          // 2-alternative; chance = 50%
    SIDES: ['left', 'right'],
    // Timing (ms) — fixed protocol values
    FIXATION_MIN_MS: 2000,
    FIXATION_MAX_MS: 3000,
    TONE_MS: 300,
    CUE_MS: 300,
    TARGET_MS: 100,
    PRACTICE_TARGET_MS: 300,       // slower target during practice (learnable)
    MASK_MS: 500,
    FEEDBACK_MS: 500,
    ITI_MS: 1000,
    RESPONSE_TIMEOUT_MS: 10000,    // untimed in protocol; generous safety cap
    // Measured-exposure validity window for the 100 ms target (~±2 frames @60Hz)
    TARGET_MIN_VALID_MS: 67,
    TARGET_MAX_VALID_MS: 167,
    // Layout — lateral placement as fraction of viewport width (substitute for
    // the lab's 12.3° visual angle, which needs a controlled viewing distance)
    ECCENTRICITY_VW: 0.28,
    // Audio alerting beep (pitch unspecified in literature — our choice)
    BEEP_HZ: 880,
    BEEP_GAIN: 0.3,
    BEEP_ATTACK_MS: 12,
    BEEP_RELEASE_TC: 0.015,
    // Scoring
    AT_CHANCE_THRESHOLD: 0.50,     // proportion correct at/below this = invalid
    LOW_ACCURACY_THRESHOLD: 0.55,  // flaggedLowAccuracy (above chance but weak)
    MIN_VALID_TRIALS_FOR_SCORE: 36, // below this, scoreAccuracy = null (won't burn cooldown)
    // Published norms (Draheim 2021 n≈388 + 2023 n=301; M≈.80, SD≈.13, left-skewed):
    // [accuracy proportion, percentile] anchors for linear interpolation; the
    // top anchor at .95 means a near-perfect score clamps to ">95th" (ceiling).
    NORM_PERCENTILE_ANCHORS: [[0.59, 5], [0.71, 25], [0.80, 50], [0.89, 75], [0.95, 95]],
    NORM_MEAN: 0.80,
    NORM_SD: 0.13,
    REQUIRED_FAMILIARIZATION_COUNT: 1,
    DEFAULT_TIMEZONE: 'UTC',
};

// --- Relation Monitoring (relational integration; Chuderski 2014 Mem & Cog
// "three-same" digit condition, block structure per Bateman, Thompson &
// Birney 2019). Protocol values verified against the published construction
// rules — do not tweak without re-reading
// ~/.claude/plans/tingly-munching-whisper.md. No norms: raw score only.
const RELATION_MONITORING_DEFAULTS = {
    BLOCKS: 3,                      // deviation: 3 blocks (Bateman ran 6) ~12 min total
    TRIALS_PER_BLOCK: 36,           // 18 match / 18 non-match, shuffled per block
    MATCH_PROPORTION: 0.5,
    PRACTICE_TRIALS: 5,             // with right/wrong feedback (Chuderski Exp 1)
    GRID_DIM: 3,                    // 3x3 grid of three-digit strings (100-999)
    // Timing (ms) — fixed protocol values
    ARRAY_MS: 5500,
    BLINK_MS: 100,
    TRIAL_FEEDBACK_MS: 1200,        // practice only; scored trials get no feedback
    // Data-quality guard for unsupervised web delivery: a trial whose
    // measured array-on duration deviates >10% from ARRAY_MS (OS throttling,
    // frame stalls), or that ran while the tab was hidden or an overlay
    // blocked responding, is flagged and excluded from scoring. Any excluded
    // trial leaves scoredTrialCount below 108, which marks the stored
    // session partial.
    MAX_ARRAY_DEVIATION_RATIO: 0.1,
    // Scoring (Snodgrass & Corwin, as in both source papers):
    // score = (hit rate − false-alarm rate) as %
    LOW_VALIDITY_FA_THRESHOLD: 50,  // FA% above this flags low validity (response bias)
    MIN_TRIALS_PER_TYPE_FOR_SCORE: 8, // need >=8 scored match AND non-match trials
    REQUIRED_FAMILIARIZATION_COUNT: 1,
    DEFAULT_TIMEZONE: 'UTC',
};

// --- Letter & Number Comparison Speed (perceptual speed; computerized
// Salthouse & Babcock 1991 letter/number comparison exactly as administered in
// Redick et al. 2013). Verified protocol values — do not tweak without
// re-reading docs/plans/2026-06-12-letter-number-comparison-design.md.
const LETTER_NUMBER_COMPARISON_DEFAULTS = {
    TASKS: ['letter', 'number'],   // block 0,1 = letter; block 2,3 = number
    BLOCKS_PER_TASK: 2,            // two separately timed 30s administrations per task
    TOTAL_BLOCKS: 4,
    BLOCK_MS: 30000,
    ITEMS_PER_BLOCK_POOL: 120,     // honest pace ~20-25 items; pool is unreachable
    SET_SIZES: [3, 6, 9],          // string lengths
    SAME_PROPORTION: 0.5,
    PRACTICE_ITEMS_PER_TASK: 5,    // untimed, with feedback, client-generated
    BLINK_MS: 100,                 // blank between items (inside the block clock)
    GO_LEAD_MS: 500,               // "Go" interstitial before the clock starts
    PRACTICE_FEEDBACK_MS: 800,
    LOW_ACCURACY_THRESHOLD: 75,    // % — below this => flaggedLowValidity (spam ≈ 50%)
    MIN_RESPONSES_FOR_SCORE: 8,    // per task across its 2 blocks; below => score null
    MAX_BLOCK_REDOS: 1,            // one fresh-items redo per block, then abort
    RAF_STALL_VOID_MS: 2000,       // single frame gap above this voids the block
    // 20 uppercase consonants — no vowels, no Y (no accidental words)
    CONSONANTS: 'BCDFGHJKLMNPQRSTVWXZ',
    DIGITS: '0123456789',
    // 3-letter consonant strings that read as common acronyms are regenerated
    ACRONYM_BLOCKLIST: ['FBI', 'CIA', 'NFL', 'NBA', 'NHL', 'MLB', 'NBC', 'CNN',
        'BBC', 'KGB', 'DVD', 'TNT', 'LOL', 'WTF', 'BRB', 'FYI', 'SMH', 'TBH',
        'PHD', 'LCD', 'LSD', 'THC', 'CBD', 'GPS', 'PDF', 'XML', 'WWW', 'HTM'],
    REQUIRED_FAMILIARIZATION_COUNT: 1,
    DEFAULT_TIMEZONE: 'UTC',
};


// --- Algorithm Parameters ---
const ALGORITHM_PARAMS = {
  // --- Scaling ---
  SCALING: {
    TRIALS: {
      BASE_N2_MIN: 14,
      BASE_N2_MAX: 46,  // Tuned so d=0.50 N=2 yields 22 trials (Jaeggi: 20+n)
      N_FACTOR: 1,      // Jaeggi adds +1 trial per N-level (was 2)
    },
    MATCH_DENSITY: {
        // PER-MODALITY match rate (% of trials with a match in a single modality).
        // Dual fallback values — Jaeggi-anchored at d=0.50.
        // Mode-specific rates live in MODE_ALGORITHM_PARAMS and are the source of truth.
        MAX: 0.30,              // d=0.00 (easiest — slightly fewer than Jaeggi)
        BREAKPOINT_DIFF: 0.50,
        BREAKPOINT_VALUE: 0.27, // d=0.50 (Jaeggi exact: 6/22 per modality at N=2 dual)
        MIN: 0.22,              // d=0.99 (hardest — sparsest)
    },
    LURES: {
        MAX: 4
    },
    ISI: {
      MIN: 1.5,               // ISI at d=0.99 in seconds (fastest pace)
      MAX: 3.5,               // ISI at d=0.00 in seconds (slowest pace)
      BREAKPOINT_DIFF: 0.50,  // Piecewise breakpoint difficulty
      BREAKPOINT_VALUE: 3.0,  // ISI at breakpoint in seconds (Jaeggi: 3000ms SOA)
    },
    OVERLAP_COUNT: {
      // Expected count of overlap trials (matches in 2+ modalities on the same trial)
      // per session. Replaces the old OVERLAP.MAX_PERCENTAGE semantics.
      MIN_DIFFICULTY: 0.20,    // Below this, 0 overlaps
      BREAKPOINT_DIFF: 0.50,
      BREAKPOINT_VALUE: 2,     // d=0.50 Jaeggi: 2 overlap trials at N=2 dual
      MAX: 3,                  // d=0.99 expected count
    },
    OVERLAP_DEPTH: {
      // For triple/quad, each overlap trial probabilistically picks a depth (2/3/4-mod).
      // Default for dual = always 2-mod. Probabilities ramp linearly from 0 at
      // BREAKPOINT_DIFF to *_AT_MAX at d=0.99. P(2-mod) = residual.
      triple: {
        BREAKPOINT_DIFF: 0.50,
        P3_AT_BREAKPOINT: 0.0,
        P3_AT_MAX: 0.50,
      },
      quad: {
        BREAKPOINT_DIFF: 0.50,
        P3_AT_BREAKPOINT: 0.0,
        P3_AT_MAX: 0.35,
        P4_AT_BREAKPOINT: 0.0,
        P4_AT_MAX: 0.15,
      }
    },
    STIMULI_SIMILARITY: { // Renamed from LETTER_DIFFICULTY_THRESHOLDS for clarity
        MODERATE_THRESHOLD: 0.3, // Conceptual difficulty (0-1) to switch to moderately similar letters
        SIMILAR_THRESHOLD: 0.7   // Conceptual difficulty (0-1) to switch to most similar letters
    },
    STIMULUS_DURATION: {
        BREAKPOINT_DIFF: 0.50,   // Piecewise breakpoint difficulty
        AT_MIN_DIFF_MS: 3500,    // d=0.00: stim fills entire ISI (zero blank gap)
        AT_BREAKPOINT_MS: 500,   // d=0.50: Jaeggi 500ms stimulus duration
        AT_MAX_DIFF_MS: 500,     // d=0.50+: flat at Jaeggi value
    }
  },

  // --- Difficulty Caps and Increments ---
  MAX_DIFFICULTY_PER_LEVEL: 0.99,
  DIFFICULTY_INCREMENT: 0.01,

  // --- Early Promotion (Aug 2026) ---
  // Promotion is a disjunction: (difficulty >= PROMOTION_MIN_DIFFICULTY AND d' >= veryGood)
  // OR (difficulty >= MAX_DIFFICULTY_PER_LEVEL AND d' >= good). The second clause is the
  // original rule, kept verbatim so the 0.99 speed band stays reachable and nobody is
  // ever slower than before. 0.50 is the Jaeggi anchor (ISI 3.0s, 500ms stimulus,
  // 27% per-modality density) — "can play standard N-back well" is the advancement bar.
  // Rationale + 1,244-run counterfactual: ~/.claude/plans/prancy-shimmying-rainbow.md
  PROMOTION_MIN_DIFFICULTY: 0.50,
  // Sept 2026: the early clause needs EARLY_PROMOTION_SESSIONS qualifying sessions
  // (difficulty >= PROMOTION_MIN_DIFFICULTY AND d' >= veryGood) at the same N, counted
  // cumulatively while every session stays at or above the floor. A session played
  // below the floor, or one whose servo result lands below it, resets the count. The
  // 0.99 + good clause is still a single session.
  // Design: docs/plans/2026-09-08-promotion-credits-design.md
  EARLY_PROMOTION_SESSIONS: 3,
  // veryGood = good + (excellent - good) * VERY_GOOD_INTERPOLATION_FACTOR
  VERY_GOOD_INTERPOLATION_FACTOR: 0.6,

  // --- D-Prime Based Difficulty Adjustment ---
  MIN_DIFFICULTY_ADJUSTMENT: -0.03,
  MAX_DIFFICULTY_ADJUSTMENT: 0.07,

  // --- FAR Normalization ---
  // Reference density for normalizing false alarm rate across difficulty levels.
  // Uses lowest difficulty density (33%) as baseline to maintain consistent FA tolerance.
  FAR_REFERENCE_DENSITY: 0.33,

  // --- Advancement Criteria ---
  ADVANCEMENT_CRITERIA: {
    DPRIME_THRESHOLD: 2.8,
    CONSECUTIVE_ROUNDS: 1,
  },

  // --- Classic Mode (Jaeggi Protocol, Brain Workshop-style) ---
  CLASSIC_ADVANCE_THRESHOLD: 0.90,    // min(modality accuracies) ≥ 90% to advance (BW Jaeggi)
  CLASSIC_DEMOTE_THRESHOLD: 0.75,     // min < 75% counts as a strike (BW Jaeggi)
  CLASSIC_DEMOTE_CONSECUTIVE: 3,      // Three consecutive strikes → demote
  CLASSIC_FIXED_DIFFICULTY: 0.50,     // Fixed difficulty for all Classic sessions

  // --- Classic Recall (singleColorRecall) cutoffs ---
  // Classic recall scores exact 8AFC identification (chance = 12.5%), not Jaeggi match
  // accuracy (floor ~70%, correct rejections dominate), so the 0.90/0.75 cutoffs above
  // would make advancing nearly unreachable and striking routine — a one-way ratchet
  // down. These hold the SAME d′ anchors constant across the two response formats:
  // binary singleColor Classic advances at ~d′ 2.2 (90% Jaeggi, best case) and strikes
  // below ~d′ 0.9–1.0 (75% Jaeggi); mapped through the 8AFC model those are p ≈ 0.76
  // (d′ 2.18) and p ≈ 0.35 (d′ 0.89). See mafcDprimeFromProportion in
  // functions/recallResultsCalculator.js for the model these were derived with.
  RECALL_CLASSIC_ADVANCE_THRESHOLD: 0.76, // exact-recall proportion ≥ 76% to advance
  RECALL_CLASSIC_DEMOTE_THRESHOLD: 0.35,  // exact-recall proportion < 35% = a strike
};

// --- Daily Adaptive Session Cap (free-tier monetization) ---
// Non-Pro users in the limited_modern / classic_legacy / post-expiry grandfathered cohorts
// get this many Adaptive sessions per local-TZ day. Classic sessions are not capped (when allowed).
const DAILY_ADAPTIVE_CAP = 10;

// --- Configurable Difficulty Adjustment Ranges (Pro feature) ---
const DIFFICULTY_ADJUSTMENT_RANGES = {
  standard:    { min: -0.03, max: 0.07 },
  accelerated: { min: -0.07, max: 0.15 },
  aggressive:  { min: -0.12, max: 0.25 },
};

// --- D-prime (d′) thresholds for *interpreting* performance (Frontend display) ---
const DPRIME_THRESHOLDS_INTERPRETATION = {
    EXCELLENT: 3.5,
    VERY_GOOD: 2.8,
    GOOD: 2.0,
    FAIR: 1.5,
    POOR: 1.0
};

// --- Stimuli Sets (Default English - Fallback) ---
const STIMULI = {
  AUDIO_LETTERS: [
    // New single letter set for English (and default fallback)
    // Used for all N.DD difficulty levels.
    ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T']
  ],
  VISUAL_POSITIONS: [0, 1, 2, 3, 4, 5, 6, 7, 8]
};

// --- Spatial Pool ---
// Always uses outer positions only (center tile excluded, per Jaeggi standard).
const SPATIAL_POOL = {
  MAX_SIZE: 8,                                // Total outer positions
  OUTER_POSITIONS: [0, 1, 2, 3, 5, 6, 7, 8], // All non-center positions
};

// --- Color Stimuli for Triple/Quad N-Back ---
const COLOR_STIMULI = ['red', 'blue', 'green', 'gold', 'purple', 'teal', 'orange', 'white'];

// --- Shape Stimuli for Quad N-Back ---
const SHAPE_STIMULI = ['circle', 'triangle', 'square', 'diamond', 'star', 'cross', 'heart', 'arrow'];

// --- Game Mode Definitions ---
const GAME_MODES = {
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
const DYNAMIC_SUB_MODE_ORDER = ['dual', 'triple', 'quad'];

// --- Training Protocols + Manual Mode (mirrored verbatim between
// src/constants/gameConstants.js and functions/gameConstants.js) ---
// TRAINING_MODES is the canonical set of values a session's `trainingMode`
// field can hold. 'dynamic' is a meta-mode tag the client writes while Dynamic
// cycling is on (the backend reads it for sub-mode rotation); it is not a
// protocol, and every protocol reader treats it as Adaptive. Old session docs
// may also carry null/absent.
const TRAINING_MODES = Object.freeze({
  ADAPTIVE: 'adaptive',
  CLASSIC: 'classic',
  MANUAL: 'manual',
  DYNAMIC: 'dynamic', // meta-mode tag written while Dynamic cycling is on; not a protocol — protocol readers treat it as Adaptive
});

// Manual mode: the generator still needs a seed for the internals that stay
// fixed in v1 (overlap depth, decoy hardness, shuffle bias). 0.50 = Jaeggi behavior.
const MANUAL_INTERNAL_SEED = 0.5;

const MANUAL_PARAM_RANGES = Object.freeze({
  nBack: Object.freeze({ min: 1, max: 9 }),
  trials: Object.freeze({ min: 10, max: 100, step: 1 }),
  isiSeconds: Object.freeze({ min: 1.0, max: 6.0, step: 0.1 }),
  stimulusMs: Object.freeze({ min: 100, max: 3000, step: 50, gapBelowIsiMs: 100 }), // effective max = min(3000, isiMs - 100)
  matchRate: Object.freeze({ min: 0.10, max: 0.50, step: 0.01 }),                   // fraction per active modality
  overlapCount: Object.freeze({ min: 0, max: 10 }),                                 // effective max = trials - nBack
  lureCount: Object.freeze({ min: 0, max: 10 }),
  jitterPercent: Object.freeze({ min: 0, max: 25, step: 1 }),                       // integer percent of ISI
});

const MANUAL_CLASSIC_DEFAULTS = Object.freeze({
  isiSeconds: 3.0,
  stimulusMs: 500,
  matchRateByMode: Object.freeze({ dual: 0.27, triple: 0.22, quad: 0.16 }),
  overlapCount: 2,
  lureCount: 2,
  jitterPercent: 0,
  trialsForNBack: (nBack) => 20 + nBack,
});

const MANUAL_PRESETS = Object.freeze({
  LAST_USED: 'last_used',
  CLASSIC_STANDARD: 'classic_standard',
  ADAPTIVE_LEVEL: 'adaptive_level',
  CUSTOM: 'custom',
});
// --- End Manual Mode constants ---

// --- Mode-Specific Algorithm Parameters ---
// Allows fine-tuning each mode independently during testing
const MODE_ALGORITHM_PARAMS = {
  // MATCH_DENSITY values are PER-MODALITY match rates (% of trials with a match
  // in that single modality). Mode-specific values are Jaeggi-anchored at d=0.50.
  // OVERLAP_COUNT is mode-agnostic; OVERLAP_DEPTH only applies to triple/quad.
  dual: {
    TRIALS: { BASE_N2_MIN: 14, BASE_N2_MAX: 46, N_FACTOR: 1 },
    MATCH_DENSITY: { MAX: 0.30, BREAKPOINT_DIFF: 0.50, BREAKPOINT_VALUE: 0.27, MIN: 0.22 },
    LURES: { MAX: 4 },
    ISI: { MIN: 1.5, MAX: 3.5 },
    OVERLAP_COUNT: { MIN_DIFFICULTY: 0.20, BREAKPOINT_DIFF: 0.50, BREAKPOINT_VALUE: 2, MAX: 3 },
    ADVANCEMENT: { CONSECUTIVE_ROUNDS: 1, DPRIME_THRESHOLD: 2.8 },
    DIFFICULTY_ADJUSTMENT: { MIN: -0.03, MAX: 0.07 }
  },
  triple: {
    TRIALS: { BASE_N2_MIN: 14, BASE_N2_MAX: 46, N_FACTOR: 1 },
    MATCH_DENSITY: { MAX: 0.22, BREAKPOINT_DIFF: 0.50, BREAKPOINT_VALUE: 0.22, MIN: 0.19 },
    LURES: { MAX: 4 },
    ISI: { MIN: 1.5, MAX: 3.5 },
    OVERLAP_COUNT: { MIN_DIFFICULTY: 0.20, BREAKPOINT_DIFF: 0.50, BREAKPOINT_VALUE: 2, MAX: 3 },
    OVERLAP_DEPTH: { BREAKPOINT_DIFF: 0.50, P3_AT_BREAKPOINT: 0.0, P3_AT_MAX: 0.50 },
    ADVANCEMENT: { CONSECUTIVE_ROUNDS: 1, DPRIME_THRESHOLD: 2.8 },
    DIFFICULTY_ADJUSTMENT: { MIN: -0.03, MAX: 0.07 }
  },
  quad: {
    TRIALS: { BASE_N2_MIN: 14, BASE_N2_MAX: 46, N_FACTOR: 1 },
    MATCH_DENSITY: { MAX: 0.16, BREAKPOINT_DIFF: 0.50, BREAKPOINT_VALUE: 0.16, MIN: 0.14 },
    LURES: { MAX: 4 },
    ISI: { MIN: 1.75, MAX: 3.5 },  // Slightly slower pace for 4 modalities
    OVERLAP_COUNT: { MIN_DIFFICULTY: 0.20, BREAKPOINT_DIFF: 0.50, BREAKPOINT_VALUE: 2, MAX: 3 },
    OVERLAP_DEPTH: {
      BREAKPOINT_DIFF: 0.50,
      P3_AT_BREAKPOINT: 0.0, P3_AT_MAX: 0.35,
      P4_AT_BREAKPOINT: 0.0, P4_AT_MAX: 0.15
    },
    ADVANCEMENT: { CONSECUTIVE_ROUNDS: 1, DPRIME_THRESHOLD: 2.8 },
    DIFFICULTY_ADJUSTMENT: { MIN: -0.03, MAX: 0.07 }
  },
  singleVisual: {
    TRIALS: { BASE_N2_MIN: 14, BASE_N2_MAX: 46, N_FACTOR: 1 },
    MATCH_DENSITY: { MAX: 0.30, BREAKPOINT_DIFF: 0.50, BREAKPOINT_VALUE: 0.27, MIN: 0.22 },
    LURES: { MAX: 4 },
    ISI: { MIN: 1.5, MAX: 3.5 },
    OVERLAP_COUNT: { MIN_DIFFICULTY: 0.20, BREAKPOINT_DIFF: 0.50, BREAKPOINT_VALUE: 2, MAX: 3 },
    ADVANCEMENT: { CONSECUTIVE_ROUNDS: 1, DPRIME_THRESHOLD: 2.8 },
    DIFFICULTY_ADJUSTMENT: { MIN: -0.03, MAX: 0.07 }
  },
  singleAudio: {
    TRIALS: { BASE_N2_MIN: 14, BASE_N2_MAX: 46, N_FACTOR: 1 },
    MATCH_DENSITY: { MAX: 0.30, BREAKPOINT_DIFF: 0.50, BREAKPOINT_VALUE: 0.27, MIN: 0.22 },
    LURES: { MAX: 4 },
    ISI: { MIN: 1.5, MAX: 3.5 },
    OVERLAP_COUNT: { MIN_DIFFICULTY: 0.20, BREAKPOINT_DIFF: 0.50, BREAKPOINT_VALUE: 2, MAX: 3 },
    ADVANCEMENT: { CONSECUTIVE_ROUNDS: 1, DPRIME_THRESHOLD: 2.8 },
    DIFFICULTY_ADJUSTMENT: { MIN: -0.03, MAX: 0.07 }
  },
  singleColor: {
    TRIALS: { BASE_N2_MIN: 14, BASE_N2_MAX: 46, N_FACTOR: 1 },
    MATCH_DENSITY: { MAX: 0.30, BREAKPOINT_DIFF: 0.50, BREAKPOINT_VALUE: 0.27, MIN: 0.22 },
    LURES: { MAX: 4 },
    ISI: { MIN: 1.5, MAX: 3.5 },
    OVERLAP_COUNT: { MIN_DIFFICULTY: 0.20, BREAKPOINT_DIFF: 0.50, BREAKPOINT_VALUE: 2, MAX: 3 },
    ADVANCEMENT: { CONSECUTIVE_ROUNDS: 1, DPRIME_THRESHOLD: 2.8 },
    DIFFICULTY_ADJUSTMENT: { MIN: -0.03, MAX: 0.07 }
  },
  singleShape: {
    TRIALS: { BASE_N2_MIN: 14, BASE_N2_MAX: 46, N_FACTOR: 1 },
    MATCH_DENSITY: { MAX: 0.30, BREAKPOINT_DIFF: 0.50, BREAKPOINT_VALUE: 0.27, MIN: 0.22 },
    LURES: { MAX: 4 },
    ISI: { MIN: 1.5, MAX: 3.5 },
    OVERLAP_COUNT: { MIN_DIFFICULTY: 0.20, BREAKPOINT_DIFF: 0.50, BREAKPOINT_VALUE: 2, MAX: 3 },
    ADVANCEMENT: { CONSECUTIVE_ROUNDS: 1, DPRIME_THRESHOLD: 2.8 },
    DIFFICULTY_ADJUSTMENT: { MIN: -0.03, MAX: 0.07 }
  }
};

// --- Language-Specific Audio Letter Sets (Native Characters) ---
// This is the crucial constant that was missing.
const LANGUAGE_AUDIO_LETTERS = {
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

// --- Free Tier Difficulty Steps ---
// Free users have difficulty snapped to these coarse steps
// Pro users get full 0.01 increment precision (100 levels per N-Back)
const FREE_TIER_DIFFICULTY_STEPS = [0.00, 0.25, 0.50, 0.75, 0.99]; // Grandfathered users (preMonetizationChange: true)
const FREE_TIER_DIFFICULTY_STEPS_NEW = [0.00, 0.50]; // New free users (2 levels per N-Back)

// --- Export using CommonJS ---
module.exports = {
    DIFFICULTY_TIERS_CONCEPTUAL,
    DIFFICULTY_TIERS_DISPLAY,
    FEEDBACK_MESSAGES,
    FEATURE_INTRODUCTION,
    COACHING_MESSAGES,
    CST_TEST_TYPES,
    COUNTING_SPAN_DEFAULTS,
    OPERATION_SPAN_DEFAULTS,
    DIGIT_SPAN_DEFAULTS,
    SYMMETRY_SPAN_DEFAULTS,
    VISUAL_ARRAYS_DEFAULTS,
    ANTISACCADE_DEFAULTS,
    RELATION_MONITORING_DEFAULTS,
    LETTER_NUMBER_COMPARISON_DEFAULTS,
    ALGORITHM_PARAMS,
    DAILY_ADAPTIVE_CAP,
    DPRIME_THRESHOLDS_INTERPRETATION,
    STIMULI,
    LANGUAGE_AUDIO_LETTERS,
    // Quad N-Back additions
    COLOR_STIMULI,
    SHAPE_STIMULI,
    GAME_MODES,
    DYNAMIC_SUB_MODE_ORDER,
    TRAINING_MODES,
    MANUAL_INTERNAL_SEED,
    MANUAL_PARAM_RANGES,
    MANUAL_CLASSIC_DEFAULTS,
    MANUAL_PRESETS,
    MODE_ALGORITHM_PARAMS,
    FREE_TIER_DIFFICULTY_STEPS,
    FREE_TIER_DIFFICULTY_STEPS_NEW,
    DIFFICULTY_ADJUSTMENT_RANGES,
    SPATIAL_POOL
};
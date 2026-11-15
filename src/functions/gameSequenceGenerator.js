/* functions/gameSequenceGenerator.js */

// Import constants and helpers using require for the Cloud Functions environment
const {
  STIMULI,
  ALGORITHM_PARAMS,
  LANGUAGE_AUDIO_LETTERS,
  COLOR_STIMULI,
  SHAPE_STIMULI,
  GAME_MODES,
  MODE_ALGORITHM_PARAMS,
  SPATIAL_POOL
} = require('./gameConstants');
const {
  calculateTrials,                  // Calculates total trials based on difficulty and n-back
  calculateLures,                   // Calculates number of lure trials (n+/-1)
  calculatePerModalityMatchCount,   // Per-modality target match count (stochastically rounded)
  calculateExpectedOverlapCount,    // Expected overlap trial count (float; caller rounds)
  calculateOverlapDepth,            // { p2, p3, p4 } depth distribution per overlap trial
  getStimuliSet,                    // Gets the appropriate set of audio letters based on difficulty AND NOW LANGUAGE
} = require('./gameHelpers');

// --- Internal Helper Functions ---

/**
 * Fisher-Yates (Knuth) shuffle - produces truly uniform random permutation.
 * Unlike .sort(() => Math.random() - 0.5), this algorithm guarantees
 * equal probability for all permutations.
 *
 * @param {Array} array - Array to shuffle
 * @returns {Array} New shuffled array (does not mutate original)
 */
const shuffleArray = (array) => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

/**
 * Graduated shuffle - blends biased and uniform shuffling based on difficulty.
 * At difficulty 0.0: 100% biased (early positions favored - training wheels)
 * At difficulty 0.5: 50% biased, 50% uniform
 * At difficulty 1.0: 100% uniform (fully random - no training wheels)
 *
 * This helps beginners at new n-back levels get early matches/lures,
 * while ensuring mastery (0.99 difficulty) requires handling true randomness.
 *
 * @param {Array} array - Array to shuffle
 * @param {number} difficultySeed - Difficulty level (0.0-1.0)
 * @returns {Array} Shuffled array
 */
const graduatedShuffle = (array, difficultySeed) => {
  // Training wheels fully off by difficulty 0.25 (early Phase II)
  // This gives beginners help at n.00 while ensuring 75% of difficulty range is uniform
  const TRAINING_WHEELS_CUTOFF = 0.25;
  const adjustedDifficulty = Math.min(difficultySeed / TRAINING_WHEELS_CUTOFF, 1.0);
  const useUniformShuffle = Math.random() < adjustedDifficulty;

  if (useUniformShuffle) {
    return shuffleArray(array);
  } else {
    // Biased shuffle - elements near front tend to stay near front
    return [...array].sort(() => Math.random() - 0.5);
  }
};

/**
 * Pick a depth (2, 3, or 4) by sampling from { p2, p3, p4 } probabilities.
 * Falls back to 2 if probabilities don't sum to ~1 (defensive).
 *
 * @param {{p2: number, p3: number, p4: number}} dist - Depth distribution.
 * @param {number} maxDepth - Maximum depth allowed (= number of active modalities).
 * @returns {number} Chosen depth (clamped to [2, maxDepth]).
 */
const pickOverlapDepth = (dist, maxDepth) => {
  const r = Math.random();
  // Sample in cumulative order p2 → p3 → p4.
  if (r < dist.p2) return Math.min(2, maxDepth);
  if (r < dist.p2 + dist.p3) return Math.min(3, maxDepth);
  return Math.min(4, maxDepth);
};

/**
 * Pick `count` distinct modalities uniformly at random from `activeModalities`.
 *
 * @param {string[]} activeModalities - Available modality keys.
 * @param {number} count - Number of distinct modalities to choose.
 * @returns {string[]} Subset of size min(count, activeModalities.length).
 */
const pickRandomModalities = (activeModalities, count) => {
  const shuffled = shuffleArray(activeModalities);
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

/**
 * Allocates matches within the sequence using per-modality match counts and
 * mode-aware overlap depth scaling.
 *
 * Algorithm:
 *   1. Compute per-modality target match counts (each modality independently
 *      aims for `possibleMatchTrials × perModalityRate`, stochastically rounded).
 *   2. Compute expected overlap trial count and stochastically round.
 *   3. Allocate overlap trials FIRST: roll a depth (2/3/4) from the depth
 *      distribution, then pick that many modalities and mark all as matching
 *      on the same position. Decrement each modality's quota.
 *   4. Allocate remaining single-modality matches: walk shuffled positions,
 *      assigning the modality with the highest remaining quota (random tiebreak)
 *      until all quotas hit zero (or positions run out).
 *
 * @param {Array<Object>} sequence - The sequence array, initialized with null stimuli and flags.
 * @param {number} nBack - The current n-back level.
 * @param {number} difficultySeed - The difficulty seed (0.0-1.0) used for parameter calculations.
 * @param {string} gameMode - The game mode ('dual', 'triple', 'quad', 'single*').
 * @param {Object} modeParams - The mode-specific algorithm parameters (kept for API symmetry).
 */
// eslint-disable-next-line no-unused-vars
const allocateMatches = (sequence, nBack, difficultySeed, gameMode, modeParams, options = null) => {
  const totalTrials = sequence.length;
  const effectiveTrials = (options && typeof options.effectiveTrials === 'number' && options.effectiveTrials > 0)
    ? options.effectiveTrials
    : totalTrials;
  const possibleMatchTrials = Math.max(0, totalTrials - nBack);

  if (possibleMatchTrials === 0) {
    console.log("allocateMatches: No possible trials for matches.");
    return;
  }

  const activeModalities = GAME_MODES[gameMode]?.modalities || ['visual', 'audio'];
  if (activeModalities.length === 0) {
    console.log("allocateMatches: No active modalities.");
    return;
  }

  const matchKeyMap = {
    visual: 'isVisualMatch',
    audio: 'isAudioMatch',
    color: 'isColorMatch',
    shape: 'isShapeMatch',
  };

  // 1. Per-modality target counts (each modality rolls independently).
  //    Use TOTAL trial count for the rate (matches Jaeggi: 22 × 0.27 ≈ 6 per mod
  //    in a 22-trial dual session), but cap at possibleMatchTrials (= trials - n)
  //    so we never assign more matches than there are eligible positions.
  const remainingQuota = {};
  for (const mod of activeModalities) {
    const target = calculatePerModalityMatchCount(effectiveTrials, difficultySeed, gameMode);
    remainingQuota[mod] = Math.min(target, possibleMatchTrials);
  }
  const initialQuotas = { ...remainingQuota };

  // 2. Expected overlap count → stochastic integer.
  let overlapCount = 0;
  if (activeModalities.length >= 2) {
    const expectedOverlap = calculateExpectedOverlapCount(difficultySeed, gameMode);
    const baseOverlap = Math.floor(expectedOverlap);
    const extraProb = expectedOverlap - baseOverlap;
    overlapCount = baseOverlap + (Math.random() < extraProb ? 1 : 0);
  }

  // 3. Depth distribution.
  const depthDist = calculateOverlapDepth(difficultySeed, gameMode);

  // Available positions, graduated-shuffled.
  const availablePositions = Array.from({ length: possibleMatchTrials }, (_, i) => i + nBack);
  const shuffledPositions = graduatedShuffle(availablePositions, difficultySeed);

  const assignedCounts = { visual: 0, audio: 0, color: 0, shape: 0 };
  const overlapDepthHistogram = { 2: 0, 3: 0, 4: 0 };
  let positionCursor = 0;

  console.log(`allocateMatches: GameMode=${gameMode}, possibleTrials=${possibleMatchTrials}, perModTargets=${JSON.stringify(initialQuotas)}, overlapCount=${overlapCount}, depthDist={p2:${depthDist.p2.toFixed(2)},p3:${depthDist.p3.toFixed(2)},p4:${depthDist.p4.toFixed(2)}}`);

  // 4. Allocate overlap trials first.
  let actualOverlapTrials = 0;
  for (let o = 0; o < overlapCount && positionCursor < shuffledPositions.length; o++) {
    // Pick depth in [2, activeModalities.length].
    let depth = pickOverlapDepth(depthDist, activeModalities.length);
    // Don't exceed remaining modalities with quota left.
    const modsWithQuota = activeModalities.filter(m => remainingQuota[m] > 0);
    if (modsWithQuota.length < 2) {
      // Not enough modalities have quota left to support an overlap; stop.
      break;
    }
    depth = Math.min(depth, modsWithQuota.length);

    const chosenMods = pickRandomModalities(modsWithQuota, depth);
    const pos = shuffledPositions[positionCursor++];

    for (const mod of chosenMods) {
      const key = matchKeyMap[mod];
      sequence[pos][key] = true;
      assignedCounts[mod]++;
      remainingQuota[mod]--;
    }
    overlapDepthHistogram[depth] = (overlapDepthHistogram[depth] || 0) + 1;
    actualOverlapTrials++;
  }

  // 5. Allocate single-modality matches: pick the mod with the largest remaining
  //    quota (random tiebreak among ties), assign one match at next position.
  while (positionCursor < shuffledPositions.length) {
    let maxQuota = 0;
    for (const mod of activeModalities) {
      if (remainingQuota[mod] > maxQuota) maxQuota = remainingQuota[mod];
    }
    if (maxQuota <= 0) break;

    const candidates = activeModalities.filter(m => remainingQuota[m] === maxQuota);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];

    const pos = shuffledPositions[positionCursor++];
    sequence[pos][matchKeyMap[chosen]] = true;
    assignedCounts[chosen]++;
    remainingQuota[chosen]--;
  }

  console.log(`allocateMatches: Done. Assigned counts V=${assignedCounts.visual}, A=${assignedCounts.audio}, C=${assignedCounts.color}, S=${assignedCounts.shape}. Overlap trials=${actualOverlapTrials} (depth: 2x=${overlapDepthHistogram[2]}, 3x=${overlapDepthHistogram[3]}, 4x=${overlapDepthHistogram[4]}).`);
};


/**
 * Allocates lure trials (n-1 or n+1 matches) within the sequence.
 * Lures are trials that match the stimulus n-1 or n+1 trials back, but NOT n trials back.
 * Supports all game modes (dual, triple, quad).
 *
 * @param {Array<Object>} sequence - The sequence array with matches already allocated.
 * @param {number} nBack - The current n-back level.
 * @param {number} lureCount - The target number of lure trials to create.
 * @param {string} gameMode - The game mode ('dual', 'triple', 'quad').
 * @param {number} difficultySeed - The difficulty seed (0.0-1.0) for graduated shuffle.
 * @param {number[]} spatialPool - The active spatial position pool for this session.
 */
const allocateLures = (sequence, nBack, lureCount, gameMode, difficultySeed) => {
  if (lureCount <= 0) return;

  const trials = sequence.length;
  const nMinus1 = nBack - 1;

  // Get active modalities for this game mode
  const activeModalities = GAME_MODES[gameMode]?.modalities || ['visual', 'audio'];

  // Find positions that can be lures (not already matches).
  // At n=1 there is no n-1 lure (distance 0 = the trial itself), so only
  // n+1 lures exist and the earliest valid lure position is nBack + 1.
  const minLurePos = nBack < 2 ? nBack + 1 : nMinus1;
  const availablePositions = [];
  for (let i = 0; i < trials; i++) {
    const isTrueMatch = sequence[i].isVisualMatch || sequence[i].isAudioMatch ||
                        sequence[i].isColorMatch || sequence[i].isShapeMatch;
    const canBeLurePosition = i >= minLurePos;
    if (!isTrueMatch && canBeLurePosition) {
      availablePositions.push(i);
    }
  }

  if (availablePositions.length === 0) return;

  // Graduated shuffle: biased at low difficulty (training wheels), uniform at high difficulty
  const shuffledPositions = graduatedShuffle(availablePositions, difficultySeed);
  let assignedLures = 0;

  for (let i = 0; i < shuffledPositions.length && assignedLures < lureCount; i++) {
    const pos = shuffledPositions[i];

    // Skip if already has a lure flag
    if (sequence[pos].isVisualLure || sequence[pos].isAudioLure ||
        sequence[pos].isColorLure || sequence[pos].isShapeLure) {
      continue;
    }

    // Pick a random modality from eligible ones to assign the lure (uniform shuffle)
    const shuffledMods = shuffleArray(activeModalities);
    const chosenMod = shuffledMods[0];

    // Assign lure flag based on chosen modality
    if (chosenMod === 'visual') {
      sequence[pos].isVisualLure = true;
      assignedLures++;
    } else if (chosenMod === 'audio') {
      sequence[pos].isAudioLure = true;
      assignedLures++;
    } else if (chosenMod === 'color') {
      sequence[pos].isColorLure = true;
      assignedLures++;
    } else if (chosenMod === 'shape') {
      sequence[pos].isShapeLure = true;
      assignedLures++;
    }
  }

  console.log(`allocateLures: Target=${lureCount}, Assigned=${assignedLures}`);
};


/**
 * Fills the sequence array with actual stimuli based on allocated match/lure flags.
 * Supports all game modes (dual, triple, quad) with position, letter, color, and shape stimuli.
 *
 * @param {Array<Object>} sequence - The sequence array with match/lure flags set.
 * @param {Array<number>} positions - Array of possible visual position indices (0-8).
 * @param {Array<string>} letters - Array of possible audio letters.
 * @param {Array<string>} colors - Array of possible color stimuli.
 * @param {Array<string>} shapes - Array of possible shape stimuli.
 * @param {number} nBack - The current n-back level.
 * @param {string} gameMode - The game mode ('dual', 'triple', 'quad').
 */
const fillSequence = (sequence, positions, letters, colors, shapes, nBack, gameMode, difficultySeed) => {
  const trials = sequence.length;
  const activeModalities = GAME_MODES[gameMode]?.modalities || ['visual', 'audio'];
  const hasVisual = activeModalities.includes('visual');
  const hasAudio = activeModalities.includes('audio');
  const hasColor = activeModalities.includes('color');
  const hasShape = activeModalities.includes('shape');

  for (let i = 0; i < trials; i++) {
    let assignedPos = false;
    let assignedLetter = false;
    let assignedColor = false;
    let assignedShape = false;

    // --- 1. Handle True Matches ---
    if (i >= nBack && sequence[i - nBack]) {
      // Visual match
      if (hasVisual && sequence[i].isVisualMatch && sequence[i - nBack].position !== null) {
        sequence[i].position = sequence[i - nBack].position;
        assignedPos = true;
      }
      // Audio match
      if (hasAudio && sequence[i].isAudioMatch && sequence[i - nBack].letter !== null) {
        sequence[i].letter = sequence[i - nBack].letter;
        assignedLetter = true;
      }
      // Color match
      if (hasColor && sequence[i].isColorMatch && sequence[i - nBack].color !== null) {
        sequence[i].color = sequence[i - nBack].color;
        assignedColor = true;
      }
      // Shape match
      if (hasShape && sequence[i].isShapeMatch && sequence[i - nBack].shape !== null) {
        sequence[i].shape = sequence[i - nBack].shape;
        assignedShape = true;
      }
    }

    // --- 2. Handle Lures ---
    // Helper function to handle lure assignment for any modality
    // Uses difficulty-based lure type selection: higher difficulty = more n-1 (harder) lures
    const handleLure = (modalityKey, stimKey, stimArray, hasModality, isLure, isAssigned) => {
      if (!hasModality || !isLure || isAssigned) return { assigned: isAssigned, value: null, lureType: null };

      // Difficulty-based lure type selection
      // Higher difficulty = higher chance of trying n-1 (harder, 786ms RT) first
      // Lower difficulty = higher chance of trying n+1 (easier, 733ms RT) first
      // At n=1 an n-1 lure would be distance 0 (the trial itself) — only n+1 exists.
      const preferHarderLure = Math.random() < difficultySeed;
      const tryOrder = nBack < 2 ? ['n+1'] : (preferHarderLure ? ['n-1', 'n+1'] : ['n+1', 'n-1']);

      for (const lureType of tryOrder) {
        if (lureType === 'n+1') {
          // n+1 lure: matches item ONE position BEFORE target (older, easier)
          if (i >= nBack + 1 && sequence[i - (nBack + 1)]?.[stimKey] !== null && sequence[i - (nBack + 1)]?.[stimKey] !== undefined) {
            return { assigned: true, value: sequence[i - (nBack + 1)][stimKey], lureType: 'n+1' };
          }
        } else {
          // n-1 lure: matches item ONE position AFTER target (more recent, harder)
          if (nBack > 0 && i >= nBack - 1 && sequence[i - (nBack - 1)]?.[stimKey] !== null && sequence[i - (nBack - 1)]?.[stimKey] !== undefined) {
            // Ensure n-1 lure doesn't create actual n-back match
            if (i < nBack || sequence[i - (nBack - 1)][stimKey] !== sequence[i - nBack]?.[stimKey]) {
              return { assigned: true, value: sequence[i - (nBack - 1)][stimKey], lureType: 'n-1' };
            }
          }
        }
      }

      return { assigned: false, value: null, lureType: null };
    };

    // Visual lure
    if (hasVisual && sequence[i].isVisualLure && !assignedPos) {
      const result = handleLure('visual', 'position', positions, hasVisual, sequence[i].isVisualLure, assignedPos);
      if (result.assigned) {
        sequence[i].position = result.value;
        sequence[i].visualLureType = result.lureType;
        assignedPos = true;
      } else {
        sequence[i].isVisualLure = false;
      }
    }

    // Audio lure
    if (hasAudio && sequence[i].isAudioLure && !assignedLetter) {
      const result = handleLure('audio', 'letter', letters, hasAudio, sequence[i].isAudioLure, assignedLetter);
      if (result.assigned) {
        sequence[i].letter = result.value;
        sequence[i].audioLureType = result.lureType;
        assignedLetter = true;
      } else {
        sequence[i].isAudioLure = false;
      }
    }

    // Color lure
    if (hasColor && sequence[i].isColorLure && !assignedColor) {
      const result = handleLure('color', 'color', colors, hasColor, sequence[i].isColorLure, assignedColor);
      if (result.assigned) {
        sequence[i].color = result.value;
        sequence[i].colorLureType = result.lureType;
        assignedColor = true;
      } else {
        sequence[i].isColorLure = false;
      }
    }

    // Shape lure
    if (hasShape && sequence[i].isShapeLure && !assignedShape) {
      const result = handleLure('shape', 'shape', shapes, hasShape, sequence[i].isShapeLure, assignedShape);
      if (result.assigned) {
        sequence[i].shape = result.value;
        sequence[i].shapeLureType = result.lureType;
        assignedShape = true;
      } else {
        sequence[i].isShapeLure = false;
      }
    }

    // --- 3. Fill Remaining Stimuli Randomly ---
    // Helper to get stimulus from n-back, n-1, n+1 positions
    // At n=1 getNMinus1Stim points at the current (still-null) trial, so the
    // n-1 avoidance in pickRandom is a harmless no-op — no n-1 lure exists at n=1.
    const getNBackStim = (key) => (i >= nBack && sequence[i - nBack]) ? sequence[i - nBack][key] : undefined;
    const getNMinus1Stim = (key) => (nBack > 0 && i >= nBack - 1 && sequence[i - (nBack - 1)]) ? sequence[i - (nBack - 1)][key] : undefined;
    const getNPlus1Stim = (key) => (i >= nBack + 1 && sequence[i - (nBack + 1)]) ? sequence[i - (nBack + 1)][key] : undefined;

    // Helper to pick random non-conflicting stimulus
    const pickRandom = (stimArray, stimKey) => {
      const nBackStim = getNBackStim(stimKey);
      const nMinus1Stim = getNMinus1Stim(stimKey);
      const nPlus1Stim = getNPlus1Stim(stimKey);
      let available = stimArray.filter(s =>
        s !== nBackStim &&
        (nBack <= 0 || s !== nMinus1Stim) &&
        s !== nPlus1Stim
      );
      if (available.length === 0) available = stimArray;
      return available[Math.floor(Math.random() * available.length)];
    };

    // Fill visual position
    if (hasVisual && !assignedPos) {
      sequence[i].position = pickRandom(positions, 'position');
    } else if (!hasVisual) {
      sequence[i].position = null;
    }

    // Fill audio letter
    if (hasAudio && !assignedLetter) {
      if (letters.length > 0) {
        sequence[i].letter = pickRandom(letters, 'letter');
      } else {
        sequence[i].letter = null;
        console.error(`fillSequence: No letters available for trial ${i}`);
      }
    } else if (!hasAudio) {
      sequence[i].letter = null;
    }

    // Fill color
    if (hasColor && !assignedColor) {
      sequence[i].color = pickRandom(colors, 'color');
    } else if (!hasColor) {
      sequence[i].color = null;
    }

    // Fill shape
    if (hasShape && !assignedShape) {
      sequence[i].shape = pickRandom(shapes, 'shape');
    } else if (!hasShape) {
      sequence[i].shape = null;
    }
  }
};


/**
 * Generate a random sequence for an n-back game session.
 * Supports dual (visual+audio), triple (visual+audio+color), and quad (visual+audio+color+shape) modes.
 *
 * @param {number} nBack - The n-back level (e.g., 2 for 2-back).
 * @param {number} difficultySeed - The difficulty seed (0.0-1.0) used for generation parameters.
 * @param {string} [gameMode='dual'] - The game mode: 'dual', 'triple', or 'quad'.
 * @param {number|null} [overrideTrials=null] - If provided, forces a specific number of trials.
 * @param {string} [languageCode='en'] - The language code for audio stimuli.
 * @returns {Object} Generated sequence with match arrays for all modalities.
 */
const generateSequence = (nBack, difficultySeed, gameMode = 'dual', overrideTrials = null, languageCode = 'en', options = null) => {
  // Validate and default gameMode
  const validGameModes = ['dual', 'triple', 'quad', 'singleVisual', 'singleAudio', 'singleColor', 'singleShape'];
  const effectiveGameMode = validGameModes.includes(gameMode) ? gameMode : 'dual';

  // Get mode-specific parameters
  const modeParams = MODE_ALGORITHM_PARAMS[effectiveGameMode] || MODE_ALGORITHM_PARAMS.dual;

  // Ensure languageCode is valid
  const effectiveLanguageCode = typeof languageCode === 'string' && languageCode.trim() !== '' ? languageCode : 'en';

  console.log(`generateSequence: nBack=${nBack}, difficulty=${difficultySeed}, gameMode=${effectiveGameMode}, language=${effectiveLanguageCode}`);

  // 1. Calculate trials
  const trials = overrideTrials !== null && overrideTrials > 0
    ? overrideTrials
    : calculateTrials(difficultySeed, nBack);

  // 2. Calculate lure count
  const lureCount = calculateLures(difficultySeed);

  // 3. Get stimuli sets
  let letters = getStimuliSet(difficultySeed, effectiveLanguageCode);
  if (!letters || letters.length === 0) {
    console.error(`generateSequence: No letters for language '${effectiveLanguageCode}'. Using fallback.`);
    letters = ['A', 'B', 'C'];
  }
  const positions = [...SPATIAL_POOL.OUTER_POSITIONS];
  const colors = [...COLOR_STIMULI];
  const shapes = [...SHAPE_STIMULI];

  // 4. Initialize sequence with extended trial structure
  const sequence = Array(trials).fill(null).map(() => ({
    position: null,
    letter: null,
    color: null,
    shape: null,
    isVisualMatch: false,
    isAudioMatch: false,
    isColorMatch: false,
    isShapeMatch: false,
    isVisualLure: false,
    isAudioLure: false,
    isColorLure: false,
    isShapeLure: false
  }));

  // 5. Allocate matches (using mode-specific params)
  // options.effectiveTrials lets the buffer-trials path target match density on the
  // FULL session length even though we generate fewer NEW trials (the inherited primers
  // count toward total session). Default = trials (today's behavior).
  allocateMatches(sequence, nBack, difficultySeed, effectiveGameMode, modeParams, options);

  // 6. Allocate lures (pass spatial pool for visual lure suppression)
  allocateLures(sequence, nBack, lureCount, effectiveGameMode, difficultySeed);

  // 7. Fill sequence with stimuli
  fillSequence(sequence, positions, letters, colors, shapes, nBack, effectiveGameMode, difficultySeed);

  // 8. Verify and collect actual matches post-fill
  const actualVisualMatches = [];
  const actualAudioMatches = [];
  const actualColorMatches = [];
  const actualShapeMatches = [];

  for (let i = nBack; i < trials; i++) {
    // Visual
    if (sequence[i].position !== null && sequence[i - nBack]?.position !== null &&
        sequence[i].position === sequence[i - nBack].position) {
      actualVisualMatches.push(i);
      if (!sequence[i].isVisualMatch) sequence[i].isVisualMatch = true;
    } else {
      if (sequence[i].isVisualMatch) sequence[i].isVisualMatch = false;
    }

    // Audio
    if (sequence[i].letter !== null && sequence[i - nBack]?.letter !== null &&
        sequence[i].letter === sequence[i - nBack].letter) {
      actualAudioMatches.push(i);
      if (!sequence[i].isAudioMatch) sequence[i].isAudioMatch = true;
    } else {
      if (sequence[i].isAudioMatch) sequence[i].isAudioMatch = false;
    }

    // Color
    if (sequence[i].color !== null && sequence[i - nBack]?.color !== null &&
        sequence[i].color === sequence[i - nBack].color) {
      actualColorMatches.push(i);
      if (!sequence[i].isColorMatch) sequence[i].isColorMatch = true;
    } else {
      if (sequence[i].isColorMatch) sequence[i].isColorMatch = false;
    }

    // Shape
    if (sequence[i].shape !== null && sequence[i - nBack]?.shape !== null &&
        sequence[i].shape === sequence[i - nBack].shape) {
      actualShapeMatches.push(i);
      if (!sequence[i].isShapeMatch) sequence[i].isShapeMatch = true;
    } else {
      if (sequence[i].isShapeMatch) sequence[i].isShapeMatch = false;
    }
  }

  console.log(`Generated ${effectiveGameMode} sequence: ${trials} trials. Matches - V:${actualVisualMatches.length}, A:${actualAudioMatches.length}, C:${actualColorMatches.length}, S:${actualShapeMatches.length}`);

  // 9. Aggregate lure type distribution for analytics
  const luresByType = { 'n-1': 0, 'n+1': 0 };
  for (let i = 0; i < trials; i++) {
    if (sequence[i].visualLureType) luresByType[sequence[i].visualLureType]++;
    if (sequence[i].audioLureType) luresByType[sequence[i].audioLureType]++;
    if (sequence[i].colorLureType) luresByType[sequence[i].colorLureType]++;
    if (sequence[i].shapeLureType) luresByType[sequence[i].shapeLureType]++;
  }
  console.log(`Lure distribution: n-1=${luresByType['n-1']} (harder), n+1=${luresByType['n+1']} (easier)`);

  // 10. Return sequence with all match arrays and lure analytics
  return {
    sequence,
    visualMatches: actualVisualMatches,
    audioMatches: actualAudioMatches,
    colorMatches: actualColorMatches,
    shapeMatches: actualShapeMatches,
    trials,
    gameMode: effectiveGameMode,
    luresByType
  };
};


/**
 * Generate K random primer stimuli at the given difficulty level. Used by Continuous Mode
 * to pre-position the next session's first K trials. Primers have NO match flags — they
 * serve as priorContext for n-back lookback in the next session.
 *
 * @param {number} count - Number of primers to generate
 * @param {number} difficultySeed - 0.0-1.0 difficulty for stimulus pool selection
 * @param {string} gameMode - dual/triple/quad/etc
 * @param {string} languageCode - audio language
 * @returns {Array} Array of primer stimulus objects (no match/lure flags set)
 */
const generatePrimerStimuli = (count, difficultySeed, gameMode, languageCode = 'en') => {
    const safeCount = Math.max(0, Math.floor(count || 0));
    if (safeCount === 0) return [];
    const effectiveLanguageCode = typeof languageCode === 'string' && languageCode.trim() !== '' ? languageCode : 'en';
    let letters = getStimuliSet(difficultySeed, effectiveLanguageCode);
    if (!letters || letters.length === 0) letters = ['A', 'B', 'C'];
    const positions = [...SPATIAL_POOL.OUTER_POSITIONS];
    const colors = [...COLOR_STIMULI];
    const shapes = [...SHAPE_STIMULI];

    // Only populate fields for the active modalities. Inactive modality fields stay null —
    // matches fillSequence's convention so primers can't leak (e.g., audio playback in
    // singleColor where the runtime gates audio on `letter` being truthy).
    const activeModalities = GAME_MODES[gameMode]?.modalities || ['visual', 'audio'];
    const hasVisual = activeModalities.includes('visual');
    const hasAudio  = activeModalities.includes('audio');
    const hasColor  = activeModalities.includes('color');
    const hasShape  = activeModalities.includes('shape');

    const primers = [];
    for (let i = 0; i < safeCount; i++) {
        primers.push({
            position: hasVisual ? positions[Math.floor(Math.random() * positions.length)] : null,
            letter:   hasAudio  ? letters[Math.floor(Math.random() * letters.length)]     : null,
            color:    hasColor  ? colors[Math.floor(Math.random() * colors.length)]       : null,
            shape:    hasShape  ? shapes[Math.floor(Math.random() * shapes.length)]       : null,
            isVisualMatch: false,
            isAudioMatch: false,
            isColorMatch: false,
            isShapeMatch: false,
            isVisualLure: false,
            isAudioLure: false,
            isColorLure: false,
            isShapeLure: false,
        });
    }
    return primers;
};


// --- Export for Cloud Functions (CommonJS) ---
module.exports = {
  generateSequence,
  generatePrimerStimuli,
  allocateMatches
};
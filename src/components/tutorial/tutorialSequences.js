/* src/components/tutorial/tutorialSequences.js */
/* Protocol Guide - Predefined Sequences for Tutorial Trials */

/**
 * These sequences are carefully designed to create known match/non-match
 * patterns that align with the tutorial steps.
 *
 * Grid positions (0-8):
 *   0 | 1 | 2
 *   ---------
 *   3 | 4 | 5
 *   ---------
 *   6 | 7 | 8
 *
 * Letters: Using subset of distinctly-sounding letters
 */

// ═══════════════════════════════════════════════════════════════
// VISUAL-ONLY SEQUENCE (2-back)
// Pattern: Trial 4 matches Trial 2 (position match at index 3)
// ═══════════════════════════════════════════════════════════════
export const VISUAL_2BACK_SEQUENCE = [
  { position: 6, letter: null },  // Trial 1: Bottom-left
  { position: 1, letter: null },  // Trial 2: Top-center
  { position: 7, letter: null },  // Trial 3: Bottom-center (no match to Trial 1)
  { position: 1, letter: null },  // Trial 4: Top-center (MATCH to Trial 2!)
];

// ═══════════════════════════════════════════════════════════════
// AUDIO-ONLY SEQUENCE (2-back)
// Pattern: Trial 4 matches Trial 2 (audio match at index 3)
// ═══════════════════════════════════════════════════════════════
export const AUDIO_2BACK_SEQUENCE = [
  { position: null, letter: 'K' },  // Trial 1
  { position: null, letter: 'T' },  // Trial 2
  { position: null, letter: 'L' },  // Trial 3 (no match to Trial 1's K)
  { position: null, letter: 'T' },  // Trial 4 (MATCH to Trial 2's T!)
];

// ═══════════════════════════════════════════════════════════════
// DUAL SEQUENCE (2-back)
// Pattern:
//   - Trial 3: No match (neither position nor audio matches Trial 1)
//   - Trial 4: Audio matches Trial 2 (audio match only)
// ═══════════════════════════════════════════════════════════════
export const DUAL_2BACK_SEQUENCE = [
  { position: 0, letter: 'C' },  // Trial 1: Top-left, C
  { position: 5, letter: 'H' },  // Trial 2: Middle-right, H
  { position: 3, letter: 'R' },  // Trial 3: Middle-left (no match to Trial 1), R (no audio match)
  { position: 8, letter: 'H' },  // Trial 4: Bottom-right (no visual match), H (AUDIO MATCH)
];

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get the sequence for a given tutorial phase
 */
export const getSequenceForPhase = (phase) => {
  switch (phase) {
    case '2back-visual':
      return VISUAL_2BACK_SEQUENCE;
    case '2back-audio':
      return AUDIO_2BACK_SEQUENCE;
    case 'dual':
      return DUAL_2BACK_SEQUENCE;
    default:
      return [];
  }
};

/**
 * Get the specific trial data for a step
 */
export const getTrialDataForStep = (phase, trialIndex) => {
  const sequence = getSequenceForPhase(phase);
  if (trialIndex >= 0 && trialIndex < sequence.length) {
    return sequence[trialIndex];
  }
  return null;
};

/**
 * Get the N-back target trial data (what to compare against)
 */
export const getNBackTargetData = (phase, trialIndex, nBack = 2) => {
  const sequence = getSequenceForPhase(phase);
  const targetIndex = trialIndex - nBack;
  if (targetIndex >= 0 && targetIndex < sequence.length) {
    return {
      trial: sequence[targetIndex],
      index: targetIndex,
    };
  }
  return null;
};

/**
 * Get history for display (last N trials including current)
 */
export const getTrialHistory = (phase, currentTrialIndex, count = 3) => {
  const sequence = getSequenceForPhase(phase);
  const history = [];

  for (let i = Math.max(0, currentTrialIndex - count + 1); i <= currentTrialIndex; i++) {
    if (i < sequence.length) {
      history.push({
        index: i,
        trial: sequence[i],
        isNBackTarget: i === currentTrialIndex - 2, // For 2-back
        isCurrent: i === currentTrialIndex,
      });
    }
  }

  return history;
};

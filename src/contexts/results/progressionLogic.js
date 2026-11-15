/* src/contexts/results/progressionLogic.js
 * Verbatim port of functions/progressionLogic.js (calculateDprimeBasedAdjustment +
 * determineProgression) so the client can compute next-block N.DD inside a
 * continuous chain using the same formula and dynamic thresholds as the server.
 * Drift between this file and the server version is the bug we are preventing —
 * see scripts/test-progression-parity.mjs for the regression check.
 */

import { PROGRESSION_PARAMS } from '../../constants/gameConstants';
import { computeVeryGoodThreshold } from '../gameHelpers';

/**
 * Normalize a stored promotion-credit count (Sept 2026) to a non-negative integer.
 * Missing, null, non-numeric, negative, or non-finite input all read as 0; fractional
 * input is floored. Shared by determineProgression and walkChainPromotionCredits so
 * the user-doc field and the per-call param are sanitized identically.
 *
 * @param {*} value
 * @returns {number}
 */
export function normalizePromotionCredits(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/**
 * Calculates a difficulty adjustment amount based on d-prime performance.
 * Interpolates between MIN_DIFFICULTY_ADJUSTMENT and MAX_DIFFICULTY_ADJUSTMENT.
 * Uses fairThreshold and excellentThreshold as the interpolation bounds.
 * Includes added logging and validation.
 *
 * @param {number} overallDprime - The user's overall d-prime score for the session.
 * @param {object} thresholds - Contains calculated { excellentThreshold, goodThreshold, fairThreshold }.
 * @returns {number} The calculated difficulty adjustment.
 * @throws {Error} If the thresholds object is invalid or missing required keys.
 */
export const calculateDprimeBasedAdjustment = (overallDprime, thresholds, adjustmentRange) => {
    // ***** Log Entry and Validate Thresholds *****
    console.log("Inside calculateDprimeBasedAdjustment - Received thresholds:", JSON.stringify(thresholds));
    if (!thresholds ||
        typeof thresholds.fairThreshold !== 'number' || isNaN(thresholds.fairThreshold) ||
        typeof thresholds.excellentThreshold !== 'number' || isNaN(thresholds.excellentThreshold))
    {
        console.error("!!! calculateDprimeBasedAdjustment received invalid thresholds object !!!", thresholds);
        throw new Error(`calculateDprimeBasedAdjustment received invalid/incomplete thresholds object: fairThreshold=${thresholds?.fairThreshold}, excellentThreshold=${thresholds?.excellentThreshold}`);
    }
    // ***** End Log and Validation *****

    // Destructure after validation ensures keys exist and are numbers
    const { excellentThreshold, fairThreshold } = thresholds;
    const minAdj = adjustmentRange?.min;
    const maxAdj = adjustmentRange?.max;
    const MIN_DIFFICULTY_ADJUSTMENT = minAdj;
    const MAX_DIFFICULTY_ADJUSTMENT = maxAdj;

    const lowDprimeBound = fairThreshold;
    const highDprimeBound = excellentThreshold;
    let adjustment;

    if (overallDprime < lowDprimeBound) {
        adjustment = MIN_DIFFICULTY_ADJUSTMENT;
    } else if (overallDprime >= highDprimeBound) {
        adjustment = MAX_DIFFICULTY_ADJUSTMENT;
    } else {
        // Linear interpolation between min and max adjustment based on d' position between fair and excellent thresholds
        const range = highDprimeBound - lowDprimeBound;
        const progressFactor = range > 0 ? (overallDprime - lowDprimeBound) / range : 0.5; // Avoid division by zero
        adjustment = MIN_DIFFICULTY_ADJUSTMENT + (MAX_DIFFICULTY_ADJUSTMENT - MIN_DIFFICULTY_ADJUSTMENT) * progressFactor;
    }
    // Clamp the final adjustment to the defined min/max bounds
    return Math.max(MIN_DIFFICULTY_ADJUSTMENT, Math.min(MAX_DIFFICULTY_ADJUSTMENT, adjustment));
};

/**
 * Determines the next n-back level, difficulty, and streak based on performance.
 * Includes added logging and validation for the thresholds object.
 *
 * @param {object} params - Input parameters.
 * @param {number} params.overallDprime - Calculated overall d-prime for the session.
 * @param {object} params.thresholds - Object containing calculated { excellentThreshold, goodThreshold, fairThreshold }.
 * @param {number} params.nBack - N-back level *before* the session.
 * @param {number} params.difficulty - Difficulty *before* the session (0.00-0.99).
 * @param {number} params.consecutiveSuccesses - Streak count *before* the session.
 * @param {number|undefined} params.highestAchievedNBack - Highest n-back previously achieved by the user.
 * @param {boolean} [params.allowEarlyPromotion=true] - When false, the 0.50 + veryGood
 *        clause is skipped and only the legacy 0.99 + good clause can promote. Continuous
 *        chains pass false for block-to-block stepping: an in-chain promotion gets capped
 *        to chainStartNBack and would slam difficulty from 0.50 straight to 0.99 mid-chain.
 *        Chain-END progression uses the default (true).
 * @param {number} [params.promotionCredits=0] - Qualifying early-clause sessions already
 *        banked at this N (Sept 2026). Level scoping is the caller's job: functions/game.js
 *        passes 0 unless the stored credits were earned at the N being played.
 * @returns {object} Object containing { newNBack, newDifficulty, newConsecutiveSuccesses, newPromotionCredits, earnedPromotionCredit, difficultyAdjustment }.
 *        earnedPromotionCredit is true when THIS session qualified for the early clause
 *        (whether or not it promoted). functions/game.js snaps free-tier difficulty after
 *        progression, so a session that lands unsnapped below 0.50 (credits reset here)
 *        but snaps back to 0.50 needs its credits recomputed at the snap site.
 * @throws {Error} If the thresholds object is invalid or missing required keys.
 */
export function determineProgression({
  overallDprime,
  thresholds, // Expects { excellentThreshold, goodThreshold, fairThreshold }
  nBack,
  difficulty,
  consecutiveSuccesses,
  highestAchievedNBack,
  adjustmentRange,
  allowEarlyPromotion = true,
  promotionCredits = 0,
}) {
    // ***** Log Entry and Validate Thresholds *****
    console.log("Entering determineProgression - Received thresholds:", JSON.stringify(thresholds));
    // Validate the thresholds object received by this main function
    if (!thresholds || thresholds.goodThreshold === undefined || thresholds.fairThreshold === undefined) {
         console.error("!!! determineProgression received invalid or incomplete thresholds object (keys missing) !!!", thresholds);
         throw new Error("determineProgression received object missing goodThreshold or fairThreshold");
    }
    // Also validate that the necessary threshold values are numbers
     if (typeof thresholds.goodThreshold !== 'number' || isNaN(thresholds.goodThreshold) ||
         typeof thresholds.fairThreshold !== 'number' || isNaN(thresholds.fairThreshold))
     {
        console.error("!!! determineProgression received non-numeric threshold values !!!", thresholds);
        throw new Error(`determineProgression received non-numeric threshold values: good=${thresholds.goodThreshold}, fair=${thresholds.fairThreshold}`);
     }
    // ***** End Log and Validation *****

    // Retrieve constants and destructure validated thresholds
    const { MAX_DIFFICULTY_PER_LEVEL, DIFFICULTY_INCREMENT, ADVANCEMENT_CONSECUTIVE_ROUNDS, PROMOTION_MIN_DIFFICULTY, EARLY_PROMOTION_SESSIONS } = PROGRESSION_PARAMS;
    const { goodThreshold, fairThreshold } = thresholds; // Destructure AFTER validation

    // Call helper function (which also validates the thresholds object it receives)
    const potentialAdjustment = calculateDprimeBasedAdjustment(overallDprime, thresholds, adjustmentRange);

    // Initialize variables
    let newDifficulty = difficulty;
    let newConsecutiveSuccesses = consecutiveSuccesses;
    let newNBack = nBack;
    let ruleApplied = false; // Flag to track if promotion/demotion occurred
    const currentDifficultyClamped = Math.min(difficulty, MAX_DIFFICULTY_PER_LEVEL);
    // Promotion credits (Sept 2026): qualifying early-clause sessions banked at this N.
    const startingCredits = normalizePromotionCredits(promotionCredits);
    let newPromotionCredits = startingCredits;

    // --- Apply Rules ---

    // RULE 1: Promotion Check — a DISJUNCTION of two clauses.
    //   (A) EARLY: difficulty >= 0.50 AND d' >= veryGood, on the EARLY_PROMOTION_SESSIONS-th
    //       such session at this N (Sept 2026). Credits accumulate while every session stays
    //       at or above 0.50 — see the reset after the final rounding. Skippable.
    //   (B) MAX:   difficulty >= 0.99 AND d' >= good       (original rule, verbatim, single session)
    // Clause B is preserved exactly so the 0.99 speed band stays reachable and no user
    // is ever slower than before the early clause existed. 0.50 is a FLOOR, not a target:
    // someone scoring only `good` at 0.50 keeps climbing until they reach veryGood.
    const veryGoodThreshold = computeVeryGoodThreshold(thresholds);
    const earnsPromotionCredit = allowEarlyPromotion
        && veryGoodThreshold !== null
        && nBack < 20 // nothing to promote into at the cap, so nothing to bank either
        && currentDifficultyClamped >= PROMOTION_MIN_DIFFICULTY
        && overallDprime >= veryGoodThreshold;
    if (earnsPromotionCredit) newPromotionCredits = startingCredits + 1;
    const meetsEarlyPromotion = earnsPromotionCredit && newPromotionCredits >= EARLY_PROMOTION_SESSIONS;
    const meetsMaxPromotion = currentDifficultyClamped >= MAX_DIFFICULTY_PER_LEVEL
        && overallDprime >= goodThreshold;
    console.log(`Checking Promotion: nBack=${nBack}, diffClamped=${currentDifficultyClamped.toFixed(2)}, dPrime=${overallDprime.toFixed(2)}, goodThreshold=${goodThreshold.toFixed(2)}, veryGoodThreshold=${veryGoodThreshold === null ? 'n/a' : veryGoodThreshold.toFixed(2)}, credits=${startingCredits}->${newPromotionCredits}/${EARLY_PROMOTION_SESSIONS}, early=${meetsEarlyPromotion}, max=${meetsMaxPromotion}`);
    {
        // A single qualifying session (a credit OR clause B) is enough to RE-promote below
        // the user's highest achieved N. A standard promotion needs the full credit count
        // or clause B.
        if (nBack >= 1 && (earnsPromotionCredit || meetsMaxPromotion) && nBack < 20) {
            const targetNBack = nBack + 1;
            const via = meetsMaxPromotion
                ? 'MAX(d>=0.99)'
                : `EARLY(d>=${PROMOTION_MIN_DIFFICULTY}, credits ${newPromotionCredits}/${EARLY_PROMOTION_SESSIONS})`;
            const isBelowHighest = highestAchievedNBack !== undefined && highestAchievedNBack !== null && nBack < highestAchievedNBack;
            if (isBelowHighest) { // Re-promote
                newNBack = targetNBack; newDifficulty = 0.0; newConsecutiveSuccesses = 0; newPromotionCredits = 0; ruleApplied = true;
                console.log(`ProgressionLogic: RE-PROMOTION Rule Applied via ${via}: nBack ${nBack}->${newNBack}, difficulty ${currentDifficultyClamped.toFixed(2)}->0.0.`);
            } else if (meetsEarlyPromotion || meetsMaxPromotion) { // Standard promotion streak logic
                newConsecutiveSuccesses += 1;
                if (newConsecutiveSuccesses >= ADVANCEMENT_CONSECUTIVE_ROUNDS) {
                    newNBack = targetNBack; newDifficulty = 0.0; newConsecutiveSuccesses = 0; newPromotionCredits = 0; ruleApplied = true;
                    console.log(`ProgressionLogic: STANDARD PROMOTION Rule Applied via ${via}: nBack ${nBack}->${newNBack}, difficulty ${currentDifficultyClamped.toFixed(2)}->0.0.`);
                } else {
                    // Hold at the difficulty just played rather than jumping to MAX — with
                    // ADVANCEMENT_CONSECUTIVE_ROUNDS=1 this branch is unreachable, and under
                    // clause B currentDifficultyClamped IS MAX, so this is a no-op today. It
                    // only matters if the streak requirement is ever raised, where jumping an
                    // early promoter from 0.50 to 0.99 would be wrong.
                    newDifficulty = currentDifficultyClamped;
                    ruleApplied = true;
                    console.log(`ProgressionLogic: STANDARD PROMOTION Streak via ${via}: nBack ${nBack}, difficulty ${newDifficulty.toFixed(2)} maintained. Streak: ${newConsecutiveSuccesses}/${ADVANCEMENT_CONSECUTIVE_ROUNDS}`);
                }
            } else {
                // Credit banked, requirement not yet met: fall through to RULE 2 so the servo
                // climbs exactly as it would for any very-good session.
                console.log(`ProgressionLogic: Promotion credit banked (${newPromotionCredits}/${EARLY_PROMOTION_SESSIONS}) at nBack ${nBack}, difficulty ${currentDifficultyClamped.toFixed(2)}; servo adjustment applies.`);
            }
        }
    }

    // RULE 2: General Adjustment (if no promotion rule applied)
    if (!ruleApplied) {
        newDifficulty = currentDifficultyClamped + potentialAdjustment;
        console.log(`Checking Streak Reset: dPrime=${overallDprime.toFixed(2)}, goodThreshold=${goodThreshold.toFixed(2)}, potentialAdjustment=${potentialAdjustment.toFixed(2)}`); // Log comparison values
        // Reset streak if performance wasn't good or adjustment was negative
        if (overallDprime < goodThreshold || potentialAdjustment < 0) {
            if (newConsecutiveSuccesses > 0) {
                console.log(`ProgressionLogic: Resetting streak from ${newConsecutiveSuccesses} to 0.`);
                newConsecutiveSuccesses = 0;
            }
        }
        // console.log(`ProgressionLogic: General Adjustment Applied. Initial newDifficulty: ${newDifficulty.toFixed(2)}`);
    }

    // --- Final Capping and Rounding ---
    const cappedDifficulty = Math.max(0.0, Math.min(MAX_DIFFICULTY_PER_LEVEL, newDifficulty));
    const roundedNewDifficulty = Math.round(cappedDifficulty / DIFFICULTY_INCREMENT) * DIFFICULTY_INCREMENT;
    const finalNewDifficulty = Math.max(0.0, Math.min(MAX_DIFFICULTY_PER_LEVEL, roundedNewDifficulty));

    // Promotion credits survive only while the user stays at or above the Jaeggi floor:
    // a session played below it, or a servo result that lands below it, clears them.
    // No-op after a promotion (credits are already 0 there).
    if (!ruleApplied
        && (currentDifficultyClamped < PROMOTION_MIN_DIFFICULTY || finalNewDifficulty < PROMOTION_MIN_DIFFICULTY)) {
        if (newPromotionCredits > 0) console.log(`ProgressionLogic: Resetting promotion credits ${newPromotionCredits}->0 (below ${PROMOTION_MIN_DIFFICULTY}).`);
        newPromotionCredits = 0;
    }
    const finalPromotionCredits = normalizePromotionCredits(newPromotionCredits);

    // Ensure streak is a valid number
    const finalConsecutiveSuccesses = Math.max(0, Math.floor(newConsecutiveSuccesses ?? 0));

    console.log(`ProgressionLogic: Final Output: newNBack=${newNBack}, finalNewDifficulty=${finalNewDifficulty.toFixed(2)}, newConsecutiveSuccesses=${finalConsecutiveSuccesses}, newPromotionCredits=${finalPromotionCredits}`);
    return {
        newNBack,
        newDifficulty: finalNewDifficulty,
        newConsecutiveSuccesses: finalConsecutiveSuccesses,
        newPromotionCredits: finalPromotionCredits,
        earnedPromotionCredit: earnsPromotionCredit,
        difficultyAdjustment: potentialAdjustment,
    };
}

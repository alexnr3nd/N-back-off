/* src/components/game/keepClimbingLevel.js
 * Pure resolver for the "keep climbing" secondary button on the Adaptive results
 * screen (early-promotion opt-out, Aug 2026).
 *
 * When the algorithm promotes N off difficulty >= 0.50, the user is offered the
 * counterfactual: stay at the level just played and keep building difficulty
 * toward 0.99. This computes the target level for that offer, or null when the
 * offer is meaningless — which is also what suppresses the button.
 *
 * Kept separate from GameResults.js so the branch table is unit-testable; the
 * component keeps only the mode guards (classic / playground / manual / dynamic).
 */

/**
 * @param {object} args
 * @param {number} args.nBackPlayed       N-back of the session just played
 * @param {number} args.difficultyPlayed  difficulty of the session just played (0.00-0.99)
 * @param {number} args.promotedNBack     N-back the algorithm advanced to (dAlgoNBack)
 * @param {number[]|null} [args.freeTierSteps]  coarse ladder for snapped free cohorts, else null
 * @param {{nBack: number, difficulty: number}|null} [args.servoSuggestion]
 *        what the d'-driven servo would have produced had it not promoted
 * @returns {{nBack: number, difficulty: number}|null}
 */
export function resolveKeepClimbingLevel({
    nBackPlayed,
    difficultyPlayed,
    promotedNBack,
    freeTierSteps = null,
    servoSuggestion = null,
}) {
    if (typeof nBackPlayed !== 'number' || !Number.isFinite(nBackPlayed)) return null;
    if (typeof difficultyPlayed !== 'number' || !Number.isFinite(difficultyPlayed)) return null;

    // Only offered when the algorithm actually advanced the N-back level. No promotion
    // means the user is already climbing and has nothing to decline.
    if (typeof promotedNBack !== 'number' || !(promotedNBack > nBackPlayed)) return null;

    const played100 = Math.round(difficultyPlayed * 100);

    // Free-tier snapped cohorts climb a coarse ladder, not the raw servo step.
    if (Array.isArray(freeTierSteps) && freeTierSteps.length > 0) {
        const next = freeTierSteps
            .map(s => Math.round(s * 100))
            .filter(s => Number.isFinite(s))
            .sort((a, b) => a - b)
            .find(s => s > played100);
        // Already at the top of their ladder — nowhere left to climb.
        return next === undefined ? null : { nBack: nBackPlayed, difficulty: next / 100 };
    }

    if (!servoSuggestion || typeof servoSuggestion.difficulty !== 'number') return null;

    // At 0.99 the counterfactual clamps back to 0.99, which is what the Retry button
    // already offers. Suppress rather than render two buttons for the same level.
    if (Math.round(servoSuggestion.difficulty * 100) <= played100) return null;

    return { nBack: nBackPlayed, difficulty: servoSuggestion.difficulty };
}

export default resolveKeepClimbingLevel;

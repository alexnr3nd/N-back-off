/* File: src/contexts/game/dynamicChainRotation.js */
/*
 * Chain-end sub-mode rotation for Dynamic-mode continuous chains.
 *
 * Dynamic mode cycles sub-modes dual → triple → quad (→ dual at N+1). For a normal
 * single session the BACKEND decides rotation (the intercept in functions/game.js):
 * it fires when standard progression promoted N (newNBack > playedNBack) and rewrites
 * the result to "next sub-mode, same N, difficulty 0". Continuous chains suppress that
 * intercept per block (chainStillInProgress gate) and instead rotate exactly ONCE at
 * chain end, here, using the same promotion signal against the backend's own final
 * per-block save response — so client and server never disagree on what "promoted" means.
 */

import { DYNAMIC_SUB_MODE_ORDER, CLASSIC_FIXED_DIFFICULTY } from '../../constants/gameConstants';

/**
 * Decide the chain-end sub-mode rotation for a Dynamic chain.
 *
 * Promotion signal: finalNewNBack > anchorNBack. The per-block profile updates write
 * the backend's newNBack to currentNBack, so the profile's post-chain N literally IS
 * finalNewNBack — this mirrors the backend intercept's `newNBack > playedNBack` check.
 * No demotion at chain end (matches Adaptive single-session semantics; Classic
 * demotion intentionally omitted for chains).
 *
 * @param {object} params
 * @param {boolean} params.isDynamic       - chainState.isDynamic
 * @param {string}  params.currentSubMode  - chainState.currentSubMode ('dual'|'triple'|'quad')
 * @param {string}  params.trainingMode    - chainState.trainingMode ('dynamic'|'classic')
 * @param {number}  params.anchorNBack     - N the chain actually played (blocks[0].nBack)
 * @param {number}  params.finalNewNBack   - newNBack from the final per-block save response
 * @returns {null | { newSubMode: string, newNBack: number, newDifficulty: number,
 *                    newConsecutiveSuccesses: number, wrapped: boolean }}
 *          null = no rotation (not dynamic, no promotion, or missing save response).
 */
export function decideChainEndSubModeRotation({
    isDynamic,
    currentSubMode,
    trainingMode,
    anchorNBack,
    finalNewNBack,
}) {
    if (isDynamic !== true) return null;
    const subModeIndex = DYNAMIC_SUB_MODE_ORDER.indexOf(currentSubMode);
    if (subModeIndex === -1) return null;
    if (!Number.isFinite(anchorNBack) || !Number.isFinite(finalNewNBack)) return null;

    // Promotion signal — same as the backend intercept's `newNBack > playedNBack`.
    if (finalNewNBack <= anchorNBack) return null;

    const newDifficulty = trainingMode === 'classic' ? CLASSIC_FIXED_DIFFICULTY : 0.0;
    const nextSubModeIndex = subModeIndex + 1;

    if (nextSubModeIndex < DYNAMIC_SUB_MODE_ORDER.length) {
        // dual→triple / triple→quad: next sub-mode at the SAME N (undo the N-promotion).
        return {
            newSubMode: DYNAMIC_SUB_MODE_ORDER[nextSubModeIndex],
            newNBack: anchorNBack,
            newDifficulty,
            newConsecutiveSuccesses: 0,
            wrapped: false,
        };
    }

    // quad→dual wrap: keep the promoted N. The mid-chain N-cap keeps every block at
    // anchorNBack, so a promoting final block yields exactly anchorNBack + 1.
    return {
        newSubMode: DYNAMIC_SUB_MODE_ORDER[0],
        newNBack: finalNewNBack,
        newDifficulty,
        newConsecutiveSuccesses: 0,
        wrapped: true,
    };
}

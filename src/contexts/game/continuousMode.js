/* File: src/contexts/game/continuousMode.js */
/*
 * Continuous Mode chain-state management.
 *
 * A continuous-mode session is a chain of internal "blocks" played seamlessly
 * with no countdowns/results screens between them. Each block has its own N + N.DD
 * (Adaptive can adjust between blocks; Classic stays fixed). At chain end the
 * whole thing saves as ONE Firestore session document with mode: 'continuous'.
 *
 * State lives in a ref so the timer effect inside GameContext can read and
 * mutate it without re-render churn.
 */

import { generateClientSessionId } from '../../utils/offlineSaveQueue';
import {
    DPRIME_THRESHOLDS_INTERPRETATION,
    PROGRESSION_PARAMS,
    CLASSIC_FIXED_DIFFICULTY,
} from '../../constants/gameConstants';
import { determineProgression } from '../results/progressionLogic';

// Caps (also enforced server-side as defense-in-depth)
export const CONTINUOUS_MAX_BLOCKS = 50;

/**
 * Initial empty chain state.
 */
export function makeEmptyChainState() {
    return {
        isActive: false,
        chainStartedAt: null,
        clientSessionId: null,
        blocks: [],
        chainCappedReason: null,        // 'user-stop' | 'duration' | 'blocks' | null
        chainStartContext: null,        // preSession context at chain start
        pendingNextBlock: null,         // [legacy, multi-candidate path] {nBack, difficulty, sequence, params, candidates?}
        pendingCandidates: null,        // [legacy, multi-candidate path] [{nBack, difficulty, sequence, params}, ...]
        chainStartNBack: null,          // Adaptive: cap N at this value during chain
        chainStartDifficulty: null,
        // gameMode always holds a CONCRETE mode ('dual'/'triple'/'quad'/...). When the
        // user's active meta-mode is 'dynamic', the sub-mode is resolved once at chain
        // start and the whole chain plays it; isDynamic/currentSubMode record that.
        gameMode: null,
        isDynamic: false,
        currentSubMode: null,           // resolved sub-mode when isDynamic; null otherwise
        trainingMode: null,
        language: 'en',
        progressionRange: 'standard',
        lastDirection: null,            // [legacy, multi-candidate path] 'up'|'down'|'maintain'|null
        targetBlocks: null,             // user-chosen session count from pre-start modal; null = open-ended
        // --- Buffer-trial path (current) ---
        // dynamicThresholds: cached at chain start from user's most-recent saved session.
        // Used by client-side determineProgression to compute next-block level identically
        // to the server's post-chain progression. null until fetch completes; falls back to
        // static DPRIME_THRESHOLDS_INTERPRETATION when null at decision time.
        dynamicThresholds: null,        // { excellentThreshold, goodThreshold, fairThreshold } | null
        // heldPrimers: K random stimuli (no match flags) generated as part of the prior
        // session's gen request. Become the first K trials of the next session, displayed
        // at the next session's ISI/timing. priorContext for n-back lookback.
        heldPrimers: null,              // [stim, stim, stim] | null
    };
}

/**
 * Resolve the trainingMode a new chain should carry.
 *
 * 'classic' is always honored (Classic chains must stay Classic: the backend routes them
 * to classicProgression and exempts them from the daily Adaptive cap). Otherwise the
 * chain is 'dynamic' when the user's active meta-mode is Dynamic, 'adaptive' when not.
 *
 * Historical note: the caller used to discard the requested mode for non-dynamic chains,
 * falling back to `settings.trainingMode || modeProgressionData.trainingMode || 'adaptive'`
 * — neither of those keys has ever existed, so every non-dynamic chain (Classic included)
 * was tagged 'adaptive'.
 *
 * @param {{ isDynamic?: boolean, requestedTrainingMode?: string|null }} args
 * @returns {'classic'|'dynamic'|'adaptive'}
 */
export function resolveChainTrainingMode({ isDynamic, requestedTrainingMode } = {}) {
    if (requestedTrainingMode === 'classic') return 'classic';
    return isDynamic === true ? 'dynamic' : 'adaptive';
}

/**
 * Decide the level the NEXT block of a chain should be generated at.
 *
 * CLASSIC: fixed-difficulty protocol. Every block holds the chain's starting N at
 * CLASSIC_FIXED_DIFFICULTY — the level block 1 was started at. The chain is pooled
 * server-side into ONE Jaeggi session, so per-block adaptation has no place here:
 * running the d′ formula would drift the ISI mid-chain (a visible speed-up in a mode
 * that promises fixed timing), persist non-0.50 difficulty on the session docs, and
 * feed the backend Classic engine accuracy from a level the user never chose —
 * manufacturing three-strikes demotions. Classic progression is decided exactly once,
 * by the backend, from the pooled result.
 *
 * ADAPTIVE / DYNAMIC: unchanged buffer-trial behaviour — block d′ through
 * determineProgression, capped so a chain never promotes past its starting N
 * (cross-N promotion is deferred to the next normal session).
 *
 * @param {object} args
 * @param {object} args.chain              chainRef.current
 * @param {object} args.justCompletedBlock the block that just ended
 * @param {number} [args.blockDprime]      client-computed d′ for that block (ignored for Classic)
 * @param {object} [args.thresholds]       dynamic thresholds (or the static fallback)
 * @param {object} [args.adjustmentRange]
 * @returns {{ nBack: number, difficulty: number }}
 */
export function resolveNextBlockLevel({ chain, justCompletedBlock, blockDprime, thresholds, adjustmentRange }) {
    if (chain?.trainingMode === 'classic') {
        return {
            nBack: chain.chainStartNBack ?? justCompletedBlock?.nBack ?? 2,
            difficulty: CLASSIC_FIXED_DIFFICULTY,
        };
    }
    const { newNBack, newDifficulty } = determineProgression({
        overallDprime: blockDprime,
        thresholds,
        nBack: justCompletedBlock.nBack,
        difficulty: justCompletedBlock.difficulty,
        consecutiveSuccesses: 0,
        highestAchievedNBack: chain.chainStartNBack,
        adjustmentRange,
        // Block-to-block stepping only. The early-promotion clause (0.50 + veryGood)
        // would promote mid-chain, hit the chainStartNBack cap below, and slam the next
        // block's difficulty from ~0.50 straight to 0.99 — a jarring speed spike inside
        // a single sitting. Chain-END progression is decided by the backend from the
        // pooled result and DOES apply the early clause.
        allowEarlyPromotion: false,
    });
    // N-back cap within chain: never promote past chainStartNBack.
    const cappedNBack = Math.min(newNBack, chain.chainStartNBack);
    return {
        nBack: cappedNBack,
        difficulty: cappedNBack < newNBack ? PROGRESSION_PARAMS.MAX_DIFFICULTY_PER_LEVEL : newDifficulty,
    };
}

/**
 * Start a new chain. Captures the chain-start context for end-of-chain progression.
 */
export function startChain(chainRef, {
    initialNBack,
    initialDifficulty,
    initialConsecutiveSuccesses,
    highestAchievedNBack,
    highestNBackGood,
    gameMode,
    isDynamic,
    currentSubMode,
    trainingMode,
    language,
    progressionRange,
    targetBlocks,
    dynamicThresholds,
}) {
    chainRef.current = {
        ...makeEmptyChainState(),
        isActive: true,
        chainStartedAt: Date.now(),
        clientSessionId: generateClientSessionId(),
        chainStartContext: {
            originalNBack: initialNBack,
            originalDifficulty: initialDifficulty,
            originalConsecutiveSuccesses: initialConsecutiveSuccesses ?? 0,
            originalHighestAchievedNBack: highestAchievedNBack ?? initialNBack,
            originalHighestNBackGood: highestNBackGood ?? null,
        },
        chainStartNBack: initialNBack,
        chainStartDifficulty: initialDifficulty,
        gameMode,
        isDynamic: isDynamic === true,
        currentSubMode: isDynamic === true ? (currentSubMode || null) : null,
        trainingMode,
        language: language || 'en',
        progressionRange: progressionRange || 'standard',
        targetBlocks: (typeof targetBlocks === 'number' && targetBlocks >= 2 && targetBlocks <= 50)
            ? Math.floor(targetBlocks)
            : null,
        dynamicThresholds: dynamicThresholds && typeof dynamicThresholds === 'object' ? dynamicThresholds : null,
    };
    return chainRef.current;
}

/**
 * Capture a completed block's data into the chain. Called at block-end.
 *
 * @returns {object} The block snapshot just appended.
 */
export function captureBlock(chainRef, {
    nBack,
    difficulty,
    sequence,
    totalTrials,
    priorStimuli,
    calculatedISI,
    stimulusDuration,
    visualResponses,
    audioResponses,
    colorResponses,
    shapeResponses,
    startTime,
    endTime,
    replayEvents,
}) {
    const block = {
        nBack,
        difficulty,
        sequence: sequence || [],
        totalTrials: totalTrials || (sequence?.length ?? 0),
        // priorStimuli = the last N stimuli of the previous block (already shown to user;
        // passed to backend so per-block scoring can use them as n-back lookback context).
        // null/empty for the first block of a chain.
        priorStimuli: Array.isArray(priorStimuli) && priorStimuli.length > 0 ? priorStimuli : null,
        calculatedISI: calculatedISI ?? null,
        stimulusDuration: stimulusDuration ?? null,
        userVisualResponses: visualResponses || [],
        userAudioResponses: audioResponses || [],
        userColorResponses: colorResponses || [],
        userShapeResponses: shapeResponses || [],
        startTime: startTime || Date.now(),
        endTime: endTime || Date.now(),
        replayEvents: Array.isArray(replayEvents) ? replayEvents : [],
    };
    chainRef.current = {
        ...chainRef.current,
        blocks: [...chainRef.current.blocks, block],
    };
    return block;
}

/**
 * Compute simple client-side d-prime for a block, using the loglinear correction.
 * Used to pick the closest pre-fetched candidate after block end.
 *
 * Returns a single overallDprime number (avg across modalities present in gameMode).
 */
export function computeBlockDprime(sequence, responses, nBack, gameMode = 'dual') {
    if (!Array.isArray(sequence) || sequence.length === 0) return 0;
    const trials = sequence.length;

    const modalities = (() => {
        switch (gameMode) {
            case 'triple': return ['visual', 'audio', 'color'];
            case 'quad':   return ['visual', 'audio', 'color', 'shape'];
            case 'singleVisual': return ['visual'];
            case 'singleAudio':  return ['audio'];
            case 'singleColor':  return ['color'];
            case 'singleShape':  return ['shape'];
            default:             return ['visual', 'audio'];
        }
    })();

    // Map modality name → which sequence field to compare for matches
    const FIELD = { visual: 'position', audio: 'letter', color: 'color', shape: 'shape' };

    let dprimeSum = 0;
    let count = 0;
    for (const m of modalities) {
        const field = FIELD[m];
        const userResp = responses?.[m] || [];
        // Find actual matches: sequence[i][field] === sequence[i-nBack][field], for i >= nBack
        const actualMatches = new Set();
        let targetCount = 0;
        for (let i = nBack; i < trials; i++) {
            const a = sequence[i]?.[field];
            const b = sequence[i - nBack]?.[field];
            if (a != null && b != null && a === b) {
                actualMatches.add(i);
                targetCount++;
            }
        }
        const nonTargetCount = (trials - nBack) - targetCount;
        if (targetCount === 0 || nonTargetCount === 0) continue;

        const respSet = new Set(userResp);
        let hits = 0;
        let falseAlarms = 0;
        for (const idx of respSet) {
            if (actualMatches.has(idx)) hits++;
            else if (idx >= nBack && idx < trials) falseAlarms++;
        }

        // Loglinear correction (Stanislaw & Todorov 1999)
        const correctedHits = hits + 0.5;
        const correctedTC   = targetCount + 1;
        const correctedFA   = falseAlarms + 0.5;
        const correctedNTC  = nonTargetCount + 1;
        const epsilon = 1e-6;
        const hitRate = Math.max(epsilon, Math.min(1 - epsilon, correctedHits / correctedTC));
        const faRate  = Math.max(epsilon, Math.min(1 - epsilon, correctedFA / correctedNTC));

        // Inverse normal CDF approximation (Beasley-Springer-Moro is overkill;
        // for our coarse picker the simpler rational approximation is fine).
        const dprime = inverseNormalCDF(hitRate) - inverseNormalCDF(faRate);
        if (Number.isFinite(dprime)) {
            dprimeSum += dprime;
            count++;
        }
    }
    return count > 0 ? dprimeSum / count : 0;
}

/**
 * Inverse standard normal CDF — Beasley-Springer-Moro algorithm.
 * Sufficient precision for d-prime calculation.
 */
function inverseNormalCDF(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687,
                138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866,
                66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838,
               -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996,
               3.754408661907416];
    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    let q, r;
    if (p < pLow) {
        q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
               ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p <= pHigh) {
        q = p - 0.5;
        r = q * q;
        return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
               (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    }
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

/**
 * Pick the closest candidate sequence based on the actual block d-prime.
 * Strategy: d-prime → next-direction mapping using existing thresholds, with
 * late-chain conservatism (research validates: vigilance decrement + proactive
 * interference make late-block performance unreliable).
 *
 * @param {Array} candidates - Array of {nBack, difficulty, sequence, params}
 * @param {number} blockDprime - Just-completed block's d-prime
 * @param {number} currentDifficulty - Current N.DD (unused but kept for API)
 * @param {object} [options]
 * @param {number} [options.blockIndex] - 0-based index of just-completed block in chain
 * @param {number} [options.elapsedMs]  - Chain elapsed time at block end
 * @param {string} [options.lastDirection] - 'up'|'down'|'maintain' from prior boundary (for confirmation)
 * @returns {object|null} The picked candidate, or null if candidates empty.
 */
export function pickCandidateForBlock(candidates, blockDprime, currentDifficulty, options = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    const { blockIndex = 0, elapsedMs = 0, lastDirection = null } = options;
    // Late-chain: 6+ blocks completed OR 15+ min elapsed.
    // After this point, vigilance decrement biases performance downward; require stronger
    // evidence to act on a single block, especially for downward shifts.
    const isLateChain = blockIndex >= 6 || elapsedMs >= 15 * 60 * 1000;

    // Server returns candidates spanning the progression range; sort by difficulty.
    const sorted = [...candidates].sort((a, b) => a.difficulty - b.difficulty);
    const down = sorted[0];
    const maintain = sorted[Math.floor(sorted.length / 2)];
    const up = sorted[sorted.length - 1];

    if (isLateChain) {
        // Late-chain conservatism:
        // - Promote only if d' is *substantially* above threshold (EXCELLENT, not just VERY_GOOD).
        // - Demote only if d' is poor AND prior block was also a downward signal (confirmation).
        if (blockDprime >= DPRIME_THRESHOLDS_INTERPRETATION.EXCELLENT) return up;
        if (blockDprime <= DPRIME_THRESHOLDS_INTERPRETATION.POOR && lastDirection === 'down') return down;
        return maintain;
    }

    // Early chain: standard thresholds based on overall d-prime interpretation buckets.
    if (blockDprime >= DPRIME_THRESHOLDS_INTERPRETATION.VERY_GOOD) return up;
    if (blockDprime <= DPRIME_THRESHOLDS_INTERPRETATION.POOR)      return down;
    return maintain;
}

/**
 * Direction of a candidate relative to the just-completed block (for tracking lastDirection).
 */
export function classifyDirection(pickedCandidate, lastBlock) {
    if (!pickedCandidate || !lastBlock) return 'maintain';
    if (pickedCandidate.nBack > lastBlock.nBack) return 'up';
    if (pickedCandidate.nBack < lastBlock.nBack) return 'down';
    if (pickedCandidate.difficulty > lastBlock.difficulty + 0.001) return 'up';
    if (pickedCandidate.difficulty < lastBlock.difficulty - 0.001) return 'down';
    return 'maintain';
}

/**
 * Apply N-back cap (Adaptive only): if a candidate would promote past chain-start N,
 * substitute the highest-N.DD-at-chain-start-N candidate instead.
 * Keeps cross-N promotion deferred to the next normal session.
 */
export function applyNBackCap(candidate, chainStartNBack) {
    if (!candidate) return null;
    if (candidate.nBack <= chainStartNBack) return candidate;
    // Caller should request candidates only at chainStartNBack — this is a safety net.
    return null;
}

/**
 * Stage a pre-fetched single sequence (or candidates) for the next block.
 * Called by sequencePrefetcher at ~80% block completion.
 */
export function stageNextBlock(chainRef, { sequence, candidates }) {
    if (candidates) {
        chainRef.current = {
            ...chainRef.current,
            pendingCandidates: candidates,
            pendingNextBlock: null,
        };
    } else if (sequence) {
        chainRef.current = {
            ...chainRef.current,
            pendingNextBlock: sequence,
            pendingCandidates: null,
        };
    }
}

/**
 * Check whether the chain should end (caps reached).
 */
export function shouldCapChain(chainRef) {
    const state = chainRef.current;
    if (!state.isActive) return null;
    if (state.blocks.length >= CONTINUOUS_MAX_BLOCKS) return 'blocks';
    return null;
}

/**
 * Returns true when the user-chosen target session count has been reached.
 * Distinct from shouldCapChain — completion is not a cap, so the chain saves
 * with chainCappedReason: null and ContinuousResults shows no cap callout.
 */
export function shouldCompleteChain(chainRef) {
    const state = chainRef.current;
    if (!state.isActive) return false;
    if (state.targetBlocks && state.blocks.length >= state.targetBlocks) return true;
    return false;
}

/**
 * Mark chain as capped (user pressed Stop, or cap reached).
 */
export function capChain(chainRef, reason) {
    chainRef.current = {
        ...chainRef.current,
        chainCappedReason: reason,
    };
}

/**
 * Build the continuous-mode payload to send to calculateAndSaveResults.
 *
 * Top-level fields use chain aggregates (so existing readers work unchanged),
 * with `mode: 'continuous'` + `blocks: [...]` adding the chain-specific data.
 */
export function assembleContinuousPayload(chainRef, {
    activeProfile,
    settingsFromSession,
}) {
    const state = chainRef.current;
    if (!state.isActive || state.blocks.length === 0) {
        return null;
    }

    // Compute chain aggregates for top-level fields
    let totalTrials = 0;
    let maxNBack = 0;
    let nDdSumWeighted = 0;
    let earliestStart = Infinity;
    let latestEnd = -Infinity;
    for (const b of state.blocks) {
        totalTrials += b.sequence.length;
        maxNBack = Math.max(maxNBack, b.nBack);
        nDdSumWeighted += (b.nBack + b.difficulty) * b.sequence.length;
        if (b.startTime < earliestStart) earliestStart = b.startTime;
        if (b.endTime > latestEnd) latestEnd = b.endTime;
    }
    const nDdAverage = totalTrials > 0 ? nDdSumWeighted / totalTrials : 0;
    const finalBlock = state.blocks[state.blocks.length - 1];

    // Aggregate replay events across blocks (offset timestamps if needed; for v1 just concat)
    const aggregatedReplayEvents = [];
    for (const b of state.blocks) {
        for (const ev of b.replayEvents) aggregatedReplayEvents.push(ev);
    }

    // Build sessionData: includes both top-level aggregates AND the blocks array.
    // Validation requires top-level nBack/difficulty/sequence; we populate from final block + aggregates.
    const sessionData = {
        // Mode flag — the new bit
        mode: 'continuous',
        // Per-block raw data for backend per-block calculation
        blocks: state.blocks.map(b => ({
            nBack: b.nBack,
            difficulty: b.difficulty,
            sequence: b.sequence,
            totalTrials: b.totalTrials,
            // priorStimuli is included so backend can build the lookback context for n-back
            // continuity scoring across block boundaries. Omitted for first block (no prior).
            ...(b.priorStimuli && b.priorStimuli.length > 0 && { priorStimuli: b.priorStimuli }),
            calculatedISI: b.calculatedISI,
            stimulusDuration: b.stimulusDuration,
            userVisualResponses: b.userVisualResponses,
            userAudioResponses: b.userAudioResponses,
            userColorResponses: b.userColorResponses,
            userShapeResponses: b.userShapeResponses,
            startTime: b.startTime,
            endTime: b.endTime,
        })),
        chainCappedReason: state.chainCappedReason || 'user-stop',
        // --- Top-level fields for backward compat ---
        nBack: maxNBack,                                    // for highestNBack tracking + display
        difficulty: Math.max(0, Math.min(0.99, nDdAverage - Math.floor(nDdAverage))), // fractional part of avg
        calculatedISI: finalBlock.calculatedISI ?? settingsFromSession?.calculatedISI ?? 0,
        stimulusDuration: finalBlock.stimulusDuration ?? settingsFromSession?.stimulusDuration ?? 0,
        baseVariabilityOffsetMs: settingsFromSession?.baseVariabilityOffsetMs ?? 0,
        maxRandomVariabilityOffsetMs: settingsFromSession?.maxRandomVariabilityOffsetMs ?? 0,
        totalTrialsPlanned: totalTrials,
        trialsCompleted: totalTrials,
        totalTrials: totalTrials,
        isPlayground: false,
        isPartialResult: false,
        showReport: true,
        saveToProfile: true,
        // Use final block's sequence as top-level (used by free-tier snapping etc.)
        sequence: finalBlock.sequence,
        gameMode: state.gameMode,
        ...(state.trainingMode && { trainingMode: state.trainingMode }),
        // Dynamic chains: currentSubMode routes backend progression to the 'dynamic'
        // bucket. Per-block sub-mode rotation is suppressed server-side for chains
        // (chainStillInProgress gate) — rotation is decided once at chain end.
        ...(state.isDynamic && state.currentSubMode && { currentSubMode: state.currentSubMode }),
        preSessionProfileContext: state.chainStartContext,
    };

    // Top-level user responses use the final block's responses (existing readers expect these).
    return {
        sessionData,
        userVisualResponses: finalBlock.userVisualResponses || [],
        userAudioResponses: finalBlock.userAudioResponses || [],
        userColorResponses: finalBlock.userColorResponses || [],
        userShapeResponses: finalBlock.userShapeResponses || [],
        responseTimes: { visual: [], audio: [], color: [], shape: [] }, // chain-level RT not used in v1
        replayData: {
            version: 1,
            startTime: earliestStart === Infinity ? Date.now() : earliestStart,
            settings: {
                nBack: maxNBack,
                difficulty: nDdAverage - Math.floor(nDdAverage),
                calculatedISI: finalBlock.calculatedISI,
                stimulusDuration: finalBlock.stimulusDuration,
                totalTrials,
                isPlayground: false,
                gameMode: state.gameMode,
            },
            events: aggregatedReplayEvents,
        },
        timing: {
            startTime: earliestStart === Infinity ? Date.now() : earliestStart,
            endTime: latestEnd === -Infinity ? Date.now() : latestEnd,
        },
        clientSessionId: state.clientSessionId,
        profileId: activeProfile?.id || null,
    };
}

/**
 * Build a 1-block payload for incremental per-block saves during a continuous chain.
 * Sent to the same `calculateAndSaveResults` Cloud Function as `assembleContinuousPayload`,
 * but the backend reads the top-level chain context fields (`chainId`, `chainPosition`,
 * `chainStartedAt`) so each per-block doc records the correct chain coordinates.
 *
 * Each block carries its own `clientSessionId = ${chainId}:block:${blockIndex}` for
 * idempotent retry via the existing offline queue.
 *
 * @param {object} block — entry from `chainState.blocks` (already captured)
 * @param {object} chainState — chainRef.current at save time
 * @param {number} blockIndex — 0-indexed position of this block in the chain
 * @param {object} settingsFromSession — sessionSettingsRef.current from GameContext (for variability params)
 * @returns {object} payload ready for calculateAndSaveResultsCall, or null if input invalid
 */
export function assembleSingleBlockPayload(block, chainState, blockIndex, settingsFromSession) {
    if (!block || !chainState || !chainState.isActive) return null;
    const chainId = chainState.clientSessionId;
    if (!chainId) return null;

    const chainPosition = blockIndex + 1;
    const blockClientSessionId = `${chainId}:block:${blockIndex}`;
    const blockStart = block.startTime || Date.now();
    const blockEnd = block.endTime || blockStart;

    const sessionData = {
        // Continuous mode flag — same as batch path (ensures the backend's chain handler runs).
        mode: 'continuous',
        // 1-block array for the chain handler. Backend will write exactly 1 session doc.
        blocks: [{
            nBack: block.nBack,
            difficulty: block.difficulty,
            sequence: block.sequence,
            totalTrials: block.totalTrials,
            ...(block.priorStimuli && block.priorStimuli.length > 0 && { priorStimuli: block.priorStimuli }),
            calculatedISI: block.calculatedISI,
            stimulusDuration: block.stimulusDuration,
            userVisualResponses: block.userVisualResponses,
            userAudioResponses: block.userAudioResponses,
            userColorResponses: block.userColorResponses,
            userShapeResponses: block.userShapeResponses,
            startTime: blockStart,
            endTime: blockEnd,
        }],
        // Top-level chain context — backend reads these (additive over batch payload).
        // chainStillInProgress signals "more blocks may follow" — backend doesn't finalize the chain.
        chainStillInProgress: true,
        chainId,
        chainPosition,
        chainStartedAt: chainState.chainStartedAt || blockStart,
        chainTotalBlocks: null,         // unknown until chain ends; doc stores null
        // chainCappedReason: only present if the chain was already capped before this save
        // (e.g., the final partial-block save fired by stopAndSaveContinuousChain). Mid-chain
        // saves leave it absent so each per-block doc reflects the in-progress state at write time.
        ...(chainState.chainCappedReason && { chainCappedReason: chainState.chainCappedReason }),
        // --- Top-level fields required by validation (use this block's values) ---
        nBack: block.nBack,
        difficulty: Math.max(0, Math.min(0.99, block.difficulty)),
        calculatedISI: block.calculatedISI ?? settingsFromSession?.calculatedISI ?? 0,
        stimulusDuration: block.stimulusDuration ?? settingsFromSession?.stimulusDuration ?? 0,
        baseVariabilityOffsetMs: settingsFromSession?.baseVariabilityOffsetMs ?? 0,
        maxRandomVariabilityOffsetMs: settingsFromSession?.maxRandomVariabilityOffsetMs ?? 0,
        totalTrialsPlanned: block.totalTrials,
        trialsCompleted: block.totalTrials,
        totalTrials: block.totalTrials,
        isPlayground: false,
        isPartialResult: false,
        showReport: true,
        saveToProfile: true,
        sequence: block.sequence,
        gameMode: chainState.gameMode,
        ...(chainState.trainingMode && { trainingMode: chainState.trainingMode }),
        // Dynamic chains: currentSubMode routes backend progression to the 'dynamic'
        // bucket. The backend intercept skips rotation when chainStillInProgress is set,
        // so sub-mode rotation happens exactly once — at chain end, client-side.
        ...(chainState.isDynamic && chainState.currentSubMode && { currentSubMode: chainState.currentSubMode }),
        preSessionProfileContext: chainState.chainStartContext,
    };

    return {
        sessionData,
        userVisualResponses: block.userVisualResponses || [],
        userAudioResponses: block.userAudioResponses || [],
        userColorResponses: block.userColorResponses || [],
        userShapeResponses: block.userShapeResponses || [],
        responseTimes: { visual: [], audio: [], color: [], shape: [] },
        replayData: {
            version: 1,
            startTime: blockStart,
            settings: {
                nBack: block.nBack,
                difficulty: block.difficulty,
                calculatedISI: block.calculatedISI,
                stimulusDuration: block.stimulusDuration,
                totalTrials: block.totalTrials,
                isPlayground: false,
                gameMode: chainState.gameMode,
            },
            events: Array.isArray(block.replayEvents) ? block.replayEvents : [],
        },
        timing: {
            startTime: blockStart,
            endTime: blockEnd,
        },
        clientSessionId: blockClientSessionId,
        profileId: null,
    };
}

/**
 * Reset chain state (called after save).
 */
export function resetChain(chainRef) {
    chainRef.current = makeEmptyChainState();
}

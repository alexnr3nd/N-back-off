/* src/utils/sessionRecovery.js */

/**
 * Maps a Firestore session document to the gameResults shape
 * expected by the GameResults component. Handles field name
 * differences between what the backend stores vs. what it returns
 * to the frontend in the HTTP response.
 */
export function mapSessionDocToGameResults(docId, data) {
    return {
        sessionId: docId,
        nBack: data.nBack,
        difficulty: data.difficulty,
        newNBack: data.newNBack,
        newDifficulty: data.newDifficulty,
        gameMode: data.gameMode || 'dual',
        durationMs: data.durationMs,
        // Accuracy — Firestore stores `accuracy`, frontend expects `overallAccuracy`
        overallAccuracy: data.accuracy,
        visualAccuracy: data.visualAccuracy,
        audioAccuracy: data.audioAccuracy,
        colorAccuracy: data.colorAccuracy ?? null,
        shapeAccuracy: data.shapeAccuracy ?? null,
        // D-prime
        overallDprime: data.overallDprime,
        visualDprime: data.visualDprime,
        audioDprime: data.audioDprime,
        colorDprime: data.colorDprime ?? null,
        shapeDprime: data.shapeDprime ?? null,
        // Counts
        visualCorrect: data.visualCorrect,
        visualTargetCount: data.visualTargetCount,
        visualFalseAlarms: data.visualFalseAlarms,
        audioCorrect: data.audioCorrect,
        audioTargetCount: data.audioTargetCount,
        audioFalseAlarms: data.audioFalseAlarms,
        colorCorrect: data.colorCorrect ?? null,
        colorTargetCount: data.colorTargetCount ?? null,
        colorFalseAlarms: data.colorFalseAlarms ?? null,
        shapeCorrect: data.shapeCorrect ?? null,
        shapeTargetCount: data.shapeTargetCount ?? null,
        shapeFalseAlarms: data.shapeFalseAlarms ?? null,
        // Thresholds
        excellentThreshold: data.excellentThreshold,
        goodThreshold: data.goodThreshold,
        fairThreshold: data.fairThreshold,
        // Replay & sequence
        replayData: data.replayData ?? null,
        sequence: data.sequence ?? [],
        // Trial info — Firestore stores `completedEarly`, frontend expects `isPartialResult`
        trialsCompleted: data.trialsCompleted ?? 0,
        totalTrialsPlanned: data.totalTrialsPlanned ?? 0,
        isPartialResult: data.completedEarly ?? false,
        isPlayground: data.isPlayground ?? false,
        showReport: true,
        // Session params (nested in Firestore)
        calculatedISI: data.sessionParameters?.calculatedISI ?? null,
        stimulusDuration: data.sessionParameters?.stimulusDuration ?? null,
        // Progression — Firestore stores `consecutiveSuccesses`, frontend expects `newConsecutiveSuccesses`
        newConsecutiveSuccesses: data.consecutiveSuccesses ?? 0,
        // Sept 2026 — Firestore stores `promotionCredits`, frontend expects `newPromotionCredits`.
        // `promotionCreditsRequired` is not on the doc; the results card hides without it.
        newPromotionCredits: data.promotionCredits ?? 0,
        // Classic/Adaptive mode
        trainingMode: data.trainingMode || null,
        levelChange: data.levelChange || null,
        // Fields unavailable from Firestore (graceful nulls)
        unsnappedNewDifficulty: null,
        todaySessionCount: null,
        todayTotalDurationMs: null,
        readinessScore: null,
        adjustmentRangeKey: data.adjustmentRangeKey ?? null,
    };
}

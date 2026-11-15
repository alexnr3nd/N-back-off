/* src/utils/assessmentEligibility.js */
// Client-side mirror of the assessment eligibility logic so summary pages
// render instantly instead of waiting on a Cloud Function:
//   computeAssessmentEligibility ↔ checkEligibility (functions/cstUtils.js:217-421)
//   computeReasoningCheckStatus  ↔ checkReasoningCheckEligibility (functions/icar.js:44-88)
// Results are ADVISORY ONLY — the server re-checks at structure fetch and
// submit; those checks remain the source of truth.
//
// LOCKSTEP — UTC ON PURPOSE: the server reads its timezone from
// users/{uid}/settings/app, which nothing in production writes (the client
// writes profiles/{uid}/profileSettings/settings), so server eligibility math
// effectively always runs in UTC. This mirror must compute in UTC too — NOT
// settings.timezone and NOT the browser zone — or it will disagree with
// server enforcement near day-30 boundaries. If the server timezone
// resolution is ever fixed, change this file in the same deploy.
// TODO(next backend release): add the matching lockstep comment at functions/cstUtils.js:283.

import { formatInTimeZone } from 'date-fns-tz';

const MS_PER_DAY = 86_400_000;
const COOLDOWN_DAYS = 30;                  // mirrors the literal at cstUtils.js:395
const REQUIRED_FAMILIARIZATION_COUNT = 1;  // mirrors FAMILIARIZATION_COUNTS (all types = 1)
const SUGGESTED_REASONING_INTERVAL_DAYS = 365; // mirrors icar.js:29

// cstHistory timestamps arrive as ISO strings via getUserDataOnLogin;
// tolerate Firestore-Timestamp-like objects defensively (same pattern as
// src/utils/assessmentCalibration.js).
const entryTimeMs = (entry) => {
    const ts = entry?.timestamp;
    if (!ts) return null;
    try {
        const date = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
        const ms = date.getTime();
        return Number.isFinite(ms) ? ms : null;
    } catch (e) {
        return null;
    }
};

/**
 * Returns the same shape as the checkXEligibility callables:
 * { isEligible, daysSinceLastAssessment, nextAvailableDateString,
 *   lastAssessmentDate (Date|null), familiarizationComplete, familiarizationCount }
 *
 * Strict-equality semantics are load-bearing (legacy data):
 * - h.testType === testType — legacy entries with NO testType match nothing
 * - familiarizationSession === true counts toward familiarization
 * - familiarizationSession === false (strictly) anchors the cooldown;
 *   entries missing the field count toward neither
 * - daysSinceLastAssessment is null in every eligible-early branch
 * - day math is full elapsed UTC days (floor(ms/86400000)) — identical to the
 *   server's differenceInDays(toZonedTime(now,'UTC'), toZonedTime(last,'UTC'))
 */
export function computeAssessmentEligibility(cstHistory, testType, now = new Date()) {
    const history = Array.isArray(cstHistory)
        ? cstHistory.filter((h) => h?.testType === testType)
        : [];

    const familiarizationCount = history.filter((h) => h?.familiarizationSession === true).length;

    if (familiarizationCount < REQUIRED_FAMILIARIZATION_COUNT) {
        return {
            isEligible: true,
            daysSinceLastAssessment: null,
            nextAvailableDateString: null,
            lastAssessmentDate: null,
            familiarizationComplete: false,
            familiarizationCount,
        };
    }

    let lastMs = null;
    for (const entry of history) {
        if (entry?.familiarizationSession !== false) continue;
        const ms = entryTimeMs(entry);
        if (ms !== null && (lastMs === null || ms > lastMs)) lastMs = ms;
    }

    if (lastMs === null) {
        return {
            isEligible: true,
            daysSinceLastAssessment: null,
            nextAvailableDateString: null,
            lastAssessmentDate: null,
            familiarizationComplete: true,
            familiarizationCount,
        };
    }

    // Clamped at 0: server-side both clocks are Google's, so a negative value
    // is impossible there; client clock skew could otherwise render "-1 days".
    // Display-only — any clamped value is < 30, so the verdict never diverges.
    const daysSinceLastAssessment = Math.max(0, Math.floor((now.getTime() - lastMs) / MS_PER_DAY));
    const isEligible = daysSinceLastAssessment >= COOLDOWN_DAYS;

    let nextAvailableDateString = null;
    if (!isEligible) {
        try {
            nextAvailableDateString = formatInTimeZone(
                new Date(lastMs + COOLDOWN_DAYS * MS_PER_DAY), 'UTC', 'MMMM d, yyyy'
            );
        } catch (e) {
            nextAvailableDateString = 'Error calculating date'; // mirrors cstUtils.js:406
        }
    }

    return {
        isEligible,
        daysSinceLastAssessment,
        nextAvailableDateString,
        lastAssessmentDate: new Date(lastMs),
        familiarizationComplete: true,
        familiarizationCount,
    };
}

/**
 * ICAR / Reasoning Check — entirely different semantics (advisory 365-day
 * cadence, no familiarization, no enforcement anywhere). The server fields
 * (lastReasoningCheckTimestamp, reasoningCheckAttemptCount) are not projected
 * to the client, but icar.js:201-205 writes them atomically with the history
 * arrayUnion, so history length + max timestamp are equivalent. Server day
 * math is Math.floor((now-last)/86400000) — UTC, no timezone (icar.js:66).
 */
export function computeReasoningCheckStatus(reasoningCheckHistory, now = new Date()) {
    const history = Array.isArray(reasoningCheckHistory) ? reasoningCheckHistory : [];
    let lastMs = null;
    let attemptCount = 0;
    for (const entry of history) {
        const ms = entryTimeMs(entry);
        if (ms === null) continue;
        attemptCount += 1;
        if (lastMs === null || ms > lastMs) lastMs = ms;
    }

    if (lastMs === null) {
        return { daysSinceLastAttempt: null, suggestedNextDate: null, lastAttemptDate: null, attemptCount: 0 };
    }

    return {
        daysSinceLastAttempt: Math.max(0, Math.floor((now.getTime() - lastMs) / MS_PER_DAY)), // clamp: display-only skew guard
        suggestedNextDate: new Date(lastMs + SUGGESTED_REASONING_INTERVAL_DAYS * MS_PER_DAY),
        lastAttemptDate: new Date(lastMs),
        attemptCount,
    };
}

// Finds the personal response deadline calibrated in the user's most recent
// session of an assessment (every OSpan/SymSpan cstHistory entry stores one,
// familiarization included). Used when the user skips the in-task practice,
// whose calibration block would otherwise compute a fresh deadline.

const entryTimeMs = (entry) => {
    const ts = entry?.timestamp;
    if (!ts) return null;
    // cstHistory timestamps arrive as ISO strings via getUserDataOnLogin;
    // tolerate Firestore Timestamp-like objects defensively.
    const date = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
    const ms = date.getTime();
    return Number.isFinite(ms) ? ms : null;
};

export function getLastCalibrationDeadline(cstHistory, testType, deadlineField) {
    if (!Array.isArray(cstHistory)) return null;
    let best = null;
    let bestTime = -Infinity;
    for (const entry of cstHistory) {
        if (entry?.testType !== testType) continue;
        const deadline = entry?.[deadlineField];
        if (typeof deadline !== 'number' || deadline <= 0) continue;
        const t = entryTimeMs(entry);
        if (t !== null && t > bestTime) {
            bestTime = t;
            best = deadline;
        }
    }
    return best;
}

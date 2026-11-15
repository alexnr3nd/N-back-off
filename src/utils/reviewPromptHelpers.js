export const REVIEW_PROMPT_COOLDOWN_DAYS = 60;
export const REVIEW_PROMPT_MIN_SESSIONS = 15;
const STORAGE_KEY = 'reviewPrompt_lastShown';

export function getLastPromptDate() {
    try {
        const val = localStorage.getItem(STORAGE_KEY);
        return val ? new Date(val) : null;
    } catch {
        return null;
    }
}

export function setLastPromptDate() {
    try {
        localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch { /* localStorage full or unavailable */ }
}

export function checkReviewEligibility({ levelChange, newNBack, nBackPlayed, isNewHighestNBackGood, performanceCategory }, totalSessions) {
    if (totalSessions < REVIEW_PROMPT_MIN_SESSIONS) {
        return { eligible: false, reason: `only ${totalSessions} sessions (need ${REVIEW_PROMPT_MIN_SESSIONS})` };
    }

    const triggers = [];
    if (levelChange === 'up') triggers.push('level_up');
    if (newNBack > nBackPlayed) triggers.push('level_up');
    if (isNewHighestNBackGood) triggers.push('personal_best');
    if (performanceCategory === 'excellent' || performanceCategory === 'very-good') triggers.push('excellent_session');

    if (triggers.length === 0) {
        return { eligible: false, reason: 'no positive trigger' };
    }

    const lastPrompt = getLastPromptDate();
    if (lastPrompt) {
        const daysSince = (Date.now() - lastPrompt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < REVIEW_PROMPT_COOLDOWN_DAYS) {
            return { eligible: false, reason: `cooldown (${Math.round(daysSince)}d / ${REVIEW_PROMPT_COOLDOWN_DAYS}d)` };
        }
    }

    const triggerType = triggers.includes('personal_best') ? 'personal_best'
        : triggers.includes('level_up') ? 'level_up'
        : 'excellent_session';

    return { eligible: true, reason: 'all checks passed', triggerType };
}

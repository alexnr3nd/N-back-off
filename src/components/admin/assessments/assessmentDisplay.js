/* src/components/admin/assessments/assessmentDisplay.js */

/**
 * Display helpers for admin assessment rows.
 * The backend (adminAssessmentUtils.js) computes testLabel / scoreDisplay /
 * secondaryDisplay / flagged for every assessment type; these helpers only
 * add graceful fallbacks for responses from an older backend (CST-shaped
 * entries without the unified fields).
 */

export const getAssessmentLabel = (a) => a.testLabel || a.testType || 'Unknown';

export const getAssessmentScoreDisplay = (a) => {
    if (a.scoreDisplay) return a.scoreDisplay;
    if (a.scorePCU != null) return `${a.scorePCU}/${a.maxPCU || 75} PCU`;
    return null;
};

export const getAssessmentSecondaryDisplay = (a) => {
    if (a.secondaryDisplay) return a.secondaryDisplay;
    if (!a.scoreDisplay && a.processingAccuracy != null) return `Proc ${Math.round(a.processingAccuracy)}%`;
    return null;
};

export const isAssessmentFlagged = (a) =>
    a.flagged !== undefined ? a.flagged === true : a.flaggedLowAccuracy === true;

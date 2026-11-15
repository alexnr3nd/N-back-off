import { CST_TEST_TYPES } from '../constants/cstConstants';

/**
 * Grandfathered assessment access ends on this date. After it, only paid Pro
 * keeps the Pro-gated assessments; everyone keeps the free ones, and past
 * results stay viewable. Aligned with the adaptive-cap expiry (Oct 9 2026).
 * KEEP IN SYNC with ASSESSMENT_GRANDFATHER_EXPIRY in functions/cstUtils.js.
 */
export const ASSESSMENT_GRANDFATHER_EXPIRY = new Date('2026-10-09T00:00:00Z');

/**
 * Whether the user can access the Pro-gated assessments (Counting Span,
 * Digit Span, Symmetry Span, Visual Arrays, Antisaccade, Relation Monitoring,
 * Letter & Number Comparison).
 *
 * Operation Span is free for all users (June 2026), so OPERATION_SPAN entries
 * in cstHistory no longer imply pre-paywall (grandfathered) access. Entries of
 * any other testType — or legacy Counting Span entries with no testType —
 * could only have been written while the user had premium/grandfathered
 * access. After ASSESSMENT_GRANDFATHER_EXPIRY the grandfather path is closed,
 * so only paid premium retains access. Mirrors hasGrandfatheredAssessmentAccess
 * in functions/cstUtils.js.
 */
export const canAccessProAssessments = (userData, subscriptionTier) => {
    if (subscriptionTier === 'premium') return true;
    if (Date.now() >= ASSESSMENT_GRANDFATHER_EXPIRY.getTime()) return false;
    return userData?.assessmentGrandfathered === true ||
        (Array.isArray(userData?.cstHistory) &&
         userData.cstHistory.some(h => h?.testType !== CST_TEST_TYPES.OPERATION_SPAN));
};

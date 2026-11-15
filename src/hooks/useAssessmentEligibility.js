/* src/hooks/useAssessmentEligibility.js */
// Instant, client-computed replacement for the page-load checkXEligibility
// Cloud Function calls on assessment summary pages. Advisory only — the
// server re-checks at structure fetch and submit.
import { useMemo } from 'react';
import { useUser } from '../contexts/UserContext';
import { computeAssessmentEligibility } from '../utils/assessmentEligibility';

// extraEntries: locally-known history entries not yet in userData.cstHistory
// (a pending-results recovery submit that just succeeded). Must be a
// state-held array (stable identity) or null.
export function useAssessmentEligibility(testType, extraEntries = null) {
    const { userData } = useUser();
    return useMemo(() => {
        const base = Array.isArray(userData?.cstHistory) ? userData.cstHistory : [];
        const combined = extraEntries?.length ? [...base, ...extraEntries] : base;
        // isLoading/error are kept (always settled) so existing consumers —
        // isEarlyRetake, handleStartClick guards — work unchanged.
        return { ...computeAssessmentEligibility(combined, testType), isLoading: false, error: null };
    }, [userData?.cstHistory, testType, extraEntries]);
}

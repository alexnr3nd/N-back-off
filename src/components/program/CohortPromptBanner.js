/* src/components/program/CohortPromptBanner.js */

/**
 * Engagement-triggered opt-in banner for the cohort program.
 * Shows at top of dashboard when user hits specific milestones.
 * Dismissible, re-shows after 30 days.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faTimes, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import { useCohort } from '../../contexts/CohortContext';
import { useUser } from '../../contexts/UserContext';

const DISMISS_RESHOW_DAYS = 30;
const DISMISS_STORAGE_KEY = 'cohortPromptDismissedAt';

const CohortPromptBanner = () => {
    const { activeCohortId } = useCohort();
    const { userId, userData, activeSessions } = useUser();
    const navigate = useNavigate();
    const [isDismissed, setIsDismissed] = useState(false);

    // Should we show the banner?
    const shouldShow = useMemo(() => {
        // Don't show if already in a cohort
        if (activeCohortId) return false;

        // Don't show for returning users who previously joined a cohort
        if (userData?.lastLeftCohortId || userData?.cohortHistory?.length > 0) return false;

        // Don't show if locally dismissed this session
        if (isDismissed) return false;

        // Check if dismissed recently (within 30 days) via localStorage
        try {
            const dismissedAt = localStorage.getItem(DISMISS_STORAGE_KEY);
            if (dismissedAt) {
                const daysSinceDismiss = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
                if (daysSinceDismiss < DISMISS_RESHOW_DAYS) return false;
            }
        } catch { /* localStorage unavailable */ }

        // Don't show until user has completed enough sessions to understand the core game
        const MIN_SESSIONS_FOR_PROMPT = 20;
        if ((activeSessions?.length ?? 0) < MIN_SESSIONS_FOR_PROMPT) return false;

        // Don't show until account is at least 3 days old (gives users time to settle in)
        const MIN_DAYS_SINCE_SIGNUP = 3;
        const createdAt = userData?.createdAt;
        if (createdAt) {
            const createdMs = new Date(createdAt).getTime();
            if (Number.isFinite(createdMs)) {
                const daysSinceSignup = (Date.now() - createdMs) / (1000 * 60 * 60 * 24);
                if (daysSinceSignup < MIN_DAYS_SINCE_SIGNUP) return false;
            }
        }

        return true;
    }, [activeCohortId, isDismissed, userData?.lastLeftCohortId, userData?.cohortHistory, userData?.createdAt, activeSessions]);

    const handleDismiss = useCallback(() => {
        setIsDismissed(true);
        try {
            localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
        } catch { /* localStorage unavailable */ }
    }, []);

    if (!shouldShow) return null;

    return (
        <div className="border border-theme-accent/20 bg-theme-accent/5 p-3 sm:p-4 mb-6 sm:mb-8 flex items-center gap-3">
            <FontAwesomeIcon icon={faUsers} className="h-4 w-4 text-theme-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-sm text-theme-text">
                    Build a daily training habit. Join a 28-day program with a small cohort.
                </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <button
                    onClick={() => navigate('/program')}
                    className="text-xs font-medium text-theme-accent hover:text-theme-accent/80 transition-colors inline-flex items-center gap-1"
                >
                    Learn More
                    <FontAwesomeIcon icon={faArrowRight} className="h-2.5 w-2.5" />
                </button>
                <button
                    onClick={handleDismiss}
                    className="text-theme-text-muted/50 hover:text-theme-text-muted p-1 transition-colors"
                    aria-label="Dismiss"
                >
                    <FontAwesomeIcon icon={faTimes} className="h-3 w-3" />
                </button>
            </div>
        </div>
    );
};

export default CohortPromptBanner;

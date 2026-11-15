/* src/components/program/CohortDashboardCard.js */

/**
 * Compact cohort card for the main dashboard (ProfileDashboard.js).
 * Three states: not enrolled, enrolled, post-program.
 */

import React, { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faArrowRight, faBolt, faBed, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import { useCohort } from '../../contexts/CohortContext';

const CohortDashboardCard = () => {
    const {
        activeCohortId, activeCohort, programDay,
        isTodayRestDay, todaysSessionTarget, todaysSessionsCompleted,
        cohortMembers, myMemberData, isLoading
    } = useCohort();
    const navigate = useNavigate();

    const activeMembers = useMemo(() =>
        cohortMembers.filter(m => m.status === 'active').length,
    [cohortMembers]);

    const membersTrainedToday = useMemo(() => {
        if (!cohortMembers.length || programDay < 1) return 0;
        const dayKey = String(programDay);
        return cohortMembers.filter(m =>
            m.status === 'active' && m.dailyProgress?.[dayKey]?.sessionsPlayed > 0
        ).length;
    }, [cohortMembers, programDay]);

    const isDayComplete = todaysSessionsCompleted >= todaysSessionTarget && todaysSessionTarget > 0;

    if (isLoading) return null;

    // Not enrolled — don't show card; the CohortPromptBanner handles discovery
    if (!activeCohortId) return null;

    // Completed
    if (activeCohort?.status === 'completed' || activeCohort?.status === 'archived') {
        return (
            <button
                onClick={() => navigate('/program')}
                className="w-full border border-green-500/20 bg-green-500/5 p-3 sm:p-4 transition-colors text-left group hover:border-green-500/30"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <FontAwesomeIcon icon={faCheckCircle} className="h-4 w-4 text-green-500/70" />
                        <div>
                            <p className="text-sm font-medium text-theme-text">Program complete!</p>
                            <p className="text-xs text-theme-text-muted">
                                {myMemberData?.daysCompleted || 0} days completed — Join your next cohort
                            </p>
                        </div>
                    </div>
                    <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3 text-theme-text-muted group-hover:text-theme-accent transition-colors" />
                </div>
            </button>
        );
    }

    // Forming
    if (activeCohort?.status === 'forming') {
        return (
            <button
                onClick={() => navigate('/program')}
                className="w-full border border-theme-accent/20 bg-theme-accent/10 p-3 sm:p-4 transition-colors text-left group hover:border-theme-accent/30"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <FontAwesomeIcon icon={faUsers} className="h-4 w-4 text-theme-accent" />
                        <div>
                            <p className="text-sm font-medium text-theme-text">Cohort forming</p>
                            <p className="text-xs text-theme-text-muted">
                                {activeMembers} enrolled — starts {formatDate(activeCohort.startDate)}
                            </p>
                        </div>
                    </div>
                    <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3 text-theme-text-muted group-hover:text-theme-accent transition-colors" />
                </div>
            </button>
        );
    }

    // Active — show today's status
    return (
        <button
            onClick={() => navigate('/program')}
            className="w-full border border-theme-accent/20 bg-theme-accent/10 p-3 sm:p-4 transition-colors text-left group hover:border-theme-accent/30"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                    <FontAwesomeIcon
                        icon={isTodayRestDay ? faBed : isDayComplete ? faCheckCircle : faBolt}
                        className={`h-4 w-4 flex-shrink-0 ${
                            isTodayRestDay ? 'text-theme-text-muted' : isDayComplete ? 'text-green-500' : 'text-theme-accent'
                        }`}
                    />
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-theme-text">
                            Day {programDay} of 28
                            {!isTodayRestDay && ` — ${todaysSessionsCompleted}/${todaysSessionTarget} sessions`}
                            {isTodayRestDay && ' — Rest day'}
                        </p>
                        <p className="text-xs text-theme-text-muted truncate">
                            {membersTrainedToday} of {activeMembers} trained today
                        </p>
                    </div>
                </div>
                <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3 text-theme-text-muted group-hover:text-theme-accent transition-colors flex-shrink-0" />
            </div>
        </button>
    );
};

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T13:00:00Z');
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default CohortDashboardCard;

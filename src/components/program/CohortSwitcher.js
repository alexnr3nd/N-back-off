/* src/components/program/CohortSwitcher.js */

/**
 * Admin-only cohort switcher — dropdown to jump between cohorts.
 * Shows all cohorts admin belongs to, grouped by status.
 * Uses cached cohort list from CohortContext for instant rendering.
 */

import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faSpinner, faUsers, faCheck, faCircle, faStar } from '@fortawesome/free-solid-svg-icons';
import { useCohort } from '../../contexts/CohortContext';

const CohortSwitcher = () => {
    const { activeCohortId, joinedCohortId, adminSwitchCohort, myCohorts, myCohortsLoading, refreshMyCohorts } = useCohort();

    const [isOpen, setIsOpen] = useState(false);
    const [showPast, setShowPast] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen]);

    const handleToggle = () => {
        const opening = !isOpen;
        setIsOpen(opening);
        if (opening) refreshMyCohorts(); // Background refresh for fresh unread state
    };

    const handleSwitch = (cohortId) => {
        if (cohortId === activeCohortId) return;
        adminSwitchCohort(cohortId); // Instant — optimistic update
        setIsOpen(false);
    };

    const activeCohorts = myCohorts.filter(c => c.status === 'active' || c.status === 'forming');
    const pastCohorts = myCohorts.filter(c => c.status === 'completed' || c.status === 'archived');
    const currentCohort = myCohorts.find(c => c.id === activeCohortId);
    const hasAnyUnread = myCohorts.some(c => c.id !== activeCohortId && c.hasUnread);

    if (myCohortsLoading) {
        return (
            <div className="flex items-center gap-2 text-xs text-theme-text-muted">
                <FontAwesomeIcon icon={faSpinner} className="h-3 w-3 animate-spin" />
                Loading cohorts...
            </div>
        );
    }

    if (myCohorts.length <= 1) return null;

    const formatLabel = (cohort) => {
        if (cohort.cohortName) return cohort.cohortName;
        const date = cohort.startDate ? new Date(cohort.startDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        return `${date} (${cohort.memberCount} members)`;
    };

    const statusDotColor = (status) => {
        const colors = {
            active: 'bg-green-400',
            forming: 'bg-amber-400',
            completed: 'bg-theme-text-muted',
            archived: 'bg-theme-text-muted/50',
        };
        return colors[status] || 'bg-theme-text-muted';
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={handleToggle}
                className="flex items-center gap-2 text-xs font-mono px-2.5 py-1.5 rounded border border-theme-line bg-theme-bg-secondary hover:bg-theme-bg-hover transition-colors"
            >
                <FontAwesomeIcon icon={faUsers} className="h-3 w-3 text-theme-text-muted" />
                <span className="text-theme-text">
                    {currentCohort ? formatLabel(currentCohort) : 'Switch cohort'}
                </span>
                {hasAnyUnread && (
                    <FontAwesomeIcon icon={faCircle} className="h-1.5 w-1.5 text-theme-accent" />
                )}
                <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`h-2.5 w-2.5 text-theme-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 z-50 border border-theme-line bg-theme-bg-secondary rounded shadow-lg overflow-hidden">
                    {/* Active / Forming cohorts */}
                    {activeCohorts.map(cohort => (
                        <button
                            key={cohort.id}
                            onClick={() => handleSwitch(cohort.id)}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-theme-bg-hover transition-colors ${
                                cohort.id === activeCohortId ? 'bg-theme-accent/10' : ''
                            }`}
                        >
                            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${statusDotColor(cohort.status)}`} />
                            <span className="text-theme-text flex-1 truncate font-mono">{formatLabel(cohort)}</span>
                            {joinedCohortId && cohort.id === joinedCohortId && (
                                <FontAwesomeIcon icon={faStar} className="h-2.5 w-2.5 text-amber-400" title="Participating" />
                            )}
                            {cohort.id !== activeCohortId && cohort.hasUnread && (
                                <FontAwesomeIcon icon={faCircle} className="h-1.5 w-1.5 text-theme-accent" />
                            )}
                            {cohort.id === activeCohortId && (
                                <FontAwesomeIcon icon={faCheck} className="h-3 w-3 text-theme-accent" />
                            )}
                        </button>
                    ))}

                    {/* Past cohorts (collapsible) */}
                    {pastCohorts.length > 0 && (
                        <>
                            <button
                                onClick={() => setShowPast(!showPast)}
                                className="w-full text-left px-3 py-1.5 text-[0.625rem] font-mono uppercase tracking-wider text-theme-text-muted border-t border-theme-line hover:bg-theme-bg-hover transition-colors"
                            >
                                Past cohorts ({pastCohorts.length})
                                <FontAwesomeIcon
                                    icon={faChevronDown}
                                    className={`h-2 w-2 ml-1 transition-transform ${showPast ? 'rotate-180' : ''}`}
                                />
                            </button>
                            {showPast && pastCohorts.map(cohort => (
                                <button
                                    key={cohort.id}
                                    onClick={() => handleSwitch(cohort.id)}
                                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-theme-bg-hover transition-colors opacity-60 ${
                                        cohort.id === activeCohortId ? 'bg-theme-accent/10 opacity-100' : ''
                                    }`}
                                >
                                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${statusDotColor(cohort.status)}`} />
                                    <span className="text-theme-text flex-1 truncate font-mono">{formatLabel(cohort)}</span>
                                    {joinedCohortId && cohort.id === joinedCohortId && (
                                        <FontAwesomeIcon icon={faStar} className="h-2.5 w-2.5 text-amber-400" title="Participating" />
                                    )}
                                    {cohort.id !== activeCohortId && cohort.hasUnread && (
                                        <FontAwesomeIcon icon={faCircle} className="h-1.5 w-1.5 text-theme-accent" />
                                    )}
                                    {cohort.id === activeCohortId && (
                                        <FontAwesomeIcon icon={faCheck} className="h-3 w-3 text-theme-accent" />
                                    )}
                                </button>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default CohortSwitcher;

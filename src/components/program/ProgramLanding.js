/* src/components/program/ProgramLanding.js */

/**
 * Pre-enrollment view for the 28-Day Protocol.
 * Shows program description, science backing, and join flow.
 * Design: Matches dashboard/counting-span lab aesthetic.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faComments, faBrain, faCalendarDays, faArrowRight, faArrowLeft, faPlay, faRotateLeft, faTrophy } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import { useCohort } from '../../contexts/CohortContext';
import { useUser } from '../../contexts/UserContext';
import CohortJoinModal from './CohortJoinModal';

const PROGRAM_ID = 'the-28-day-protocol';

const ProgramLanding = () => {
    const { getFormingCohortInfo } = useCohort();
    const { userData } = useUser();
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [skipRejoin, setSkipRejoin] = useState(false);
    const [showRejoinChoice, setShowRejoinChoice] = useState(false);
    const [formingInfo, setFormingInfo] = useState(null);
    const [isLoadingInfo, setIsLoadingInfo] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const fetchInfo = async () => {
            try {
                const info = await getFormingCohortInfo(PROGRAM_ID);
                if (!cancelled) setFormingInfo(info);
            } catch (err) {
                console.error('[ProgramLanding] Error fetching forming cohort info:', err);
            }
            if (!cancelled) setIsLoadingInfo(false);
        };
        fetchInfo();
        return () => { cancelled = true; };
    }, [getFormingCohortInfo]);

    const handleJoinClick = useCallback(() => {
        if (userData?.lastLeftCohortId && userData?.lastLeftCohortName) {
            setShowRejoinChoice(true);
        } else {
            setShowJoinModal(true);
        }
    }, [userData?.lastLeftCohortId, userData?.lastLeftCohortName]);

    const handleRejoinChoice = useCallback((chooseNew) => {
        setShowRejoinChoice(false);
        setSkipRejoin(chooseNew);
        setShowJoinModal(true);
    }, []);

    const formatStartDate = useCallback((dateStr) => {
        if (!dateStr) return 'next Monday';
        const d = new Date(dateStr + 'T13:00:00Z');
        return d.toLocaleString('en-US', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }, []);

    return (
        <>
        <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-8 lab-grid">

            {/* ═══════════════════════════════════════════════════════════════
                PAGE HEADER
                Matches dashboard/counting-span badge + title pattern
               ═══════════════════════════════════════════════════════════════ */}
            <header className="mb-8 sm:mb-10">
                {/* Back navigation */}
                <div className="mb-6">
                    <Link
                        to="/dashboard"
                        className="group inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-accent transition-colors"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                        <span className="text-xs font-mono uppercase tracking-wider">Return to Dashboard</span>
                    </Link>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        {/* Icon badge — rotated diamond pattern */}
                        <div className="h-12 w-12 sm:h-14 sm:w-14 relative flex-shrink-0">
                            <div className="absolute inset-0 bg-theme-accent/20 rounded-sm rotate-3"></div>
                            <div className="absolute inset-0 bg-theme-bg-secondary border border-theme-accent flex items-center justify-center text-theme-accent">
                                <FontAwesomeIcon icon={faUsers} className="h-5 w-5 sm:h-6 sm:w-6" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">Training Program</p>
                                <span className="text-[0.625rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-theme-accent/20 text-theme-accent">
                                    Beta
                                </span>
                            </div>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl text-theme-text font-serif italic">
                                The 28-Day Protocol
                            </h1>
                        </div>
                    </div>
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════════
                PRIMARY ACTION — JOIN CTA
                Matches dashboard Primary Action Hub pattern
               ═══════════════════════════════════════════════════════════════ */}
            <section className="mb-8 sm:mb-12">
                <div className="relative overflow-hidden bg-gradient-to-br from-theme-bg-secondary to-theme-bg-elevated border border-theme-line p-5 sm:p-8">
                    {/* Decorative corner accent */}
                    <div className="absolute top-0 right-0 w-20 h-20 bg-theme-accent/5"></div>
                    <div className="absolute top-0 right-0 w-16 h-16 border-r-2 border-t-2 border-theme-accent/30"></div>

                    <div className="relative">
                        <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono mb-2">Enroll Now</p>
                        <h2 className="text-2xl sm:text-3xl text-theme-text font-serif italic mb-4">Join Your Cohort</h2>
                        <p className="text-sm text-theme-text-secondary mb-2 max-w-md">
                            Build a real daily training habit with a small group holding you accountable.
                            3 days on, 1 day off — progressive targets that build over 4 weeks.
                        </p>

                        {!isLoadingInfo && formingInfo && (
                            <p className="text-xs font-mono text-theme-text-muted mb-4">
                                Next cohort starts {formatStartDate(formingInfo.startDate)}
                                {formingInfo.memberCount > 0 && ` · ${formingInfo.memberCount} enrolled · ${formingInfo.spotsRemaining} spot${formingInfo.spotsRemaining !== 1 ? 's' : ''} remaining`}
                            </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={handleJoinClick}
                                className="btn-primary-lab py-3 sm:py-4 px-6 sm:px-8 text-sm sm:text-base inline-flex items-center justify-center gap-3"
                            >
                                <FontAwesomeIcon icon={faPlay} className="h-4 w-4 flex-shrink-0" />
                                <span>Join Next Cohort</span>
                            </button>
                            <span className="text-xs text-theme-text-muted">Free to join · Any regular session counts</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════
                PROGRAM OVERVIEW
                Specimen card with key details
               ═══════════════════════════════════════════════════════════════ */}
            <section className="mb-8 sm:mb-12">
                <div className="mb-6">
                    <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono mb-1">Protocol Overview</p>
                    <h2 className="text-xl sm:text-2xl text-theme-text font-serif italic">Program Details</h2>
                </div>
                <div className="specimen-card p-4 sm:p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-start gap-3">
                            <FontAwesomeIcon icon={faCalendarDays} className="text-theme-accent mt-0.5 h-4 w-4 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-theme-text">28 days</p>
                                <p className="text-xs text-theme-text-muted">Train 3 days, rest 1 — a research-backed spacing pattern</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <FontAwesomeIcon icon={faUsers} className="text-theme-accent mt-0.5 h-4 w-4 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-theme-text">Small cohort</p>
                                <p className="text-xs text-theme-text-muted">Train alongside a small group for accountability</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <FontAwesomeIcon icon={faBrain} className="text-theme-accent mt-0.5 h-4 w-4 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-theme-text">Progressive targets</p>
                                <p className="text-xs text-theme-text-muted">Sessions scale from a minimum of 4 to 8 per day, then taper — building capacity without burnout</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <FontAwesomeIcon icon={faComments} className="text-theme-accent mt-0.5 h-4 w-4 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-theme-text">Group chat</p>
                                <p className="text-xs text-theme-text-muted">Real-time chat with your cohort for encouragement and accountability</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>

        {/* Rejoin choice overlay */}
        {showRejoinChoice && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(4px)' }}>
                <div className="relative w-full max-w-sm bg-theme-bg-secondary border border-theme-line p-6" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-lg font-serif text-theme-text mb-2">Welcome back!</h3>
                    <p className="text-sm text-theme-text-secondary font-mono mb-4">
                        You previously left <span className="text-theme-accent font-medium">{userData.lastLeftCohortName}</span>
                        {' '}({userData.lastLeftCohortStatus}, {userData.lastLeftCohortMemberCount} member{userData.lastLeftCohortMemberCount !== 1 ? 's' : ''}).
                    </p>
                    <div className="space-y-2">
                        <button
                            onClick={() => handleRejoinChoice(false)}
                            className="w-full py-3 px-4 text-sm font-mono uppercase tracking-wider bg-theme-accent hover:bg-amber-highlight text-theme-bg border border-theme-accent transition-colors inline-flex items-center justify-center gap-2"
                        >
                            <FontAwesomeIcon icon={faRotateLeft} className="h-3.5 w-3.5" />
                            Rejoin {userData.lastLeftCohortName}
                        </button>
                        <button
                            onClick={() => handleRejoinChoice(true)}
                            className="w-full py-3 px-4 text-sm font-mono uppercase tracking-wider bg-theme-bg-secondary hover:bg-theme-bg-surface text-theme-text-secondary hover:text-theme-text border border-theme-line transition-colors inline-flex items-center justify-center gap-2"
                        >
                            <FontAwesomeIcon icon={faArrowRight} className="h-3.5 w-3.5" />
                            Join Next Cohort
                        </button>
                        <button
                            onClick={() => setShowRejoinChoice(false)}
                            className="w-full py-2 text-xs font-mono text-theme-text-muted hover:text-theme-text transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Join Modal — rendered outside lab-grid to avoid z-index stacking context issues */}
        {showJoinModal && (
            <CohortJoinModal
                programId={PROGRAM_ID}
                defaultName={userData?.displayName?.split(' ')[0] || ''}
                savedDisplayName={userData?.cohortDisplayName}
                skipRejoin={skipRejoin}
                onClose={() => { setShowJoinModal(false); setSkipRejoin(false); }}
            />
        )}
        </>
    );
};

export default ProgramLanding;

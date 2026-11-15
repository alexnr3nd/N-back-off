/* src/components/program/ProgramCompletionSummary.js */

/**
 * Post-program view — shown when a user's cohort has completed.
 * Shows personal results, cohort stats, and CTA to join next program.
 */

import React, { useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTrophy, faArrowRight, faArrowLeft, faUsers, faCalendarCheck, faFire, faFlask
} from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import { useCohort } from '../../contexts/CohortContext';
import CohortJoinModal from './CohortJoinModal';
import { useUser } from '../../contexts/UserContext';

const PROGRAM_ID = 'the-28-day-protocol';

const ProgramCompletionSummary = () => {
    const { activeCohort, cohortMembers, myMemberData, programData, leaveCohort } = useCohort();
    const { userData } = useUser();
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    const totalTrainingDays = programData?.dailyPrescriptions
        ? programData.dailyPrescriptions.filter(p => p.type === 'training').length
        : 21;

    const myDaysCompleted = myMemberData?.daysCompleted || 0;
    const myStreak = myMemberData?.programStreak || 0;
    const completionPercent = totalTrainingDays > 0 ? Math.round((myDaysCompleted / totalTrainingDays) * 100) : 0;

    const activeOrCompletedMembers = cohortMembers.filter(m => m.status === 'active' || m.status === 'completed');
    const avgCompletion = activeOrCompletedMembers.length > 0
        ? Math.round(activeOrCompletedMembers.reduce((sum, m) => sum + (m.daysCompleted || 0), 0) / activeOrCompletedMembers.length)
        : 0;

    const mostConsistent = activeOrCompletedMembers.reduce((best, m) =>
        (m.daysCompleted || 0) > (best?.daysCompleted || 0) ? m : best
    , null);

    const handleJoinNext = useCallback(async () => {
        // Leave current completed cohort first, then show join modal
        if (activeCohort?.id) {
            setIsLeaving(true);
            try {
                await leaveCohort(activeCohort.id);
                setShowJoinModal(true);
            } catch (err) {
                console.error('Error leaving completed cohort:', err);
            }
            setIsLeaving(false);
        } else {
            setShowJoinModal(true);
        }
    }, [activeCohort, leaveCohort]);

    return (
        <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-8 lab-grid">
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

            {/* Header */}
            <header className="mb-6 sm:mb-8 text-center">
                <FontAwesomeIcon icon={faTrophy} className="h-8 w-8 text-amber-400/80 mb-3" />
                <p className="text-xs font-medium font-mono uppercase tracking-[0.2em] text-theme-text-muted mb-1">
                    Program Complete
                </p>
                <h1 className="text-xl sm:text-2xl text-theme-text font-serif italic">
                    {programData?.name || 'The 28-Day Protocol'}
                </h1>
            </header>

            {/* Your results */}
            <section className="mb-8 sm:mb-10">
                <p className="text-xs font-medium font-mono uppercase tracking-[0.2em] text-theme-text-muted mb-3">
                    Your Results
                </p>
                <div className="border border-theme-line bg-theme-bg-elevated p-4 sm:p-6">
                    <div className="grid grid-cols-3 gap-4 sm:gap-6 text-center mb-4">
                        <div>
                            <p className="text-2xl sm:text-3xl font-serif text-theme-text tabular-nums">
                                {myDaysCompleted}
                                <span className="text-lg text-theme-text-muted">/{totalTrainingDays}</span>
                            </p>
                            <p className="text-xs text-theme-text-muted mt-1">
                                <FontAwesomeIcon icon={faCalendarCheck} className="mr-1 h-3 w-3" />
                                Days
                            </p>
                        </div>
                        <div>
                            <p className="text-2xl sm:text-3xl font-serif text-theme-text tabular-nums">
                                {completionPercent}%
                            </p>
                            <p className="text-xs text-theme-text-muted mt-1">
                                <FontAwesomeIcon icon={faFlask} className="mr-1 h-3 w-3" />
                                Completion
                            </p>
                        </div>
                        <div>
                            <p className="text-2xl sm:text-3xl font-serif text-theme-text tabular-nums">
                                {myStreak}
                            </p>
                            <p className="text-xs text-theme-text-muted mt-1">
                                <FontAwesomeIcon icon={faFire} className="mr-1 h-3 w-3" />
                                Best streak
                            </p>
                        </div>
                    </div>

                    {/* Completion message */}
                    {completionPercent >= 80 && (
                        <p className="text-sm text-green-500/80 text-center italic border-t border-theme-line pt-3">
                            Outstanding commitment. Your training volume matches the research protocol known to improve working memory.
                        </p>
                    )}
                    {completionPercent >= 50 && completionPercent < 80 && (
                        <p className="text-sm text-theme-accent text-center italic border-t border-theme-line pt-3">
                            Strong effort. Most people don&apos;t complete half a structured protocol — you did.
                        </p>
                    )}
                    {completionPercent < 50 && (
                        <p className="text-sm text-theme-text-secondary text-center italic border-t border-theme-line pt-3">
                            Every session counts. Consider joining the next cohort to build on what you started.
                        </p>
                    )}
                </div>
            </section>

            {/* Cohort results */}
            <section className="mb-8 sm:mb-10">
                <p className="text-xs font-medium font-mono uppercase tracking-[0.2em] text-theme-text-muted mb-3">
                    Cohort Results
                </p>
                <div className="border border-theme-line p-4 sm:p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-lg font-serif text-theme-text tabular-nums">
                                {activeOrCompletedMembers.length}
                            </p>
                            <p className="text-xs text-theme-text-muted">
                                <FontAwesomeIcon icon={faUsers} className="mr-1" />
                                Members finished
                            </p>
                        </div>
                        <div>
                            <p className="text-lg font-serif text-theme-text tabular-nums">
                                {avgCompletion} days
                            </p>
                            <p className="text-xs text-theme-text-muted">Avg. days completed</p>
                        </div>
                        {mostConsistent && (
                            <div className="col-span-2 sm:col-span-1">
                                <p className="text-lg font-serif text-theme-text truncate">
                                    {mostConsistent.odivUsername}
                                </p>
                                <p className="text-xs text-theme-text-muted">
                                    <FontAwesomeIcon icon={faTrophy} className="mr-1 text-amber-400/70" />
                                    Most consistent ({mostConsistent.daysCompleted}d)
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="text-center mb-8">
                <div className="border border-theme-accent/30 bg-theme-accent/5 p-4 sm:p-6">
                    <p className="text-sm text-theme-text-secondary mb-4">
                        Ready for another round? Join the next cohort and keep building.
                    </p>
                    <button
                        onClick={handleJoinNext}
                        disabled={isLeaving}
                        className="btn-primary-lab py-3 px-8 text-sm inline-flex items-center gap-2 disabled:opacity-50"
                    >
                        {isLeaving ? 'Preparing...' : 'Join Next Program'}
                        <FontAwesomeIcon icon={faArrowRight} className="h-3.5 w-3.5" />
                    </button>
                </div>
            </section>

            {/* Join modal */}
            {showJoinModal && (
                <CohortJoinModal
                    programId={PROGRAM_ID}
                    defaultName={userData?.cohortDisplayName || userData?.displayName?.split(' ')[0] || ''}
                    savedDisplayName={userData?.cohortDisplayName}
                    onClose={() => setShowJoinModal(false)}
                />
            )}
        </div>
    );
};

export default ProgramCompletionSummary;

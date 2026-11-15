/* src/components/program/CohortDashboard.js */

/**
 * Active cohort experience — the main view when enrolled.
 * Shows daily prescription, progress board, chat, and program calendar.
 * Design: Lab mission-control aesthetic — each day is a data point in your experiment.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFlask, faBed, faArrowRight, faArrowLeft, faComments, faChartBar,
    faSignOutAlt, faCalendarDays, faBolt, faCheckCircle, faGear
} from '@fortawesome/free-solid-svg-icons';
import { useCohort } from '../../contexts/CohortContext';
import { useUser } from '../../contexts/UserContext';
import CohortSwitcher from './CohortSwitcher';
import { useNavigate, Link } from 'react-router-dom';
import { useGame } from '../../contexts/GameContext';
import { useSettings } from '../../contexts/SettingsContext';
import audioManager from '../../utils/audioManager';
import CohortProgressBoard from './CohortProgressBoard';
import CohortChat from './CohortChat';
import ProgramCalendar from './ProgramCalendar';
import CohortJoinModal from './CohortJoinModal';
import CohortSettings from './CohortSettings';
import CohortCountdown from './CohortCountdown';

const CohortDashboard = () => {
    const {
        activeCohort, activeCohortId, joinedCohortId, programData, programDay,
        todaysPrescription, isTodayRestDay, todaysSessionTarget,
        todaysSessionsCompleted, myMemberData, cohortMembers, leaveCohort,
        unreadChatCount, markChatAsRead, messages
    } = useCohort();
    const { userData, isDataReady, isAdmin } = useUser();
    const navigate = useNavigate();
    const { startGame, setSaveToProfile, gameState, setGameOrigin, resetContinuousChainState } = useGame();
    const { settings } = useSettings();

    const [activeTab, setActiveTab] = useState('progress');
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [isStartingGame, setIsStartingGame] = useState(false);

    // Navigate to /game when game starts loading (after Train button click)
    useEffect(() => {
        if (isStartingGame && (gameState === 'loading' || gameState === 'preparing')) {
            navigate('/game');
        }
    }, [gameState, isStartingGame, navigate]);

    // Reset button state when game returns to idle (covers network errors, auth errors, etc.)
    useEffect(() => {
        if (gameState === 'idle') {
            setIsStartingGame(false);
        }
    }, [gameState]);


    const handleTrain = useCallback(async () => {
        if (!isDataReady || isStartingGame) return;
        setIsStartingGame(true);
        try {
            audioManager.init();
            const audioResumed = await audioManager.resume();
            if (audioResumed) {
                const voiceId = settings?.selectedVoiceId || Object.keys(audioManager.VOICES)[0];
                audioManager.preload({ voiceId, difficulties: [0.05] });
            }
        } catch (error) {
            console.error('[CohortDashboard] Audio resume error:', error);
            setIsStartingGame(false);
            return;
        }
        // Defensive: clear any stale continuous-chain state (an abandoned chain leaves
        // isActive set), matching both dashboard start paths. Without this, gameSetup's
        // Recall resolution sees an "active" chain and silently downgrades a Recall
        // start to Match. startGame reads the level from the correct progression track
        // itself — passing nBack/difficulty here was dead weight (gameSetup only reads
        // overrideNBack/overrideDifficulty) and read the wrong track under Recall.
        if (typeof resetContinuousChainState === 'function') resetContinuousChainState();
        setSaveToProfile(true);
        setGameOrigin('/program');
        startGame();
    }, [isDataReady, isStartingGame, setSaveToProfile, startGame, setGameOrigin, settings?.selectedVoiceId, resetContinuousChainState]);

    const isForming = activeCohort?.status === 'forming';
    const isDayComplete = todaysSessionsCompleted >= todaysSessionTarget && todaysSessionTarget > 0;

    // Mark chat as read when viewing the chat tab (or when new messages arrive while on it)
    useEffect(() => {
        if (activeTab === 'chat') {
            markChatAsRead();
        }
    }, [activeTab, messages, markChatAsRead]);

    // Members who trained today
    const membersTrainedToday = useMemo(() => {
        if (!cohortMembers.length || programDay < 1) return 0;
        const dayKey = String(programDay);
        return cohortMembers.filter(m =>
            m.status === 'active' && m.dailyProgress?.[dayKey]?.sessionsPlayed > 0
        ).length;
    }, [cohortMembers, programDay]);

    const activeMembers = useMemo(() =>
        cohortMembers.filter(m => m.status === 'active').length,
    [cohortMembers]);

    // Compute effective streak — reset to 0 if any training day was missed
    const myEffectiveStreak = useMemo(() => {
        const stored = myMemberData?.programStreak || 0;
        if (stored === 0 || programDay < 2) return stored;
        const prescriptions = programData?.dailyPrescriptions;
        if (!prescriptions) return stored;

        for (let d = programDay - 1; d >= 1; d--) {
            const prescription = prescriptions.find(p => p.day === d);
            if (prescription?.type !== 'training') continue;
            if (myMemberData?.dailyProgress?.[String(d)]?.completed) return stored;
            return 0;
        }
        return stored;
    }, [myMemberData?.programStreak, myMemberData?.dailyProgress, programDay, programData?.dailyPrescriptions]);

    const handleLeave = async () => {
        setIsLeaving(true);
        try {
            await leaveCohort(activeCohort.id);
        } catch (err) {
            console.error('Error leaving cohort:', err);
        }
        setIsLeaving(false);
        setShowLeaveConfirm(false);
    };


    return (
        <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-8 lab-grid overflow-x-hidden">
            {/* Header */}
            <header className="mb-6 sm:mb-8 relative z-10">
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
                <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-medium font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                        {programData?.name || 'Training Program'}
                    </p>
                    <span className="text-[0.625rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-theme-accent/20 text-theme-accent">
                        Beta
                    </span>
                    {isAdmin && <CohortSwitcher />}
                </div>
                {activeCohort?.cohortName && (
                    <p className="text-sm font-mono text-theme-accent mb-1">
                        {activeCohort.cohortName}
                    </p>
                )}
                <div className="flex items-baseline justify-between flex-wrap gap-2">
                    <h1 className="text-xl sm:text-2xl text-theme-text font-serif italic">
                        {isForming
                            ? `Cohort forming — starts ${formatDate(activeCohort.startDate)}`
                            : `Day ${programDay} of 28`
                        }
                    </h1>
                    {activeCohort?.startDate && activeCohort.status !== 'completed' && activeCohort.status !== 'archived' && (
                        <CohortCountdown startDate={activeCohort.startDate} status={activeCohort.status} programDay={programDay} />
                    )}
                </div>
            </header>

            {/* Forming state */}
            {isForming && (
                <section className="mb-8 sm:mb-10">
                    <div className="border border-theme-accent/30 bg-theme-bg-secondary p-4 sm:p-6">
                        <div className="flex items-center gap-2 mb-2">
                            <FontAwesomeIcon icon={faFlask} className="text-theme-accent h-4 w-4" />
                            <p className="text-sm font-medium text-theme-text">Your cohort is assembling</p>
                        </div>
                        <p className="text-sm text-theme-text-secondary mb-3">
                            {activeMembers} {activeMembers === 1 ? 'member' : 'members'} enrolled.
                            {activeMembers < activeCohort.minMembers
                                ? ` Need ${activeCohort.minMembers - activeMembers} more to start on ${formatDate(activeCohort.startDate)}.`
                                : ` Ready to start on ${formatDate(activeCohort.startDate)}.`
                            }
                        </p>
                        <p className="text-xs text-theme-text-muted">
                            Invite a friend: share the link to this page.
                        </p>
                    </div>
                </section>
            )}

            {/* Today's Prescription Card */}
            {!isForming && programDay >= 1 && programDay <= 28 && (
                <section className="mb-6 sm:mb-8">
                    <div className={`border p-4 sm:p-5 relative overflow-hidden ${
                        isTodayRestDay
                            ? 'border-theme-line bg-theme-bg-elevated'
                            : isDayComplete
                                ? 'border-theme-line bg-theme-bg-elevated'
                                : 'border-theme-accent/30 bg-theme-bg-elevated'
                    }`}>

                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <FontAwesomeIcon
                                        icon={isTodayRestDay ? faBed : isDayComplete ? faCheckCircle : faBolt}
                                        className={`h-4 w-4 ${
                                            isTodayRestDay
                                                ? 'text-theme-text-muted'
                                                : isDayComplete
                                                    ? 'text-green-500'
                                                    : 'text-theme-accent'
                                        }`}
                                    />
                                    <p className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">
                                        Day {programDay} — {isTodayRestDay ? 'Rest Day' : isDayComplete ? 'Complete' : 'Training Day'}
                                    </p>
                                </div>

                                {isTodayRestDay ? (
                                    <>
                                        <p className="text-sm text-theme-text-secondary italic">
                                            {todaysPrescription.message}
                                        </p>
                                        {todaysSessionsCompleted > 0 && (
                                            <p className="text-xs text-theme-text-muted mt-1">
                                                {todaysSessionsCompleted} {todaysSessionsCompleted === 1 ? 'session' : 'sessions'} played
                                            </p>
                                        )}
                                        <p className="text-xs text-theme-text-muted mt-1">Your streak is safe on rest days</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-baseline gap-3 mb-2">
                                            <p className="text-2xl sm:text-3xl font-serif text-theme-text tabular-nums">
                                                {todaysSessionsCompleted}
                                                <span className="text-theme-text-muted text-lg sm:text-xl">/{todaysSessionTarget}</span>
                                            </p>
                                            <p className="text-xs text-theme-text-muted">sessions</p>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Train button — hidden when admin is viewing a non-joined cohort */}
                            {(!joinedCohortId || activeCohortId === joinedCohortId) ? (
                                <button
                                    onClick={handleTrain}
                                    disabled={isStartingGame}
                                    className={`py-2.5 px-5 text-sm flex-shrink-0 inline-flex items-center gap-2 rounded-lab font-semibold uppercase tracking-widest transition-colors ${
                                        isTodayRestDay
                                            ? 'border border-theme-accent/40 text-theme-accent hover:bg-theme-accent/10'
                                            : 'btn-primary-lab'
                                    }`}
                                >
                                    {isStartingGame ? 'Starting...' : 'Train'}
                                    <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3" />
                                </button>
                            ) : (
                                <span className="text-xs font-mono text-theme-text-muted/60 uppercase tracking-wider">
                                    Observing
                                </span>
                            )}
                        </div>

                        {todaysPrescription?.focusTip && (
                            <p className="text-sm text-theme-text-secondary mt-3">
                                {todaysPrescription.focusTip}
                            </p>
                        )}

                        {todaysPrescription?.scienceNugget && (
                            <p className="text-xs text-theme-text-muted mt-3 border-t border-theme-line pt-2 italic">
                                {todaysPrescription.scienceNugget}
                            </p>
                        )}
                    </div>
                </section>
            )}

            {/* Day 28 — Join Next Cohort CTA */}
            {!isForming && programDay >= 28 && (
                <section className="mb-6 sm:mb-8">
                    <div className="border border-green-500/30 bg-green-500/5 p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <FontAwesomeIcon icon={faCheckCircle} className="h-4 w-4 text-green-500" />
                                    <p className="text-sm font-medium text-theme-text">You did it — ready for your next cohort?</p>
                                </div>
                                <p className="text-xs text-theme-text-muted">
                                    Join a new cohort to keep your training momentum going.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowJoinModal(true)}
                                className="btn-primary-lab py-2.5 px-5 text-sm flex-shrink-0 inline-flex items-center gap-2"
                            >
                                Join Next Cohort
                                <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3" />
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {/* Stats strip */}
            {!isForming && (
                <div className="flex items-center gap-4 sm:gap-6 mb-6 text-xs font-mono text-theme-text-muted">
                    <span>{membersTrainedToday} of {activeMembers} trained today</span>
                    <span className="text-theme-line">|</span>
                    <span>Streak: {myEffectiveStreak}d</span>
                    <span className="text-theme-line">|</span>
                    <span>{myMemberData?.daysCompleted || 0} days done</span>
                </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-theme-line mb-6">
                {(isForming
                    ? [
                        { key: 'progress', icon: faChartBar, label: 'Members' },
                        { key: 'chat', icon: faComments, label: 'Chat' },
                        { key: 'settings', icon: faGear, label: 'Settings' },
                    ]
                    : [
                        { key: 'progress', icon: faChartBar, label: 'Progress Board' },
                        { key: 'chat', icon: faComments, label: 'Chat' },
                        { key: 'calendar', icon: faCalendarDays, label: 'Calendar' },
                        { key: 'settings', icon: faGear, label: 'Settings' },
                    ]
                ).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            activeTab === tab.key
                                ? 'border-theme-accent text-theme-accent'
                                : 'border-transparent text-theme-text-muted hover:text-theme-text hover:border-theme-line'
                        }`}
                    >
                        <FontAwesomeIcon icon={tab.icon} className="h-5 w-5 sm:h-3.5 sm:w-3.5" />
                        <span className="hidden sm:inline">{tab.label}</span>
                        {tab.key === 'chat' && unreadChatCount > 0 && activeTab !== 'chat' && (
                            <span className="ml-1 min-w-[1.25rem] h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold px-1">
                                {unreadChatCount > 9 ? '9+' : unreadChatCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab content — lab panel within the grid */}
            <div className="border border-theme-line bg-theme-bg-secondary p-4 sm:p-5">
                {activeTab === 'progress' && <CohortProgressBoard isForming={isForming} />}
                {activeTab === 'chat' && <CohortChat />}
                {activeTab === 'calendar' && !isForming && <ProgramCalendar />}
                {activeTab === 'settings' && <CohortSettings />}
            </div>

            {/* Leave cohort (hidden for admin) */}
            {!isAdmin && (
                <div className="mt-8 pt-6 border-t border-theme-line">
                    <button
                        onClick={() => setShowLeaveConfirm(true)}
                        className="text-xs text-theme-text-muted hover:text-red-500 transition-colors inline-flex items-center gap-1.5"
                    >
                        <FontAwesomeIcon icon={faSignOutAlt} className="h-3 w-3" />
                        Leave cohort
                    </button>
                </div>
            )}

            {/* Leave confirmation — rendered via Portal to match CohortJoinModal pattern */}
            {showLeaveConfirm && (
                <LeaveConfirmModal
                    isLeaving={isLeaving}
                    cohortStatus={activeCohort?.status}
                    onLeave={handleLeave}
                    onClose={() => setShowLeaveConfirm(false)}
                />
            )}

            {/* Join Next Cohort modal — backend auto-completes old membership */}
            {showJoinModal && (
                <CohortJoinModal
                    programId={activeCohort?.programId || 'the-28-day-protocol'}
                    defaultName={userData?.cohortDisplayName || userData?.displayName?.split(' ')[0] || ''}
                    savedDisplayName={userData?.cohortDisplayName}
                    onClose={() => setShowJoinModal(false)}
                />
            )}
        </div>
    );
};

/** Leave confirmation modal — matches CohortJoinModal Cognitive Lab pattern */
const LeaveConfirmModal = ({ isLeaving, cohortStatus, onLeave, onClose }) => {
    // Prevent body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    // Escape key to close
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !isLeaving) onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, isLeaving]);

    return ReactDOM.createPortal(
        <div
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 99999,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '1rem',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
            }}
        >
            {/* Background overlay */}
            <div
                style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(4px)',
                }}
                onClick={!isLeaving ? onClose : undefined}
            />

            {/* Modal panel */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '28rem',
                    backgroundColor: 'rgb(var(--color-bg-secondary))',
                    border: '1px solid rgb(var(--color-line))',
                    borderRadius: '2px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    marginTop: 'auto',
                    marginBottom: 'auto',
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="leave-cohort-title"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Body */}
                <div className="px-6 pt-6 pb-4">
                    <div className="sm:flex sm:items-start">
                        {/* Icon */}
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-500/20 sm:mx-0 sm:h-10 sm:w-10">
                            <FontAwesomeIcon icon={faSignOutAlt} className="h-5 w-5 text-red-500" aria-hidden="true" />
                        </div>
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                            <h3 className="text-lg font-serif text-theme-text" id="leave-cohort-title">
                                Leave cohort?
                            </h3>
                            <div className="mt-2 text-sm text-theme-text-secondary font-mono">
                                {cohortStatus === 'forming'
                                    ? 'You can rejoin this cohort or join another before it starts.'
                                    : 'You can rejoin this cohort at any time. Your progress will be preserved.'
                                }
                                {' '}Your chat messages will remain visible to other members.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="bg-theme-bg-elevated px-6 py-4 border-t border-theme-line sm:flex sm:flex-row-reverse gap-3">
                    {/* Leave Button */}
                    <button
                        type="button"
                        onClick={onLeave}
                        disabled={isLeaving}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-lab text-sm font-mono uppercase tracking-wider
                            bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30
                            transition-all duration-200 inline-flex items-center justify-center gap-2
                            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-theme-bg-secondary focus:ring-red-500
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLeaving ? (
                            <>
                                <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
                                Leaving...
                            </>
                        ) : (
                            'Leave Cohort'
                        )}
                    </button>

                    {/* Cancel Button */}
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLeaving}
                        className="w-full sm:w-auto mt-3 sm:mt-0 px-5 py-2.5 rounded-lab text-sm font-mono uppercase tracking-wider
                            bg-theme-bg-secondary hover:bg-theme-bg-surface text-theme-text-secondary hover:text-theme-text
                            border border-theme-line transition-all duration-200
                            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-theme-bg-secondary focus:ring-theme-accent
                            disabled:opacity-50"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T13:00:00Z');
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default CohortDashboard;

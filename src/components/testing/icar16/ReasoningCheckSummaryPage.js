/* src/components/testing/icar16/ReasoningCheckSummaryPage.js */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPlay,
    faArrowLeft,
    faBrain,
    faTrophy,
    faCheckCircle,
    faExclamationTriangle,
    faSpinner,
    faInfoCircle,
    faClipboardCheck,
} from '@fortawesome/free-solid-svg-icons';

import { useUser } from '../../../contexts/UserContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { functions, httpsCallable } from '../../../firebaseConfig';
import { computeReasoningCheckStatus } from '../../../utils/assessmentEligibility';
import LoadingSpinner from '../../ui/LoadingSpinner';
import ConfirmationModal from '../../ui/ConfirmationModal';
import ReasoningCheckHistoryTable from './ReasoningCheckHistoryTable';
import ReasoningCheckFaqSection from './ReasoningCheckFaqSection';
import ReasoningScoreContextCard from './ReasoningScoreContextCard';
import {
    getPendingResults,
    clearPendingResults,
} from './hooks/useReasoningCheckLogic';
import {
    REASONING_CHECK_TEST_TYPE,
    ICAR_TOTAL_ITEMS,
} from '../../../constants/icarConstants';

const RUN_ROUTE = '/testing/reasoning/run';
const SUGGESTED_INTERVAL_DAYS = 365;
const DEFAULT_TIMEZONE = 'UTC';

const ReasoningCheckSummaryPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        userData, userId, authUser, isDataReady,
        isLoading: isLoadingProfile, loading: loadingAuth,
        refreshUserData,
    } = useUser();
    const { settings, isLoading: isLoadingSettings } = useSettings();

    // Client-computed — mirrors checkReasoningCheckEligibility (functions/icar.js).
    // Advisory only; the Reasoning Check has no server-side gating anywhere.
    const eligibility = useMemo(() => ({
        ...computeReasoningCheckStatus(userData?.reasoningCheckHistory),
        isLoading: false,
        error: null,
    }), [userData?.reasoningCheckHistory]);

    const [pendingRecoveryStatus, setPendingRecoveryStatus] = useState(null); // null | 'recovering' | 'recovered' | 'failed'
    const [isModalOpen, setIsModalOpen] = useState(false);

    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Scroll to top on mount
    useEffect(() => { window.scrollTo(0, 0); }, []);

    const userTimezoneForDisplay = useMemo(() => settings?.timezone || DEFAULT_TIMEZONE, [settings?.timezone]);

    // ---- Pending result recovery (offline resilience) ----
    useEffect(() => {
        if (!userId || !authUser) return;
        const pending = getPendingResults(userId);
        if (!pending) return;

        setPendingRecoveryStatus('recovering');
        const submit = httpsCallable(functions, 'submitReasoningCheckResults');
        submit(pending)
            .then((result) => {
                if (result.data?.success) {
                    clearPendingResults(userId);
                    if (isMountedRef.current) setPendingRecoveryStatus('recovered');
                    // Refetch userData so the recovered attempt appears in Session History
                    refreshUserData();
                } else if (isMountedRef.current) {
                    setPendingRecoveryStatus('failed');
                }
            })
            .catch((err) => {
                if (err?.code === 'functions/invalid-argument' || err?.code === 'functions/permission-denied') {
                    clearPendingResults(userId);
                }
                if (isMountedRef.current) setPendingRecoveryStatus('failed');
            });
    }, [userId, authUser, refreshUserData]);

    // ---- Derive history from userData ----
    const history = useMemo(() => {
        const raw = userData?.reasoningCheckHistory;
        if (!Array.isArray(raw)) return [];
        return raw
            .filter((item) => item && item.testType === REASONING_CHECK_TEST_TYPE && item.timestamp)
            .map((item) => {
                let ts = null;
                try {
                    if (item.timestamp?.toDate) ts = item.timestamp.toDate();
                    else if (typeof item.timestamp === 'string' || typeof item.timestamp === 'number') {
                        ts = new Date(item.timestamp);
                    }
                } catch (_) { /* skip */ }
                return { ...item, timestamp: ts };
            })
            .filter((item) => item.timestamp instanceof Date && !isNaN(item.timestamp))
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [userData?.reasoningCheckHistory]);

    const bestScore = useMemo(() => {
        if (!history.length) return null;
        return history.reduce((max, item) => {
            return (typeof item.rawScore === 'number' && item.rawScore > (max?.rawScore ?? -1))
                ? item
                : max;
        }, null);
    }, [history]);

    // ---- Date formatting (user timezone) ----
    const formatDate = useCallback((dateInput) => {
        if (!dateInput) return 'N/A';
        try {
            const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit', hour12: true,
                timeZone: userTimezoneForDisplay,
            });
        } catch (e) { return 'Invalid Date'; }
    }, [userTimezoneForDisplay]);

    const formatDateOnly = useCallback((dateInput) => {
        if (!dateInput) return 'N/A';
        try {
            const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
                timeZone: userTimezoneForDisplay,
            });
        } catch (e) { return 'Invalid Date'; }
    }, [userTimezoneForDisplay]);

    // ---- CTA logic ----
    const isFirstAttempt = eligibility.attemptCount === 0;
    const isWithinYear = !isFirstAttempt
        && typeof eligibility.daysSinceLastAttempt === 'number'
        && eligibility.daysSinceLastAttempt < SUGGESTED_INTERVAL_DAYS;

    const isAppLoading = loadingAuth || isLoadingProfile || isLoadingSettings;

    // Start always confirms via modal, then launches the test directly.
    // `confirmed` lets the task skip its READY interstitial; deep links to
    // /run still get it.
    const handleStartClick = useCallback(() => {
        if (eligibility.isLoading) return;
        setIsModalOpen(true);
    }, [eligibility.isLoading]);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
    }, []);

    const handleConfirmStart = useCallback(() => {
        setIsModalOpen(false);
        navigate(RUN_ROUTE, { state: { confirmed: true } });
    }, [navigate]);

    // ---- Loading and error gates ----
    if (isAppLoading) {
        return (
            <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-8 lab-grid min-h-screen flex items-center justify-center">
                <LoadingSpinner message="Loading profile and settings..." theme="auto" />
            </div>
        );
    }
    if (!authUser && !loadingAuth) {
        return (
            <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-8 lab-grid min-h-screen flex items-center justify-center">
                <div className="specimen-card p-6 text-center">
                    <p className="text-status-error font-mono">Please log in to view assessments.</p>
                </div>
            </div>
        );
    }
    if (authUser && !isDataReady && !isLoadingProfile) {
        return (
            <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-8 lab-grid min-h-screen flex items-center justify-center">
                <div className="specimen-card p-6 text-center">
                    <p className="text-theme-text-secondary font-mono">Please select or create a profile to view assessments.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-8 lab-grid min-h-screen">
            {/* PAGE HEADER */}
            <header className="mb-8 sm:mb-10">
                <div className="mb-6">
                    <button
                        onClick={() => navigate('/testing')}
                        className="group inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-accent transition-colors"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                        <span className="text-sm sm:text-xs font-mono uppercase tracking-wider">Back to Assessments</span>
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 sm:h-14 sm:w-14 relative flex-shrink-0">
                            <div className="absolute inset-0 bg-theme-accent/20 rounded-sm rotate-3"></div>
                            <div className="absolute inset-0 bg-theme-bg-secondary border border-theme-accent flex items-center justify-center text-theme-accent">
                                <FontAwesomeIcon icon={faBrain} className="h-5 w-5 sm:h-6 sm:w-6" />
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">Protocol ICAR-16</p>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl text-theme-text font-serif italic flex items-center gap-3">
                                Reasoning Check
                            </h1>
                        </div>
                    </div>

                    {/* Best Score Badge */}
                    {bestScore && (
                        <div className="bg-theme-bg-secondary border border-theme-accent/50 px-4 py-3">
                            <div className="flex items-center gap-2 text-theme-accent mb-1">
                                <FontAwesomeIcon icon={faTrophy} className="h-3 w-3" />
                                <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider">Personal Best</span>
                            </div>
                            <div className="text-2xl font-mono text-theme-text">
                                {bestScore.rawScore}
                                <span className="text-sm text-theme-text-muted ml-1">/ {bestScore.maxScore || ICAR_TOTAL_ITEMS}</span>
                            </div>
                            <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono mt-1">
                                {formatDate(bestScore.timestamp)}
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* PENDING RESULTS RECOVERY BANNER */}
            {pendingRecoveryStatus === 'recovering' && (
                <section className="mb-4">
                    <div className="specimen-card p-4 flex items-center gap-3 border-theme-accent">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-theme-accent h-4 w-4" />
                        <span className="text-sm text-theme-text-secondary">Submitting previously saved results...</span>
                    </div>
                </section>
            )}
            {pendingRecoveryStatus === 'recovered' && (
                <section className="mb-4">
                    <div className="specimen-card p-4 flex items-center gap-3 border-status-success/30">
                        <FontAwesomeIcon icon={faCheckCircle} className="text-status-success h-4 w-4" />
                        <span className="text-sm text-theme-text-secondary">Previously saved results have been submitted successfully.</span>
                    </div>
                </section>
            )}
            {pendingRecoveryStatus === 'failed' && (
                <section className="mb-4">
                    <div className="specimen-card p-4 flex items-center gap-3 border-status-error/30">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-status-error h-4 w-4" />
                        <span className="text-sm text-theme-text-secondary">Failed to submit previously saved results. They will be retried on your next visit.</span>
                    </div>
                </section>
            )}

            {/* DESCRIPTION PANEL */}
            <section className="mb-8">
                <div className="specimen-card p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                        <h2 className="text-sm sm:text-xs uppercase tracking-[0.2em] text-theme-text-muted font-mono">Protocol Overview</h2>
                    </div>
                    <p className="text-theme-text-secondary text-sm">
                        A 16-item brief assessment of fluid reasoning — the ability to recognise patterns and
                        solve novel problems. It complements the working-memory tasks (CST, OSPAN) that fluctuate
                        from day to day; reasoning is more stable, so this works well as an annual baseline.
                        Plan for ~10–15 minutes of uninterrupted focus.
                    </p>
                </div>
            </section>

            {/* MAIN CONTENT GRID */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">

                {/* START BUTTON & STATUS CARD — stretches to match the right card's
                    height; the Start button anchors to the bottom edge */}
                <div className="xl:col-span-1">
                    <div className="specimen-card h-full flex flex-col">
                        <div className="px-5 py-4 border-b border-theme-line bg-theme-bg-elevated/50">
                            <div className="flex items-center gap-2">
                                <FontAwesomeIcon icon={faBrain} className="text-theme-accent h-4 w-4" />
                                <h2 className="text-sm font-serif italic text-theme-text">Assessment Status</h2>
                            </div>
                        </div>

                        <div className="p-5 flex-grow flex flex-col justify-between">
                            <div>
                                {eligibility.error && (
                                    <div className="mb-5 p-3 bg-status-error/10 border border-status-error/30 text-status-error text-sm sm:text-xs font-mono break-words">
                                        <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
                                        {eligibility.error}
                                    </div>
                                )}

                                {!eligibility.isLoading && !eligibility.error && (
                                    isFirstAttempt ? (
                                        <div className="p-4 mb-5 border-l-2 border-status-success bg-status-success/10">
                                            <div className="flex items-center gap-2 text-status-success">
                                                <FontAwesomeIcon icon={faCheckCircle} className="h-4 w-4" />
                                                <span className="text-sm font-mono">Ready for first attempt</span>
                                            </div>
                                        </div>
                                    ) : isWithinYear ? (
                                        <div className="p-4 mb-5 border-l-2 border-theme-accent bg-theme-accent/10">
                                            <div className="flex items-center gap-2 text-status-warning mb-1">
                                                <FontAwesomeIcon icon={faInfoCircle} className="h-3 w-3" />
                                                <span className="text-sm sm:text-xs font-mono uppercase tracking-wider">Annual baseline recommended</span>
                                            </div>
                                            <p className="text-sm text-theme-text-secondary mb-1">
                                                Last taken <span className="text-theme-text font-mono">{eligibility.daysSinceLastAttempt}</span> days ago.
                                                Reasoning is most useful as an annual measure — frequent retakes mostly reflect practice, not gain.
                                            </p>
                                            {eligibility.suggestedNextDate && (
                                                <p className="text-theme-text font-mono text-sm">
                                                    Suggested next: {formatDateOnly(eligibility.suggestedNextDate)}
                                                </p>
                                            )}
                                            {eligibility.lastAttemptDate && (
                                                <p className="mt-2 text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono">
                                                    Last: {formatDate(eligibility.lastAttemptDate)}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-4 mb-5 border-l-2 border-status-success bg-status-success/10">
                                            <div className="flex items-center gap-2 text-status-success">
                                                <FontAwesomeIcon icon={faCheckCircle} className="h-4 w-4" />
                                                <span className="text-sm font-mono">Ready for retake</span>
                                            </div>
                                            {eligibility.lastAttemptDate && (
                                                <p className="mt-1 text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono">
                                                    Last: {formatDate(eligibility.lastAttemptDate)}
                                                </p>
                                            )}
                                        </div>
                                    )
                                )}
                            </div>

                            <div>
                                {/* Start/Action Button — no paywall: the Reasoning Check is never Pro-gated */}
                                <button
                                    onClick={handleStartClick}
                                    className="btn-primary-lab w-full py-3 px-4 text-sm flex items-center justify-center gap-2 transition-all duration-200"
                                >
                                    <FontAwesomeIcon icon={faPlay} className="h-4 w-4" />
                                    <span>{isFirstAttempt ? 'Take the test (~15 min)' : (isWithinYear ? 'Take again anyway' : 'Take again')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SCORE CONTEXT (fills the chart slot — no trend chart for a fixed item bank) */}
                <ReasoningScoreContextCard latestAttempt={history[0] || null} />
            </div>

            {/* SESSION HISTORY TABLE */}
            <ReasoningCheckHistoryTable history={history} formatDate={formatDate} />

            {/* FAQ SECTION */}
            <ReasoningCheckFaqSection />

            {/* ATTRIBUTION */}
            <section className="mb-8">
                <div className="specimen-card p-5 sm:p-6">
                    <p className="text-xs text-theme-text-muted leading-relaxed">
                        This Reasoning Check uses items from the <span className="text-theme-text-secondary">ICAR Sample Test</span>{' '}
                        (Condon &amp; Revelle, 2014). It is based on freely-available, peer-reviewed
                        psychometric research and is not a clinical IQ test. Validated to correlate{' '}
                        <span className="text-theme-text-secondary">r = .81</span> with WAIS-IV Full-Scale IQ
                        (Young &amp; Keith, 2020).
                    </p>
                </div>
            </section>

            {/* START CONFIRMATION MODAL — confirming launches the test directly */}
            <ConfirmationModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onConfirm={handleConfirmStart}
                title={isFirstAttempt ? 'Start Reasoning Check' : (isWithinYear ? 'Early Retake' : 'Retake Reasoning Check')}
                confirmColor="amber"
                confirmText="Start Test"
                cancelText="Cancel"
                isDestructive={false}
            >
                {isFirstAttempt ? (
                    <div className="space-y-4">
                        <div className="flex justify-center">
                            <div className="h-14 w-14 bg-theme-bg-elevated border border-theme-accent flex items-center justify-center text-theme-accent">
                                <FontAwesomeIcon icon={faPlay} className="text-xl" />
                            </div>
                        </div>
                        <p className="text-theme-text-secondary text-sm">
                            You're about to take the <strong className="text-theme-text">Reasoning Check</strong> for
                            the first time — the test begins immediately after confirming. There is no practice run:
                            the same 16 items are reused on every attempt, so the first attempt is scored. The four
                            question types are described on this page.
                        </p>
                        <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-4">
                            <p className="text-sm text-theme-text-secondary">
                                <FontAwesomeIcon icon={faInfoCircle} className="text-theme-accent mr-2" />
                                Allow ~10&ndash;15 minutes of uninterrupted focus. The test cannot be paused once
                                started, and skipped items count as wrong.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex justify-center">
                            <div className="h-14 w-14 bg-theme-bg-elevated border border-theme-accent flex items-center justify-center text-theme-accent">
                                <FontAwesomeIcon icon={faClipboardCheck} className="text-xl" />
                            </div>
                        </div>
                        {isWithinYear && (
                            <div className="bg-status-warning/10 border border-status-warning/30 p-3 rounded mb-2">
                                <p className="text-sm text-status-warning font-medium mb-1">
                                    Only {eligibility.daysSinceLastAttempt ?? '?'} days since your last attempt
                                </p>
                                <p className="text-xs text-theme-text-secondary">
                                    Retaking the same 16 items this soon mostly measures memory of the items, which
                                    inflates the score. Waiting until {eligibility.suggestedNextDate ? formatDateOnly(eligibility.suggestedNextDate) : 'the suggested date'} is advised.
                                </p>
                            </div>
                        )}
                        <p className="text-theme-text-secondary text-sm">
                            You're about to retake the <strong className="text-theme-text">Reasoning Check</strong> —
                            the test begins immediately after confirming. The score will be recorded alongside previous
                            attempts. Spacing attempts about a year apart keeps the comparison meaningful, because the
                            same 16 items are reused.
                        </p>
                        <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-4">
                            <p className="text-sm text-theme-text-secondary">
                                <FontAwesomeIcon icon={faInfoCircle} className="text-theme-accent mr-2" />
                                Allow ~10&ndash;15 minutes of uninterrupted focus. The test cannot be paused once
                                started, and skipped items count as wrong.
                            </p>
                        </div>
                    </div>
                )}
            </ConfirmationModal>
        </div>
    );
};

export default ReasoningCheckSummaryPage;

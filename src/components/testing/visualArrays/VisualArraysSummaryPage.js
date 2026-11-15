/* src/components/testing/visualArrays/VisualArraysSummaryPage.js */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';
import { canAccessProAssessments } from '../../../utils/assessmentAccess';
import { useSettings } from '../../../contexts/SettingsContext';
import { CST_TEST_TYPES } from '../../../constants/cstConstants';
import { functions, httpsCallable } from '../../../firebaseConfig';
import { getPendingResults, clearPendingResults } from './hooks/useVisualArraysLogic';
import { useAssessmentEligibility } from '../../../hooks/useAssessmentEligibility';
import VisualArraysProgressChart from './VisualArraysProgressChart';
import VisualArraysHistoryTable from './VisualArraysHistoryTable';
import VisualArraysFaqSection from './VisualArraysFaqSection';
import LoadingSpinner from '../../ui/LoadingSpinner';
import ConfirmationModal from '../../ui/ConfirmationModal';
import AssessmentPaywallModal from '../../ui/AssessmentPaywallModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPlay,
    faInfoCircle,
    faBookOpen,
    faExclamationTriangle,
    faTrophy,
    faChartLine,
    faCheckCircle,
    faVectorSquare,
    faArrowLeft,
    faClipboardCheck,
    faSpinner
} from '@fortawesome/free-solid-svg-icons';

const DEFAULT_TIMEZONE = 'UTC';
const REQUIRED_FAMILIARIZATION_COUNT = 1;

const VisualArraysSummaryPage = () => {
    const { userData, userId, isDataReady, isLoading: isLoadingProfile, loading: loadingAuth, markTutorialCompleted, authUser, subscriptionTier } = useUser();
    const { settings, isLoading: isLoadingSettings } = useSettings();

    const navigate = useNavigate();
    const location = useLocation();

    // Locally-recovered submissions not yet reflected in userData.cstHistory
    const [recoveredEntries, setRecoveredEntries] = useState(null);
    const eligibilityStatus = useAssessmentEligibility(CST_TEST_TYPES.VISUAL_ARRAYS, recoveredEntries);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmingFamiliarization, setIsConfirmingFamiliarization] = useState(false);
    const [showPaywallModal, setShowPaywallModal] = useState(false);

    const isMountedRef = useRef(true);

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Check for ?showUpgrade=true (user returning from Stripe checkout cancel)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('showUpgrade') === 'true') {
            window.history.replaceState({}, '', window.location.pathname);
            setShowPaywallModal(true);
        }
    }, []);

    const userTimezoneForDisplay = useMemo(() => settings?.timezone || DEFAULT_TIMEZONE, [settings?.timezone]);

    // --- Lifecycle Management ---
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // --- Recover pending results from localStorage (offline resilience) ---
    const [pendingRecoveryStatus, setPendingRecoveryStatus] = useState(null); // null | 'recovering' | 'recovered' | 'failed'
    useEffect(() => {
        if (!userId || !authUser) return;
        const pending = getPendingResults(userId);
        if (!pending) return;

        console.log('[VisualArrays Summary] Found pending results, attempting recovery...');
        setPendingRecoveryStatus('recovering');

        const recover = async () => {
            try {
                const submitFunc = httpsCallable(functions, 'submitVisualArraysResults');
                const result = await submitFunc(pending);
                if (result.data?.success) {
                    clearPendingResults(userId);
                    // Reflect the recovered session in client-computed eligibility
                    // immediately; the full entry arrives with the next userData refresh.
                    setRecoveredEntries([{
                        testType: CST_TEST_TYPES.VISUAL_ARRAYS,
                        familiarizationSession: !!pending.isFamiliarization,
                        timestamp: new Date().toISOString(),
                    }]);
                    setPendingRecoveryStatus('recovered');
                    console.log('[VisualArrays Summary] Pending results recovered successfully');
                } else {
                    setPendingRecoveryStatus('failed');
                }
            } catch (err) {
                console.error('[VisualArrays Summary] Pending results recovery failed:', err);
                // Validation errors mean the data is unrecoverable -- clear it
                if (err.code === 'functions/invalid-argument' || err.code === 'functions/permission-denied') {
                    console.warn('[VisualArrays Summary] Pending data is invalid, clearing.');
                    clearPendingResults(userId);
                }
                setPendingRecoveryStatus('failed');
            }
        };
        recover();
    }, [userId, authUser]);

    // --- Assessment Access Check (Premium or Grandfathered) ---
    const canAccessAssessments = useMemo(
        () => canAccessProAssessments(userData, subscriptionTier),
        [subscriptionTier, userData?.assessmentGrandfathered, userData?.cstHistory]
    );

    // --- Memoized History Data ---
    const visualArraysHistory = useMemo(() => {
        if (!userData?.cstHistory || !Array.isArray(userData.cstHistory)) return [];
        return userData.cstHistory
            .filter(item => item.testType === CST_TEST_TYPES.VISUAL_ARRAYS && item.timestamp)
            .map(item => {
                let timestampDate = null;
                try {
                    if (item.timestamp?.toDate) timestampDate = item.timestamp.toDate();
                    else if (typeof item.timestamp === 'string' || typeof item.timestamp === 'number') timestampDate = new Date(item.timestamp);
                } catch (e) { /* skip */ }
                return { ...item, timestamp: timestampDate };
            })
            .filter(item => item.timestamp instanceof Date && !isNaN(item.timestamp))
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [userData?.cstHistory]);

    // Filtered history excluding familiarization (for the chart), chronological
    const assessmentHistoryForChart = useMemo(() => {
        return [...visualArraysHistory.filter(item => !item.familiarizationSession)].reverse();
    }, [visualArraysHistory]);

    // Best scored session (by capacity k, the primary measure)
    const bestSession = useMemo(() => {
        if (!assessmentHistoryForChart.length) return null;
        return assessmentHistoryForChart.reduce((best, item) => {
            if (typeof item.scoreK !== 'number') return best;
            if (!best || item.scoreK > best.scoreK) return item;
            return best;
        }, null);
    }, [assessmentHistoryForChart]);

    // --- Actions ---
    const handleReviewTutorial = useCallback(() => {
        navigate('/testing/visual-arrays/tutorial');
    }, [navigate]);

    const isEarlyRetake = eligibilityStatus.familiarizationComplete && !eligibilityStatus.isEligible && !eligibilityStatus.isLoading;

    const handleStartClick = useCallback(() => {
        if (!canAccessAssessments) {
            setShowPaywallModal(true);
            return;
        }
        if (eligibilityStatus.isLoading) return;
        setIsConfirmingFamiliarization(!eligibilityStatus.familiarizationComplete);
        setIsModalOpen(true);
    }, [eligibilityStatus, canAccessAssessments]);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
    }, []);

    const handleConfirmStart = useCallback(() => {
        setIsModalOpen(false);
        const tutorialKey = CST_TEST_TYPES.VISUAL_ARRAYS;
        if (userData && userId && !userData.tutorialsCompleted?.[tutorialKey]) {
            markTutorialCompleted(userId, tutorialKey).catch(err => console.error('Tutorial mark error:', err));
        }
        navigate('/testing/visual-arrays/run', { state: { earlyRetake: isEarlyRetake } });
    }, [navigate, userId, userData, markTutorialCompleted, isEarlyRetake]);

    // --- Helper Function for Date Formatting ---
    const formatDate = useCallback((dateInput) => {
        if (!dateInput) return 'N/A';
        try {
            const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit', hour12: true,
                timeZone: userTimezoneForDisplay
            });
        } catch (e) { return 'Invalid Date'; }
    }, [userTimezoneForDisplay]);

    // --- Loading and Error States ---
    const isAppLoading = loadingAuth || isLoadingProfile || isLoadingSettings;
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

    // --- Derived state for rendering ---
    const { isEligible, familiarizationComplete, familiarizationCount, nextAvailableDateString, lastAssessmentDate, error: eligibilityError } = eligibilityStatus;
    const isFamiliarizationNeeded = !familiarizationComplete;
    const familiarizationSessionsRemaining = Math.max(0, REQUIRED_FAMILIARIZATION_COUNT - familiarizationCount);

    const startButtonText = isFamiliarizationNeeded ? 'Start Familiarization' : 'Start Assessment';

    // --- Render JSX ---
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
                                <FontAwesomeIcon icon={faVectorSquare} className="h-5 w-5 sm:h-6 sm:w-6" />
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">Protocol VARRAY-01</p>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl text-theme-text font-serif italic flex items-center gap-3">
                                Visual Arrays                            </h1>
                        </div>
                    </div>

                    {/* Best Session Badge */}
                    {bestSession && (
                        <div className="bg-theme-bg-secondary border border-theme-accent/50 px-4 py-3">
                            <div className="flex items-center gap-2 text-theme-accent mb-1">
                                <FontAwesomeIcon icon={faTrophy} className="h-3 w-3" />
                                <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider">Personal Best</span>
                            </div>
                            <div className="text-2xl font-mono text-theme-text">
                                {bestSession.scoreK.toFixed(2)}
                                <span className="text-sm text-theme-text-muted ml-2">k</span>
                            </div>
                            <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono mt-1">{formatDate(bestSession.timestamp)}</div>
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
                        Visual Arrays measures attention control: red and blue rectangles flash for a quarter second,
                        but only the cued color matters. After a brief delay, judge whether the dotted rectangle kept
                        or changed its tilt. The score, capacity k, estimates how many relevant items you held while
                        filtering the distractors. Complete a familiarization session first, then take a formal
                        assessment once each month to track your progress.
                    </p>
                </div>
            </section>

            {/* MAIN CONTENT GRID */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">

                {/* START BUTTON & STATUS CARD */}
                <div className="xl:col-span-1">
                    <div className="specimen-card h-full flex flex-col">
                        <div className="px-5 py-4 border-b border-theme-line bg-theme-bg-elevated/50">
                            <div className="flex items-center gap-2">
                                <FontAwesomeIcon icon={faVectorSquare} className="text-theme-accent h-4 w-4" />
                                <h2 className="text-sm font-serif italic text-theme-text">Assessment Status</h2>
                            </div>
                        </div>

                        <div className="p-5 flex-grow flex flex-col justify-between">
                            <div>
                                {/* Familiarization Progress Indicator */}
                                {isFamiliarizationNeeded && (
                                    <div className="mb-5">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm sm:text-xs font-mono text-theme-text-muted uppercase tracking-wider">Familiarization</span>
                                            <span className="text-sm font-mono text-theme-accent">{familiarizationCount} / {REQUIRED_FAMILIARIZATION_COUNT}</span>
                                        </div>
                                        <div className="w-full bg-theme-bg-surface h-2">
                                            <div
                                                className="bg-theme-accent h-2 transition-all duration-500"
                                                style={{ width: `${(familiarizationCount / REQUIRED_FAMILIARIZATION_COUNT) * 100}%` }}
                                            ></div>
                                        </div>
                                        <p className="mt-3 text-sm sm:text-xs text-theme-text-secondary">
                                            Complete {familiarizationSessionsRemaining} {familiarizationCount > 0 ? 'more ' : ''}session{familiarizationSessionsRemaining !== 1 ? 's' : ''} to unlock monthly assessments.
                                        </p>
                                    </div>
                                )}

                                {/* Monthly Assessment Status */}
                                {familiarizationComplete && (
                                    <div className={`p-4 mb-5 border-l-2 ${isEligible ? 'border-status-success bg-status-success/10' : 'border-theme-accent bg-theme-accent/10'}`}>
                                        {isEligible && (
                                            <div className="flex items-center gap-2 text-status-success">
                                                <FontAwesomeIcon icon={faCheckCircle} className="h-4 w-4" />
                                                <span className="text-sm font-mono">Ready for assessment</span>
                                            </div>
                                        )}
                                        {!isEligible && nextAvailableDateString && (
                                            <div>
                                                <div className="flex items-center gap-2 text-status-warning mb-1">
                                                    <FontAwesomeIcon icon={faExclamationTriangle} className="h-3 w-3" />
                                                    <span className="text-sm sm:text-xs font-mono uppercase tracking-wider">Early Retake</span>
                                                </div>
                                                <p className="text-sm text-theme-text-secondary mb-1">
                                                    {eligibilityStatus.daysSinceLastAssessment != null
                                                        ? `${eligibilityStatus.daysSinceLastAssessment} days since last assessment. `
                                                        : ''}
                                                    Waiting 30 days is recommended for reliable tracking.
                                                </p>
                                                <p className="text-theme-text font-mono text-sm">Recommended: {nextAvailableDateString}</p>
                                                {lastAssessmentDate && (
                                                    <p className="mt-2 text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono">
                                                        Last: {formatDate(lastAssessmentDate)}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Eligibility Error Display */}
                                {eligibilityError && (
                                    <div className="mb-5 p-3 bg-status-error/10 border border-status-error/30 text-status-error text-sm sm:text-xs font-mono break-words">
                                        <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
                                        {eligibilityError}
                                    </div>
                                )}
                            </div>

                            <div>
                                {/* Start/Action Button */}
                                <button
                                    onClick={handleStartClick}
                                    className="btn-primary-lab w-full py-3 px-4 text-sm flex items-center justify-center gap-2 transition-all duration-200"
                                >
                                    <FontAwesomeIcon icon={faPlay} className="h-4 w-4" />
                                    <span>{startButtonText}</span>
                                </button>

                                <button
                                    onClick={handleReviewTutorial}
                                    className="w-full mt-3 py-2.5 px-4 bg-theme-bg-elevated border border-theme-line hover:border-theme-accent text-sm font-mono text-theme-text-secondary hover:text-theme-accent flex items-center justify-center gap-2 transition-all"
                                >
                                    <FontAwesomeIcon icon={faBookOpen} className="h-3 w-3" />
                                    <span>View Tutorial</span>
                                </button>

                                {/* Requirements List — hidden once all met */}
                                {!(familiarizationComplete && assessmentHistoryForChart.length > 0) && (
                                    <div className="mt-5 pt-5 border-t border-theme-line">
                                        <h3 className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider mb-3">Requirements</h3>
                                        <ul className="space-y-2">
                                            <li className="flex items-start gap-2">
                                                <span className={`mt-0.5 flex-shrink-0 h-3 w-3 border ${familiarizationComplete ? 'bg-status-success border-status-success' : 'border-theme-line'}`}></span>
                                                <span className="text-sm sm:text-xs text-theme-text-secondary">Complete {REQUIRED_FAMILIARIZATION_COUNT} familiarization session{REQUIRED_FAMILIARIZATION_COUNT !== 1 ? 's' : ''}</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className={`mt-0.5 flex-shrink-0 h-3 w-3 border ${assessmentHistoryForChart.length > 0 ? 'bg-status-success border-status-success' : 'border-theme-line'}`}></span>
                                                <span className="text-sm sm:text-xs text-theme-text-secondary">Complete first official assessment</span>
                                            </li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* CHART AREA */}
                <div className="xl:col-span-2">
                    <div className="specimen-card mb-6">
                        <div className="px-5 py-4 border-b border-theme-line bg-theme-bg-elevated/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FontAwesomeIcon icon={faChartLine} className="text-theme-accent h-4 w-4" />
                                <h2 className="text-sm font-serif italic text-theme-text">Performance Trajectory</h2>
                            </div>
                            <span className="group relative cursor-help flex items-center gap-1 text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted">
                                <FontAwesomeIcon icon={faInfoCircle} className="h-3 w-3" />
                                <span>Capacity k</span>
                                <span className="absolute top-full right-0 mt-2 w-56 p-2 bg-theme-bg-elevated border border-theme-line text-theme-text-secondary text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                                    Capacity k estimates how many cued items were held in memory: k = N × (hit rate + correct rejection rate − 1), averaged over set sizes 3 and 5.
                                </span>
                            </span>
                        </div>

                        <div className="p-6 min-h-[300px] flex items-center justify-center">
                            {assessmentHistoryForChart.length > 0 ? (
                                <VisualArraysProgressChart historyData={assessmentHistoryForChart} />
                            ) : (
                                <div className="text-center py-8 px-4">
                                    <div className="relative mb-4 inline-block">
                                        <div className="w-16 h-16 border border-theme-line flex items-center justify-center text-theme-text-muted">
                                            <FontAwesomeIcon icon={faChartLine} className="h-6 w-6" />
                                        </div>
                                        <div className="absolute -top-1 -right-1 w-3 h-3 border-t border-r border-theme-accent/50"></div>
                                        <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b border-l border-theme-accent/50"></div>
                                    </div>
                                    <h3 className="text-base font-serif italic text-theme-text mb-2">No Assessment Data</h3>
                                    <p className="text-theme-text-muted text-sm sm:text-xs font-mono max-w-md mx-auto">
                                        Complete familiarization and take your first monthly assessment to begin tracking progress.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* SESSION HISTORY TABLE */}
            <VisualArraysHistoryTable history={visualArraysHistory} formatDate={formatDate} />

            {/* FAQ SECTION */}
            <VisualArraysFaqSection />

            {/* CONFIRMATION MODAL */}
            <ConfirmationModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onConfirm={handleConfirmStart}
                title={isConfirmingFamiliarization ? "Start Familiarization Session" : (isEarlyRetake ? "Early Retake" : "Start Monthly Assessment")}
                confirmColor="amber"
                confirmText={isConfirmingFamiliarization ? "Start Familiarization" : "Start Assessment"}
                cancelText="Cancel"
                isDestructive={false}
            >
                {isConfirmingFamiliarization ? (
                    <div className="space-y-4">
                        <div className="flex justify-center">
                            <div className="h-14 w-14 bg-theme-bg-elevated border border-theme-accent flex items-center justify-center text-theme-accent">
                                <FontAwesomeIcon icon={faPlay} className="text-xl" />
                            </div>
                        </div>
                        <p className="text-theme-text-secondary text-sm">
                            You're about to start a <strong className="text-theme-text">familiarization session</strong> for the Visual Arrays task.
                            It runs the full assessment (practice plus 120 trials) so you can learn the pacing without affecting your official scores.
                        </p>
                        <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-4">
                            <p className="text-sm text-theme-text-secondary">
                                <FontAwesomeIcon icon={faInfoCircle} className="text-theme-accent mr-2" />
                                The session cannot be paused once started and takes about 10&ndash;12 minutes, with one
                                short break at the halfway point. Keep this tab visible while the rectangles are flashing.
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
                        {isEarlyRetake && (
                            <div className="bg-status-warning/10 border border-status-warning/30 p-3 rounded mb-2">
                                <p className="text-sm text-status-warning font-medium mb-1">
                                    Only {eligibilityStatus.daysSinceLastAssessment ?? '?'} days since your last assessment
                                </p>
                                <p className="text-xs text-theme-text-secondary">
                                    Taking assessments too frequently can inflate scores due to practice effects, making it harder to detect genuine changes in attention control. Waiting until {eligibilityStatus.nextAvailableDateString || 'the recommended date'} is advised.
                                </p>
                            </div>
                        )}
                        <p className="text-theme-text-secondary text-sm">
                            You're about to start your <strong className="text-theme-text">monthly Visual Arrays assessment</strong>. Your score will be recorded. Waiting 30 days between assessments is recommended for reliable progress tracking.
                        </p>
                        <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-4">
                            <p className="text-sm text-theme-text-secondary">
                                <FontAwesomeIcon icon={faInfoCircle} className="text-theme-accent mr-2" />
                                Allow ~10&ndash;12 minutes of uninterrupted focus. The assessment cannot be paused once started.
                            </p>
                        </div>
                    </div>
                )}
            </ConfirmationModal>

            {/* Assessment Paywall Modal */}
            <AssessmentPaywallModal
                isOpen={showPaywallModal}
                onClose={() => setShowPaywallModal(false)}
                returnPath="/testing/visual-arrays"
            />
        </div>
    );
};

export default VisualArraysSummaryPage;

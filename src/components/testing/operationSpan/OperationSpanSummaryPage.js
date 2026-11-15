/* src/components/testing/operationSpan/OperationSpanSummaryPage.js */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { CST_TEST_TYPES } from '../../../constants/cstConstants';
import { functions, httpsCallable, auth } from '../../../firebaseConfig';
import { getPendingResults, clearPendingResults } from './hooks/useOperationSpanLogic';
import { useAssessmentEligibility } from '../../../hooks/useAssessmentEligibility';
import LoadingSpinner from '../../ui/LoadingSpinner';
import PaginationControls from '../../ui/PaginationControls';
import ProgressChart from '../../ui/ProgressChart';
import ConfirmationModal from '../../ui/ConfirmationModal';
import OperationSpanTrainerPanel from './trainer/OperationSpanTrainerPanel';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPlay,
    faInfoCircle,
    faBookOpen,
    faExclamationTriangle,
    faHistory,
    faTrophy,
    faChartLine,
    faCheckCircle,
    faSuperscript,
    faArrowLeft,
    faClipboardCheck,
    faSpinner
} from '@fortawesome/free-solid-svg-icons';

// Constants for display
const ITEMS_PER_PAGE = 10;
const DEFAULT_TIMEZONE = 'UTC';
const DISPLAY_MAX_SCORE_NEW = 75;
const DISPLAY_ACCURACY_THRESHOLD = 85;
const REQUIRED_FAMILIARIZATION_COUNT = 1;

const OperationSpanSummaryPage = () => {
    const { userData, userId, isDataReady, isLoading: isLoadingProfile, loading: loadingAuth, markTutorialCompleted, authUser } = useUser();
    const { settings, isLoading: isLoadingSettings } = useSettings();

    const navigate = useNavigate();
    const location = useLocation();

    // Locally-recovered submissions not yet reflected in userData.cstHistory
    const [recoveredEntries, setRecoveredEntries] = useState(null);
    const eligibilityStatus = useAssessmentEligibility(CST_TEST_TYPES.OPERATION_SPAN, recoveredEntries);

    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmingFamiliarization, setIsConfirmingFamiliarization] = useState(false);

    // Assessment <-> Trainer toggle. Visible to everyone; the Trainer is free
    // for all users, matching the free assessment (requiresPro: false).
    const [mode, setMode] = useState(() => {
        if (location.state?.mode === 'trainer') return 'trainer';
        try { if (localStorage.getItem('ospan_mode') === 'trainer') return 'trainer'; } catch (e) { /* ignore */ }
        return 'assessment';
    });
    const effectiveMode = mode;
    useEffect(() => {
        try { localStorage.setItem('ospan_mode', mode); } catch (e) { /* ignore */ }
    }, [mode]);

    const isMountedRef = useRef(true);

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
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

        console.log('[OSPAN Summary] Found pending results, attempting recovery...');
        setPendingRecoveryStatus('recovering');

        const recover = async () => {
            try {
                const submitFunc = httpsCallable(functions, 'submitOspanResults');
                const result = await submitFunc(pending);
                if (result.data?.success) {
                    clearPendingResults(userId);
                    // Reflect the recovered session in client-computed eligibility
                    // immediately; the full entry arrives with the next userData refresh.
                    setRecoveredEntries([{
                        testType: CST_TEST_TYPES.OPERATION_SPAN,
                        familiarizationSession: !!pending.isFamiliarization,
                        timestamp: new Date().toISOString(),
                    }]);
                    setPendingRecoveryStatus('recovered');
                    console.log('[OSPAN Summary] Pending results recovered successfully');
                } else {
                    setPendingRecoveryStatus('failed');
                }
            } catch (err) {
                console.error('[OSPAN Summary] Pending results recovery failed:', err);
                // If it's a validation error (400/invalid-argument), the data is unrecoverable -- clear it
                if (err.code === 'functions/invalid-argument' || err.code === 'functions/permission-denied') {
                    console.warn('[OSPAN Summary] Pending data is invalid, clearing.');
                    clearPendingResults(userId);
                }
                setPendingRecoveryStatus('failed');
            }
        };
        recover();
    }, [userId, authUser]);

    // --- Memoized History Data ---
    const ospanHistory = useMemo(() => {
        if (!userData?.cstHistory || !Array.isArray(userData.cstHistory)) return [];
        return userData.cstHistory
            .filter(item => item.testType === CST_TEST_TYPES.OPERATION_SPAN && item.timestamp)
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

    // Filtered history excluding familiarization (for the chart)
    const assessmentHistoryForChart = useMemo(() => {
        return [...ospanHistory.filter(item => !item.familiarizationSession)].reverse();
    }, [ospanHistory]);

    // Get best score for display
    const bestScore = useMemo(() => {
        if (!assessmentHistoryForChart.length) return null;
        return assessmentHistoryForChart.reduce((max, item) => {
            return (typeof item.scorePCU === 'number' && item.scorePCU > max.score)
                ? { score: item.scorePCU, date: item.timestamp, maxPCU: item.maxPCU || DISPLAY_MAX_SCORE_NEW }
                : max;
        }, { score: -Infinity, date: null, maxPCU: DISPLAY_MAX_SCORE_NEW });
    }, [assessmentHistoryForChart]);

    const totalItems = ospanHistory.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    const paginatedHistory = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return ospanHistory.slice(start, start + ITEMS_PER_PAGE);
    }, [ospanHistory, currentPage]);

    useEffect(() => { setCurrentPage(1); }, [ospanHistory]);

    // --- Actions ---
    const handleReviewTutorial = useCallback(() => {
        navigate('/testing/operation-span/tutorial');
    }, [navigate]);

    const isEarlyRetake = eligibilityStatus.familiarizationComplete && !eligibilityStatus.isEligible && !eligibilityStatus.isLoading;

    const handleStartClick = useCallback(() => {
        if (eligibilityStatus.isLoading) return;
        const startFamiliarization = !eligibilityStatus.familiarizationComplete;
        if (startFamiliarization) {
            setIsConfirmingFamiliarization(true);
        } else {
            setIsConfirmingFamiliarization(false);
        }
        setIsModalOpen(true);
    }, [eligibilityStatus]);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
    }, []);

    const handleConfirmStart = useCallback(() => {
        setIsModalOpen(false);
        const tutorialKey = CST_TEST_TYPES.OPERATION_SPAN;
        if (userData && userId && !userData.tutorialsCompleted?.[tutorialKey]) {
            markTutorialCompleted(userId, tutorialKey).catch(err => console.error('Tutorial mark error:', err));
        }
        navigate('/testing/operation-span/run', { state: { earlyRetake: isEarlyRetake } });
    }, [navigate, userId, userData, markTutorialCompleted, isEarlyRetake]);

    // --- Helper Function for Date Formatting ---
    const formatDate = (dateInput) => {
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
    };

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

            {/* =================================================================
                PAGE HEADER
               ================================================================= */}
            <header className="mb-8 sm:mb-10">
                {/* Back navigation */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate('/testing')}
                        className="group inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-accent transition-colors"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                        <span className="text-sm sm:text-xs font-mono uppercase tracking-wider">Back to Assessments</span>
                    </button>
                </div>

                {/* Title section with best score */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        {/* Icon badge */}
                        <div className="h-12 w-12 sm:h-14 sm:w-14 relative flex-shrink-0">
                            <div className="absolute inset-0 bg-theme-accent/20 rounded-sm rotate-3"></div>
                            <div className="absolute inset-0 bg-theme-bg-secondary border border-theme-accent flex items-center justify-center text-theme-accent">
                                <FontAwesomeIcon icon={faSuperscript} className="h-5 w-5 sm:h-6 sm:w-6" />
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">Protocol OSPAN-01</p>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl text-theme-text font-serif italic flex items-center gap-3">
                                Operation Span
                            </h1>
                        </div>
                    </div>

                    {/* Best Score Badge (assessment mode only) */}
                    {effectiveMode === 'assessment' && bestScore && bestScore.score > -Infinity && (
                        <div className="bg-theme-bg-secondary border border-theme-accent/50 px-4 py-3">
                            <div className="flex items-center gap-2 text-theme-accent mb-1">
                                <FontAwesomeIcon icon={faTrophy} className="h-3 w-3" />
                                <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider">Personal Best</span>
                            </div>
                            <div className="text-2xl font-mono text-theme-text">
                                {bestScore.score}
                                <span className="text-sm text-theme-text-muted ml-1">/ {bestScore.maxPCU}</span>
                            </div>
                            <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono mt-1">{formatDate(bestScore.date)}</div>
                        </div>
                    )}
                </div>
            </header>

            {/* Assessment <-> Trainer toggle (visible to all; Trainer is Pro-gated inside) */}
            <div className="flex mb-6" role="group" aria-label="Mode">
                {[{ key: 'assessment', label: 'Assessment' }, { key: 'trainer', label: 'Trainer' }].map((opt, i) => (
                    <button
                        key={opt.key}
                        type="button"
                        onClick={() => setMode(opt.key)}
                        aria-pressed={effectiveMode === opt.key}
                        className={`px-4 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors ${i === 0 ? '' : 'border-l-0'} ${effectiveMode === opt.key ? 'bg-theme-accent/20 text-theme-accent border-theme-accent/50' : 'border-theme-line text-theme-text-muted hover:text-theme-text hover:border-theme-accent/50'}`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {effectiveMode === 'trainer' ? (
                <OperationSpanTrainerPanel />
            ) : (
            <>

            {/* =================================================================
                PENDING RESULTS RECOVERY BANNER
               ================================================================= */}
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

            {/* =================================================================
                DESCRIPTION PANEL
               ================================================================= */}
            <section className="mb-8">
                <div className="specimen-card p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                        <h2 className="text-sm sm:text-xs uppercase tracking-[0.2em] text-theme-text-muted font-mono">Protocol Overview</h2>
                    </div>
                    <p className="text-theme-text-secondary text-sm">
                        The Operation Span task measures your working memory - the mental workspace that helps you temporarily store and manipulate information.
                        You will solve simple math equations while remembering sequences of letters. Complete a practice session first, then take a formal assessment once each month to track your progress.
                    </p>
                </div>
            </section>

            {/* =================================================================
                MAIN CONTENT GRID
               ================================================================= */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">

                {/* ---------------------------------------------------------
                    START BUTTON & STATUS CARD
                   --------------------------------------------------------- */}
                <div className="xl:col-span-1">
                    <div className="specimen-card h-full flex flex-col">
                        {/* Card Header */}
                        <div className="px-5 py-4 border-b border-theme-line bg-theme-bg-elevated/50">
                            <div className="flex items-center gap-2">
                                <FontAwesomeIcon icon={faSuperscript} className="text-theme-accent h-4 w-4" />
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
                                                    We recommend waiting 30 days for reliable tracking.
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
                                {(() => {
                                    const hasMetAccuracy = assessmentHistoryForChart.some(item => typeof item.processingAccuracy === 'number' && item.processingAccuracy >= DISPLAY_ACCURACY_THRESHOLD);
                                    const allMet = familiarizationComplete && assessmentHistoryForChart.length > 0 && hasMetAccuracy;
                                    if (allMet) return null;
                                    return (
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
                                                <li className="flex items-start gap-2">
                                                    <span className={`mt-0.5 flex-shrink-0 h-3 w-3 border ${hasMetAccuracy ? 'bg-status-success border-status-success' : 'border-theme-line'}`}></span>
                                                    <span className="text-sm sm:text-xs text-theme-text-secondary">Aim for {DISPLAY_ACCURACY_THRESHOLD}%+ math accuracy</span>
                                                </li>
                                            </ul>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ---------------------------------------------------------
                    CHART AREA
                   --------------------------------------------------------- */}
                <div className="xl:col-span-2">
                    <div className="specimen-card mb-6">
                        {/* Chart Header */}
                        <div className="px-5 py-4 border-b border-theme-line bg-theme-bg-elevated/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FontAwesomeIcon icon={faChartLine} className="text-theme-accent h-4 w-4" />
                                <h2 className="text-sm font-serif italic text-theme-text">Performance Trajectory</h2>
                            </div>
                            <span className="group relative cursor-help flex items-center gap-1 text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted">
                                <FontAwesomeIcon icon={faInfoCircle} className="h-3 w-3" />
                                <span>PCU Score</span>
                                <span className="absolute top-full right-0 mt-2 w-56 p-2 bg-theme-bg-elevated border border-theme-line text-theme-text-secondary text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                                    PCU (Partial-Credit Unit) measures working memory capacity, awarding points for correctly recalled letters in their proper positions.
                                </span>
                            </span>
                        </div>

                        <div className="p-6 min-h-[300px] flex items-center justify-center">
                            {assessmentHistoryForChart.length > 0 ? (
                                <ProgressChart
                                    historyData={assessmentHistoryForChart}
                                    testType={CST_TEST_TYPES.OPERATION_SPAN}
                                    maxPossibleScore={DISPLAY_MAX_SCORE_NEW}
                                />
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

            {/* =================================================================
                SESSION HISTORY TABLE
               ================================================================= */}
            <section className="mb-8">
                <div className="specimen-card">
                    {/* Table Header */}
                    <div className="px-5 py-4 border-b border-theme-line bg-theme-bg-elevated/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faHistory} className="text-theme-accent h-4 w-4" />
                            <h2 className="text-sm font-serif italic text-theme-text">Session History</h2>
                        </div>
                        {totalPages > 1 && (
                            <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider bg-theme-bg-secondary px-3 py-1 border border-theme-line">
                                Page {currentPage} of {totalPages}
                            </div>
                        )}
                    </div>

                    <div className="p-4">
                        {paginatedHistory.length > 0 ? (
                            <>
                                {/* Mobile Card View */}
                                <div className="block md:hidden space-y-3">
                                    {paginatedHistory.map((item, index) => (
                                        <div
                                            key={item.id || item.timestamp?.toString() || index}
                                            className="bg-theme-bg-elevated border border-theme-line p-4"
                                        >
                                            <div className="flex justify-between items-center mb-3">
                                                <span className={`px-2 py-0.5 text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider ${item.familiarizationSession
                                                        ? 'bg-theme-bg-surface text-theme-text-muted'
                                                        : 'bg-theme-accent/20 text-theme-accent'
                                                    }`}>
                                                    {item.familiarizationSession ? 'Practice' : 'Assessment'}
                                                </span>
                                                <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono">
                                                    {formatDate(item.timestamp)}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-1">PCU</div>
                                                    <div className="font-mono text-theme-text">
                                                        {typeof item.scorePCU === 'number' ? (
                                                            <>
                                                                <span className="text-lg">{item.scorePCU}</span>
                                                                <span className="text-theme-text-muted text-sm ml-1">/ {item.maxPCU || DISPLAY_MAX_SCORE_NEW}</span>
                                                            </>
                                                        ) : 'N/A'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-1">Math Accuracy</div>
                                                    {typeof item.processingAccuracy === 'number' ? (
                                                        <div className={`font-mono ${item.flaggedLowAccuracy ? 'text-status-error' : 'text-status-success'}`}>
                                                            {item.processingAccuracy.toFixed(1)}%
                                                            {item.flaggedLowAccuracy && (
                                                                <FontAwesomeIcon icon={faExclamationTriangle} className="ml-1 h-3 w-3" />
                                                            )}
                                                        </div>
                                                    ) : <span className="font-mono text-theme-text-muted">N/A</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Table View */}
                                <div className="hidden md:block overflow-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-theme-line">
                                                <th className="px-4 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Date</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Type</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">PCU (Score)</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Edit Distance</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Math Accuracy</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedHistory.map((item, index) => (
                                                <tr
                                                    key={item.id || item.timestamp?.toString() || index}
                                                    className="border-b border-theme-line/50 hover:bg-theme-bg-elevated/50 transition-colors"
                                                >
                                                    <td className="px-4 py-3 text-sm text-theme-text-secondary font-mono">
                                                        {formatDate(item.timestamp)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider ${item.familiarizationSession
                                                                ? 'bg-theme-bg-surface text-theme-text-muted'
                                                                : 'bg-theme-accent/20 text-theme-accent'
                                                            }`}>
                                                            {item.familiarizationSession ? 'Practice' : 'Assessment'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {typeof item.scorePCU === 'number' ? (
                                                            <span className="font-mono text-theme-text">
                                                                {item.scorePCU}
                                                                <span className="text-theme-text-muted ml-1">/ {item.maxPCU || DISPLAY_MAX_SCORE_NEW}</span>
                                                            </span>
                                                        ) : <span className="font-mono text-theme-text-muted">N/A</span>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="font-mono text-theme-text">
                                                            {item.scoreEditDistance ?? 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {typeof item.processingAccuracy === 'number' ? (
                                                            <span className={`font-mono text-sm ${item.flaggedLowAccuracy ? 'text-status-error' : 'text-status-success'}`}>
                                                                {item.processingAccuracy.toFixed(1)}%
                                                                {item.flaggedLowAccuracy && (
                                                                    <FontAwesomeIcon
                                                                        icon={faExclamationTriangle}
                                                                        className="ml-1 h-3 w-3"
                                                                        title={`Accuracy below ${DISPLAY_ACCURACY_THRESHOLD}% threshold`}
                                                                    />
                                                                )}
                                                            </span>
                                                        ) : <span className="font-mono text-theme-text-muted">N/A</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="mt-4 pt-4 border-t border-theme-line">
                                        <PaginationControls
                                            currentPage={currentPage}
                                            totalPages={totalPages}
                                            onPageChange={setCurrentPage}
                                            itemsPerPage={ITEMS_PER_PAGE}
                                            totalItems={totalItems}
                                        />
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-12 px-4">
                                <div className="relative mb-4 inline-block">
                                    <div className="w-16 h-16 border border-theme-line flex items-center justify-center text-theme-text-muted">
                                        <FontAwesomeIcon icon={faHistory} className="h-6 w-6" />
                                    </div>
                                    <div className="absolute -top-1 -right-1 w-3 h-3 border-t border-r border-theme-accent/50"></div>
                                    <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b border-l border-theme-accent/50"></div>
                                </div>
                                <h3 className="text-base font-serif italic text-theme-text mb-2">No History Available</h3>
                                <p className="text-theme-text-muted text-sm sm:text-xs font-mono max-w-md mx-auto">
                                    Start with a familiarization session to begin building your performance history.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* =================================================================
                FAQ SECTION
               ================================================================= */}
            <section className="mb-8">
                <div className="specimen-card">
                    <div className="px-5 py-4 border-b border-theme-line bg-theme-bg-elevated/50">
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faInfoCircle} className="text-theme-accent h-4 w-4" />
                            <h2 className="text-sm font-serif italic text-theme-text">Frequently Asked Questions</h2>
                        </div>
                    </div>

                    <div className="p-5">
                        <div className="space-y-0">
                            {[
                                {
                                    q: "What is the Operation Span task?",
                                    a: "The Operation Span task (OSPAN) measures your working memory capacity. During the task, you will see simple math equations to solve (e.g., (2 x 3) + 1 = ?), followed by a letter to remember. After several equation-letter pairs, you'll be asked to recall all the letters in the exact order they appeared."
                                },
                                {
                                    q: "What does this task measure?",
                                    a: "It assesses Working Memory Capacity (WMC) - your ability to simultaneously store temporary information (the letters) while actively processing other information (solving math equations). This dual-task format is one of the most widely validated measures in cognitive psychology (Unsworth et al., 2005)."
                                },
                                {
                                    q: "What is the familiarization session for?",
                                    a: "The first session is for familiarization. Cognitive tasks often show rapid improvement initially as you learn the rules and get comfortable with the interface. This session helps you get past that steep learning curve so that later assessments better reflect your stable working memory capacity. The familiarization score is recorded but excluded from the main performance trend chart."
                                },
                                {
                                    q: "How often can I take the main assessment?",
                                    a: "After completing the familiarization session, you can take one official assessment per calendar month. This limit ensures the assessment remains a stable measure and minimizes the influence of excessive practice on the score itself."
                                },
                                {
                                    q: "How is the PCU Score calculated?",
                                    a: "PCU stands for Partial Credit Unit scoring. You get one point for every letter you recall correctly and in its original serial position within a set. For example, if the correct sequence was [F, H, Q] and you recalled [F, ?, Q], you would get 2 points for that set. The maximum possible score is 75."
                                },
                                {
                                    q: "What is Math Accuracy?",
                                    a: "Math Accuracy refers to how accurately you solved the math equations presented between each letter. The 85% threshold is a standard check used in research. If your accuracy is below 85%, it might suggest you were focusing too much on remembering the letters and not enough on accurately solving the math problems, which can compromise the validity of the score."
                                },
                                {
                                    q: "Can I pause the task?",
                                    a: "No. Once an assessment or familiarization session starts, it cannot be paused or stopped. Working memory tasks require sustained attention and focus. Pausing would disrupt the cognitive processes being measured and invalidate the results. Please ensure you have dedicated, uninterrupted time before starting (~5 minutes for familiarization, ~20 minutes for the monthly assessment)."
                                }
                            ].map((faq, index) => (
                                <details key={index} className="group border-b border-theme-line last:border-b-0">
                                    <summary className="flex justify-between items-center cursor-pointer list-none py-4 hover:bg-theme-bg-elevated/30 px-2 -mx-2 transition-colors">
                                        <span className="text-base text-theme-text font-serif">{faq.q}</span>
                                        <span className="transition-transform group-open:rotate-180 ml-4 flex-shrink-0">
                                            <svg className="fill-current h-4 w-4 text-theme-text-muted" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                            </svg>
                                        </span>
                                    </summary>
                                    <div className="pb-4 px-2 -mx-2">
                                        <p className="text-sm text-theme-text-secondary leading-relaxed">{faq.a}</p>
                                    </div>
                                </details>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
            </>
            )}

            {/* =================================================================
                CONFIRMATION MODAL
               ================================================================= */}
            <ConfirmationModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onConfirm={handleConfirmStart}
                title={isConfirmingFamiliarization ? "Start Familiarization Session" : (isEarlyRetake ? "Early Retake" : "Start Monthly Assessment")}
                confirmColor="amber"
                confirmText={isConfirmingFamiliarization ? "Start Practice" : "Start Assessment"}
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
                            You're about to start a <strong className="text-theme-text">familiarization session</strong> for the Operation Span task.
                            This practice session will help you understand how the task works without affecting your official scores.
                        </p>
                        <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-4">
                            <p className="text-sm text-theme-text-secondary">
                                <FontAwesomeIcon icon={faInfoCircle} className="text-theme-accent mr-2" />
                                This practice session cannot be paused once started and will take approximately 5 minutes.
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
                                    Taking assessments too frequently can inflate scores due to practice effects, making it harder to detect genuine changes in working memory. We recommend waiting until {eligibilityStatus.nextAvailableDateString || 'the recommended date'}.
                                </p>
                            </div>
                        )}
                        <p className="text-theme-text-secondary text-sm">
                            You're about to start your <strong className="text-theme-text">monthly Operation Span assessment</strong>. Your score will be recorded. We recommend waiting 30 days between assessments for reliable progress tracking.
                        </p>
                        <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-4">
                            <p className="text-sm text-theme-text-secondary">
                                <FontAwesomeIcon icon={faInfoCircle} className="text-theme-accent mr-2" />
                                Allow ~15&ndash;20 minutes of uninterrupted focus. The assessment cannot be paused once started.
                            </p>
                        </div>
                    </div>
                )}
            </ConfirmationModal>
        </div>
    );
};

export default OperationSpanSummaryPage;

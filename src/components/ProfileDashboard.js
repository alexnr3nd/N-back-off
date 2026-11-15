/* File: src\components\ProfileDashboard.js */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import { useGame } from '../contexts/GameContext';
import './animations.css';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine, faList, faArrowRight, faBook, faPlay, faCrosshairs, faFire, faChevronUp, faChevronDown, faLink } from '@fortawesome/free-solid-svg-icons';
import OfflineSaveBanner from './ui/OfflineSaveBanner';

// --- Import AudioManager ---
import audioManager from '../utils/audioManager';

// --- Import dashboard sub-components ---
import TrainingIntensity from './dashboard/TrainingIntensity';
import TodaysStats from './dashboard/TodaysStats';
import WeeklyStats from './dashboard/WeeklyStats';
import MonthlyStats from './dashboard/MonthlyStats';
import AllTimeStats from './dashboard/AllTimeStats';
import DailyPerformanceChart from './dashboard/DailyPerformanceChart'; // Updated component
import SessionsTable from './dashboard/SessionsTable';
import ModeSelector from './dashboard/ModeSelector';
import StatsFilter from './dashboard/StatsFilter';
import TrainingModeFilter from './dashboard/TrainingModeFilter';
import ReadinessIndicator from './dashboard/ReadinessIndicator';
import StartFailureNotice from './dashboard/StartFailureNotice';
import { formatCombinedDifficulty } from '../contexts/gameHelpers';
import { useReadinessScore } from '../hooks/useReadinessScore';
import { MODE_FILTER_OPTIONS, SINGLE_MODE_OPTIONS, SINGLE_MODE_KEYS, MODE_FILTER_COLORS, MODE_MODALITIES, MODE_LABELS } from '../constants/modeStyles';
import { useIsMobile } from '../utils/useIsMobile';

// --- Import date utils ---
// Keep these if needed for streak calculation, etc.
import { isDateToday, isDateYesterday, isSameDay, differenceInDays, isDateTodayInTimezone } from '../utils/dateUtils';
import { getWeeklyCompletionCount } from '../utils/weeklyTrackerUtils';
import { formatTotalDuration, formatTotalDurationAria } from './dashboard/utils/formatters';

// --- Import Loading Indicators ---
import ButtonSpinner from './ui/ButtonSpinner';

// --- Import Tutorial Orchestrator ---
import TutorialOrchestrator from './tutorial/TutorialOrchestrator';

// --- Import useSettings ---
// Make sure useSettings is imported if not already
import { useSettings } from '../contexts/SettingsContext'; // Needed for timezone and audio preload
import { auth, functions as functionsInstance } from '../firebaseConfig';
import { httpsCallable } from 'firebase/functions';

// --- Import Stripe Price IDs for conversion tracking ---
import { PRICE_IDS } from '../constants/stripeConstants';

// --- Import Presence Context ---
import { usePresence } from '../contexts/PresenceContext';

// --- Import Cohort Components ---
import CohortDashboardCard from './program/CohortDashboardCard';
import CohortPromptBanner from './program/CohortPromptBanner';
import AppDownloadBanner from './ui/AppDownloadBanner';
import SubscriptionSuccessModal from './ui/SubscriptionSuccessModal';
import FreeTrialOfferModal from './ui/FreeTrialOfferModal';
import DailyCapModal from './ui/DailyCapModal';
import DailyCapCounterChip from './upsell/DailyCapCounterChip';
import { DAILY_ADAPTIVE_CAP } from '../constants/gameConstants';
import { trackEvent } from '../utils/analyticsTracker';
import { useUpgradeModalRollout } from '../hooks/useUpgradeModalRollout';
import { useDailyCapStatus } from '../hooks/useDailyCapStatus';
import { useUpgradeModal } from '../hooks/useUpgradeModal';
import CheckoutRecoveryBanner, { CHECKOUT_RECOVERY_KEY } from './ui/CheckoutRecoveryBanner';
import { recordUpgradeModalImpressionFn, recordUpgradeModalDismissFn } from '../contexts/user/userCloudFunctions';
import FreeTrialEndedModal from './ui/FreeTrialEndedModal';
import ContinuousModeStartModal from './game/ContinuousModeStartModal';
import { activateFreeTrialFn, declineFreeTrialFn, markFreeTrialExpirySeenFn } from '../contexts/user/userCloudFunctions';

const DEFAULT_TIMEZONE = 'UTC'; // Fallback timezone

// Mirrors ProTrialUpgradeModal.propTypes.trigger — the backend rejects anything else,
// so an unknown uc_trigger (e.g. from an older bundle) is tracked in GA4 only.
const UPGRADE_MODAL_TRIGGERS = [
    'game_1', 'recurring', 'reengagement', 'chart_paywall', 'try_it_free', 'daily_cap',
    'continuous_locked', 'sidebar_counter', 'start_card_counter', 'assessment_locked', 'checkout_recovery',
];

// Detect iOS devices for silent mode warning
const getIsIOS = () => {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

/**
 * ProfileDashboard Component - Main content for the dashboard route.
 * Displays profile info, stats, session history, and actions.
 * Coordinates starting a game and navigating to the game screen.
 * Includes logic to resume AudioContext on user interaction for mobile compatibility.
 * *** Uses user's timezone for the DailyPerformanceChart. ***
 */
const ProfileDashboard = () => {
    // --- HOOKS ---
    const {
        userId,
        userData,
        isDataReady,
        activeSessions,
        getCurrentModeProgression,
        getClassicModeProgression,
        // Note: isLoading from ProfileContext is handled by AuthGuard
        updateProfileProgress,
        activeGameMode,
        checkSubscription,
        dailyStats, // Pre-aggregated daily stats for Today/Week/Month views
        allTimeDailyStats, // All-time daily stats for "All" view
        fetchAllTimeData, // Trigger fetch for all-time data
        userSubscriptionPriceId, // For Google Ads conversion tracking
        userSubscriptionStatus,  // For Google Ads conversion tracking
        subscriptionTier,        // 'free' or 'premium'
        coachGrantedPremium,
        preMonetizationChange,
        freeTrialUsed, freeTrialDeclined, freeTrialExpired, freeTrialExpirySeen,
        isInFreeTrial, canStartFreeTrial,
        setFreeTrialUsed, setFreeTrialDeclined, setFreeTrialExpirySeen,
        setSubscriptionTier, setUserSubscriptionStatus, setFreeTrialEnd,
        showFreeTrialOffer, setShowFreeTrialOffer,
        setTotalSessions,
        isAdaptiveUser, grandfatherDaysRemaining,
        authUser,
        // Pro-trial upgrade modal state — modal mount lives in SidebarLayout.
        // We still need to read showProTrialUpgradeModal to suppress overlapping
        // game_1 / reengagement fires, and the setters to flip global state.
        showProTrialUpgradeModal, setShowProTrialUpgradeModal,
        setProTrialUpgradeModalTrigger,
        updateUpgradeModalStateLocally,
        adaptiveGrandfatherExpiry, isInLifetimeTrial,
        totalSessions,
        // Free-tier cohort + daily Adaptive cap (relaunch monetization, May 2026)
        isPaidPro, isFullAdaptive, hasClassicAccess, freeTier,
        showDailyCapModal, setShowDailyCapModal,
        dailyCapInfo, setDailyCapInfo,
        pendingOfflineCapRejection, setPendingOfflineCapRejection,
    } = useUser();
    const { isUserAllowed: upgradeRolloutAllowed } = useUpgradeModalRollout();
    const { openUpgradeModal } = useUpgradeModal();
    const { startGame, setSaveToProfile, gameState, setNavigationHandler, setGameOrigin, startContinuousChain, resetContinuousChainState, startFailureMessage, setStartFailureMessage } = useGame();
    const { clearUpgradePromptState } = usePresence() || {};
    const navigate = useNavigate();
    const location = useLocation();

    // --- Track if we're waiting for conversion data after Stripe checkout ---
    const pendingConversionRef = useRef(false);

    // --- Subscription success modal state ---
    const [showSubscriptionSuccess, setShowSubscriptionSuccess] = useState(false);

    // --- Gifted Pro access modal state ---
    const [isTrialLoading, setIsTrialLoading] = useState(false);

    // --- Abandoned-checkout recovery flag (survives navigation within the session) ---
    const [checkoutRecoveryFlag, setCheckoutRecoveryFlag] = useState(() => {
        try { return sessionStorage.getItem(CHECKOUT_RECOVERY_KEY); } catch { return null; }
    });

    // --- Check subscription status when returning from Stripe checkout ---
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const sessionId = searchParams.get('session_id');
        const showUpgrade = searchParams.get('showUpgrade');
        const newTrial = searchParams.get('new_trial');
        const upgradeCancelled = searchParams.get('upgrade_cancelled');
        const ucTrigger = searchParams.get('uc_trigger');

        // Clear presence checkout/declined state when returning from Stripe
        if ((sessionId || showUpgrade) && clearUpgradePromptState) {
            clearUpgradePromptState();
        }

        // Stripe Checkout returns with new_trial=1 when the new CC trial was granted.
        // Stash the flag so the success modal can use trial-specific copy if it wants to.
        if (newTrial === '1') {
            sessionStorage.setItem('newTrialJustStarted', 'true');
        }

        let strippedParams = false;

        if (sessionId && checkSubscription) {
            pendingConversionRef.current = true; // Mark that we need to fire conversion
            checkSubscription();

            // Clean up the URL by removing session_id and new_trial params
            searchParams.delete('session_id');
            searchParams.delete('new_trial');
            strippedParams = true;
        }

        // Stripe cancelUrl round-trip — the user reached checkout and backed out.
        if (upgradeCancelled === '1') {
            trackEvent('checkout_abandoned', { trigger: ucTrigger || 'unknown' });
            // Older bundles send no uc_trigger; the backend would reject an invalid one.
            if (ucTrigger && UPGRADE_MODAL_TRIGGERS.includes(ucTrigger) && recordUpgradeModalDismissFn) {
                recordUpgradeModalDismissFn({ trigger: ucTrigger, dismissType: 'checkout_abandoned' }).catch(err => {
                    console.warn('[ProfileDashboard] recordUpgradeModalDismiss checkout_abandoned failed:', err?.message);
                });
            }
            const flag = ucTrigger || '1';
            try { sessionStorage.setItem(CHECKOUT_RECOVERY_KEY, flag); } catch {}
            setCheckoutRecoveryFlag(flag);

            searchParams.delete('upgrade_cancelled');
            searchParams.delete('uc_trigger');
            strippedParams = true;
        }

        if (strippedParams) {
            const newSearch = searchParams.toString();
            const newUrl = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    }, [location.search, location.pathname, checkSubscription, clearUpgradePromptState]);

    // --- Fire Google Ads conversion when subscription data is available after checkout ---
    useEffect(() => {
        // Only fire if we're waiting for a conversion and subscription is now active
        if (!pendingConversionRef.current) return;
        if (!userSubscriptionStatus || !['active', 'trialing'].includes(userSubscriptionStatus)) return;

        // Determine conversion value based on price ID
        let conversionValue = 0;
        let currency = 'USD';

        if (userSubscriptionPriceId === PRICE_IDS.monthly) {
            conversionValue = 4.99;
        } else if (userSubscriptionPriceId === PRICE_IDS.yearly) {
            conversionValue = 39.99;
        }

        // Fire the Google Ads conversion event
        if (typeof window.gtag === 'function' && conversionValue > 0) {
            window.gtag('event', 'conversion', {
                'send_to': 'AW-17794627542/Y32PCNz7tdkbENbvkaVC',
                'value': conversionValue,
                'currency': currency,
            });
        } else if (conversionValue === 0) {
            console.warn('[ProfileDashboard] Could not determine conversion value from priceId:', userSubscriptionPriceId);
        }

        // Set flag for subscription success modal (Stripe flow)
        sessionStorage.setItem('subscriptionJustCompleted', 'true');

        // Clear the pending flag so we don't fire again
        pendingConversionRef.current = false;
    }, [userSubscriptionStatus, userSubscriptionPriceId]);

    // --- Show subscription success modal (unified consumer for Stripe + RevenueCat) ---
    useEffect(() => {
        if (!userSubscriptionStatus || !['active', 'trialing'].includes(userSubscriptionStatus)) return;
        // Checkout completed — retire any abandoned-checkout recovery flag.
        try { sessionStorage.removeItem(CHECKOUT_RECOVERY_KEY); } catch {}
        setCheckoutRecoveryFlag(null);
        const justSubscribed = sessionStorage.getItem('subscriptionJustCompleted');
        if (justSubscribed === 'true') {
            sessionStorage.removeItem('subscriptionJustCompleted');
            setShowSubscriptionSuccess(true);
        }
    }, [userSubscriptionStatus]);

    // --- Auto-show gifted Pro access offer when eligible ---
    // Suppressed for users in the new CC-trial beta cohort (they get ProTrialUpgradeModal instead).
    useEffect(() => {
        if (upgradeRolloutAllowed) return; // beta cohort — gift modal is replaced by ProTrialUpgradeModal
        if (canStartFreeTrial && !freeTrialDeclined && !showFreeTrialOffer) {
            setShowFreeTrialOffer(true);
        }
    }, [canStartFreeTrial, freeTrialDeclined, showFreeTrialOffer, setShowFreeTrialOffer, upgradeRolloutAllowed]);

    // --- Game-1 fallback: if user navigated away from results without seeing the modal ---
    // Triggers ProTrialUpgradeModal on dashboard load for new free users who completed
    // their first session but skipped the in-game-results trigger.
    useEffect(() => {
        if (!isDataReady || !userId) return;
        if (!upgradeRolloutAllowed) return;
        if (subscriptionTier !== 'free' || coachGrantedPremium) return;
        if (totalSessions !== 1) return;
        if (userData?.upgradeModalGameOneShown) return;
        const grandfathered = adaptiveGrandfatherExpiry && new Date(adaptiveGrandfatherExpiry) > new Date();
        if (grandfathered) return;
        if (isInFreeTrial || isInLifetimeTrial) return;
        if (showFreeTrialOffer || showProTrialUpgradeModal) return;

        // Fire fallback
        setProTrialUpgradeModalTrigger('game_1');
        setShowProTrialUpgradeModal(true);
        if (recordUpgradeModalImpressionFn) {
            recordUpgradeModalImpressionFn({ trigger: 'game_1', fromFallback: true }).catch(err => {
                console.warn('[ProfileDashboard] recordUpgradeModalImpression fallback failed:', err?.message);
            });
        }
        if (updateUpgradeModalStateLocally) {
            updateUpgradeModalStateLocally({
                upgradeModalGameOneShown: true,
                upgradeModalLastShownAt: new Date().toISOString(),
                upgradeModalLastTrigger: 'game_1',
            });
        }
    }, [
        isDataReady, userId, upgradeRolloutAllowed,
        subscriptionTier, coachGrantedPremium, totalSessions,
        userData?.upgradeModalGameOneShown,
        adaptiveGrandfatherExpiry, isInFreeTrial, isInLifetimeTrial,
        showFreeTrialOffer, showProTrialUpgradeModal,
        setProTrialUpgradeModalTrigger, setShowProTrialUpgradeModal, updateUpgradeModalStateLocally,
    ]);

    // --- Re-engagement modal: dashboard load after 14+ day gap ---
    // Fires once per gap (tracked via upgradeModalReengagementShownForGap = lastSessionAt snapshot).
    useEffect(() => {
        if (!isDataReady || !userId) return;
        if (!upgradeRolloutAllowed) return;
        if (subscriptionTier !== 'free' || coachGrantedPremium) return;
        if (!userData?.lastSessionAt) return; // brand-new accounts excluded
        const grandfathered = adaptiveGrandfatherExpiry && new Date(adaptiveGrandfatherExpiry) > new Date();
        if (grandfathered) return;
        if (isInFreeTrial || isInLifetimeTrial) return;
        if (showFreeTrialOffer || showProTrialUpgradeModal) return;

        const lastSessionDate = new Date(userData.lastSessionAt);
        const gapDays = (Date.now() - lastSessionDate.getTime()) / (1000 * 60 * 60 * 24);
        if (gapDays < 14) return;

        // Don't re-fire for the same gap (compare ISO strings; they match exactly)
        if (userData.upgradeModalReengagementShownForGap === userData.lastSessionAt) return;

        // Suppression check
        const suppressed = userData.upgradeModalSuppressedUntil &&
            new Date(userData.upgradeModalSuppressedUntil) > new Date();
        if (suppressed) return;

        // Fire re-engagement modal
        setProTrialUpgradeModalTrigger('reengagement');
        setShowProTrialUpgradeModal(true);
        if (recordUpgradeModalImpressionFn) {
            recordUpgradeModalImpressionFn({ trigger: 'reengagement', lastSessionAt: userData.lastSessionAt }).catch(err => {
                console.warn('[ProfileDashboard] recordUpgradeModalImpression reengagement failed:', err?.message);
            });
        }
        if (updateUpgradeModalStateLocally) {
            updateUpgradeModalStateLocally({
                upgradeModalLastShownAt: new Date().toISOString(),
                upgradeModalLastTrigger: 'reengagement',
                upgradeModalReengagementShownForGap: userData.lastSessionAt,
            });
        }
    }, [
        isDataReady, userId, upgradeRolloutAllowed,
        subscriptionTier, coachGrantedPremium,
        userData?.lastSessionAt, userData?.upgradeModalReengagementShownForGap, userData?.upgradeModalSuppressedUntil,
        adaptiveGrandfatherExpiry, isInFreeTrial, isInLifetimeTrial,
        showFreeTrialOffer, showProTrialUpgradeModal,
        setProTrialUpgradeModalTrigger, setShowProTrialUpgradeModal, updateUpgradeModalStateLocally,
    ]);

    // --- Get Settings (for timezone and audio preload) ---
    const { settings, updateSetting } = useSettings();
    // Date-aware daily Adaptive cap status (effective count resets at local midnight).
    const { atCap: isDailyCapReached, used: dailyAdaptiveUsedToday } = useDailyCapStatus();

    // --- Get Readiness Score (Bayesian fatigue detection) ---
    const {
        score: readinessScore,
        components: readinessComponents,
        sessionCount: readinessSessionCount,
        isLoading: isLoadingReadiness,
        error: readinessError
    } = useReadinessScore(activeGameMode);

    // Effect to set navigation handler for GameContext
    useEffect(() => {
        if (setNavigationHandler) {
            setNavigationHandler(navigate);
        }
        return () => {
            if (setNavigationHandler) {
                setNavigationHandler(null); // Clean up
            }
        };
    }, [setNavigationHandler, navigate]);


    // --- Unified period state (controls both Stats and Chart) ---
    const [globalPeriod, setGlobalPeriodRaw] = useState('today');

    // --- State for N-Back Level Editing ---
    const [isSavingNBack, setIsSavingNBack] = useState(false);

    // --- State for Protocol Guide Modal ---
    const [showProtocolGuide, setShowProtocolGuide] = useState(false);

    // --- State for Start Training Button ---
    const [isStartingGame, setIsStartingGame] = useState(false);
    const [isDownloadBannerVisible, setIsDownloadBannerVisible] = useState(false);

    // --- Continuous Mode pre-start modal: null when closed, 'adaptive' or 'classic' when open. ---
    const [continuousModalOpen, setContinuousModalOpen] = useState(null);

    // --- In-card protocol toggle on the Training card (Adaptive | Classic) ---
    // Drives both the Start Session CTA and the Continuous CTA. Default = the
    // protocol of the user's most recent session (so classic_legacy users who've
    // only ever played Classic don't get jumped to Adaptive on first visit).
    // Only persists to localStorage when the user explicitly toggles; the auto-
    // default from session history is non-sticky so it always reflects their
    // actual recent play. limited_modern users see no toggle and always start
    // Adaptive (forced via effectiveProtocol below).
    const [selectedTrainingMode, setSelectedTrainingModeState] = useState(() => {
        if (typeof window === 'undefined') return null;
        const stored = window.localStorage.getItem('dashboardProtocolChoice');
        return (stored === 'adaptive' || stored === 'classic') ? stored : null;
    });

    // Auto-default to last-played protocol once sessions load.
    useEffect(() => {
        if (selectedTrainingMode !== null) return; // user already has an explicit choice
        if (!isDataReady) return;                  // wait for session listener
        if (!Array.isArray(activeSessions) || activeSessions.length === 0) {
            setSelectedTrainingModeState('adaptive'); // no history → default Adaptive
            return;
        }
        // activeSessions is fed by the subcollection listener; sort defensively by date desc.
        const sorted = [...activeSessions].sort((a, b) => {
            const aDate = a?.date?.toDate ? a.date.toDate() : new Date(a?.date || 0);
            const bDate = b?.date?.toDate ? b.date.toDate() : new Date(b?.date || 0);
            return bDate - aDate;
        });
        const recent = sorted.find(s => s?.trainingMode === 'classic' || s?.trainingMode === 'adaptive');
        setSelectedTrainingModeState(recent?.trainingMode || 'adaptive');
    }, [selectedTrainingMode, isDataReady, activeSessions]);

    // Wrap the setter so localStorage is only written on explicit user toggles.
    const setSelectedTrainingMode = useCallback((mode) => {
        setSelectedTrainingModeState(mode);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('dashboardProtocolChoice', mode);
        }
    }, []);

    // --- Unified filter bar state (persisted to localStorage) ---
    const [globalMode, setGlobalModeRaw] = useState(() => localStorage.getItem('globalModeFilter') || 'all');
    const [globalTrainingType, setGlobalTrainingTypeRaw] = useState(() => localStorage.getItem('globalTrainingMode') || 'adaptive');
    const setGlobalMode = useCallback((v) => { setGlobalModeRaw(v); localStorage.setItem('globalModeFilter', v); }, []);
    const setGlobalTrainingType = useCallback((v) => { setGlobalTrainingTypeRaw(v); localStorage.setItem('globalTrainingMode', v); }, []);

    const [isFilterStuck, setIsFilterStuck] = useState(false);
    const filterSentinelRef = useRef(null);
    const sentinelSeenRef = useRef(false);

    // Collapse state for the sticky filter bar. Only takes effect while stuck —
    // when the filter is inline at the top of the page it always renders expanded.
    // Default is collapsed: by the time the bar has pinned, the user has usually
    // already picked their filters and scrolled down to look at data, so giving
    // them viewing space upfront is the better default. Explicit 'false' opts out.
    const [isFilterCollapsed, setIsFilterCollapsedRaw] = useState(() => localStorage.getItem('filterPanelCollapsed') !== 'false');
    const setIsFilterCollapsed = useCallback((v) => {
        setIsFilterCollapsedRaw(v);
        localStorage.setItem('filterPanelCollapsed', v ? 'true' : 'false');
    }, []);
    const isMobile = useIsMobile();

    useEffect(() => {
        const sentinel = filterSentinelRef.current;
        if (!sentinel) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    sentinelSeenRef.current = true;
                    setIsFilterStuck(false);
                } else if (sentinelSeenRef.current) {
                    setIsFilterStuck(true);
                }
            },
            { threshold: 0 }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, []);

    // --- Auto-select filter based on training mode + Dynamic sub-mode ---
    // Refs start as null so first mount always triggers sync (overrides stale localStorage)
    const prevGameModeRef = useRef(null);
    const prevSubModeRef = useRef(null);
    useEffect(() => {
        const currentSubMode = activeGameMode === 'dynamic'
            ? (userData?.modeProgression?.dynamic?.currentSubMode || 'dual')
            : null;
        const targetFilter = activeGameMode === 'dynamic' ? currentSubMode : activeGameMode;

        const modeChanged = activeGameMode !== prevGameModeRef.current;
        const subModeChanged = activeGameMode === 'dynamic' && currentSubMode !== prevSubModeRef.current;

        if (modeChanged || subModeChanged) {
            prevGameModeRef.current = activeGameMode;
            prevSubModeRef.current = currentSubMode;
            if (targetFilter) {
                setGlobalMode(targetFilter);
            }
        }
    }, [activeGameMode, userData?.modeProgression?.dynamic?.currentSubMode, setGlobalMode]);

    // --- State for Daily Reminder Preferences ---
    const [reminderPrefs, setReminderPrefs] = useState(null);
    const [isLoadingReminders, setIsLoadingReminders] = useState(true);

    // --- iOS Silent Mode Warning (dismissible via localStorage) ---
    const isIOS = useMemo(() => getIsIOS(), []);
    const [showIOSWarning, setShowIOSWarning] = useState(() => {
        if (!getIsIOS()) return false;
        return localStorage.getItem('ios-silent-warning-dismissed') !== 'true';
    });
    const dismissIOSWarning = useCallback(() => {
        setShowIOSWarning(false);
        localStorage.setItem('ios-silent-warning-dismissed', 'true');
    }, []);

    // --- User Timezone ---
    // Get timezone from settings context, fallback to UTC
    const userTimezone = useMemo(() => {
        // Ensure settings object and timezone property exist
        return settings?.timezone || DEFAULT_TIMEZONE;
    }, [settings?.timezone]);


    // --- Streak Calculation (Memoized - No change needed here) ---
    const dailyStreak = useMemo(() => {
        // Logic remains the same, uses browser local time via isDateToday/isDateYesterday
        if (!activeSessions || activeSessions.length === 0) return 0;
        const validSessions = activeSessions
            .map(s => ({ ...s, dateObj: s.date ? new Date(s.date) : null }))
            .filter(s => s.dateObj instanceof Date && !isNaN(s.dateObj));
        if (validSessions.length === 0) return 0;
        const sortedSessions = validSessions.sort((a, b) => b.dateObj - a.dateObj);
        const mostRecentSessionDate = sortedSessions[0].dateObj;

        // Use isDateToday/isDateYesterday which rely on the system's local time for streak logic
        const today = new Date();
        const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);

        const isRecent = isSameDay(mostRecentSessionDate, today) || isSameDay(mostRecentSessionDate, yesterday);

        if (!isRecent) {
            return 0; // Not today or yesterday
        }

        let currentStreak = 1; // Start at 1 if the most recent was today or yesterday
        let lastUniqueDayProcessed = mostRecentSessionDate;

        for (let i = 1; i < sortedSessions.length; i++) {
            const sessionDate = sortedSessions[i].dateObj;
            // Skip sessions from the same day we already counted
            if (isSameDay(sessionDate, lastUniqueDayProcessed)) {
                continue;
            }
            // Calculate the difference in days
            const dayDiff = differenceInDays(sessionDate, lastUniqueDayProcessed);
            // If the difference is exactly 1 day, it's a consecutive day
            if (dayDiff === 1) {
                currentStreak++;
                lastUniqueDayProcessed = sessionDate; // Update the last day processed
            } else {
                // If the difference is not 1, the streak is broken
                break;
            }
        }
        return currentStreak;
    }, [activeSessions]);

    // --- Sessions Today (timezone-aware) ---
    // Count all sessions that fall on today in the user's saved timezone.
    // Covers every training mode (Classic/Adaptive) and game mode (dual/triple/quad/dynamic)
    // because all sessions live in the same users/{uid}/sessions subcollection.
    const sessionsToday = useMemo(() => {
        const sessions = activeSessions || [];
        if (sessions.length === 0) return 0;
        return sessions.filter(s => isDateTodayInTimezone(s.date, userTimezone)).length;
    }, [activeSessions, userTimezone]);

    // --- Time Trained Today (timezone-aware) ---
    // Sum durationMs of today's sessions from the SAME activeSessions source as
    // the count above, so the displayed time can never diverge from the count.
    const timeTrainedTodayMs = useMemo(() => {
        const sessions = activeSessions || [];
        if (sessions.length === 0) return 0;
        return sessions
            .filter(s => isDateTodayInTimezone(s.date, userTimezone))
            .reduce((sum, s) => sum + (s.durationMs || 0), 0);
    }, [activeSessions, userTimezone]);

    // --- Fetch Reminder Preferences ---
    useEffect(() => {
        const fetchReminderPrefs = async () => {
            if (!functionsInstance || !auth.currentUser) {
                setIsLoadingReminders(false);
                return;
            }
            try {
                const getNotificationPreferencesFn = httpsCallable(functionsInstance, 'getNotificationPreferences');
                const result = await getNotificationPreferencesFn();
                if (result.data) {
                    setReminderPrefs({
                        enabled: result.data.enabled ?? false,
                        timeBlock: result.data.timeBlock ?? 'morning',
                        daysOfWeek: result.data.daysOfWeek ?? [1, 2, 3, 4, 5],
                    });
                }
            } catch (error) {
                console.error('[ProfileDashboard] Error fetching reminder preferences:', error);
            } finally {
                setIsLoadingReminders(false);
            }
        };
        fetchReminderPrefs();
    }, []);

    // --- Format Reminder Schedule for Display ---
    const reminderScheduleText = useMemo(() => {
        if (!reminderPrefs?.enabled) return null;

        const timeLabels = { morning: '8:00 AM', afternoon: '2:00 PM', evening: '7:00 PM' };
        const timeLabel = timeLabels[reminderPrefs.timeBlock] || '8:00 AM';

        const days = (reminderPrefs.daysOfWeek || []).sort((a, b) => a - b);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        let daysLabel;
        if (days.length === 7) {
            daysLabel = 'daily';
        } else if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) {
            daysLabel = 'weekdays';
        } else if (days.length === 2 && [0, 6].every(d => days.includes(d))) {
            daysLabel = 'weekends';
        } else if (days.length === 1) {
            daysLabel = dayNames[days[0]];
        } else {
            // Check if days are consecutive
            const isConsecutive = days.every((day, i) => i === 0 || day === days[i - 1] + 1);
            if (isConsecutive && days.length >= 2) {
                daysLabel = `${dayNames[days[0]]}-${dayNames[days[days.length - 1]]}`;
            } else {
                // Non-consecutive: list them
                daysLabel = days.map(d => dayNames[d]).join(', ');
            }
        }

        return `${timeLabel}, ${daysLabel}`;
    }, [reminderPrefs]);

    // Recall Mode is active when the Color mode is selected AND the Recall response
    // mode is set. It reads/writes the separate 'singleColorRecall' progression track,
    // so level displays and the Classic override below must target that key.
    // Continuous chains deliberately stay on Match (gameSetup is the authority).
    const isRecallActive = activeGameMode === 'singleColor' && settings?.responseModes?.singleColor === 'recall';
    const progressionModeKey = isRecallActive ? 'singleColorRecall' : undefined;


    // --- CALLBACKS ---
    const handleStandardPlay = useCallback(async () => {
        // Standard play logic remains the same, uses settings?.selectedVoiceId
        if (!isDataReady) { console.warn("[ProfileDashboard] Cannot start game: Data not ready."); return; }
        const modeProgress = getCurrentModeProgression();
        setIsStartingGame(true);
        try { audioManager.init(); const audioResumed = await audioManager.resume(); if (audioResumed) { const voiceId = settings?.selectedVoiceId || Object.keys(audioManager.VOICES)[0]; audioManager.preload({ voiceId: voiceId, difficulties: [0.05] }); } else { console.warn("[ProfileDashboard] Audio context could NOT be resumed via button click."); }
        } catch (error) { console.error("[ProfileDashboard] Error occurred while attempting to resume audio context:", error); setIsStartingGame(false); return; }
        setSaveToProfile(true);
        setGameOrigin('/dashboard');
        startGame({ nBack: modeProgress.currentNBack, difficulty: modeProgress.currentDifficulty });
    }, [isDataReady, getCurrentModeProgression, setSaveToProfile, startGame, setGameOrigin, settings?.selectedVoiceId]);

    // --- Classic/Adaptive Training Handlers ---
    const handleStartClassic = useCallback(async () => {
        if (!isDataReady) return;
        // Classic Recall reads the recall track's Classic level, not singleColor's.
        const classicProg = getClassicModeProgression(progressionModeKey);
        setIsStartingGame(true);
        try {
            audioManager.init();
            const audioResumed = await audioManager.resume();
            if (audioResumed) {
                const voiceId = settings?.selectedVoiceId || Object.keys(audioManager.VOICES)[0];
                audioManager.preload({ voiceId, difficulties: [0.05] });
            }
        } catch (error) {
            console.error("[ProfileDashboard] Audio resume error:", error);
            setIsStartingGame(false);
            return;
        }
        // Defensive: clear any stale continuous-chain state so the in-game Stop button
        // doesn't appear during this regular session.
        if (typeof resetContinuousChainState === 'function') resetContinuousChainState();
        setSaveToProfile(true);
        setGameOrigin('/dashboard');
        localStorage.setItem('trainingIntensityViewMode', 'classic');
        startGame({ trainingMode: 'classic', overrideNBack: classicProg.currentNBack, overrideDifficulty: 0.50 });
    }, [isDataReady, getClassicModeProgression, progressionModeKey, setSaveToProfile, startGame, setGameOrigin, settings?.selectedVoiceId, resetContinuousChainState]);

    const handleStartAdaptive = useCallback(async () => {
        if (!isDataReady) return;
        // --- Pre-start cap gate (capped cohorts only) ---
        // Backend is the source of truth, but the dashboard gates Start to avoid
        // sending the user into a game that will fail to save (better UX than the
        // post-save modal alone).
        if (!isFullAdaptive && isDailyCapReached) {
            if (typeof setDailyCapInfo === 'function') {
                setDailyCapInfo({ sessionsUsed: dailyAdaptiveUsedToday, dailyCap: DAILY_ADAPTIVE_CAP, source: 'pre_start' });
            }
            if (typeof setShowDailyCapModal === 'function') {
                setShowDailyCapModal(true);
            }
            trackEvent('daily_cap_pre_start_blocked', { sessionsUsed: dailyAdaptiveUsedToday });
            return;
        }
        const modeProgress = getCurrentModeProgression();
        setIsStartingGame(true);
        try {
            audioManager.init();
            const audioResumed = await audioManager.resume();
            if (audioResumed) {
                const voiceId = settings?.selectedVoiceId || Object.keys(audioManager.VOICES)[0];
                audioManager.preload({ voiceId, difficulties: [0.05] });
            }
        } catch (error) {
            console.error("[ProfileDashboard] Audio resume error:", error);
            setIsStartingGame(false);
            return;
        }
        // Defensive: clear any stale continuous-chain state so the in-game Stop button
        // doesn't appear during this regular session.
        if (typeof resetContinuousChainState === 'function') resetContinuousChainState();
        setSaveToProfile(true);
        setGameOrigin('/dashboard');
        localStorage.setItem('trainingIntensityViewMode', 'adaptive');
        startGame({ trainingMode: 'adaptive' });
    }, [isDataReady, getCurrentModeProgression, setSaveToProfile, startGame, setGameOrigin, settings?.selectedVoiceId, resetContinuousChainState, isFullAdaptive, isDailyCapReached, dailyAdaptiveUsedToday, setDailyCapInfo, setShowDailyCapModal]);

    const handleStartTrial = useCallback(() => {
        setProTrialUpgradeModalTrigger('try_it_free');
        setShowProTrialUpgradeModal(true);
        if (recordUpgradeModalImpressionFn) {
            recordUpgradeModalImpressionFn({ trigger: 'try_it_free' }).catch(err => {
                console.warn('[ProfileDashboard] recordUpgradeModalImpression try_it_free failed:', err?.message);
            });
        }
        if (updateUpgradeModalStateLocally) {
            updateUpgradeModalStateLocally({
                upgradeModalLastShownAt: new Date().toISOString(),
                upgradeModalLastTrigger: 'try_it_free',
            });
        }
    }, [setProTrialUpgradeModalTrigger, setShowProTrialUpgradeModal, updateUpgradeModalStateLocally]);

    // --- Continuous Mode launch handlers ---
    // The dashboard buttons open a pre-start modal that asks the user how many sessions to chain.
    // The actual chain start (audio init, chain state, startGame) happens in handleConfirmContinuousStart
    // when the user confirms in the modal.
    const handleStartContinuousAdaptive = useCallback(() => {
        if (!isDataReady) return;
        // NOTE: Recall is intentionally NOT resolved for chains — continuous blocks always
        // play Match, even when the Recall response mode is on. The guard in gameSetup
        // (isRecallSession excludes chain starts) is the authority; nothing to do here.
        // Continuous (chain) mode is free for everyone. Capped cohorts still spend
        // one Adaptive credit per chain block, so the same pre-start cap gate as
        // handleStartAdaptive applies — a chain started at the cap would fail to
        // save every block.
        if (!isFullAdaptive && isDailyCapReached) {
            if (typeof setDailyCapInfo === 'function') {
                setDailyCapInfo({ sessionsUsed: dailyAdaptiveUsedToday, dailyCap: DAILY_ADAPTIVE_CAP, source: 'pre_start' });
            }
            if (typeof setShowDailyCapModal === 'function') {
                setShowDailyCapModal(true);
            }
            trackEvent('daily_cap_pre_start_blocked', { sessionsUsed: dailyAdaptiveUsedToday });
            return;
        }
        setContinuousModalOpen('adaptive');
    }, [isDataReady, isFullAdaptive, isDailyCapReached, dailyAdaptiveUsedToday, setDailyCapInfo, setShowDailyCapModal]);

    const handleStartContinuousClassic = useCallback(() => {
        if (!isDataReady) return;
        // Continuous Classic lock: only users without Classic access at all (limited_modern)
        // get the paywall. classic_legacy and grandfathered+expired keep their unlimited
        // Classic Continuous — locking it wouldn't preserve any cap (Classic isn't capped),
        // it'd just take away an existing-user feature.
        if (!hasClassicAccess) {
            openUpgradeModal('continuous_locked', 'classic');
            return;
        }
        setContinuousModalOpen('classic');
    }, [isDataReady, hasClassicAccess, openUpgradeModal]);

    const handleConfirmContinuousStart = useCallback(async ({ targetBlocks }) => {
        const mode = continuousModalOpen;
        if (!mode || !isDataReady) return;
        setContinuousModalOpen(null); // close modal first; remaining work is async
        setIsStartingGame(true);
        try {
            audioManager.init();
            const audioResumed = await audioManager.resume();
            if (audioResumed) {
                const voiceId = settings?.selectedVoiceId || Object.keys(audioManager.VOICES)[0];
                audioManager.preload({ voiceId, difficulties: [0.05] });
            }
        } catch (error) {
            console.error(`[ProfileDashboard] Audio resume error (continuous ${mode}):`, error);
            setIsStartingGame(false);
            return;
        }
        setSaveToProfile(true);
        setGameOrigin('/dashboard');
        localStorage.setItem('trainingIntensityViewMode', mode);
        startContinuousChain({ targetBlocks, trainingMode: mode === 'classic' ? 'classic' : 'adaptive' });
        if (mode === 'classic') {
            const classicProg = getClassicModeProgression();
            startGame({ trainingMode: 'classic', overrideNBack: classicProg.currentNBack, overrideDifficulty: 0.50 });
        } else {
            startGame({ trainingMode: 'adaptive' });
        }
    }, [continuousModalOpen, isDataReady, getClassicModeProgression, setSaveToProfile, startGame, setGameOrigin, settings?.selectedVoiceId, startContinuousChain]);

    const handleCloseContinuousModal = useCallback(() => {
        setContinuousModalOpen(null);
    }, []);

    // --- Surface deferred daily-cap rejection from offline queue ---
    // If a queued session was rejected by the server with daily_cap while the dashboard
    // wasn't mounted, OfflineSaveContext stored a `pendingOfflineCapRejection` flag.
    // Open the modal once on mount, then clear the flag so it doesn't re-fire.
    useEffect(() => {
        if (pendingOfflineCapRejection) {
            if (typeof setDailyCapInfo === 'function') {
                setDailyCapInfo({
                    sessionsUsed: pendingOfflineCapRejection.sessionsUsed ?? DAILY_ADAPTIVE_CAP,
                    dailyCap: pendingOfflineCapRejection.dailyCap ?? DAILY_ADAPTIVE_CAP,
                    source: 'offline_retry',
                });
            }
            if (typeof setShowDailyCapModal === 'function') {
                setShowDailyCapModal(true);
            }
            if (typeof setPendingOfflineCapRejection === 'function') {
                setPendingOfflineCapRejection(null);
            }
        }
    }, [pendingOfflineCapRejection, setDailyCapInfo, setShowDailyCapModal, setPendingOfflineCapRejection]);

    // --- Gifted Pro Access Handlers ---
    const handleAcceptFreeTrial = useCallback(async () => {
        if (!activateFreeTrialFn || isTrialLoading) return;
        setIsTrialLoading(true);
        try {
            const result = await activateFreeTrialFn();
            if (result?.data?.success) {
                setSubscriptionTier('premium');
                setUserSubscriptionStatus('trialing');
                setFreeTrialEnd(new Date(result.data.freeTrialEnd));
                setFreeTrialUsed(true);
                setShowFreeTrialOffer(false);
            }
        } catch (error) {
            console.error('[ProfileDashboard] Error activating gifted Pro access:', error);
        } finally {
            setIsTrialLoading(false);
        }
    }, [isTrialLoading, setSubscriptionTier, setUserSubscriptionStatus, setFreeTrialEnd, setFreeTrialUsed, setShowFreeTrialOffer]);

    const handleDeclineFreeTrial = useCallback(async () => {
        if (!declineFreeTrialFn) return;
        try {
            await declineFreeTrialFn();
            setFreeTrialDeclined(true);
            setFreeTrialUsed(true);
            setShowFreeTrialOffer(false);
        } catch (error) {
            console.error('[ProfileDashboard] Error declining gifted Pro access:', error);
        }
    }, [setFreeTrialDeclined, setFreeTrialUsed, setShowFreeTrialOffer]);

    const handleDismissFreeTrial = useCallback(() => {
        setShowFreeTrialOffer(false);
    }, [setShowFreeTrialOffer]);

    const handleTrialEndedSubscribe = useCallback(() => {
        setFreeTrialExpirySeen(true);
        if (markFreeTrialExpirySeenFn) markFreeTrialExpirySeenFn().catch(() => {});
        navigate('/subscribe');
    }, [navigate, setFreeTrialExpirySeen]);

    const handleTrialEndedDismiss = useCallback(() => {
        setFreeTrialExpirySeen(true);
        if (markFreeTrialExpirySeenFn) markFreeTrialExpirySeenFn().catch(() => {});
    }, [setFreeTrialExpirySeen]);

    const setGlobalPeriod = useCallback((period) => {
        setGlobalPeriodRaw(period);
        if (period === 'all' && fetchAllTimeData) {
            fetchAllTimeData();
        }
    }, [fetchAllTimeData]);

    // --- Handler for Training Level Changes ---
    const handleLevelChange = useCallback(async (newNBack, newDifficulty, trainingMode) => {
        if (!userId || !updateProfileProgress) return;

        setIsSavingNBack(true);
        try {
            await updateProfileProgress(userId, {
                currentNBack: newNBack,
                currentDifficulty: newDifficulty,
                // Dashboard level control is Adaptive-centric; explicit 'adaptive' fallback for safety
                trainingMode: trainingMode || 'adaptive',
                // Under Recall the editor displays the 'singleColorRecall' track, so writes must
                // target it too — for BOTH roots (updateProfileProgress resolves the mode key
                // before the modeProgression/classicProgression split).
                ...(isRecallActive
                    ? { gameMode: 'singleColorRecall' }
                    : (trainingMode === 'classic' && { gameMode: activeGameMode === 'dynamic' ? 'dual' : activeGameMode })),
            });
        } catch (error) {
            console.error('[ProfileDashboard] Error updating training level:', error);
        } finally {
            setIsSavingNBack(false);
        }
    }, [userId, updateProfileProgress, activeGameMode, isRecallActive]);

    // Ref to prevent double navigation
    const hasNavigatedToGameRef = useRef(false);

    // Reset navigation ref and button state when gameState returns to idle
    useEffect(() => {
        if (gameState === 'idle') {
            hasNavigatedToGameRef.current = false;
            setIsStartingGame(false); // Reset button state (e.g., after session limit modal)
        }
    }, [gameState]);


    // Effect to handle navigation after game start initiated
    useEffect(() => {
        // Only navigate if: loading/preparing state, on dashboard, and haven't already navigated
        const isOnDashboard = location.pathname === '/dashboard' || location.pathname === '/';
        if ((gameState === 'loading' || gameState === 'preparing') && isOnDashboard && !hasNavigatedToGameRef.current) {
            hasNavigatedToGameRef.current = true;
            navigate('/game');
        }
    }, [gameState, navigate, location.pathname]);


    // --- Training mode detection (must be before early return for Rules of Hooks) ---
    const userTrainingModes = useMemo(() => {
        if (!activeSessions || activeSessions.length === 0) return { hasClassic: false, hasAdaptive: false };
        let hasClassic = false, hasAdaptive = false;
        for (const s of activeSessions) {
            if (s.trainingMode === 'classic') hasClassic = true;
            else hasAdaptive = true; // no trainingMode, 'adaptive', or 'dynamic' = adaptive
            if (hasClassic && hasAdaptive) break;
        }
        return { hasClassic, hasAdaptive };
    }, [activeSessions]);

    // Derive effective training mode per section (classic-only/adaptive-only users are forced)
    const deriveEffectiveTrainingMode = useCallback((filterValue) => {
        // Cohorts without Classic access are always Adaptive. Without this, a user with
        // zero sessions falls through both checks below and a stale globalTrainingMode
        // of 'classic' yields a Classic-framed stats view with no toggle to escape it.
        if (!hasClassicAccess) return 'adaptive';
        if (userTrainingModes.hasClassic && !userTrainingModes.hasAdaptive) return 'classic';
        if (!userTrainingModes.hasClassic && userTrainingModes.hasAdaptive) return 'adaptive';
        return filterValue === 'all' ? 'all' : filterValue;
    }, [userTrainingModes, hasClassicAccess]);

    const effectiveTrainingMode = useMemo(() => deriveEffectiveTrainingMode(globalTrainingType), [deriveEffectiveTrainingMode, globalTrainingType]);

    const isClassicView = effectiveTrainingMode === 'classic';
    const showTrainingModeToggle = hasClassicAccess && userTrainingModes.hasClassic && userTrainingModes.hasAdaptive;

    // Short "Single · Adaptive · Today · Color" breadcrumb shown when the sticky
    // filter bar is collapsed, so scrolled users still see what view they're on.
    const filterSummary = useMemo(() => {
        const parts = [];
        const singleSubOption = SINGLE_MODE_OPTIONS.find(o => o.key === globalMode);
        const isSingleAggregate = globalMode === 'single';

        if (isSingleAggregate || singleSubOption) {
            parts.push('Single');
        } else {
            const modeOption = MODE_FILTER_OPTIONS.find(o => o.key === globalMode);
            if (modeOption) parts.push(modeOption.label);
        }

        if (showTrainingModeToggle) {
            parts.push(globalTrainingType === 'classic' ? 'Classic' : 'Adaptive');
        }

        parts.push(globalPeriod.charAt(0).toUpperCase() + globalPeriod.slice(1));

        if (singleSubOption) {
            parts.push(singleSubOption.label);
        }

        return parts.join(' · ');
    }, [globalMode, globalTrainingType, globalPeriod, showTrainingModeToggle]);

    // --- CONDITIONAL RENDER ---
    // AuthGuard handles the main loading screen via LoadingContext.
    // Only check if data is ready after loading is complete.
    if (!isDataReady) {
         return (
              <div className="w-full max-w-5xl mx-auto px-1 sm:px-4 md:px-6 py-3 sm:py-6 flex justify-center items-center h-screen -mt-16">
                  <div className="text-center text-theme-text-secondary">
                      <p>Loading profile...</p>
                  </div>
              </div>
          );
    }
    // --- END CONDITIONAL LOADING RENDER ---

    // Get mode-specific progression data (Recall reads its own 'singleColorRecall' track)
    const modeProgress = getCurrentModeProgression(progressionModeKey);
    const classicProgress = getClassicModeProgression(progressionModeKey);

    // --- DATA IS LOADED - RENDER DASHBOARD ---
    const currentNBackLevel = modeProgress.currentNBack || 2;
    const classicNBackLevel = classicProgress.currentNBack || 2;
    const rawLevelDisplay = formatCombinedDifficulty(modeProgress.currentNBack, modeProgress.currentDifficulty);
    const isDynamicMode = activeGameMode === 'dynamic';
    const currentLevelDisplay = rawLevelDisplay;
    const MODE_PILL = {
        triple: { label: 'Triple', style: 'text-purple-400 border-purple-500/40 bg-purple-500/10' },
        quad: { label: 'Quad', style: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10' },
        dual: { label: 'Dual', style: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10' },
        singleVisual: { label: 'Single', style: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
        singleAudio: { label: 'Single', style: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
        singleColor: { label: 'Single', style: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
        singleShape: { label: 'Single', style: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
    };
    const effectiveMode = isDynamicMode ? (modeProgress.currentSubMode || 'dual') : activeGameMode;
    // Pill only in Dynamic, where it surfaces the rotating sub-mode. Static modes
    // are already labeled by the card title, so the pill would be redundant.
    const modePill = isDynamicMode ? (MODE_PILL[effectiveMode] || MODE_PILL.dual) : null;
    const allSessions = activeSessions || []; // All sessions

    // --- Filter sessions by game mode and training mode ---
    // 'all'    → no filter
    // 'single' → aggregate of all single-modality modes (singleVisual/Audio/Color/Shape)
    // anything else → exact gameMode match
    const filterByMode = (sessions, filter) => {
        if (filter === 'all') return sessions;
        if (filter === 'single') return sessions.filter(s => (s.gameMode || '').startsWith('single'));
        return sessions.filter(s => (s.gameMode || 'dual') === filter);
    };
    const filterByTrainingMode = (sessions, filter) => {
        if (filter === 'all') return sessions;
        if (filter === 'classic') return sessions.filter(s => s.trainingMode === 'classic');
        return sessions.filter(s => s.trainingMode !== 'classic'); // adaptive includes legacy + dynamic
    };
    const filteredSessions = filterByTrainingMode(filterByMode(allSessions, globalMode), effectiveTrainingMode);
    // userTimezone is derived above using useMemo and useSettings

    // Get mode display name (for Dynamic, show the active sub-mode)
    const getModeDisplayName = () => {
        if (activeGameMode === 'dynamic') {
            const subMode = modeProgress.currentSubMode || 'dual';
            return { dual: 'Dual', triple: 'Triple', quad: 'Quad' }[subMode] || 'Dual';
        }
        return MODE_LABELS[activeGameMode] || 'Dual';
    };


    return (
        // Main container with lab grid background
        <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-8 lab-grid">

            {/* Offline save queue status (pending/synced/failed sessions) */}
            <OfflineSaveBanner />

            {/* Start-failure notice: a failed start sends the user straight back here, so
                the message set during the start is surfaced instead of being dropped.
                Reads startFailureMessage, NOT feedbackMessage — the latter also carries
                post-session text (including a raw save error on a queued-offline save). */}
            {gameState === 'idle' && (
                <StartFailureNotice message={startFailureMessage} onDismiss={() => setStartFailureMessage('')} />
            )}

            {/* Subscription success modal (shown after Stripe checkout or RevenueCat purchase) */}
            <SubscriptionSuccessModal
                isOpen={showSubscriptionSuccess}
                onClose={() => setShowSubscriptionSuccess(false)}
                subscriptionStatus={userSubscriptionStatus}
                priceId={userSubscriptionPriceId}
            />

            {/* Gifted Pro access offer modal — shown when user hits 30 sessions */}
            <FreeTrialOfferModal
                isOpen={showFreeTrialOffer && canStartFreeTrial}
                onAccept={handleAcceptFreeTrial}
                onDecline={handleDeclineFreeTrial}
                onDismiss={handleDismissFreeTrial}
                isLoading={isTrialLoading}
            />

            {/* Pro access ended modal — shown once after gifted trial expires */}
            <FreeTrialEndedModal
                isOpen={freeTrialExpired && !freeTrialExpirySeen}
                onSubscribe={handleTrialEndedSubscribe}
                onDismiss={handleTrialEndedDismiss}
            />

            {/* ProTrialUpgradeModal mount lives in SidebarLayout for global availability.
                All existing dashboard triggers (game_1 fallback, reengagement, try_it_free,
                continuous_locked, daily_cap) flip global state in UserContext, which the
                layout-level mount reads from. */}

            {/* Daily Adaptive cap modal — fires on backend resource-exhausted/daily_cap or */}
            {/* on pre-start gate when dailyAdaptiveCount >= cap. CTA opens ProTrialUpgradeModal. */}
            <DailyCapModal
                isOpen={!!showDailyCapModal}
                onClose={() => setShowDailyCapModal(false)}
                dailyCapInfo={dailyCapInfo}
            />

            {/* Continuous Mode pre-start modal — asks how many sessions to chain */}
            <ContinuousModeStartModal
                isOpen={continuousModalOpen !== null}
                mode={continuousModalOpen}
                onClose={handleCloseContinuousModal}
                onConfirm={handleConfirmContinuousStart}
                dynamicSubMode={isDynamicMode ? (modeProgress.currentSubMode || 'dual') : null}
                capRemaining={(continuousModalOpen === 'adaptive' && !isFullAdaptive)
                    ? Math.max(0, DAILY_ADAPTIVE_CAP - dailyAdaptiveUsedToday)
                    : null}
            />

            {/* App download banner for Android mobile browser users (priority over cohort banner) */}
            <AppDownloadBanner onVisibilityChange={setIsDownloadBannerVisible} />

            {/* Cohort prompt banner (engagement-triggered, hidden when download banner is showing) */}
            {!isDownloadBannerVisible && <CohortPromptBanner />}

            {/* Second chance after an abandoned Stripe checkout */}
            <CheckoutRecoveryBanner
                flag={checkoutRecoveryFlag}
                onClear={() => setCheckoutRecoveryFlag(null)}
            />


            {/* ═══════════════════════════════════════════════════════════════
                SUBJECT IDENTIFICATION HEADER
                Lab notebook style with asymmetric layout
               ═══════════════════════════════════════════════════════════════ */}
            <header className="mb-6 sm:mb-8">
                {/* Top line with date marker */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Subject ID badge */}
                        <div className="h-12 w-12 sm:h-14 sm:w-14 relative">
                            <div className="absolute inset-0 bg-theme-accent/20 rounded-sm rotate-3"></div>
                            <div className="absolute inset-0 bg-theme-bg-secondary border border-theme-accent flex items-center justify-center text-theme-accent text-xl sm:text-2xl font-serif">
                                {userData.displayName ? userData.displayName.charAt(0).toUpperCase() : "U"}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">Subject Profile</p>
                            {userData.displayName ? (
                                <h1 className="text-xl sm:text-2xl lg:text-3xl text-theme-text font-serif italic">
                                    {userData.displayName}
                                </h1>
                            ) : (
                                <button
                                    onClick={() => navigate('/settings', { state: { section: 'profile' } })}
                                    className="group flex items-center gap-2 text-xl sm:text-2xl lg:text-3xl text-theme-text-muted font-serif italic hover:text-theme-accent transition-colors"
                                    title="Click to add your name"
                                >
                                    <span>Unknown Subject</span>
                                    <span className="text-xs font-mono uppercase tracking-wider text-theme-accent opacity-80 group-hover:opacity-100">
                                        + Add Name
                                    </span>
                                </button>
                            )}
                            {/* Streak line — hidden for brand-new users with no sessions */}
                            {allSessions.length > 0 && (
                                <>
                                    <p className="text-[0.6875rem] font-mono text-theme-text-muted tracking-wider mt-0.5">
                                        <span className="text-theme-accent">{dailyStreak}</span>-day streak
                                        <span className="mx-1.5 text-theme-line">|</span>
                                        <span className="text-theme-accent">{getWeeklyCompletionCount(allSessions)}</span>/7 this week
                                    </p>
                                    <p className="text-[0.6875rem] font-mono text-theme-text-muted tracking-wider mt-0.5">
                                        <span className="text-theme-accent">{sessionsToday}</span> session{sessionsToday === 1 ? '' : 's'} today
                                        {timeTrainedTodayMs > 0 && (
                                            <>
                                                <span className="mx-1.5 text-theme-line">|</span>
                                                <span className="text-theme-accent" aria-label={formatTotalDurationAria(timeTrainedTodayMs)}>{formatTotalDuration(timeTrainedTodayMs)}</span> trained
                                            </>
                                        )}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Protocol Guide Button */}
                    <button
                        onClick={() => setShowProtocolGuide(true)}
                        className="flex items-center justify-center gap-2 p-2.5 sm:px-3 sm:py-1.5 text-xs font-mono
                            text-theme-text-muted hover:text-theme-accent border border-theme-line
                            hover:border-theme-accent/50 rounded-lab transition-all"
                        title="Open Protocol Guide"
                    >
                        <FontAwesomeIcon icon={faBook} className="h-5 w-5 sm:h-3.5 sm:w-3.5" />
                        <span className="hidden sm:inline">Protocol Guide</span>
                    </button>
                </div>
            </header>

            {/* iOS Silent Mode Warning - dismissible */}
            {showIOSWarning && (
                <div className="mb-6 sm:mb-8 bg-theme-accent/10 border border-theme-accent/30 px-4 py-3">
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-theme-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6.253v11.494M8.464 8.464a5 5 0 000 7.072M19.07 4.93a10 10 0 010 14.142M4.93 4.93a10 10 0 000 14.142" />
                            </svg>
                        </div>
                        <p className="text-sm text-theme-accent leading-relaxed flex-1">
                            Please turn off Silent Mode (flip the switch on the side of your device) to hear game audio.
                        </p>
                        <button
                            onClick={dismissIOSWarning}
                            className="flex-shrink-0 text-theme-accent/60 hover:text-theme-accent transition-colors p-0.5"
                            aria-label="Dismiss"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                GAME MODE SELECTOR
                Switch between Dual, Triple, and Quad N-Back modes
               ═══════════════════════════════════════════════════════════════ */}
            <div data-tour="mode-selector">
                <ModeSelector />
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                PRIMARY ACTION HUB
                Two cards: Training (Adaptive/Classic toggle) + Continuous chain.
                Pre-Classic visual style — clinical, asymmetric, dominant CTA.
               ═══════════════════════════════════════════════════════════════ */}
            <div className="mt-8 sm:mt-10">{(() => {
                // Effective protocol — limited_modern has no Classic access so we force Adaptive
                // regardless of localStorage state. Other cohorts respect the in-card toggle.
                // Fall back to 'adaptive' during the brief null window before the auto-default
                // useEffect resolves (prevents flash of neither-toggle-active on first render).
                const effectiveProtocol = !hasClassicAccess ? 'adaptive' : (selectedTrainingMode || 'adaptive');
                const isClassicSelected = effectiveProtocol === 'classic';
                const startSession = () => isClassicSelected ? handleStartClassic() : handleStartAdaptive();
                const startContinuous = () => isClassicSelected ? handleStartContinuousClassic() : handleStartContinuousAdaptive();
                const levelLabel = isClassicSelected ? classicNBackLevel : currentLevelDisplay;
                const protocolBlurb = isClassicSelected
                    ? 'Fixed difficulty · whole-level progression at 90%+'
                    : 'Commence cognitive training at designated difficulty level';

                return (
                    <section className="mb-6 sm:mb-8 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6" data-tour="start-training">
                        {/* ── Training card (primary, 2/3 width on lg) ── */}
                        <div className="lg:col-span-2 relative overflow-hidden bg-gradient-to-br from-theme-bg-secondary to-theme-bg-elevated border border-theme-line p-5 sm:p-8 flex flex-col">
                            {/* Decorative corner accent */}
                            <div className="absolute top-0 right-0 w-20 h-20 bg-theme-accent/5"></div>
                            <div className="absolute top-0 right-0 w-16 h-16 border-r-2 border-t-2 border-theme-accent/30"></div>

                            <div className="relative flex flex-col flex-1">
                                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono mb-2">Initialize Session</p>

                                {/* In-card protocol toggle — only for users with Classic access */}
                                {hasClassicAccess && (
                                    <div className="mb-4 tab-pill-group inline-flex bg-theme-bg-elevated border border-theme-line self-start">
                                        {[
                                            { key: 'adaptive', label: 'Adaptive' },
                                            { key: 'classic', label: 'Classic' },
                                        ].map((opt) => {
                                            const active = effectiveProtocol === opt.key;
                                            return (
                                                <button
                                                    key={opt.key}
                                                    type="button"
                                                    onClick={() => setSelectedTrainingMode(opt.key)}
                                                    className={`px-3 py-1.5 text-[0.6875rem] font-mono uppercase tracking-wider transition-colors ${
                                                        active
                                                            ? 'bg-theme-accent text-theme-bg'
                                                            : 'text-theme-text-muted hover:text-theme-text'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                <h2 className="text-2xl sm:text-3xl text-theme-text font-serif italic mb-2">
                                    Begin {getModeDisplayName()} N-Back
                                    {isRecallActive && (
                                        <span className="ml-2 inline-block align-middle not-italic px-1.5 py-0.5 text-[0.625rem] font-mono uppercase tracking-wider border border-purple-500/40 text-purple-400 bg-purple-500/10">Recall</span>
                                    )}
                                </h2>
                                <p className="text-sm text-theme-text-secondary mb-4 max-w-md">
                                    {protocolBlurb}
                                    <span className="inline-block ml-2 px-2 py-0.5 bg-theme-bg-surface border border-theme-line font-mono text-theme-accent">
                                        N = {levelLabel}
                                    </span>
                                </p>

                                {modePill && (
                                    <span className={`inline-block text-[0.625rem] font-mono border px-1.5 py-0.5 mb-3 self-start ${modePill.style}`}>
                                        ▸ {modePill.label} mode
                                    </span>
                                )}

                                <div className="mt-auto flex flex-wrap items-center gap-3">
                                    <button
                                        className="btn-primary-lab py-3 sm:py-4 px-6 sm:px-8 text-sm sm:text-base inline-flex items-center justify-center gap-3 transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap w-full sm:w-auto"
                                        onClick={() => {
                                            if (isAdaptiveUser) startSession();
                                            else handleStartTrial();
                                        }}
                                        disabled={isStartingGame}
                                        title={`Start ${isClassicSelected ? 'Classic' : 'Adaptive'} session at N = ${levelLabel}`}
                                    >
                                        {isStartingGame ? (
                                            <><ButtonSpinner color="charcoal" /><span>Initializing...</span></>
                                        ) : (
                                            <><FontAwesomeIcon icon={faPlay} className="h-4 w-4 flex-shrink-0" /><span>Start Session</span></>
                                        )}
                                    </button>
                                </div>

                                {/* Daily-cap counter + upsell for capped cohorts. Below the
                                    Start button so it reads as a quiet footer, not a gate. */}
                                <DailyCapCounterChip isClassicSelected={isClassicSelected} />
                            </div>
                        </div>

                        {/* ── Continuous card (secondary, 1/3 width on lg) ── */}
                        <div className="relative overflow-hidden bg-theme-bg-secondary border border-theme-line p-5 sm:p-6 flex flex-col">
                            <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono mb-2">
                                Continuous Mode
                            </p>
                            <div className="flex items-center gap-2 mb-3">
                                <h3 className="text-lg sm:text-xl text-theme-text font-serif italic">Chain</h3>
                            </div>
                            <p className="text-sm text-theme-text-secondary mb-4 flex-1">
                                Train through several sessions back-to-back, with no breaks between them.{!isClassicSelected && ' Difficulty adjusts mid-stream across N.DD levels.'}
                            </p>
                            <button
                                className="py-3 px-6 text-sm font-mono font-semibold uppercase tracking-wider bg-theme-bg-elevated text-theme-text-secondary border border-theme-line hover:border-theme-accent hover:text-theme-accent transition-colors inline-flex items-center justify-center gap-2.5 disabled:opacity-70 disabled:cursor-not-allowed mt-auto w-full"
                                onClick={() => {
                                    if (isAdaptiveUser) startContinuous();
                                    else handleStartTrial();
                                }}
                                disabled={isStartingGame}
                                title="Chain sessions back-to-back"
                            >
                                <FontAwesomeIcon icon={faLink} className="h-4 w-4" />
                                <span>Start Chain</span>
                            </button>
                        </div>
                    </section>
                );
            })()}</div>


            {/* ═══════════════════════════════════════════════════════════════
                TRAINING INTENSITY PANEL
                Detailed training parameters display
               ═══════════════════════════════════════════════════════════════ */}
            <section className="mb-8 sm:mb-12" data-tour="training-intensity">
                <div className="mb-6">
                    <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono mb-1">Current Protocol</p>
                    <h2 className="text-xl sm:text-2xl text-theme-text font-serif italic">Training Intensity</h2>
                </div>
                <TrainingIntensity
                    difficulty={modeProgress.currentDifficulty}
                    nBack={modeProgress.currentNBack}
                    classicNBack={classicProgress.currentNBack}
                    classicDifficulty={classicProgress.currentDifficulty}
                    onLevelChange={handleLevelChange}
                    isSaving={isSavingNBack}
                    // Coarse difficulty steps only when the backend would actually snap this user
                    // (see functions/game.js isFreeTierForSnapping). The backend treats Pro,
                    // grandfather-active (adaptiveGrandfatherExpiry), AND limited_modern as full
                    // N.DD precision — so the editor must too, or those users (e.g. grandfathered
                    // free) get stranded off the coarse grid and can't return to their real level.
                    // Self-expires: isFullAdaptive drops grandfathered users at adaptiveGrandfatherExpiry.
                    isFreeTier={!isFullAdaptive && freeTier !== 'limited_modern'}
                    isAdaptiveUser={isAdaptiveUser}
                    hasClassicAccess={hasClassicAccess}
                    isGrandfathered={preMonetizationChange === true}
                    activeGameMode={activeGameMode}
                    isDynamic={isDynamicMode}
                    currentSubMode={isDynamicMode ? (modeProgress.currentSubMode || 'dual') : null}
                    onSubModeChange={isDynamicMode ? async (newSubMode) => {
                        if (!userId || !updateProfileProgress) return;
                        setIsSavingNBack(true);
                        try {
                            await updateProfileProgress(userId, { currentSubMode: newSubMode, trainingMode: 'adaptive' });
                            // Sync dashboard filter to the new sub-mode
                            setGlobalMode(newSubMode);
                        } catch (error) {
                            console.error('[ProfileDashboard] Error updating sub-mode:', error);
                        } finally {
                            setIsSavingNBack(false);
                        }
                    } : null}
                />
            </section>

            {/* ═══════════════════════════════════════════════════════════════
                COHORT TRAINING CARD
                Join or track cohort training program
               ═══════════════════════════════════════════════════════════════ */}
            <section className="mb-8 sm:mb-12">
                <CohortDashboardCard />
            </section>

            {/* ═══════════════════════════════════════════════════════════════
                UNIFIED FILTER BAR — Sticky, controls all data sections
                (Visual prototype — not wired to data filtering yet)
               ═══════════════════════════════════════════════════════════════ */}
            <div ref={filterSentinelRef} className="h-0" />
            <div
                className={`sticky-filter-bar z-20 py-3 px-4 mb-8 sm:mb-12 -mx-2 sm:-mx-4 md:-mx-6 border transition-all ${
                    isFilterStuck
                        ? 'bg-theme-bg/95 backdrop-blur-sm border-theme-line shadow-lg duration-200'
                        : 'border-transparent duration-200'
                }`}
                onTransitionEnd={(e) => {
                    // Flash accent border briefly when sticking
                    if (e.propertyName === 'border-color' && isFilterStuck) {
                        const el = e.currentTarget;
                        el.style.borderColor = 'rgb(var(--color-accent))';
                        setTimeout(() => { el.style.borderColor = ''; }, 400);
                    }
                }}
                style={{ position: 'sticky', top: '8px' }}
            >
                {/*
                   Two stacked single-row grids, each animating 0fr ↔ 1fr. This is the
                   canonical pattern for smoothly transitioning to/from content-defined
                   (auto) height: the row collapses to 0 when 0fr, expands to content
                   height when 1fr, and CSS can interpolate between them. overflow-hidden
                   + min-h-0 on the inner child is required so the row can actually
                   collapse past the item's intrinsic min-content size.
                */}
                {(() => {
                    const showCollapsed = isFilterStuck && isFilterCollapsed && isMobile;
                    return (
                <>
                <div
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: showCollapsed ? '0fr' : '1fr' }}
                >
                    {/* Expanded view.
                        Items use `order` so that on mobile (flex-col) the visual stack is
                        mode → modality (when Single) → time + collapse-chevron. That keeps
                        time at the very bottom, putting the chevron in the bottom-right
                        corner of the filter bar while stuck. */}
                    <div className="overflow-hidden min-h-0" aria-hidden={showCollapsed} inert={showCollapsed ? true : undefined}>
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-x-4 sm:gap-y-2">
                    {/* Mode + training pills. Order-1 everywhere. Takes remaining space on desktop. */}
                    <div className="flex items-center gap-3 flex-wrap order-1 sm:flex-1">
                        <span className="text-[0.625rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted shrink-0">Filter</span>
                        {/* Mode filter: Dual / Triple / Quad / Single / All */}
                        {/* The "Single" pill is a parent that expands a second row of 4 sub-pills. */}
                        {/* It shows active when globalMode === 'single' (aggregate) OR any singleX sub-mode. */}
                        <div className="tab-pill-group inline-flex bg-theme-bg-elevated border border-theme-line">
                            {MODE_FILTER_OPTIONS.map((opt, i) => {
                                const isSingleParent = opt.key === 'single';
                                const isActive = isSingleParent
                                    ? (globalMode === 'single' || SINGLE_MODE_KEYS.includes(globalMode))
                                    : globalMode === opt.key;
                                return (
                                    <button
                                        key={opt.key}
                                        onClick={() => setGlobalMode(opt.key)}
                                        className={`relative px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-theme-accent/50 ${i > 0 ? 'border-l border-theme-line' : ''} ${isActive ? opt.activeColor : 'text-theme-text-muted hover:text-theme-text-secondary hover:bg-theme-bg-surface'}`}
                                    >
                                        {opt.label}
                                        {isActive && <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${opt.indicator}`} />}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Training type filter: Adaptive / Classic — only if user has both */}
                        {showTrainingModeToggle && (
                            <>
                                <span className="text-theme-line text-xs hidden sm:inline">&middot;</span>
                                <div className="tab-pill-group inline-flex bg-theme-bg-elevated border border-theme-line">
                                    {[
                                        { key: 'adaptive', label: 'Adaptive' },
                                        { key: 'classic', label: 'Classic' },
                                    ].map((opt, i) => (
                                        <button
                                            key={opt.key}
                                            onClick={() => setGlobalTrainingType(opt.key)}
                                            className={`relative px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-theme-accent/50 ${i > 0 ? 'border-l border-theme-line' : ''} ${globalTrainingType === opt.key ? 'bg-yellow-500/20 text-yellow-400' : 'text-theme-text-muted hover:text-theme-text-secondary hover:bg-theme-bg-surface'}`}
                                        >
                                            {opt.label}
                                            {globalTrainingType === opt.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-400" />}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Modality sub-pills (only when Single parent is active).
                        Mobile: order-2 (between mode and time).
                        Desktop: order-3 + w-full so it wraps onto its own row below mode+time. */}
                    {(globalMode === 'single' || SINGLE_MODE_KEYS.includes(globalMode)) && (
                        <div className="flex items-center gap-2 pl-2 border-l-2 border-white/10 order-2 sm:order-3 sm:w-full">
                            <span className="text-[0.5625rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted shrink-0">Modality</span>
                            <div className="tab-pill-group inline-flex bg-theme-bg-elevated border border-theme-line">
                                {SINGLE_MODE_OPTIONS.map((opt, i) => {
                                    const colors = MODE_FILTER_COLORS[opt.key];
                                    const isActive = globalMode === opt.key;
                                    return (
                                        <button
                                            key={opt.key}
                                            onClick={() => setGlobalMode(opt.key)}
                                            className={`relative px-2 py-1 text-[0.625rem] font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-theme-accent/50 ${i > 0 ? 'border-l border-theme-line' : ''} ${isActive ? colors.active : 'text-theme-text-muted hover:text-theme-text-secondary hover:bg-theme-bg-surface'}`}
                                        >
                                            {opt.label}
                                            {isActive && <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${colors.indicator}`} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Period selector + collapse chevron.
                        Mobile: order-3 (the last stacked row → chevron ends up in bottom-right corner).
                        Desktop: order-2, sits to the right of the mode group on the same row. */}
                    <div className="flex items-center gap-2 shrink-0 order-3 sm:order-2">
                        <div className="flex border-b border-theme-line">
                            {['today', 'week', 'month', 'all'].map((period) => (
                                <button
                                    key={period}
                                    onClick={() => setGlobalPeriod(period)}
                                    className={`tab-lab px-4 py-2 text-xs sm:text-sm font-mono uppercase tracking-wider transition-colors ${
                                        globalPeriod === period ? 'active text-theme-accent' : 'text-theme-text-muted hover:text-theme-text-secondary'
                                    }`}
                                >
                                    {period}
                                </button>
                            ))}
                        </div>
                        {isFilterStuck && isMobile && (
                            <button
                                type="button"
                                onClick={() => setIsFilterCollapsed(true)}
                                className="shrink-0 ml-auto p-1.5 text-theme-text-muted hover:text-theme-accent transition-colors focus:outline-none focus:ring-1 focus:ring-theme-accent/50"
                                title="Collapse filters"
                                aria-label="Collapse filters"
                                aria-expanded="true"
                            >
                                <FontAwesomeIcon icon={faChevronUp} className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>
                    </div>
                </div>

                {/* Collapsed breadcrumb — its own single-row grid so it can animate
                    independently from 0fr ↔ 1fr alongside the expanded grid above. */}
                <div
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: showCollapsed ? '1fr' : '0fr' }}
                >
                    <div className="overflow-hidden min-h-0" aria-hidden={!showCollapsed} inert={!showCollapsed ? true : undefined}>
                        {/* Entire breadcrumb row is the expand toggle — bigger tap target
                            than a 24px chevron, and the chevron still signals intent. */}
                        <button
                            type="button"
                            onClick={() => setIsFilterCollapsed(false)}
                            className="w-full flex items-center justify-between gap-3 text-left cursor-pointer group focus:outline-none focus:ring-1 focus:ring-theme-accent/50"
                            title="Expand filters"
                            aria-label={`Expand filters — current: ${filterSummary}`}
                            aria-expanded="false"
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="text-[0.625rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted shrink-0">Filter</span>
                                <span className="text-xs font-mono text-theme-text-secondary truncate group-hover:text-theme-text transition-colors">{filterSummary}</span>
                            </div>
                            <span className="shrink-0 p-1.5 text-theme-text-muted group-hover:text-theme-accent transition-colors" aria-hidden="true">
                                <FontAwesomeIcon icon={faChevronDown} className="w-3 h-3" />
                            </span>
                        </button>
                    </div>
                </div>
                </>
                    );
                })()}
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SESSION STATISTICS PANEL
                Lab instrument-style data readouts
               ═══════════════════════════════════════════════════════════════ */}
            <section className="mb-8 sm:mb-12" data-tour="stats-panel">
                <div className="mb-6">
                    <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono mb-1">Data Analysis</p>
                    <h2 className="text-xl sm:text-2xl text-theme-text font-serif italic">Session Statistics</h2>
                </div>

                {/* Stats Content */}
                {/*
                  NOTE: the 'single' aggregate filter is mapped to 'all' for the widget
                  gameMode prop. Rationale: the stats widgets key their per-mode branches
                  on dual/triple/quad/all. Treating 'single' as 'all' gives a cross-mode
                  (multi-modality) rendering — which is the right shape for the aggregate
                  since it spans four different single-modality modes. Session filtering
                  is already narrowed to single* sessions via filterByMode upstream, so
                  the widgets only aggregate single sessions. Specific singleX keys
                  (singleVisual/Audio/Color/Shape) are passed through as-is.
                */}
                <div className="animate-fadeIn">
                    {(() => {
                        const widgetGameMode = globalMode === 'single' ? 'all' : globalMode;
                        if (globalPeriod === 'today') return <TodaysStats sessions={filteredSessions} dailyStats={dailyStats} gameMode={widgetGameMode} isClassicView={isClassicView} useSessionFallback={effectiveTrainingMode !== 'all'} timezone={userTimezone} />;
                        if (globalPeriod === 'week') return <WeeklyStats sessions={filteredSessions} dailyStats={dailyStats} gameMode={widgetGameMode} isClassicView={isClassicView} useSessionFallback={effectiveTrainingMode !== 'all'} timezone={userTimezone} />;
                        if (globalPeriod === 'month') return <MonthlyStats sessions={filteredSessions} dailyStats={dailyStats} gameMode={widgetGameMode} isClassicView={isClassicView} useSessionFallback={effectiveTrainingMode !== 'all'} timezone={userTimezone}/>;
                        if (globalPeriod === 'all') return <AllTimeStats sessions={filteredSessions} gameMode={widgetGameMode} isClassicView={isClassicView} includesBothTrainingModes={showTrainingModeToggle} timezone={userTimezone} />;
                        return null;
                    })()}
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════
                PERFORMANCE TRAJECTORY CHART
                Oscilloscope-style visualization
               ═══════════════════════════════════════════════════════════════ */}
            <section className="mb-8 sm:mb-12">
                <div className="mb-6">
                    <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono mb-1">Temporal Analysis</p>
                    <h2 className="text-xl sm:text-2xl text-theme-text font-serif italic">Performance Trajectory</h2>
                </div>

                <DailyPerformanceChart
                    sessions={filteredSessions}
                    selectedPeriod={globalPeriod}
                    timezone={userTimezone}
                    allTimeDailyStats={allTimeDailyStats}
                    // Map 'single' aggregate → 'all' so the multi-mode chart renders cross-modality.
                    gameMode={globalMode === 'single' ? 'all' : globalMode}
                    isClassicView={isClassicView}
                />
            </section>

            {/* ═══════════════════════════════════════════════════════════════
                SESSION LOG
                Laboratory notebook entries
               ═══════════════════════════════════════════════════════════════ */}
            <section className="mb-8 sm:mb-12" data-tour="sessions-table">
                <div className="mb-6">
                    <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono mb-1">Experiment Log</p>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <h2 className="text-xl sm:text-2xl text-theme-text font-serif italic">Recent Sessions</h2>
                        <Link
                            to="/sessions"
                            className="group inline-flex items-center gap-2 px-4 py-2 bg-theme-bg-elevated border border-theme-line hover:border-theme-accent text-sm font-mono text-theme-text-secondary hover:text-theme-accent transition-all"
                            title="View all session history"
                        >
                            <span>View Complete Log</span>
                            <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                        </Link>
                    </div>
                </div>

                <SessionsTable
                    sessions={filteredSessions}
                    onNavigate={navigate}
                    timezone={userTimezone}
                    {...(() => {
                        // Derive which modality columns to show from the current mode filter.
                        // Aggregate filters ('all' / 'single') show all four; specific sub-filters
                        // (singleVisual/Audio/Color/Shape) show only their one modality.
                        const filterMods = (globalMode === 'all' || globalMode === 'single')
                            ? ['visual', 'audio', 'color', 'shape']
                            : (MODE_MODALITIES[globalMode] || ['visual', 'audio']);
                        return {
                            showVisualColumn: filterMods.includes('visual'),
                            showAudioColumn:  filterMods.includes('audio'),
                            showColorColumn:  filterMods.includes('color'),
                            showShapeColumn:  filterMods.includes('shape'),
                        };
                    })()}
                />
            </section>

            {/* Tutorial System - Protocol Guide */}
            <TutorialOrchestrator
                showProtocolGuide={showProtocolGuide}
                onProtocolGuideClose={() => setShowProtocolGuide(false)}
            />
        </div>
    );
};

export default ProfileDashboard;
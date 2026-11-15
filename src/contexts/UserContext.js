/* src/contexts/UserContext.js */
/* Updated for flattened user structure - no more multiple profiles */
import React, {
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef
} from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db as firestoreDb } from '../firebaseConfig'; // Import db instance

// Internal Imports (renamed from profile/ to user/)
import { UserContext, useUser, ProfileContext, useProfile } from './user/userContextSetup';
import { useAuthStateListener } from './user/userAuth';
import { identifyUser, clearUser } from '../utils/analyticsTracker';
import { useSubcollectionListeners, useDailyStatsListener, useHealthSafetyData, fetchAllDailyStats } from './user/userDataFetching';
import { getCurrentNotice } from '../notices/healthSafety';
import { DEFAULT_USER_DATA, FREE_TRIAL_SESSION_THRESHOLD } from './user/userConstants';

// Platform & Payment
import { isNative, getPlatform } from '../utils/platform';
import { initializePurchases } from '../services/paymentService';

// Cloud Function Imports (Used by action creators)
import {
    getUserDataOnLoginFn,
    checkSubscriptionStatusFn,
    fetchUserSessionsFn, exportUserSessionsFn, fetchSessionsLightweightFn,
    updateSessionNoteFn
} from './user/userCloudFunctions';

// Action Hook Creator Imports
import {
    useCreateUpdateProfileProgressAction,
    useCreateMarkTutorialCompletedAction
} from './user/userActionsCRUD';
import { useCreateAddCstResultAction } from './user/userActionsCST';
import {
    useCreateFetchPaginatedSessionsAction,
    useCreateFetchAllSessionsForExportAction,
    useCreateFetchSessionsLightweightAction,
    useCreateUpdateSessionNoteAction
} from './user/userActionsSessions';
import { useCreateCheckSubscriptionAction } from './user/userActionsSubscription';
import { useCreateMarkOnboardingCompleteAction } from './user/userActionsOnboarding';
import { MODE_KEYS } from '../constants/modeStyles';


// Re-export hooks (useUser is primary, useProfile for backward compatibility)
export { useUser, useProfile };

// Default mode progression values for new modes
const getDefaultModeProgression = () => ({
    currentNBack: 2,
    currentDifficulty: 0.0,
    highestNBack: 2,
    consecutiveSuccesses: 0,
    previousNBackLevelDifficulties: {},
});

// Default user data structure (replaces DEFAULT_PROFILE_DATA for user context)
const getDefaultUserData = () => ({
    displayName: null,
    currentNBack: 2,
    currentDifficulty: 0.0,
    highestNBack: 2,
    consecutiveSuccesses: 0,
    tutorialsCompleted: {},
    cstHistory: [],
    reasoningCheckHistory: [],
    cstFamiliarizationCount: 0,
    lastCstAssessmentTimestamp: null,
    highestNBackGood: null,
    highestAchievedGoodSessionId: null,
    previousNBackLevelDifficulties: {},
    sessions: [],
    // NEW: Game mode support
    activeGameMode: 'dual',
    modeProgression: {
        dual: getDefaultModeProgression(),
        triple: getDefaultModeProgression(),
        quad: getDefaultModeProgression(),
        dynamic: { ...getDefaultModeProgression(), currentSubMode: 'dual' },
    },
});

export const UserProvider = ({ children }) => {
    // --- State Definitions (Simplified for single-user structure) ---
    const [userData, setUserData] = useState(getDefaultUserData());
    const [legacyProfileId, setLegacyProfileId] = useState(null); // For legacy session path fallback
    const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
    const [activeGameMode, setActiveGameMode] = useState('dual'); // 'dual' | 'triple' | 'quad'

    const [activeSessions, setActiveSessions] = useState([]);
    const [error, setError] = useState(null);
    const [userSubscriptionStatus, setUserSubscriptionStatus] = useState(null);
    const [userSubscriptionEndDate, setUserSubscriptionEndDate] = useState(null);
    const [userSubscriptionPriceId, setUserSubscriptionPriceId] = useState(null);
    const [userSubscriptionCancelAtPeriodEnd, setUserSubscriptionCancelAtPeriodEnd] = useState(false);
    const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
    const [userHadTrial, setUserHadTrial] = useState(false);
    const [everHadPaidSubscription, setEverHadPaidSubscription] = useState(false);
    const [freeTrialEnd, setFreeTrialEnd] = useState(null);
    const [freeTrialUsed, setFreeTrialUsed] = useState(false);
    const [freeTrialDeclined, setFreeTrialDeclined] = useState(false);
    const [freeTrialExpirySeen, setFreeTrialExpirySeen] = useState(false);
    const [showFreeTrialOffer, setShowFreeTrialOffer] = useState(false);
    // Pro-trial upgrade modal (CC-required Stripe trial — chess.com pattern)
    const [showProTrialUpgradeModal, setShowProTrialUpgradeModal] = useState(false);
    const [proTrialUpgradeModalTrigger, setProTrialUpgradeModalTrigger] = useState(null); // 'game_1' | 'recurring' | 'reengagement' | 'chart_paywall'
    // Lifetime trial state (web Stripe setup-mode + day-14 charge)
    const [lifetimeTrialStatus, setLifetimeTrialStatus] = useState(null);
    const [lifetimeTrialEndsAt, setLifetimeTrialEndsAt] = useState(null);
    const [totalSessions, setTotalSessions] = useState(0);
    const [subscriptionTier, setSubscriptionTier] = useState(null); // 'free' or 'premium'
    const [subscriptionPlatform, setSubscriptionPlatform] = useState(null); // 'ios_iap', 'android_iap', or null (Stripe/web)
    const [isAdmin, setIsAdmin] = useState(false);
    const [isCoach, setIsCoach] = useState(false);
    const [coachGrantedPremium, setCoachGrantedPremium] = useState(false);
    const [coachId, setCoachId] = useState(null);
    const [preMonetizationChange, setPreMonetizationChange] = useState(false);
    const [rewardedProSessions, setRewardedProSessions] = useState(0);
    const [adaptiveGrandfatherExpiry, setAdaptiveGrandfatherExpiry] = useState(null);
    const [subscriptionType, setSubscriptionType] = useState(null); // null | 'lifetime'
    // Free-tier cohort + daily Adaptive cap (relaunch monetization, May 2026)
    const [freeTier, setFreeTier] = useState(null); // 'adaptive_grandfathered' | 'classic_legacy' | 'limited_modern' | null
    const [dailyAdaptiveCount, setDailyAdaptiveCount] = useState(0);
    const [dailyAdaptiveCountDate, setDailyAdaptiveCountDate] = useState(null);
    const [showDailyCapModal, setShowDailyCapModal] = useState(false);
    const [dailyCapInfo, setDailyCapInfo] = useState(null); // { sessionsUsed, dailyCap }
    const [pendingOfflineCapRejection, setPendingOfflineCapRejection] = useState(null);

    const { authUser, isAuthResolved, isAuthStale, validateAuthToken } = useAuthStateListener();
    const authUserRef = useRef(authUser);
    useEffect(() => { authUserRef.current = authUser; }, [authUser]);
    const userId = authUser?.uid || null;

    // Check admin claim from JWT (cached, no network call)
    useEffect(() => {
        if (authUser) {
            authUser.getIdTokenResult().then(result => {
                setIsAdmin(result.claims.isAdmin === true);
                setIsCoach(result.claims.role === 'coach');
            });
        } else {
            setIsAdmin(false);
            setIsCoach(false);
        }
    }, [authUser]);

    // Ref for active game mode (used by updateProfileProgress action)
    const activeGameModeRef = useRef(activeGameMode);
    useEffect(() => { activeGameModeRef.current = activeGameMode; }, [activeGameMode]);

    // Session listener for users/{uid}/sessions/
    const {
        activeSessions: loadedSessions,
        isLoadingActiveSubcollections,
        subcollectionError: sessionSubcollectionError,
    } = useSubcollectionListeners(userId, !isInitialLoadComplete);

    // Daily stats listener for aggregated stats (fixes monthly stats limit issue)
    const {
        dailyStats,
        isLoadingDailyStats,
        dailyStatsError,
    } = useDailyStatsListener(userId, !isInitialLoadComplete);

    // Health & Safety disclaimer state — fires once per userId, in parallel
    // with the main login data load. Lifted from per-mount in <GameScreen> so
    // returning (already-acknowledged) users get the countdown immediately.
    const {
        healthSafetyNeedsAck,
        isLoadingHealthSafety,
        acknowledgeHealthSafety,
        declineHealthSafety,
    } = useHealthSafetyData(userId);

    // All-time daily stats (lazy loaded when "All" tab is selected)
    const [allTimeDailyStats, setAllTimeDailyStats] = useState(null);
    const [isLoadingAllTimeStats, setIsLoadingAllTimeStats] = useState(false);
    const allTimeStatsFetchedForModeRef = useRef(null); // Track which mode we fetched for

    // --- Actions ---
    // Removed: selectProfile, addProfile, removeProfile, setProfileUsername (no longer needed)

    const markOnboardingComplete = useCreateMarkOnboardingCompleteAction(setIsOnboardingComplete);
    // Update profile progress now updates mode-specific progression data
    const updateProfileProgress = useCreateUpdateProfileProgressAction(authUserRef, activeGameModeRef, setUserData, setError);
    const markTutorialCompleted = useCreateMarkTutorialCompletedAction(authUserRef, setUserData, setError);
    const addCstResult = useCreateAddCstResultAction(authUserRef, setError);
    const fetchPaginatedSessions = useCreateFetchPaginatedSessionsAction(authUserRef, fetchUserSessionsFn);
    const fetchAllSessionsForExport = useCreateFetchAllSessionsForExportAction(authUserRef, exportUserSessionsFn);
    const fetchSessionsLightweight = useCreateFetchSessionsLightweightAction(authUserRef, fetchSessionsLightweightFn);
    const updateSessionNote = useCreateUpdateSessionNoteAction(authUserRef, updateSessionNoteFn);
    const checkSubscription = useCreateCheckSubscriptionAction(
        authUserRef, () => {}, setUserSubscriptionStatus,
        setUserSubscriptionEndDate, setUserSubscriptionPriceId, () => {},
        setSubscriptionTier,
        checkSubscriptionStatusFn,
        setUserSubscriptionCancelAtPeriodEnd
    );

    // Track if we've completed initial load (to prevent re-triggering loading state)
    const hasCompletedInitialLoadRef = React.useRef(false);

    // Counter to force re-run of loadInitialData (used by refreshUserData)
    const [refreshCounter, setRefreshCounter] = useState(0);

    // --- Centralized Data Loading Logic (Updated for flattened structure) ---
    useEffect(() => {
        const loadInitialData = async () => {
            // Clear any previous error state on retry/refresh
            setError(null);

            // Only set loading to false if we haven't completed initial load yet
            // This prevents the loading screen from re-appearing after initial load
            if (!hasCompletedInitialLoadRef.current) {
                setIsInitialLoadComplete(false); // Start loading
            }

            if (!userId) {
                // No user, so loading is complete. Reset state.
                clearUser();
                setUserData(getDefaultUserData());
                setLegacyProfileId(null);
                setUserSubscriptionStatus(null);
                setUserSubscriptionCancelAtPeriodEnd(false);
                setSubscriptionTier(null);
                setSubscriptionPlatform(null);
                setCoachGrantedPremium(false);
                setCoachId(null);
                setPreMonetizationChange(false);
                setAdaptiveGrandfatherExpiry(null);
                setSubscriptionType(null);
                setFreeTier(null);
                setDailyAdaptiveCount(0);
                setDailyAdaptiveCountDate(null);
                setShowDailyCapModal(false);
                setDailyCapInfo(null);
                setPendingOfflineCapRejection(null);
                setFreeTrialEnd(null);
                setFreeTrialUsed(false);
                setFreeTrialDeclined(false);
                setFreeTrialExpirySeen(false);
                setShowFreeTrialOffer(false);
                setIsInitialLoadComplete(true);
                hasCompletedInitialLoadRef.current = false; // Reset for next login
                return;
            }

            // During signup, initializeFreeUser hasn't run yet.
            // Defer getUserDataOnLogin to avoid racing it and getting stale/incomplete data.
            const isNewSignup = sessionStorage.getItem('isNewSignup') === 'true';
            if (isNewSignup) {
                return;
            }

            try {
                // Race the cloud function call against a 15s timeout to prevent infinite loading
                const LOAD_TIMEOUT_MS = 15000;
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('LOAD_TIMEOUT')), LOAD_TIMEOUT_MS)
                );
                const result = await Promise.race([
                    getUserDataOnLoginFn(),
                    timeoutPromise,
                ]);
                if (!result?.data?.success) {
                    throw new Error(result?.data?.message || "Backend function returned failure.");
                }

                // NEW: getUserDataOnLogin now returns flattened userData directly
                const { userData: fetchedUserData } = result.data;

                // Set user-level subscription data
                setUserSubscriptionStatus(fetchedUserData.subscriptionStatus || 'inactive');
                setUserSubscriptionCancelAtPeriodEnd(fetchedUserData.subscriptionCancelAtPeriodEnd === true);
                setUserHadTrial(fetchedUserData.hasHadTrial || false);
                setEverHadPaidSubscription(fetchedUserData.everHadPaidSubscription || false);
                setFreeTrialEnd(fetchedUserData.freeTrialEnd ? new Date(fetchedUserData.freeTrialEnd) : null);
                setFreeTrialUsed(fetchedUserData.freeTrialUsed || false);
                setFreeTrialDeclined(fetchedUserData.freeTrialDeclined || false);
                setFreeTrialExpirySeen(fetchedUserData.freeTrialExpirySeen || false);
                setLifetimeTrialStatus(fetchedUserData.lifetimeTrialStatus || null);
                setLifetimeTrialEndsAt(fetchedUserData.lifetimeTrialEndsAt ? new Date(fetchedUserData.lifetimeTrialEndsAt) : null);
                setSubscriptionTier(fetchedUserData.subscriptionTier || null);
                setSubscriptionPlatform(fetchedUserData.subscriptionPlatform || null);
                setCoachGrantedPremium(fetchedUserData.coachGrantedPremium || false);
                setCoachId(fetchedUserData.coachId || null);
                setPreMonetizationChange(fetchedUserData.preMonetizationChange || false);
                setRewardedProSessions(fetchedUserData.rewardedProSessions || 0);
                setTotalSessions(fetchedUserData.totalSessions || 0);
                setAdaptiveGrandfatherExpiry(fetchedUserData.adaptiveGrandfatherExpiry || null);
                setSubscriptionType(fetchedUserData.subscriptionType || null);
                setFreeTier(fetchedUserData.freeTier || null);
                setDailyAdaptiveCount(fetchedUserData.dailyAdaptiveCount || 0);
                setDailyAdaptiveCountDate(fetchedUserData.dailyAdaptiveCountDate || null);

                // Identify user in GA4 with key properties
                identifyUser(userId, {
                    subscription_tier: fetchedUserData.subscriptionTier || 'free',
                    platform: getPlatform(),
                });

                if (fetchedUserData.subscriptionCurrentPeriodEnd) {
                    setUserSubscriptionEndDate(new Date(fetchedUserData.subscriptionCurrentPeriodEnd));
                }

                // Handle mode progression (lazy migration for existing users)
                // Also handle partial modeProgression (e.g., quad exists but dual doesn't)
                let modeProgression = fetchedUserData.modeProgression || {};

                // If dual mode doesn't exist in modeProgression, migrate from root-level fields
                if (!modeProgression.dual) {
                    modeProgression = {
                        ...modeProgression, // Keep any existing modes (triple, quad)
                        dual: {
                            currentNBack: fetchedUserData.currentNBack ?? 2,
                            currentDifficulty: fetchedUserData.currentDifficulty ?? 0.0,
                            highestNBack: fetchedUserData.highestNBack ?? 2,
                            consecutiveSuccesses: fetchedUserData.consecutiveSuccesses ?? 0,
                            previousNBackLevelDifficulties: fetchedUserData.previousNBackLevelDifficulties || {},
                        },
                    };
                }
                // Ensure all modes exist with at least defaults
                if (!modeProgression.triple) modeProgression.triple = getDefaultModeProgression();
                if (!modeProgression.quad) modeProgression.quad = getDefaultModeProgression();
                if (!modeProgression.dynamic) modeProgression.dynamic = { ...getDefaultModeProgression(), currentSubMode: 'dual' };

                // Classic progression (separate from Adaptive)
                const defaultClassicMode = { currentNBack: 2, currentDifficulty: 0.50 };
                let classicProgression = fetchedUserData.classicProgression || {};
                if (!classicProgression.dual) classicProgression.dual = defaultClassicMode;
                if (!classicProgression.triple) classicProgression.triple = { ...defaultClassicMode };
                if (!classicProgression.quad) classicProgression.quad = { ...defaultClassicMode };

                // Set active game mode (default to 'dual' for existing users)
                const savedGameMode = fetchedUserData.activeGameMode || 'dual';
                setActiveGameMode(savedGameMode);

                // Set user data (flattened structure)
                setUserData({
                    displayName: fetchedUserData.displayName || null,
                    createdAt: fetchedUserData.createdAt || null,
                    currentNBack: fetchedUserData.currentNBack ?? 2,
                    currentDifficulty: fetchedUserData.currentDifficulty ?? 0.0,
                    highestNBack: fetchedUserData.highestNBack ?? 2,
                    consecutiveSuccesses: fetchedUserData.consecutiveSuccesses ?? 0,
                    tutorialsCompleted: fetchedUserData.tutorialsCompleted || {},
                    cstHistory: fetchedUserData.cstHistory || [],
                    reasoningCheckHistory: Array.isArray(fetchedUserData.reasoningCheckHistory) ? fetchedUserData.reasoningCheckHistory : [],
                    cstFamiliarizationCount: fetchedUserData.cstFamiliarizationCount ?? 0,
                    lastCstAssessmentTimestamp: fetchedUserData.lastCstAssessmentTimestamp || null,
                    highestNBackGood: fetchedUserData.highestNBackGood ?? null,
                    highestAchievedGoodSessionId: fetchedUserData.highestAchievedGoodSessionId ?? null,
                    previousNBackLevelDifficulties: fetchedUserData.previousNBackLevelDifficulties || {},
                    sessions: [], // Will be populated by session listener
                    // NEW: Game mode data
                    activeGameMode: savedGameMode,
                    modeProgression: modeProgression,
                    classicProgression: classicProgression,
                    // Cohort program
                    activeCohortId: fetchedUserData.activeCohortId || null,
                    lastLeftCohortId: fetchedUserData.lastLeftCohortId || null,
                    lastLeftCohortName: fetchedUserData.lastLeftCohortName || null,
                    lastLeftCohortStatus: fetchedUserData.lastLeftCohortStatus || null,
                    lastLeftCohortMemberCount: fetchedUserData.lastLeftCohortMemberCount || 0,
                    cohortDisplayName: fetchedUserData.cohortDisplayName || null,
                    // Pro-trial upgrade modal cadence state (additive — older clients just ignore unknown keys)
                    upgradeModalLastShownAt: fetchedUserData.upgradeModalLastShownAt || null,
                    upgradeModalDismissCount: fetchedUserData.upgradeModalDismissCount || 0,
                    upgradeModalSuppressedUntil: fetchedUserData.upgradeModalSuppressedUntil || null,
                    upgradeModalGameOneShown: fetchedUserData.upgradeModalGameOneShown === true,
                    upgradeModalGameOneAcceptedOrDismissed: fetchedUserData.upgradeModalGameOneAcceptedOrDismissed === true,
                    upgradeModalReengagementShownForGap: fetchedUserData.upgradeModalReengagementShownForGap || null,
                    upgradeModalLastTrigger: fetchedUserData.upgradeModalLastTrigger || null,
                    upgradeModalAcceptedAt: fetchedUserData.upgradeModalAcceptedAt || null,
                    // lastSessionAt — for re-engagement modal trigger (14+ day gap detection)
                    lastSessionAt: fetchedUserData.lastSessionAt || null,
                    // Marketing email consent (was previously dropped here, which broke
                    // the Settings toggle's initial state — getUserDataOnLogin returns it)
                    marketingConsent: fetchedUserData.marketingConsent || null,
                });

                // Set legacy profile ID for session path fallback (if user has legacy data)
                setLegacyProfileId(fetchedUserData._legacyProfileId || null);

            } catch (err) {
                console.error("[UserContext] CRITICAL: Failed to fetch initial user data:", err);
                // Set structured error code for ErrorScreen to consume
                if (err.message === 'LOAD_TIMEOUT' || !navigator.onLine) {
                    setError('NETWORK_ERROR');
                } else {
                    setError('SERVER_ERROR');
                }
                setUserData(getDefaultUserData());
                setLegacyProfileId(null);
                setUserSubscriptionStatus('error');
            } finally {
                setIsInitialLoadComplete(true);
                hasCompletedInitialLoadRef.current = true; // Mark initial load as complete
            }
        };

        if (isAuthResolved) {
            loadInitialData();
        }
    }, [isAuthResolved, userId, refreshCounter]);

    // Force re-run of loadInitialData (called by SignupScreen after initializeFreeUser completes)
    const refreshUserData = useCallback(() => {
        hasCompletedInitialLoadRef.current = false;
        setIsInitialLoadComplete(false);
        setRefreshCounter(prev => prev + 1);
    }, []);

    // Initialize RevenueCat on native platforms after auth resolves
    useEffect(() => {
        if (isNative() && userId) {
            initializePurchases(userId, authUser?.email);
        }
    }, [userId]);

    // Sync session data with loaded sessions
    useEffect(() => { setActiveSessions(loadedSessions); }, [loadedSessions]);
    useEffect(() => { if (sessionSubcollectionError) setError(sessionSubcollectionError); }, [sessionSubcollectionError]);

    // Locally inject a session into activeSessions (before Firestore listener delivers it).
    // Avoids race condition where chart filter updates before onSnapshot fires for server-side writes.
    const addLocalSession = useCallback((session) => {
        if (!session?.id) return;
        setActiveSessions(prev => {
            if (prev.some(s => s.id === session.id)) return prev;
            return [session, ...prev];
        });
    }, []);

    // --- isLoading calculation ---
    const isLoading = !isAuthResolved || !isInitialLoadComplete;

    // --- isDataReady: true when user is authenticated and data is fully loaded ---
    // Use this instead of checking `!activeProfile` for loading states
    const isDataReady = isInitialLoadComplete && !!userId;

    // --- Action to update displayName locally (after cloud function succeeds) ---
    const updateDisplayNameLocally = useCallback((newDisplayName) => {
        setUserData(prev => ({ ...prev, displayName: newDisplayName }));
    }, []);

    // --- Action to update cohortDisplayName locally (after cloud function succeeds) ---
    const updateCohortDisplayNameLocally = useCallback((newName) => {
        setUserData(prev => ({ ...prev, cohortDisplayName: newName }));
    }, []);

    // --- Action to patch upgrade-modal cadence state locally after a callable resolves ---
    // Avoids needing to refresh entire user data after recordUpgradeModalImpression / Dismiss / Accept.
    const updateUpgradeModalStateLocally = useCallback((updates) => {
        setUserData(prev => ({ ...prev, ...updates }));
    }, []);

    // --- Action to patch marketing consent locally after the callable resolves ---
    const updateMarketingConsentLocally = useCallback((emailOptIn) => {
        setUserData(prev => ({
            ...prev,
            marketingConsent: { ...(prev.marketingConsent || {}), emailOptIn },
        }));
    }, []);

    // --- Action to switch game mode ---
    const switchGameMode = useCallback(async (newMode) => {
        // MODE_KEYS: dual, triple, quad, dynamic, singleVisual, singleAudio, singleColor, singleShape
        const validModes = MODE_KEYS;
        if (!validModes.includes(newMode)) {
            console.error(`[UserContext] Invalid game mode: ${newMode}`);
            return;
        }
        if (newMode === activeGameMode) return; // No change needed

        // Update local state immediately
        setActiveGameMode(newMode);

        // Update Firestore (fire and forget for better UX)
        if (authUserRef.current?.uid) {
            try {
                const userDocRef = doc(firestoreDb, 'users', authUserRef.current.uid);
                await updateDoc(userDocRef, {
                    activeGameMode: newMode,
                    updatedAt: serverTimestamp()
                });
            } catch (err) {
                console.error('[UserContext] Failed to update game mode in Firestore:', err);
                // Could revert local state here if needed, but keeping optimistic update
            }
        }
    }, [activeGameMode]);

    // --- Helper to get current mode's progression ---
    // `modeKeyOverride` (optional) reads a different track than the active mode —
    // used by Recall Mode to read 'singleColorRecall' while activeGameMode is
    // still 'singleColor'. Omitting it preserves the original behavior exactly.
    const getCurrentModeProgression = useCallback((modeKeyOverride) => {
        const modeProgression = userData.modeProgression || {};
        return modeProgression[modeKeyOverride || activeGameMode] || getDefaultModeProgression();
    }, [userData.modeProgression, activeGameMode]);

    const getClassicModeProgression = useCallback((modeKeyOverride) => {
        const classicProgression = userData.classicProgression || {};
        // Dynamic shares the dual progression track; single modes each have their
        // own track (singleVisual / singleAudio / singleColor / singleShape) and
        // are looked up directly by their key.
        const mode = modeKeyOverride || (activeGameMode === 'dynamic' ? 'dual' : activeGameMode);
        return classicProgression[mode] || { currentNBack: 2, currentDifficulty: 0.50 };
    }, [userData.classicProgression, activeGameMode]);

    // --- Fetch all-time daily stats (lazy loaded) ---
    const fetchAllTimeData = useCallback(async () => {
        if (!userId) return;

        // If already fetched for this mode, don't refetch
        if (allTimeStatsFetchedForModeRef.current === activeGameMode && allTimeDailyStats !== null) {
            return;
        }

        setIsLoadingAllTimeStats(true);
        try {
            const stats = await fetchAllDailyStats(userId);
            setAllTimeDailyStats(stats);
            allTimeStatsFetchedForModeRef.current = activeGameMode;
        } catch (error) {
            console.error('[UserContext] Error fetching all-time stats:', error);
            setAllTimeDailyStats([]);
        } finally {
            setIsLoadingAllTimeStats(false);
        }
    }, [userId, activeGameMode, allTimeDailyStats]);

    // Clear all-time stats cache when game mode changes
    useEffect(() => {
        if (allTimeStatsFetchedForModeRef.current && allTimeStatsFetchedForModeRef.current !== activeGameMode) {
            // Mode changed, clear the cache so it refetches when "All" is selected again
            setAllTimeDailyStats(null);
            allTimeStatsFetchedForModeRef.current = null;
        }
    }, [activeGameMode]);

    // --- Derived State (Simplified for user-centric structure) ---
    // @DEPRECATED: activeProfile is for backward compatibility only
    // Components should migrate to using:
    //   - isDataReady (boolean) instead of !activeProfile checks
    //   - userId instead of activeProfile.id
    //   - userData.displayName instead of activeProfile.username
    //   - activeSessions instead of activeProfile.sessions
    //   - getCurrentModeProgression() for mode-specific progression values
    const activeProfile = useMemo(() => {
        if (!isInitialLoadComplete || !userId) return null;

        // Get mode-specific progression (with fallback to defaults)
        const modeProgressionData = userData.modeProgression || {};
        const currentModeProgress = modeProgressionData[activeGameMode] || getDefaultModeProgression();

        return {
            ...userData,
            id: userId, // Use userId as the "profile" ID for compatibility
            username: userData.displayName, // Map displayName to username for backward compat
            sessions: activeSessions,
            // Override root-level progression with mode-specific values
            currentNBack: currentModeProgress.currentNBack,
            currentDifficulty: currentModeProgress.currentDifficulty,
            highestNBack: currentModeProgress.highestNBack,
            consecutiveSuccesses: currentModeProgress.consecutiveSuccesses,
            previousNBackLevelDifficulties: currentModeProgress.previousNBackLevelDifficulties || {},
            // Dynamic mode: expose currentSubMode for game setup
            ...(activeGameMode === 'dynamic' && { currentSubMode: currentModeProgress.currentSubMode || 'dual' }),
        };
    }, [userData, activeSessions, isInitialLoadComplete, userId, activeGameMode]);

    // For backward compatibility, provide empty profiles array and activeProfileId
    const profiles = useMemo(() => activeProfile ? [activeProfile] : [], [activeProfile]);
    const activeProfileId = userId; // Use userId as activeProfileId for compatibility

    // Derived free trial state (computed outside useMemo so they update when state changes)
    // Removed 2026-07 — gift retired in favor of the CC trial (ProTrialUpgradeModal).
    // Converted 2/80 vs 64.7% for the card trial, and burned hasHadTrial for takers.
    // Backend activateFreeTrial also returns offer_ended. Full code removal ~30 days out.
    const EXISTING_USER_TRIAL_OFFER_ENABLED = false;
    const isInFreeTrial = subscriptionTier === 'premium' &&
        freeTrialEnd && new Date(freeTrialEnd) > new Date() &&
        userSubscriptionStatus === 'trialing';
    const freeTrialDaysRemaining = freeTrialEnd
        ? Math.max(0, Math.ceil((new Date(freeTrialEnd) - new Date()) / (1000 * 60 * 60 * 24)))
        : 0;
    const freeTrialExpired = freeTrialUsed && !freeTrialDeclined &&
        subscriptionTier === 'free' && freeTrialEnd && new Date(freeTrialEnd) <= new Date();
    // Lifetime trial state (Stripe setup-mode → day-14 charge)
    const isInLifetimeTrial = lifetimeTrialStatus === 'trialing' &&
        lifetimeTrialEndsAt && new Date(lifetimeTrialEndsAt) > new Date();
    const lifetimeTrialDaysRemaining = lifetimeTrialEndsAt
        ? Math.max(0, Math.ceil((new Date(lifetimeTrialEndsAt) - new Date()) / (1000 * 60 * 60 * 24)))
        : 0;
    // True if user is eligible to start a free trial (gates CTA buttons across the app)
    // Session-gated: trial offered as a gift after FREE_TRIAL_SESSION_THRESHOLD sessions
    // Note: freeTrialDeclined only suppresses the auto-pop modal, not CTA buttons
    const canStartFreeTrial = EXISTING_USER_TRIAL_OFFER_ENABLED && !freeTrialUsed && !userHadTrial &&
        !everHadPaidSubscription && subscriptionTier === 'free' && !coachGrantedPremium && totalSessions >= FREE_TRIAL_SESSION_THRESHOLD;

    // --- Classic/Adaptive monetization ---
    // isAdaptiveUser: "can this user play Adaptive at all" — true for Pro, grandfathered,
    // and the new capped cohorts (classic_legacy, limited_modern). Capped cohorts play
    // the free-path Adaptive (5/day cap enforced backend-side); unsnapped Pro algorithm
    // is gated separately via `isFullAdaptive`.
    const isAdaptiveUser = useMemo(() => {
        if (subscriptionType === 'lifetime') return true;
        if (subscriptionTier === 'premium' && (userSubscriptionStatus === 'active' || userSubscriptionStatus === 'trialing')) return true;
        if (coachGrantedPremium) return true;
        if (adaptiveGrandfatherExpiry && new Date(adaptiveGrandfatherExpiry) > new Date()) return true;
        // adaptive_grandfathered: once the expiry passes (Oct 9 2026) these users fall
        // into the capped free-path Adaptive (backend already caps them via !isPro) —
        // without this branch they'd lose the Start Session path entirely at expiry.
        if (freeTier === 'classic_legacy' || freeTier === 'limited_modern' || freeTier === 'adaptive_grandfathered') return true;
        // Defensive: untagged docs (signup race left freeTier unset). Fail open to
        // Adaptive — the backend daily cap governs regardless of the tag.
        if (freeTier === null) return true;
        return false;
    }, [subscriptionType, subscriptionTier, userSubscriptionStatus, coachGrantedPremium, adaptiveGrandfatherExpiry, freeTier]);

    // isPaidPro: real Pro subscription (no grandfather, no freeTier). Drives the
    // two-card dashboard layout and bypasses the daily cap unconditionally.
    const isPaidPro = useMemo(() => (
        subscriptionType === 'lifetime' ||
        (subscriptionTier === 'premium' && (userSubscriptionStatus === 'active' || userSubscriptionStatus === 'trialing')) ||
        coachGrantedPremium === true
    ), [subscriptionType, subscriptionTier, userSubscriptionStatus, coachGrantedPremium]);

    // isGrandfatheredActive: pre-Apr-9 user with a still-valid (>now) grandfather expiry.
    // After Oct 9 2026 this naturally flips to false for all grandfathered users,
    // and the cap branch begins to apply. No migration cron needed.
    const isGrandfatheredActive = useMemo(() => (
        !!adaptiveGrandfatherExpiry && new Date(adaptiveGrandfatherExpiry) > new Date()
    ), [adaptiveGrandfatherExpiry]);

    // isFullAdaptive: full unsnapped Pro algorithm + unlimited Adaptive + Continuous available.
    // Drives the two-card layout vs single-card decision on the dashboard.
    const isFullAdaptive = isPaidPro || isGrandfatheredActive;

    // hasClassicAccess: can play Classic + see the in-card protocol toggle + Insights Protocol toggle.
    // Every existing cohort keeps Classic. Only NEW free signups ('limited_modern') lose Classic.
    // Caveat: Pro / grandfathered-active users get Classic regardless of freeTier — a user who
    // signs up post-relaunch (limited_modern) and then upgrades to Pro should see Classic too.
    const hasClassicAccess = isPaidPro || isGrandfatheredActive || freeTier !== 'limited_modern';

    const grandfatherDaysRemaining = useMemo(() => {
        if (!adaptiveGrandfatherExpiry) return null;
        const days = Math.ceil((new Date(adaptiveGrandfatherExpiry) - new Date()) / (1000 * 60 * 60 * 24));
        return days > 0 ? days : null;
    }, [adaptiveGrandfatherExpiry]);

    const value = useMemo(() => ({
        authUser,
        isAuthLoading: !isAuthResolved,
        isAuthStale,               // True if auth token failed to refresh
        validateAuthToken,         // Function to validate auth token before critical operations
        // User-centric data (PRIMARY - use these)
        userId,                    // Direct user ID access
        userData,                  // Full user data object
        activeSessions,            // Session history array
        addLocalSession,           // Optimistic session injection (avoids onSnapshot race)
        isDataReady,               // True when user is authenticated and data is loaded
        displayName: userData.displayName,
        // Game mode support
        activeGameMode,
        modeProgression: userData.modeProgression,
        switchGameMode,
        getCurrentModeProgression,
        getClassicModeProgression,
        // @DEPRECATED: Backward compatibility (components should migrate to above)
        profiles,
        activeProfileId,
        activeProfile,
        // Legacy profile ID for session fetching
        legacyProfileId,
        // Daily stats for aggregated stats views (Today/Week/Month)
        dailyStats,
        isLoadingDailyStats,
        dailyStatsError,
        // All-time stats (lazy loaded for "All" tab)
        allTimeDailyStats,
        isLoadingAllTimeStats,
        fetchAllTimeData,
        // Loading states
        isLoading,
        error,
        // Subscription data
        userSubscriptionStatus, setUserSubscriptionStatus, userSubscriptionEndDate, userSubscriptionPriceId,
        userSubscriptionCancelAtPeriodEnd, setUserSubscriptionCancelAtPeriodEnd,
        subscriptionTier, setSubscriptionTier, subscriptionPlatform, setSubscriptionPlatform,
        isSubscriptionLoading: isLoading,
        subscriptionError: null,
        userHadTrial,
        freeTrialEnd, freeTrialUsed, freeTrialDeclined, freeTrialExpirySeen,
        isInFreeTrial, freeTrialDaysRemaining, freeTrialExpired, canStartFreeTrial,
        setFreeTrialEnd, setFreeTrialUsed, setFreeTrialDeclined, setFreeTrialExpirySeen,
        showFreeTrialOffer, setShowFreeTrialOffer,
        // Pro-trial upgrade modal (CC-required Stripe trial)
        showProTrialUpgradeModal, setShowProTrialUpgradeModal,
        proTrialUpgradeModalTrigger, setProTrialUpgradeModalTrigger,
        updateUpgradeModalStateLocally,
        updateMarketingConsentLocally,
        totalSessions, setTotalSessions,
        isOnboardingComplete,
        // Actions (removed: selectProfile, addProfile, setProfileUsername, removeProfile)
        updateProfileProgress, markTutorialCompleted,
        addCstResult,
        markOnboardingComplete, checkSubscription,
        fetchPaginatedSessions, fetchAllSessionsForExport, fetchSessionsLightweight,
        updateSessionNote,
        updateDisplayNameLocally,
        updateCohortDisplayNameLocally,
        refreshUserData,
        // Admin
        isAdmin,
        // Coach
        isCoach,
        coachGrantedPremium,
        coachId,
        // Grandfathering
        preMonetizationChange,
        // Rewarded ad sessions
        rewardedProSessions, setRewardedProSessions,
        // Classic/Adaptive monetization
        isAdaptiveUser, adaptiveGrandfatherExpiry, grandfatherDaysRemaining, subscriptionType,
        isPaidPro, isGrandfatheredActive, isFullAdaptive, hasClassicAccess,
        // Free-tier cohort + daily Adaptive cap (relaunch monetization, May 2026)
        freeTier, dailyAdaptiveCount, setDailyAdaptiveCount, dailyAdaptiveCountDate,
        showDailyCapModal, setShowDailyCapModal,
        dailyCapInfo, setDailyCapInfo,
        pendingOfflineCapRejection, setPendingOfflineCapRejection,
        // Lifetime trial state (Stripe setup-mode + day-14 charge)
        lifetimeTrialStatus, setLifetimeTrialStatus, lifetimeTrialEndsAt, isInLifetimeTrial, lifetimeTrialDaysRemaining,
        // Health & Safety disclaimer (lifted from per-mount in <GameScreen> so
        // returning, already-acknowledged users get the countdown immediately).
        // Public shape matches the legacy useHealthSafetyNotice hook return.
        healthSafetyNotice: {
            loading: isLoadingHealthSafety,
            needsAck: healthSafetyNeedsAck,
            notice: getCurrentNotice(),
            isFirstSession: (totalSessions ?? 0) === 0,
            acknowledge: acknowledgeHealthSafety,
            decline: declineHealthSafety,
        },
    }), [
        authUser, isAuthResolved, isAuthStale, validateAuthToken,
        userId, userData, activeSessions, addLocalSession, isDataReady,
        profiles, activeProfileId, activeProfile, legacyProfileId,
        dailyStats, isLoadingDailyStats, dailyStatsError,
        allTimeDailyStats, isLoadingAllTimeStats, fetchAllTimeData,
        isLoading, error, userSubscriptionStatus, setUserSubscriptionStatus, userSubscriptionEndDate, userSubscriptionPriceId,
        userSubscriptionCancelAtPeriodEnd, setUserSubscriptionCancelAtPeriodEnd,
        subscriptionTier, setSubscriptionTier, subscriptionPlatform, setSubscriptionPlatform,
        userHadTrial, isOnboardingComplete,
        freeTrialEnd, freeTrialUsed, freeTrialDeclined, freeTrialExpirySeen,
        isInFreeTrial, freeTrialDaysRemaining, freeTrialExpired, canStartFreeTrial,
        showFreeTrialOffer, totalSessions,
        showProTrialUpgradeModal, proTrialUpgradeModalTrigger,
        updateUpgradeModalStateLocally,
        updateMarketingConsentLocally,
        lifetimeTrialStatus, setLifetimeTrialStatus, lifetimeTrialEndsAt, isInLifetimeTrial, lifetimeTrialDaysRemaining,
        activeGameMode, switchGameMode, getCurrentModeProgression, getClassicModeProgression,
        updateProfileProgress, markTutorialCompleted,
        addCstResult,
        markOnboardingComplete, checkSubscription,
        fetchPaginatedSessions, fetchAllSessionsForExport, fetchSessionsLightweight,
        updateSessionNote,
        updateDisplayNameLocally, updateCohortDisplayNameLocally, refreshUserData,
        isAdmin,
        isCoach, coachGrantedPremium, coachId,
        preMonetizationChange,
        rewardedProSessions, setRewardedProSessions,
        isAdaptiveUser, adaptiveGrandfatherExpiry, grandfatherDaysRemaining, subscriptionType,
        isPaidPro, isGrandfatheredActive, isFullAdaptive, hasClassicAccess,
        freeTier, dailyAdaptiveCount, dailyAdaptiveCountDate,
        showDailyCapModal, dailyCapInfo, pendingOfflineCapRejection,
        isLoadingHealthSafety, healthSafetyNeedsAck, acknowledgeHealthSafety, declineHealthSafety,
    ]);

    return (
        <UserContext.Provider value={value}>
           <React.Fragment key={userId || 'no-user'}>
                {children}
           </React.Fragment>
        </UserContext.Provider>
    );
};

/** @deprecated Use UserProvider instead */
export const ProfileProvider = UserProvider;
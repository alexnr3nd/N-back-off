/* Offline-first local profile context.
 * No Firebase Auth, Firestore, RevenueCat, or account requirement.
 */
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { UserContext, useUser, useProfile } from './user/userContextSetup';
import {
  loadProfileStore, saveProfileStore, createLocalProfile, renameLocalProfile,
  deleteLocalProfile, selectLocalProfile, updateLocalProfile
} from '../services/localProfileStore';
import { MODE_KEYS } from '../constants/modeStyles';

export { useUser, useProfile };

const makeProgression = () => ({
  currentNBack: 2,
  currentDifficulty: 0,
  highestNBack: 2,
  consecutiveSuccesses: 0,
  previousNBackLevelDifficulties: {},
});

const getDefaultUserData = () => ({
  displayName: null,
  currentNBack: 2,
  currentDifficulty: 0,
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
  activeGameMode: 'dual',
  modeProgression: {
    dual: makeProgression(), triple: makeProgression(), quad: makeProgression(),
    dynamic: { ...makeProgression(), currentSubMode: 'dual' },
    singleVisual: makeProgression(), singleAudio: makeProgression(),
    singleColor: makeProgression(), singleShape: makeProgression(),
    singleColorRecall: makeProgression(),
  },
  classicProgression: {
    dual: { currentNBack: 2, currentDifficulty: 0.5 },
    triple: { currentNBack: 2, currentDifficulty: 0.5 },
    quad: { currentNBack: 2, currentDifficulty: 0.5 },
  },
  subscriptionTier: 'free',
  subscriptionStatus: 'free',
  freeTier: 'classic_legacy',
});

const getToday = () => new Date().toISOString().slice(0, 10);

export const UserProvider = ({ children }) => {
  const [store, setStore] = useState(() => loadProfileStore());
  const [error, setError] = useState(null);
  const [dailyAdaptiveCount, setDailyAdaptiveCountState] = useState(0);
  const [showDailyCapModal, setShowDailyCapModal] = useState(false);
  const [dailyCapInfo, setDailyCapInfo] = useState(null);
  const [showProTrialUpgradeModal, setShowProTrialUpgradeModal] = useState(false);
  const [proTrialUpgradeModalTrigger, setProTrialUpgradeModalTrigger] = useState(null);
  const [showFreeTrialOffer, setShowFreeTrialOffer] = useState(false);
  const [rewardedProSessions, setRewardedProSessions] = useState(0);

  const activeProfileRecord = store.profiles.find((profile) => profile.id === store.selectedId) || store.profiles[0];
  const profileId = activeProfileRecord.id;
  const userData = useMemo(() => ({
    ...getDefaultUserData(),
    ...(activeProfileRecord.userData || {}),
    modeProgression: {
      ...getDefaultUserData().modeProgression,
      ...(activeProfileRecord.userData?.modeProgression || {}),
    },
    classicProgression: {
      ...getDefaultUserData().classicProgression,
      ...(activeProfileRecord.userData?.classicProgression || {}),
    },
    activeGameMode: activeProfileRecord.userData?.activeGameMode || 'dual',
  }), [activeProfileRecord]);
  const activeGameMode = userData.activeGameMode || 'dual';
  const activeGameModeRef = useRef(activeGameMode);
  activeGameModeRef.current = activeGameMode;

  const commitStore = useCallback((next) => {
    const saved = saveProfileStore(next);
    setStore(saved);
    return saved;
  }, []);

  const updateUserData = useCallback((updater) => {
    setStore((previous) => {
      const current = previous.profiles.find((profile) => profile.id === previous.selectedId);
      const oldData = { ...getDefaultUserData(), ...(current.userData || {}) };
      const nextData = typeof updater === 'function' ? updater(oldData) : { ...oldData, ...updater };
      const next = updateLocalProfile(previous, current.id, { userData: nextData });
      return next;
    });
  }, []);

  const updateProfileProgress = useCallback(async (targetProfileId, progressData = {}) => {
    if (!progressData || typeof progressData !== 'object') return false;
    const mode = MODE_KEYS.includes(progressData.gameMode) ? progressData.gameMode : activeGameModeRef.current;
    const root = progressData.trainingMode === 'classic' ? 'classicProgression' : 'modeProgression';
    const modeKeys = ['currentNBack','currentDifficulty','highestNBack','consecutiveSuccesses','previousNBackLevelDifficulties','currentSubMode'];
    const rootKeys = ['highestNBackGood','highestAchievedGoodSessionId'];
    const modePatch = {};
    const rootPatch = {};
    for (const key of modeKeys) {
      if (!Object.prototype.hasOwnProperty.call(progressData, key)) continue;
      const value = progressData[key];
      if (key === 'previousNBackLevelDifficulties') {
        if (value === null || (value && typeof value === 'object')) modePatch[key] = value || {};
      } else if (key === 'currentSubMode' && typeof value === 'string') modePatch[key] = value;
      else if (typeof value === 'number' && Number.isFinite(value)) modePatch[key] = value;
    }
    for (const key of rootKeys) {
      if (Object.prototype.hasOwnProperty.call(progressData, key)) rootPatch[key] = progressData[key];
    }
    updateUserData((prev) => ({
      ...prev,
      ...rootPatch,
      [root]: {
        ...(prev[root] || {}),
        [mode]: { ...((prev[root] || {})[mode] || {}), ...modePatch },
      },
    }));
    return true;
  }, [updateUserData]);

  const markTutorialCompleted = useCallback(async (_profileId, tutorialKey) => {
    if (!tutorialKey) return false;
    updateUserData((prev) => ({
      ...prev,
      tutorialsCompleted: { ...(prev.tutorialsCompleted || {}), [tutorialKey]: true },
    }));
    return true;
  }, [updateUserData]);

  const addCstResult = useCallback(async (result) => {
    updateUserData((prev) => ({ ...prev, cstHistory: [...(prev.cstHistory || []), result] }));
    return true;
  }, [updateUserData]);

  const markOnboardingComplete = useCallback(async () => {
    updateUserData({ isOnboardingComplete: true });
    return true;
  }, [updateUserData]);

  const switchGameMode = useCallback(async (mode) => {
    if (!MODE_KEYS.includes(mode)) return false;
    updateUserData((prev) => ({ ...prev, activeGameMode: mode }));
    return true;
  }, [updateUserData]);

  const getCurrentModeProgression = useCallback((modeOverride) => {
    return userData.modeProgression?.[modeOverride || activeGameMode] || makeProgression();
  }, [userData, activeGameMode]);

  const getClassicModeProgression = useCallback((modeOverride) => {
    const mode = modeOverride || (activeGameMode === 'dynamic' ? 'dual' : activeGameMode);
    return userData.classicProgression?.[mode] || { currentNBack: 2, currentDifficulty: 0.5 };
  }, [userData, activeGameMode]);

  const activeSessions = activeProfileRecord.sessions || [];
  const addLocalSession = useCallback((session) => {
    if (!session) return;
    setStore((previous) => {
      const profile = previous.profiles.find((p) => p.id === previous.selectedId);
      const sessions = profile.sessions || [];
      if (session.id && sessions.some((item) => item.id === session.id)) return previous;
      return updateLocalProfile(previous, profile.id, { sessions: [session, ...sessions] });
    });
  }, []);

  const updateSessionNote = useCallback(async (sessionId, note) => {
    setStore((previous) => {
      const profile = previous.profiles.find((p) => p.id === previous.selectedId);
      const sessions = (profile.sessions || []).map((session) => session.id === sessionId ? { ...session, note } : session);
      return updateLocalProfile(previous, profile.id, { sessions });
    });
    return true;
  }, []);

  const fetchPaginatedSessions = useCallback(async (options = {}) => {
    const limit = options.pageSize || options.limit || 20;
    const page = options.page || 0;
    return { sessions: activeSessions.slice(page * limit, (page + 1) * limit), hasMore: (page + 1) * limit < activeSessions.length };
  }, [activeSessions]);
  const fetchAllSessionsForExport = useCallback(async () => activeSessions, [activeSessions]);
  const fetchSessionsLightweight = useCallback(async () => activeSessions.slice(0, 50), [activeSessions]);
  const fetchAllTimeData = useCallback(async () => [], []);

  const addProfile = useCallback(async (profileData = {}) => {
    if (store.profiles.length >= 6) { setError('Limite de 6 perfis atingido.'); return null; }
    const name = typeof profileData === 'string' ? profileData : (profileData.username || profileData.name || `Perfil ${store.profiles.length + 1}`);
    const result = createLocalProfile(store, name);
    const next = updateLocalProfile(result.store, result.profile.id, { userData: getDefaultUserData() });
    setStore(next);
    return { ...result.profile, id: result.profile.id };
  }, [store]);

  const selectProfile = useCallback(async (id) => {
    try { commitStore(selectLocalProfile(store, id)); return true; }
    catch (e) { setError(e.message); return false; }
  }, [store, commitStore]);

  const removeProfile = useCallback(async (id) => {
    try { commitStore(deleteLocalProfile(store, id)); return true; }
    catch (e) { setError(e.message); return false; }
  }, [store, commitStore]);

  const renameProfile = useCallback(async (id, name) => {
    try { commitStore(renameLocalProfile(store, id, name)); return true; }
    catch (e) { setError(e.message); return false; }
  }, [store, commitStore]);

  const updateDisplayNameLocally = useCallback((name) => {
    updateUserData((prev) => ({ ...prev, displayName: name }));
  }, [updateUserData]);
  const updateCohortDisplayNameLocally = updateDisplayNameLocally;
  const updateMarketingConsentLocally = useCallback(() => {}, []);
  const updateUpgradeModalStateLocally = useCallback(() => {}, []);
  const refreshUserData = useCallback(() => { setError(null); }, []);

  const todaySessions = activeSessions.filter((session) => {
    const date = session.createdAt || session.date || session.timestamp;
    return date && new Date(date).toISOString().slice(0, 10) === getToday();
  });
  const totalSessions = activeSessions.length;
  const activeProfile = useMemo(() => {
    const progression = userData.modeProgression?.[activeGameMode] || makeProgression();
    return {
      ...userData, id: profileId, username: activeProfileRecord.name,
      displayName: userData.displayName || activeProfileRecord.name,
      sessions: activeSessions,
      currentNBack: progression.currentNBack ?? 2,
      currentDifficulty: progression.currentDifficulty ?? 0,
      highestNBack: progression.highestNBack ?? 2,
      consecutiveSuccesses: progression.consecutiveSuccesses ?? 0,
      previousNBackLevelDifficulties: progression.previousNBackLevelDifficulties || {},
      ...(activeGameMode === 'dynamic' ? { currentSubMode: progression.currentSubMode || 'dual' } : {}),
    };
  }, [userData, profileId, activeProfileRecord, activeSessions, activeGameMode]);

  const profiles = useMemo(() => store.profiles.map((profile) => ({
    ...profile, username: profile.name, sessions: profile.sessions || [],
    ...(profile.userData || {}),
  })), [store]);
  const authUser = useMemo(() => ({
    uid: profileId, displayName: activeProfile.displayName, email: null,
    getIdTokenResult: async () => ({ claims: {} }),
  }), [profileId, activeProfile.displayName]);

  const noOp = useCallback(async () => true, []);
  const [subscriptionTier, setSubscriptionTier] = useState('free');
  const [userSubscriptionStatus, setUserSubscriptionStatus] = useState('free');
  const [subscriptionPlatform, setSubscriptionPlatform] = useState(null);
  const [totalSessionsOverride, setTotalSessionsOverride] = useState(null);
  const setTotalSessions = setTotalSessionsOverride;

  const value = useMemo(() => ({
    authUser, isAuthLoading: false, isAuthResolved: true, isAuthStale: false,
    validateAuthToken: noOp, userId: profileId, userData, activeSessions, addLocalSession,
    isDataReady: true, displayName: activeProfile.displayName,
    activeGameMode, modeProgression: userData.modeProgression, switchGameMode,
    getCurrentModeProgression, getClassicModeProgression,
    profiles, activeProfileId: profileId, activeProfile, legacyProfileId: null,
    dailyStats: [], isLoadingDailyStats: false, dailyStatsError: null,
    allTimeDailyStats: [], isLoadingAllTimeStats: false, fetchAllTimeData,
    isLoading: false, isLoadingProfile: false, loadingAuth: false, loading: false, error,
    userSubscriptionStatus, setUserSubscriptionStatus, userSubscriptionEndDate: null,
    userSubscriptionPriceId: null, userSubscriptionCancelAtPeriodEnd: false,
    setUserSubscriptionCancelAtPeriodEnd: noOp,
    subscriptionTier, setSubscriptionTier, subscriptionPlatform, setSubscriptionPlatform,
    subscriptionError: null, isSubscriptionLoading: false,
    userHadTrial: false, freeTrialEnd: null, freeTrialUsed: false, freeTrialDeclined: false,
    freeTrialExpirySeen: false, isInFreeTrial: false, freeTrialDaysRemaining: 0,
    freeTrialExpired: false, canStartFreeTrial: false, setFreeTrialEnd: noOp,
    setFreeTrialUsed: noOp, setFreeTrialDeclined: noOp, setFreeTrialExpirySeen: noOp,
    showFreeTrialOffer, setShowFreeTrialOffer, showProTrialUpgradeModal,
    setShowProTrialUpgradeModal, proTrialUpgradeModalTrigger, setProTrialUpgradeModalTrigger,
    updateUpgradeModalStateLocally, updateMarketingConsentLocally,
    totalSessions: totalSessionsOverride ?? totalSessions, setTotalSessions,
    isOnboardingComplete: true, updateProfileProgress, markTutorialCompleted,
    addCstResult, markOnboardingComplete, checkSubscription: noOp,
    fetchPaginatedSessions, fetchAllSessionsForExport, fetchSessionsLightweight,
    updateSessionNote, updateDisplayNameLocally, updateCohortDisplayNameLocally,
    refreshUserData, isAdmin: false, isCoach: false, coachGrantedPremium: false, coachId: null,
    preMonetizationChange: false, rewardedProSessions, setRewardedProSessions,
    isAdaptiveUser: true, adaptiveGrandfatherExpiry: null, grandfatherDaysRemaining: null,
    subscriptionType: null, isPaidPro: false, isGrandfatheredActive: false,
    isFullAdaptive: false, hasClassicAccess: true, freeTier: 'classic_legacy',
    dailyAdaptiveCount, setDailyAdaptiveCount: setDailyAdaptiveCountState,
    dailyAdaptiveCountDate: getToday(), showDailyCapModal, setShowDailyCapModal,
    dailyCapInfo, setDailyCapInfo, pendingOfflineCapRejection: null,
    setPendingOfflineCapRejection: noOp, lifetimeTrialStatus: null,
    setLifetimeTrialStatus: noOp, lifetimeTrialEndsAt: null,
    isInLifetimeTrial: false, lifetimeTrialDaysRemaining: 0,
    healthSafetyNotice: { loading: false, needsAck: false, notice: null, isFirstSession: totalSessions === 0, acknowledge: noOp, decline: noOp },
    addProfile, selectProfile, removeProfile, renameProfile,
    setProfileUsername: renameProfile,
  }), [
    authUser, noOp, profileId, userData, activeSessions, addLocalSession, activeProfile,
    activeGameMode, switchGameMode, getCurrentModeProgression, getClassicModeProgression,
    profiles, fetchAllTimeData, error, userSubscriptionStatus, subscriptionTier,
    subscriptionPlatform, totalSessionsOverride, totalSessions, showFreeTrialOffer,
    showProTrialUpgradeModal, proTrialUpgradeModalTrigger, updateUpgradeModalStateLocally,
    updateMarketingConsentLocally, isOnboardingComplete, updateProfileProgress,
    markTutorialCompleted, addCstResult, markOnboardingComplete, fetchPaginatedSessions,
    fetchAllSessionsForExport, fetchSessionsLightweight, updateSessionNote,
    updateDisplayNameLocally, updateCohortDisplayNameLocally, refreshUserData,
    rewardedProSessions, dailyAdaptiveCount, showDailyCapModal, dailyCapInfo,
    addProfile, selectProfile, removeProfile, renameProfile,
  ]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const ProfileProvider = UserProvider;

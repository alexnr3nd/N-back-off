/* Offline-first local profile context. */
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { UserContext, useUser, useProfile } from './user/userContextSetup';
import { loadProfileStore, saveProfileStore, createLocalProfile, renameLocalProfile, deleteLocalProfile, selectLocalProfile, updateLocalProfile } from '../services/localProfileStore';
import { MODE_KEYS } from '../constants/modeStyles';
export { useUser, useProfile };

const progression = () => ({ currentNBack: 2, currentDifficulty: 0, highestNBack: 2, consecutiveSuccesses: 0, previousNBackLevelDifficulties: {} });
const defaults = () => ({
  displayName: null, currentNBack: 2, currentDifficulty: 0, highestNBack: 2, consecutiveSuccesses: 0,
  tutorialsCompleted: {}, cstHistory: [], reasoningCheckHistory: [], cstFamiliarizationCount: 0,
  lastCstAssessmentTimestamp: null, highestNBackGood: null, highestAchievedGoodSessionId: null,
  previousNBackLevelDifficulties: {}, activeGameMode: 'dual',
  modeProgression: {
    dual: progression(), triple: progression(), quad: progression(),
    dynamic: { ...progression(), currentSubMode: 'dual' },
    singleVisual: progression(), singleAudio: progression(), singleColor: progression(),
    singleShape: progression(), singleColorRecall: progression(),
  },
  classicProgression: { dual: { currentNBack: 2, currentDifficulty: 0.5 }, triple: { currentNBack: 2, currentDifficulty: 0.5 }, quad: { currentNBack: 2, currentDifficulty: 0.5 } },
  subscriptionTier: 'free', subscriptionStatus: 'free', freeTier: 'classic_legacy',
});
const today = () => new Date().toISOString().slice(0, 10);

export const UserProvider = ({ children }) => {
  const [store, setStore] = useState(() => loadProfileStore());
  const [error, setError] = useState(null);
  const [showDailyCapModal, setShowDailyCapModal] = useState(false);
  const [dailyCapInfo, setDailyCapInfo] = useState(null);
  const [dailyAdaptiveCount, setDailyAdaptiveCount] = useState(0);
  const [showProTrialUpgradeModal, setShowProTrialUpgradeModal] = useState(false);
  const [proTrialUpgradeModalTrigger, setProTrialUpgradeModalTrigger] = useState(null);
  const [showFreeTrialOffer, setShowFreeTrialOffer] = useState(false);
  const [rewardedProSessions, setRewardedProSessions] = useState(0);
  const record = store.profiles.find(p => p.id === store.selectedId) || store.profiles[0];
  const profileId = record.id;
  const userData = useMemo(() => {
    const base = defaults();
    const saved = record.userData || {};
    return { ...base, ...saved, modeProgression: { ...base.modeProgression, ...(saved.modeProgression || {}) }, classicProgression: { ...base.classicProgression, ...(saved.classicProgression || {}) } };
  }, [record]);
  const activeGameMode = userData.activeGameMode || 'dual';
  const activeGameModeRef = useRef(activeGameMode);
  activeGameModeRef.current = activeGameMode;
  const sessions = record.sessions || [];

  const commit = useCallback(next => { const saved = saveProfileStore(next); setStore(saved); return saved; }, []);
  const updateUserData = useCallback(updater => {
    setStore(previous => {
      const current = previous.profiles.find(p => p.id === previous.selectedId);
      const prior = { ...defaults(), ...(current.userData || {}) };
      const nextData = typeof updater === 'function' ? updater(prior) : { ...prior, ...updater };
      return updateLocalProfile(previous, current.id, { userData: nextData });
    });
  }, []);

  const updateProfileProgress = useCallback(async (_id, data = {}) => {
    if (!data || typeof data !== 'object') return false;
    const mode = MODE_KEYS.includes(data.gameMode) ? data.gameMode : activeGameModeRef.current;
    const root = data.trainingMode === 'classic' ? 'classicProgression' : 'modeProgression';
    const modeKeys = ['currentNBack','currentDifficulty','highestNBack','consecutiveSuccesses','previousNBackLevelDifficulties','currentSubMode'];
    const modePatch = {};
    for (const key of modeKeys) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      const value = data[key];
      if (key === 'previousNBackLevelDifficulties' && (value === null || typeof value === 'object')) modePatch[key] = value || {};
      else if (key === 'currentSubMode' && typeof value === 'string') modePatch[key] = value;
      else if (typeof value === 'number' && Number.isFinite(value)) modePatch[key] = value;
    }
    const rootPatch = {};
    for (const key of ['highestNBackGood','highestAchievedGoodSessionId']) if (Object.prototype.hasOwnProperty.call(data,key)) rootPatch[key] = data[key];
    updateUserData(prev => ({ ...prev, ...rootPatch, [root]: { ...(prev[root] || {}), [mode]: { ...((prev[root] || {})[mode] || {}), ...modePatch } } }));
    return true;
  }, [updateUserData]);

  const markTutorialCompleted = useCallback(async (_id, key) => {
    if (!key) return false;
    updateUserData(prev => ({ ...prev, tutorialsCompleted: { ...(prev.tutorialsCompleted || {}), [key]: true } }));
    return true;
  }, [updateUserData]);
  const addCstResult = useCallback(async result => {
    updateUserData(prev => ({ ...prev, cstHistory: [...(prev.cstHistory || []), result] }));
    return true;
  }, [updateUserData]);
  const markOnboardingComplete = useCallback(async () => true, []);
  const switchGameMode = useCallback(async mode => {
    if (!MODE_KEYS.includes(mode)) return false;
    updateUserData(prev => ({ ...prev, activeGameMode: mode }));
    return true;
  }, [updateUserData]);
  const getCurrentModeProgression = useCallback(mode => userData.modeProgression?.[mode || activeGameMode] || progression(), [userData, activeGameMode]);
  const getClassicModeProgression = useCallback(mode => userData.classicProgression?.[mode || (activeGameMode === 'dynamic' ? 'dual' : activeGameMode)] || { currentNBack: 2, currentDifficulty: 0.5 }, [userData, activeGameMode]);

  const addLocalSession = useCallback(session => {
    if (!session) return;
    setStore(previous => {
      const current = previous.profiles.find(p => p.id === previous.selectedId);
      if (session.id && (current.sessions || []).some(s => s.id === session.id)) return previous;
      return updateLocalProfile(previous, current.id, { sessions: [session, ...(current.sessions || [])] });
    });
  }, []);
  const updateSessionNote = useCallback(async (sessionId, note) => {
    setStore(previous => {
      const current = previous.profiles.find(p => p.id === previous.selectedId);
      return updateLocalProfile(previous, current.id, { sessions: (current.sessions || []).map(s => s.id === sessionId ? { ...s, note } : s) });
    });
    return true;
  }, []);
  const fetchPaginatedSessions = useCallback(async (opts = {}) => {
    const size = opts.pageSize || opts.limit || 20, page = opts.page || 0;
    return { sessions: sessions.slice(page * size, (page + 1) * size), hasMore: (page + 1) * size < sessions.length };
  }, [sessions]);
  const fetchAllSessionsForExport = useCallback(async () => sessions, [sessions]);
  const fetchSessionsLightweight = useCallback(async () => sessions.slice(0, 50), [sessions]);
  const fetchAllTimeData = useCallback(async () => [], []);
  const refreshUserData = useCallback(() => setError(null), []);
  const updateDisplayNameLocally = useCallback(name => updateUserData(prev => ({ ...prev, displayName: name })), [updateUserData]);
  const updateCohortDisplayNameLocally = updateDisplayNameLocally;
  const updateMarketingConsentLocally = useCallback(() => {}, []);
  const updateUpgradeModalStateLocally = useCallback(() => {}, []);
  const noOp = useCallback(async () => true, []);

  const addProfile = useCallback(async data => {
    if (store.profiles.length >= 6) { setError('Limite de 6 perfis atingido.'); return null; }
    const name = typeof data === 'string' ? data : (data?.username || data?.name || `Perfil ${store.profiles.length + 1}`);
    const created = createLocalProfile(store, name);
    const next = updateLocalProfile(created.store, created.profile.id, { userData: defaults() });
    setStore(next);
    return { ...created.profile, username: created.profile.name };
  }, [store]);
  const selectProfile = useCallback(async id => { try { commit(selectLocalProfile(store,id)); return true; } catch(e) { setError(e.message); return false; } }, [store,commit]);
  const removeProfile = useCallback(async id => { try { commit(deleteLocalProfile(store,id)); return true; } catch(e) { setError(e.message); return false; } }, [store,commit]);
  const renameProfile = useCallback(async (id,name) => { try { commit(renameLocalProfile(store,id,name)); return true; } catch(e) { setError(e.message); return false; } }, [store,commit]);

  const activeProfile = useMemo(() => {
    const p = userData.modeProgression?.[activeGameMode] || progression();
    return { ...userData, id: profileId, username: record.name, displayName: userData.displayName || record.name, sessions, currentNBack: p.currentNBack ?? 2, currentDifficulty: p.currentDifficulty ?? 0, highestNBack: p.highestNBack ?? 2, consecutiveSuccesses: p.consecutiveSuccesses ?? 0, previousNBackLevelDifficulties: p.previousNBackLevelDifficulties || {}, ...(activeGameMode === 'dynamic' ? { currentSubMode: p.currentSubMode || 'dual' } : {}) };
  }, [userData, profileId, record, sessions, activeGameMode]);
  const profiles = useMemo(() => store.profiles.map(p => ({ ...p, username: p.name, sessions: p.sessions || [], ...(p.userData || {}) })), [store]);
  const totalSessions = sessions.length;
  const todayAdaptive = sessions.filter(s => (s.trainingMode || s.mode) === 'adaptive' && new Date(s.createdAt || s.timestamp || 0).toISOString().slice(0,10) === today()).length;

  const value = useMemo(() => ({
    authUser: null, isAuthLoading: false, isAuthResolved: true, isAuthStale: false, isLocalMode: true,
    validateAuthToken: noOp, userId: null, userData, activeSessions: sessions, addLocalSession,
    isDataReady: true, displayName: activeProfile.displayName, activeGameMode, modeProgression: userData.modeProgression,
    switchGameMode, getCurrentModeProgression, getClassicModeProgression,
    profiles, activeProfileId: profileId, activeProfile, legacyProfileId: null,
    dailyStats: [], isLoadingDailyStats: false, dailyStatsError: null, allTimeDailyStats: [], isLoadingAllTimeStats: false, fetchAllTimeData,
    isLoading: false, isLoadingProfile: false, loadingAuth: false, loading: false, error,
    userSubscriptionStatus: 'free', setUserSubscriptionStatus: noOp, userSubscriptionEndDate: null, userSubscriptionPriceId: null, userSubscriptionCancelAtPeriodEnd: false, setUserSubscriptionCancelAtPeriodEnd: noOp,
    subscriptionTier: 'free', setSubscriptionTier: noOp, subscriptionPlatform: null, setSubscriptionPlatform: noOp, subscriptionError: null, isSubscriptionLoading: false,
    userHadTrial: false, freeTrialEnd: null, freeTrialUsed: false, freeTrialDeclined: false, freeTrialExpirySeen: false, isInFreeTrial: false, freeTrialDaysRemaining: 0, freeTrialExpired: false, canStartFreeTrial: false, setFreeTrialEnd: noOp, setFreeTrialUsed: noOp, setFreeTrialDeclined: noOp, setFreeTrialExpirySeen: noOp,
    showFreeTrialOffer, setShowFreeTrialOffer, showProTrialUpgradeModal, setShowProTrialUpgradeModal, proTrialUpgradeModalTrigger, setProTrialUpgradeModalTrigger, updateUpgradeModalStateLocally, updateMarketingConsentLocally,
    totalSessions, setTotalSessions: noOp, isOnboardingComplete: true, updateProfileProgress, markTutorialCompleted, addCstResult, markOnboardingComplete,
    checkSubscription: noOp, fetchPaginatedSessions, fetchAllSessionsForExport, fetchSessionsLightweight, updateSessionNote, updateDisplayNameLocally, updateCohortDisplayNameLocally, refreshUserData,
    isAdmin: false, isCoach: false, coachGrantedPremium: false, coachId: null, preMonetizationChange: false, rewardedProSessions, setRewardedProSessions,
    isAdaptiveUser: true, adaptiveGrandfatherExpiry: null, grandfatherDaysRemaining: null, subscriptionType: null, isPaidPro: false, isGrandfatheredActive: false, isFullAdaptive: false, hasClassicAccess: true, freeTier: 'classic_legacy',
    dailyAdaptiveCount: Math.max(dailyAdaptiveCount, todayAdaptive), setDailyAdaptiveCount, dailyAdaptiveCountDate: today(), showDailyCapModal, setShowDailyCapModal, dailyCapInfo, setDailyCapInfo, pendingOfflineCapRejection: null, setPendingOfflineCapRejection: noOp,
    lifetimeTrialStatus: null, setLifetimeTrialStatus: noOp, lifetimeTrialEndsAt: null, isInLifetimeTrial: false, lifetimeTrialDaysRemaining: 0,
    healthSafetyNotice: { loading: false, needsAck: false, notice: null, isFirstSession: totalSessions === 0, acknowledge: noOp, decline: noOp },
    addProfile, selectProfile, removeProfile, renameProfile, setProfileUsername: renameProfile,
  }), [noOp,userData,sessions,addLocalSession,activeProfile,activeGameMode,switchGameMode,getCurrentModeProgression,getClassicModeProgression,profiles,profileId,fetchAllTimeData,error,showFreeTrialOffer,showProTrialUpgradeModal,proTrialUpgradeModalTrigger,updateUpgradeModalStateLocally,updateMarketingConsentLocally,totalSessions,updateProfileProgress,markTutorialCompleted,addCstResult,markOnboardingComplete,fetchPaginatedSessions,fetchAllSessionsForExport,fetchSessionsLightweight,updateSessionNote,updateDisplayNameLocally,updateCohortDisplayNameLocally,refreshUserData,rewardedProSessions,dailyAdaptiveCount,setDailyAdaptiveCount,showDailyCapModal,dailyCapInfo,addProfile,selectProfile,removeProfile,renameProfile]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
export const ProfileProvider = UserProvider;

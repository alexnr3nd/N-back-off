/* src/contexts/PresenceContext.js */
import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useUser } from './UserContext';
import { useGame } from './GameContext';
import { useSettings } from './SettingsContext';
import { getPlatform } from '../utils/platform';
import { isFirestoreBroken, scheduleRecovery } from '../utils/firestoreRecovery';

const PresenceContext = createContext(null);

export const usePresence = () => useContext(PresenceContext);

// Route name mapping for friendly display
const routeNames = {
    '/': 'Home',
    '/dashboard': 'Dashboard',
    '/game': 'Game',
    '/tutorial': 'Tutorial',
    '/insights': 'Insights',
    '/sessions': 'Sessions',
    '/settings': 'Settings',
    '/admin': 'Admin Dashboard',
    '/login': 'Login',
    '/signup': 'Sign Up',
    '/subscribe': 'Subscribe',
    '/loading': 'Loading',
    '/reset-password': 'Reset Password',
};

// Get friendly route name from pathname
const getRouteName = (pathname) => {
    // Check exact matches first
    if (routeNames[pathname]) {
        return routeNames[pathname];
    }
    // Check for partial matches (e.g., /admin/login -> Admin Login)
    if (pathname.startsWith('/admin')) {
        return 'Admin Dashboard';
    }
    if (pathname.startsWith('/share/replay')) {
        return 'Viewing Replay';
    }
    // Default: capitalize the path segment
    const segment = pathname.split('/').filter(Boolean)[0] || 'Home';
    return segment.charAt(0).toUpperCase() + segment.slice(1);
};

// Heartbeat interval in milliseconds (60 seconds — Firebase best practice for Firestore presence)
const HEARTBEAT_INTERVAL = 60000;
// Minimum gap between state-change heartbeats to prevent write storms
// 10s aligns with Firebase's own heartbeat defaults
const MIN_HEARTBEAT_GAP = 10000;

export const PresenceProvider = ({ children }) => {
    const { authUser, userData, subscriptionTier } = useUser();
    const location = useLocation();
    const { gameState, currentTrial, totalTrials, nBack, difficulty, gameMode, gameResults, sessionSettingsRef } = useGame();
    const { settings } = useSettings();

    const lastHeartbeatRef = useRef(null);
    const pageEnterTimeRef = useRef(Date.now());
    const lastInteractionRef = useRef(Date.now()); // Track last real user interaction (click/key/touch)
    const lastThrottledUpdateRef = useRef(0); // Throttle high-frequency events (mousemove/scroll)
    const intervalRef = useRef(null);
    const currentRouteRef = useRef(location.pathname);
    const presenceDisabledRef = useRef(false); // Set true on fatal Firestore errors to stop writes
    const gameStartedAtRef = useRef(null); // Timestamp when game entered 'playing' — for admin trial estimation

    // Protocol Guide state tracking
    const [protocolGuideState, setProtocolGuideState] = useState(null);
    // protocolGuideState shape: { isOpen: boolean, view: 'hub' | 'section', sectionId: string | null, sectionTitle: string | null }

    // CST (Counting Span Task) progress tracking
    const [cstProgressState, setCstProgress] = useState(null);
    // cstProgressState shape: { currentSet, totalSets, currentTrialInSet, setSize, phase, isFamiliarization, isPractice }

    // Upgrade prompt state tracking (checkout or declined)
    const [upgradePromptState, setUpgradePromptState] = useState(null);
    // upgradePromptState shape: { type: 'checkout' | 'declined', plan: 'monthly' | 'yearly' | null, startedAt: number }

    // Track when route changes
    useEffect(() => {
        if (location.pathname !== currentRouteRef.current) {
            pageEnterTimeRef.current = Date.now();
            currentRouteRef.current = location.pathname;
        }
    }, [location.pathname]);

    // Determine activity state based on game state, route, Protocol Guide, and upgrade prompts
    const getActivityState = useCallback(() => {
        // Check if user is in upgrade prompt flow (checkout or declined)
        if (upgradePromptState?.type === 'checkout') {
            return 'checkout';
        }
        if (upgradePromptState?.type === 'declined') {
            return 'declined-upgrade';
        }

        // Check if Protocol Guide is open
        if (protocolGuideState?.isOpen) {
            return 'protocol-guide';
        }

        // CST assessment tracking (before game state checks)
        if (cstProgressState) {
            return 'assessment';
        }

        const isGameRoute = location.pathname === '/game' || location.pathname === '/tutorial';

        if (!isGameRoute) {
            return 'idle';
        }

        // Map game states to activity states
        switch (gameState) {
            case 'playing':
                return 'playing';
            case 'paused':
                return 'paused';
            case 'preparing':
                return 'preparing';
            case 'results':
                return 'results';
            default:
                return 'idle';
        }
    }, [location.pathname, gameState, protocolGuideState, upgradePromptState, cstProgressState]);

    // Build presence data object
    const buildPresenceData = useCallback(() => {
        const activity = getActivityState();
        const isPlaying = activity === 'playing' || activity === 'paused' || activity === 'preparing';
        const isViewingResults = activity === 'results' && gameResults;
        const isInProtocolGuide = activity === 'protocol-guide';
        const isInAssessment = activity === 'assessment';
        const isInUpgradePrompt = activity === 'checkout' || activity === 'declined-upgrade';

        return {
            lastSeen: serverTimestamp(),
            route: location.pathname,
            routeName: activity === 'checkout' ? 'Stripe Checkout' : getRouteName(location.pathname),
            activity,
            gameProgress: isPlaying ? {
                gameState,
                currentTrial: currentTrial + 1, // 0-indexed to 1-indexed for display
                totalTrials,
                nBack,
                difficulty: parseFloat(difficulty.toFixed(2)),
                gameMode: gameMode || 'dual', // dual, triple, or quad
                trainingMode: sessionSettingsRef?.current?.trainingMode || null, // 'adaptive' | 'classic' | 'dynamic'
                // Timing params — admin panel estimates trial position between heartbeats
                startedAt: gameStartedAtRef.current,
                calculatedISI: sessionSettingsRef?.current?.calculatedISI || null,
            } : null,
            sessionResults: isViewingResults ? {
                overallDprime: gameResults.overallDprime ?? null,
                oldNBack: gameResults.oldNBack ?? null,
                oldDifficulty: gameResults.oldDifficulty ?? null,
                newNBack: gameResults.newNBack ?? null,
                newDifficulty: gameResults.newDifficulty ?? null,
                gameMode: gameResults.gameMode || 'dual',
            } : null,
            protocolGuide: isInProtocolGuide ? {
                view: protocolGuideState?.view || 'hub',
                sectionId: protocolGuideState?.sectionId || null,
                sectionTitle: protocolGuideState?.sectionTitle || null,
                isPracticing: protocolGuideState?.isPracticing || false,
            } : null,
            cstProgress: isInAssessment ? {
                currentSet: cstProgressState.currentSet,
                totalSets: cstProgressState.totalSets,
                currentTrialInSet: cstProgressState.currentTrialInSet,
                setSize: cstProgressState.setSize,
                phase: cstProgressState.phase,
                isFamiliarization: cstProgressState.isFamiliarization,
                isPractice: cstProgressState.isPractice,
            } : null,
            upgradePrompt: isInUpgradePrompt ? {
                type: upgradePromptState?.type || null,
                plan: upgradePromptState?.plan || null,
                startedAt: upgradePromptState?.startedAt || null,
            } : null,
            pageEnterTime: pageEnterTimeRef.current,
            lastInteraction: lastInteractionRef.current,
            displayName: userData?.displayName || userData?.username || 'Anonymous',
            email: authUser?.email || null,
            subscriptionTier: subscriptionTier || 'free',
            platform: getPlatform(),
        };
    }, [location.pathname, getActivityState, gameState, currentTrial, totalTrials, nBack, difficulty, gameMode, gameResults, userData, authUser, protocolGuideState, cstProgressState, upgradePromptState, subscriptionTier]);

    // Refs for stable sendHeartbeat identity — avoids write amplification from
    // interval effect restarting every time game state changes (~every 3s during gameplay)
    const buildPresenceDataRef = useRef(buildPresenceData);
    useEffect(() => { buildPresenceDataRef.current = buildPresenceData; }, [buildPresenceData]);

    const cohortDataRef = useRef({
        cohortId: userData?.activeCohortId,
        cohortPrivacy: settings?.cohortPrivacy,
        getActivityState,
        currentTrial, totalTrials, nBack, difficulty, gameMode,
    });
    useEffect(() => {
        cohortDataRef.current = {
            cohortId: userData?.activeCohortId,
            cohortPrivacy: settings?.cohortPrivacy,
            getActivityState,
            currentTrial, totalTrials, nBack, difficulty, gameMode,
        };
    }, [userData?.activeCohortId, settings?.cohortPrivacy, getActivityState, currentTrial, totalTrials, nBack, difficulty, gameMode]);

    // Send heartbeat to Firestore
    const sendHeartbeat = useCallback(async (force = false) => {
        if (!authUser?.uid || presenceDisabledRef.current || isFirestoreBroken()) return;

        // Throttle non-forced heartbeats (state-change triggers)
        if (!force) {
            const timeSinceLast = Date.now() - (lastHeartbeatRef.current || 0);
            if (timeSinceLast < MIN_HEARTBEAT_GAP) return;
        }

        try {
            const presenceRef = doc(db, 'presence', authUser.uid);
            const presenceData = buildPresenceDataRef.current();
            await setDoc(presenceRef, presenceData);
            lastHeartbeatRef.current = Date.now();
        } catch (error) {
            const msg = error?.message || '';
            const isFatalFirestoreError =
                msg.includes('QuotaExceeded') || error?.name === 'QuotaExceededError' ||
                msg.includes('INTERNAL ASSERTION FAILED') || msg.includes('Unexpected state');

            if (isFatalFirestoreError) {
                console.error('[Presence] Disabled due to Firestore error:', msg.slice(0, 120));
                presenceDisabledRef.current = true;
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
                scheduleRecovery(db);
                return;
            }
            console.warn('Presence heartbeat failed:', error.message);
        }

        // Skip cohort writes if presence was just disabled
        if (presenceDisabledRef.current) return;

        // Write cohort presence to member doc (if in a cohort)
        const { cohortId, cohortPrivacy, getActivityState: getActivity,
            currentTrial: ct, totalTrials: tt, nBack: nb, difficulty: diff, gameMode: gm
        } = cohortDataRef.current;
        const showOnline = cohortPrivacy?.showOnlineStatus !== false;

        if (cohortId && showOnline) {
            const activity = getActivity();
            const isPlaying = activity === 'playing' || activity === 'paused' || activity === 'preparing';
            const showGame = cohortPrivacy?.showGameActivity !== false;

            const memberRef = doc(db, 'cohorts', cohortId, 'members', authUser.uid);
            setDoc(memberRef, {
                cohortPresence: {
                    lastSeen: serverTimestamp(),
                    activity: showGame ? activity : 'idle',
                    gameProgress: (showGame && isPlaying) ? {
                        currentTrial: ct + 1,
                        totalTrials: tt,
                        nBack: nb,
                        difficulty: parseFloat(diff.toFixed(2)),
                        gameMode: gm || 'dual',
                    } : null,
                }
            }, { merge: true }).catch(() => {}); // Silent fail — non-critical
        } else if (cohortId) {
            // Online status is OFF — clear any existing presence
            setDoc(doc(db, 'cohorts', cohortId, 'members', authUser.uid), {
                cohortPresence: null
            }, { merge: true }).catch(() => {});
        }
    }, [authUser?.uid]); // Stable identity — reads fast-changing data from refs

    // Mark user as offline
    const markOffline = useCallback(async () => {
        if (!authUser?.uid || presenceDisabledRef.current || isFirestoreBroken()) return;

        // Don't mark offline if user is in checkout flow - they're navigating to Stripe
        if (upgradePromptState?.type === 'checkout') {
            return;
        }

        try {
            const presenceRef = doc(db, 'presence', authUser.uid);
            await setDoc(presenceRef, {
                lastSeen: serverTimestamp(),
                route: location.pathname,
                routeName: getRouteName(location.pathname),
                activity: 'offline',
                gameProgress: null,
                upgradePrompt: null,
                displayName: userData?.displayName || userData?.username || 'Anonymous',
                email: authUser?.email || null,
                subscriptionTier: subscriptionTier || 'free',
                platform: getPlatform(),
            });
        } catch (error) {
            const msg = error?.message || '';
            if (msg.includes('INTERNAL ASSERTION FAILED') || msg.includes('Unexpected state')) {
                presenceDisabledRef.current = true;
            }
            console.warn('Presence offline marker failed:', error.message);
        }

        if (presenceDisabledRef.current) return;

        // Clear cohort presence on member doc
        if (userData?.activeCohortId) {
            setDoc(doc(db, 'cohorts', userData.activeCohortId, 'members', authUser.uid), {
                cohortPresence: null
            }, { merge: true }).catch(() => {});
        }
    }, [authUser?.uid, authUser?.email, location.pathname, userData, subscriptionTier, upgradePromptState]);

    // Set up heartbeat interval + pause/resume on tab visibility
    useEffect(() => {
        if (!authUser?.uid) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        const startInterval = () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => sendHeartbeat(true), HEARTBEAT_INTERVAL);
        };

        // Send initial heartbeat and start interval
        sendHeartbeat(true);
        startInterval();

        // Pause heartbeats when tab is hidden, resume when visible
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                // Send one final heartbeat, then stop — backgrounded tabs shouldn't accumulate writes
                sendHeartbeat(true);
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            } else {
                // Tab is visible again — resume
                sendHeartbeat(true);
                startInterval();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [authUser?.uid, sendHeartbeat]);

    // Track real user interactions for AFK detection
    useEffect(() => {
        const updateInteraction = () => { lastInteractionRef.current = Date.now(); };
        // Throttled handler for high-frequency events (mousemove, scroll)
        const updateInteractionThrottled = () => {
            const now = Date.now();
            if (now - lastThrottledUpdateRef.current >= 200) {
                lastThrottledUpdateRef.current = now;
                lastInteractionRef.current = now;
            }
        };

        window.addEventListener('click', updateInteraction);
        window.addEventListener('keydown', updateInteraction);
        window.addEventListener('touchstart', updateInteraction);
        window.addEventListener('pointerdown', updateInteraction);
        window.addEventListener('mousemove', updateInteractionThrottled);
        window.addEventListener('scroll', updateInteractionThrottled, true); // capture phase for nested scrolls

        return () => {
            window.removeEventListener('click', updateInteraction);
            window.removeEventListener('keydown', updateInteraction);
            window.removeEventListener('touchstart', updateInteraction);
            window.removeEventListener('pointerdown', updateInteraction);
            window.removeEventListener('mousemove', updateInteractionThrottled);
            window.removeEventListener('scroll', updateInteractionThrottled, true);
        };
    }, []);

    // Send throttled heartbeat on meaningful state changes (game, route, protocol guide, CST)
    // Non-forced — respects MIN_HEARTBEAT_GAP to prevent write storms
    // Admin panel estimates trial position from startedAt + calculatedISI between heartbeats
    useEffect(() => {
        if (authUser?.uid && (gameState === 'playing' || gameState === 'paused' || gameState === 'results')) {
            if (gameState === 'playing') {
                gameStartedAtRef.current = gameStartedAtRef.current || Date.now();
            } else if (gameState === 'results') {
                gameStartedAtRef.current = null;
            }
            sendHeartbeat();
        }
    }, [authUser?.uid, gameState, sendHeartbeat]);

    useEffect(() => {
        if (authUser?.uid && protocolGuideState !== null) {
            sendHeartbeat();
        }
    }, [authUser?.uid, protocolGuideState, sendHeartbeat]);

    useEffect(() => {
        if (authUser?.uid && cstProgressState) {
            sendHeartbeat();
        }
    }, [authUser?.uid, cstProgressState, sendHeartbeat]);

    useEffect(() => {
        if (authUser?.uid) {
            sendHeartbeat();
        }
    }, [authUser?.uid, location.pathname, sendHeartbeat]);

    // Handle tab close / page unload
    useEffect(() => {
        const handleBeforeUnload = () => {
            // Use sendBeacon for reliability on page close
            if (authUser?.uid) {
                // Can't use async setDoc here, but we try our best
                // The offline status will be inferred by lastSeen timestamp
                markOffline();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // Mark offline on unmount (e.g., logout)
            markOffline();
        };
    }, [authUser?.uid, markOffline]);

    // Update Protocol Guide state (called from ProtocolGuideModal)
    const updateProtocolGuideState = useCallback((state) => {
        // state: { isOpen: boolean, view: 'hub' | 'section', sectionId: string | null, sectionTitle: string | null }
        // or null when closed
        setProtocolGuideState(state);
    }, []);

    // Mark user as starting checkout flow (going to Stripe)
    const markCheckoutStarted = useCallback(async (plan) => {
        if (!authUser?.uid) return;

        const promptData = {
            type: 'checkout',
            plan: plan, // 'monthly' or 'yearly'
            startedAt: Date.now(),
        };

        setUpgradePromptState(promptData);

        // Immediately update presence to reflect checkout state
        try {
            const presenceRef = doc(db, 'presence', authUser.uid);
            await setDoc(presenceRef, {
                lastSeen: serverTimestamp(),
                route: location.pathname,
                routeName: 'Stripe Checkout',
                activity: 'checkout',
                gameProgress: null,
                protocolGuide: null,
                upgradePrompt: promptData,
                pageEnterTime: Date.now(),
                displayName: userData?.displayName || userData?.username || 'Anonymous',
                email: authUser?.email || null,
                subscriptionTier: subscriptionTier || 'free',
                platform: getPlatform(),
            });
        } catch (error) {
            console.warn('Presence checkout marker failed:', error.message);
        }
    }, [authUser?.uid, authUser?.email, location.pathname, userData, subscriptionTier]);

    // Mark user as declined upgrade (clicked "Continue Tomorrow")
    const markUpgradeDeclined = useCallback(async () => {
        if (!authUser?.uid) return;

        const promptData = {
            type: 'declined',
            plan: null,
            startedAt: Date.now(),
        };

        setUpgradePromptState(promptData);

        // Immediately update presence to reflect declined state
        try {
            const presenceRef = doc(db, 'presence', authUser.uid);
            await setDoc(presenceRef, {
                lastSeen: serverTimestamp(),
                route: location.pathname,
                routeName: getRouteName(location.pathname),
                activity: 'declined-upgrade',
                gameProgress: null,
                protocolGuide: null,
                upgradePrompt: promptData,
                pageEnterTime: pageEnterTimeRef.current,
                displayName: userData?.displayName || userData?.username || 'Anonymous',
                email: authUser?.email || null,
                subscriptionTier: subscriptionTier || 'free',
                platform: getPlatform(),
            });
        } catch (error) {
            console.warn('Presence declined marker failed:', error.message);
        }
    }, [authUser?.uid, authUser?.email, location.pathname, userData, subscriptionTier]);

    // Clear upgrade prompt state (called when user returns from checkout or state times out)
    const clearUpgradePromptState = useCallback(() => {
        setUpgradePromptState(null);
    }, []);

    const value = {
        sendHeartbeat,
        markOffline,
        updateProtocolGuideState,
        setCstProgress,
        markCheckoutStarted,
        markUpgradeDeclined,
        clearUpgradePromptState,
    };

    return (
        <PresenceContext.Provider value={value}>
            {children}
        </PresenceContext.Provider>
    );
};

export default PresenceContext;

/* File: src/contexts/user/userDataFetching.js */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  doc,
  getDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  limit,
  getDocs,
  Timestamp, // Import Timestamp to check its type
} from 'firebase/firestore';

// Load sessions from last 60 days to cover all chart periods (today, week, month)
// Month view needs 30 days + prior 30 days = 60 days total
const SESSION_DAYS_LOOKBACK = 60;
import { db } from '../../firebaseConfig'; // Adjust path if needed
import { CURRENT_NOTICE_VERSION, getCurrentNotice } from '../../notices/healthSafety';
import { getPlatform } from '../../utils/platform';
import { trackEvent } from '../../utils/analyticsTracker';
import { acknowledgeHealthSafetyNoticeFn } from './userCloudFunctions';

const APP_VERSION = process.env.APP_VERSION || '1.0.0';

// Key for storing active profile ID in localStorage
const LOCAL_STORAGE_KEY = 'dualNBackActiveProfileId';

// Helper to safely convert timestamp to ISO string
export const safeToISOString = (timestamp) => {
    // Added check specifically for Firestore Timestamp object
    // This check should ideally be first as it's a common type from Firestore
    if (timestamp instanceof Timestamp) {
        try {
            return timestamp.toDate().toISOString();
        } catch (e) {
            // Log error if converting Firestore Timestamp fails
            console.error("Timestamp.toDate().toISOString() failed:", timestamp, e); // Keep error log
            return null;
        }
    }
    // Keep original checks for Date objects, strings, or numbers
    try {
        if (timestamp instanceof Date) {
            return timestamp.toISOString();
        } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) { // Check if parsing was successful
                return date.toISOString();
            }
        }
    } catch (e) {
        // Log general conversion errors
        console.error("Timestamp conversion failed:", timestamp, e); // Keep error log
    }
    // Do not log warning for unhandled cases in production
    return null; // Return null if conversion fails or input is invalid/unhandled
};

/**
 * Hook to load the list of user profiles using a real-time listener (onSnapshot).
 * It also determines the initially active profile based on localStorage and validity.
 * Provides the list of profiles and the determined active ID to ProfileContext.
 */
export const useProfileListLoader = (userId, isAuthLoading, userDocActiveProfileId) => {
  const [profiles, setProfiles] = useState([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [profilesError, setProfilesError] = useState(null);
  const [determinedActiveProfileId, setDeterminedActiveProfileId] = useState(null);
  const listenerUserId = useRef(null);

  useEffect(() => {
    let unsubscribe = () => {};

    // --- Authentication and User State Handling ---
    // 1. Wait for authentication to resolve
    if (isAuthLoading) {
        if (!isLoadingProfiles) setIsLoadingProfiles(true);
        return;
    }

    // 2. Handle user logout: Clear state, unsubscribe, remove localStorage
    if (!userId) {
        if (profiles.length > 0) setProfiles([]);
        if (determinedActiveProfileId !== null) setDeterminedActiveProfileId(null);
        if (profilesError !== null) setProfilesError(null);
        if (isLoadingProfiles) setIsLoadingProfiles(false);
        if (listenerUserId.current) {
            unsubscribe(); // Call cleanup from previous run if applicable
            listenerUserId.current = null;
        }
        if (typeof window !== 'undefined') {
             try { if (localStorage.getItem(LOCAL_STORAGE_KEY)) { localStorage.removeItem(LOCAL_STORAGE_KEY); } }
             catch (storageError) { console.error("[useProfileListLoader Logout] Error clearing localStorage:", storageError); } // Keep error log
        }
        return; // Stop execution if no user
    }

    // 3. Avoid redundant listener setup for the same user
    if (listenerUserId.current === userId) {
        if (isLoadingProfiles) setIsLoadingProfiles(false); // Ensure loading state is false if we skip setup
        return;
    }

    // --- Setup Firestore Listener ---
    setIsLoadingProfiles(true);
    setProfilesError(null);
    listenerUserId.current = userId; // Track the user ID for this listener

    const profilesCollectionRef = collection(db, 'users', userId, 'profiles');
    const qProfiles = query(profilesCollectionRef, orderBy('createdAt', 'asc'));

    // Attach the listener
    unsubscribe = onSnapshot(qProfiles,
      (querySnapshot) => {
        // --- Snapshot Handler START ---
        if (listenerUserId.current !== userId) { // Check for stale listener
            // Removed stale snapshot warning log
            return;
        }

        // Removed snapshot receipt log

        // Map Firestore documents to profile objects
        const loadedProfiles = querySnapshot.docs.map((doc) => {
            const data = doc.data();
            const profileId = doc.id; // Get profile ID

            // Removed raw cstHistory log
            const rawHistoryArray = Array.isArray(data.cstHistory) ? data.cstHistory : [];

            // Convert timestamps safely
            const createdAtISO = safeToISOString(data.createdAt);
            const updatedAtISO = safeToISOString(data.updatedAt);

            // Process cstHistory: Map entries and filter out those with invalid timestamps
            const cstHistoryData = rawHistoryArray.map((entry, index) => {
                  const originalTimestamp = entry.timestamp;
                  const convertedTimestamp = safeToISOString(originalTimestamp); // Attempt conversion
                  // Removed pre-filter log
                  return {
                      ...entry, // Keep all original fields from the entry
                      id: entry.id || null, // <<< Reverted fallback ID to null
                      timestamp: convertedTimestamp // Use the converted timestamp (which might be null)
                  };
              })
              .filter((entry, index) => { // Filter based on the conversion result
                  const keep = entry.timestamp !== null;
                  // Removed filtering decision log/warning
                  return keep; // Keep only entries where timestamp conversion succeeded
              });

             // Removed final processed cstHistory log

            // Return the structured profile object
            return {
              id: profileId, // Use the captured profileId
              username: data.username || null,
              currentNBack: data.currentNBack ?? 2,
              currentDifficulty: data.currentDifficulty ?? 0.0,
              highestNBack: Math.max(data.highestNBack ?? 2, data.currentNBack ?? 2),
              consecutiveSuccesses: data.consecutiveSuccesses ?? 0,
              createdAt: createdAtISO,
              updatedAt: updatedAtISO,
              cstHistory: cstHistoryData, // Assign the processed (mapped and filtered) history
              cstFamiliarizationCount: data.cstFamiliarizationCount ?? 0,
              lastCstAssessmentTimestamp: data.lastCstAssessmentTimestamp ? safeToISOString(data.lastCstAssessmentTimestamp) : null,
              tutorialsCompleted: typeof data.tutorialsCompleted === 'object' && data.tutorialsCompleted !== null ? data.tutorialsCompleted : {},
              // --- <<< START: Integrated Loading of New Fields >>> ---
              highestNBackGood: data.highestNBackGood ?? null, // Load the N-back level (default null)
              highestAchievedGoodSessionId: data.highestAchievedGoodSessionId ?? null, // Load the session ID (default null)
              // --- <<< NEW FIELD: Load with default if missing >>> ---
              previousNBackLevelDifficulties: (typeof data.previousNBackLevelDifficulties === 'object' && data.previousNBackLevelDifficulties !== null)
                                                ? data.previousNBackLevelDifficulties
                                                : {},
              // --- <<< END: Integrated Loading of New Fields >>> ---
            };
        });
        // --- End Mapping ---

        // Update local state with the loaded profiles
        setProfiles(loadedProfiles);

        // --- Determine/Re-validate Active Profile ID ---
        let finalDeterminedId = null;
        const profileIds = new Set(loadedProfiles.map(p => p.id));

        // Priority 1: Use the active profile ID from the user document if it's valid.
        if (userDocActiveProfileId && profileIds.has(userDocActiveProfileId)) {
            finalDeterminedId = userDocActiveProfileId;
        }
        // Priority 2: Use the ID from localStorage if it's valid.
        else {
            const storedId = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
            if (storedId && profileIds.has(storedId)) {
                finalDeterminedId = storedId;
            }
            // Priority 3: Fallback to the first profile in the list.
            else if (loadedProfiles.length > 0) {
                finalDeterminedId = loadedProfiles[0].id;
            }
        }
        
        // Update the determined ID state if it has changed
        setDeterminedActiveProfileId(prevDeterminedId => { return finalDeterminedId !== prevDeterminedId ? finalDeterminedId : prevDeterminedId; });
        
        setIsLoadingProfiles(false); // Profiles are now loaded
        // --- Snapshot Handler END ---
      },
      (err) => { // Error handler for the profile listener
        if (listenerUserId.current !== userId) { /* Removed stale error warning log */ return; }
        console.error('[useProfileListLoader Error] Error listening to profiles:', err); // Keep error log
        setProfilesError('Failed to load profiles.'); setProfiles([]); setDeterminedActiveProfileId(null);
        try { if (typeof window !== 'undefined') localStorage.removeItem(LOCAL_STORAGE_KEY); } catch (e) { /* ignore */ }
        setIsLoadingProfiles(false); // Stop loading on error
        listenerUserId.current = null; // Reset listener tracking on error
      }
    );

    // Cleanup function for the useEffect hook
    return () => {
      unsubscribe(); // Detach the listener
      listenerUserId.current = null; // Clear user tracking
    };
  }, [userId, isAuthLoading, userDocActiveProfileId]); // Dependencies for the main effect

  // Return the state managed by this hook
  return { profiles, isLoadingProfiles, profilesError, determinedActiveProfileId };
};


/**
 * Hook to load sessions for the user.
 * Sessions are loaded from: users/{uid}/sessions/
 */
export const useSubcollectionListeners = (userId, isLoadingInitial) => {
    const [activeSessions, setActiveSessions] = useState([]);
    const [isLoadingActiveSubcollections, setIsLoadingActiveSubcollections] = useState(true);
    const [subcollectionError, setSubcollectionError] = useState(null);
    const listenersRef = useRef({ unsub: null, userId: null });
    const isMountedRef = useRef(true);

    // Effect to track component mount status
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Main effect for attaching/detaching listeners
    useEffect(() => {
        // --- Helper to process snapshot data ---
        const processSnapshot = (snapshot) => {
             // Check for stale listener first
             if (listenersRef.current.userId !== userId) {
                  return;
             }

             try {
                const items = snapshot.docs.map(doc => {
                    const data = doc.data();
                    // Recursive timestamp conversion helper
                    const convertTimestampsRecursive = (obj) => {
                        if (!obj) return obj;
                        if (obj instanceof Timestamp) return safeToISOString(obj);
                        if (obj instanceof Date) return safeToISOString(obj);
                        if (Array.isArray(obj)) return obj.map(convertTimestampsRecursive);
                        if (typeof obj === 'object' && obj.constructor === Object) {
                            const newObj = {};
                            for (const key in obj) {
                                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                                    newObj[key] = convertTimestampsRecursive(obj[key]);
                                }
                            }
                            return newObj;
                        }
                        return obj;
                    };
                    const convertedData = convertTimestampsRecursive(data);
                    return { id: doc.id, ...convertedData };
                });

                // Sort by timestamp descending
                items.sort((a, b) => new Date(b.timestamp || b.recordedAt || 0) - new Date(a.timestamp || a.recordedAt || 0));

                if (isMountedRef.current) {
                    setActiveSessions(items);
                    setIsLoadingActiveSubcollections(false);
                }

             } catch (processingError) {
                 console.error(`[SubListener Process] Error processing sessions for ${userId}:`, processingError);
                 if (isMountedRef.current) {
                     setSubcollectionError('Error processing session data.');
                     setIsLoadingActiveSubcollections(false);
                 }
             }
        };

        // --- Helper to handle listener errors ---
        const handleError = (err) => {
             if (listenersRef.current.userId !== userId) return;
             console.error(`[SubListener ERROR] Error listening to sessions for ${userId}:`, err);
             if (isMountedRef.current) {
                 setSubcollectionError('Failed to load sessions.');
                 setIsLoadingActiveSubcollections(false);
             }
        };

        // --- Effect Logic ---
        // 1. Handle Invalid State (No user ID)
        if (!userId) {
            if (listenersRef.current.userId) {
                // Cleanup existing listener
                if (listenersRef.current.unsub) listenersRef.current.unsub();
                listenersRef.current = { unsub: null, userId: null };
                if (isMountedRef.current) {
                     if (activeSessions.length > 0) setActiveSessions([]);
                     if (subcollectionError !== null) setSubcollectionError(null);
                     if (isLoadingActiveSubcollections) setIsLoadingActiveSubcollections(false);
                }
            } else {
                 if (isMountedRef.current && isLoadingActiveSubcollections) setIsLoadingActiveSubcollections(false);
            }
            return;
        }
        // 2. Handle Initial Loading
        if (isLoadingInitial) {
             if (isMountedRef.current && !isLoadingActiveSubcollections) setIsLoadingActiveSubcollections(true);
            return;
        }
        // 3. Handle Already Attached State (same user)
        if (listenersRef.current.userId === userId) {
            return;
        }

        // 4. Handle New User Attachment
        if (listenersRef.current.unsub) {
            listenersRef.current.unsub();
        }
        if (isMountedRef.current) {
            if (!isLoadingActiveSubcollections) setIsLoadingActiveSubcollections(true);
            setSubcollectionError(null);
            setActiveSessions([]);
        }

        // Calculate lookback date for session filtering (covers all chart periods)
        const lookbackDate = new Date();
        lookbackDate.setDate(lookbackDate.getDate() - SESSION_DAYS_LOOKBACK);

        const sessionsPath = `users/${userId}/sessions`;

        try {
            const unsub = onSnapshot(
                query(
                    collection(db, sessionsPath),
                    where("recordedAt", ">=", lookbackDate),
                    orderBy("recordedAt", "desc")
                ),
                processSnapshot,
                handleError
            );

            listenersRef.current = { unsub, userId };

        } catch (error) {
            console.error(`[SubListener Effect] FATAL ERROR attaching listener for ${userId}:`, error);
            if (isMountedRef.current) {
                setSubcollectionError("Critical error setting up listeners.");
                setIsLoadingActiveSubcollections(false);
            }
            listenersRef.current = { unsub: null, userId: null };
        }

        // --- Cleanup function for this useEffect ---
        return () => {
            if (listenersRef.current.unsub) {
                 listenersRef.current.unsub();
                 listenersRef.current = { unsub: null, userId: null };
            }
        };
    }, [userId, isLoadingInitial]);

    // Return the state managed by this hook
    return {
        activeSessions,
        isLoadingActiveSubcollections, subcollectionError
    };
}; // End of useSubcollectionListeners hook

// Limit daily stats to last 90 days (covers Month view + buffer)
const DAILY_STATS_LIMIT = 90;

/**
 * Hook to load dailyStats for the dashboard stats views (Today/Week/Month).
 * dailyStats are pre-aggregated per day per gameMode.
 * Path: users/{uid}/dailyStats/{YYYY-MM-DD}_{gameMode}
 */
export const useDailyStatsListener = (userId, isLoadingInitial) => {
    const [dailyStats, setDailyStats] = useState([]);
    const [isLoadingDailyStats, setIsLoadingDailyStats] = useState(true);
    const [dailyStatsError, setDailyStatsError] = useState(null);
    const listenerRef = useRef({ unsub: null, userId: null });
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
        // 1. Wait for initial data to load
        if (isLoadingInitial) {
            return;
        }

        // 2. Handle logout
        if (!userId) {
            if (listenerRef.current.unsub) {
                listenerRef.current.unsub();
                listenerRef.current = { unsub: null, userId: null };
            }
            if (isMountedRef.current) {
                setDailyStats([]);
                setIsLoadingDailyStats(false);
                setDailyStatsError(null);
            }
            return;
        }

        // 3. Avoid redundant listener setup
        if (listenerRef.current.userId === userId) {
            return;
        }

        // 4. Clean up previous listener
        if (listenerRef.current.unsub) {
            listenerRef.current.unsub();
        }

        // 5. Setup new listener
        if (isMountedRef.current) {
            setIsLoadingDailyStats(true);
            setDailyStatsError(null);
        }

        const dailyStatsPath = `users/${userId}/dailyStats`;

        try {
            const unsub = onSnapshot(
                query(
                    collection(db, dailyStatsPath),
                    orderBy("date", "desc"),
                    limit(DAILY_STATS_LIMIT)
                ),
                (snapshot) => {
                    if (!isMountedRef.current) return;

                    const stats = snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            date: data.date,
                            gameMode: data.gameMode || 'dual',
                            sessionCount: data.sessionCount || 0,
                            totalDurationMs: data.totalDurationMs || 0,
                            lowestStartLevel: data.lowestStartLevel,
                            highestEndLevel: data.highestEndLevel,
                            totalStartLevel: data.totalStartLevel || 0,
                            // For calculating averages: divide sum by sessionCount
                            avgAccuracySum: data.avgAccuracySum || 0,
                            avgDprimeSum: data.avgDprimeSum || 0,
                            avgVisualAccuracySum: data.avgVisualAccuracySum || 0,
                            avgAudioAccuracySum: data.avgAudioAccuracySum || 0,
                            avgColorAccuracySum: data.avgColorAccuracySum || 0,
                            avgShapeAccuracySum: data.avgShapeAccuracySum || 0,
                        };
                    });

                    setDailyStats(stats);
                    setIsLoadingDailyStats(false);
                },
                (error) => {
                    console.error(`[useDailyStatsListener] Error for user ${userId}:`, error);
                    if (isMountedRef.current) {
                        setDailyStatsError(error.message);
                        setIsLoadingDailyStats(false);
                    }
                }
            );

            listenerRef.current = { unsub, userId };
        } catch (error) {
            console.error(`[useDailyStatsListener] Fatal error for ${userId}:`, error);
            if (isMountedRef.current) {
                setDailyStatsError(error.message);
                setIsLoadingDailyStats(false);
            }
        }

        return () => {
            if (listenerRef.current.unsub) {
                listenerRef.current.unsub();
                listenerRef.current = { unsub: null, userId: null };
            }
        };
    }, [userId, isLoadingInitial]);

    return {
        dailyStats,
        isLoadingDailyStats,
        dailyStatsError
    };
};

/**
 * Hook to load Health & Safety disclaimer state.
 *
 * Runs once per userId change, in parallel with other UserContext loads.
 * Does NOT block isInitialLoadComplete — disclaimer-read failures cannot
 * affect the dashboard's render path.
 *
 * Reads (in parallel):
 *   - config/healthSafetyNotice                          (kill switch)
 *   - users/{uid}/healthSafetyAcknowledgments/{version}  (acknowledgment doc)
 *
 * Wrapped in a 15s Promise.race timeout (mirrors the pattern at
 * UserContext.js:231-237 for getUserDataOnLoginFn). Fail-open on any error
 * or timeout — matches the prior per-mount hook's fail-open behavior.
 *
 * The actual modal-gating happens in <GameScreen> via useHealthSafetyNotice,
 * which is now a thin selector returning useUser().healthSafetyNotice.
 */
export const useHealthSafetyData = (userId) => {
    const [healthSafetyNeedsAck, setHealthSafetyNeedsAck] = useState(false);
    const [isLoadingHealthSafety, setIsLoadingHealthSafety] = useState(true);
    const [healthSafetyError, setHealthSafetyError] = useState(null);
    const checkedForUserRef = useRef(null);

    useEffect(() => {
        if (!userId) {
            setIsLoadingHealthSafety(false);
            setHealthSafetyNeedsAck(false);
            checkedForUserRef.current = null;
            return;
        }
        if (checkedForUserRef.current === userId) return;
        checkedForUserRef.current = userId;

        let cancelled = false;
        setIsLoadingHealthSafety(true);

        const HEALTH_SAFETY_TIMEOUT_MS = 15000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('HEALTH_SAFETY_TIMEOUT')), HEALTH_SAFETY_TIMEOUT_MS)
        );

        const reads = Promise.all([
            getDoc(doc(db, 'config', 'healthSafetyNotice')).catch(err => {
                console.warn('[useHealthSafetyData] config read failed:', err?.message);
                return null;
            }),
            getDoc(doc(db, 'users', userId, 'healthSafetyAcknowledgments', CURRENT_NOTICE_VERSION)).catch(err => {
                console.warn('[useHealthSafetyData] ack read failed:', err?.message);
                return null;
            }),
        ]);

        Promise.race([reads, timeoutPromise])
            .then(([configSnap, ackSnap]) => {
                if (cancelled) return;
                const killSwitchOff = configSnap?.exists() && configSnap.data().enabled === false;
                const ackExists = ackSnap?.exists() === true;
                setHealthSafetyNeedsAck(!killSwitchOff && !ackExists);
                setHealthSafetyError(null);
            })
            .catch(err => {
                if (cancelled) return;
                console.error('[useHealthSafetyData] failed:', err?.message);
                setHealthSafetyError(err?.message || 'unknown');
                setHealthSafetyNeedsAck(false); // fail-open
            })
            .finally(() => {
                if (!cancelled) setIsLoadingHealthSafety(false);
            });

        return () => { cancelled = true; };
    }, [userId]);

    const acknowledgeHealthSafety = useCallback(async () => {
        if (!acknowledgeHealthSafetyNoticeFn) {
            throw new Error('acknowledgeHealthSafetyNotice callable not initialized');
        }
        await acknowledgeHealthSafetyNoticeFn({
            version: CURRENT_NOTICE_VERSION,
            locale: getCurrentNotice()?.locale || 'en-US',
            platform: getPlatform(),
            appVersion: APP_VERSION,
        });
        setHealthSafetyNeedsAck(false);
        trackEvent('health_safety_notice_acknowledged', {
            notice_version: CURRENT_NOTICE_VERSION,
            platform: getPlatform(),
        });
    }, []);

    const declineHealthSafety = useCallback(() => {
        trackEvent('health_safety_notice_declined', {
            notice_version: CURRENT_NOTICE_VERSION,
            platform: getPlatform(),
        });
    }, []);

    return {
        healthSafetyNeedsAck,
        isLoadingHealthSafety,
        healthSafetyError,
        acknowledgeHealthSafety,
        declineHealthSafety,
    };
};

/**
 * Fetches ALL dailyStats for a user without the 90-day limit.
 * Used for the "All" tab showing lifetime data.
 * @param {string} userId - The user's UID.
 * @returns {Promise<Array>} Array of dailyStats documents sorted by date ascending.
 */
export const fetchAllDailyStats = async (userId) => {
    if (!userId) {
        return [];
    }

    const dailyStatsPath = `users/${userId}/dailyStats`;

    try {
        const snapshot = await getDocs(
            query(collection(db, dailyStatsPath), orderBy("date", "asc"))
        );

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                date: data.date,
                gameMode: data.gameMode || 'dual',
                sessionCount: data.sessionCount || 0,
                totalDurationMs: data.totalDurationMs || 0,
                lowestStartLevel: data.lowestStartLevel,
                highestEndLevel: data.highestEndLevel,
                totalStartLevel: data.totalStartLevel || 0,
                avgAccuracySum: data.avgAccuracySum || 0,
                avgDprimeSum: data.avgDprimeSum || 0,
                avgVisualAccuracySum: data.avgVisualAccuracySum || 0,
                avgAudioAccuracySum: data.avgAudioAccuracySum || 0,
                avgColorAccuracySum: data.avgColorAccuracySum || 0,
                avgShapeAccuracySum: data.avgShapeAccuracySum || 0,
            };
        });
    } catch (error) {
        console.error(`[fetchAllDailyStats] Error fetching all dailyStats for ${userId}:`, error);
        return [];
    }
};
/* src/contexts/CohortContext.js */

/**
 * CohortContext — manages cohort state with real-time Firestore listeners.
 * Provides cohort data, member progress, today's prescription, and helper actions.
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { doc, collection, onSnapshot, query, orderBy, limit, where, getDocs, getDoc, startAfter, Timestamp } from 'firebase/firestore';
import { db, functions, httpsCallable } from '../firebaseConfig';
import { useUser } from './UserContext';

const CohortContext = createContext(null);

export const useCohort = () => {
    const context = useContext(CohortContext);
    if (!context) throw new Error('useCohort must be used within CohortProvider');
    return context;
};

// Cloud Function callables
const joinCohortFn = httpsCallable(functions, 'joinCohort');
const leaveCohortFn = httpsCallable(functions, 'leaveCohort');
const getCohortSummaryFn = httpsCallable(functions, 'getCohortSummary');
const sendCohortMessageFn = httpsCallable(functions, 'sendCohortMessage');
const reactToCohortMessageFn = httpsCallable(functions, 'reactToCohortMessage');
const reportCohortMessageFn = httpsCallable(functions, 'reportCohortMessage');
const editCohortMessageFn = httpsCallable(functions, 'editCohortMessage');
const getFormingCohortInfoFn = httpsCallable(functions, 'getFormingCohortInfo');
const markChatAsReadFn = httpsCallable(functions, 'markChatAsRead');
const activateCohortIfReadyFn = httpsCallable(functions, 'activateCohortIfReady');
const adminSwitchCohortFn = httpsCallable(functions, 'adminSwitchCohort');
const adminListMyCohortsFn = httpsCallable(functions, 'adminListMyCohorts');

const MESSAGES_PAGE_SIZE = 50;

/**
 * Calculate program day from cohort start date.
 */
function getProgramDay(startDateStr) {
    if (!startDateStr) return 0;
    const start = new Date(startDateStr + 'T13:00:00Z');
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    if (diffMs < 0) return 0;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

export const CohortProvider = ({ children }) => {
    const { userId, userData, refreshUserData, isAdmin } = useUser();

    // Core state
    const [activeCohort, setActiveCohort] = useState(null);
    const [cohortMembers, setCohortMembers] = useState([]);
    const [programData, setProgramData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Chat state
    const [messages, setMessages] = useState([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [hasOlderMessages, setHasOlderMessages] = useState(true);
    const oldestMessageRef = useRef(null);
    const newestTimestampRef = useRef(null);

    // Optimistic cohort switching — override takes precedence over userData
    const [overrideActiveCohortId, setOverrideActiveCohortId] = useState(null);

    // For admin: adminViewingCohortId is the explicit view selection from the
    // switcher; activeCohortId is the admin's "current cohort" pointer. Both
    // are auto-advanced by `sweepAdminPointers` in functions/cohorts.js when
    // they go stale (cohort completed/archived). Regular users: these are
    // always the same.
    const activeCohortId = overrideActiveCohortId
        || (isAdmin ? (userData?.adminViewingCohortId || userData?.activeCohortId) : userData?.activeCohortId)
        || null;

    // The cohort the user is currently "joined to" (drives Train-vs-Observing
    // gate in CohortDashboard, star icon in CohortSwitcher). For admin this
    // auto-advances to the latest active cohort he's a member of.
    const joinedCohortId = userData?.activeCohortId || null;

    // Clear override once UserContext syncs (check both fields for admin)
    useEffect(() => {
        if (overrideActiveCohortId) {
            const syncedId = isAdmin ? userData?.adminViewingCohortId : userData?.activeCohortId;
            if (syncedId === overrideActiveCohortId) {
                setOverrideActiveCohortId(null);
            }
        }
    }, [userData?.activeCohortId, userData?.adminViewingCohortId, overrideActiveCohortId, isAdmin]);

    // Admin: cached cohort list
    const [myCohorts, setMyCohorts] = useState([]);
    const [myCohortsLoading, setMyCohortsLoading] = useState(true);

    const refreshMyCohorts = useCallback(async () => {
        if (!isAdmin) return;
        try {
            const result = await adminListMyCohortsFn();
            setMyCohorts(result.data.cohorts || []);
        } catch (err) {
            console.error('[CohortContext] Failed to refresh cohorts:', err);
        }
    }, [isAdmin]);

    // Fetch cohort list on mount for admin
    useEffect(() => {
        if (!isAdmin || !userId) { setMyCohortsLoading(false); return; }
        adminListMyCohortsFn().then(result => {
            setMyCohorts(result.data.cohorts || []);
        }).catch(err => {
            console.error('[CohortContext] Failed to load cohorts:', err);
        }).finally(() => setMyCohortsLoading(false));
    }, [isAdmin, userId]);

    // Ref to track message listener unsubscribe
    const messagesUnsubRef = useRef(null);
    // Track if program data has been fetched for this cohort
    const programIdFetchedRef = useRef(null);
    // Track if auto-activation has been attempted for this cohort
    const activationAttemptedRef = useRef(null);

    // --- Real-time listener for cohort doc + members ---
    useEffect(() => {
        if (!activeCohortId || !userId) {
            setActiveCohort(null);
            setCohortMembers([]);
            setProgramData(null);
            setMessages([]);
            setIsLoading(false);
            programIdFetchedRef.current = null;
            return;
        }

        setIsLoading(true);
        const unsubscribers = [];

        // Listen to cohort document
        const cohortUnsub = onSnapshot(
            doc(db, 'cohorts', activeCohortId),
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    setActiveCohort({ id: snapshot.id, ...data });

                    // Auto-activate if forming cohort's start date has passed
                    if (data.status === 'forming' && data.startDate) {
                        const startTime = new Date(data.startDate + 'T13:00:00Z');
                        if (new Date() >= startTime && activationAttemptedRef.current !== snapshot.id) {
                            activationAttemptedRef.current = snapshot.id;
                            activateCohortIfReadyFn({ cohortId: snapshot.id }).catch(err => {
                                console.error('[CohortContext] Auto-activation failed:', err);
                            });
                        }
                    }

                    // Fetch program data once (one-time read, not a listener)
                    if (data.programId && programIdFetchedRef.current !== data.programId) {
                        programIdFetchedRef.current = data.programId;
                        getDoc(doc(db, 'programs', data.programId)).then((progSnap) => {
                            if (progSnap.exists()) {
                                setProgramData({ id: progSnap.id, ...progSnap.data() });
                            }
                        }).catch(err => {
                            console.error('[CohortContext] Error fetching program:', err);
                        });
                    }
                } else {
                    setActiveCohort(null);
                }
                setIsLoading(false);
            },
            (error) => {
                console.error('[CohortContext] Error listening to cohort:', error);
                setIsLoading(false);
            }
        );
        unsubscribers.push(cohortUnsub);

        // Listen to members subcollection
        const membersUnsub = onSnapshot(
            collection(db, 'cohorts', activeCohortId, 'members'),
            (snapshot) => {
                const members = snapshot.docs.map(d => ({ odivId: d.id, ...d.data() }));
                setCohortMembers(members);
            },
            (error) => {
                console.error('[CohortContext] Error listening to members:', error);
            }
        );
        unsubscribers.push(membersUnsub);

        // Initial message load + real-time listener for new messages
        loadInitialMessages(activeCohortId);

        return () => {
            unsubscribers.forEach(unsub => unsub());
            // Clean up messages listener
            if (messagesUnsubRef.current) {
                messagesUnsubRef.current();
                messagesUnsubRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCohortId, userId]);

    // --- Load initial messages (one-time fetch) ---
    const loadInitialMessages = useCallback(async (cohortId) => {
        setIsLoadingMessages(true);
        try {
            const messagesQuery = query(
                collection(db, 'cohorts', cohortId, 'messages'),
                orderBy('timestamp', 'desc'),
                limit(MESSAGES_PAGE_SIZE)
            );
            const snapshot = await getDocs(messagesQuery);
            const msgs = snapshot.docs
                .map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))
                .reverse();

            setMessages(msgs);
            setHasOlderMessages(snapshot.docs.length === MESSAGES_PAGE_SIZE);

            if (snapshot.docs.length > 0) {
                oldestMessageRef.current = snapshot.docs[snapshot.docs.length - 1]; // Oldest in desc order = last doc
                const newestMsg = msgs[msgs.length - 1];
                newestTimestampRef.current = newestMsg?.timestamp || Timestamp.now();
            }

            // Set up real-time listener for new messages (capture unsubscribe)
            const realtimeQuery = query(
                collection(db, 'cohorts', cohortId, 'messages'),
                orderBy('timestamp', 'asc'),
                where('timestamp', '>', newestTimestampRef.current || Timestamp.now())
            );

            // Clean up previous messages listener if any
            if (messagesUnsubRef.current) {
                messagesUnsubRef.current();
            }

            messagesUnsubRef.current = onSnapshot(realtimeQuery, (snap) => {
                snap.docChanges().forEach((change) => {
                    const msgData = { id: change.doc.id, ...change.doc.data({ serverTimestamps: 'estimate' }) };
                    if (change.type === 'added') {
                        setMessages(prev => {
                            if (prev.some(m => m.id === msgData.id)) return prev;
                            // Replace optimistic message if this is the real version
                            const optimisticIdx = prev.findIndex(
                                m => m._optimistic && m.authorId === msgData.authorId && m.text === msgData.text
                            );
                            if (optimisticIdx !== -1) {
                                const updated = [...prev];
                                updated[optimisticIdx] = msgData;
                                return updated;
                            }
                            return [...prev, msgData];
                        });
                    } else if (change.type === 'modified') {
                        setMessages(prev => prev.map(m => m.id === msgData.id ? msgData : m));
                    } else if (change.type === 'removed') {
                        setMessages(prev => prev.filter(m => m.id !== msgData.id));
                    }
                });
            });
        } catch (error) {
            console.error('[CohortContext] Error loading messages:', error);
        }
        setIsLoadingMessages(false);
    }, []);

    // --- Load older messages (pagination) ---
    const loadOlderMessages = useCallback(async () => {
        if (!activeCohortId || !oldestMessageRef.current || !hasOlderMessages) return;

        try {
            const olderQuery = query(
                collection(db, 'cohorts', activeCohortId, 'messages'),
                orderBy('timestamp', 'desc'),
                startAfter(oldestMessageRef.current),
                limit(MESSAGES_PAGE_SIZE)
            );
            const snapshot = await getDocs(olderQuery);
            const olderMsgs = snapshot.docs
                .map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))
                .reverse();

            setMessages(prev => [...olderMsgs, ...prev]);
            setHasOlderMessages(snapshot.docs.length === MESSAGES_PAGE_SIZE);

            if (snapshot.docs.length > 0) {
                oldestMessageRef.current = snapshot.docs[snapshot.docs.length - 1];
            }
        } catch (error) {
            console.error('[CohortContext] Error loading older messages:', error);
        }
    }, [activeCohortId, hasOlderMessages]);

    // --- Actions ---
    const joinCohort = useCallback(async (programId, displayName, skipRejoin = false) => {
        const result = await joinCohortFn({ programId, displayName, skipRejoin });
        // Refresh user data so activeCohortId is picked up by the UI
        refreshUserData();
        return result.data;
    }, [refreshUserData]);

    const leaveCohort = useCallback(async (cohortId) => {
        const result = await leaveCohortFn({ cohortId });
        // Refresh user data so activeCohortId removal is picked up by the UI
        refreshUserData();
        return result.data;
    }, [refreshUserData]);

    const sendMessage = useCallback(async (text) => {
        if (!activeCohortId) return;

        // Optimistic UI — show message instantly before server confirms
        const optimisticId = 'optimistic_' + Date.now();
        const optimisticMsg = {
            id: optimisticId,
            authorId: userId,
            authorName: myMemberData?.odivUsername || 'You',
            text,
            type: 'user',
            timestamp: Timestamp.now(),
            reactions: {},
            _optimistic: true,
        };
        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const result = await sendCohortMessageFn({ cohortId: activeCohortId, text });
            const realId = result.data.messageId;

            // Reconcile: handle race between listener and function return
            setMessages(prev => {
                const hasReal = prev.some(m => m.id === realId);
                if (hasReal) {
                    // Listener already delivered the real message — remove optimistic
                    return prev.filter(m => m.id !== optimisticId);
                }
                // Listener hasn't fired yet — swap optimistic ID to real ID
                // so the listener's duplicate check catches it when it arrives
                return prev.map(m =>
                    m.id === optimisticId
                        ? { ...m, id: realId, _optimistic: false }
                        : m
                );
            });
        } catch (error) {
            setMessages(prev => prev.filter(m => m.id !== optimisticId));
            throw error;
        }
    }, [activeCohortId, userId, myMemberData]);

    const reactToMessage = useCallback(async (messageId, emoji) => {
        if (!activeCohortId) return;
        const result = await reactToCohortMessageFn({ cohortId: activeCohortId, messageId, emoji });
        return result.data;
    }, [activeCohortId]);

    const reportMessage = useCallback(async (messageId, reason) => {
        if (!activeCohortId) return;
        const result = await reportCohortMessageFn({ cohortId: activeCohortId, messageId, reason });
        return result.data;
    }, [activeCohortId]);

    const editMessage = useCallback(async (messageId, newText) => {
        if (!activeCohortId) return;
        await editCohortMessageFn({ cohortId: activeCohortId, messageId, text: newText });
    }, [activeCohortId]);

    const getFormingCohortInfo = useCallback(async (programId) => {
        const result = await getFormingCohortInfoFn({ programId });
        return result.data;
    }, []);

    const refreshCohortSummary = useCallback(async (cohortId) => {
        const id = cohortId || activeCohortId;
        if (!id) return null;
        const result = await getCohortSummaryFn({ cohortId: id });
        return result.data;
    }, [activeCohortId]);

    const markChatAsRead = useCallback(async () => {
        if (!activeCohortId) return;
        try {
            await markChatAsReadFn({ cohortId: activeCohortId });
        } catch (err) {
            console.error('[CohortContext] Error marking chat as read:', err);
        }
    }, [activeCohortId]);

    // --- Computed values ---
    const programDay = useMemo(() => {
        if (!activeCohort?.startDate) return 0;
        return getProgramDay(activeCohort.startDate);
    }, [activeCohort?.startDate]);

    const todaysPrescription = useMemo(() => {
        if (!programData?.dailyPrescriptions || programDay < 1 || programDay > 28) return null;
        return programData.dailyPrescriptions.find(p => p.day === programDay) || null;
    }, [programData, programDay]);

    const isTodayRestDay = useMemo(() => {
        return todaysPrescription?.type === 'rest';
    }, [todaysPrescription]);

    const todaysSessionTarget = useMemo(() => {
        if (!todaysPrescription || todaysPrescription.type === 'rest') return 0;
        return todaysPrescription.sessionTarget || 0;
    }, [todaysPrescription]);

    const myMemberData = useMemo(() => {
        return cohortMembers.find(m => m.odivId === userId) || null;
    }, [cohortMembers, userId]);

    const todaysSessionsCompleted = useMemo(() => {
        if (!myMemberData?.dailyProgress || programDay < 1) return 0;
        const dayProgress = myMemberData.dailyProgress[String(programDay)];
        return dayProgress?.sessionsPlayed || 0;
    }, [myMemberData, programDay]);

    const isChatOpen = useMemo(() => {
        if (!activeCohort) return false;
        if (activeCohort.status === 'forming' || activeCohort.status === 'active') return true;
        if (activeCohort.status === 'completed' && activeCohort.chatOpenUntil) {
            const chatUntil = activeCohort.chatOpenUntil.toDate ? activeCohort.chatOpenUntil.toDate() : new Date(activeCohort.chatOpenUntil);
            return new Date() < chatUntil;
        }
        return false;
    }, [activeCohort]);

    const unreadChatCount = useMemo(() => {
        const lastRead = myMemberData?.chatLastReadAt;
        if (!lastRead) return 0;
        const lastReadMs = lastRead.toMillis ? lastRead.toMillis() : Number(lastRead);
        return messages.filter(msg => {
            if (msg.authorId === userId) return false;
            if (msg.type !== 'user') return false;
            const msgMs = msg.timestamp?.toMillis ? msg.timestamp.toMillis() : 0;
            return msgMs > lastReadMs;
        }).length;
    }, [messages, myMemberData?.chatLastReadAt, userId]);

    // --- Admin actions ---
    const adminSwitchCohort = useCallback((cohortId) => {
        setOverrideActiveCohortId(cohortId); // Immediate local update
        adminSwitchCohortFn({ cohortId }).catch(
            err => console.error('[CohortContext] Switch persist failed:', err)
        );
        refreshMyCohorts(); // Background refresh for unread states
    }, [refreshMyCohorts]);

    // --- Context value ---
    const value = useMemo(() => ({
        // State
        activeCohort,
        activeCohortId,
        cohortMembers,
        programData,
        isLoading,
        messages,
        isLoadingMessages,
        hasOlderMessages,

        // Computed
        programDay,
        todaysPrescription,
        isTodayRestDay,
        todaysSessionTarget,
        todaysSessionsCompleted,
        myMemberData,
        isChatOpen,
        unreadChatCount,

        // Actions
        joinCohort,
        leaveCohort,
        sendMessage,
        reactToMessage,
        reportMessage,
        editMessage,
        loadOlderMessages,
        getFormingCohortInfo,
        refreshCohortSummary,
        markChatAsRead,

        // Admin actions
        adminSwitchCohort,
        joinedCohortId,
        myCohorts,
        myCohortsLoading,
        refreshMyCohorts,
    }), [
        activeCohort, activeCohortId, cohortMembers, programData, isLoading,
        messages, isLoadingMessages, hasOlderMessages,
        programDay, todaysPrescription,
        isTodayRestDay, todaysSessionTarget, todaysSessionsCompleted, myMemberData, isChatOpen,
        unreadChatCount,
        joinCohort, leaveCohort, sendMessage, reactToMessage, reportMessage, editMessage,
        loadOlderMessages, getFormingCohortInfo, refreshCohortSummary, markChatAsRead,
        adminSwitchCohort, joinedCohortId, myCohorts, myCohortsLoading, refreshMyCohorts,
    ]);

    return (
        <CohortContext.Provider value={value}>
            {children}
        </CohortContext.Provider>
    );
};

export default CohortContext;

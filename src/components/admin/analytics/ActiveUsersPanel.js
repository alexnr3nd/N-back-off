/* src/components/admin/analytics/ActiveUsersPanel.js */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, Timestamp, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../firebaseConfig';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faSync } from '@fortawesome/free-solid-svg-icons';
import LoadingSpinner from '../../ui/LoadingSpinner';
import AdminCard from '../ui/AdminCard';
import AdminBadge from '../ui/AdminBadge';
import AdminButton from '../ui/AdminButton';
import AdminAlert from '../ui/AdminAlert';
import ActiveUsersList from './ActiveUsersList';
import PlayedTodayList from './PlayedTodayList';

// Get PST midnight timestamp for today
const getPSTMidnightToday = () => {
    const now = new Date();
    // PST is UTC-8, PDT is UTC-7. Use America/Los_Angeles for automatic DST handling
    const pstString = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    const pstDate = new Date(pstString);
    pstDate.setHours(0, 0, 0, 0);
    // Convert back to UTC timestamp
    const pstMidnightLocal = new Date(pstDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    // Calculate offset and return proper timestamp
    const offset = now.getTime() - new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })).getTime();
    return new Date(pstDate.getTime() + offset);
};

const ACTIVE_CUTOFF_MS = 3 * 60 * 1000; // 3 minutes for "active" (heartbeat is 60s)
const AFK_CUTOFF_MS = 15 * 60 * 1000; // 15 minutes without interaction = AFK
const RECENT_CUTOFF_MS = 60 * 60 * 1000; // 1 hour for "recently online"

const TAB_BASE = 'px-4 py-2 text-xs font-mono uppercase tracking-wider border-b-2 -mb-px transition-colors';
const TAB_ACTIVE = 'border-theme-accent text-theme-accent';
const TAB_INACTIVE = 'border-transparent text-theme-text-muted hover:text-theme-text hover:border-theme-line';
const COUNT_BASE = 'ml-2 px-1.5 py-0.5 text-[0.6875rem] font-mono rounded-lab';
const COUNT_ACTIVE = 'bg-theme-accent/15 text-theme-accent';
const COUNT_INACTIVE = 'bg-theme-bg-elevated text-theme-text-muted';

// Summary tiles under the Active Now tab: [label, activity key, value color]
const SUMMARY_TILES = [
    { label: 'Playing', activity: 'playing', className: 'text-theme-neural-blue' },
    { label: 'Guide', activity: 'protocol-guide', className: 'text-theme-neural-green' },
    { label: 'Browsing', activity: 'idle', className: 'text-theme-text-secondary' },
    { label: 'Results', activity: 'results', className: 'text-theme-text' },
    { label: 'Checkout', activity: 'checkout', className: 'text-theme-accent' },
    { label: 'Declined', activity: 'declined-upgrade', className: 'text-neural-synapse' },
];

const ActiveUsersPanel = () => {
    const navigate = useNavigate();
    const [allUsers, setAllUsers] = useState([]); // All users from last hour
    const [sessionsToday, setSessionsToday] = useState({}); // { uid: count }
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('active'); // 'active', 'recent', or 'playedToday'

    // State for Played Today tab
    const [playedTodayUsers, setPlayedTodayUsers] = useState([]);
    const [playedTodayLoading, setPlayedTodayLoading] = useState(false);
    const [playedTodayError, setPlayedTodayError] = useState(null);

    // Tick counter for estimating trial progress of active players (re-renders every 3s)
    const [, setTick] = useState(0);
    const hasPlayingUser = allUsers.some(u => u.activity === 'playing');
    useEffect(() => {
        if (!hasPlayingUser) return;
        const id = setInterval(() => setTick(t => t + 1), 3000);
        return () => clearInterval(id);
    }, [hasPlayingUser]);

    // Throttle timer for session count fetches (at most once per 30s)
    const sessionFetchTimerRef = useRef(null);
    const latestUserIdsRef = useRef([]);

    // Derived: split users into active, AFK (online but idle 5+ min), and recent
    const now = Date.now();
    const onlineUsers = allUsers.filter(u => (now - u.lastSeenMs) < ACTIVE_CUTOFF_MS);
    const activeUsers = onlineUsers.filter(u => (now - u.lastInteractionMs) < AFK_CUTOFF_MS);
    const afkUsers = onlineUsers.filter(u => (now - u.lastInteractionMs) >= AFK_CUTOFF_MS);
    // Recent users sorted by lastSeenMs (most recently seen first)
    const recentUsers = allUsers
        .filter(u => (now - u.lastSeenMs) >= ACTIVE_CUTOFF_MS)
        .sort((a, b) => b.lastSeenMs - a.lastSeenMs);
    const displayedUsers = activeTab === 'active' ? activeUsers
        : activeTab === 'afk' ? afkUsers
        : recentUsers;

    // Fetch sessions today for a list of user IDs
    const fetchSessionsToday = async (userIds) => {
        if (userIds.length === 0) return;

        const pstMidnight = getPSTMidnightToday();
        const pstTimestamp = Timestamp.fromDate(pstMidnight);

        const counts = {};
        await Promise.all(userIds.map(async (uid) => {
            try {
                const sessionsRef = collection(db, `users/${uid}/sessions`);
                const q = query(
                    sessionsRef,
                    where('recordedAt', '>=', pstTimestamp)
                );
                const snap = await getDocs(q);
                counts[uid] = snap.size;
            } catch (err) {
                console.warn(`Failed to fetch sessions for ${uid}:`, err);
                counts[uid] = 0;
            }
        }));

        setSessionsToday(prev => ({ ...prev, ...counts }));
    };

    // Fetch users who played today from cloud function
    const fetchPlayedTodayUsers = useCallback(async () => {
        setPlayedTodayLoading(true);
        setPlayedTodayError(null);
        try {
            const adminGetPlayedTodayUsers = httpsCallable(functions, 'adminGetPlayedTodayUsers');
            const result = await adminGetPlayedTodayUsers();
            if (result.data.success) {
                setPlayedTodayUsers(result.data.users);
            } else {
                setPlayedTodayError('Failed to load data');
            }
        } catch (err) {
            console.error('Failed to fetch played today users:', err);
            setPlayedTodayError('Failed to load users who played today');
        } finally {
            setPlayedTodayLoading(false);
        }
    }, []);

    // Fetch played today users on mount so the tab badge shows the correct count
    useEffect(() => {
        fetchPlayedTodayUsers();
    }, [fetchPlayedTodayUsers]);

    useEffect(() => {
        const presenceRef = collection(db, 'presence');
        let isFirstSnapshot = true;

        // Fix 1: Use a fixed 2-hour query window so the listener stays stable for the
        // component's lifetime. Client-side filtering (above) handles the real
        // categorization into active/AFK/recent using ACTIVE_CUTOFF_MS and RECENT_CUTOFF_MS.
        const QUERY_WINDOW_MS = 2 * 60 * 60 * 1000;
        const fixedCutoff = Timestamp.fromDate(new Date(Date.now() - QUERY_WINDOW_MS));

        const q = query(
            presenceRef,
            where('lastSeen', '>=', fixedCutoff),
            orderBy('lastSeen', 'desc')
        );

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const currentTime = Date.now();

                const users = snapshot.docs
                    .map(doc => {
                        const data = doc.data();
                        const pageEnterTime = data.pageEnterTime || currentTime;
                        const timeOnPageSeconds = Math.floor((currentTime - pageEnterTime) / 1000);
                        const lastSeenMs = data.lastSeen?.toMillis?.() || currentTime;
                        const lastInteractionMs = data.lastInteraction || pageEnterTime;

                        return {
                            uid: doc.id,
                            displayName: data.displayName || 'Anonymous',
                            email: data.email || null,
                            route: data.route || '/',
                            routeName: data.routeName || 'Unknown',
                            activity: data.activity || 'idle',
                            gameProgress: data.gameProgress || null,
                            sessionResults: data.sessionResults || null,
                            protocolGuide: data.protocolGuide || null,
                            upgradePrompt: data.upgradePrompt || null,
                            cstProgress: data.cstProgress || null,
                            pageEnterTime,
                            timeOnPageSeconds,
                            lastSeenMs,
                            lastInteractionMs,
                            subscriptionTier: data.subscriptionTier || 'free',
                        };
                    })
                    .filter(user => user.activity !== 'offline' && user.email !== 'allen@dualnback.com')
                    .sort((a, b) => b.pageEnterTime - a.pageEnterTime);

                setAllUsers(users);
                setLoading(false);
                setError(null);

                // Throttle session count fetches: immediate on first snapshot,
                // then at most once per 30 seconds (using latest user IDs).
                const userIds = users.map(u => u.uid);
                latestUserIdsRef.current = userIds;
                if (isFirstSnapshot) {
                    isFirstSnapshot = false;
                    fetchSessionsToday(userIds);
                } else if (!sessionFetchTimerRef.current) {
                    sessionFetchTimerRef.current = setTimeout(() => {
                        sessionFetchTimerRef.current = null;
                        fetchSessionsToday(latestUserIdsRef.current);
                    }, 30000);
                }
            },
            (err) => {
                console.error('Presence listener error:', err);
                setError('Failed to load active users');
                setLoading(false);
            }
        );

        // Update time-on-page every 10 seconds
        const timeUpdateId = setInterval(() => {
            setAllUsers(prev => prev.map(user => ({
                ...user,
                timeOnPageSeconds: user.timeOnPageSeconds + 10,
            })));
        }, 10000);

        return () => {
            unsubscribe();
            if (sessionFetchTimerRef.current) {
                clearTimeout(sessionFetchTimerRef.current);
            }
            clearInterval(timeUpdateId);
        };
    }, []);

    if (loading) {
        return (
            <AdminCard title="Active Users">
                <div className="h-32 flex items-center justify-center">
                    <LoadingSpinner small theme="auto" />
                </div>
            </AdminCard>
        );
    }

    if (error) {
        return (
            <AdminCard title="Active Users">
                <AdminAlert tone="error">{error}</AdminAlert>
            </AdminCard>
        );
    }

    const TAB_DEFS = [
        { id: 'active', label: 'Active Now', count: activeUsers.length },
        { id: 'afk', label: 'AFK', count: afkUsers.length },
        { id: 'recent', label: 'Recently Online', count: recentUsers.length },
        { id: 'playedToday', label: 'Played Today', count: playedTodayLoading ? '...' : playedTodayUsers.length },
    ];

    return (
        <AdminCard
            title="Active Users"
            actions={(
                <>
                    <AdminBadge tone="success">
                        <FontAwesomeIcon icon={faCircle} className="h-2 w-2 animate-pulse" />
                        {activeUsers.length} online
                    </AdminBadge>
                    <span className="text-[0.6875rem] font-mono uppercase tracking-[0.2em] text-theme-text-muted">Live</span>
                </>
            )}
        >
            {/* Tabs */}
            <div className="flex border-b border-theme-line mb-4">
                {TAB_DEFS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`${TAB_BASE} ${activeTab === tab.id ? TAB_ACTIVE : TAB_INACTIVE}`}
                    >
                        {tab.label}
                        <span className={`${COUNT_BASE} ${activeTab === tab.id ? COUNT_ACTIVE : COUNT_INACTIVE}`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
                {/* Refresh button for Played Today tab */}
                {activeTab === 'playedToday' && (
                    <AdminButton
                        variant="ghost"
                        size="sm"
                        icon={faSync}
                        loading={playedTodayLoading}
                        onClick={fetchPlayedTodayUsers}
                        title="Refresh"
                        className="ml-auto self-center"
                    />
                )}
            </div>

            {/* User List - Active/AFK/Recent tabs */}
            {(activeTab === 'active' || activeTab === 'afk' || activeTab === 'recent') && (
                <ActiveUsersList
                    users={displayedUsers}
                    activeTab={activeTab}
                    sessionsToday={sessionsToday}
                    navigate={navigate}
                />
            )}

            {/* User List - Played Today tab */}
            {activeTab === 'playedToday' && (
                <PlayedTodayList
                    users={playedTodayUsers}
                    loading={playedTodayLoading}
                    error={playedTodayError}
                    navigate={navigate}
                />
            )}

            {/* Summary Stats - only show for active users tab */}
            {activeTab === 'active' && activeUsers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-theme-line flex flex-wrap justify-around text-center gap-2">
                    {SUMMARY_TILES.map(tile => (
                        <div key={tile.activity}>
                            <p className={`text-2xl font-mono tabular-nums ${tile.className}`}>
                                {activeUsers.filter(u => u.activity === tile.activity).length}
                            </p>
                            <p className="text-[0.6875rem] font-mono uppercase tracking-wider text-theme-text-muted">{tile.label}</p>
                        </div>
                    ))}
                </div>
            )}
        </AdminCard>
    );
};

export default ActiveUsersPanel;

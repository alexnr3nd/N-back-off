/* src/components/admin/users/UserDetailPage.js */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { functions, db } from '../../../firebaseConfig';
import { faUser } from '@fortawesome/free-solid-svg-icons';
import LoadingSpinner from '../../ui/LoadingSpinner';
import AdminAlert from '../ui/AdminAlert';
import AdminEmptyState from '../ui/AdminEmptyState';
import UserDetailHeader from './UserDetailHeader';
import UserPresenceBanner from './UserPresenceBanner';
import UserOverviewCards from './UserOverviewCards';
import UserSessionsTable from './UserSessionsTable';
import UserAssessmentsTable from './UserAssessmentsTable';
import UserChargesTable from './UserChargesTable';
import UserDetailModals from './UserDetailModals';

const UserDetailPage = () => {
    const { userId } = useParams();
    const navigate = useNavigate();

    const [userData, setUserData] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [fatigueWarnings, setFatigueWarnings] = useState([]);
    const [stats, setStats] = useState(null);
    const [stripeData, setStripeData] = useState(null);
    const [assessments, setAssessments] = useState([]);
    const [firestoreDocMissing, setFirestoreDocMissing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Live presence state
    const [presence, setPresence] = useState(null);
    const [timeOnPage, setTimeOnPage] = useState(0);

    // Tick for estimating trial progress of active players (re-renders every 3s)
    const [, setTick] = useState(0);
    const isPlaying = presence?.activity === 'playing';
    useEffect(() => {
        if (!isPlaying) return;
        const id = setInterval(() => setTick(t => t + 1), 3000);
        return () => clearInterval(id);
    }, [isPlaying]);

    // Action states
    const [actionLoading, setActionLoading] = useState(null);
    const [actionMessage, setActionMessage] = useState(null);

    // Modal states
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [refundAmount, setRefundAmount] = useState('');
    const [selectedChargeId, setSelectedChargeId] = useState('');

    // Mode filter state for sessions table. 'single' is a virtual aggregate
    // matching any singleX session.
    const [modeFilter, setModeFilter] = useState(['single', 'dual', 'triple', 'quad']);

    // Mode filter state for progress section. 'single' matches any singleX.
    const [progressModeFilter, setProgressModeFilter] = useState('all');

    // Ref to track previous activity for detecting game completion
    const previousActivityRef = useRef(null);

    // Filter sessions by selected modes (for sessions table)
    const filteredSessions = useMemo(() => {
        return sessions.filter(s => {
            const gm = s.gameMode || 'dual';
            if (modeFilter.includes(gm)) return true;
            if (gm.startsWith('single') && modeFilter.includes('single')) return true;
            return false;
        });
    }, [sessions, modeFilter]);

    // stats.sessionsByMode comes from the backend with per-mode keys
    // (dual/triple/quad/singleVisual/...). Derive a 'single' aggregate so the
    // filter pills can display a Single count.
    const enhancedStats = useMemo(() => {
        if (!stats || !stats.sessionsByMode) return stats;
        const byMode = stats.sessionsByMode;
        const single =
            (byMode.singleVisual || 0) +
            (byMode.singleAudio || 0) +
            (byMode.singleColor || 0) +
            (byMode.singleColorRecall || 0) +
            (byMode.singleShape || 0);
        return {
            ...stats,
            sessionsByMode: { ...byMode, single },
        };
    }, [stats]);

    // Calculate progress stats filtered by mode
    const progressStats = useMemo(() => {
        const filterSessions = progressModeFilter === 'all'
            ? sessions
            : progressModeFilter === 'single'
                ? sessions.filter(s => (s.gameMode || '').startsWith('single'))
                : sessions.filter(s => (s.gameMode || 'dual') === progressModeFilter);

        const sessionCount = filterSessions.length;
        const totalDuration = filterSessions.reduce((sum, s) => sum + (s.durationMs || 0), 0);
        const avgAcc = sessionCount > 0
            ? filterSessions.reduce((sum, s) => sum + (s.accuracy || 0), 0) / sessionCount
            : 0;
        const avgDp = sessionCount > 0
            ? filterSessions.reduce((sum, s) => sum + (s.overallDprime || 0), 0) / sessionCount
            : 0;

        // Get highest level achieved in filtered sessions
        let highestLevel = 2;
        filterSessions.forEach(s => {
            const level = (s.nBack ?? 2) + Math.min(0.99, Math.max(0, s.difficulty ?? 0));
            if (level > highestLevel) highestLevel = level;
        });

        return {
            sessionCount,
            totalDuration,
            avgAccuracy: avgAcc,
            avgDprime: avgDp,
            highestLevel: highestLevel.toFixed(2),
        };
    }, [sessions, progressModeFilter]);

    // Note: Color/shape columns removed from admin view for simplicity

    // Toggle mode filter
    const toggleModeFilter = useCallback((mode) => {
        setModeFilter(prev => {
            if (prev.includes(mode)) {
                return prev.filter(m => m !== mode);
            } else {
                return [...prev, mode];
            }
        });
    }, []);

    // Refresh sessions data after user completes a game
    const refreshSessions = useCallback(async () => {
        try {
            const adminGetUserDetail = httpsCallable(functions, 'adminGetUserDetail');
            const result = await adminGetUserDetail({ userId });

            if (result.data.success) {
                setUserData(result.data.user);
                setSessions(result.data.sessions || []);
                setFatigueWarnings(result.data.fatigueWarnings || []);
                setStats(result.data.stats);
                setAssessments(result.data.assessments || result.data.cstHistory || []);
            }
        } catch (err) {
            console.error('[UserDetailPage] Error refreshing sessions:', err);
        }
    }, [userId]);

    // Listen to user's presence in real-time
    useEffect(() => {
        if (!userId) return;

        const presenceRef = doc(db, 'presence', userId);
        const unsubscribe = onSnapshot(presenceRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                const lastSeen = data.lastSeen?.toDate?.() || new Date(0);
                const now = new Date();
                const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);

                const currentActivity = data.activity || 'idle';

                // Detect game completion: transition from game state to non-game state
                const gameStates = ['playing', 'paused', 'preparing', 'results'];
                const previousActivity = previousActivityRef.current;
                const wasInGame = gameStates.includes(previousActivity);
                const isNoLongerInGame = !gameStates.includes(currentActivity);

                if (wasInGame && isNoLongerInGame) {
                    // User finished a game - refresh sessions
                    refreshSessions();
                }

                // Update the ref for next comparison
                previousActivityRef.current = currentActivity;

                // Only show as online if lastSeen is within 3 minutes and not marked offline
                if (lastSeen >= threeMinutesAgo && data.activity !== 'offline') {
                    const pageEnterTime = data.pageEnterTime || now.getTime();
                    setPresence({
                        activity: currentActivity,
                        routeName: data.routeName || 'Unknown',
                        gameProgress: data.gameProgress || null,
                        protocolGuide: data.protocolGuide || null,
                        pageEnterTime,
                    });
                    setTimeOnPage(Math.floor((now.getTime() - pageEnterTime) / 1000));
                } else {
                    setPresence(null);
                }
            } else {
                // User went offline - check if they were in a game
                const gameStates = ['playing', 'paused', 'preparing', 'results'];
                const previousActivity = previousActivityRef.current;
                if (gameStates.includes(previousActivity)) {
                    // User was in a game and went offline - refresh sessions
                    refreshSessions();
                }
                previousActivityRef.current = null;
                setPresence(null);
            }
        });

        return () => unsubscribe();
    }, [userId, refreshSessions]);

    // Update time on page every 10 seconds
    useEffect(() => {
        if (!presence) return;

        const interval = setInterval(() => {
            const now = Date.now();
            setTimeOnPage(Math.floor((now - presence.pageEnterTime) / 1000));
        }, 10000);

        return () => clearInterval(interval);
    }, [presence]);

    useEffect(() => {
        const fetchUserDetail = async () => {
            setLoading(true);
            setError(null);

            try {
                const adminGetUserDetail = httpsCallable(functions, 'adminGetUserDetail');
                const result = await adminGetUserDetail({ userId });

                if (result.data.success) {
                    setUserData(result.data.user);
                    setSessions(result.data.sessions || []);
                    setFatigueWarnings(result.data.fatigueWarnings || []);
                    setStats(result.data.stats);
                    setStripeData(result.data.stripe);
                    setAssessments(result.data.assessments || result.data.cstHistory || []);
                    setFirestoreDocMissing(result.data.firestoreDocMissing || false);
                }
            } catch (err) {
                console.error('[UserDetailPage] Error fetching user:', err);
                setError(err.message || 'Failed to fetch user details');
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchUserDetail();
        }
    }, [userId]);

    const handleChangeEmail = async () => {
        if (!newEmail.trim()) return;

        setActionLoading('email');
        setActionMessage(null);

        try {
            const adminUpdateUserEmail = httpsCallable(functions, 'adminUpdateUserEmail');
            const result = await adminUpdateUserEmail({ userId, newEmail: newEmail.trim() });

            if (result.data.success) {
                setActionMessage({ type: 'success', text: result.data.message });
                // Update local state
                setUserData(prev => ({
                    ...prev,
                    auth: { ...prev.auth, email: newEmail.trim() }
                }));
                setShowEmailModal(false);
                setNewEmail('');
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: err.message || 'Failed to update email' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleResetPassword = async () => {
        setActionLoading('password');
        setActionMessage(null);

        try {
            const adminResetUserPassword = httpsCallable(functions, 'adminResetUserPassword');
            const result = await adminResetUserPassword({ userId });

            if (result.data.success) {
                setActionMessage({
                    type: 'success',
                    text: `Password reset link generated. ${result.data.resetLink ? 'Link copied to clipboard.' : ''}`
                });
                if (result.data.resetLink) {
                    navigator.clipboard.writeText(result.data.resetLink);
                }
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: err.message || 'Failed to reset password' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleIssueRefund = async () => {
        setActionLoading('refund');
        setActionMessage(null);

        try {
            const adminIssueRefund = httpsCallable(functions, 'adminIssueRefund');
            const params = { userId };
            if (selectedChargeId) params.chargeId = selectedChargeId;
            if (refundAmount) params.amount = Math.round(parseFloat(refundAmount) * 100); // Convert to cents

            const result = await adminIssueRefund(params);

            if (result.data.success) {
                const refund = result.data.refund;
                setActionMessage({
                    type: 'success',
                    text: `Refund of $${(refund.amount / 100).toFixed(2)} ${refund.currency.toUpperCase()} issued successfully.`
                });
                setShowRefundModal(false);
                setRefundAmount('');
                setSelectedChargeId('');
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: err.message || 'Failed to issue refund' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleCloseEmailModal = () => {
        setShowEmailModal(false);
        setNewEmail('');
    };

    const handleCloseRefundModal = () => {
        setShowRefundModal(false);
        setRefundAmount('');
        setSelectedChargeId('');
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            });
        } catch {
            return 'N/A';
        }
    };

    const formatDuration = (ms) => {
        if (!ms) return 'N/A';
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <LoadingSpinner theme="auto" />
            </div>
        );
    }

    if (error) {
        return <AdminAlert tone="error">{error}</AdminAlert>;
    }

    if (!userData) {
        return <AdminEmptyState icon={faUser} title="User not found" />;
    }

    return (
        <div className="space-y-6 min-w-0">
            <UserDetailHeader
                userData={userData}
                userId={userId}
                isOnline={Boolean(presence)}
                actionMessage={actionMessage}
                firestoreDocMissing={firestoreDocMissing}
                actionLoading={actionLoading}
                onBack={() => navigate(-1)}
                onOpenEmailModal={() => setShowEmailModal(true)}
                onResetPassword={handleResetPassword}
                onOpenRefundModal={() => setShowRefundModal(true)}
            />

            <UserPresenceBanner presence={presence} timeOnPage={timeOnPage} />

            <UserOverviewCards
                userData={userData}
                stats={stats}
                enhancedStats={enhancedStats}
                progressStats={progressStats}
                progressModeFilter={progressModeFilter}
                onProgressModeChange={setProgressModeFilter}
                fatigueWarnings={fatigueWarnings}
                formatDate={formatDate}
                formatDuration={formatDuration}
            />

            <UserSessionsTable
                sessions={filteredSessions}
                modeFilter={modeFilter}
                onToggleMode={toggleModeFilter}
                sessionsByMode={enhancedStats?.sessionsByMode}
                formatDate={formatDate}
                formatDuration={formatDuration}
            />

            <UserAssessmentsTable assessments={assessments} formatDate={formatDate} />

            {stripeData && stripeData.recentCharges && stripeData.recentCharges.length > 0 && (
                <UserChargesTable charges={stripeData.recentCharges} formatDate={formatDate} />
            )}

            <UserDetailModals
                showEmailModal={showEmailModal}
                showRefundModal={showRefundModal}
                newEmail={newEmail}
                setNewEmail={setNewEmail}
                refundAmount={refundAmount}
                setRefundAmount={setRefundAmount}
                selectedChargeId={selectedChargeId}
                setSelectedChargeId={setSelectedChargeId}
                charges={stripeData?.recentCharges}
                actionLoading={actionLoading}
                onCloseEmailModal={handleCloseEmailModal}
                onSubmitEmail={handleChangeEmail}
                onCloseRefundModal={handleCloseRefundModal}
                onSubmitRefund={handleIssueRefund}
            />
        </div>
    );
};

export default UserDetailPage;

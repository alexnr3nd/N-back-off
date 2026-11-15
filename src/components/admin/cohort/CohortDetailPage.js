/* src/components/admin/cohort/CohortDetailPage.js */
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebaseConfig';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft,
    faUsers,
    faComments,
    faTrophy,
    faCommentSlash,
    faCrown,
    faUserGroup,
    faUserCheck,
    faCalendarDay
} from '@fortawesome/free-solid-svg-icons';
import LoadingSpinner from '../../ui/LoadingSpinner';
import AdminPage from '../ui/AdminPage';
import AdminCard from '../ui/AdminCard';
import AdminBadge from '../ui/AdminBadge';
import AdminAlert from '../ui/AdminAlert';
import AdminMetricCard from '../ui/AdminMetricCard';
import AdminEmptyState from '../ui/AdminEmptyState';
import { AdminTable, AdminTr, AdminTd } from '../ui/AdminTable';

const STATUS_TONES = {
    forming: 'info',
    active: 'success',
    completed: 'neutral',
    archived: 'neutral',
};

const MEMBER_STATUS_TONES = {
    active: 'success',
    left: 'accent',
    completed: 'neutral',
};

const TABS = [
    { key: 'members', label: 'Members', icon: faUsers },
    { key: 'chat', label: 'Chat', icon: faComments },
];

const BACK_LINK = 'group inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-accent transition-colors';

const CohortDetailPage = () => {
    const { cohortId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [cohort, setCohort] = useState(null);
    const [members, setMembers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [activeTab, setActiveTab] = useState('members');

    useEffect(() => {
        const fetchDetail = async () => {
            setLoading(true);
            setError(null);
            try {
                const fn = httpsCallable(functions, 'adminGetCohortDetail');
                const result = await fn({ cohortId });
                if (result.data.success) {
                    setCohort(result.data.cohort);
                    setMembers(result.data.members);
                    setMessages(result.data.messages);
                }
            } catch (err) {
                console.error('[CohortDetailPage] Error:', err);
                setError(err.message || 'Failed to fetch cohort details');
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [cohortId]);

    const programDay = useMemo(() => {
        if (!cohort?.startDate || cohort.status !== 'active') return null;
        const start = new Date(cohort.startDate + 'T13:00:00Z');
        const diffMs = Date.now() - start.getTime();
        const day = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
        return day >= 1 && day <= 28 ? day : null;
    }, [cohort]);

    const sortedMembers = useMemo(() => {
        return [...members].sort((a, b) => {
            const statusOrder = { active: 0, completed: 1, left: 2 };
            const aOrder = statusOrder[a.status] ?? 3;
            const bOrder = statusOrder[b.status] ?? 3;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return (b.daysCompleted || 0) - (a.daysCompleted || 0);
        });
    }, [members]);

    const activeMembers = useMemo(() => members.filter(m => m.status === 'active').length, [members]);

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
            });
        } catch { return 'N/A'; }
    };

    const formatTime = (dateString) => {
        if (!dateString) return '';
        try {
            return new Date(dateString).toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit', hour12: true,
            });
        } catch { return ''; }
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return 'N/A';
        return `${formatDate(dateString)}, ${formatTime(dateString)}`;
    };

    const getStatusBadge = (status, toneMap = STATUS_TONES) => (
        <AdminBadge tone={toneMap[status] || 'neutral'}>{status || 'unknown'}</AdminBadge>
    );

    const getTodayProgress = (member) => {
        if (!programDay || !member.dailyProgress) return null;
        const dayData = member.dailyProgress[String(programDay)];
        if (!dayData) return { sessionsPlayed: 0, completed: false };
        return dayData;
    };

    if (loading) {
        return (
            <div className="py-24">
                <LoadingSpinner theme="auto" message="Loading cohort" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
                <Link to="/admin/cohorts" className={BACK_LINK}>
                    <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                    <span className="text-xs font-mono uppercase tracking-wider">Back to Cohorts</span>
                </Link>
                <AdminAlert tone="error">{error}</AdminAlert>
            </div>
        );
    }

    const daysElapsed = cohort.startDate
        ? Math.max(0, Math.floor((Date.now() - new Date(cohort.startDate + 'T00:00:00Z').getTime()) / (1000 * 60 * 60 * 24)) + 1)
        : 0;

    return (
        <div className="space-y-4">
            {/* Back Link */}
            <Link to="/admin/cohorts" className={`${BACK_LINK} w-fit`}>
                <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                <span className="text-xs font-mono uppercase tracking-wider">Back to Cohorts</span>
            </Link>

            <AdminPage
                eyebrow="Program"
                title="Cohort"
                actions={
                    <>
                        {getStatusBadge(cohort.status)}
                        <span className="text-xs font-mono text-theme-text-muted">
                            {formatDate(cohort.startDate)} &ndash; {formatDate(cohort.endDate)}
                        </span>
                        {programDay && (
                            <span className="text-xs font-mono uppercase tracking-wider text-theme-accent">Day {programDay}/28</span>
                        )}
                    </>
                }
            >
                {/* Summary Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <AdminMetricCard icon={faUserGroup} tone="neutral" title="Total Members" value={members.length} />
                    <AdminMetricCard icon={faUserCheck} tone="neutral" title="Active" value={activeMembers} />
                    <AdminMetricCard icon={faCalendarDay} tone="neutral" title="Days Elapsed" value={daysElapsed} />
                </div>

                {/* Tabs */}
                <AdminCard variant="panel" flush>
                    <div className="border-b border-theme-line">
                        <div className="flex">
                            {TABS.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex items-center gap-2 px-6 py-3 text-xs font-mono uppercase tracking-wider border-b-2 transition-colors ${
                                        activeTab === tab.key
                                            ? 'border-theme-accent text-theme-accent'
                                            : 'border-transparent text-theme-text-muted hover:text-theme-text hover:border-theme-line'
                                    }`}
                                >
                                    <FontAwesomeIcon icon={tab.icon} className="h-4 w-4" />
                                    {tab.label}
                                    {tab.key === 'chat' && messages.length > 0 && (
                                        <AdminBadge tone="neutral" className="ml-1">{messages.length}</AdminBadge>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Members Tab */}
                    {activeTab === 'members' && (
                        <MembersTab
                            members={sortedMembers}
                            programDay={programDay}
                            getStatusBadge={(s) => getStatusBadge(s, MEMBER_STATUS_TONES)}
                            getTodayProgress={getTodayProgress}
                            formatDate={formatDate}
                            onMemberClick={(uid) => navigate(`/admin/users/${uid}`)}
                        />
                    )}

                    {/* Chat Tab */}
                    {activeTab === 'chat' && (
                        <ChatTab
                            messages={messages}
                            formatDate={formatDate}
                            formatTime={formatTime}
                            formatDateTime={formatDateTime}
                        />
                    )}
                </AdminCard>
            </AdminPage>
        </div>
    );
};

// =============================================================================
// Members Tab
// =============================================================================
const MEMBER_COLUMNS_BASE = [
    { key: 'member', label: 'Member' },
    { key: 'status', label: 'Status' },
    { key: 'streak', label: 'Streak' },
    { key: 'daysCompleted', label: 'Days Completed' },
];

const MembersTab = ({ members, programDay, getStatusBadge, getTodayProgress, formatDate, onMemberClick }) => {
    if (members.length === 0) {
        return <AdminEmptyState icon={faUsers} title="No members" />;
    }

    const columns = programDay
        ? [...MEMBER_COLUMNS_BASE, { key: 'today', label: 'Today' }]
        : MEMBER_COLUMNS_BASE;

    return (
        <>
            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-theme-line/50">
                {members.map((m) => {
                    const todayProg = getTodayProgress(m);
                    return (
                        <div
                            key={m.odivId}
                            onClick={() => onMemberClick(m.odivId)}
                            className="p-4 hover:bg-theme-bg-elevated cursor-pointer transition-colors"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-theme-text">
                                    {m.isPro && <FontAwesomeIcon icon={faCrown} className="h-3 w-3 text-theme-accent mr-1" />}
                                    {m.odivUsername}
                                </span>
                                {getStatusBadge(m.status)}
                            </div>
                            {m.email && (
                                <div className="text-[0.6875rem] font-mono text-theme-text-muted mb-2">{m.email}</div>
                            )}
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="text-theme-text-muted font-mono text-[0.6875rem] uppercase tracking-wider">Streak</span>{' '}
                                    <span className="text-theme-text font-mono">{m.programStreak || 0}</span>
                                </div>
                                <div>
                                    <span className="text-theme-text-muted font-mono text-[0.6875rem] uppercase tracking-wider">Days</span>{' '}
                                    <span className="text-theme-text font-mono">{m.daysCompleted || 0}</span>
                                </div>
                                {todayProg && (
                                    <div className="col-span-2">
                                        <span className="text-theme-text-muted font-mono text-[0.6875rem] uppercase tracking-wider">Today</span>{' '}
                                        <span className={`font-mono ${todayProg.completed ? 'text-theme-neural-green' : 'text-theme-text'}`}>
                                            {todayProg.completed ? 'Done' : `${todayProg.sessionsPlayed || 0} sessions`}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block">
                <AdminTable columns={columns}>
                    {members.map((m) => {
                        const todayProg = getTodayProgress(m);
                        return (
                            <AdminTr key={m.odivId} onClick={() => onMemberClick(m.odivId)}>
                                <AdminTd className="whitespace-nowrap">
                                    <div className="text-sm font-medium text-theme-text">
                                        {m.isPro && <FontAwesomeIcon icon={faCrown} className="h-3 w-3 text-theme-accent mr-1" />}
                                        {m.odivUsername}
                                    </div>
                                    {m.email && <div className="text-[0.6875rem] font-mono text-theme-text-muted">{m.email}</div>}
                                </AdminTd>
                                <AdminTd className="whitespace-nowrap">{getStatusBadge(m.status)}</AdminTd>
                                <AdminTd mono className="whitespace-nowrap">{m.programStreak || 0}</AdminTd>
                                <AdminTd mono className="whitespace-nowrap">{m.daysCompleted || 0}</AdminTd>
                                {programDay && (
                                    <AdminTd mono className="whitespace-nowrap">
                                        {todayProg ? (
                                            todayProg.completed
                                                ? <span className="text-theme-neural-green">Done</span>
                                                : <span className="text-theme-text">{todayProg.sessionsPlayed || 0} sessions</span>
                                        ) : (
                                            <span className="text-theme-text-muted">-</span>
                                        )}
                                    </AdminTd>
                                )}
                            </AdminTr>
                        );
                    })}
                </AdminTable>
            </div>
        </>
    );
};

// =============================================================================
// Chat Tab
// =============================================================================
const ChatTab = ({ messages, formatDate, formatTime, formatDateTime }) => {
    if (messages.length === 0) {
        return <AdminEmptyState icon={faCommentSlash} title="No messages yet" />;
    }

    // Group consecutive messages by same author (for compact display)
    let lastAuthorId = null;
    let lastDate = null;

    return (
        <div className="max-h-[600px] overflow-y-auto custom-scrollbar p-4 space-y-0.5">
            {messages.map((msg) => {
                const isSystem = msg.type === 'system' || msg.type === 'milestone';
                const msgDate = msg.timestamp ? new Date(msg.timestamp).toLocaleDateString() : null;
                const showDateSep = msgDate && msgDate !== lastDate;
                const showAuthor = !isSystem && msg.authorId !== lastAuthorId;

                if (!isSystem) lastAuthorId = msg.authorId;
                else lastAuthorId = null;
                if (msgDate) lastDate = msgDate;

                return (
                    <React.Fragment key={msg.id}>
                        {/* Date separator */}
                        {showDateSep && (
                            <div className="section-divider py-2">
                                <span className="text-[0.6875rem] font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                                    {formatDate(msg.timestamp)}
                                </span>
                            </div>
                        )}

                        {/* System/milestone message */}
                        {isSystem ? (
                            <div className="flex items-center justify-center gap-2 my-2 py-2 px-4 bg-theme-accent/10 border border-theme-accent/30 rounded-lab">
                                {msg.type === 'milestone' && (
                                    <FontAwesomeIcon icon={faTrophy} className="h-3 w-3 text-theme-accent" />
                                )}
                                <p className="text-xs font-mono text-theme-accent text-center">{msg.text}</p>
                            </div>
                        ) : (
                            /* User message */
                            <div className={`px-3 py-2 bg-theme-bg-elevated border border-theme-line rounded-lab ${showAuthor ? 'mt-3' : ''}`}>
                                {showAuthor && (
                                    <div className="flex items-baseline gap-2 mb-0.5">
                                        <span className="text-xs font-mono text-theme-text">{msg.authorName}</span>
                                        <span className="text-[0.625rem] font-mono text-theme-text-muted">
                                            {formatTime(msg.timestamp)}
                                        </span>
                                    </div>
                                )}
                                <p className="text-sm text-theme-text-secondary break-words whitespace-pre-wrap">{msg.text}</p>

                                {/* Reactions */}
                                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                                        {Object.entries(msg.reactions)
                                            .filter(([, users]) => Array.isArray(users) && users.length > 0)
                                            .map(([emoji, users]) => (
                                                <AdminBadge key={emoji} tone="neutral">
                                                    <span>{emoji}</span>
                                                    <span className="text-[0.625rem]">{users.length}</span>
                                                </AdminBadge>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default CohortDetailPage;

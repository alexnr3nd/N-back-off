/* src/components/admin/AdminDashboard.js */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUsers,
    faUserPlus,
    faCrown,
    faGamepad,
    faCommentDots,
    faSpinner,
    faChartLine,
    faCalendarDay,
    faCalendarWeek,
    faCalendarDays,
    faRefresh,
    faBrain,
    faHome,
    faBell,
    faCreditCard,
    faMobileScreen,
} from '@fortawesome/free-solid-svg-icons';

// Import chart components
import NBackDistributionChart from './analytics/NBackDistributionChart';
import SessionsTrendChart from './analytics/SessionsTrendChart';
import ActiveUsersPanel from './analytics/ActiveUsersPanel';
import RecentSubscriptionActivity from './analytics/RecentSubscriptionActivity';
import ChurnMetricsCard from './analytics/ChurnMetricsCard';

// Shared admin primitives
import LoadingSpinner from '../ui/LoadingSpinner';
import AdminPage from './ui/AdminPage';
import AdminCard from './ui/AdminCard';
import AdminMetricCard from './ui/AdminMetricCard';
import AdminButton from './ui/AdminButton';
import AdminAlert from './ui/AdminAlert';

// Tab definitions
const TABS = [
    { id: 'overview', label: 'Overview', icon: faHome },
    { id: 'progress', label: 'Progress', icon: faBrain },
];

const SECTION_HEADING = 'text-lg font-serif italic text-theme-text';
const SUB_HEADING = 'text-xs font-mono uppercase tracking-[0.2em] text-theme-text-muted mb-2';

const PILL_BASE = 'px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-lab border transition-colors';
const PILL_ACTIVE = 'bg-theme-accent/15 text-theme-accent border-theme-accent/40';
const PILL_INACTIVE = 'bg-theme-bg-elevated text-theme-text-muted border-theme-line hover:border-theme-text-muted';

const QUICK_TILE = 'p-4 border border-theme-line rounded-lab hover:bg-theme-bg-elevated hover:border-theme-accent/40 text-left transition-colors';
const QUICK_TILE_TITLE = 'text-sm font-mono uppercase tracking-wider text-theme-text';
const QUICK_TILE_TEXT = 'text-xs text-theme-text-secondary mt-1';

// Calculate trend % for metric cards. Returns undefined when baseline is too small for meaningful %.
const calcTrend = (current, previous) => {
    if (previous < 5) return undefined;
    return Math.round(((current - previous) / previous) * 100);
};

const FEEDBACK_LAST_VIEWED_KEY = 'admin_feedback_last_viewed';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [engagementPeriod, setEngagementPeriod] = useState('today');

    // Separate state for each section's data
    const [overviewData, setOverviewData] = useState(null);

    // Check if there's new feedback since last visit
    const hasNewFeedback = React.useMemo(() => {
        if (!overviewData?.feedback?.newestAt) return false;
        const lastViewed = localStorage.getItem(FEEDBACK_LAST_VIEWED_KEY);
        if (!lastViewed) return true; // Never viewed = show indicator
        return new Date(overviewData.feedback.newestAt) > new Date(lastViewed);
    }, [overviewData?.feedback?.newestAt]);
    const [progressData, setProgressData] = useState(null);

    // Loading and error states per section
    const [loading, setLoading] = useState({});
    const [errors, setErrors] = useState({});
    const [lastUpdated, setLastUpdated] = useState({});

    // Fetch overview metrics (fast - uses pre-aggregated data)
    const fetchOverview = useCallback(async (force = false, period = engagementPeriod) => {
        if (overviewData && !force && overviewData.engagement?.engagementPeriod === period) return;

        setLoading(prev => ({ ...prev, overview: true }));
        setErrors(prev => ({ ...prev, overview: null }));

        try {
            const fn = httpsCallable(functions, 'adminGetOverviewMetrics');
            const result = await fn({ engagementPeriod: period });
            if (result.data.success) {
                setOverviewData(result.data.metrics);
                setLastUpdated(prev => ({ ...prev, overview: new Date(result.data.generatedAt) }));
            }
        } catch (err) {
            console.error('[AdminDashboard] Error fetching overview:', err);
            setErrors(prev => ({ ...prev, overview: err.message }));
        } finally {
            setLoading(prev => ({ ...prev, overview: false }));
        }
    }, [overviewData, engagementPeriod]);

    // Refetch when engagement period changes
    useEffect(() => {
        if (activeTab === 'overview') {
            fetchOverview(true, engagementPeriod);
        }
    }, [engagementPeriod]);

    // Fetch progress metrics
    const fetchProgress = useCallback(async (force = false) => {
        if (progressData && !force) return;

        setLoading(prev => ({ ...prev, progress: true }));
        setErrors(prev => ({ ...prev, progress: null }));

        try {
            const fn = httpsCallable(functions, 'adminGetProgressMetrics');
            const result = await fn({});
            if (result.data.success) {
                setProgressData(result.data.metrics);
                setLastUpdated(prev => ({ ...prev, progress: new Date(result.data.generatedAt) }));
            }
        } catch (err) {
            console.error('[AdminDashboard] Error fetching progress:', err);
            setErrors(prev => ({ ...prev, progress: err.message }));
        } finally {
            setLoading(prev => ({ ...prev, progress: false }));
        }
    }, [progressData]);

    // Load data when tab changes
    useEffect(() => {
        switch (activeTab) {
            case 'overview':
                fetchOverview();
                break;
            case 'progress':
                fetchProgress();
                break;
            default:
                break;
        }
    }, [activeTab, fetchOverview, fetchProgress]);

    // Initial load
    useEffect(() => {
        fetchOverview();
    }, []);

    // Refresh current tab
    const handleRefresh = () => {
        switch (activeTab) {
            case 'overview':
                fetchOverview(true);
                break;
            case 'progress':
                fetchProgress(true);
                break;
            default:
                break;
        }
    };

    const isCurrentTabLoading = loading[activeTab];
    const currentLastUpdated = lastUpdated[activeTab];

    // Render Overview Section
    const renderOverview = () => {
        if (loading.overview && !overviewData) {
            return <LoadingSpinner theme="auto" message="Loading metrics" />;
        }
        if (errors.overview && !overviewData) {
            return <AdminAlert tone="error">{errors.overview}</AdminAlert>;
        }
        if (!overviewData) return null;

        return (
            <div className="space-y-6">
                {/* Active Users - Real-time */}
                <ActiveUsersPanel />

                {/* User Metrics */}
                <div>
                    <h2 className={`${SECTION_HEADING} mb-4 flex items-center`}>
                        <FontAwesomeIcon icon={faUsers} className="h-4 w-4 mr-2 text-theme-text-muted" />
                        User Metrics
                    </h2>

                    {/* Summary row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <AdminMetricCard
                            icon={faUsers}
                            tone="neutral"
                            title="Total Users"
                            value={overviewData.users.total.toLocaleString()}
                            subtitle={`${overviewData.users.premium} premium, ${overviewData.users.free} free`}
                        />
                        <AdminMetricCard
                            icon={faBell}
                            tone="accent"
                            title="Daily Reminders"
                            value={overviewData.users.dailyRemindersEnabled.toLocaleString()}
                            subtitle="users opted in"
                        />
                        <AdminMetricCard
                            icon={faCreditCard}
                            tone="neutral"
                            title="Stripe Subs"
                            value={(overviewData.subscriptions?.stripe?.total ?? 0).toLocaleString()}
                            subtitle={`${overviewData.subscriptions?.stripe?.active ?? 0} active, ${overviewData.subscriptions?.stripe?.trialing ?? 0} trialing`}
                        />
                        <AdminMetricCard
                            icon={faMobileScreen}
                            tone="neutral"
                            title="RevenueCat Subs"
                            value={(overviewData.subscriptions?.revenueCat?.total ?? 0).toLocaleString()}
                            subtitle={`${overviewData.subscriptions?.revenueCat?.active ?? 0} active, ${overviewData.subscriptions?.revenueCat?.trialing ?? 0} trialing`}
                        />
                    </div>

                    {/* Active Users row */}
                    <h3 className={SUB_HEADING}>Active Users</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <AdminMetricCard
                            icon={faCalendarDay}
                            tone="success"
                            title="Active Today"
                            value={overviewData.activity.dau.toLocaleString()}
                            subtitle={`${((overviewData.activity.dau / overviewData.users.total) * 100).toFixed(1)}% of total · prev: ${overviewData.activity.prevDau}`}
                            trend={calcTrend(overviewData.activity.dau, overviewData.activity.prevDau)}
                        />
                        <AdminMetricCard
                            icon={faCalendarWeek}
                            tone="success"
                            title="Active 7 Days"
                            value={overviewData.activity.wau.toLocaleString()}
                            subtitle={`${((overviewData.activity.wau / overviewData.users.total) * 100).toFixed(1)}% of total · prev: ${overviewData.activity.prevWau}`}
                            trend={calcTrend(overviewData.activity.wau, overviewData.activity.prevWau)}
                        />
                        <AdminMetricCard
                            icon={faCalendarDays}
                            tone="success"
                            title="Active 30 Days"
                            value={overviewData.activity.mau.toLocaleString()}
                            subtitle={`${((overviewData.activity.mau / overviewData.users.total) * 100).toFixed(1)}% of total · prev: ${overviewData.activity.prevMau}`}
                            trend={calcTrend(overviewData.activity.mau, overviewData.activity.prevMau)}
                        />
                    </div>

                    {/* New Users row */}
                    <h3 className={SUB_HEADING}>New Users</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <AdminMetricCard
                            icon={faUserPlus}
                            tone="info"
                            title="New Today"
                            value={(overviewData.activity.newToday ?? 0).toLocaleString()}
                            subtitle={`prev: ${overviewData.activity.prevNewToday ?? 0}`}
                            trend={calcTrend(overviewData.activity.newToday ?? 0, overviewData.activity.prevNewToday ?? 0)}
                        />
                        <AdminMetricCard
                            icon={faUserPlus}
                            tone="info"
                            title="New 7 Days"
                            value={overviewData.activity.newThisWeek.toLocaleString()}
                            subtitle={`prev: ${overviewData.activity.prevNewThisWeek ?? 0}`}
                            trend={calcTrend(overviewData.activity.newThisWeek, overviewData.activity.prevNewThisWeek ?? 0)}
                        />
                        <AdminMetricCard
                            icon={faUserPlus}
                            tone="info"
                            title="New 30 Days"
                            value={overviewData.activity.newThisMonth.toLocaleString()}
                            subtitle={`prev: ${overviewData.activity.prevNewThisMonth ?? 0}`}
                            trend={calcTrend(overviewData.activity.newThisMonth, overviewData.activity.prevNewThisMonth ?? 0)}
                        />
                    </div>
                </div>

                {/* Engagement Metrics */}
                <div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <h2 className={`${SECTION_HEADING} flex items-center`}>
                            <FontAwesomeIcon icon={faGamepad} className="h-4 w-4 mr-2 text-theme-text-muted" />
                            Engagement
                        </h2>
                        {/* Time Period Filter */}
                        <div className="flex items-center gap-2">
                            {[
                                { value: 'today', label: 'Today' },
                                { value: '7days', label: 'Last 7 Days' },
                                { value: '30days', label: 'Last 30 Days' },
                            ].map(period => (
                                <button
                                    key={period.value}
                                    onClick={() => setEngagementPeriod(period.value)}
                                    className={`${PILL_BASE} ${engagementPeriod === period.value ? PILL_ACTIVE : PILL_INACTIVE}`}
                                >
                                    {period.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <AdminMetricCard
                            icon={faGamepad}
                            tone="neutral"
                            title="Single N-Back"
                            value={(overviewData.engagement.sessionsByMode?.single || 0).toLocaleString()}
                            subtitle="sessions"
                        />
                        <AdminMetricCard
                            icon={faGamepad}
                            tone="neutral"
                            title="Dual N-Back"
                            value={(overviewData.engagement.sessionsByMode?.dual || 0).toLocaleString()}
                            subtitle="sessions"
                        />
                        <AdminMetricCard
                            icon={faGamepad}
                            tone="neutral"
                            title="Triple N-Back"
                            value={(overviewData.engagement.sessionsByMode?.triple || 0).toLocaleString()}
                            subtitle="sessions"
                        />
                        <AdminMetricCard
                            icon={faGamepad}
                            tone="neutral"
                            title="Quad N-Back"
                            value={(overviewData.engagement.sessionsByMode?.quad || 0).toLocaleString()}
                            subtitle="sessions"
                        />
                        <AdminMetricCard
                            icon={faChartLine}
                            tone="accent"
                            title="Total Sessions"
                            value={(overviewData.engagement.sessionsByMode?.total || 0).toLocaleString()}
                            subtitle={engagementPeriod === 'today' ? 'today' : engagementPeriod === '7days' ? 'last 7 days' : 'last 30 days'}
                        />
                    </div>
                </div>

                {/* Recent subscription activity */}
                <RecentSubscriptionActivity />

                {/* Subscriber churn + trial funnel */}
                <ChurnMetricsCard />

                {/* Quick Links */}
                <AdminCard title="Quick Actions">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => navigate('/admin/users')}
                            className={QUICK_TILE}
                        >
                            <FontAwesomeIcon icon={faUsers} className="h-5 w-5 text-theme-accent mb-2" />
                            <h3 className={QUICK_TILE_TITLE}>Manage Users</h3>
                            <p className={QUICK_TILE_TEXT}>View and manage user accounts</p>
                        </button>
                        <button
                            onClick={() => navigate('/admin/feedback')}
                            className={`${QUICK_TILE} relative`}
                        >
                            {hasNewFeedback && (
                                <span className="absolute top-2 right-2 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-lab bg-theme-accent opacity-75"></span>
                                    <span className="relative inline-flex rounded-lab h-3 w-3 bg-theme-accent"></span>
                                </span>
                            )}
                            <FontAwesomeIcon icon={faCommentDots} className="h-5 w-5 text-theme-neural-green mb-2" />
                            <h3 className={QUICK_TILE_TITLE}>Review Feedback</h3>
                            <p className={QUICK_TILE_TEXT}>
                                {overviewData.feedback.pending > 0
                                    ? `${overviewData.feedback.pending} pending items`
                                    : 'No pending items'}
                            </p>
                        </button>
                        <a
                            href="https://dashboard.stripe.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={QUICK_TILE}
                        >
                            <FontAwesomeIcon icon={faCrown} className="h-5 w-5 text-theme-accent mb-2" />
                            <h3 className={QUICK_TILE_TITLE}>Stripe Dashboard</h3>
                            <p className={QUICK_TILE_TEXT}>Manage payments and subscriptions</p>
                        </a>
                    </div>
                </AdminCard>
            </div>
        );
    };

    // Render Progress Section
    const renderProgress = () => {
        if (loading.progress && !progressData) {
            return <LoadingSpinner theme="auto" message="Loading metrics" />;
        }
        if (errors.progress && !progressData) {
            return <AdminAlert tone="error">{errors.progress}</AdminAlert>;
        }
        if (!progressData) return null;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <AdminCard
                        title="N-Back Level Distribution"
                        subtitle="Users at each training level"
                    >
                        <NBackDistributionChart distribution={progressData.nBackDistribution} />
                    </AdminCard>
                    <AdminCard
                        title="Total Sessions"
                        subtitle="Training activity over time"
                    >
                        <SessionsTrendChart
                            sessionsHourly={progressData.sessionsHourly}
                            sessionsMonthly={progressData.sessionsMonthly}
                            sessionsYearly={progressData.sessionsYearly}
                            totalSessionsToday={progressData.totalSessionsToday}
                            totalSessions30Days={progressData.totalSessions30Days}
                            totalSessionsYear={progressData.totalSessionsYear}
                        />
                    </AdminCard>
                </div>
            </div>
        );
    };

    // Render active tab content
    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return renderOverview();
            case 'progress':
                return renderProgress();
            default:
                return null;
        }
    };

    return (
        <AdminPage
            eyebrow="Admin Console"
            title="Dashboard"
            actions={(
                <AdminButton
                    variant="secondary"
                    icon={faRefresh}
                    loading={isCurrentTabLoading}
                    onClick={handleRefresh}
                >
                    Refresh
                </AdminButton>
            )}
        >
            <div>
                {currentLastUpdated && (
                    <p className="text-xs font-mono text-theme-text-muted mb-3">
                        Last updated: {currentLastUpdated.toLocaleTimeString()}
                    </p>
                )}

                {/* Tab Navigation */}
                <div className="border-b border-theme-line -mx-4 px-4 sm:mx-0 sm:px-0">
                    <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto custom-scrollbar">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    py-4 px-1 border-b-2 font-mono uppercase tracking-wider text-xs flex items-center whitespace-nowrap flex-shrink-0 transition-colors
                                    ${activeTab === tab.id
                                        ? 'border-theme-accent text-theme-accent'
                                        : 'border-transparent text-theme-text-muted hover:text-theme-text hover:border-theme-line'
                                    }
                                `}
                            >
                                <FontAwesomeIcon icon={tab.icon} className="h-3.5 w-3.5 mr-2" />
                                {tab.label}
                                {loading[tab.id] && (
                                    <FontAwesomeIcon icon={faSpinner} className="h-3 w-3 ml-2 animate-spin" />
                                )}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Tab Content */}
            {renderTabContent()}
        </AdminPage>
    );
};

export default AdminDashboard;

/* src/components/admin/users/UserOverviewCards.js */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUser,
    faCrown,
    faChartLine,
    faGraduationCap,
    faBrain,
    faGamepad,
    faBell,
    faBellSlash,
    faCheckCircle,
    faCircle,
    faExternalLinkAlt,
    faCoffee,
    faForward
} from '@fortawesome/free-solid-svg-icons';
import { DAILY_ADAPTIVE_CAP } from '../../../constants/gameConstants';
import AdminCard from '../ui/AdminCard';
import AdminBadge from '../ui/AdminBadge';
import { DL_TERM, DL_VALUE, LINK } from '../ui/adminStyles';
import { formatTrainingLevel } from './UserPresenceBanner';

// Protocol guide sections for display
const PROTOCOL_GUIDE_SECTIONS = [
    { id: 'intro', title: 'Introduction' },
    { id: 'visual', title: 'Position Training' },
    { id: 'audio', title: 'Audio Training' },
    { id: 'dual', title: 'Dual N-Back' },
    { id: 'progression', title: 'Progression System' },
    { id: 'dashboard-tour', title: 'Dashboard Tour' },
];

const PROGRESS_MODES = ['all', 'single', 'dual', 'triple', 'quad'];

// Aggregate-mode tones — kept in step with getGameModeDisplay in UserPresenceBanner
const MODE_TONES = { single: 'success', dual: 'accent', triple: 'info', quad: 'neutral' };

const STATUS_TONES = {
    active: 'success',
    trialing: 'info',
    canceled: 'accent',
    inactive: 'neutral',
    past_due: 'danger',
};

const FREE_TIER_TONES = {
    adaptive_grandfathered: 'info',
    classic_legacy: 'success',
    limited_modern: 'accent',
};

const PILL_BASE = 'px-2 py-0.5 text-[0.6875rem] font-mono uppercase tracking-wider border rounded-lab transition-colors';
const PILL_ACTIVE = 'bg-theme-accent/15 text-theme-accent border-theme-accent/40';
const PILL_INACTIVE = 'bg-theme-bg-elevated text-theme-text-muted border-theme-line hover:border-theme-text-muted';

// Get training level for a specific mode from modeProgression
const getModeLevel = (modeProgression, mode) => {
    const modeData = modeProgression?.[mode];
    if (!modeData) return '2.00';
    return formatTrainingLevel(modeData.currentNBack, modeData.currentDifficulty);
};

const Row = ({ term, children }) => (
    <div>
        <dt className={DL_TERM}>{term}</dt>
        <dd className={DL_VALUE}>{children}</dd>
    </div>
);

const BadgeRow = ({ term, children }) => (
    <div>
        <dt className={DL_TERM}>{term}</dt>
        <dd className="mt-1">{children}</dd>
    </div>
);

const StatTile = ({ label, value }) => (
    <div className="text-center p-4 bg-theme-bg-elevated border border-theme-line rounded-lab">
        <div className="text-2xl sm:text-3xl font-mono text-theme-text tabular-nums">{value}</div>
        <div className="text-[0.6875rem] font-mono uppercase tracking-wider text-theme-text-muted mt-1">{label}</div>
    </div>
);

const LevelTile = ({ label, value }) => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lab bg-theme-bg-elevated border border-theme-line">
        <span className="text-[0.6875rem] font-mono uppercase tracking-wider text-theme-text-muted">{label}</span>
        <span className="text-xl font-mono text-theme-text tabular-nums">{value}</span>
    </div>
);

const SessionCount = ({ label, value }) => (
    <div className="flex justify-between">
        <span className="text-[0.6875rem] font-mono uppercase tracking-wider text-theme-text-muted">{label}</span>
        <span className="font-mono text-theme-text tabular-nums">{value}</span>
    </div>
);

const FATIGUE_VARIANTS = {
    took_break: { icon: faCoffee, iconClass: 'text-theme-neural-green', label: 'Took a Break' },
    continued: { icon: faForward, iconClass: 'text-theme-accent', label: 'Continued Anyway' },
    default: { icon: faBrain, iconClass: 'text-theme-text-muted', label: 'Warning Shown' },
};

/**
 * Overview cards for the admin user-detail page: identity/subscription/progress
 * grid, protocol-guide completion, fatigue warnings and session stats.
 * Pure presentational — all data and the mode-filter setter come from props.
 */
const UserOverviewCards = ({
    userData,
    stats,
    enhancedStats,
    progressStats,
    progressModeFilter,
    onProgressModeChange,
    fatigueWarnings,
    formatDate,
    formatDuration,
}) => {
    const completedSections = Object.values(userData.tutorialsCompleted || {}).filter(Boolean).length;
    const allSectionsDone = completedSections === PROTOCOL_GUIDE_SECTIONS.length;
    const byMode = enhancedStats?.sessionsByMode;
    const singleBreakdown = byMode ? [
        byMode.singleVisual ? `P:${byMode.singleVisual}` : null,
        byMode.singleAudio ? `A:${byMode.singleAudio}` : null,
        byMode.singleColor ? `C:${byMode.singleColor}` : null,
        byMode.singleColorRecall ? `R:${byMode.singleColorRecall}` : null,
        byMode.singleShape ? `S:${byMode.singleShape}` : null,
    ].filter(Boolean).join(' ') : '';

    return (
        <>
            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* User Info */}
                <AdminCard title="User Info" icon={faUser}>
                    <dl className="space-y-3">
                        <Row term="Signup Date">{formatDate(userData.createdAt || userData.auth?.createdAt)}</Row>
                        <Row term="Last Login">{formatDate(userData.lastLoginAt || userData.auth?.lastSignInAt)}</Row>
                        <Row term="Last Login IP">{userData.lastLoginIp || 'N/A'}</Row>
                        <Row term="Signup IP">{userData.signupIp || 'N/A'}</Row>
                        <Row term="Email Verified">
                            <span className={userData.auth?.emailVerified ? 'text-theme-neural-green' : 'text-neural-synapse'}>
                                {userData.auth?.emailVerified ? 'Yes' : 'No'}
                            </span>
                        </Row>
                        <Row term="Auth Providers">{userData.auth?.providers?.join(', ') || 'N/A'}</Row>
                        <Row term="Daily Reminders">
                            {userData.dailyReminderEnabled ? (
                                <span className="inline-flex items-center text-theme-neural-green">
                                    <FontAwesomeIcon icon={faBell} className="h-3 w-3 mr-1.5" />
                                    Enabled
                                    {userData.dailyReminderTimeBlock && (
                                        <span className="text-theme-text-muted ml-1">
                                            ({userData.dailyReminderTimeBlock})
                                        </span>
                                    )}
                                </span>
                            ) : (
                                <span className="inline-flex items-center text-theme-text-muted">
                                    <FontAwesomeIcon icon={faBellSlash} className="h-3 w-3 mr-1.5" />
                                    Disabled
                                </span>
                            )}
                        </Row>
                    </dl>
                </AdminCard>

                {/* Subscription Info */}
                <AdminCard title="Subscription" icon={faCrown}>
                    <dl className="space-y-3">
                        <BadgeRow term="Tier">
                            <AdminBadge tone={userData.subscriptionTier === 'premium' ? 'accent' : 'neutral'}>
                                {userData.subscriptionTier || 'free'}
                            </AdminBadge>
                        </BadgeRow>
                        <BadgeRow term="Status">
                            <AdminBadge tone={STATUS_TONES[userData.subscriptionStatus] || 'neutral'}>
                                {userData.subscriptionStatus || 'inactive'}
                            </AdminBadge>
                        </BadgeRow>
                        <Row term="Period End">{formatDate(userData.subscriptionCurrentPeriodEnd)}</Row>
                        <Row term="Daily Sessions (Free, legacy)">{userData.dailySessionsCount ?? 0} / 10</Row>
                        <BadgeRow term="Free Tier Cohort">
                            {userData.freeTier ? (
                                <AdminBadge tone={FREE_TIER_TONES[userData.freeTier] || 'neutral'}>
                                    {userData.freeTier}
                                </AdminBadge>
                            ) : (
                                <span className="text-xs font-serif italic text-theme-text-muted">not set</span>
                            )}
                        </BadgeRow>
                        <Row term="Adaptive Today (cap counter)">
                            {userData.dailyAdaptiveCount ?? 0} / {DAILY_ADAPTIVE_CAP}
                            <span className="text-[0.6875rem] text-theme-text-muted ml-2">
                                ({userData.dailyAdaptiveCountDate || 'never'})
                            </span>
                        </Row>
                        {userData.stripeCustomerId && (
                            <Row term="Stripe Customer">
                                <a
                                    href={`https://dashboard.stripe.com/customers/${userData.stripeCustomerId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`${LINK} flex items-center`}
                                >
                                    {userData.stripeCustomerId.substring(0, 20)}...
                                    <FontAwesomeIcon icon={faExternalLinkAlt} className="h-3 w-3 ml-1" />
                                </a>
                            </Row>
                        )}
                    </dl>
                </AdminCard>

                {/* Progress Info */}
                <AdminCard title="Progress" icon={faChartLine}>
                    {/* Mode Filter */}
                    <div className="flex items-center gap-1 flex-wrap mb-4">
                        {PROGRESS_MODES.map(mode => (
                            <button
                                key={mode}
                                onClick={() => onProgressModeChange(mode)}
                                className={`${PILL_BASE} ${progressModeFilter === mode ? PILL_ACTIVE : PILL_INACTIVE}`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                    <dl className="space-y-3">
                        <div>
                            <dt className={`${DL_TERM} mb-2`}>Training Level</dt>
                            {progressModeFilter === 'all' ? (
                                <dd className="flex flex-wrap gap-3">
                                    <LevelTile label="Dual" value={getModeLevel(userData.modeProgression, 'dual')} />
                                    <LevelTile label="Triple" value={getModeLevel(userData.modeProgression, 'triple')} />
                                    <LevelTile label="Quad" value={getModeLevel(userData.modeProgression, 'quad')} />
                                </dd>
                            ) : (
                                <dd>
                                    <span className="text-2xl font-mono text-theme-accent tabular-nums">
                                        {getModeLevel(userData.modeProgression, progressModeFilter)}
                                    </span>
                                    <div className="text-[0.6875rem] font-mono text-theme-text-muted mt-1">
                                        {progressStats.sessionCount} sessions •
                                        Avg accuracy: {(progressStats.avgAccuracy * 100).toFixed(1)}% •
                                        Avg d′: {progressStats.avgDprime.toFixed(2)}
                                    </div>
                                </dd>
                            )}
                        </div>
                        <div className="pt-2 border-t border-theme-line/50">
                            <dt className={`${DL_TERM} mb-2`}>Sessions</dt>
                            <dd className="grid grid-cols-2 gap-2 text-sm">
                                <SessionCount label="Today" value={stats?.sessionsToday ?? 0} />
                                <SessionCount label="7 days" value={stats?.sessionsLast7Days ?? 0} />
                                <SessionCount label="30 days" value={stats?.sessionsLast30Days ?? 0} />
                                <SessionCount label="All time" value={stats?.totalSessions ?? 0} />
                            </dd>
                        </div>
                    </dl>
                </AdminCard>
            </div>

            {/* Protocol Guide Completion */}
            <AdminCard
                title="Protocol Guide"
                icon={faGraduationCap}
                actions={(
                    <AdminBadge tone={allSectionsDone ? 'success' : 'neutral'}>
                        {completedSections}/{PROTOCOL_GUIDE_SECTIONS.length} completed
                    </AdminBadge>
                )}
            >
                <div className="flex flex-wrap gap-2">
                    {PROTOCOL_GUIDE_SECTIONS.map(section => {
                        const isCompleted = userData.tutorialsCompleted?.[section.id] === true;
                        return (
                            <AdminBadge
                                key={section.id}
                                tone={isCompleted ? 'accent' : 'neutral'}
                                icon={isCompleted ? faCheckCircle : faCircle}
                                className="py-1.5 px-2.5"
                            >
                                {section.title}
                            </AdminBadge>
                        );
                    })}
                </div>
            </AdminCard>

            {/* Fatigue Warnings Section */}
            {(userData?.fatigueWarningCount > 0 || fatigueWarnings.length > 0) && (
                <AdminCard
                    title="Diminishing Returns Warnings"
                    icon={faBrain}
                    actions={<AdminBadge tone="accent">{userData?.fatigueWarningCount ?? 0} total</AdminBadge>}
                >
                    {fatigueWarnings.length > 0 ? (
                        <div className="space-y-2">
                            {fatigueWarnings.map((warning) => {
                                const variant = FATIGUE_VARIANTS[warning.action] || FATIGUE_VARIANTS.default;
                                return (
                                    <div
                                        key={warning.id}
                                        className="flex items-center justify-between p-3 rounded-lab border border-theme-line bg-theme-bg-elevated"
                                    >
                                        <div className="flex items-center gap-3">
                                            <FontAwesomeIcon icon={variant.icon} className={`h-4 w-4 ${variant.iconClass}`} />
                                            <div>
                                                <span className={`text-sm font-mono ${variant.iconClass}`}>{variant.label}</span>
                                                <span className="text-xs font-mono text-theme-text-muted ml-2">
                                                    after {warning.consecutiveCount} sessions
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-[0.6875rem] font-mono text-theme-text-muted">
                                            {formatDate(warning.timestamp)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm font-serif italic text-theme-text-secondary">No recent warning events</p>
                    )}
                </AdminCard>
            )}

            {/* Stats Summary */}
            {stats && (
                <AdminCard title="Session Stats" subtitle="Last 50 sessions" icon={faGamepad}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatTile label="Total Sessions" value={stats.totalSessions} />
                        <StatTile label="Total Time" value={formatDuration(stats.totalDurationMs)} />
                        <StatTile label="Avg Accuracy" value={`${(stats.avgAccuracy * 100).toFixed(1)}%`} />
                        <StatTile label="Avg d-prime" value={stats.avgDprime?.toFixed(2) || 'N/A'} />
                    </div>
                    {/* Mode breakdown */}
                    {byMode && Object.keys(byMode).length > 0 && (
                        <div className="mt-4 pt-4 border-t border-theme-line/50">
                            <div className="text-[0.6875rem] font-mono uppercase tracking-[0.2em] text-theme-text-muted mb-2">
                                Sessions by Mode
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {['single', 'dual', 'triple', 'quad'].map(mode => (
                                    byMode[mode] > 0 ? (
                                        <AdminBadge key={mode} tone={MODE_TONES[mode]}>
                                            {mode}: {byMode[mode]}
                                            {mode === 'single' && singleBreakdown && (
                                                <span className="ml-2 opacity-70">{singleBreakdown}</span>
                                            )}
                                        </AdminBadge>
                                    ) : null
                                ))}
                            </div>
                        </div>
                    )}
                </AdminCard>
            )}
        </>
    );
};

export default UserOverviewCards;

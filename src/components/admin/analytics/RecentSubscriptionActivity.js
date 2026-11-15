/* src/components/admin/analytics/RecentSubscriptionActivity.js */

/**
 * Overview-tab widget: "Recently Subscribed" and "Recently Churned" user lists
 * from the last 30 days of subscriptionEvents, via adminGetSubscriptionActivity.
 * Rows navigate to the user's admin detail page.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebaseConfig';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faRefresh,
    faCrown,
    faCreditCard,
    faUserPlus,
    faUserMinus,
} from '@fortawesome/free-solid-svg-icons';
import { faAndroid, faApple } from '@fortawesome/free-brands-svg-icons';
import LoadingSpinner from '../../ui/LoadingSpinner';
import AdminCard from '../ui/AdminCard';
import AdminBadge from '../ui/AdminBadge';
import AdminButton from '../ui/AdminButton';
import AdminAlert from '../ui/AdminAlert';
import AdminEmptyState from '../ui/AdminEmptyState';

// eventType (+ source/finalized) → badge label + tone (see AdminBadge tone map)
const BADGES = {
    trial_started: { label: 'Trial', tone: 'info' },
    trial_converted: { label: 'Converted', tone: 'success' },
    subscription_started_direct: { label: 'Subscribed', tone: 'success' },
    lifetime_purchased: { label: 'Lifetime', tone: 'accent' },
    lifetime_trial_started: { label: 'Lifetime trial', tone: 'accent' },
    lifetime_trial_charged: { label: 'Lifetime', tone: 'accent' },
    subscription_resumed: { label: 'Resumed', tone: 'success' },
    subscription_canceled: { label: 'Canceled', tone: 'accent' },
    subscription_canceled_finalized: { label: 'Ended', tone: 'neutral' },
    subscription_expired: { label: 'Expired', tone: 'neutral' },
    trial_failed_conversion: { label: 'Trial ended', tone: 'accent' },
    refunded: { label: 'Refunded', tone: 'danger' },
    lifetime_trial_cancelled: { label: 'Trial canceled', tone: 'accent' },
};

const getBadge = (row) => {
    if (row.eventType === 'trial_started' && row.source === 'gifted') {
        // App-granted 14-day trial (retired July 2026) — no payment method attached
        return { label: 'Gifted trial', tone: 'accent' };
    }
    if (row.eventType === 'subscription_canceled' && row.finalized) {
        return BADGES.subscription_canceled_finalized;
    }
    return BADGES[row.eventType] || { label: row.eventType, tone: 'neutral' };
};

const formatRelativeTime = (iso) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

const UserRow = ({ row, navigate }) => {
    const badge = getBadge(row);
    return (
        <div
            onClick={row.isDeleted ? undefined : () => navigate(`/admin/users/${row.uid}`)}
            className={`p-3 rounded-lab border border-theme-line bg-theme-bg-elevated transition-colors ${
                row.isDeleted ? 'opacity-60' : 'cursor-pointer hover:bg-theme-bg-surface'
            }`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <div className="min-w-0 flex-1">
                        <p className={`text-sm text-theme-text truncate ${row.isDeleted ? 'italic' : ''}`}>
                            {row.subscriptionTier === 'premium' && (
                                <FontAwesomeIcon icon={faCrown} className="h-3 w-3 text-theme-accent mr-1" />
                            )}
                            {row.platform === 'android' && (
                                <FontAwesomeIcon icon={faAndroid} className="h-3 w-3 text-theme-neural-green mr-1" title="Android (Google Play)" />
                            )}
                            {row.platform === 'ios' && (
                                <FontAwesomeIcon icon={faApple} className="h-3 w-3 text-theme-text-secondary mr-1" title="iOS (App Store)" />
                            )}
                            {row.platform === 'web' && (
                                <FontAwesomeIcon icon={faCreditCard} className="h-3 w-3 text-theme-accent mr-1" title="Web (Stripe)" />
                            )}
                            {row.displayName}
                        </p>
                        <p className="text-xs font-mono text-theme-text-muted truncate">{row.email || 'No email'}</p>
                    </div>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end ml-2 space-y-1">
                    <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
                    <span className="text-[0.6875rem] font-mono text-theme-text-muted">{formatRelativeTime(row.timestamp)}</span>
                </div>
            </div>
        </div>
    );
};

const ActivityColumn = ({ title, icon, iconColor, rows, total, emptyText, navigate }) => (
    <div>
        <div className="flex items-center mb-3">
            <FontAwesomeIcon icon={icon} className={`mr-2 h-3.5 w-3.5 ${iconColor}`} />
            <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-theme-text-muted">{title}</h3>
            <span className="ml-2">
                <AdminBadge tone="neutral">
                    {total > rows.length ? `${rows.length} of ${total}` : rows.length}
                </AdminBadge>
            </span>
        </div>
        {rows.length === 0 ? (
            <AdminEmptyState title={emptyText} />
        ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                {rows.map((row) => (
                    <UserRow key={`${row.uid}-${row.timestamp}`} row={row} navigate={navigate} />
                ))}
            </div>
        )}
    </div>
);

const RecentSubscriptionActivity = () => {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchActivity = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const fn = httpsCallable(functions, 'adminGetSubscriptionActivity');
            const result = await fn();
            if (result.data.success) {
                setData(result.data);
            } else {
                setError(result.data.error || 'Failed to load subscription activity');
            }
        } catch (err) {
            console.error('[RecentSubscriptionActivity] Fetch error:', err);
            setError(err.message || 'Failed to load subscription activity');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchActivity();
    }, [fetchActivity]);

    return (
        <AdminCard
            title="Subscription Activity"
            subtitle={`Last ${data?.windowDays || 30} days`}
            actions={(
                <AdminButton
                    variant="ghost"
                    size="sm"
                    icon={faRefresh}
                    loading={loading}
                    onClick={fetchActivity}
                    title="Refresh"
                />
            )}
        >
            {loading && !data ? (
                <div className="py-8">
                    <LoadingSpinner small theme="auto" />
                </div>
            ) : error ? (
                <AdminAlert tone="error">{error}</AdminAlert>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ActivityColumn
                        title="Recently Subscribed"
                        icon={faUserPlus}
                        iconColor="text-theme-neural-green"
                        rows={data?.subscribed || []}
                        total={data?.totalSubscribed || 0}
                        emptyText="No new subscribers in the last 30 days"
                        navigate={navigate}
                    />
                    <ActivityColumn
                        title="Recently Churned"
                        icon={faUserMinus}
                        iconColor="text-neural-synapse"
                        rows={data?.churned || []}
                        total={data?.totalChurned || 0}
                        emptyText="No churn in the last 30 days"
                        navigate={navigate}
                    />
                </div>
            )}
        </AdminCard>
    );
};

export default RecentSubscriptionActivity;

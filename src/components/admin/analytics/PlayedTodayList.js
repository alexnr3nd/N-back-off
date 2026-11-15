/* src/components/admin/analytics/PlayedTodayList.js */

/**
 * Row list for the Active Users panel's "Played Today" tab. Presentation only —
 * the adminGetPlayedTodayUsers fetch stays in ActiveUsersPanel.js.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faClock, faCrown, faPlay } from '@fortawesome/free-solid-svg-icons';
import { faAndroid, faApple } from '@fortawesome/free-brands-svg-icons';
import LoadingSpinner from '../../ui/LoadingSpinner';
import AdminAlert from '../ui/AdminAlert';
import AdminEmptyState from '../ui/AdminEmptyState';

// Format milliseconds into human-readable duration (e.g., "1h 23m")
const formatDurationMs = (ms) => {
    if (!ms || ms <= 0) return '0m';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
};

const PlayedTodayList = ({ users, loading, error, navigate }) => {
    if (loading) {
        return (
            <div className="py-8">
                <LoadingSpinner small theme="auto" />
            </div>
        );
    }

    if (error) {
        return <AdminAlert tone="error">{error}</AdminAlert>;
    }

    if (users.length === 0) {
        return <AdminEmptyState title="No users have played today yet" />;
    }

    return (
        <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
            {users.map((user) => (
                <div
                    key={user.uid}
                    onClick={() => navigate(`/admin/users/${user.uid}`)}
                    className={`p-3 rounded-lab border cursor-pointer transition-colors ${
                        user.isOnline
                            ? 'border-theme-neural-green/30 bg-theme-neural-green/10 hover:bg-theme-neural-green/20'
                            : 'border-theme-line bg-theme-bg-elevated hover:bg-theme-bg-surface'
                    }`}
                >
                    {/* Desktop: Row layout */}
                    <div className="flex items-center justify-between">
                        {/* User Info */}
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                            {/* Session count or Online indicator */}
                            <div className={`flex-shrink-0 w-8 h-8 rounded-lab border flex items-center justify-center ${
                                user.isOnline
                                    ? 'bg-theme-neural-green/15 border-theme-neural-green/40 text-theme-neural-green'
                                    : 'bg-theme-accent/15 border-theme-accent/40 text-theme-accent'
                            }`}>
                                {user.isOnline ? (
                                    <FontAwesomeIcon icon={faCircle} className="h-2 w-2" />
                                ) : (
                                    <span className="text-sm font-mono tabular-nums">{user.sessionCount}</span>
                                )}
                            </div>

                            {/* Name and Email */}
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-theme-text truncate">
                                    {user.subscriptionTier === 'premium' && (
                                        <FontAwesomeIcon icon={faCrown} className="h-3 w-3 text-theme-accent mr-1" />
                                    )}
                                    {user.platform === 'android' && (
                                        <FontAwesomeIcon icon={faAndroid} className="h-3 w-3 text-theme-neural-green mr-1" title="Android app" />
                                    )}
                                    {user.platform === 'ios' && (
                                        <FontAwesomeIcon icon={faApple} className="h-3 w-3 text-theme-text-secondary mr-1" title="iOS app" />
                                    )}
                                    {user.displayName}
                                </p>
                                <p className="text-xs font-mono text-theme-text-muted truncate">
                                    {user.email || 'No email'}
                                </p>
                            </div>
                        </div>

                        {/* Desktop: Right side info */}
                        <div className="hidden sm:flex flex-shrink-0 items-center space-x-4 ml-2">
                            {/* Sessions count */}
                            <div className="flex items-center text-xs font-mono text-theme-text-secondary" title="Sessions today">
                                <FontAwesomeIcon icon={faPlay} className="mr-1 h-2.5 w-2.5 text-theme-text-muted" />
                                <span className="tabular-nums">{user.sessionCount}</span>
                            </div>

                            {/* Level Range: Low / Avg / Peak */}
                            <div className="flex items-center text-xs font-mono space-x-1" title="Level range: Low / Avg / Peak">
                                <span className="text-theme-text-muted">{user.lowestLevel}</span>
                                <span className="text-theme-text-muted/60">/</span>
                                <span className="text-theme-text">{user.avgLevel}</span>
                                <span className="text-theme-text-muted/60">/</span>
                                <span className="text-theme-accent">{user.peakLevel}</span>
                            </div>

                            {/* Duration */}
                            <div className="flex items-center text-xs font-mono text-theme-text-muted w-16 justify-end" title="Total training time">
                                <FontAwesomeIcon icon={faClock} className="mr-1 h-2.5 w-2.5" />
                                {formatDurationMs(user.totalDurationMs)}
                            </div>
                        </div>

                        {/* Mobile: Just show sessions */}
                        <div className="sm:hidden flex items-center text-xs font-mono text-theme-text-secondary ml-2">
                            <FontAwesomeIcon icon={faPlay} className="mr-1 h-2.5 w-2.5" />
                            {user.sessionCount}
                        </div>
                    </div>

                    {/* Mobile: Second row with level range */}
                    <div className="sm:hidden mt-2 flex items-center justify-between text-xs">
                        <span className="font-mono text-theme-text-secondary">
                            {user.lowestLevel} / {user.avgLevel} / <span className="text-theme-accent">{user.peakLevel}</span>
                        </span>
                        <span className="font-mono text-theme-text-muted">
                            <FontAwesomeIcon icon={faClock} className="mr-1 h-2.5 w-2.5" />
                            {formatDurationMs(user.totalDurationMs)}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};

PlayedTodayList.propTypes = {
    users: PropTypes.array.isRequired,
    loading: PropTypes.bool,
    error: PropTypes.string,
    navigate: PropTypes.func.isRequired,
};

export default PlayedTodayList;

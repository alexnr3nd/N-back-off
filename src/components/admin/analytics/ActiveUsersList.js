/* src/components/admin/analytics/ActiveUsersList.js */

/**
 * Row list for the Active Users panel's Active / AFK / Recently Online tabs.
 * Presentation only — all presence data, timers and fetching stay in
 * ActiveUsersPanel.js and arrive here as props.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faGamepad,
    faPause,
    faSpinner,
    faUser,
    faClock,
    faChartLine,
    faPlay,
    faBook,
    faCrown,
    faCreditCard,
    faTimesCircle,
    faClipboardCheck,
} from '@fortawesome/free-solid-svg-icons';
import { faAndroid, faApple } from '@fortawesome/free-brands-svg-icons';
import { formatCombinedDifficulty } from '../../../contexts/gameHelpers';
import AdminEmptyState from '../ui/AdminEmptyState';

// Format seconds into human-readable time
const formatTimeOnPage = (seconds) => {
    if (seconds < 60) {
        return `${seconds}s`;
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        return `${mins}m`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
    }
};

// Helper to format "last seen" time for recent users
const formatLastSeen = (lastSeenMs) => {
    const diffMs = Date.now() - lastSeenMs;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
};

// Format training level from nBack and difficulty into N.DD format
const formatTrainingLevel = (nBack, difficulty) => {
    return formatCombinedDifficulty(nBack ?? 2, difficulty ?? 0);
};

// Tone classes for the tiny inline tags (same palette as AdminBadge tones, smaller metrics).
const TAG_TONES = {
    neutral: 'bg-theme-bg-surface text-theme-text-secondary border-theme-line',
    accent: 'bg-theme-accent/15 text-theme-accent border-theme-accent/40',
    success: 'bg-theme-neural-green/15 text-theme-neural-green border-theme-neural-green/40',
    info: 'bg-theme-neural-blue/15 text-theme-neural-blue border-theme-neural-blue/40',
};
const TAG_BASE = 'px-1 py-0.5 border rounded-lab text-[0.625rem] font-mono uppercase';

// Short + tone for the mode tag shown next to an active user's training level.
const getModeTag = (mode) => {
    switch (mode) {
        case 'triple':       return { short: 'TRI',   className: TAG_TONES.info };
        case 'quad':         return { short: 'QUAD',  className: TAG_TONES.success };
        case 'dynamic':      return { short: 'DYN',   className: TAG_TONES.neutral };
        case 'singleVisual': return { short: 'S-POS', className: TAG_TONES.neutral };
        case 'singleAudio':  return { short: 'S-AUD', className: TAG_TONES.neutral };
        case 'singleColor':  return { short: 'S-COL', className: TAG_TONES.neutral };
        case 'singleColorRecall': return { short: 'S-REC', className: TAG_TONES.neutral };
        case 'singleShape':  return { short: 'S-SHP', className: TAG_TONES.neutral };
        default:             return { short: 'DUAL',  className: TAG_TONES.accent };
    }
};

// Short + tone for training mode (Adaptive vs Classic) shown next to the game-mode tag.
const getTrainingModeTag = (trainingMode) => {
    switch (trainingMode) {
        case 'classic':  return { short: 'CLA', className: TAG_TONES.neutral };
        case 'adaptive': return { short: 'ADA', className: TAG_TONES.accent };
        case 'dynamic':  return { short: 'DYN', className: TAG_TONES.neutral };
        default:         return null;
    }
};

// Format session results for display: "d′ 2.45 • 4.24 → 4.56"
const formatSessionResults = (sessionResults) => {
    if (!sessionResults) return null;
    const dprime = sessionResults.overallDprime?.toFixed(2) ?? '?';
    const oldLevel = formatTrainingLevel(sessionResults.oldNBack, sessionResults.oldDifficulty);
    const newLevel = formatTrainingLevel(sessionResults.newNBack, sessionResults.newDifficulty);
    return `d′ ${dprime} • ${oldLevel} → ${newLevel}`;
};

// Estimate current trial from timing params when available (avoids per-trial heartbeats)
const getEstimatedTrial = (gameProgress) => {
    if (!gameProgress) return null;
    const { startedAt, calculatedISI, currentTrial, totalTrials } = gameProgress;
    if (startedAt && calculatedISI && gameProgress.gameState === 'playing') {
        const estimated = Math.min(
            Math.floor((Date.now() - startedAt) / (calculatedISI * 1000)) + 1,
            totalTrials
        );
        return `~${estimated}`;
    }
    return String(currentTrial);
};

// Get activity icon + chip tone
const getActivityDisplay = (activity, gameProgress) => {
    switch (activity) {
        case 'playing':
            return { icon: faGamepad, chip: TAG_TONES.success, label: 'Playing' };
        case 'paused':
            return { icon: faPause, chip: TAG_TONES.accent, label: 'Paused' };
        case 'preparing':
            return { icon: faSpinner, chip: TAG_TONES.info, label: 'Starting' };
        case 'results':
            return { icon: faChartLine, chip: TAG_TONES.info, label: 'Results' };
        case 'protocol-guide':
            return { icon: faBook, chip: TAG_TONES.success, label: 'Protocol Guide' };
        case 'checkout':
            return { icon: faCreditCard, chip: TAG_TONES.accent, label: 'In Checkout' };
        case 'declined-upgrade':
            return { icon: faTimesCircle, chip: 'bg-neural-synapse/15 text-neural-synapse border-neural-synapse/40', label: 'Declined Upgrade' };
        case 'assessment':
            return { icon: faClipboardCheck, chip: TAG_TONES.success, label: 'Assessment' };
        default:
            return { icon: faUser, chip: TAG_TONES.neutral, label: 'Browsing' };
    }
};

// Format CST phase name for display
const formatCstPhase = (phase) => {
    const phaseNames = {
        'fixation': 'Fixation',
        'odd_even_judgment': 'Counting',
        'processing_transition': 'Transition',
        'recall': 'Recall',
        'set_start': 'Set Start',
        'ready_assessment': 'Ready',
        'practice_processing': 'Practice',
        'practice_recall': 'Practice Recall',
        'practice_integrated': 'Practice',
    };
    return phaseNames[phase] || phase;
};

// Row background tone by activity.
const getRowTone = (activity) => {
    if (['playing', 'paused', 'preparing', 'results'].includes(activity)) {
        return 'border-theme-neural-blue/30 bg-theme-neural-blue/10 hover:bg-theme-neural-blue/20';
    }
    if (activity === 'protocol-guide' || activity === 'assessment') {
        return 'border-theme-neural-green/30 bg-theme-neural-green/10 hover:bg-theme-neural-green/20';
    }
    if (activity === 'checkout') {
        return 'border-theme-accent/30 bg-theme-accent/10 hover:bg-theme-accent/20';
    }
    if (activity === 'declined-upgrade') {
        return 'border-neural-synapse/30 bg-neural-synapse/10 hover:bg-neural-synapse/20';
    }
    return 'border-theme-line bg-theme-bg-elevated hover:bg-theme-bg-surface';
};

const EMPTY_TEXT = {
    active: 'No active users right now',
    afk: 'No AFK users',
    recent: 'No recently online users',
};

/** The route name plus whatever contextual detail the user's presence doc carries. */
const RouteDetails = ({ user, showGameModeTag, upgradePromptTime, isInCheckout, isDeclined }) => (
    <>
        {user.routeName}
        {user.gameProgress && (() => {
            const trainingTag = getTrainingModeTag(user.gameProgress.trainingMode);
            return (
                <span className="ml-1 inline-flex items-center gap-1">
                    {showGameModeTag && (
                        <span className={`${TAG_BASE} ${getModeTag(user.gameProgress.gameMode).className}`}>
                            {getModeTag(user.gameProgress.gameMode).short}
                        </span>
                    )}
                    {trainingTag && (
                        <span
                            className={`${TAG_BASE} ${trainingTag.className}`}
                            title={user.gameProgress.trainingMode === 'classic' ? 'Classic (fixed 0.50)' : user.gameProgress.trainingMode === 'adaptive' ? 'Adaptive (N.DD)' : 'Dynamic'}
                        >
                            {trainingTag.short}
                        </span>
                    )}
                    <span className="font-mono text-theme-accent">
                        {formatTrainingLevel(user.gameProgress.nBack, user.gameProgress.difficulty)} ({getEstimatedTrial(user.gameProgress)}/{user.gameProgress.totalTrials})
                    </span>
                </span>
            );
        })()}
        {user.sessionResults && (
            <span className="ml-1 font-mono text-theme-text-secondary">
                {formatSessionResults(user.sessionResults)}
            </span>
        )}
        {user.protocolGuide && (
            <span className="ml-1 text-theme-neural-green">
                {user.protocolGuide.view === 'hub'
                    ? '(Menu)'
                    : user.protocolGuide.isPracticing
                    ? `(Practicing: ${user.protocolGuide.sectionTitle || 'Lesson'})`
                    : `(${user.protocolGuide.sectionTitle || 'Lesson'})`}
            </span>
        )}
        {user.cstProgress && (
            <span className="ml-1 text-theme-neural-green">
                CST Set {user.cstProgress.currentSet}/{user.cstProgress.totalSets}
                {' · '}{formatCstPhase(user.cstProgress.phase)}
                {' (Size '}{user.cstProgress.setSize}{')'}
                {user.cstProgress.isFamiliarization && ' · Familiarization'}
                {user.cstProgress.isPractice && ' · Practice'}
            </span>
        )}
        {isInCheckout && user.upgradePrompt && (
            <span className="ml-1 text-theme-accent">
                ({user.upgradePrompt.plan === 'yearly' ? 'Yearly' : 'Monthly'} - {upgradePromptTime})
            </span>
        )}
        {isDeclined && upgradePromptTime && (
            <span className="ml-1 text-neural-synapse">
                ({upgradePromptTime} ago)
            </span>
        )}
    </>
);

const ActiveUsersList = ({ users, activeTab, sessionsToday, navigate }) => {
    if (users.length === 0) {
        return <AdminEmptyState title={EMPTY_TEXT[activeTab] || EMPTY_TEXT.active} />;
    }

    return (
        <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
            {users.map((user) => {
                const activityDisplay = getActivityDisplay(user.activity, user.gameProgress);
                const isInCheckout = user.activity === 'checkout';
                const isDeclined = user.activity === 'declined-upgrade';
                const userSessionsToday = sessionsToday[user.uid] ?? null;

                // Calculate time in checkout/declined state
                const upgradePromptTime = user.upgradePrompt?.startedAt
                    ? formatTimeOnPage(Math.floor((Date.now() - user.upgradePrompt.startedAt) / 1000))
                    : null;

                const timeLabel = activeTab === 'active'
                    ? formatTimeOnPage(user.timeOnPageSeconds)
                    : activeTab === 'afk'
                    ? formatLastSeen(user.lastInteractionMs)
                    : formatLastSeen(user.lastSeenMs);

                return (
                    <div
                        key={user.uid}
                        onClick={() => navigate(`/admin/users/${user.uid}`)}
                        className={`p-3 rounded-lab border cursor-pointer transition-colors ${getRowTone(user.activity)}`}
                    >
                        {/* Mobile: Stacked layout, Desktop: Row layout */}
                        <div className="flex items-center justify-between">
                            {/* User Info */}
                            <div className="flex items-center space-x-3 min-w-0 flex-1">
                                {/* Activity Icon */}
                                <div className={`flex-shrink-0 w-8 h-8 rounded-lab border flex items-center justify-center ${activityDisplay.chip}`}>
                                    <FontAwesomeIcon
                                        icon={activityDisplay.icon}
                                        className={`text-sm ${user.activity === 'preparing' ? 'animate-spin' : ''}`}
                                    />
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
                                {/* Sessions Today */}
                                <div className="flex items-center text-xs font-mono text-theme-text-secondary" title="Sessions today (PST)">
                                    <FontAwesomeIcon icon={faPlay} className="mr-1 h-2.5 w-2.5 text-theme-text-muted" />
                                    <span>{userSessionsToday !== null ? userSessionsToday : '-'}</span>
                                </div>

                                {/* Page Location */}
                                <div className="text-xs text-theme-text-muted max-w-40 truncate" title={user.routeName}>
                                    <RouteDetails
                                        user={user}
                                        showGameModeTag
                                        upgradePromptTime={upgradePromptTime}
                                        isInCheckout={isInCheckout}
                                        isDeclined={isDeclined}
                                    />
                                </div>

                                {/* Time on Page / Last Seen / Idle Time */}
                                <div
                                    className="flex items-center text-xs font-mono text-theme-text-muted w-16 justify-end"
                                    title={activeTab === 'active' ? 'Time on page' : activeTab === 'afk' ? 'Idle time' : 'Last seen'}
                                >
                                    <FontAwesomeIcon icon={faClock} className="mr-1 h-2.5 w-2.5" />
                                    {timeLabel}
                                </div>
                            </div>

                            {/* Mobile: Just show time */}
                            <div className="sm:hidden flex items-center text-xs font-mono text-theme-text-muted ml-2">
                                <FontAwesomeIcon icon={faClock} className="mr-1 h-2.5 w-2.5" />
                                {timeLabel}
                            </div>
                        </div>

                        {/* Mobile: Second row with page location */}
                        <div className="sm:hidden mt-2 flex items-center justify-between text-xs text-theme-text-muted">
                            <span className="truncate">
                                <RouteDetails
                                    user={user}
                                    showGameModeTag={false}
                                    upgradePromptTime={upgradePromptTime}
                                    isInCheckout={isInCheckout}
                                    isDeclined={isDeclined}
                                />
                            </span>
                            <span className="flex-shrink-0 ml-2 font-mono">
                                <FontAwesomeIcon icon={faPlay} className="mr-1 h-2.5 w-2.5 text-theme-text-muted" />
                                {userSessionsToday !== null ? userSessionsToday : '-'} today
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

ActiveUsersList.propTypes = {
    users: PropTypes.array.isRequired,
    activeTab: PropTypes.string.isRequired,
    sessionsToday: PropTypes.object.isRequired,
    navigate: PropTypes.func.isRequired,
};

export default ActiveUsersList;

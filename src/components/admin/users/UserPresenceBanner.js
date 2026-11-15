/* src/components/admin/users/UserPresenceBanner.js */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faGamepad,
    faPause,
    faSpinner,
    faChartLine,
    faBook,
    faUser,
    faCircle,
    faClock
} from '@fortawesome/free-solid-svg-icons';
import { formatCombinedDifficulty } from '../../../contexts/gameHelpers';
import AdminBadge from '../ui/AdminBadge';

// Format training level from nBack and difficulty
export const formatTrainingLevel = (nBack, difficulty) => {
    return formatCombinedDifficulty(nBack ?? 2, difficulty ?? 0);
};

// Get activity display info (icon + themed chip classes + label)
export const getActivityDisplay = (activity) => {
    switch (activity) {
        case 'playing':
            return { icon: faGamepad, chip: 'text-theme-neural-green border-theme-neural-green/40 bg-theme-neural-green/10', label: 'Playing' };
        case 'paused':
            return { icon: faPause, chip: 'text-theme-accent border-theme-accent/40 bg-theme-accent/10', label: 'Paused' };
        case 'preparing':
            return { icon: faSpinner, chip: 'text-theme-neural-blue border-theme-neural-blue/40 bg-theme-neural-blue/10', label: 'Starting Game' };
        case 'results':
            return { icon: faChartLine, chip: 'text-purple-400 border-purple-400/40 bg-purple-400/10', label: 'Viewing Results' };
        case 'protocol-guide':
            return { icon: faBook, chip: 'text-theme-accent border-theme-accent/40 bg-theme-accent/10', label: 'Protocol Guide' };
        default:
            return { icon: faUser, chip: 'text-theme-text-secondary border-theme-line bg-theme-bg-elevated', label: 'Browsing' };
    }
};

// Format time on page
export const formatTimeOnPage = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
};

// Get game mode display info (label + short code + AdminBadge tone)
export const getGameModeDisplay = (mode) => {
    switch (mode) {
        case 'triple':
            return { label: 'Triple N-Back', short: 'Triple', tone: 'info' };
        case 'quad':
            return { label: 'Quad N-Back', short: 'Quad', tone: 'neutral' };
        case 'dynamic':
            return { label: 'Dynamic N-Back', short: 'Dyn', tone: 'neutral' };
        case 'singleVisual':
            return { label: 'Single Position N-Back', short: 'S-Pos', tone: 'success' };
        case 'singleAudio':
            return { label: 'Single Audio N-Back', short: 'S-Aud', tone: 'success' };
        case 'singleColor':
            return { label: 'Single Color N-Back', short: 'S-Col', tone: 'success' };
        case 'singleColorRecall':
            return { label: 'Color Recall N-Back', short: 'S-Rec', tone: 'success' };
        case 'singleShape':
            return { label: 'Single Shape N-Back', short: 'S-Shp', tone: 'success' };
        default:
            return { label: 'Dual N-Back', short: 'Dual', tone: 'accent' };
    }
};

// Estimate current trial from timing params when available
export const getEstimatedTrial = (gameProgress) => {
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

// Format session results for display: "d′ 2.45 • 4.24 → 4.56"
export const formatSessionResults = (sessionResults) => {
    if (!sessionResults) return null;
    const dprime = sessionResults.overallDprime?.toFixed(2) ?? '?';
    const oldLevel = formatTrainingLevel(sessionResults.oldNBack, sessionResults.oldDifficulty);
    const newLevel = formatTrainingLevel(sessionResults.newNBack, sessionResults.newDifficulty);
    return `d′ ${dprime} • ${oldLevel} → ${newLevel}`;
};

const GAME_ACTIVITIES = ['playing', 'paused', 'preparing', 'results'];

const bannerTone = (activity) => {
    if (GAME_ACTIVITIES.includes(activity)) return 'bg-theme-neural-blue/10 border-theme-neural-blue/30';
    if (activity === 'protocol-guide') return 'bg-theme-accent/10 border-theme-accent/30';
    return 'bg-theme-neural-green/10 border-theme-neural-green/30';
};

/**
 * Live presence banner for the admin user-detail page.
 * Pure presentational — presence/timeOnPage come from the page's onSnapshot state.
 */
const UserPresenceBanner = ({ presence, timeOnPage }) => {
    if (!presence) return null;

    const activity = getActivityDisplay(presence.activity);

    return (
        <div className={`rounded-lab border p-4 ${bannerTone(presence.activity)}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-4">
                    {/* Activity Icon */}
                    <div className={`w-10 h-10 flex-shrink-0 rounded-lab border flex items-center justify-center ${activity.chip}`}>
                        <FontAwesomeIcon
                            icon={activity.icon}
                            className={`h-4 w-4 ${presence.activity === 'preparing' ? 'animate-spin' : ''}`}
                        />
                    </div>

                    {/* Status Text */}
                    <div className="min-w-0">
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                            <FontAwesomeIcon icon={faCircle} className="text-theme-neural-green h-2 w-2 animate-pulse" />
                            <span className="text-xs font-mono uppercase tracking-wider text-theme-text">Online Now</span>
                            <span className="text-theme-text-muted hidden sm:inline">•</span>
                            <span className="text-sm text-theme-text-secondary">{activity.label}</span>
                        </div>
                        <p className="text-sm text-theme-text-secondary mt-0.5 truncate">
                            {presence.routeName}
                            {presence.gameProgress && (
                                <>
                                    <span className="ml-2 inline-block align-middle">
                                        <AdminBadge tone={getGameModeDisplay(presence.gameProgress.gameMode).tone}>
                                            {getGameModeDisplay(presence.gameProgress.gameMode).short}
                                        </AdminBadge>
                                    </span>
                                    <span className="ml-2 font-mono text-theme-accent">
                                        {formatTrainingLevel(presence.gameProgress.nBack, presence.gameProgress.difficulty)} • Trial {getEstimatedTrial(presence.gameProgress)}/{presence.gameProgress.totalTrials}
                                    </span>
                                </>
                            )}
                            {presence.sessionResults && (
                                <>
                                    <span className="ml-2 inline-block align-middle">
                                        <AdminBadge tone={getGameModeDisplay(presence.sessionResults.gameMode).tone}>
                                            {getGameModeDisplay(presence.sessionResults.gameMode).short}
                                        </AdminBadge>
                                    </span>
                                    <span className="ml-2 font-mono text-purple-400">
                                        {formatSessionResults(presence.sessionResults)}
                                    </span>
                                </>
                            )}
                            {presence.protocolGuide && (
                                <span className="ml-2 font-mono text-theme-accent">
                                    {presence.protocolGuide.view === 'hub'
                                        ? '(Menu)'
                                        : presence.protocolGuide.isPracticing
                                        ? `• Practicing: ${presence.protocolGuide.sectionTitle || 'Lesson'}`
                                        : `• ${presence.protocolGuide.sectionTitle || 'Lesson'}`}
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Time on Page */}
                <div className="flex items-center text-xs font-mono text-theme-text-muted ml-14 sm:ml-0">
                    <FontAwesomeIcon icon={faClock} className="mr-1.5 h-3 w-3" />
                    {formatTimeOnPage(timeOnPage)} on page
                </div>
            </div>
        </div>
    );
};

export default UserPresenceBanner;

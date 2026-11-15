/* src/components/coach/ClientStatusCard.js */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowTrendUp, faArrowTrendDown, faMinus, faCalendarCheck, faBullseye, faChartLine } from '@fortawesome/free-solid-svg-icons';

const trendConfig = {
    improving: { icon: faArrowTrendUp, color: 'text-neural-dendrite', label: 'Improving' },
    declining: { icon: faArrowTrendDown, color: 'text-neural-synapse', label: 'Declining' },
    flat: { icon: faMinus, color: 'text-theme-text-muted', label: 'Stable' },
};

const ClientStatusCard = ({ client, status }) => {
    const trend = trendConfig[status?.dprimeTrend] || trendConfig.flat;
    const ndd = `${client?.currentNBack || 2}.${Math.round((client?.currentDifficulty || 0) * 100).toString().padStart(2, '0')}`;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Current N.DD */}
            <div className="bg-theme-bg-secondary border border-theme-line p-4">
                <div className="flex items-center gap-2 mb-2">
                    <FontAwesomeIcon icon={faBullseye} className="w-3.5 h-3.5 text-theme-text-muted" />
                    <span className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">
                        N.DD Level
                    </span>
                </div>
                <p className="text-xl font-mono text-theme-text">{ndd}</p>
            </div>

            {/* D-prime Trend */}
            <div className="bg-theme-bg-secondary border border-theme-line p-4">
                <div className="flex items-center gap-2 mb-2">
                    <FontAwesomeIcon icon={faChartLine} className="w-3.5 h-3.5 text-theme-text-muted" />
                    <span className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">
                        D-prime Trend
                    </span>
                </div>
                <p className={`text-sm font-mono flex items-center gap-2 ${trend.color}`}>
                    <FontAwesomeIcon icon={trend.icon} className="w-4 h-4" />
                    {trend.label}
                </p>
            </div>

            {/* Sessions This Week */}
            <div className="bg-theme-bg-secondary border border-theme-line p-4">
                <div className="flex items-center gap-2 mb-2">
                    <FontAwesomeIcon icon={faCalendarCheck} className="w-3.5 h-3.5 text-theme-text-muted" />
                    <span className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">
                        This Week
                    </span>
                </div>
                <p className="text-xl font-mono text-theme-text">
                    {status?.sessionsThisWeek ?? 0}
                    <span className="text-sm text-theme-text-muted ml-1">sessions</span>
                </p>
            </div>

            {/* Days Since Last Session */}
            <div className="bg-theme-bg-secondary border border-theme-line p-4">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">
                        Last Session
                    </span>
                </div>
                <p className="text-xl font-mono text-theme-text">
                    {status?.daysSinceLastSession != null ? (
                        <>
                            {status.daysSinceLastSession}
                            <span className="text-sm text-theme-text-muted ml-1">
                                {status.daysSinceLastSession === 1 ? 'day ago' : 'days ago'}
                            </span>
                        </>
                    ) : (
                        <span className="text-sm text-theme-text-muted">No sessions</span>
                    )}
                </p>
            </div>
        </div>
    );
};

export default ClientStatusCard;

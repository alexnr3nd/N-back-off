/* src/components/coach/ClientTable.js */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faXmark } from '@fortawesome/free-solid-svg-icons';

const getLastActiveColor = (lastLoginAt) => {
    if (!lastLoginAt) return 'text-theme-text-muted';
    const now = new Date();
    const last = new Date(lastLoginAt);
    const hoursSince = (now - last) / (1000 * 60 * 60);
    if (hoursSince < 24) return 'text-neural-dendrite'; // green
    if (hoursSince < 72) return 'text-theme-accent'; // yellow/amber
    return 'text-neural-synapse'; // red
};

const getLastActiveLabel = (lastLoginAt) => {
    if (!lastLoginAt) return 'Never';
    const now = new Date();
    const last = new Date(lastLoginAt);
    const hoursSince = (now - last) / (1000 * 60 * 60);
    if (hoursSince < 1) return 'Just now';
    if (hoursSince < 24) return `${Math.floor(hoursSince)}h ago`;
    const days = Math.floor(hoursSince / 24);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
};

const formatNDD = (nBack, difficulty) => {
    const n = nBack || 2;
    const d = difficulty || 0;
    const dd = Math.round(d * 100).toString().padStart(2, '0');
    return `${n}.${dd}`;
};

const ClientTable = ({ clients, onClientClick, onDismiss, dismissingId }) => {
    if (!clients || clients.length === 0) {
        return (
            <div className="px-4 py-8 text-center text-sm text-theme-text-muted font-mono">
                No clients yet. Share your invite link to get started.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-theme-line text-left">
                        <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-theme-text-muted font-normal">Name</th>
                        <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-theme-text-muted font-normal hidden sm:table-cell">N.DD</th>
                        <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-theme-text-muted font-normal hidden md:table-cell">Last Active</th>
                        <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-theme-text-muted font-normal hidden md:table-cell">This Week</th>
                        <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-theme-text-muted font-normal hidden lg:table-cell">Streak</th>
                        <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-theme-text-muted font-normal">Status</th>
                        <th className="px-4 py-3 w-10"></th>
                    </tr>
                </thead>
                <tbody>
                    {clients.map((client) => {
                        const isActive = client.status === 'active';
                        const isRevoked = client.status === 'revoked';
                        const isRemoved = client.status === 'removed';

                        return (
                            <tr
                                key={client.uid}
                                className={`
                                    border-b border-theme-line/50 transition-colors
                                    ${isActive ? 'hover:bg-theme-bg-elevated cursor-pointer' : 'opacity-60'}
                                `}
                                onClick={() => isActive && onClientClick(client.uid)}
                            >
                                <td className="px-4 py-3 font-mono text-theme-text">
                                    {client.displayName}
                                </td>
                                <td className="px-4 py-3 font-mono text-theme-text hidden sm:table-cell">
                                    {isActive ? formatNDD(client.currentNBack, client.currentDifficulty) : '—'}
                                </td>
                                <td className="px-4 py-3 hidden md:table-cell">
                                    {isActive ? (
                                        <span className={`flex items-center gap-2 font-mono text-xs ${getLastActiveColor(client.lastLoginAt)}`}>
                                            <FontAwesomeIcon icon={faCircle} className="w-1.5 h-1.5" />
                                            {getLastActiveLabel(client.lastLoginAt)}
                                        </span>
                                    ) : '—'}
                                </td>
                                <td className="px-4 py-3 font-mono text-theme-text hidden md:table-cell">
                                    {isActive ? `${client.sessionsThisWeek || 0} sessions` : '—'}
                                </td>
                                <td className="px-4 py-3 font-mono text-theme-text hidden lg:table-cell">
                                    {isActive ? `${client.streak || 0}d` : '—'}
                                </td>
                                <td className="px-4 py-3">
                                    {isActive && (
                                        <span className="px-2 py-0.5 text-xs font-mono bg-neural-dendrite/20 text-neural-dendrite border border-neural-dendrite/30">
                                            Active
                                        </span>
                                    )}
                                    {isRevoked && (
                                        <span className="px-2 py-0.5 text-xs font-mono bg-theme-accent/20 text-theme-accent border border-theme-accent/30">
                                            Revoked
                                        </span>
                                    )}
                                    {isRemoved && (
                                        <span className="px-2 py-0.5 text-xs font-mono bg-theme-text-muted/20 text-theme-text-muted border border-theme-line">
                                            Removed
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    {(isActive || isRevoked) && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDismiss(client.uid);
                                            }}
                                            disabled={dismissingId === client.uid}
                                            className="p-1 text-theme-text-muted hover:text-neural-synapse transition-colors disabled:opacity-50"
                                            title="Remove client"
                                        >
                                            <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default ClientTable;

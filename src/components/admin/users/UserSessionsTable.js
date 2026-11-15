/* src/components/admin/users/UserSessionsTable.js */
import React from 'react';
import { faClock } from '@fortawesome/free-solid-svg-icons';
import { formatCombinedDifficulty } from '../../../contexts/gameHelpers';
import AdminCard from '../ui/AdminCard';
import AdminBadge from '../ui/AdminBadge';
import AdminEmptyState from '../ui/AdminEmptyState';
import { AdminTable, AdminTr, AdminTd } from '../ui/AdminTable';
import { getGameModeDisplay } from './UserPresenceBanner';

const MODES = ['single', 'dual', 'triple', 'quad'];

const PILL_BASE = 'px-2.5 py-0.5 text-[0.6875rem] font-mono uppercase tracking-wider border rounded-lab transition-colors';
const PILL_ACTIVE = 'bg-theme-accent/15 text-theme-accent border-theme-accent/40';
const PILL_INACTIVE = 'bg-theme-bg-elevated text-theme-text-muted border-theme-line hover:border-theme-text-muted';

const SESSION_COLUMNS = [
    { key: 'date', label: 'Date' },
    { key: 'mode', label: 'Mode' },
    { key: 'level', label: 'Level' },
    { key: 'duration', label: 'Duration' },
    { key: 'accuracy', label: 'Accuracy' },
    { key: 'dprime', label: 'd-prime' },
    { key: 'readiness', label: 'Readiness' },
];

// before -> after readiness delta, colored by direction
const Readiness = ({ session, gap = 'mx-1' }) => {
    if (session.readinessScoreBefore == null && session.readinessScoreAfter == null) {
        return <span className="text-theme-text-muted">—</span>;
    }
    const after = session.readinessScoreAfter;
    const before = session.readinessScoreBefore;
    const afterClass = after > before
        ? 'text-theme-neural-green'
        : after < before
            ? 'text-theme-neural-blue'
            : 'text-theme-text';
    return (
        <>
            <span className="text-theme-text">{before ?? '?'}</span>
            <span className={`text-theme-text-muted ${gap}`}>→</span>
            <span className={afterClass}>{after ?? '?'}</span>
        </>
    );
};

/**
 * Recent Sessions section (mobile cards + desktop table).
 * Pure presentational — filtering/state lives in UserDetailPage.
 */
const UserSessionsTable = ({ sessions, modeFilter, onToggleMode, sessionsByMode, formatDate, formatDuration }) => (
    <AdminCard variant="panel" flush title="Recent Sessions" icon={faClock}>
        {/* Mode Filter */}
        <div className="px-4 sm:px-6 py-3 border-b border-theme-line/50 flex items-center gap-2 flex-wrap">
            <span className="text-[0.6875rem] font-mono uppercase tracking-wider text-theme-text-muted">Filter</span>
            {MODES.map(mode => (
                <button
                    key={mode}
                    onClick={() => onToggleMode(mode)}
                    className={`${PILL_BASE} ${modeFilter.includes(mode) ? PILL_ACTIVE : PILL_INACTIVE}`}
                >
                    {mode}
                    {sessionsByMode?.[mode] > 0 && (
                        <span className="ml-1 opacity-70">({sessionsByMode[mode]})</span>
                    )}
                </button>
            ))}
        </div>

        {sessions.length === 0 ? (
            <AdminEmptyState title="No sessions found" />
        ) : (
            <>
                {/* Mobile Card Layout */}
                <div className="sm:hidden divide-y divide-theme-line/50">
                    {sessions.slice(0, 20).map((session) => (
                        <div key={session.id} className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-mono text-theme-text">
                                    {formatDate(session.recordedAt)}
                                </span>
                                <div className="flex items-center gap-2">
                                    <AdminBadge tone={getGameModeDisplay(session.gameMode).tone}>
                                        {getGameModeDisplay(session.gameMode).short}
                                    </AdminBadge>
                                    <span className="text-sm font-mono text-theme-accent">
                                        {formatCombinedDifficulty(session.nBack ?? 2, session.difficulty ?? 0)}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-sm">
                                <div>
                                    <span className="text-[0.6875rem] font-mono uppercase tracking-wider text-theme-text-muted">Dur</span>
                                    <p className="font-mono text-theme-text">{formatDuration(session.durationMs)}</p>
                                </div>
                                <div>
                                    <span className="text-[0.6875rem] font-mono uppercase tracking-wider text-theme-text-muted">Acc</span>
                                    <p className="font-mono text-theme-text">{(session.accuracy || 0).toFixed(1)}%</p>
                                </div>
                                <div>
                                    <span className="text-[0.6875rem] font-mono uppercase tracking-wider text-theme-text-muted">d′</span>
                                    <p className="font-mono text-theme-text">{session.overallDprime?.toFixed(2) || 'N/A'}</p>
                                </div>
                                <div>
                                    <span className="text-[0.6875rem] font-mono uppercase tracking-wider text-theme-text-muted">Readiness</span>
                                    <p className="font-mono text-xs">
                                        <Readiness session={session} gap="mx-0.5" />
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden sm:block">
                    <AdminTable columns={SESSION_COLUMNS} minWidth="min-w-full">
                        {sessions.slice(0, 20).map((session) => (
                            <AdminTr key={session.id}>
                                <AdminTd mono className="whitespace-nowrap">
                                    {formatDate(session.recordedAt)}
                                </AdminTd>
                                <AdminTd className="whitespace-nowrap">
                                    <AdminBadge tone={getGameModeDisplay(session.gameMode).tone}>
                                        {getGameModeDisplay(session.gameMode).short}
                                    </AdminBadge>
                                </AdminTd>
                                <AdminTd mono className="whitespace-nowrap">
                                    {formatCombinedDifficulty(session.nBack ?? 2, session.difficulty ?? 0)}
                                </AdminTd>
                                <AdminTd mono muted className="whitespace-nowrap">
                                    {formatDuration(session.durationMs)}
                                </AdminTd>
                                <AdminTd mono className="whitespace-nowrap">
                                    {(session.accuracy || 0).toFixed(1)}%
                                </AdminTd>
                                <AdminTd mono className="whitespace-nowrap">
                                    {session.overallDprime?.toFixed(2) || 'N/A'}
                                </AdminTd>
                                <AdminTd mono className="whitespace-nowrap">
                                    <Readiness session={session} />
                                </AdminTd>
                            </AdminTr>
                        ))}
                    </AdminTable>
                </div>
            </>
        )}
    </AdminCard>
);

export default UserSessionsTable;

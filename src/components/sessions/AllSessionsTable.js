/* src/components/sessions/AllSessionsTable.js */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDateTime, formatDuration } from '../dashboard/utils/formatters';
import { formatCombinedDifficulty } from '../../contexts/gameHelpers';
import { MODE_MODALITIES } from '../../constants/modeStyles';
import { getSessionAccuracy } from '../../utils/accuracy';
import '../animations.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPlay,
    faChevronUp,
    faChevronDown,
    faQuestionCircle,
    faStickyNote
} from '@fortawesome/free-solid-svg-icons';

const AllSessionsTable = ({ sessions = [], showColorColumn = false, showShapeColumn = false }) => {
    const navigate = useNavigate();
    const [sortField, setSortField] = useState('recordedAt');
    const [sortDirection, setSortDirection] = useState('desc');

    // Handle replay navigation
    const handleReplay = (e, session) => {
        e.stopPropagation();
        // Continuous chain sessions (legacy 'continuous' or new per-block 'continuous-block') —
        // replay not supported in v1 (per-block replayData not saved; chain docs are aggregate).
        if (session?.mode === 'continuous' || session?.mode === 'continuous-block') {
            console.info("[Replay] Continuous-mode session — replay not available in v1.");
            return;
        }
        const sessionId = session?.id;
        const hasValidReplayData = !!session?.replayData?.settings &&
            Array.isArray(session.replayData.events) &&
            session.replayData.startTime !== undefined;

        if (sessionId && hasValidReplayData) {
            navigate(`/replay/${sessionId}`, { state: { from: 'sessions' } });
        } else {
            console.warn("Replay unavailable:", { sessionId, hasValidReplayData });
            alert("Replay data is not available or incomplete for this session.");
        }
    };

    // Handle sorting
    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Get sorted sessions
    const sortedSessions = React.useMemo(() => {
        if (!sessions.length) return [];

        return [...sessions].sort((a, b) => {
            if (sortField === 'recordedAt') {
                const dateA = a.recordedAt ? new Date(a.recordedAt) : new Date(a.date || 0);
                const dateB = b.recordedAt ? new Date(b.recordedAt) : new Date(b.date || 0);
                return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
            }

            if (sortField === 'durationMs') {
                const durationA = a.durationMs || 0;
                const durationB = b.durationMs || 0;
                return sortDirection === 'asc' ? durationA - durationB : durationB - durationA;
            }

            if (sortField === 'level') {
                const levelA = (a.nBack || 0) + (a.difficulty || 0);
                const levelB = (b.nBack || 0) + (b.difficulty || 0);
                return sortDirection === 'asc' ? levelA - levelB : levelB - levelA;
            }

            if (typeof a[sortField] === 'number' && typeof b[sortField] === 'number') {
                return sortDirection === 'asc' ? a[sortField] - b[sortField] : b[sortField] - a[sortField];
            }

            const valueA = String(a[sortField] || '');
            const valueB = String(b[sortField] || '');
            return sortDirection === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
        });
    }, [sessions, sortField, sortDirection]);

    // Get sort icon - Lab instrument style
    const getSortIcon = (field) => {
        if (sortField !== field) {
            return <FontAwesomeIcon icon={faChevronDown} className="ml-1 text-theme-text-muted opacity-50 h-2.5 w-2.5" />;
        }
        return sortDirection === 'asc'
            ? <FontAwesomeIcon icon={faChevronUp} className="ml-1 text-theme-accent h-2.5 w-2.5" />
            : <FontAwesomeIcon icon={faChevronDown} className="ml-1 text-theme-accent h-2.5 w-2.5" />;
    };

    // Empty state - Lab notebook style
    if (sessions.length === 0) {
        return (
            <div className="p-8 text-center bg-theme-bg-secondary">
                <p className="text-theme-text-secondary mb-2 font-serif italic">No data entries match current parameters</p>
                <p className="text-sm text-theme-text-muted font-mono">Adjust query filters to expand search range</p>
            </div>
        );
    }

    return (
        <div className="bg-theme-bg-secondary">
            {/* Desktop View - Lab Data Table */}
            <div className="overflow-x-auto hidden md:block">
                <table className="min-w-full divide-y divide-charcoal-line">
                    {/* Table Header - Monospace scientific styling */}
                    <thead className="bg-theme-bg-elevated">
                        <tr>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left text-[0.6875rem] font-mono text-theme-text-muted uppercase tracking-[0.15em] cursor-pointer hover:text-theme-text-secondary transition-colors"
                                onClick={() => handleSort('recordedAt')}
                            >
                                <div className="flex items-center">
                                    <span>Timestamp</span>
                                    {getSortIcon('recordedAt')}
                                </div>
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-3 text-center text-[0.6875rem] font-mono text-theme-text-muted uppercase tracking-[0.15em] cursor-pointer hover:text-theme-text-secondary transition-colors"
                                onClick={() => handleSort('durationMs')}
                            >
                                <div className="flex items-center justify-center">
                                    <span>Duration</span>
                                    {getSortIcon('durationMs')}
                                </div>
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-3 text-center text-[0.6875rem] font-mono text-theme-text-muted uppercase tracking-[0.15em] cursor-pointer hover:text-theme-text-secondary transition-colors"
                                onClick={() => handleSort('accuracy')}
                            >
                                <div className="flex items-center justify-center">
                                    <span>Acc</span>
                                    {getSortIcon('accuracy')}
                                </div>
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-3 text-center text-[0.6875rem] font-mono text-amber-dim uppercase tracking-[0.15em] cursor-pointer hover:text-theme-accent transition-colors"
                                onClick={() => handleSort('visualAccuracy')}
                            >
                                <div className="flex items-center justify-center">
                                    <span>Pos</span>
                                    {getSortIcon('visualAccuracy')}
                                </div>
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-3 text-center text-[0.6875rem] font-mono text-neural-dendrite/70 uppercase tracking-[0.15em] cursor-pointer hover:text-neural-dendrite transition-colors"
                                onClick={() => handleSort('audioAccuracy')}
                            >
                                <div className="flex items-center justify-center">
                                    <span>Aud</span>
                                    {getSortIcon('audioAccuracy')}
                                </div>
                            </th>
                            {showColorColumn && (
                                <th
                                    scope="col"
                                    className="px-3 py-3 text-center text-[0.6875rem] font-mono text-purple-400/70 uppercase tracking-[0.15em] cursor-pointer hover:text-purple-400 transition-colors"
                                    onClick={() => handleSort('colorAccuracy')}
                                >
                                    <div className="flex items-center justify-center">
                                        <span>Col</span>
                                        {getSortIcon('colorAccuracy')}
                                    </div>
                                </th>
                            )}
                            {showShapeColumn && (
                                <th
                                    scope="col"
                                    className="px-3 py-3 text-center text-[0.6875rem] font-mono text-cyan-400/70 uppercase tracking-[0.15em] cursor-pointer hover:text-cyan-400 transition-colors"
                                    onClick={() => handleSort('shapeAccuracy')}
                                >
                                    <div className="flex items-center justify-center">
                                        <span>Shp</span>
                                        {getSortIcon('shapeAccuracy')}
                                    </div>
                                </th>
                            )}
                            <th
                                scope="col"
                                className="px-3 py-3 text-center text-[0.6875rem] font-mono text-theme-text-muted uppercase tracking-[0.15em] cursor-pointer hover:text-theme-text-secondary transition-colors"
                                onClick={() => handleSort('level')}
                            >
                                <div className="flex items-center justify-center">
                                    <span>Level</span>
                                    {getSortIcon('level')}
                                </div>
                            </th>
                            <th scope="col" className="px-4 py-3 text-center text-[0.6875rem] font-mono text-theme-text-muted uppercase tracking-[0.15em]">
                                <span>Actions</span>
                            </th>
                        </tr>
                    </thead>

                    {/* Table Body */}
                    <tbody className="bg-theme-bg-secondary divide-y divide-charcoal-hover">{
                        sortedSessions.map((session) => {
                            const rowKey = session.id || `session-${session.recordedAt || session.date}`;
                            const dateObj = session.recordedAt ? new Date(session.recordedAt) : new Date(session.date);

                            const hasValidReplayData = !!session?.replayData?.settings &&
                                Array.isArray(session.replayData.events) &&
                                session.replayData.startTime !== undefined;

                            const canReplay = !!session?.id && hasValidReplayData && session?.mode !== 'continuous' && session?.mode !== 'continuous-block';
                            const oldCombinedValue = formatCombinedDifficulty(session.nBack, session.difficulty);
                            const newCombinedValue = session.newDifficulty !== undefined && session.newNBack !== undefined
                                ? formatCombinedDifficulty(session.newNBack, session.newDifficulty)
                                : null;

                            const levelChanged = newCombinedValue !== null && newCombinedValue !== oldCombinedValue;
                            const levelIncreased = levelChanged && (
                                (session.newNBack > session.nBack) ||
                                (session.newNBack === session.nBack && session.newDifficulty > session.difficulty)
                            );
                            const levelDecreased = levelChanged && (
                                (session.newNBack < session.nBack) ||
                                (session.newNBack === session.nBack && session.newDifficulty < session.difficulty)
                            );

                            const activeMods = MODE_MODALITIES[session.gameMode] || ['visual', 'audio'];
                            const showVisual = activeMods.includes('visual');
                            const showAudio  = activeMods.includes('audio');
                            const showColor  = activeMods.includes('color');
                            const showShape  = activeMods.includes('shape');
                            const acc = getSessionAccuracy(session, { gameMode: session.gameMode });

                            return (
                                <tr key={rowKey} className="hover:bg-theme-bg-surface transition-colors duration-150">
                                    {/* Date Cell with Mode Badge */}
                                    <td className="px-4 py-3.5 whitespace-nowrap text-xs sm:text-sm text-theme-text font-mono">
                                        <div className="flex items-center gap-2">
                                            {session.gameMode && session.gameMode !== 'dual' && (
                                                <span className={`text-[0.6875rem] font-mono uppercase px-1.5 py-0.5 ${
                                                    session.gameMode === 'quad' ? 'bg-cyan-500/20 text-cyan-400' :
                                                    session.gameMode === 'triple' ? 'bg-purple-500/20 text-purple-400' :
                                                    (session.gameMode || '').startsWith('single') ? 'bg-emerald-500/20 text-emerald-400' :
                                                    'bg-theme-bg-surface text-theme-text-muted'
                                                }`}>
                                                    {session.gameMode === 'quad' ? 'Q' : session.gameMode === 'triple' ? 'T' : (session.gameMode || '').startsWith('single') ? 'S' : ''}
                                                </span>
                                            )}
                                            <span>{formatDateTime(dateObj)}</span>
                                        </div>
                                    </td>

                                    {/* Duration Cell */}
                                    <td className="px-3 py-3.5 whitespace-nowrap text-xs sm:text-sm text-theme-text-secondary text-center font-mono">
                                        {formatDuration(session.durationMs)}
                                    </td>

                                    {/* Accuracy Cell */}
                                    <td className="px-3 py-3.5 whitespace-nowrap text-xs sm:text-sm font-medium text-center">
                                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-theme-bg-surface text-theme-text font-mono">
                                            {acc.overall?.toFixed(1) ?? '-'}%
                                        </div>
                                    </td>

                                    {/* Visual Accuracy Cell */}
                                    <td className="px-3 py-3.5 whitespace-nowrap text-xs sm:text-sm text-center">
                                        {showVisual ? (
                                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-theme-bg-surface text-theme-accent font-mono">
                                                {acc.visual?.toFixed(1) ?? '-'}%
                                            </div>
                                        ) : (
                                            <span className="text-theme-text-muted">-</span>
                                        )}
                                    </td>

                                    {/* Audio Accuracy Cell */}
                                    <td className="px-3 py-3.5 whitespace-nowrap text-xs sm:text-sm text-center">
                                        {showAudio ? (
                                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-theme-bg-surface text-status-success font-mono">
                                                {acc.audio?.toFixed(1) ?? '-'}%
                                            </div>
                                        ) : (
                                            <span className="text-theme-text-muted">-</span>
                                        )}
                                    </td>

                                    {/* Color Accuracy Cell - Triple/Quad only */}
                                    {showColorColumn && (
                                        <td className="px-3 py-3.5 whitespace-nowrap text-xs sm:text-sm text-center">
                                            {showColor && acc.color != null ? (
                                                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-theme-bg-surface text-purple-400 font-mono">
                                                    {acc.color?.toFixed(1)}%
                                                </div>
                                            ) : (
                                                <span className="text-theme-text-muted">-</span>
                                            )}
                                        </td>
                                    )}

                                    {/* Shape Accuracy Cell - Quad only */}
                                    {showShapeColumn && (
                                        <td className="px-3 py-3.5 whitespace-nowrap text-xs sm:text-sm text-center">
                                            {showShape && acc.shape != null ? (
                                                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-theme-bg-surface text-cyan-400 font-mono">
                                                    {acc.shape?.toFixed(1)}%
                                                </div>
                                            ) : (
                                                <span className="text-theme-text-muted">-</span>
                                            )}
                                        </td>
                                    )}

                                    {/* Level Cell */}
                                    <td className="px-3 py-3.5 whitespace-nowrap text-xs sm:text-sm text-theme-text text-center font-mono">
                                        <div className="flex flex-col items-center">
                                            <span className="font-medium">{oldCombinedValue}</span>
                                            {levelChanged && (
                                                <span className={`text-xs flex items-center mt-0.5 ${levelIncreased ? 'text-status-success' : 'text-status-error'}`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={levelIncreased ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
                                                    </svg>
                                                    {newCombinedValue}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Actions Cell */}
                                    <td className="px-4 py-3.5 whitespace-nowrap text-center text-sm font-medium">
                                        <div className="inline-flex items-center gap-2">
                                            {canReplay ? (
                                                <button
                                                    onClick={(e) => handleReplay(e, session)}
                                                    className="inline-flex items-center text-theme-text-secondary hover:text-theme-accent transition-colors duration-150 p-1.5 rounded hover:bg-theme-bg-surface border border-transparent hover:border-theme-line"
                                                    title="Replay Session"
                                                >
                                                    <FontAwesomeIcon icon={faPlay} className="h-3.5 w-3.5 mr-1"/>
                                                    <span className="text-xs font-mono uppercase tracking-wider">Replay</span>
                                                </button>
                                            ) : (
                                                <span className="text-theme-text-muted p-1.5 inline-flex items-center" title="Replay Unavailable">
                                                    <FontAwesomeIcon icon={faPlay} className="h-3.5 w-3.5 mr-1"/>
                                                    <span className="text-xs font-mono">N/A</span>
                                                </span>
                                            )}
                                            {session.note && (
                                                <span
                                                    className="text-theme-accent/60 p-1.5 cursor-default"
                                                    title={session.note}
                                                >
                                                    <FontAwesomeIcon icon={faStickyNote} className="h-3.5 w-3.5"/>
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })
                    }</tbody>
                </table>
            </div>

            {/* Mobile Card View - Lab specimen cards */}
            <div className="md:hidden">
                {sortedSessions.map((session, index) => {
                    const rowKey = session.id || `session-${session.recordedAt || session.date}-${index}`;
                    const dateObj = session.recordedAt ? new Date(session.recordedAt) : new Date(session.date);

                    const hasValidReplayData = !!session?.replayData?.settings &&
                        Array.isArray(session.replayData.events) &&
                        session.replayData.startTime !== undefined;

                    const canReplay = !!session?.id && hasValidReplayData && session?.mode !== 'continuous' && session?.mode !== 'continuous-block';
                    const oldCombinedValue = formatCombinedDifficulty(session.nBack, session.difficulty);
                    const newCombinedValue = session.newDifficulty !== undefined && session.newNBack !== undefined
                        ? formatCombinedDifficulty(session.newNBack, session.newDifficulty)
                        : null;

                    const levelChanged = newCombinedValue !== null && newCombinedValue !== oldCombinedValue;
                    const levelIncreased = levelChanged && (
                        (session.newNBack > session.nBack) ||
                        (session.newNBack === session.nBack && session.newDifficulty > session.difficulty)
                    );

                    const activeMods = MODE_MODALITIES[session.gameMode] || ['visual', 'audio'];
                    const showVisual = activeMods.includes('visual');
                    const showAudio  = activeMods.includes('audio');
                    const acc = getSessionAccuracy(session, { gameMode: session.gameMode });
                    const showColor  = activeMods.includes('color');
                    const showShape  = activeMods.includes('shape');

                    return (
                        <div
                            key={rowKey}
                            className="border-b border-theme-border"
                        >
                            {/* Header */}
                            <div className="flex justify-between items-center px-4 py-3 bg-theme-bg-elevated border-b border-theme-line">
                                <div className="flex items-center gap-2">
                                    {session.gameMode && session.gameMode !== 'dual' && (
                                        <span className={`text-[0.6875rem] font-mono uppercase px-1.5 py-0.5 ${
                                            session.gameMode === 'quad' ? 'bg-cyan-500/20 text-cyan-400' :
                                            session.gameMode === 'triple' ? 'bg-purple-500/20 text-purple-400' :
                                            (session.gameMode || '').startsWith('single') ? 'bg-emerald-500/20 text-emerald-400' :
                                            'bg-theme-bg-surface text-theme-text-muted'
                                        }`}>
                                            {session.gameMode === 'quad' ? 'QUAD' : session.gameMode === 'triple' ? 'TRI' : session.gameMode === 'singleVisual' ? 'S-POS' : session.gameMode === 'singleAudio' ? 'S-AUD' : session.gameMode === 'singleColor' ? 'S-COL' : session.gameMode === 'singleColorRecall' ? 'S-REC' : session.gameMode === 'singleShape' ? 'S-SHP' : ''}
                                        </span>
                                    )}
                                    <span className="text-sm font-mono text-theme-text">
                                        {formatDateTime(dateObj)}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Level Tag */}
                                    <div className="bg-theme-bg-secondary border border-theme-line text-theme-text-secondary px-2 py-0.5 text-xs flex items-center font-mono">
                                        <span>Lvl {oldCombinedValue}</span>
                                        {levelChanged && (
                                            <span className={`ml-1 ${levelIncreased ? 'text-status-success' : 'text-status-error'}`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={levelIncreased ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
                                                </svg>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-4 bg-theme-bg-secondary">
                                {/* Stats Grid */}
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    {/* Duration */}
                                    <div className="bg-theme-bg-elevated border border-theme-line p-2 text-center">
                                        <div className="text-xs font-medium text-theme-text-muted mb-1 font-mono uppercase tracking-wider">Duration</div>
                                        <div className="text-sm font-mono text-theme-text">{formatDuration(session.durationMs)}</div>
                                    </div>

                                    {/* Accuracy */}
                                    <div className="bg-theme-bg-elevated border border-theme-line p-2 text-center">
                                        <div className="text-xs font-medium text-theme-text-muted mb-1 font-mono uppercase tracking-wider">Accuracy</div>
                                        <div className="text-sm font-mono text-theme-text">{acc.overall?.toFixed(0) ?? '-'}%</div>
                                    </div>

                                    {/* Visual/Audio Split */}
                                    <div className="bg-theme-bg-elevated border border-theme-line p-2 text-center">
                                        <div className="text-xs font-medium text-theme-text-muted mb-1 font-mono uppercase tracking-wider">P/A</div>
                                        <div className="text-sm font-mono">
                                            <span className="text-theme-accent">{showVisual ? `${acc.visual?.toFixed(0) ?? '-'}%` : '-'}</span>
                                            <span className="mx-0.5 text-theme-text-muted">/</span>
                                            <span className="text-status-success">{showAudio ? `${acc.audio?.toFixed(0) ?? '-'}%` : '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Color/Shape Stats Row (Triple/Quad only) */}
                                {(showColorColumn || showShapeColumn) && ((showColor && acc.color != null) || (showShape && acc.shape != null)) && (
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {showColorColumn && showColor && acc.color != null && (
                                            <div className="inline-flex items-center px-2 py-1 rounded-full bg-theme-bg-surface text-purple-400 text-xs font-mono">
                                                C:{acc.color?.toFixed(0)}%
                                            </div>
                                        )}
                                        {showShapeColumn && showShape && acc.shape != null && (
                                            <div className="inline-flex items-center px-2 py-1 rounded-full bg-theme-bg-surface text-cyan-400 text-xs font-mono">
                                                S:{acc.shape?.toFixed(0)}%
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Action Button */}
                                <div className="flex justify-end">
                                    {canReplay ? (
                                        <button
                                            onClick={(e) => handleReplay(e, session)}
                                            className="inline-flex items-center px-3 py-1.5 bg-theme-bg-elevated border border-theme-line hover:border-theme-accent text-theme-text-secondary hover:text-theme-accent transition-colors text-sm font-mono"
                                        >
                                            <FontAwesomeIcon icon={faPlay} className="h-3 w-3 mr-1.5"/>
                                            <span className="uppercase tracking-wider text-xs">Replay</span>
                                        </button>
                                    ) : (
                                        <div className="inline-flex items-center px-3 py-1.5 bg-theme-bg-elevated border border-theme-line text-theme-text-muted text-sm font-mono cursor-not-allowed">
                                            <FontAwesomeIcon icon={faQuestionCircle} className="h-3 w-3 mr-1.5"/>
                                            <span className="uppercase tracking-wider text-xs">Unavailable</span>
                                        </div>
                                    )}
                                </div>

                                {/* Session Note */}
                                {session.note && (
                                    <div className="bg-theme-bg-secondary rounded-lg p-3 border border-theme-border mt-3">
                                        <div className="flex items-center mb-2">
                                            <div className="w-6 h-6 rounded-full bg-theme-accent/10 flex items-center justify-center mr-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-theme-accent/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </div>
                                            <h4 className="font-semibold text-sm text-theme-text">Note</h4>
                                        </div>
                                        <p className="text-xs text-theme-text-secondary font-mono whitespace-pre-wrap break-words leading-relaxed">{session.note}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AllSessionsTable;
/* File: src\components\dashboard\SessionsTable.js */

/* - src/components/dashboard/SessionsTable.js -  */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { formatDateTime, formatDuration } from './utils/formatters';
import '../animations.css';
import { formatCombinedDifficulty } from '../../contexts/gameHelpers';
import { auth } from '../../firebaseConfig';
import { useUser } from '../../contexts/UserContext';
import { MODE_LABELS, MODE_FILTER_COLORS, MODE_MODALITIES } from '../../constants/modeStyles';
import { getSessionAccuracy } from '../../utils/accuracy';

// --- Mode badge helpers ---
// Badge classes (bg + text tailwind pair) per session.gameMode, with
// safe fallback to dual styling for unknown values.
const badgeClasses = (gameMode) => {
    const m = gameMode || 'dual';
    if (m.startsWith('single')) return 'bg-emerald-500/20 text-emerald-400';
    return MODE_FILTER_COLORS[m]?.active || MODE_FILTER_COLORS.dual.active;
};
const badgeTextOnly = (gameMode) => {
    const m = gameMode || 'dual';
    if (m.startsWith('single')) return 'text-emerald-400';
    if (m === 'quad') return 'text-cyan-400';
    if (m === 'triple') return 'text-purple-400';
    if (m === 'dynamic') return 'text-theme-accent';
    return 'text-yellow-400';
};
// One-char badge for tight mobile rows (D / T / Q / S).
const badgeShort = (gameMode) => {
    const m = gameMode || 'dual';
    if (m.startsWith('single')) return 'S';
    if (m === 'quad') return 'Q';
    if (m === 'triple') return 'T';
    if (m === 'dynamic') return 'Y';
    return 'D';
};
// ~4-char badge for narrow desktop cells.
const badgeMedium = (gameMode) => {
    const m = gameMode || 'dual';
    if (m === 'singleVisual') return 'S-POS';
    if (m === 'singleAudio') return 'S-AUD';
    if (m === 'singleColor') return 'S-COL';
    if (m === 'singleColorRecall') return 'S-REC';
    if (m === 'singleShape') return 'S-SHP';
    if (m === 'quad') return 'QUAD';
    if (m === 'triple') return 'TRI';
    if (m === 'dynamic') return 'DYN';
    return 'DUAL';
};
// Full label for the "Mode:" field in expanded detail rows.
const badgeFull = (gameMode) => MODE_LABELS[gameMode || 'dual'] || 'Dual';
// Full "X N-Back" title, except singles which are e.g. "Single Position N-Back".
const badgeFullTitle = (gameMode) => {
    const m = gameMode || 'dual';
    const label = MODE_LABELS[m] || 'Dual';
    return `${label} N-Back`;
};

/**
 * Enhanced Sessions Table Component - Shows recent sessions in a responsive table format
 * with expandable rows for details, improved visuals, and better user experience.
 *
 * Props:
 * - sessions: {Array} Array of session objects.
 * - onNavigate: {Function} Function for navigation (e.g., replay button).
 */
const SessionsTable = ({
    sessions,
    onNavigate,
    // Modality column visibility — driven by the parent filter selection.
    // Defaults match the pre-filter-aware behavior: Pos + Aud always shown,
    // Color + Shape hidden. ProfileDashboard now overrides these based on globalMode.
    showVisualColumn = true,
    showAudioColumn  = true,
    showColorColumn  = false,
    showShapeColumn  = false,
}) => {
    // Total column count for the expanded-details colSpan: 3 fixed (Timestamp, Duration, Acc)
    // + N modality columns + 1 (Level).
    const modalityColCount = (showVisualColumn ? 1 : 0) + (showAudioColumn ? 1 : 0)
        + (showColorColumn ? 1 : 0) + (showShapeColumn ? 1 : 0);
    const totalColCount = 3 + modalityColCount + 1;
    // --- STATE HOOKS ---
    const [expandedRowId, setExpandedRowId] = useState(null);
    const [showAllSessions, setShowAllSessions] = useState(false);
    const { updateSessionNote } = useUser();

    // Note modal state
    const [noteModalSession, setNoteModalSession] = useState(null); // session object or null
    const [noteText, setNoteText] = useState('');
    const [noteSaving, setNoteSaving] = useState(false);
    const [noteError, setNoteError] = useState(null);

    const handleOpenNoteModal = useCallback((session) => {
        setNoteModalSession(session);
        setNoteText(session.note || '');
        setNoteError(null);
    }, []);

    const handleCloseNoteModal = useCallback(() => {
        if (noteSaving) return;
        setNoteModalSession(null);
        setNoteText('');
        setNoteError(null);
    }, [noteSaving]);

    const handleSaveNote = useCallback(async () => {
        if (noteSaving || !noteModalSession) return;
        const trimmed = noteText.trim();
        if (trimmed.length > 500) {
            setNoteError('Note is too long (max 500 characters).');
            return;
        }
        setNoteSaving(true);
        setNoteError(null);
        const result = await updateSessionNote(noteModalSession.id, trimmed);
        setNoteSaving(false);
        if (result.success) {
            setNoteModalSession(null);
            setNoteText('');
        } else {
            setNoteError(result.error || 'Failed to save note.');
        }
    }, [noteText, noteSaving, noteModalSession, updateSessionNote]);

    // Modal scroll lock & Escape key
    useEffect(() => {
        if (noteModalSession) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [noteModalSession]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!noteModalSession) return;
            if (e.key === 'Escape') handleCloseNoteModal();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [noteModalSession, handleCloseNoteModal]);
    // ---

    // Constants for pagination/display limits
    const MAX_DISPLAYED_SESSIONS = 20;
    const DEFAULT_DISPLAYED_SESSIONS = 5;

    // --- Memoized Data Processing ---
    const recentSessions = useMemo(() => {
        if (!Array.isArray(sessions)) return [];
        return [...sessions]
            .map(s => ({ ...s, dateObj: s.date ? new Date(s.date) : null }))
            .filter(s => s.dateObj instanceof Date && !isNaN(s.dateObj.getTime()))
            .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
    }, [sessions]);
    // ---

    // Determine which sessions to display based on toggle state
    const displayedSessions = showAllSessions
        ? recentSessions.slice(0, MAX_DISPLAYED_SESSIONS)
        : recentSessions.slice(0, DEFAULT_DISPLAYED_SESSIONS);

    // Logic for the "Show More/Less" button
    const showToggleButton = recentSessions.length > DEFAULT_DISPLAYED_SESSIONS;

    // --- EVENT HANDLERS ---
    const toggleRowExpansion = useCallback((sessionId) => {
        setExpandedRowId(currentId => (currentId === sessionId ? null : sessionId));
    }, []);

    const handleReplay = useCallback((e, session) => {
        e.stopPropagation();
        if (typeof onNavigate !== 'function') {
            console.error("Navigation handler missing");
            alert("Navigation error.");
            return;
        }

        // Continuous-mode sessions: per-block docs (mode='continuous-block') don't have replayData
        // saved in v1; legacy chain docs (mode='continuous') aggregate multiple N/N.DD which the
        // single-block viewer can't render. Both gated.
        if (session?.mode === 'continuous' || session?.mode === 'continuous-block') {
            console.info("[Replay] Continuous-mode session — replay not available in v1.");
            return;
        }

        const sessionId = session?.id;
        const hasValidReplayData = !!session?.replayData?.settings &&
            Array.isArray(session.replayData.events) &&
            session.replayData.startTime !== undefined;

        if (sessionId && hasValidReplayData) {
            onNavigate(`/replay/${sessionId}`, { state: { from: 'dashboard' } });
        } else {
            console.warn("Replay unavailable:", { sessionId, hasValidReplayData });
            alert("Replay data is not available or incomplete for this session.");
        }
    }, [onNavigate]);

    // Empty state handling
    if (!sessions || sessions.length === 0) {
        return (
            <div className="specimen-card p-8 text-center">
                <div className="inline-block mb-4">
                    <div className="w-16 h-16 border border-theme-line flex items-center justify-center text-theme-text-muted">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </div>
                <h3 className="text-theme-text font-serif italic text-lg mb-2">No Sessions Recorded</h3>
                <p className="text-theme-text-muted text-sm font-mono mb-4">Experiment log awaiting data entries</p>
                <div className="inline-flex items-center gap-2 text-sm sm:text-xs text-theme-text-secondary bg-theme-bg-elevated px-3 py-1.5 border border-theme-line">
                    <div className="w-1.5 h-1.5 bg-theme-accent rounded-full animate-pulse"></div>
                    <span className="font-mono">Complete first session to populate log</span>
                </div>
            </div>
        );
    }

    // Main content with lab notebook styling
    return (
        <>
            <div className="specimen-card overflow-hidden">
                {/* Table Header - Lab notebook style */}
                <div className="bg-theme-bg-elevated py-3 px-4 border-b border-theme-line flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                        <h3 className="font-serif italic text-theme-text">Session Log</h3>
                    </div>
                    <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider bg-theme-bg-secondary px-3 py-1 border border-theme-line">
                        {displayedSessions.length} / {recentSessions.length} entries
                    </div>
                </div>

                {/* Mobile View - Card-based Layout */}
                <div className="block sm:hidden">
                    {displayedSessions.map((session) => {
                        const rowKey = session.id;
                        const isExpanded = expandedRowId === rowKey;

                        const hasValidReplayData = !!session?.replayData?.settings &&
                            Array.isArray(session.replayData.events) &&
                            session.replayData.startTime !== undefined;

                        const canReplay = !!session?.id && hasValidReplayData && session?.mode !== 'continuous' && session?.mode !== 'continuous-block';
                        const oldCombinedValue = formatCombinedDifficulty(session.nBack, session.difficulty);
                        const newCombinedValue = session.newDifficulty !== undefined && session.newNBack !== undefined
                            ? formatCombinedDifficulty(session.newNBack, session.newDifficulty)
                            : null;

                        const levelChanged = newCombinedValue && newCombinedValue !== oldCombinedValue;
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
                            <div
                                key={rowKey}
                                className={`border-b border-theme-border px-4 py-3 ${isExpanded ? 'bg-theme-bg-elevated' : ''}`}
                            >
                                {/* Main Card Content */}
                                <div
                                    className="flex flex-wrap justify-between cursor-pointer"
                                    onClick={() => toggleRowExpansion(rowKey)}
                                >
                                    {/* Left side - Date and N-Back */}
                                    <div className="w-3/5 flex items-center">
                                        <span className={`mr-1 transition-transform duration-200 inline-block ${isExpanded ? 'rotate-90' : 'rotate-0'}`} aria-hidden="true">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-theme-text-muted" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </span>
                                        <div className="flex flex-col">
                                            <span className="text-xs text-theme-text">
                                                {formatDateTime(session.dateObj)}
                                            </span>
                                            <div className="flex items-center mt-1">
                                                {/* Mode badge */}
                                                <span className={`text-[0.6875rem] font-mono uppercase px-1 py-0.5 rounded mr-1.5 ${badgeClasses(session.gameMode)}`}>
                                                    {badgeShort(session.gameMode)}
                                                </span>
                                                <span className="text-sm font-medium text-theme-text">{session.nBack}-back</span>
                                                {session.newNBack !== undefined && session.newNBack !== session.nBack && (
                                                    <span className={`text-xs ml-2 ${session.newNBack > session.nBack ? 'text-status-success' : 'text-status-error'} flex items-center`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={session.newNBack > session.nBack ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
                                                        </svg>
                                                        {session.newNBack}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right side - Stats */}
                                    <div className="w-2/5 flex flex-col items-end">
                                        <div className="flex flex-wrap gap-1 mb-1 justify-end">
                                            <div className="inline-flex items-center px-1 py-0.5 rounded-full bg-theme-bg-surface text-theme-text text-xs font-mono">
                                                {acc.overall?.toFixed(0) ?? "-"}%
                                            </div>
                                            {showVisual && (
                                                <div className="inline-flex items-center px-1 py-0.5 rounded-full bg-theme-bg-surface text-theme-accent text-xs font-mono">
                                                    V:{acc.visual?.toFixed(0) ?? "-"}%
                                                </div>
                                            )}
                                            {showAudio && (
                                                <div className="inline-flex items-center px-1 py-0.5 rounded-full bg-theme-bg-surface text-status-success text-xs font-mono">
                                                    A:{acc.audio?.toFixed(0) ?? "-"}%
                                                </div>
                                            )}
                                            {/* Color accuracy — shown when the session's gameMode includes color */}
                                            {showColor && acc.color != null && (
                                                <div className="inline-flex items-center px-1 py-0.5 rounded-full bg-theme-bg-surface text-purple-400 text-xs font-mono">
                                                    C:{acc.color?.toFixed(0) ?? "-"}%
                                                </div>
                                            )}
                                            {/* Shape accuracy — shown when the session's gameMode includes shape */}
                                            {showShape && acc.shape != null && (
                                                <div className="inline-flex items-center px-1 py-0.5 rounded-full bg-theme-bg-surface text-cyan-400 text-xs font-mono">
                                                    S:{acc.shape?.toFixed(0) ?? "-"}%
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end text-xs text-theme-text-secondary">
                                            <span className="font-mono">{formatDuration(session.durationMs)}</span>
                                            <div className="flex items-center">
                                                <span className="font-mono">Level: {oldCombinedValue}</span>
                                                {levelChanged && (
                                                    <span className={`ml-1 ${levelIncreased ? 'text-status-success' : 'text-status-error'} flex items-center font-mono`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={levelIncreased ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
                                                        </svg>
                                                        {newCombinedValue}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Details Content - Mobile */}
                                {isExpanded && (
                                    <div className="mt-3 pt-3 border-t border-theme-border animated fadeIn">
                                        {/* Performance Stats Grid */}
                                        <div className="grid grid-cols-2 gap-3 mb-4">
                                            {/* Visual Performance Card */}
                                            {showVisual && (
                                            <div className="bg-theme-bg-secondary rounded-lg p-3 border border-theme-border">
                                                <div className="flex items-center mb-2">
                                                    <div className="w-6 h-6 rounded-full bg-theme-accent/20 flex items-center justify-center mr-2">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-theme-accent" viewBox="0 0 20 20" fill="currentColor">
                                                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <h4 className="font-semibold text-sm text-theme-text">Position</h4>
                                                </div>

                                                <div className="space-y-1 text-xs">
                                                    <div className="flex justify-between">
                                                        <span className="text-theme-text-secondary">Accuracy:</span>
                                                        <span className="font-medium text-theme-text font-mono">{acc.visual?.toFixed(1) ?? '-'}%</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-theme-text-secondary">Hits:</span>
                                                        <span className="text-theme-text font-mono">{session.visualCorrect ?? '?'}/{session.visualTargetCount ?? '?'}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-theme-text-secondary">False:</span>
                                                        <span className="text-theme-text font-mono">{session.visualFalseAlarms ?? '?'}</span>
                                                    </div>

                                                    <div className="pt-1 border-t border-theme-border mt-1">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-theme-text-secondary">d′:</span>
                                                            <span className="font-medium text-theme-accent text-sm font-mono">{session.visualDprime?.toFixed(2) ?? '-'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            )}

                                            {/* Audio Performance Card */}
                                            {showAudio && (
                                            <div className="bg-theme-bg-secondary rounded-lg p-3 border border-theme-border">
                                                <div className="flex items-center mb-2">
                                                    <div className="w-6 h-6 rounded-full bg-status-success/20 flex items-center justify-center mr-2">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-status-success" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243a1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828a1 1 0 010-1.415z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <h4 className="font-semibold text-sm text-theme-text">Audio</h4>
                                                </div>

                                                <div className="space-y-1 text-xs">
                                                    <div className="flex justify-between">
                                                        <span className="text-theme-text-secondary">Accuracy:</span>
                                                        <span className="font-medium text-theme-text font-mono">{acc.audio?.toFixed(1) ?? '-'}%</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-theme-text-secondary">Hits:</span>
                                                        <span className="text-theme-text font-mono">{session.audioCorrect ?? '?'}/{session.audioTargetCount ?? '?'}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-theme-text-secondary">False:</span>
                                                        <span className="text-theme-text font-mono">{session.audioFalseAlarms ?? '?'}</span>
                                                    </div>

                                                    <div className="pt-1 border-t border-theme-border mt-1">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-theme-text-secondary">d′:</span>
                                                            <span className="font-medium text-status-success text-sm font-mono">{session.audioDprime?.toFixed(2) ?? '-'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            )}

                                            {/* Color Performance Card — shown when gameMode includes color */}
                                            {showColor && acc.color != null && (
                                                <div className="bg-theme-bg-secondary rounded-lg p-3 border border-theme-border">
                                                    <div className="flex items-center mb-2">
                                                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center mr-2">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                        <h4 className="font-semibold text-sm text-theme-text">Color</h4>
                                                    </div>

                                                    <div className="space-y-1 text-xs">
                                                        <div className="flex justify-between">
                                                            <span className="text-theme-text-secondary">Accuracy:</span>
                                                            <span className="font-medium text-theme-text font-mono">{acc.color?.toFixed(1) || '-'}%</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-theme-text-secondary">Hits:</span>
                                                            <span className="text-theme-text font-mono">{session.colorCorrect ?? '?'}/{session.colorTargetCount ?? '?'}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-theme-text-secondary">False:</span>
                                                            <span className="text-theme-text font-mono">{session.colorFalseAlarms ?? '?'}</span>
                                                        </div>

                                                        <div className="pt-1 border-t border-theme-border mt-1">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-theme-text-secondary">d′:</span>
                                                                <span className="font-medium text-purple-400 text-sm font-mono">{session.colorDprime?.toFixed(2) || '-'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Shape Performance Card — shown when gameMode includes shape */}
                                            {showShape && acc.shape != null && (
                                                <div className="bg-theme-bg-secondary rounded-lg p-3 border border-theme-border">
                                                    <div className="flex items-center mb-2">
                                                        <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center mr-2">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
                                                                <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
                                                            </svg>
                                                        </div>
                                                        <h4 className="font-semibold text-sm text-theme-text">Shape</h4>
                                                    </div>

                                                    <div className="space-y-1 text-xs">
                                                        <div className="flex justify-between">
                                                            <span className="text-theme-text-secondary">Accuracy:</span>
                                                            <span className="font-medium text-theme-text font-mono">{acc.shape?.toFixed(1) || '-'}%</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-theme-text-secondary">Hits:</span>
                                                            <span className="text-theme-text font-mono">{session.shapeCorrect ?? '?'}/{session.shapeTargetCount ?? '?'}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-theme-text-secondary">False:</span>
                                                            <span className="text-theme-text font-mono">{session.shapeFalseAlarms ?? '?'}</span>
                                                        </div>

                                                        <div className="pt-1 border-t border-theme-border mt-1">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-theme-text-secondary">d′:</span>
                                                                <span className="font-medium text-cyan-400 text-sm font-mono">{session.shapeDprime?.toFixed(2) || '-'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Session Details Card */}
                                        <div className="bg-theme-bg-secondary rounded-lg p-3 border border-theme-border mb-4">
                                            <div className="flex items-center mb-2">
                                                <div className="w-6 h-6 rounded-full bg-theme-bg-surface flex items-center justify-center mr-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-theme-text-secondary" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1zm-5 8.274l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L5 10.274zm10 0l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L15 10.274z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                                <h4 className="font-semibold text-sm text-theme-text">Details</h4>
                                            </div>

                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                {/* Show mode type */}
                                                <span className="text-theme-text-secondary">Mode:</span>
                                                <span className={`font-medium font-mono ${badgeTextOnly(session.gameMode)}`}>
                                                    {badgeFull(session.gameMode)}
                                                </span>
                                                {session.startTime && (
                                                    <>
                                                        <span className="text-theme-text-secondary">Started:</span>
                                                        <span className="text-theme-text font-mono">{formatDateTime(new Date(session.startTime))}</span>
                                                    </>
                                                )}
                                                <span className="text-theme-text-secondary">Trials:</span>
                                                <span className="text-theme-text font-mono">{session.trialsCompleted ?? '?'}/{session.totalTrialsPlanned ?? '?'}</span>
                                                <span className="text-theme-text-secondary">Duration:</span>
                                                <span className="text-theme-text font-mono">{formatDuration(session.durationMs)}</span>
                                                <span className="text-theme-text-secondary">Level Change:</span>
                                                <span className={`font-medium font-mono ${levelIncreased ? "text-status-success" : levelDecreased ? "text-status-error" : "text-theme-text-secondary"}`}>
                                                    {oldCombinedValue} → {newCombinedValue ?? oldCombinedValue}
                                                </span>
                                                <span className="text-theme-text-secondary border-t border-theme-border pt-1 mt-1 col-span-1">Overall d′:</span>
                                                <span className="font-medium text-theme-accent text-sm border-t border-theme-border pt-1 mt-1 col-span-1 font-mono">
                                                    {session.overallDprime?.toFixed(2) || '-'}
                                                </span>
                                                {/* Readiness Impact - Mobile (admin only) */}
                                                {auth.currentUser?.email === 'allen@dualnback.com' && (session.readinessScoreBefore != null || session.readinessScoreAfter != null) && (
                                                    <>
                                                        <span className="text-theme-text-secondary col-span-1">Readiness:</span>
                                                        <span className="font-medium font-mono col-span-1">
                                                            <span className="text-theme-text">{session.readinessScoreBefore ?? '?'}</span>
                                                            <span className="text-theme-text-muted mx-1">→</span>
                                                            <span className={
                                                                session.readinessScoreAfter > session.readinessScoreBefore ? 'text-status-success' :
                                                                session.readinessScoreAfter < session.readinessScoreBefore ? 'text-theme-neural-blue' :
                                                                'text-theme-text'
                                                            }>{session.readinessScoreAfter ?? '?'}</span>
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex space-x-2">
                                            {/* Replay Button */}
                                            {canReplay ? (
                                                <button
                                                    onClick={(e) => handleReplay(e, session)}
                                                    className="inline-flex items-center justify-center px-4 py-2 border border-theme-border text-sm font-medium rounded-md text-theme-text bg-theme-bg-surface hover:bg-theme-bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-theme-accent/50 transition-colors"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                                    </svg>
                                                    Replay
                                                </button>
                                            ) : (
                                                <div className="inline-flex items-center justify-center px-4 py-2 text-sm text-theme-text-muted bg-theme-bg-surface rounded-md">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-theme-text-muted" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                    Replay N/A
                                                </div>
                                            )}
                                            {/* Add/Edit Note Button */}
                                            <button
                                                onClick={() => handleOpenNoteModal(session)}
                                                className={`inline-flex items-center justify-center px-4 py-2 border text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-theme-accent/50 ${
                                                    session.note
                                                        ? 'border-theme-accent/30 text-theme-accent/80 bg-theme-accent/5 hover:bg-theme-accent/10 hover:border-theme-accent/50'
                                                        : 'border-theme-border text-theme-text bg-theme-bg-surface hover:bg-theme-bg-secondary'
                                                }`}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                                {session.note ? 'Edit Note' : 'Add Note'}
                                            </button>
                                        </div>

                                        {/* Session Note Display */}
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
                                )}
                            </div>
                        );
                    })} {/* End Mobile map */}
                </div> {/* End Mobile Container */}

                {/* Desktop View - Lab Data Table */}
                <div className="hidden sm:block overflow-x-auto">
                    <table className="min-w-max w-full divide-y divide-theme-line">
                        {/* Table Header - Monospace scientific styling */}
                        <thead className="bg-theme-bg-elevated">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-[0.15em]">Timestamp</th>
                                <th className="px-3 py-3 text-center text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-[0.15em]">Duration</th>
                                <th className="px-3 py-3 text-center text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-[0.15em]">Acc</th>
                                {showVisualColumn && (
                                    <th className="px-3 py-3 text-center text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-accent/70 uppercase tracking-[0.15em]">Pos</th>
                                )}
                                {showAudioColumn && (
                                    <th className="px-3 py-3 text-center text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-neural-green/70 uppercase tracking-[0.15em]">Aud</th>
                                )}
                                {showColorColumn && (
                                    <th className="px-3 py-3 text-center text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-purple-400/70 uppercase tracking-[0.15em]">Col</th>
                                )}
                                {showShapeColumn && (
                                    <th className="px-3 py-3 text-center text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-cyan-400/70 uppercase tracking-[0.15em]">Shp</th>
                                )}
                                <th className="px-3 py-3 text-center text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-[0.15em]">Level</th>
                            </tr>
                        </thead>

                        {/* Table Body */}
                        {/* <<<--- START CHANGE: Apply whitespace fix ---<<< */}
                        <tbody className="bg-theme-bg-secondary divide-y divide-theme-border">{
                            displayedSessions.map((session) => {
                                const rowKey = session.id;
                                const isExpanded = expandedRowId === rowKey;

                                const hasValidReplayData = !!session?.replayData?.settings &&
                                    Array.isArray(session.replayData.events) &&
                                    session.replayData.startTime !== undefined;

                                const canReplay = !!session?.id && hasValidReplayData && session?.mode !== 'continuous' && session?.mode !== 'continuous-block';
                                const oldCombinedValue = formatCombinedDifficulty(session.nBack, session.difficulty);
                                const newCombinedValue = session.newDifficulty !== undefined && session.newNBack !== undefined
                                    ? formatCombinedDifficulty(session.newNBack, session.newDifficulty)
                                    : null;

                                const levelChanged = newCombinedValue && newCombinedValue !== oldCombinedValue;
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
                                    <React.Fragment key={rowKey}>
                                        {/* Main Row */}
                                        <tr
                                            className={`hover:bg-theme-bg-surface cursor-pointer transition-colors duration-150 ${isExpanded ? 'bg-theme-bg-elevated' : ''}`}
                                            onClick={() => toggleRowExpansion(rowKey)}
                                            title="Click to view details"
                                        >
                                            {/* Date Cell */}
                                            <td className="px-3 py-3 whitespace-nowrap text-xs sm:text-sm text-theme-text">
                                                <div className="flex items-center">
                                                    <span className={`mr-2 transition-transform duration-200 inline-block ${isExpanded ? 'rotate-90' : 'rotate-0'}`} aria-hidden="true">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-theme-text-muted" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    </span>
                                                    {/* Mode badge */}
                                                    <span className={`text-[0.6875rem] font-mono uppercase px-1.5 py-0.5 rounded mr-2 ${badgeClasses(session.gameMode)}`}>
                                                        {badgeMedium(session.gameMode)}
                                                    </span>
                                                    {formatDateTime(session.dateObj)}
                                                </div>
                                            </td>

                                            {/* Duration Cell */}
                                            <td className="px-3 py-3 whitespace-nowrap text-xs sm:text-sm text-theme-text-secondary text-center font-mono">
                                                {formatDuration(session.durationMs)}
                                            </td>

                                            {/* Accuracy Cell */}
                                            <td className="px-3 py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-center">
                                                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-theme-bg-surface text-theme-text font-mono">
                                                    {acc.overall?.toFixed(1) ?? "-"}%
                                                </div>
                                            </td>

                                            {/* Visual (Pos) Accuracy Cell */}
                                            {showVisualColumn && (
                                                <td className="px-3 py-3 whitespace-nowrap text-xs sm:text-sm text-center">
                                                    {showVisual ? (
                                                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-theme-bg-surface text-theme-accent font-mono">
                                                            {acc.visual != null ? `${acc.visual.toFixed(1)}%` : "-"}
                                                        </div>
                                                    ) : (
                                                        <span className="text-theme-text-muted">-</span>
                                                    )}
                                                </td>
                                            )}

                                            {/* Audio Accuracy Cell */}
                                            {showAudioColumn && (
                                                <td className="px-3 py-3 whitespace-nowrap text-xs sm:text-sm text-center">
                                                    {showAudio ? (
                                                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-theme-bg-surface text-status-success font-mono">
                                                            {acc.audio != null ? `${acc.audio.toFixed(1)}%` : "-"}
                                                        </div>
                                                    ) : (
                                                        <span className="text-theme-text-muted">-</span>
                                                    )}
                                                </td>
                                            )}

                                            {/* Color Accuracy Cell */}
                                            {showColorColumn && (
                                                <td className="px-3 py-3 whitespace-nowrap text-xs sm:text-sm text-center">
                                                    {showColor ? (
                                                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-theme-bg-surface text-purple-400 font-mono">
                                                            {acc.color != null ? `${acc.color.toFixed(1)}%` : "-"}
                                                        </div>
                                                    ) : (
                                                        <span className="text-theme-text-muted">-</span>
                                                    )}
                                                </td>
                                            )}

                                            {/* Shape Accuracy Cell */}
                                            {showShapeColumn && (
                                                <td className="px-3 py-3 whitespace-nowrap text-xs sm:text-sm text-center">
                                                    {showShape ? (
                                                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-theme-bg-surface text-cyan-400 font-mono">
                                                            {acc.shape != null ? `${acc.shape.toFixed(1)}%` : "-"}
                                                        </div>
                                                    ) : (
                                                        <span className="text-theme-text-muted">-</span>
                                                    )}
                                                </td>
                                            )}

                                            {/* Level Cell */}
                                            <td className="px-3 py-3 whitespace-nowrap text-xs sm:text-sm text-theme-text text-center font-mono">
                                                <div className="flex flex-col items-center">
                                                    <span className="font-medium">{oldCombinedValue}</span>
                                                    {levelChanged && (
                                                        <span className={`text-xs flex items-center ${levelIncreased ? 'text-status-success' : 'text-status-error'}`}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={levelIncreased ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
                                                            </svg>
                                                            {newCombinedValue}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Expanded Details Row */}
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={totalColCount} className="bg-theme-bg-elevated px-4 py-4 border-t border-theme-border">
                                                    <div className="animated fadeIn expand-row">
                                                        {/* Performance Cards */}
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                            {/* Visual Performance Card */}
                                                            {showVisual && (
                                                            <div className="bg-theme-bg-secondary rounded-lg p-4 border border-theme-border">
                                                                <div className="flex items-center mb-3">
                                                                    <div className="w-8 h-8 rounded-full bg-theme-accent/20 flex items-center justify-center mr-2">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-theme-accent" viewBox="0 0 20 20" fill="currentColor">
                                                                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                                                        </svg>
                                                                    </div>
                                                                    <h4 className="font-semibold text-theme-text">Position Performance</h4>
                                                                </div>

                                                                <div className="space-y-2 text-sm">
                                                                    <div className="flex justify-between">
                                                                        <span className="text-theme-text-secondary">Accuracy:</span>
                                                                        <span className="font-medium text-theme-text font-mono">{acc.visual?.toFixed(1) ?? '-'}%</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-theme-text-secondary">Hits:</span>
                                                                        <span className="text-theme-text font-mono">{session.visualCorrect ?? '?'} / {session.visualTargetCount ?? '?'}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-theme-text-secondary">False Alarms:</span>
                                                                        <span className="text-theme-text font-mono">{session.visualFalseAlarms ?? '?'}</span>
                                                                    </div>

                                                                    <div className="pt-2 border-t border-theme-border mt-2">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="text-theme-text-secondary">d′ Score:</span>
                                                                            <span className="font-medium text-theme-accent text-base font-mono">{session.visualDprime?.toFixed(2) ?? '-'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            )}

                                                            {/* Audio Performance Card */}
                                                            {showAudio && (
                                                            <div className="bg-theme-bg-secondary rounded-lg p-4 border border-theme-border">
                                                                <div className="flex items-center mb-3">
                                                                    <div className="w-8 h-8 rounded-full bg-status-success/20 flex items-center justify-center mr-2">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-status-success" viewBox="0 0 20 20" fill="currentColor">
                                                                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071a1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243a1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828a1 1 0 010-1.415z" clipRule="evenodd" />
                                                                        </svg>
                                                                    </div>
                                                                    <h4 className="font-semibold text-theme-text">Audio Performance</h4>
                                                                </div>

                                                                <div className="space-y-2 text-sm">
                                                                    <div className="flex justify-between">
                                                                        <span className="text-theme-text-secondary">Accuracy:</span>
                                                                        <span className="font-medium text-theme-text font-mono">{acc.audio?.toFixed(1) ?? '-'}%</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-theme-text-secondary">Hits:</span>
                                                                        <span className="text-theme-text font-mono">{session.audioCorrect ?? '?'} / {session.audioTargetCount ?? '?'}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-theme-text-secondary">False Alarms:</span>
                                                                        <span className="text-theme-text font-mono">{session.audioFalseAlarms ?? '?'}</span>
                                                                    </div>

                                                                    <div className="pt-2 border-t border-theme-border mt-2">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="text-theme-text-secondary">d′ Score:</span>
                                                                            <span className="font-medium text-status-success text-base font-mono">{session.audioDprime?.toFixed(2) ?? '-'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            )}

                                                            {/* Color Performance Card — shown when gameMode includes color */}
                                                            {showColor && acc.color != null && (
                                                                <div className="bg-theme-bg-secondary rounded-lg p-4 border border-theme-border">
                                                                    <div className="flex items-center mb-3">
                                                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center mr-2">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
                                                                                <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
                                                                            </svg>
                                                                        </div>
                                                                        <h4 className="font-semibold text-theme-text">Color Performance</h4>
                                                                    </div>

                                                                    <div className="space-y-2 text-sm">
                                                                        <div className="flex justify-between">
                                                                            <span className="text-theme-text-secondary">Accuracy:</span>
                                                                            <span className="font-medium text-theme-text font-mono">{acc.color?.toFixed(1) || '-'}%</span>
                                                                        </div>
                                                                        <div className="flex justify-between">
                                                                            <span className="text-theme-text-secondary">Hits:</span>
                                                                            <span className="text-theme-text font-mono">{session.colorCorrect ?? '?'} / {session.colorTargetCount ?? '?'}</span>
                                                                        </div>
                                                                        <div className="flex justify-between">
                                                                            <span className="text-theme-text-secondary">False Alarms:</span>
                                                                            <span className="text-theme-text font-mono">{session.colorFalseAlarms ?? '?'}</span>
                                                                        </div>

                                                                        <div className="pt-2 border-t border-theme-border mt-2">
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="text-theme-text-secondary">d′ Score:</span>
                                                                                <span className="font-medium text-purple-400 text-base font-mono">{session.colorDprime?.toFixed(2) || '-'}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Shape Performance Card — shown when gameMode includes shape */}
                                                            {showShape && acc.shape != null && (
                                                                <div className="bg-theme-bg-secondary rounded-lg p-4 border border-theme-border">
                                                                    <div className="flex items-center mb-3">
                                                                        <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center mr-2">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
                                                                                <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
                                                                            </svg>
                                                                        </div>
                                                                        <h4 className="font-semibold text-theme-text">Shape Performance</h4>
                                                                    </div>

                                                                    <div className="space-y-2 text-sm">
                                                                        <div className="flex justify-between">
                                                                            <span className="text-theme-text-secondary">Accuracy:</span>
                                                                            <span className="font-medium text-theme-text font-mono">{acc.shape?.toFixed(1) || '-'}%</span>
                                                                        </div>
                                                                        <div className="flex justify-between">
                                                                            <span className="text-theme-text-secondary">Hits:</span>
                                                                            <span className="text-theme-text font-mono">{session.shapeCorrect ?? '?'} / {session.shapeTargetCount ?? '?'}</span>
                                                                        </div>
                                                                        <div className="flex justify-between">
                                                                            <span className="text-theme-text-secondary">False Alarms:</span>
                                                                            <span className="text-theme-text font-mono">{session.shapeFalseAlarms ?? '?'}</span>
                                                                        </div>

                                                                        <div className="pt-2 border-t border-theme-border mt-2">
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="text-theme-text-secondary">d′ Score:</span>
                                                                                <span className="font-medium text-cyan-400 text-base font-mono">{session.shapeDprime?.toFixed(2) || '-'}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Overall Details Card */}
                                                            <div className="bg-theme-bg-secondary rounded-lg p-4 border border-theme-border">
                                                                <div className="flex items-center mb-3">
                                                                    <div className="w-8 h-8 rounded-full bg-theme-bg-surface flex items-center justify-center mr-2">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-theme-text-secondary" viewBox="0 0 20 20" fill="currentColor">
                                                                            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019a1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019a1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1zm-5 8.274l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L5 10.274zm10 0l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L15 10.274z" clipRule="evenodd" />
                                                                        </svg>
                                                                    </div>
                                                                    <h4 className="font-semibold text-theme-text">Session Details</h4>
                                                                </div>

                                                                <div className="space-y-2 text-sm">
                                                                    {/* Show mode type */}
                                                                    <div className="flex justify-between">
                                                                        <span className="text-theme-text-secondary">Mode:</span>
                                                                        <span className={`font-medium font-mono ${badgeTextOnly(session.gameMode)}`}>
                                                                            {badgeFullTitle(session.gameMode)}
                                                                        </span>
                                                                    </div>
                                                                    {session.startTime && (
                                                                        <div className="flex justify-between">
                                                                            <span className="text-theme-text-secondary">Started:</span>
                                                                            <span className="text-theme-text font-mono">{formatDateTime(new Date(session.startTime))}</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="flex justify-between">
                                                                        <span className="text-theme-text-secondary">Trials:</span>
                                                                        <span className="text-theme-text font-mono">{session.trialsCompleted ?? '?'} / {session.totalTrialsPlanned ?? '?'}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-theme-text-secondary">Duration:</span>
                                                                        <span className="text-theme-text font-mono">{formatDuration(session.durationMs)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-theme-text-secondary">Level Change:</span>
                                                                        <span className={`font-medium font-mono ${levelIncreased ? "text-status-success" : levelDecreased ? "text-status-error" : "text-theme-text-secondary"}`}>
                                                                            {oldCombinedValue} → {newCombinedValue ?? oldCombinedValue}
                                                                        </span>
                                                                    </div>

                                                                    <div className="pt-2 border-t border-theme-border mt-2">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="text-theme-text-secondary">Overall d′:</span>
                                                                            <span className="font-medium text-theme-accent text-base font-mono">{session.overallDprime?.toFixed(2) || '-'}</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Readiness Impact (admin only) */}
                                                                    {auth.currentUser?.email === 'allen@dualnback.com' && (session.readinessScoreBefore != null || session.readinessScoreAfter != null) && (
                                                                        <div className="pt-2 border-t border-theme-border mt-2">
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="text-theme-text-secondary">Readiness:</span>
                                                                                <span className="font-medium font-mono">
                                                                                    <span className="text-theme-text">{session.readinessScoreBefore ?? '?'}</span>
                                                                                    <span className="text-theme-text-muted mx-1">→</span>
                                                                                    <span className={
                                                                                        session.readinessScoreAfter > session.readinessScoreBefore ? 'text-status-success' :
                                                                                        session.readinessScoreAfter < session.readinessScoreBefore ? 'text-theme-neural-blue' :
                                                                                        'text-theme-text'
                                                                                    }>{session.readinessScoreAfter ?? '?'}</span>
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Action Buttons */}
                                                        <div className="flex flex-row justify-end space-x-3">
                                                            {/* Replay Button */}
                                                            {canReplay ? (
                                                                <button
                                                                    onClick={(e) => handleReplay(e, session)}
                                                                    className="inline-flex items-center justify-center px-4 py-2 border border-theme-border text-sm font-medium rounded-md text-theme-text bg-theme-bg-surface hover:bg-theme-bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-theme-accent/50 transition-colors"
                                                                    title="Replay session"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                                                    </svg>
                                                                    Replay
                                                                </button>
                                                            ) : (
                                                                <div className="inline-flex items-center px-4 py-2 text-sm text-theme-text-muted bg-theme-bg-surface rounded-md">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-theme-text-muted" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                    </svg>
                                                                    Replay N/A
                                                                </div>
                                                            )}
                                                            {/* Add/Edit Note Button */}
                                                            <button
                                                                onClick={() => handleOpenNoteModal(session)}
                                                                className={`inline-flex items-center justify-center px-4 py-2 border text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-theme-accent/50 ${
                                                                    session.note
                                                                        ? 'border-theme-accent/30 text-theme-accent/80 bg-theme-accent/5 hover:bg-theme-accent/10 hover:border-theme-accent/50'
                                                                        : 'border-theme-border text-theme-text bg-theme-bg-surface hover:bg-theme-bg-secondary'
                                                                }`}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                </svg>
                                                                {session.note ? 'Edit Note' : 'Add Note'}
                                                            </button>
                                                        </div>

                                                        {/* Session Note Display */}
                                                        {session.note && (
                                                            <div className="bg-theme-bg-secondary rounded-lg p-4 border border-theme-border mt-4 max-w-2xl">
                                                                <div className="flex items-center mb-2">
                                                                    <div className="w-6 h-6 rounded-full bg-theme-accent/10 flex items-center justify-center mr-2">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-theme-accent/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                        </svg>
                                                                    </div>
                                                                    <h4 className="font-semibold text-sm text-theme-text">Note</h4>
                                                                </div>
                                                                <p className="text-sm text-theme-text-secondary font-mono whitespace-pre-wrap break-words leading-relaxed">{session.note}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            }) // End map function
                        }</tbody>{/* <<<--- END CHANGE ---<<< */}
                    </table>
                </div> {/* End Desktop Container */}

                {/* Show More/Less Button - Lab instrument style */}
                {showToggleButton && (
                    <div className="px-4 py-3 bg-theme-bg-elevated border-t border-theme-line text-center">
                        <button
                            onClick={() => setShowAllSessions(prev => !prev)}
                            className="group inline-flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider text-theme-text-secondary hover:text-theme-accent bg-theme-bg-secondary border border-theme-line hover:border-theme-accent transition-all"
                        >
                            {showAllSessions ? (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 transition-transform group-hover:-translate-y-0.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                    </svg>
                                    Collapse Log
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 transition-transform group-hover:translate-y-0.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                    Expand Log [{Math.min(recentSessions.length, MAX_DISPLAYED_SESSIONS)} entries]
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div> {/* End Main Table and Content Container */}

            {/* Note Edit Modal */}
            {noteModalSession && ReactDOM.createPortal(
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 99999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '1rem',
                        overflowY: 'auto',
                        overscrollBehavior: 'contain',
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="note-modal-title"
                >
                    {/* Backdrop */}
                    <div
                        style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.85)',
                            backdropFilter: 'blur(4px)',
                        }}
                        onClick={handleCloseNoteModal}
                    />

                    {/* Modal Panel */}
                    <div
                        style={{
                            position: 'relative', width: '100%', maxWidth: '32rem',
                            borderRadius: '2px',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        }}
                        className="bg-theme-bg-secondary border border-theme-line animate-fadeIn"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="border-b border-theme-line px-5 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                                </div>
                                <span className="text-xs font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                                    Session Note
                                </span>
                            </div>
                            <button
                                onClick={handleCloseNoteModal}
                                className="text-theme-text-muted hover:text-theme-text transition-colors p-1 -m-1"
                                aria-label="Close"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="square" strokeLinejoin="miter" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-6 pt-5 pb-4">
                            <h3 className="text-lg font-serif text-theme-text" id="note-modal-title">
                                {noteModalSession.note ? 'Edit Note' : 'Add Note'}
                            </h3>
                            <p className="mt-1 text-sm text-theme-text-secondary font-mono">
                                Add a personal annotation to this session.
                            </p>

                            <div className="mt-4">
                                <label className="block text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-2">
                                    Note
                                </label>
                                <textarea
                                    value={noteText}
                                    onChange={(e) => { setNoteText(e.target.value); setNoteError(null); }}
                                    maxLength={500}
                                    rows={4}
                                    placeholder="e.g., Tried a new strategy, was distracted, felt focused..."
                                    autoFocus
                                    className="block w-full px-4 py-3 bg-theme-bg-elevated border border-theme-line rounded-lab text-theme-text font-mono text-sm placeholder-theme-text-muted/40 focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-theme-accent transition-colors duration-200 resize-none"
                                />
                                <div className="flex items-center justify-between mt-2">
                                    <span className={`text-[0.625rem] font-mono ${noteText.length > 450 ? 'text-status-error' : 'text-theme-text-muted'}`}>
                                        {noteText.length} / 500
                                    </span>
                                    {noteError && <span className="text-xs font-mono text-status-error">{noteError}</span>}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-theme-bg-elevated px-6 py-4 border-t border-theme-line sm:flex sm:flex-row-reverse gap-3">
                            <button
                                onClick={handleSaveNote}
                                disabled={noteSaving || noteText.trim().length === 0}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-lab text-sm font-mono uppercase tracking-wider border transition-all duration-200 bg-theme-accent hover:bg-amber-highlight text-theme-bg border-theme-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-theme-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {noteSaving ? 'Saving...' : 'Save Note'}
                            </button>
                            <button
                                onClick={handleCloseNoteModal}
                                disabled={noteSaving}
                                className="w-full sm:w-auto mt-3 sm:mt-0 px-5 py-2.5 rounded-lab text-sm font-mono uppercase tracking-wider bg-theme-bg-secondary hover:bg-theme-bg-surface text-theme-text-secondary hover:text-theme-text border border-theme-line transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-theme-bg-secondary focus:ring-theme-accent"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </> // End Single Root Fragment
    );
}; // This is the single closing brace for the component function

// Export default statement moved to the very bottom
export default SessionsTable;
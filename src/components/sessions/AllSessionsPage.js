/* src/components/sessions/AllSessionsPage.js */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFlask,
    faCalendarAlt,
    faArrowLeft,
    faFilter,
    faFilterCircleXmark,
    faArrowRight
} from '@fortawesome/free-solid-svg-icons';

// Component imports
import LoadingSpinner from '../ui/LoadingSpinner';
import PaginationControls from '../ui/PaginationControls';
import AllSessionsTable from './AllSessionsTable';
import DateFilterControls from './DateFilterControls';
import ExportButton from './ExportButton';

const ITEMS_PER_PAGE_OPTIONS = [25, 50, 100];

const AllSessionsPage = () => {
    const navigate = useNavigate();
    const { authUser, userData, fetchPaginatedSessions, fetchAllSessionsForExport } = useUser();
    const userId = authUser?.uid;

    // State for data
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // State for pagination
    const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE_OPTIONS[0]);
    const [currentPageNum, setCurrentPageNum] = useState(1);
    const [pageSnapshots, setPageSnapshots] = useState({ 1: null });
    const [totalFilteredSessions, setTotalFilteredSessions] = useState(0);

    // State for filtering
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [triggerFetch, setTriggerFetch] = useState(0);
    const [filtersActive, setFiltersActive] = useState(false);

    // State for mode filter. 'single' is a virtual aggregate that matches any
    // singleVisual/singleAudio/singleColor/singleShape session.
    const [modeFilter, setModeFilter] = useState(['single', 'dual', 'triple', 'quad']); // All modes by default

    // Calculate total pages
    const totalPages = useMemo(() => {
        return Math.max(1, Math.ceil(totalFilteredSessions / pageSize));
    }, [totalFilteredSessions, pageSize]);

    // --- Fetching Logic ---
    useEffect(() => {
        if (!userId) {
            setIsLoading(false);
            setError("Authentication required.");
            setSessions([]);
            setTotalFilteredSessions(0);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);

            const lastVisibleDocId = pageSnapshots[currentPageNum] || null;

            let adjustedEndDateISO = null;
            if (endDate) {
                const endOfDayDate = new Date(endDate);
                endOfDayDate.setHours(23, 59, 59, 999);
                adjustedEndDateISO = endOfDayDate.toISOString();
            }

            const options = {
                pageSize,
                lastVisibleDocId,
                startDate: startDate ? startDate.toISOString() : null,
                endDate: adjustedEndDateISO,
            };

            const result = await fetchPaginatedSessions(null, options);

            if (result.success) {
                setSessions(result.sessions);
                setTotalFilteredSessions(result.totalFilteredSessions);

                if (result.lastVisibleDocId) {
                    setPageSnapshots(prev => ({
                        ...prev,
                        [currentPageNum + 1]: result.lastVisibleDocId
                    }));
                }

                if (result.sessions.length < pageSize || !result.lastVisibleDocId) {
                    setPageSnapshots(prev => {
                        const newSnapshots = {};
                        for (const page in prev) {
                            if (parseInt(page, 10) <= currentPageNum || (parseInt(page, 10) === currentPageNum + 1 && result.lastVisibleDocId)) {
                                newSnapshots[page] = prev[page];
                            }
                        }
                        return newSnapshots;
                    });
                }
            } else {
                console.error("Failed to load sessions:", result.error);
                setError(result.error || "Failed to load sessions.");
                setSessions([]);
                setTotalFilteredSessions(0);
            }
            setIsLoading(false);
        };

        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, currentPageNum, pageSize, triggerFetch, fetchPaginatedSessions, startDate, endDate]);

    useEffect(() => {
        setFiltersActive(!!(startDate || endDate));
    }, [startDate, endDate]);

    // Filter sessions by mode. 'single' in the filter list matches any
    // singleX session (aggregate).
    const modeFilteredSessions = useMemo(() => {
        return sessions.filter(s => {
            const gm = s.gameMode || 'dual';
            if (modeFilter.includes(gm)) return true;
            if (gm.startsWith('single') && modeFilter.includes('single')) return true;
            return false;
        });
    }, [sessions, modeFilter]);

    // Determine which columns to show based on actual session data
    const showColorColumn = modeFilteredSessions.some(s => s.colorAccuracy != null);
    const showShapeColumn = modeFilteredSessions.some(s => s.shapeAccuracy != null);

    // Handle mode filter toggle
    const handleModeToggle = useCallback((mode) => {
        setModeFilter(prev => {
            if (prev.includes(mode)) {
                return prev.filter(m => m !== mode);
            } else {
                return [...prev, mode];
            }
        });
    }, []);

    // --- Handlers ---
    const handlePageChange = useCallback((newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            if (newPage > currentPageNum && !pageSnapshots[newPage]) {
                console.warn(`Attempting to go to page ${newPage} without snapshot.`);
                if (isLoading) return;
            }
            if ((newPage < currentPageNum && pageSnapshots[newPage] !== undefined) ||
                (newPage > currentPageNum && pageSnapshots[newPage]) ||
                (newPage === 1 && pageSnapshots[1] === null)) {
                setCurrentPageNum(newPage);
            } else {
                console.warn(`Page change blocked: Target Page: ${newPage}, Current Page: ${currentPageNum}, Snapshot Exists: ${!!pageSnapshots[newPage]}`);
            }
        } else {
            console.warn(`Attempted to navigate to invalid page: ${newPage} / ${totalPages}`);
        }
    }, [totalPages, pageSnapshots, currentPageNum, isLoading]);

    const handlePageSizeChange = useCallback((newPageSize) => {
        setPageSize(newPageSize);
        setCurrentPageNum(1);
        setPageSnapshots({ 1: null });
        setTriggerFetch(c => c + 1);
    }, []);

    const handleDateFilterChange = useCallback((newStartDate, newEndDate) => {
        const startChanged = (newStartDate?.getTime() || null) !== (startDate?.getTime() || null);
        const endChanged = (newEndDate?.getTime() || null) !== (endDate?.getTime() || null);

        if (startChanged || endChanged) {
            setStartDate(newStartDate);
            setEndDate(newEndDate);
            setCurrentPageNum(1);
            setPageSnapshots({ 1: null });
            setTriggerFetch(c => c + 1);
        }
    }, [startDate, endDate]);

    const handleClearAllFilters = useCallback(() => {
        if (startDate || endDate) {
            setStartDate(null);
            setEndDate(null);
            setCurrentPageNum(1);
            setPageSnapshots({ 1: null });
            setTriggerFetch(c => c + 1);
        }
    }, [startDate, endDate]);

    // --- Display Logic ---
    const displayTotal = totalFilteredSessions > 0
        ? `${totalFilteredSessions} ${totalFilteredSessions !== 1 ? 'entries' : 'entry'}`
        : (filtersActive ? '0 entries found' : 'No entries');

    return (
        // Main container with lab grid background
        <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-8 lab-grid min-h-screen">

            {/* ═══════════════════════════════════════════════════════════════
                PAGE HEADER - Lab notebook style
               ═══════════════════════════════════════════════════════════════ */}
            <header className="mb-8 sm:mb-10">
                {/* Back navigation */}
                <div className="mb-6">
                    <Link
                        to="/dashboard"
                        className="group inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-accent transition-colors"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                        <span className="text-xs font-mono uppercase tracking-wider">Return to Dashboard</span>
                    </Link>
                </div>

                {/* Title section */}
                <div className="flex items-center gap-4">
                    {/* Icon badge */}
                    <div className="h-12 w-12 sm:h-14 sm:w-14 relative flex-shrink-0">
                        <div className="absolute inset-0 bg-theme-accent/20 rounded-sm rotate-3"></div>
                        <div className="absolute inset-0 bg-theme-bg-secondary border border-theme-accent flex items-center justify-center text-theme-accent">
                            <FontAwesomeIcon icon={faFlask} className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">Data Archive</p>
                        <h1 className="text-xl sm:text-2xl lg:text-3xl text-theme-text font-serif italic">
                            Session History
                        </h1>
                    </div>
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════════
                FILTER CONTROLS PANEL - Lab instrument style
               ═══════════════════════════════════════════════════════════════ */}
            <section className="mb-6 sm:mb-8 relative z-30">
                <div className="specimen-card p-4 sm:p-6 !overflow-visible" style={{ position: 'relative', zIndex: 30 }}>
                    {/* Panel header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-theme-line">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                            <h2 className="text-sm sm:text-xs uppercase tracking-[0.2em] text-theme-text-muted font-mono">Query Parameters</h2>
                        </div>

                        {filtersActive && (
                            <button
                                onClick={handleClearAllFilters}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-status-error bg-status-error/10 border border-status-error/30 hover:bg-status-error/20 transition-colors"
                            >
                                <FontAwesomeIcon icon={faFilterCircleXmark} className="h-3 w-3" />
                                <span>Clear Filters</span>
                            </button>
                        )}
                    </div>

                    {/* Filter controls row */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Date and Mode Filters */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            {/* Date Filter Controls */}
                            <DateFilterControls
                                onFilterChange={handleDateFilterChange}
                                initialStartDate={startDate}
                                initialEndDate={endDate}
                            />

                            {/* Mode Filter */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-theme-text-muted uppercase tracking-wider">Mode:</span>
                                <div className="flex">
                                    <button
                                        onClick={() => handleModeToggle('single')}
                                        className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors ${
                                            modeFilter.includes('single')
                                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                                                : 'bg-theme-bg-elevated text-theme-text-muted border-theme-line hover:border-warm-muted'
                                        }`}
                                    >
                                        Single
                                    </button>
                                    <button
                                        onClick={() => handleModeToggle('dual')}
                                        className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border-y border-r transition-colors ${
                                            modeFilter.includes('dual')
                                                ? 'bg-theme-accent/20 text-theme-accent border-theme-accent/50'
                                                : 'bg-theme-bg-elevated text-theme-text-muted border-theme-line hover:border-warm-muted'
                                        }`}
                                    >
                                        Dual
                                    </button>
                                    <button
                                        onClick={() => handleModeToggle('triple')}
                                        className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border-y border-r transition-colors ${
                                            modeFilter.includes('triple')
                                                ? 'bg-purple-500/20 text-purple-400 border-purple-500/50'
                                                : 'bg-theme-bg-elevated text-theme-text-muted border-theme-line hover:border-warm-muted'
                                        }`}
                                    >
                                        Triple
                                    </button>
                                    <button
                                        onClick={() => handleModeToggle('quad')}
                                        className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border-y border-r transition-colors ${
                                            modeFilter.includes('quad')
                                                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
                                                : 'bg-theme-bg-elevated text-theme-text-muted border-theme-line hover:border-warm-muted'
                                        }`}
                                    >
                                        Quad
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Summary & Export */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            {/* Record count indicator */}
                            <div className="flex items-center justify-center px-4 py-2 bg-theme-bg-elevated border border-theme-line text-theme-text-secondary text-sm font-mono">
                                <span className="text-theme-text-muted mr-2">Records:</span>
                                <span className="text-theme-accent">{isLoading ? '...' : displayTotal}</span>
                            </div>

                            {/* Export Button */}
                            <ExportButton
                                profileId={null}
                                startDate={startDate}
                                endDate={endDate}
                                fetchAllSessionsForExport={fetchAllSessionsForExport}
                                filenamePrefix={`sessions_${userData?.displayName || 'user'}`}
                                disabled={!userId || isLoading}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════
                DATA DISPLAY SECTION - Lab data table
               ═══════════════════════════════════════════════════════════════ */}
            <div className="relative" style={{ zIndex: 1, isolation: 'isolate' }}>
            {isLoading ? (
                <div className="specimen-card p-8">
                    <LoadingSpinner message="Retrieving session data..." theme="auto" />
                </div>
            ) : error ? (
                <div className="specimen-card p-6">
                    <div className="flex items-center gap-3 p-4 bg-status-error/10 border border-status-error/30">
                        <div className="w-8 h-8 flex items-center justify-center bg-status-error/20 text-status-error">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-status-error font-mono text-sm">{error}</p>
                        </div>
                    </div>
                </div>
            ) : modeFilteredSessions.length > 0 ? (
                <div className="specimen-card overflow-hidden">
                    {/* Table Header */}
                    <div className="bg-theme-bg-elevated py-3 px-4 border-b border-theme-line flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                            <h3 className="font-serif italic text-theme-text">Experiment Log</h3>
                        </div>
                        <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider bg-theme-bg-secondary px-3 py-1 border border-theme-line">
                            Page {currentPageNum} of {totalPages}
                        </div>
                    </div>

                    {/* Table content */}
                    <AllSessionsTable
                        sessions={modeFilteredSessions}
                        showColorColumn={showColorColumn}
                        showShapeColumn={showShapeColumn}
                    />

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="p-4 bg-theme-bg-elevated border-t border-theme-line">
                            <PaginationControls
                                currentPage={currentPageNum}
                                totalPages={totalPages}
                                onPageChange={handlePageChange}
                                itemsPerPage={pageSize}
                                onItemsPerPageChange={handlePageSizeChange}
                                totalItems={totalFilteredSessions}
                                itemsPerPageOptions={ITEMS_PER_PAGE_OPTIONS}
                            />
                        </div>
                    )}
                </div>
            ) : (
                // Empty State - Lab notebook style
                <div className="specimen-card p-8">
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        {/* Empty state icon */}
                        <div className="relative mb-6">
                            <div className="w-20 h-20 border border-theme-line flex items-center justify-center text-theme-text-muted">
                                <FontAwesomeIcon icon={faCalendarAlt} className="h-8 w-8" />
                            </div>
                            <div className="absolute -top-1 -right-1 w-4 h-4 border-t border-r border-theme-accent/50"></div>
                            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b border-l border-theme-accent/50"></div>
                        </div>

                        <h3 className="text-lg font-serif italic text-theme-text mb-2">No Data Entries Found</h3>
                        <p className="text-theme-text-secondary text-sm max-w-md mb-6 font-mono">
                            {filtersActive
                                ? "No sessions match the current query parameters. Adjust filters or clear to view all records."
                                : "Experiment log awaiting data entries. Complete training sessions to populate the archive."}
                        </p>

                        {filtersActive ? (
                            <button
                                onClick={handleClearAllFilters}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-theme-bg-elevated border border-theme-line hover:border-theme-accent text-sm font-mono text-theme-text-secondary hover:text-theme-accent transition-all"
                            >
                                <FontAwesomeIcon icon={faFilterCircleXmark} className="h-3 w-3" />
                                <span>Clear Filters</span>
                            </button>
                        ) : (
                            <Link
                                to="/dashboard"
                                className="group inline-flex items-center gap-2 px-4 py-2 bg-theme-bg-elevated border border-theme-line hover:border-theme-accent text-sm font-mono text-theme-text-secondary hover:text-theme-accent transition-all"
                            >
                                <span>Return to Dashboard</span>
                                <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                            </Link>
                        )}
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

export default AllSessionsPage;
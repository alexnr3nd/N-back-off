/* src/components/testing/faceNameMemory/FaceNameMemoryHistoryTable.js */
import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHistory } from '@fortawesome/free-solid-svg-icons';
import PaginationControls from '../../ui/PaginationControls';
import { CST_TEST_TYPES } from '../../../constants/cstConstants';

const ITEMS_PER_PAGE = 10;

const formatPercent = (value) => (typeof value === 'number' ? `${value.toFixed(0)}%` : '—');

const formatRetention = (value) => {
    if (typeof value !== 'number') return '—';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(0)}`;
};

// Defensively coerce an ISO string, epoch number, or Firestore-Timestamp-like
// value ({ toDate } / { _seconds }) into a JS Date. Returns null when unparseable.
const toDate = (timestamp) => {
    if (!timestamp) return null;
    try {
        if (typeof timestamp.toDate === 'function') return timestamp.toDate();
        if (typeof timestamp._seconds === 'number') return new Date(timestamp._seconds * 1000);
        if (typeof timestamp.seconds === 'number') return new Date(timestamp.seconds * 1000);
        if (typeof timestamp === 'string' || typeof timestamp === 'number') return new Date(timestamp);
        if (timestamp instanceof Date) return timestamp;
    } catch (e) { /* fall through */ }
    return null;
};

const formatDate = (date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) return 'N/A';
    try {
        return date.toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true,
        });
    } catch (e) { return 'N/A'; }
};

/**
 * Session history specimen card for the Face-Name Memory summary page.
 * Self-contained: filters userData.cstHistory to FACE_NAME_MEMORY entries,
 * normalizes ISO-string / Firestore-Timestamp timestamps, sorts newest-first.
 * Mobile card list + desktop table, paginated. Familiarization (practice)
 * entries are shown with a "Practice" badge and dashes for scores.
 *
 * No population percentile (design: raw score + personal trend only).
 */
const FaceNameMemoryHistoryTable = ({ cstHistory }) => {
    const [currentPage, setCurrentPage] = useState(1);

    // Filter to scored + practice FACE_NAME_MEMORY entries, normalize timestamps,
    // sort newest-first.
    const history = useMemo(() => {
        if (!Array.isArray(cstHistory)) return [];
        return cstHistory
            .filter(item => item?.testType === CST_TEST_TYPES.FACE_NAME_MEMORY)
            .map(item => ({ ...item, timestampDate: toDate(item.timestamp) }))
            .filter(item => item.timestampDate instanceof Date && !isNaN(item.timestampDate.getTime()))
            .sort((a, b) => b.timestampDate.getTime() - a.timestampDate.getTime());
    }, [cstHistory]);

    const totalItems = history.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    const paginatedHistory = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return history.slice(start, start + ITEMS_PER_PAGE);
    }, [history, currentPage]);

    useEffect(() => { setCurrentPage(1); }, [history]);

    const typeBadge = (item) => (
        <span className={`px-2 py-0.5 text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider ${item.familiarizationSession
                ? 'bg-theme-bg-surface text-theme-text-muted'
                : 'bg-theme-accent/20 text-theme-accent'
            }`}>
            {item.familiarizationSession ? 'Practice' : 'Assessment'}
        </span>
    );

    return (
        <section className="mb-8">
            <div className="specimen-card">
                {/* Table Header */}
                <div className="px-5 py-4 border-b border-theme-line bg-theme-bg-elevated/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faHistory} className="text-theme-accent h-4 w-4" />
                        <h2 className="text-sm font-serif italic text-theme-text">Session History</h2>
                    </div>
                    {totalPages > 1 && (
                        <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider bg-theme-bg-secondary px-3 py-1 border border-theme-line">
                            Page {currentPage} of {totalPages}
                        </div>
                    )}
                </div>

                <div className="p-4">
                    {paginatedHistory.length > 0 ? (
                        <>
                            {/* Mobile Card View */}
                            <div className="block md:hidden space-y-3">
                                {paginatedHistory.map((item, index) => (
                                    <div
                                        key={item.id || item.timestampDate?.getTime() || index}
                                        className="bg-theme-bg-elevated border border-theme-line p-4"
                                    >
                                        <div className="flex justify-between items-center mb-3">
                                            {typeBadge(item)}
                                            <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono">
                                                {formatDate(item.timestampDate)}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-1">Delayed</div>
                                                <div className="font-mono text-theme-text">
                                                    <span className="text-lg">{item.familiarizationSession ? '—' : formatPercent(item.delayedHitRate)}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-1">Immediate</div>
                                                <div className="font-mono text-theme-text-secondary">
                                                    <span className="text-lg">{item.familiarizationSession ? '—' : formatPercent(item.immediateHitRate)}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-1">Retention</div>
                                                <div className="font-mono text-theme-text-secondary">
                                                    <span className="text-lg">{item.familiarizationSession ? '—' : formatRetention(item.retention)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-theme-line">
                                            <th className="px-4 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Date</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Type</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Delayed %</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Immediate %</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Retention</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedHistory.map((item, index) => (
                                            <tr
                                                key={item.id || item.timestampDate?.getTime() || index}
                                                className="border-b border-theme-line/50 hover:bg-theme-bg-elevated/50 transition-colors"
                                            >
                                                <td className="px-4 py-3 text-sm text-theme-text-secondary font-mono">
                                                    {formatDate(item.timestampDate)}
                                                </td>
                                                <td className="px-4 py-3">{typeBadge(item)}</td>
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-theme-text">{item.familiarizationSession ? '—' : formatPercent(item.delayedHitRate)}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-theme-text-secondary">{item.familiarizationSession ? '—' : formatPercent(item.immediateHitRate)}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-theme-text-secondary">{item.familiarizationSession ? '—' : formatRetention(item.retention)}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="mt-4 pt-4 border-t border-theme-line">
                                    <PaginationControls
                                        currentPage={currentPage}
                                        totalPages={totalPages}
                                        onPageChange={setCurrentPage}
                                        itemsPerPage={ITEMS_PER_PAGE}
                                        totalItems={totalItems}
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-12 px-4">
                            <div className="relative mb-4 inline-block">
                                <div className="w-16 h-16 border border-theme-line flex items-center justify-center text-theme-text-muted">
                                    <FontAwesomeIcon icon={faHistory} className="h-6 w-6" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-3 h-3 border-t border-r border-theme-accent/50"></div>
                                <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b border-l border-theme-accent/50"></div>
                            </div>
                            <h3 className="text-base font-serif italic text-theme-text mb-2">No History Available</h3>
                            <p className="text-theme-text-muted text-sm sm:text-xs font-mono max-w-md mx-auto">
                                Start with a practice session to begin building your performance history.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

FaceNameMemoryHistoryTable.propTypes = {
    cstHistory: PropTypes.arrayOf(PropTypes.object),
};

export default FaceNameMemoryHistoryTable;

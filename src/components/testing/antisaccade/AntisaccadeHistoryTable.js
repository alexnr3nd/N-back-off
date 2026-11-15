/* src/components/testing/antisaccade/AntisaccadeHistoryTable.js */
import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHistory } from '@fortawesome/free-solid-svg-icons';
import PaginationControls from '../../ui/PaginationControls';

const ITEMS_PER_PAGE = 10;

// scoreAccuracy / errorRate are stored as proportions (0–1) by the backend.
const formatPct = (value) => (typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—');

// percentileDisplay is a display-only string ("62nd", "<5th") — never parsed.
// The backend nulls percentileValid for familiarization and at-chance runs.
const formatPercentile = (item) => (
    item.percentileValid && item.percentileDisplay ? item.percentileDisplay : '—'
);

/**
 * Session history specimen card for the Antisaccade summary page.
 * Mobile card list + desktop table, paginated. Mirrors
 * VisualArraysHistoryTable; only the columns differ.
 */
const AntisaccadeHistoryTable = ({ history, formatDate }) => {
    const [currentPage, setCurrentPage] = useState(1);

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

    // Advisory tag for at-chance runs (accent-toned, never red — non-destructive).
    const atChanceTag = (item) => (
        item.atChance ? (
            <span className="ml-2 px-1.5 py-0.5 text-xs font-mono uppercase tracking-wider bg-theme-accent/10 text-theme-accent whitespace-nowrap">
                at chance
            </span>
        ) : null
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
                                        key={item.id || item.timestamp?.toString() || index}
                                        className="bg-theme-bg-elevated border border-theme-line p-4"
                                    >
                                        <div className="flex justify-between items-center mb-3">
                                            {typeBadge(item)}
                                            <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono">
                                                {formatDate(item.timestamp)}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-1">Accuracy</div>
                                                <div className="font-mono text-theme-text">
                                                    <span className="text-lg">{formatPct(item.scoreAccuracy)}</span>
                                                    {atChanceTag(item)}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-1">Percentile</div>
                                                <div className="font-mono text-theme-text">
                                                    <span className="text-lg">{formatPercentile(item)}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-1">Error Rate</div>
                                                <div className="font-mono text-theme-text">
                                                    <span className="text-lg">{formatPct(item.errorRate)}</span>
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
                                            <th className="px-4 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Accuracy</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Percentile</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Error Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedHistory.map((item, index) => (
                                            <tr
                                                key={item.id || item.timestamp?.toString() || index}
                                                className="border-b border-theme-line/50 hover:bg-theme-bg-elevated/50 transition-colors"
                                            >
                                                <td className="px-4 py-3 text-sm text-theme-text-secondary font-mono">
                                                    {formatDate(item.timestamp)}
                                                </td>
                                                <td className="px-4 py-3">{typeBadge(item)}</td>
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-theme-text">{formatPct(item.scoreAccuracy)}</span>
                                                    {atChanceTag(item)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-theme-text-secondary">{formatPercentile(item)}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-theme-text-secondary">{formatPct(item.errorRate)}</span>
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
                                Start with a familiarization session to begin building your performance history.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

AntisaccadeHistoryTable.propTypes = {
    history: PropTypes.arrayOf(PropTypes.object).isRequired,
    formatDate: PropTypes.func.isRequired,
};

export default AntisaccadeHistoryTable;

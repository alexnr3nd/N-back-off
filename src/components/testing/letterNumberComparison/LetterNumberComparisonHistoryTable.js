/* src/components/testing/letterNumberComparison/LetterNumberComparisonHistoryTable.js */
import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHistory } from '@fortawesome/free-solid-svg-icons';
import PaginationControls from '../../ui/PaginationControls';

const ITEMS_PER_PAGE = 10;

const fmtInt = (value) => (typeof value === 'number' ? String(value) : '—');
const fmtPct = (value) => (typeof value === 'number' ? `${value.toFixed(1)}%` : '—');

/**
 * Session history specimen card for the Letter & Number Comparison summary
 * page. Mobile card list + desktop table, paginated. Split out of the summary
 * page per the ~400-line file guideline. Mirrors RelationMonitoringHistoryTable.
 */
const LetterNumberComparisonHistoryTable = ({ history, formatDate }) => {
    const [currentPage, setCurrentPage] = useState(1);

    const totalItems = history.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    const paginatedHistory = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return history.slice(start, start + ITEMS_PER_PAGE);
    }, [history, currentPage]);

    useEffect(() => { setCurrentPage(1); }, [history]);

    const badges = (item) => (
        <div className="flex flex-wrap items-center gap-1">
            <span className={`px-2 py-0.5 text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider ${item.familiarizationSession
                    ? 'bg-theme-bg-surface text-theme-text-muted'
                    : 'bg-theme-accent/20 text-theme-accent'
                }`}>
                {item.familiarizationSession ? 'Practice' : 'Assessment'}
            </span>
            {item.earlyRetake && (
                <span className="px-2 py-0.5 text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider bg-status-warning/15 text-status-warning">
                    Early
                </span>
            )}
            {item.flaggedLowValidity && (
                <span className="px-2 py-0.5 text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider bg-status-error/15 text-status-error">
                    Flagged
                </span>
            )}
        </div>
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
                                            {badges(item)}
                                            <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono">
                                                {formatDate(item.timestamp)}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-4 gap-3">
                                            <div>
                                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-1">Score</div>
                                                <div className="font-mono text-theme-text">
                                                    <span className="text-lg">{fmtInt(item.score)}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-1">Letters</div>
                                                <div className="font-mono text-theme-text-secondary">
                                                    <span className="text-lg">{fmtInt(item.letterCorrect)}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-1">Numbers</div>
                                                <div className="font-mono text-theme-text-secondary">
                                                    <span className="text-lg">{fmtInt(item.numberCorrect)}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted font-mono uppercase tracking-wider mb-1">Acc.</div>
                                                <div className="font-mono text-theme-text-secondary">
                                                    <span className="text-lg">{fmtPct(item.overallAccuracy)}</span>
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
                                            <th className="px-4 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Score</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Letters</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Numbers</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Accuracy</th>
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
                                                <td className="px-4 py-3">{badges(item)}</td>
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-theme-text">{fmtInt(item.score)}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-theme-text-secondary">{fmtInt(item.letterCorrect)}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-theme-text-secondary">{fmtInt(item.numberCorrect)}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-theme-text-secondary">{fmtPct(item.overallAccuracy)}</span>
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

LetterNumberComparisonHistoryTable.propTypes = {
    history: PropTypes.arrayOf(PropTypes.object).isRequired,
    formatDate: PropTypes.func.isRequired,
};

export default LetterNumberComparisonHistoryTable;

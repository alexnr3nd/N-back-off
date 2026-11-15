/* src/components/admin/cohort/CohortListPage.js */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebaseConfig';
import {
    faFilter,
    faChevronLeft,
    faChevronRight,
    faUsers
} from '@fortawesome/free-solid-svg-icons';
import LoadingSpinner from '../../ui/LoadingSpinner';
import AdminPage from '../ui/AdminPage';
import AdminCard from '../ui/AdminCard';
import AdminButton from '../ui/AdminButton';
import AdminBadge from '../ui/AdminBadge';
import AdminAlert from '../ui/AdminAlert';
import AdminEmptyState from '../ui/AdminEmptyState';
import { AdminTable, AdminTr, AdminTd } from '../ui/AdminTable';
import { LABEL, SELECT } from '../ui/adminStyles';

const STATUS_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'forming', label: 'Forming' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'archived', label: 'Archived' },
];

const STATUS_TONES = {
    forming: 'info',
    active: 'success',
    completed: 'neutral',
    archived: 'neutral',
};

const COLUMNS = [
    { key: 'status', label: 'Status' },
    { key: 'startDate', label: 'Start Date' },
    { key: 'endDate', label: 'End Date' },
    { key: 'members', label: 'Members' },
    { key: 'created', label: 'Created' },
];

const CohortListPage = () => {
    const navigate = useNavigate();
    const [cohorts, setCohorts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [hasMore, setHasMore] = useState(false);
    const [lastDocId, setLastDocId] = useState(null);
    const [pageHistory, setPageHistory] = useState([]);

    const fetchCohorts = useCallback(async (startAfterDocId = null, isNewSearch = false) => {
        setLoading(true);
        setError(null);
        try {
            const fn = httpsCallable(functions, 'adminGetCohorts');
            const result = await fn({
                status: statusFilter,
                pageSize: 25,
                startAfterDocId,
            });
            if (result.data.success) {
                setCohorts(result.data.cohorts);
                setHasMore(result.data.hasMore);
                setLastDocId(result.data.lastDocId);
                if (isNewSearch) setPageHistory([]);
            }
        } catch (err) {
            console.error('[CohortListPage] Error:', err);
            setError(err.message || 'Failed to fetch cohorts');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchCohorts(null, true);
    }, []);

    const handleApply = () => fetchCohorts(null, true);

    const handleNextPage = () => {
        if (hasMore && lastDocId) {
            setPageHistory(prev => [...prev, cohorts[0]?.id || null]);
            fetchCohorts(lastDocId);
        }
    };

    const handlePrevPage = () => {
        if (pageHistory.length > 0) {
            const newHistory = [...pageHistory];
            newHistory.pop();
            setPageHistory(newHistory);
            fetchCohorts(newHistory.length > 0 ? newHistory[newHistory.length - 1] : null);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
            });
        } catch { return 'N/A'; }
    };

    const getStatusBadge = (status) => (
        <AdminBadge tone={STATUS_TONES[status] || 'neutral'}>
            {status || 'unknown'}
        </AdminBadge>
    );

    return (
        <AdminPage
            eyebrow="Program"
            title="Cohorts"
            actions={<span className="text-xs font-mono text-theme-text-muted">{cohorts.length} shown</span>}
        >
            {/* Filter Bar */}
            <AdminCard variant="panel">
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="w-full sm:w-auto">
                        <label className={LABEL}>Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className={`${SELECT} sm:w-40`}
                        >
                            {STATUS_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                    <AdminButton
                        variant="primary"
                        icon={faFilter}
                        disabled={loading}
                        onClick={handleApply}
                    >
                        Apply
                    </AdminButton>
                </div>
            </AdminCard>

            {/* Error */}
            {error && <AdminAlert tone="error">{error}</AdminAlert>}

            {/* Cohort List */}
            <AdminCard variant="panel" flush>
                {loading ? (
                    <div className="py-16">
                        <LoadingSpinner theme="auto" message="Loading cohorts" />
                    </div>
                ) : cohorts.length === 0 ? (
                    <AdminEmptyState
                        icon={faUsers}
                        title="No cohorts found"
                        hint="Adjust the status filter to widen the search"
                    />
                ) : (
                    <>
                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y divide-theme-line/50">
                            {cohorts.map((c) => (
                                <div
                                    key={c.id}
                                    onClick={() => navigate(`/admin/cohorts/${c.id}`)}
                                    className="p-4 hover:bg-theme-bg-elevated cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        {getStatusBadge(c.status)}
                                        <span className="text-xs font-mono text-theme-text-muted">
                                            {c.memberCount}/{c.maxMembers} members
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-theme-text-muted font-mono text-[0.6875rem] uppercase tracking-wider">Start</span>{' '}
                                            <span className="text-theme-text font-mono">{formatDate(c.startDate)}</span>
                                        </div>
                                        <div>
                                            <span className="text-theme-text-muted font-mono text-[0.6875rem] uppercase tracking-wider">End</span>{' '}
                                            <span className="text-theme-text font-mono">{formatDate(c.endDate)}</span>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-theme-text-muted font-mono text-[0.6875rem] uppercase tracking-wider">Created</span>{' '}
                                            <span className="text-theme-text font-mono">{formatDate(c.createdAt)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block">
                            <AdminTable columns={COLUMNS}>
                                {cohorts.map((c) => (
                                    <AdminTr key={c.id} onClick={() => navigate(`/admin/cohorts/${c.id}`)}>
                                        <AdminTd className="whitespace-nowrap">{getStatusBadge(c.status)}</AdminTd>
                                        <AdminTd mono className="whitespace-nowrap">{formatDate(c.startDate)}</AdminTd>
                                        <AdminTd mono className="whitespace-nowrap">{formatDate(c.endDate)}</AdminTd>
                                        <AdminTd mono className="whitespace-nowrap">{c.memberCount}/{c.maxMembers}</AdminTd>
                                        <AdminTd mono muted className="whitespace-nowrap">{formatDate(c.createdAt)}</AdminTd>
                                    </AdminTr>
                                ))}
                            </AdminTable>
                        </div>
                    </>
                )}

                {/* Pagination */}
                {!loading && cohorts.length > 0 && (
                    <div className="bg-theme-bg-elevated px-4 py-3 flex items-center justify-between border-t border-theme-line">
                        <AdminButton
                            variant="secondary"
                            size="sm"
                            icon={faChevronLeft}
                            disabled={pageHistory.length === 0}
                            onClick={handlePrevPage}
                        >
                            Previous
                        </AdminButton>
                        <span className="text-xs font-mono text-theme-text-muted">Page {pageHistory.length + 1}</span>
                        <AdminButton
                            variant="secondary"
                            size="sm"
                            iconRight={faChevronRight}
                            disabled={!hasMore}
                            onClick={handleNextPage}
                        >
                            Next
                        </AdminButton>
                    </div>
                )}
            </AdminCard>
        </AdminPage>
    );
};

export default CohortListPage;

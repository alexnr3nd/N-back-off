/* src/components/admin/coaches/CoachListPage.js */
import React, { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebaseConfig';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFilter,
    faChevronLeft,
    faChevronRight,
    faUserTie,
    faPlus,
    faCopy,
    faCheck,
    faExternalLinkAlt,
    faTicketAlt
} from '@fortawesome/free-solid-svg-icons';
import LoadingSpinner from '../../ui/LoadingSpinner';
import AdminPage from '../ui/AdminPage';
import AdminCard from '../ui/AdminCard';
import AdminButton from '../ui/AdminButton';
import AdminBadge from '../ui/AdminBadge';
import AdminAlert from '../ui/AdminAlert';
import AdminModal from '../ui/AdminModal';
import AdminEmptyState from '../ui/AdminEmptyState';
import { AdminTable, AdminTr, AdminTd } from '../ui/AdminTable';
import { LABEL, INPUT, SELECT, LINK } from '../ui/adminStyles';

const STATUS_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'past_due', label: 'Past Due' },
    { value: 'canceled', label: 'Canceled' },
];

// Spec §4.18 tones, plus the §1.7 canonical tones for the statuses this list
// actually filters on (past_due, canceled) so they don't fall through to neutral.
const STATUS_TONES = {
    active: 'success',
    pending: 'info',
    revoked: 'neutral',
    suspended: 'neutral',
    past_due: 'danger',
    canceled: 'accent',
};

const COLUMNS = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'clients', label: 'Clients' },
    { key: 'stripe', label: 'Stripe' },
    { key: 'created', label: 'Created' },
];

const CoachListPage = () => {
    const [coaches, setCoaches] = useState([]);
    const [pendingTokens, setPendingTokens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [hasMore, setHasMore] = useState(false);
    const [lastDocId, setLastDocId] = useState(null);
    const [pageHistory, setPageHistory] = useState([]);

    // Provision modal state
    const [showProvisionModal, setShowProvisionModal] = useState(false);
    const [provisionEmail, setProvisionEmail] = useState('');
    const [provisionLoading, setProvisionLoading] = useState(false);
    const [provisionResult, setProvisionResult] = useState(null);
    const [provisionError, setProvisionError] = useState(null);

    // Copy feedback
    const [copiedId, setCopiedId] = useState(null);

    const fetchCoaches = useCallback(async (startAfterDocId = null, isNewSearch = false) => {
        setLoading(true);
        setError(null);
        try {
            const fn = httpsCallable(functions, 'adminGetCoaches');
            const result = await fn({
                status: statusFilter,
                pageSize: 25,
                startAfterDocId,
            });
            if (result.data.success) {
                setCoaches(result.data.coaches);
                setHasMore(result.data.hasMore);
                setLastDocId(result.data.lastDocId);
                if (result.data.pendingTokens) {
                    setPendingTokens(result.data.pendingTokens);
                }
                if (isNewSearch) setPageHistory([]);
            }
        } catch (err) {
            console.error('[CoachListPage] Error:', err);
            setError(err.message || 'Failed to fetch coaches');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchCoaches(null, true);
    }, []);

    const handleApply = () => fetchCoaches(null, true);

    const handleNextPage = () => {
        if (hasMore && lastDocId) {
            setPageHistory(prev => [...prev, coaches[0]?.id || null]);
            fetchCoaches(lastDocId);
        }
    };

    const handlePrevPage = () => {
        if (pageHistory.length > 0) {
            const newHistory = [...pageHistory];
            newHistory.pop();
            setPageHistory(newHistory);
            fetchCoaches(newHistory.length > 0 ? newHistory[newHistory.length - 1] : null);
        }
    };

    const handleProvision = async () => {
        if (!provisionEmail.trim()) return;
        setProvisionLoading(true);
        setProvisionError(null);
        setProvisionResult(null);
        try {
            const fn = httpsCallable(functions, 'provisionCoach');
            const result = await fn({ email: provisionEmail.trim() });
            if (result.data.success) {
                setProvisionResult(result.data);
                // Refresh list to show new pending token
                fetchCoaches(null, true);
            }
        } catch (err) {
            console.error('[CoachListPage] Provision error:', err);
            setProvisionError(err.message || 'Failed to provision coach');
        } finally {
            setProvisionLoading(false);
        }
    };

    const getSignupUrl = (token) => {
        return `${window.location.origin}/coach/signup/${token}`;
    };

    const handleCopy = async (text, id) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            // Fallback: select text
        }
    };

    const closeModal = () => {
        setShowProvisionModal(false);
        setProvisionEmail('');
        setProvisionResult(null);
        setProvisionError(null);
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
        <AdminBadge tone={STATUS_TONES[status] || 'neutral'}>{status || 'unknown'}</AdminBadge>
    );

    return (
        <AdminPage
            eyebrow="Partners"
            title="Coaches"
            actions={
                <AdminButton variant="primary" icon={faPlus} onClick={() => setShowProvisionModal(true)}>
                    Provision Coach
                </AdminButton>
            }
        >
            {/* Pending Tokens */}
            {pendingTokens.length > 0 && (
                <AdminAlert
                    tone="warning"
                    icon={faTicketAlt}
                    title={`Pending Invites (${pendingTokens.length})`}
                >
                    <div className="space-y-2 mt-2">
                        {pendingTokens.map((t) => (
                            <div
                                key={t.token}
                                className="flex items-center justify-between gap-3 bg-theme-bg-elevated border border-theme-line rounded-lab px-3 py-2"
                            >
                                <div className="min-w-0">
                                    <span className="text-sm text-theme-text truncate">{t.email}</span>
                                    <span className="text-[0.6875rem] text-theme-text-muted ml-2">{formatDate(t.createdAt)}</span>
                                </div>
                                <AdminButton
                                    variant="ghost"
                                    size="sm"
                                    icon={copiedId === t.token ? faCheck : faCopy}
                                    onClick={() => handleCopy(getSignupUrl(t.token), t.token)}
                                >
                                    {copiedId === t.token ? 'Copied' : 'Copy URL'}
                                </AdminButton>
                            </div>
                        ))}
                    </div>
                </AdminAlert>
            )}

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
                    <AdminButton variant="primary" icon={faFilter} disabled={loading} onClick={handleApply}>
                        Apply
                    </AdminButton>
                </div>
            </AdminCard>

            {/* Error */}
            {error && <AdminAlert tone="error">{error}</AdminAlert>}

            {/* Coach List */}
            <AdminCard variant="panel" flush>
                {loading ? (
                    <div className="py-16">
                        <LoadingSpinner theme="auto" message="Loading coaches" />
                    </div>
                ) : coaches.length === 0 ? (
                    <AdminEmptyState
                        icon={faUserTie}
                        title="No coaches found"
                        hint="Adjust the status filter to widen the search"
                    />
                ) : (
                    <>
                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y divide-theme-line/50">
                            {coaches.map((c) => (
                                <div key={c.id} className="p-4">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="font-medium text-theme-text truncate">{c.displayName || 'Unnamed'}</span>
                                        {getStatusBadge(c.status)}
                                    </div>
                                    <div className="text-[0.6875rem] font-mono text-theme-text-muted mb-2 truncate">{c.email}</div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-theme-text-muted font-mono text-[0.6875rem] uppercase tracking-wider">Type</span>{' '}
                                            <span className="text-theme-text font-mono">{c.practiceType || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-theme-text-muted font-mono text-[0.6875rem] uppercase tracking-wider">Clients</span>{' '}
                                            <span className="text-theme-text font-mono">{c.activeClients}/{c.seatsPurchased}</span>
                                        </div>
                                        <div>
                                            <span className="text-theme-text-muted font-mono text-[0.6875rem] uppercase tracking-wider">Created</span>{' '}
                                            <span className="text-theme-text font-mono">{formatDate(c.createdAt)}</span>
                                        </div>
                                        {c.stripeCoachSubscriptionId && (
                                            <div>
                                                <a
                                                    href={`https://dashboard.stripe.com/subscriptions/${c.stripeCoachSubscriptionId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`text-xs font-mono ${LINK}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    Stripe <FontAwesomeIcon icon={faExternalLinkAlt} className="h-3 w-3 ml-0.5" />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block">
                            <AdminTable columns={COLUMNS}>
                                {coaches.map((c) => (
                                    <AdminTr key={c.id}>
                                        <AdminTd className="whitespace-nowrap font-medium">
                                            {c.displayName || 'Unnamed'}
                                        </AdminTd>
                                        <AdminTd mono muted className="whitespace-nowrap">{c.email}</AdminTd>
                                        <AdminTd mono className="whitespace-nowrap">{c.practiceType || '—'}</AdminTd>
                                        <AdminTd className="whitespace-nowrap">{getStatusBadge(c.status)}</AdminTd>
                                        <AdminTd mono className="whitespace-nowrap">
                                            {c.activeClients}/{c.seatsPurchased}
                                        </AdminTd>
                                        <AdminTd mono className="whitespace-nowrap">
                                            {c.stripeCoachSubscriptionId ? (
                                                <a
                                                    href={`https://dashboard.stripe.com/subscriptions/${c.stripeCoachSubscriptionId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={LINK}
                                                    title={c.stripeCoachSubscriptionId}
                                                >
                                                    {c.stripeCoachSubscriptionId.slice(0, 16)}...
                                                    <FontAwesomeIcon icon={faExternalLinkAlt} className="h-3 w-3 ml-1" />
                                                </a>
                                            ) : '—'}
                                        </AdminTd>
                                        <AdminTd mono muted className="whitespace-nowrap">{formatDate(c.createdAt)}</AdminTd>
                                    </AdminTr>
                                ))}
                            </AdminTable>
                        </div>
                    </>
                )}

                {/* Pagination */}
                {!loading && coaches.length > 0 && (
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

            {/* Provision Coach Modal */}
            {showProvisionModal && (
                <AdminModal size="sm" title="Provision Coach" onClose={closeModal}>
                    <div className="space-y-4">
                        {!provisionResult ? (
                            <>
                                <div>
                                    <label className={LABEL}>Coach Email</label>
                                    <input
                                        type="email"
                                        value={provisionEmail}
                                        onChange={(e) => setProvisionEmail(e.target.value)}
                                        placeholder="coach@example.com"
                                        className={INPUT}
                                        onKeyDown={(e) => e.key === 'Enter' && handleProvision()}
                                    />
                                </div>
                                {provisionError && <AdminAlert tone="error">{provisionError}</AdminAlert>}
                                <div className="flex justify-end gap-3">
                                    <AdminButton variant="ghost" onClick={closeModal}>Cancel</AdminButton>
                                    <AdminButton
                                        variant="primary"
                                        loading={provisionLoading}
                                        disabled={!provisionEmail.trim()}
                                        onClick={handleProvision}
                                    >
                                        Provision
                                    </AdminButton>
                                </div>
                            </>
                        ) : (
                            <>
                                <AdminAlert tone="success">
                                    Coach provisioned successfully for <strong>{provisionEmail}</strong>
                                </AdminAlert>
                                <div>
                                    <label className={LABEL}>Signup URL</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={getSignupUrl(provisionResult.token)}
                                            className={`${INPUT} bg-theme-bg-surface`}
                                        />
                                        <AdminButton
                                            variant="primary"
                                            icon={copiedId === 'provision' ? faCheck : faCopy}
                                            className="flex-shrink-0"
                                            title="Copy signup URL"
                                            onClick={() => handleCopy(getSignupUrl(provisionResult.token), 'provision')}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3">
                                    <AdminButton variant="ghost" onClick={closeModal}>Done</AdminButton>
                                    <AdminButton
                                        variant="primary"
                                        onClick={() => {
                                            setProvisionEmail('');
                                            setProvisionResult(null);
                                            setProvisionError(null);
                                        }}
                                    >
                                        Provision Another
                                    </AdminButton>
                                </div>
                            </>
                        )}
                    </div>
                </AdminModal>
            )}
        </AdminPage>
    );
};

export default CoachListPage;

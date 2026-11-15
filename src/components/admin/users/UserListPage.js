/* src/components/admin/users/UserListPage.js */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebaseConfig';
import { formatCombinedDifficulty } from '../../../contexts/gameHelpers';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch,
    faFilter,
    faChevronLeft,
    faChevronRight,
    faUser
} from '@fortawesome/free-solid-svg-icons';
import LoadingSpinner from '../../ui/LoadingSpinner';
import AdminPage from '../ui/AdminPage';
import AdminCard from '../ui/AdminCard';
import AdminAlert from '../ui/AdminAlert';
import AdminBadge from '../ui/AdminBadge';
import AdminButton from '../ui/AdminButton';
import AdminEmptyState from '../ui/AdminEmptyState';
import { AdminTable, AdminTr, AdminTd } from '../ui/AdminTable';
import { INPUT, SELECT, LABEL, AVATAR } from '../ui/adminStyles';

// Canonical status -> AdminBadge tone map (see adminStyles/AdminBadge docs)
const STATUS_TONES = {
    active: 'success',
    trialing: 'info',
    canceled: 'accent',
    inactive: 'neutral',
    past_due: 'danger',
};

const USER_COLUMNS = [
    { key: 'user', label: 'User' },
    { key: 'tier', label: 'Tier' },
    { key: 'status', label: 'Status' },
    { key: 'level', label: 'Level' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'lastLogin', label: 'Last Login' },
    { key: 'joined', label: 'Joined' },
];

const UserListPage = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Search and filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [tierFilter, setTierFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [minSessions, setMinSessions] = useState('');

    // Pagination state
    const [hasMore, setHasMore] = useState(false);
    const [lastDocId, setLastDocId] = useState(null);
    const [pageHistory, setPageHistory] = useState([]); // Stack of lastDocIds for previous pages

    const fetchUsers = useCallback(async (startAfterDocId = null, isNewSearch = false) => {
        setLoading(true);
        setError(null);

        try {
            const adminGetUsers = httpsCallable(functions, 'adminGetUsers');
            const result = await adminGetUsers({
                searchTerm,
                tier: tierFilter,
                status: statusFilter,
                minSessions: minSessions ? parseInt(minSessions, 10) : null,
                pageSize: 25,
                startAfterDocId,
            });

            if (result.data.success) {
                setUsers(result.data.users);
                setHasMore(result.data.hasMore);
                setLastDocId(result.data.lastDocId);

                if (isNewSearch) {
                    setPageHistory([]);
                }
            }
        } catch (err) {
            console.error('[UserListPage] Error fetching users:', err);
            setError(err.message || 'Failed to fetch users');
        } finally {
            setLoading(false);
        }
    }, [searchTerm, tierFilter, statusFilter, minSessions]);

    // Initial fetch
    useEffect(() => {
        fetchUsers(null, true);
    }, []);

    // Handle search/filter change
    const handleSearch = () => {
        fetchUsers(null, true);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    // Pagination handlers
    const handleNextPage = () => {
        if (hasMore && lastDocId) {
            setPageHistory(prev => [...prev, users[0]?.id || null]);
            fetchUsers(lastDocId);
        }
    };

    const handlePrevPage = () => {
        if (pageHistory.length > 0) {
            const newHistory = [...pageHistory];
            const prevStartDocId = newHistory.pop();
            setPageHistory(newHistory);
            // Go back to previous page
            fetchUsers(newHistory.length > 0 ? newHistory[newHistory.length - 1] : null);
        }
    };

    const handleUserClick = (userId) => {
        navigate(`/admin/users/${userId}`);
    };

    // Format date for display
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        } catch {
            return 'N/A';
        }
    };

    // Format date and time for display
    const formatDateTime = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            const dateStr = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
            const timeStr = date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            });
            return `${dateStr}, ${timeStr}`;
        } catch {
            return 'N/A';
        }
    };

    // Format N.DD level display
    const formatLevel = (nBack, difficulty) => {
        return formatCombinedDifficulty(nBack ?? 2, difficulty ?? 0);
    };

    // Get tier badge
    const getTierBadge = (tier) => (
        <AdminBadge tone={tier === 'premium' ? 'accent' : 'neutral'}>
            {tier === 'premium' ? 'Premium' : 'Free'}
        </AdminBadge>
    );

    // Get status badge
    const getStatusBadge = (status) => (
        <AdminBadge tone={STATUS_TONES[status] || STATUS_TONES.inactive}>
            {status || 'inactive'}
        </AdminBadge>
    );

    return (
        <AdminPage
            eyebrow="Directory"
            title="Users"
            actions={<span className="text-xs font-mono text-theme-text-muted">{users.length} shown</span>}
        >
            {/* Search and Filters */}
            <AdminCard variant="panel">
                <div className="flex flex-col gap-4">
                    {/* Search Row */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Search Input */}
                        <div className="flex-1">
                            <div className="relative">
                                <FontAwesomeIcon
                                    icon={faSearch}
                                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-text-muted h-4 w-4 pointer-events-none z-10"
                                />
                                <input
                                    type="text"
                                    placeholder="Search by email or name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    className={`${INPUT} pl-10`}
                                />
                            </div>
                        </div>

                        {/* Search Button */}
                        <AdminButton
                            variant="primary"
                            icon={faFilter}
                            onClick={handleSearch}
                            disabled={loading}
                            className="sm:w-auto"
                        >
                            Apply
                        </AdminButton>
                    </div>

                    {/* Filters Row */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Tier Filter */}
                        <div className="w-full sm:w-auto">
                            <label className={LABEL}>Tier</label>
                            <select
                                value={tierFilter}
                                onChange={(e) => setTierFilter(e.target.value)}
                                className={`${SELECT} sm:w-32`}
                            >
                                <option value="all">All</option>
                                <option value="free">Free</option>
                                <option value="premium">Premium</option>
                            </select>
                        </div>

                        {/* Status Filter */}
                        <div className="w-full sm:w-auto">
                            <label className={LABEL}>Status</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className={`${SELECT} sm:w-32`}
                            >
                                <option value="all">All</option>
                                <option value="active">Active</option>
                                <option value="trialing">Trialing</option>
                                <option value="canceled">Canceled</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        {/* Min Sessions Filter */}
                        <div className="w-full sm:w-auto">
                            <label className={LABEL}>Min Sessions</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={minSessions}
                                onChange={(e) => setMinSessions(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className={`${INPUT} sm:w-24`}
                            />
                        </div>
                    </div>
                </div>
            </AdminCard>

            {/* Error State */}
            {error && <AdminAlert tone="error">{error}</AdminAlert>}

            {/* Users List */}
            <AdminCard variant="panel" flush>
                {loading ? (
                    <div className="py-16">
                        <LoadingSpinner message="Loading users" theme="auto" />
                    </div>
                ) : users.length === 0 ? (
                    <AdminEmptyState
                        icon={faUser}
                        title="No users found"
                        hint="Adjust filters to widen the search"
                    />
                ) : (
                    <>
                        {/* Mobile Card Layout */}
                        <div className="md:hidden divide-y divide-theme-line/50">
                            {users.map((user) => (
                                <div
                                    key={user.id}
                                    onClick={() => handleUserClick(user.id)}
                                    className="p-4 hover:bg-theme-bg-elevated cursor-pointer transition-colors"
                                >
                                    {/* User Info Row */}
                                    <div className="flex items-center mb-3">
                                        <div className={`h-10 w-10 ${AVATAR} text-sm`}>
                                            {(user.email || user.displayName || '?')[0].toUpperCase()}
                                        </div>
                                        <div className="ml-3 flex-1 min-w-0">
                                            <div className="text-sm text-theme-text truncate">
                                                {user.displayName || 'No name'}
                                            </div>
                                            <div className="text-xs font-mono text-theme-text-secondary truncate">
                                                {user.email || 'No email'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Badges Row */}
                                    <div className="flex items-center gap-2 mb-3">
                                        {getTierBadge(user.subscriptionTier)}
                                        {getStatusBadge(user.subscriptionStatus)}
                                    </div>

                                    {/* Stats Row */}
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-theme-text-muted font-mono text-[0.6875rem] uppercase tracking-wider">Level</span>{' '}
                                            <span className="font-mono text-theme-text">{formatLevel(user.currentNBack, user.currentDifficulty)}</span>
                                        </div>
                                        <div>
                                            <span className="text-theme-text-muted font-mono text-[0.6875rem] uppercase tracking-wider">Sessions</span>{' '}
                                            <span className="font-mono text-theme-text">{user.totalSessions ?? 0}</span>
                                        </div>
                                        <div>
                                            <span className="text-theme-text-muted font-mono text-[0.6875rem] uppercase tracking-wider">Last login</span>{' '}
                                            <span className="font-mono text-theme-text">{formatDate(user.lastLoginAt)}</span>
                                        </div>
                                        <div>
                                            <span className="text-theme-text-muted font-mono text-[0.6875rem] uppercase tracking-wider">Joined</span>{' '}
                                            <span className="font-mono text-theme-text">{formatDate(user.createdAt)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table Layout */}
                        <div className="hidden md:block">
                            <AdminTable columns={USER_COLUMNS} minWidth="min-w-full">
                                {users.map((user) => (
                                    <AdminTr key={user.id} onClick={() => handleUserClick(user.id)}>
                                        <AdminTd className="whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className={`h-10 w-10 ${AVATAR} text-sm`}>
                                                    {(user.email || user.displayName || '?')[0].toUpperCase()}
                                                </div>
                                                <div className="ml-4 min-w-0">
                                                    <div className="text-sm text-theme-text truncate">
                                                        {user.displayName || 'No name'}
                                                    </div>
                                                    <div className="text-xs font-mono text-theme-text-secondary truncate">
                                                        {user.email || 'No email'}
                                                    </div>
                                                </div>
                                            </div>
                                        </AdminTd>
                                        <AdminTd className="whitespace-nowrap">
                                            {getTierBadge(user.subscriptionTier)}
                                        </AdminTd>
                                        <AdminTd className="whitespace-nowrap">
                                            {getStatusBadge(user.subscriptionStatus)}
                                        </AdminTd>
                                        <AdminTd mono className="whitespace-nowrap">
                                            {formatLevel(user.currentNBack, user.currentDifficulty)}
                                        </AdminTd>
                                        <AdminTd mono className="whitespace-nowrap">
                                            {user.totalSessions ?? 0}
                                        </AdminTd>
                                        <AdminTd mono muted className="whitespace-nowrap">
                                            {formatDate(user.lastLoginAt)}
                                        </AdminTd>
                                        <AdminTd mono muted className="whitespace-nowrap">
                                            {formatDateTime(user.createdAt)}
                                        </AdminTd>
                                    </AdminTr>
                                ))}
                            </AdminTable>
                        </div>
                    </>
                )}

                {/* Pagination */}
                {!loading && users.length > 0 && (
                    <div className="bg-theme-bg-elevated px-4 py-3 flex items-center justify-between border-t border-theme-line">
                        <AdminButton
                            variant="secondary"
                            size="sm"
                            icon={faChevronLeft}
                            onClick={handlePrevPage}
                            disabled={pageHistory.length === 0}
                        >
                            Previous
                        </AdminButton>
                        <span className="text-xs font-mono text-theme-text-muted">
                            Page {pageHistory.length + 1}
                        </span>
                        <AdminButton
                            variant="secondary"
                            size="sm"
                            iconRight={faChevronRight}
                            onClick={handleNextPage}
                            disabled={!hasMore}
                        >
                            Next
                        </AdminButton>
                    </div>
                )}
            </AdminCard>
        </AdminPage>
    );
};

export default UserListPage;

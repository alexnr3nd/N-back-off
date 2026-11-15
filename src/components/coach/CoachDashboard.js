/* src/components/coach/CoachDashboard.js */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCoach } from '../../contexts/CoachContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import ClientTable from './ClientTable';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faChartLine, faChair, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

const CoachDashboard = () => {
    const navigate = useNavigate();
    const { coachData, clients, isLoading, error, pagination, fetchDashboard, dismissClient } = useCoach();
    const [dismissingId, setDismissingId] = useState(null);

    // Derived stats
    const activeClients = useMemo(() => clients.filter(c => c.status === 'active'), [clients]);
    const activeToday = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return activeClients.filter(c => {
            if (!c.lastLoginAt) return false;
            return c.lastLoginAt.split('T')[0] === today;
        }).length;
    }, [activeClients]);

    const handleDismiss = async (clientUid) => {
        if (!confirm('Remove this client from your roster? They will lose coach-provided premium access.')) return;
        setDismissingId(clientUid);
        try {
            await dismissClient(clientUid);
        } catch (err) {
            alert(err.message || 'Failed to dismiss client.');
        } finally {
            setDismissingId(null);
        }
    };

    if (isLoading && !coachData) {
        return <LoadingSpinner message="Loading dashboard..." />;
    }

    if (error) {
        return (
            <div className="bg-neural-synapse/10 border border-neural-synapse/30 p-4 text-sm font-mono text-neural-synapse">
                {error}
            </div>
        );
    }

    const seatsUsed = coachData?.seatsUsed || 0;
    const seatsPurchased = coachData?.seatsPurchased || 0;

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <p className="text-xs font-mono uppercase tracking-[0.2em] text-theme-text-muted mb-1">
                    Coach Portal
                </p>
                <h1 className="text-2xl font-serif italic text-theme-text">
                    Client Dashboard
                </h1>
            </div>

            {/* Summary Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-theme-bg-secondary border border-theme-line p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <FontAwesomeIcon icon={faUsers} className="w-4 h-4 text-theme-text-muted" />
                        <span className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">
                            Total Clients
                        </span>
                    </div>
                    <p className="text-2xl font-mono text-theme-text">{activeClients.length}</p>
                </div>

                <div className="bg-theme-bg-secondary border border-theme-line p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <FontAwesomeIcon icon={faChartLine} className="w-4 h-4 text-theme-text-muted" />
                        <span className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">
                            Active Today
                        </span>
                    </div>
                    <p className="text-2xl font-mono text-theme-text">{activeToday}</p>
                </div>

                <div className="bg-theme-bg-secondary border border-theme-line p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <FontAwesomeIcon icon={faChair} className="w-4 h-4 text-theme-text-muted" />
                        <span className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">
                            Seats
                        </span>
                    </div>
                    <p className="text-2xl font-mono text-theme-text">
                        {seatsUsed}
                        {seatsPurchased > 0 && <span className="text-theme-text-muted text-base"> / {seatsPurchased}</span>}
                    </p>
                    {seatsPurchased === 0 && (
                        <p className="text-xs font-mono text-theme-accent mt-1">
                            <FontAwesomeIcon icon={faTriangleExclamation} className="w-3 h-3 mr-1" />
                            No subscription yet
                        </p>
                    )}
                </div>
            </div>

            {/* Client Table */}
            <div className="bg-theme-bg-secondary border border-theme-line">
                <div className="border-b border-theme-line px-4 py-3">
                    <h2 className="text-sm font-mono uppercase tracking-wider text-theme-text-muted">
                        Client Roster
                    </h2>
                </div>
                <ClientTable
                    clients={clients}
                    onClientClick={(uid) => navigate(`/coach/clients/${uid}`)}
                    onDismiss={handleDismiss}
                    dismissingId={dismissingId}
                />
            </div>

            {/* Pagination */}
            {pagination.hasMore && (
                <div className="mt-4 text-center">
                    <button
                        onClick={() => fetchDashboard(pagination.page + 1, pagination.pageSize)}
                        className="px-4 py-2 text-xs font-mono uppercase tracking-wider text-theme-text-secondary border border-theme-line hover:border-warm-muted transition-colors"
                    >
                        Load More
                    </button>
                </div>
            )}
        </div>
    );
};

export default CoachDashboard;

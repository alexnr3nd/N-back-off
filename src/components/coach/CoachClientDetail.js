/* src/components/coach/CoachClientDetail.js */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCoach } from '../../contexts/CoachContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import ClientStatusCard from './ClientStatusCard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

const CoachClientDetail = () => {
    const { clientId } = useParams();
    const { fetchClientDetail } = useCoach();
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const result = await fetchClientDetail(clientId);
                if (isMountedRef.current) setData(result);
            } catch (err) {
                if (isMountedRef.current) setError(err.message || 'Failed to load client data.');
            } finally {
                if (isMountedRef.current) setIsLoading(false);
            }
        };
        load();
    }, [clientId, fetchClientDetail]);

    if (isLoading) {
        return <LoadingSpinner message="Loading client data..." />;
    }

    if (error) {
        return (
            <div>
                <Link to="/coach/dashboard" className="inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-accent transition-colors mb-4">
                    <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
                    <span className="text-xs font-mono uppercase tracking-wider">Back to Dashboard</span>
                </Link>
                <div className="bg-neural-synapse/10 border border-neural-synapse/30 p-4 text-sm font-mono text-neural-synapse">
                    {error}
                </div>
            </div>
        );
    }

    const { client, status, sessions, dailyStats } = data;

    return (
        <div className="max-w-6xl mx-auto">
            {/* Back link */}
            <Link to="/coach/dashboard" className="inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-accent transition-colors mb-6">
                <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
                <span className="text-xs font-mono uppercase tracking-wider">Back to Dashboard</span>
            </Link>

            {/* Header */}
            <div className="mb-6">
                <p className="text-xs font-mono uppercase tracking-[0.2em] text-theme-text-muted mb-1">
                    Client Detail
                </p>
                <h1 className="text-2xl font-serif italic text-theme-text">
                    {client.displayName}
                </h1>
                {client.joinedAt && (
                    <p className="text-xs font-mono text-theme-text-muted mt-1">
                        Joined {new Date(client.joinedAt).toLocaleDateString()}
                    </p>
                )}
            </div>

            {/* Status Card */}
            <div className="mb-8">
                <ClientStatusCard client={client} status={status} />
            </div>

            {/* Session History */}
            <div className="bg-theme-bg-secondary border border-theme-line mb-8">
                <div className="border-b border-theme-line px-4 py-3">
                    <h2 className="text-sm font-mono uppercase tracking-wider text-theme-text-muted">
                        Recent Sessions
                    </h2>
                </div>
                {sessions && sessions.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-theme-line text-left">
                                    <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-theme-text-muted font-normal">Date</th>
                                    <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-theme-text-muted font-normal">N-Back</th>
                                    <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-theme-text-muted font-normal">D-prime</th>
                                    <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-theme-text-muted font-normal hidden sm:table-cell">Position</th>
                                    <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-theme-text-muted font-normal hidden sm:table-cell">Audio</th>
                                    <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-theme-text-muted font-normal hidden md:table-cell">Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map((session) => (
                                    <tr key={session.id} className="border-b border-theme-line/50">
                                        <td className="px-4 py-3 font-mono text-theme-text text-xs">
                                            {session.timestamp ? new Date(session.timestamp).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-theme-text">
                                            {session.nBack}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-theme-text">
                                            {session.overallDprime != null ? session.overallDprime.toFixed(2) : '—'}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-theme-text hidden sm:table-cell">
                                            {session.visualAccuracy != null ? `${Math.round(session.visualAccuracy)}%` : '—'}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-theme-text hidden sm:table-cell">
                                            {session.audioAccuracy != null ? `${Math.round(session.audioAccuracy)}%` : '—'}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-theme-text-muted hidden md:table-cell">
                                            {session.durationMs ? `${Math.round(session.durationMs / 1000)}s` : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="px-4 py-8 text-center text-sm text-theme-text-muted font-mono">
                        No sessions recorded yet.
                    </div>
                )}
            </div>

            {/* Weekly Activity */}
            <div className="bg-theme-bg-secondary border border-theme-line">
                <div className="border-b border-theme-line px-4 py-3">
                    <h2 className="text-sm font-mono uppercase tracking-wider text-theme-text-muted">
                        Daily Activity (Last 30 Days)
                    </h2>
                </div>
                <div className="p-4">
                    {dailyStats && dailyStats.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {dailyStats.map((day) => {
                                const count = day.sessionCount || 0;
                                let bg = 'bg-theme-bg border-theme-line';
                                if (count >= 5) bg = 'bg-neural-dendrite/60 border-neural-dendrite/40';
                                else if (count >= 3) bg = 'bg-neural-dendrite/40 border-neural-dendrite/30';
                                else if (count >= 1) bg = 'bg-neural-dendrite/20 border-neural-dendrite/20';
                                return (
                                    <div
                                        key={day.date}
                                        className={`w-6 h-6 border ${bg} flex items-center justify-center`}
                                        title={`${day.date}: ${count} sessions`}
                                    >
                                        <span className="text-[0.5625rem] font-mono text-theme-text-muted">
                                            {count > 0 ? count : ''}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-theme-text-muted font-mono text-center py-4">
                            No daily stats available.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CoachClientDetail;

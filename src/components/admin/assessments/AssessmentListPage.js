/* src/components/admin/assessments/AssessmentListPage.js */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebaseConfig';
import { faRefresh, faUsers, faClipboardCheck, faFlask, faCalendarWeek } from '@fortawesome/free-solid-svg-icons';
import {
    getAssessmentLabel,
    getAssessmentScoreDisplay,
    getAssessmentSecondaryDisplay,
    isAssessmentFlagged,
} from './assessmentDisplay';
import LoadingSpinner from '../../ui/LoadingSpinner';
import AdminPage from '../ui/AdminPage';
import AdminCard from '../ui/AdminCard';
import AdminButton from '../ui/AdminButton';
import AdminBadge from '../ui/AdminBadge';
import AdminAlert from '../ui/AdminAlert';
import AdminMetricCard from '../ui/AdminMetricCard';
import AdminEmptyState from '../ui/AdminEmptyState';
import { AdminTable, AdminTr, AdminTd } from '../ui/AdminTable';
import { SELECT, LINK } from '../ui/adminStyles';

const FILTER_TABS = [
    { key: 'all', label: 'All' },
    { key: 'familiarization', label: 'Familiarization' },
    { key: 'official', label: 'Official' },
];

const COLUMNS = [
    { key: 'date', label: 'Date' },
    { key: 'user', label: 'User' },
    { key: 'assessment', label: 'Assessment' },
    { key: 'type', label: 'Type' },
    { key: 'score', label: 'Score' },
    { key: 'flagged', label: 'Flagged' },
];

const AssessmentListPage = () => {
    const [assessments, setAssessments] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeFilter, setActiveFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const adminGetAssessmentsFn = httpsCallable(functions, 'adminGetAssessments');
            const adminGetAssessmentStatsFn = httpsCallable(functions, 'adminGetAssessmentStats');

            const [assessmentsResult, statsResult] = await Promise.all([
                adminGetAssessmentsFn(),
                adminGetAssessmentStatsFn(),
            ]);

            if (assessmentsResult.data.success) {
                setAssessments(assessmentsResult.data.assessments);
            }
            if (statsResult.data.success) {
                setStats(statsResult.data.stats);
            }
        } catch (err) {
            console.error('[AssessmentListPage] Error fetching data:', err);
            setError(err.message || 'Failed to fetch assessments');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        try {
            return new Date(timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            });
        } catch {
            return 'N/A';
        }
    };

    // Unique test types present in the data (covers future types automatically)
    const typeOptions = useMemo(() => {
        const map = new Map();
        for (const a of assessments) {
            const key = a.testType || 'unknown';
            if (!map.has(key)) map.set(key, getAssessmentLabel(a));
        }
        return [...map.entries()].sort((x, y) => x[1].localeCompare(y[1]));
    }, [assessments]);

    const filteredAssessments = assessments.filter((a) => {
        if (activeFilter === 'familiarization' && a.familiarizationSession !== true) return false;
        if (activeFilter === 'official' && a.familiarizationSession === true) return false;
        if (typeFilter !== 'all' && (a.testType || 'unknown') !== typeFilter) return false;
        return true;
    });

    return (
        <AdminPage
            eyebrow="Measurement"
            title="Assessments"
            actions={
                <AdminButton
                    variant="ghost"
                    size="sm"
                    icon={faRefresh}
                    loading={loading}
                    title="Refresh"
                    onClick={fetchData}
                />
            }
        >
            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <AdminMetricCard
                        icon={faUsers}
                        tone="neutral"
                        title="Users w/ Assessments"
                        value={stats.totalUsers ?? 0}
                    />
                    <AdminMetricCard
                        icon={faFlask}
                        tone="accent"
                        title="Familiarizations"
                        value={stats.totalFamiliarizations ?? 0}
                    />
                    <AdminMetricCard
                        icon={faClipboardCheck}
                        tone="success"
                        title="Official Tests"
                        value={stats.totalOfficial ?? stats.totalOfficials ?? 0}
                    />
                    <AdminMetricCard
                        icon={faCalendarWeek}
                        tone="info"
                        title="Last 7 Days"
                        value={stats.recentCount ?? 0}
                    />
                </div>
            )}

            {error && <AdminAlert tone="error">{error}</AdminAlert>}

            <AdminCard variant="panel" flush>
                <div className="border-b border-theme-line px-4 pt-4 pb-0 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex space-x-4">
                        {FILTER_TABS.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveFilter(tab.key)}
                                className={`pb-3 px-1 text-xs font-mono uppercase tracking-wider border-b-2 transition-colors ${
                                    activeFilter === tab.key
                                        ? 'border-theme-accent text-theme-accent'
                                        : 'border-transparent text-theme-text-muted hover:text-theme-text hover:border-theme-line'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="mb-3 w-full sm:w-56">
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className={SELECT}
                        >
                            <option value="all">All assessments</option>
                            {typeOptions.map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="py-16">
                        <LoadingSpinner theme="auto" message="Loading assessments" />
                    </div>
                ) : filteredAssessments.length === 0 ? (
                    <AdminEmptyState icon={faClipboardCheck} title="No assessments found" />
                ) : (
                    <AdminTable columns={COLUMNS}>
                        {filteredAssessments.map((a) => {
                            const isFamil = a.familiarizationSession === true;
                            const scoreDisplay = getAssessmentScoreDisplay(a);
                            const secondaryDisplay = getAssessmentSecondaryDisplay(a);

                            return (
                                <AdminTr key={a.id}>
                                    <AdminTd mono muted className="whitespace-nowrap">
                                        {formatDate(a.timestamp)}
                                    </AdminTd>
                                    <AdminTd className="whitespace-nowrap">
                                        <Link
                                            to={`/admin/users/${a.userId}`}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className={`text-sm ${LINK}`}>
                                                {a.displayName || 'No name'}
                                            </div>
                                            <div className="text-[0.6875rem] font-mono text-theme-text-muted">
                                                {a.email || 'No email'}
                                            </div>
                                        </Link>
                                    </AdminTd>
                                    <AdminTd className="whitespace-nowrap">
                                        <AdminBadge tone="neutral">{getAssessmentLabel(a)}</AdminBadge>
                                    </AdminTd>
                                    <AdminTd className="whitespace-nowrap">
                                        {isFamil ? (
                                            <AdminBadge tone="accent">Familiarization</AdminBadge>
                                        ) : (
                                            <AdminBadge tone="success">Official</AdminBadge>
                                        )}
                                    </AdminTd>
                                    <AdminTd className="whitespace-nowrap">
                                        <div className="text-sm font-mono text-theme-text">
                                            {scoreDisplay || <span className="text-theme-text-muted">{'—'}</span>}
                                        </div>
                                        {secondaryDisplay && (
                                            <div className="text-[0.6875rem] font-mono text-theme-text-muted">{secondaryDisplay}</div>
                                        )}
                                    </AdminTd>
                                    <AdminTd className="whitespace-nowrap text-sm">
                                        {isAssessmentFlagged(a) ? (
                                            <span className="text-neural-synapse" title="Flagged (low accuracy / validity / at chance)">
                                                {'⚠'}
                                            </span>
                                        ) : null}
                                    </AdminTd>
                                </AdminTr>
                            );
                        })}
                    </AdminTable>
                )}
            </AdminCard>
        </AdminPage>
    );
};

export default AssessmentListPage;

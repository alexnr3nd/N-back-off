/* src/components/admin/analytics/ChurnMetricsCard.js */

/**
 * Overview-tab widget: 6-month paid-subscriber churn plus the trial funnel,
 * from adminGetChurnMetrics (a replay of every subscriptionEvents timeline).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebaseConfig';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRefresh, faCreditCard, faHourglassHalf, faCircleInfo, faUserClock } from '@fortawesome/free-solid-svg-icons';
import LoadingSpinner from '../../ui/LoadingSpinner';
import AdminCard from '../ui/AdminCard';
import AdminAlert from '../ui/AdminAlert';
import AdminButton from '../ui/AdminButton';
import AdminEmptyState from '../ui/AdminEmptyState';
import { AdminTable, AdminTr, AdminTd } from '../ui/AdminTable';

const COLUMNS = [
    { key: 'month', label: 'Month' },
    { key: 'gained', label: 'Gained', align: 'right' },
    { key: 'lost', label: 'Lost', align: 'right' },
    // Cancel decisions made this month; the paid period (and the Lost entry) ends later.
    { key: 'canceling', label: 'Canceling', align: 'right' },
    { key: 'churn', label: 'Churn', align: 'right' },
    { key: 'active', label: 'Active', align: 'right' },
];

// Churn is monthly, so double digits is already a bad month.
const churnColor = (pct) => {
    if (pct === null || pct === undefined) return 'text-theme-text-muted';
    if (pct >= 15) return 'text-neural-synapse';
    if (pct >= 5) return 'text-theme-accent';
    return 'text-theme-neural-green';
};

const StatBlock = ({ icon, iconColor, label, value }) => (
    <div className="p-3 rounded-lab border border-theme-line bg-theme-bg-elevated">
        <p className="text-[0.6875rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted flex items-center gap-1.5">
            <FontAwesomeIcon icon={icon} className={`h-3 w-3 ${iconColor}`} />
            {label}
        </p>
        <p className="text-2xl font-mono text-theme-text mt-1">{value}</p>
    </div>
);

const TrialFunnelStrip = ({ rows }) => (
    <div className="mt-5">
        <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-theme-text-muted mb-2">Trial Funnel</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {rows.map((row) => (
                <div key={row.month} className="p-2 rounded-lab border border-theme-line bg-theme-bg-elevated text-center">
                    <p className="text-[0.6875rem] font-mono text-theme-text-muted">{row.label}</p>
                    <p className="text-xs font-mono text-theme-text mt-1">
                        {row.trialsStarted} <span className="text-theme-text-muted">started</span>
                    </p>
                    <p className="text-xs font-mono text-theme-neural-green">
                        {row.trialsConverted} <span className="text-theme-text-muted">conv</span>
                    </p>
                    <p className="text-xs font-mono text-theme-text-muted">{row.trialsFailed} lapsed</p>
                </div>
            ))}
        </div>
    </div>
);

const ChurnMetricsCard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showNotes, setShowNotes] = useState(false);

    const fetchMetrics = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const fn = httpsCallable(functions, 'adminGetChurnMetrics');
            const result = await fn();
            if (result.data.success) {
                setData(result.data);
            } else {
                setError(result.data.error || 'Failed to load churn metrics');
            }
        } catch (err) {
            console.error('[ChurnMetricsCard] Fetch error:', err);
            setError(err.message || 'Failed to load churn metrics');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    const months = data?.months || [];

    return (
        <AdminCard
            title="Subscriber Churn"
            subtitle="Last 6 months, from subscription event history"
            actions={(
                <AdminButton
                    variant="ghost"
                    size="sm"
                    icon={faRefresh}
                    loading={loading}
                    onClick={fetchMetrics}
                    title="Refresh"
                />
            )}
        >
            {loading && !data ? (
                <div className="py-8">
                    <LoadingSpinner small theme="auto" />
                </div>
            ) : error ? (
                <AdminAlert tone="error">{error}</AdminAlert>
            ) : (
                <>
                    <div className="grid grid-cols-3 gap-3 mb-5">
                        <StatBlock
                            icon={faCreditCard}
                            iconColor="text-theme-neural-green"
                            label="Active Paid"
                            value={data?.currentActivePaid ?? 0}
                        />
                        <StatBlock
                            icon={faHourglassHalf}
                            iconColor="text-theme-neural-blue"
                            label="In Trial"
                            value={data?.currentTrialing ?? 0}
                        />
                        <StatBlock
                            icon={faUserClock}
                            iconColor="text-neural-synapse"
                            label="Pending Cancels"
                            value={data?.pendingCancellations ?? 0}
                        />
                    </div>

                    {months.length === 0 ? (
                        <AdminEmptyState title="No subscription history yet" />
                    ) : (
                        <AdminTable columns={COLUMNS} className="-mx-4 sm:-mx-5" minWidth="min-w-[460px]">
                            {months.map((m) => (
                                <AdminTr key={m.month}>
                                    <AdminTd mono>{m.label}</AdminTd>
                                    <AdminTd align="right" mono className="text-theme-neural-green">
                                        {m.paidGained > 0 ? `+${m.paidGained}` : '0'}
                                    </AdminTd>
                                    <AdminTd align="right" mono className={m.paidLost > 0 ? 'text-neural-synapse' : ''}>
                                        {m.paidLost > 0 ? `-${m.paidLost}` : '0'}
                                    </AdminTd>
                                    <AdminTd align="right" mono muted>
                                        {m.cancelIntents > 0 ? m.cancelIntents : '0'}
                                    </AdminTd>
                                    <AdminTd align="right" mono className={churnColor(m.churnRatePct)}>
                                        {m.churnRatePct === null ? '—' : `${m.churnRatePct}%`}
                                    </AdminTd>
                                    <AdminTd align="right" mono muted>{m.activeAtMonthEnd}</AdminTd>
                                </AdminTr>
                            ))}
                        </AdminTable>
                    )}

                    {data?.trialFunnel?.length > 0 && <TrialFunnelStrip rows={data.trialFunnel} />}

                    {data?.caveats?.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-theme-line">
                            <button
                                type="button"
                                onClick={() => setShowNotes((v) => !v)}
                                className="text-[0.6875rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted hover:text-theme-text transition-colors flex items-center gap-1.5"
                            >
                                <FontAwesomeIcon icon={faCircleInfo} className="h-3 w-3" />
                                Data notes ({data.caveats.length})
                            </button>
                            {showNotes && (
                                <ul className="mt-2 space-y-1.5 list-disc list-inside">
                                    {data.caveats.map((caveat) => (
                                        <li key={caveat} className="text-[0.6875rem] font-mono text-theme-text-muted leading-relaxed">
                                            {caveat}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </>
            )}
        </AdminCard>
    );
};

export default ChurnMetricsCard;

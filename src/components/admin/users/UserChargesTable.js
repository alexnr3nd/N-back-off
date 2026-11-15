/* src/components/admin/users/UserChargesTable.js */
import React from 'react';
import { faMoneyBillWave } from '@fortawesome/free-solid-svg-icons';
import AdminCard from '../ui/AdminCard';
import AdminBadge from '../ui/AdminBadge';
import { AdminTable, AdminTr, AdminTd } from '../ui/AdminTable';

const CHARGE_COLUMNS = [
    { key: 'date', label: 'Date' },
    { key: 'amount', label: 'Amount' },
    { key: 'status', label: 'Status' },
    { key: 'refunded', label: 'Refunded' },
];

const formatMoney = (cents) => `$${(cents / 100).toFixed(2)}`;

const StatusBadge = ({ status }) => (
    <AdminBadge tone={status === 'succeeded' ? 'success' : 'neutral'}>{status}</AdminBadge>
);

/**
 * Stripe charges / payment history (mobile cards + desktop table).
 * Pure presentational — charges come from UserDetailPage's stripe payload.
 */
const UserChargesTable = ({ charges, formatDate }) => (
    <AdminCard variant="panel" flush title="Payment History" icon={faMoneyBillWave}>
        {/* Mobile Card Layout */}
        <div className="sm:hidden divide-y divide-theme-line/50">
            {charges.map((charge) => (
                <div key={charge.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-theme-text">
                            {formatDate(charge.created)}
                        </span>
                        <StatusBadge status={charge.status} />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-lg font-mono text-theme-text tabular-nums">
                            {formatMoney(charge.amount)} {charge.currency.toUpperCase()}
                        </span>
                        {charge.refunded && (
                            <span className="text-xs font-mono text-neural-synapse">
                                Refunded: {formatMoney(charge.refundedAmount)}
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden sm:block">
            <AdminTable columns={CHARGE_COLUMNS} minWidth="min-w-full">
                {charges.map((charge) => (
                    <AdminTr key={charge.id}>
                        <AdminTd mono className="whitespace-nowrap">
                            {formatDate(charge.created)}
                        </AdminTd>
                        <AdminTd mono className="whitespace-nowrap tabular-nums">
                            {formatMoney(charge.amount)} {charge.currency.toUpperCase()}
                        </AdminTd>
                        <AdminTd className="whitespace-nowrap">
                            <StatusBadge status={charge.status} />
                        </AdminTd>
                        <AdminTd mono className="whitespace-nowrap">
                            {charge.refunded ? (
                                <span className="text-neural-synapse">{formatMoney(charge.refundedAmount)}</span>
                            ) : (
                                <span className="text-theme-text-muted">-</span>
                            )}
                        </AdminTd>
                    </AdminTr>
                ))}
            </AdminTable>
        </div>
    </AdminCard>
);

export default UserChargesTable;

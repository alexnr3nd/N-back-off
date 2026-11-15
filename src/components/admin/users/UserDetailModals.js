/* src/components/admin/users/UserDetailModals.js */
import React from 'react';
import AdminModal from '../ui/AdminModal';
import AdminButton from '../ui/AdminButton';
import { INPUT, SELECT, LABEL } from '../ui/adminStyles';

/**
 * Email-change + refund modals for the admin user-detail page.
 * Pure presentational — all state and callables live in UserDetailPage.
 */
const UserDetailModals = ({
    showEmailModal,
    showRefundModal,
    newEmail,
    setNewEmail,
    refundAmount,
    setRefundAmount,
    selectedChargeId,
    setSelectedChargeId,
    charges,
    actionLoading,
    onCloseEmailModal,
    onSubmitEmail,
    onCloseRefundModal,
    onSubmitRefund,
}) => (
    <>
        {/* Email Change Modal */}
        {showEmailModal && (
            <AdminModal
                size="sm"
                title="Change Email"
                onClose={onCloseEmailModal}
                footer={(
                    <>
                        <AdminButton variant="ghost" onClick={onCloseEmailModal}>Cancel</AdminButton>
                        <AdminButton
                            variant="primary"
                            onClick={onSubmitEmail}
                            loading={actionLoading === 'email'}
                            disabled={!newEmail.trim()}
                        >
                            Update Email
                        </AdminButton>
                    </>
                )}
            >
                <label className={LABEL}>New Email Address</label>
                <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="New email address"
                    className={INPUT}
                />
            </AdminModal>
        )}

        {/* Refund Modal */}
        {showRefundModal && (
            <AdminModal
                size="sm"
                title="Issue Refund"
                subtitle="Leave amount empty for a full refund of the most recent charge."
                onClose={onCloseRefundModal}
                footer={(
                    <>
                        <AdminButton variant="ghost" onClick={onCloseRefundModal}>Cancel</AdminButton>
                        <AdminButton
                            variant="danger"
                            onClick={onSubmitRefund}
                            loading={actionLoading === 'refund'}
                        >
                            Issue Refund
                        </AdminButton>
                    </>
                )}
            >
                {charges && (
                    <div className="mb-4">
                        <label className={LABEL}>Select Charge (optional)</label>
                        <select
                            value={selectedChargeId}
                            onChange={(e) => setSelectedChargeId(e.target.value)}
                            className={SELECT}
                        >
                            <option value="">Most recent charge</option>
                            {charges.filter(c => !c.refunded).map(charge => (
                                <option key={charge.id} value={charge.id}>
                                    ${(charge.amount / 100).toFixed(2)} - {new Date(charge.created).toLocaleDateString()}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div>
                    <label className={LABEL}>Refund Amount (USD, optional)</label>
                    <input
                        type="number"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        placeholder="Leave empty for full refund"
                        step="0.01"
                        min="0"
                        className={INPUT}
                    />
                </div>
            </AdminModal>
        )}
    </>
);

export default UserDetailModals;

/* src/components/admin/users/UserDetailHeader.js */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft,
    faEnvelope,
    faKey,
    faMoneyBillWave,
    faCrown
} from '@fortawesome/free-solid-svg-icons';
import AdminCard from '../ui/AdminCard';
import AdminAlert from '../ui/AdminAlert';
import AdminButton from '../ui/AdminButton';
import { AVATAR } from '../ui/adminStyles';

/**
 * Top region of the admin user-detail page: back link, action feedback,
 * missing-Firestore warning, identity card and quick actions.
 * Pure presentational — every handler is owned by UserDetailPage.
 */
const UserDetailHeader = ({
    userData,
    userId,
    isOnline,
    actionMessage,
    firestoreDocMissing,
    actionLoading,
    onBack,
    onOpenEmailModal,
    onResetPassword,
    onOpenRefundModal,
}) => (
    <>
        {/* Back Button */}
        <div className="flex items-center justify-between">
            <button
                onClick={onBack}
                className="group inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-theme-text-muted hover:text-theme-accent transition-colors"
            >
                <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" />
                Back
            </button>
        </div>

        {/* Action Message */}
        {actionMessage && (
            <AdminAlert tone={actionMessage.type === 'success' ? 'success' : 'error'}>
                {actionMessage.text}
            </AdminAlert>
        )}

        {/* Firestore Document Missing Warning */}
        {firestoreDocMissing && (
            <AdminAlert tone="warning" title="Firestore Document Missing">
                This user exists in Firebase Auth but has no Firestore document. This typically happens when
                the signup process failed to complete. The user may need to log out and log back in to create
                their profile.
            </AdminAlert>
        )}

        {/* User Header Card */}
        <AdminCard>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center">
                    <div className="relative">
                        <div className={`h-16 w-16 ${AVATAR} text-2xl`}>
                            {(userData.auth?.email || userData.displayName || '?')[0].toUpperCase()}
                        </div>
                        {/* Online indicator dot */}
                        {isOnline && (
                            <div className="absolute bottom-0 right-0 h-4 w-4 bg-theme-neural-green rounded-full border-2 border-theme-bg-secondary"></div>
                        )}
                    </div>
                    <div className="ml-4 min-w-0">
                        <h1 className="text-2xl font-serif italic text-theme-text">
                            {userData.subscriptionTier === 'premium' && (
                                <FontAwesomeIcon icon={faCrown} className="h-4 w-4 text-theme-accent mr-2 inline" />
                            )}
                            {userData.displayName || 'No Display Name'}
                        </h1>
                        <p className="text-sm font-mono text-theme-text-secondary truncate">
                            {userData.auth?.email || 'No email'}
                        </p>
                        <p className="text-[0.6875rem] text-theme-text-muted font-mono mt-1 truncate">{userId}</p>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                    <AdminButton
                        variant="secondary"
                        icon={faEnvelope}
                        onClick={onOpenEmailModal}
                        disabled={Boolean(actionLoading)}
                    >
                        Change Email
                    </AdminButton>
                    <AdminButton
                        variant="secondary"
                        icon={faKey}
                        onClick={onResetPassword}
                        loading={actionLoading === 'password'}
                    >
                        Reset Password
                    </AdminButton>
                    {userData.stripeCustomerId && (
                        <AdminButton
                            variant="danger"
                            icon={faMoneyBillWave}
                            onClick={onOpenRefundModal}
                            disabled={Boolean(actionLoading)}
                        >
                            Issue Refund
                        </AdminButton>
                    )}
                </div>
            </div>
        </AdminCard>
    </>
);

export default UserDetailHeader;

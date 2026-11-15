/* src/components/account/AccountDeleteFlow.js */
/* Self-contained account deletion flow: warning section + typed-confirmation modal.
   Used by SettingsPage (native app) and DeleteAccountPage (web /delete-account route). */
import React, { useState, useCallback } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from '../ui/ConfirmationModal';
import AccountDeleteSection from './AccountDeleteSection';
import { deleteAccountFn } from '../../contexts/user/userCloudFunctions';

const AccountDeleteFlow = ({ ButtonComponent, AlertComponent }) => {
    const auth = getAuth();
    const navigate = useNavigate();

    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
    const [deleteAccountConfirmationInput, setDeleteAccountConfirmationInput] = useState('');
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [deleteAccountError, setDeleteAccountError] = useState(null);

    const handleOpenDeleteAccountModal = useCallback(() => {
        setDeleteAccountConfirmationInput('');
        setDeleteAccountError(null);
        setShowDeleteAccountModal(true);
    }, []);

    const handleCloseDeleteAccountModal = useCallback(() => {
        setShowDeleteAccountModal(false);
        setDeleteAccountConfirmationInput('');
    }, []);

    const handleDeleteAccount = useCallback(async () => {
        if (isDeletingAccount) return;

        setShowDeleteAccountModal(false);
        setDeleteAccountConfirmationInput('');

        if (!deleteAccountFn) {
            setDeleteAccountError("Account deletion is currently unavailable. Please try again later.");
            return;
        }

        setIsDeletingAccount(true);
        setDeleteAccountError(null);
        try {
            const result = await deleteAccountFn();
            if (!result?.data?.success) {
                throw new Error("Account deletion did not complete.");
            }

            try {
                await signOut(auth);
            } catch (signOutError) {
                console.error("Local sign-out after account deletion failed:", signOutError);
            }
            navigate('/login', { replace: true });
        } catch (err) {
            let message = "Failed to delete the account. Please try again.";
            if (err?.code === 'unauthenticated' || err?.code === 'functions/unauthenticated') {
                message = "Authentication error. Please log out, log back in, and try again.";
            } else if (err?.code === 'internal' || err?.code === 'functions/internal') {
                message = "Account deletion could not be completed. Please try again.";
            } else if (err?.message) {
                message = err.message;
            }
            setDeleteAccountError(message);
        } finally {
            setIsDeletingAccount(false);
        }
    }, [auth, navigate, isDeletingAccount]);

    return (
        <>
            <AccountDeleteSection
                isDeleting={isDeletingAccount}
                deleteError={deleteAccountError}
                onDeleteClick={handleOpenDeleteAccountModal}
                ButtonComponent={ButtonComponent}
                AlertComponent={AlertComponent}
            />

            <ConfirmationModal
                isOpen={showDeleteAccountModal}
                title="Delete Account"
                onConfirm={handleDeleteAccount}
                onClose={handleCloseDeleteAccountModal}
                confirmText="Delete Account"
                cancelText="Cancel"
                isDestructive={true}
                requiredInputText="DELETE"
                inputLabel="Type DELETE to confirm permanent account deletion."
                inputValue={deleteAccountConfirmationInput}
                onInputChange={(e) => setDeleteAccountConfirmationInput(e.target.value)}
                confirmationPlaceholder="DELETE"
            >
                <p className="text-sm text-theme-text-secondary font-mono">
                    This permanently deletes training history, statistics, subscription access, and sign-in credentials.
                </p>
                <p className="text-sm text-neural-synapse font-mono mt-3">
                    If subscribed through the App Store or Google Play, cancel the subscription separately in the store — deleting the account here does not cancel store-managed billing.
                </p>
                <p className="text-sm text-neural-synapse font-mono mt-3">
                    This action cannot be undone.
                </p>
            </ConfirmationModal>
        </>
    );
};

export default AccountDeleteFlow;

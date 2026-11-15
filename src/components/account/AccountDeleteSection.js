/* File: src/components/account/AccountDeleteSection.js */
/* Updated: Cognitive Lab dark theme */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faTrash } from '@fortawesome/free-solid-svg-icons';

const AccountDeleteSection = ({
    isDeleting,
    deleteError,
    onDeleteClick,
    // UI Components passed as props
    ButtonComponent,
    AlertComponent,
}) => {
    const Button = ButtonComponent;
    const Alert = AlertComponent;

    if (!Button || !Alert) {
        console.error("AccountDeleteSection: Required UI component props were not provided.");
        return <div className="text-neural-synapse p-4 font-mono">Error: UI components for this section are missing.</div>;
    }

    return (
        <>
            <div className="p-4 bg-neural-synapse/10 border border-neural-synapse/30 rounded-lab">
                <h4 className="text-sm font-mono text-neural-synapse mb-2 flex items-center">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2 h-4 w-4" />
                    Permanent Account Deletion
                </h4>
                <p className="text-sm text-theme-text-secondary font-mono">
                    Account deletion is permanent and irreversible. Deleted data cannot be recovered.
                </p>
                <p className="text-xs font-mono uppercase tracking-wider text-theme-text-muted mt-4 mb-2">
                    The following will be deleted:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-theme-text-secondary font-mono">
                    <li>Training history and saved replays</li>
                    <li>Performance statistics and settings</li>
                    <li>Subscription access associated with this account</li>
                    <li>The account and sign-in credentials</li>
                </ul>
                <p className="text-sm text-theme-text-secondary font-mono mt-4">
                    Subscriptions billed through Google Play or the App Store are not cancelled by account deletion and must be cancelled in the store.
                </p>
            </div>

            <Alert type="error" message={deleteError} />

            <div className="flex justify-end">
                <Button
                    onClick={onDeleteClick}
                    disabled={isDeleting}
                    isLoading={isDeleting}
                    loadingText="Deleting..."
                    text="Delete Account"
                    variant="danger"
                    icon={faTrash}
                />
            </div>
        </>
    );
};

export default AccountDeleteSection;

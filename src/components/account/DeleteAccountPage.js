/* src/components/account/DeleteAccountPage.js */
/* Standalone account deletion page at /delete-account.
   Deliberately unlinked from web navigation — serves as the web deletion path
   required by the Google Play data-deletion URL declaration (and GDPR self-serve).
   In the native apps, deletion is surfaced in Settings instead. */
import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faTrash } from '@fortawesome/free-solid-svg-icons';
import AccountDeleteFlow from './AccountDeleteFlow';
import { LabButton, LabAlert } from '../ui/LabControls';

const DeleteAccountPage = () => (
    <div className="min-h-screen bg-theme-bg lab-grid">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
            <header className="mb-8 sm:mb-10">
                <div className="mb-6">
                    <Link
                        to="/settings"
                        className="group inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-accent transition-colors"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                        <span className="text-xs font-mono uppercase tracking-wider">Return to Settings</span>
                    </Link>
                </div>
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 sm:h-14 sm:w-14 relative flex-shrink-0 hidden sm:block">
                        <div className="absolute inset-0 bg-neural-synapse/20 rounded-sm rotate-3"></div>
                        <div className="absolute inset-0 bg-theme-bg-secondary border border-neural-synapse flex items-center justify-center text-neural-synapse">
                            <FontAwesomeIcon icon={faTrash} className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">Account</p>
                        <h1 className="text-xl sm:text-2xl lg:text-3xl text-theme-text font-serif italic">
                            Delete Account
                        </h1>
                    </div>
                </div>
            </header>

            <main>
                <div className="specimen-card rounded-lab p-6 space-y-4">
                    <AccountDeleteFlow ButtonComponent={LabButton} AlertComponent={LabAlert} />
                </div>
            </main>
        </div>
    </div>
);

export default DeleteAccountPage;

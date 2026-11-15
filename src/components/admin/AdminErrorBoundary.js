/* src/components/admin/AdminErrorBoundary.js */
import React, { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { db } from '../../firebaseConfig';
import { isFirestoreAssertionError, performFirestoreRecovery } from '../../utils/firestoreRecovery';
import AdminButton from './ui/AdminButton';

const AdminErrorBoundary = () => {
    const error = useRouteError();
    const isDbError = isFirestoreAssertionError(error);

    useEffect(() => {
        Sentry.captureException(error, {
            tags: {
                component: 'AdminErrorBoundary',
                isFirestorePersistence: isDbError,
            },
        });
    }, [error, isDbError]);

    const handleClearAndRetry = () => performFirestoreRecovery(db);

    return (
        <div className="min-h-screen flex items-center justify-center bg-theme-bg lab-grid p-4">
            <div className="specimen-card p-8 max-w-md text-center">
                <h1 className="text-xl font-serif italic text-theme-text mb-4">
                    {isDbError ? 'Cache Error' : 'Something went wrong'}
                </h1>
                <p className="text-sm text-theme-text-secondary mb-6">
                    {isDbError
                        ? 'The local database cache has become corrupted. Click below to clear it and reload.'
                        : 'An unexpected error occurred in the admin panel.'}
                </p>
                {isDbError ? (
                    <AdminButton variant="primary" onClick={handleClearAndRetry}>
                        Clear Cache &amp; Retry
                    </AdminButton>
                ) : (
                    <AdminButton variant="primary" onClick={() => window.location.reload()}>
                        Reload Page
                    </AdminButton>
                )}
                <details className="mt-4 text-left text-xs text-theme-text-muted font-mono">
                    <summary className="cursor-pointer">Error details</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words bg-theme-bg border border-theme-line p-2 rounded-lab">
                        {error?.message || error?.toString()}
                    </pre>
                </details>
            </div>
        </div>
    );
};

export default AdminErrorBoundary;

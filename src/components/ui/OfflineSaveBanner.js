/* src/components/ui/OfflineSaveBanner.js */
/* Dashboard banner showing pending/synced/failed offline save status */

import React, { useState, useEffect } from 'react';
import { useOfflineSave } from '../../contexts/OfflineSaveContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudArrowUp, faCircleCheck, faTriangleExclamation, faRotateRight, faXmark, faSpinner } from '@fortawesome/free-solid-svg-icons';

const OfflineSaveBanner = () => {
    const { pendingCount, failedCount, isSyncing, lastSyncResult, retryAll, clearAll } = useOfflineSave();
    const [showSuccess, setShowSuccess] = useState(false);

    // Show success message briefly when sync completes
    useEffect(() => {
        if (lastSyncResult?.success > 0) {
            setShowSuccess(true);
            const timer = setTimeout(() => setShowSuccess(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [lastSyncResult]);

    // Nothing to show
    if (pendingCount === 0 && failedCount === 0 && !showSuccess) return null;

    // Success state (auto-dismiss)
    if (showSuccess && pendingCount === 0 && failedCount === 0) {
        return (
            <div className="mb-4 rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <FontAwesomeIcon icon={faCircleCheck} />
                    <span>
                        {lastSyncResult.success} session{lastSyncResult.success !== 1 ? 's' : ''} synced successfully
                    </span>
                </div>
            </div>
        );
    }

    // Pending state (syncing or waiting)
    if (pendingCount > 0) {
        return (
            <div className="mb-4 rounded-lg border border-amber-700/40 bg-amber-900/20 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-amber-400">
                    <FontAwesomeIcon
                        icon={isSyncing ? faSpinner : faCloudArrowUp}
                        className={isSyncing ? 'animate-spin' : ''}
                    />
                    <span>
                        {isSyncing
                            ? `Syncing ${pendingCount} session${pendingCount !== 1 ? 's' : ''}...`
                            : `${pendingCount} session${pendingCount !== 1 ? 's' : ''} waiting to sync`
                        }
                    </span>
                </div>
            </div>
        );
    }

    // Failed state
    if (failedCount > 0) {
        return (
            <div className="mb-4 rounded-lg border border-red-700/40 bg-red-900/20 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-red-400">
                        <FontAwesomeIcon icon={faTriangleExclamation} />
                        <span>
                            {failedCount} session{failedCount !== 1 ? 's' : ''} could not be saved
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={retryAll}
                            className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-800/30 transition-colors"
                        >
                            <FontAwesomeIcon icon={faRotateRight} className="text-[0.625rem]" />
                            Retry
                        </button>
                        <button
                            onClick={clearAll}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400/60 hover:text-red-400 hover:bg-red-800/20 transition-colors"
                            title="Dismiss failed sessions"
                        >
                            <FontAwesomeIcon icon={faXmark} className="text-xs" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default OfflineSaveBanner;

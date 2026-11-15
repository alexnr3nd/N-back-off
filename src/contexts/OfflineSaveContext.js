/* src/contexts/OfflineSaveContext.js */
/* Orchestrates retrying queued offline game session saves when connectivity returns */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNetwork } from './NetworkStatusContext';
import { useUser } from './UserContext';
import { auth } from '../firebaseConfig';
import {
    isAuthError,
    isNetworkOrTimeoutError,
    isAppCheckAttestationError,
    calculateAndSaveResultsCall,
} from './game/gameCloudFunctions';
import {
    getQueue,
    dequeue,
    markRetried,
    markFailed,
    resetEntryForRetry,
    OFFLINE_QUEUE_CHANGED_EVENT,
} from '../utils/offlineSaveQueue';
import { holdRecoveryReload } from '../utils/appCheckHealth';
import { trackEvent } from '../utils/analyticsTracker';

const OfflineSaveContext = createContext({
    pendingCount: 0,
    failedCount: 0,
    isSyncing: false,
    lastSyncResult: null,
    retryAll: () => {},
    clearAll: () => {},
});

/**
 * The backend saves under the AUTHENTICATED uid, not the payload's, so an entry may
 * only be replayed (or counted, or retried, or cleared) by the user who played it.
 * Entries without a uid were queued by builds before the field existed: treat them as
 * owned by whoever is signed in, as before.
 */
const isOwnedByCurrentUser = (entry) => {
    if (!entry?.uid) return true;
    return entry.uid === auth.currentUser?.uid;
};

const readOwnQueue = async () => (await getQueue()).filter(isOwnedByCurrentUser);

const countOwn = (entries) => ({
    pending: entries.filter((e) => e.status === 'pending').length,
    failed: entries.filter((e) => e.status === 'failed').length,
});

const isBrowserOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

/**
 * An entry pending this long is marked failed so the banner's Retry / Clear become
 * reachable (they render only when nothing is pending). A poisoned payload — one that
 * deterministically times out or crashes the function — otherwise sits amber forever.
 * Nothing is lost: Retry puts it back.
 */
export const STALE_ENTRY_MS = 14 * 24 * 60 * 60 * 1000;

export const OfflineSaveProvider = ({ children }) => {
    const { isConnected } = useNetwork();
    const { setPendingOfflineCapRejection, isDataReady } = useUser();
    const [pendingCount, setPendingCount] = useState(0);
    const [failedCount, setFailedCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncResult, setLastSyncResult] = useState(null);
    const isFlushing = useRef(false);
    const prevConnected = useRef(true);
    // clientSessionIds whose network-class failure ended a drain this page life.
    // A network-class failure is indistinguishable from a poisoned payload (one that
    // deterministically times out / crashes the function), so known breakers are moved
    // behind the entries that have not broken a drain yet: those get their turn, and if
    // any of them succeeds the network is proven alive and a breaker's next failure
    // counts as a bounded retry. A set, not a single id: two poisoned heads would
    // otherwise alternate forever. Cleared per id on success.
    const networkBreakersRef = useRef(new Set());

    // Refresh counts from IndexedDB (current user's entries only)
    const refreshCounts = useCallback(async () => {
        const sizes = countOwn(await readOwnQueue());
        setPendingCount(sizes.pending);
        setFailedCount(sizes.failed);
        return sizes;
    }, []);

    // Flush all pending entries sequentially
    const flushQueue = useCallback(async () => {
        if (isFlushing.current) return; // Prevent concurrent flushes
        isFlushing.current = true;
        setIsSyncing(true);
        // A reload mid-flush could interrupt a dequeue/markRetried write; the backend's
        // clientSessionId idempotency makes that safe, but there is no reason to allow it.
        const releaseReloadHold = holdRecoveryReload('offline_drain');

        let successCount = 0;
        let failCount = 0;

        // HttpsError codes that indicate the request will never succeed — mark as failed permanently.
        const PERMANENT_FAIL_CODES = new Set([
            'invalid-argument',
            'failed-precondition',
            'out-of-range',
            'not-found',
            'already-exists',
        ]);

        try {
            let entries = (await getQueue())
                .filter((e) => e.status === 'pending')
                .sort((a, b) => a.queuedAt - b.queuedAt);
            if (entries.length === 0) {
                return;
            }
            // See networkBreakersRef: entries that never broke a drain go first (stable order).
            const breakers = networkBreakersRef.current;
            if (breakers.size > 0) {
                entries = [
                    ...entries.filter((e) => !breakers.has(e.clientSessionId)),
                    ...entries.filter((e) => breakers.has(e.clientSessionId)),
                ];
            }

            for (let index = 0; index < entries.length; index++) {
                const entry = entries[index];
                // No signed-in user right now (Auth still restoring, or signed out): leave
                // the entries pending for a later drain. Marking them 'auth_expired' here
                // used to permanently fail sessions — including one the App Check recovery
                // reload had just rescued — when the boot drain raced Auth's restore.
                if (!auth.currentUser) {
                    break;
                }
                // Another account's session (shared device): leave it for that user.
                if (!isOwnedByCurrentUser(entry)) {
                    continue;
                }
                // Pending for two weeks with no manual Retry since: surface it (see
                // STALE_ENTRY_MS) instead of blocking. A Retry stamps manualRetryAt, so the
                // entry gets a real callable attempt before it can go stale again.
                const lastActivityAt = Math.max(entry.queuedAt || 0, entry.manualRetryAt || 0);
                if (lastActivityAt > 0 && Date.now() - lastActivityAt > STALE_ENTRY_MS) {
                    await markFailed(entry.clientSessionId, 'stale');
                    failCount++;
                    continue;
                }

                try {
                    // httpsCallable handles token refresh and App Check automatically. The
                    // wrapper is bounded (token preflight + backstop), so a wedged App Check
                    // SDK surfaces as a deadline error → the network break below, instead of
                    // pinning isFlushing forever.
                    await calculateAndSaveResultsCall(entry.payload);
                    await dequeue(entry.clientSessionId);
                    networkBreakersRef.current.delete(entry.clientSessionId);
                    successCount++;
                } catch (callError) {
                    // App Check attestation failed. The network answered, so this is not
                    // "offline": count a retry (fails after MAX_RETRY_COUNT with a visible
                    // banner + Retry) instead of pausing forever and silently evicting entries
                    // at capacity. It is a device-wide condition — every remaining entry would
                    // fail identically — so count it on all of them, or N entries would need
                    // 5N foregrounds to surface while the banner kept saying "waiting to sync".
                    if (isAppCheckAttestationError(callError)) {
                        const remaining = entries.slice(index).filter(isOwnedByCurrentUser);
                        for (const e of remaining) {
                            await markRetried(e.clientSessionId);
                            failCount++;
                        }
                        break;
                    }
                    // Network / offline — stop processing, keep entries for next attempt.
                    // (Also the SDK's fetch-level 'internal'/'internal' signature: DNS-down
                    // and captive-portal networks report navigator.onLine === true, so it
                    // must stay a plain pause — see isSdkFetchFailure.)
                    if (isNetworkOrTimeoutError(callError) ||
                        (callError instanceof TypeError && callError.message === 'Failed to fetch')) {
                        networkBreakersRef.current.add(entry.clientSessionId);
                        // Another entry just saved in this same drain, so the network is
                        // alive: this failure is the payload's, count it (bounded).
                        if (successCount > 0) {
                            await markRetried(entry.clientSessionId);
                            failCount++;
                        }
                        break;
                    }
                    // Auth error — stop processing and mark this entry failed. Unless the
                    // user signed out mid-flush (the 401 is then just "nobody is signed in"):
                    // leave it pending for that user's next sign-in.
                    if (isAuthError(callError)) {
                        if (!auth.currentUser) break;
                        await markFailed(entry.clientSessionId, 'auth_expired');
                        failCount++;
                        break;
                    }
                    // Permanent client error — won't succeed on retry
                    // Normalize the SDK code (different versions emit 'functions/x' vs 'x').
                    const code = (callError?.code || '').replace(/^functions\//, '');

                    // Daily Adaptive cap — surface a paywall on next dashboard mount
                    // instead of silently dropping the rejection (best practice: don't
                    // let server-side gates vanish into the offline queue's failed bin).
                    if (code === 'resource-exhausted' && callError?.details?.reason === 'daily_cap') {
                        if (typeof setPendingOfflineCapRejection === 'function') {
                            setPendingOfflineCapRejection({
                                sessionsUsed: callError?.details?.sessionsUsed,
                                dailyCap: callError?.details?.limit,
                            });
                        }
                        trackEvent('daily_cap_reached', {
                            source: 'offline_queue',
                            sessionsUsed: callError?.details?.sessionsUsed,
                        });
                        const msg = (callError?.message || '').substring(0, 100);
                        await markFailed(entry.clientSessionId, `server_rejected_daily_cap: ${msg}`);
                        failCount++;
                        continue;
                    }

                    if (PERMANENT_FAIL_CODES.has(code)) {
                        const msg = (callError?.message || '').substring(0, 100);
                        await markFailed(entry.clientSessionId, `server_rejected_${code}: ${msg}`);
                        failCount++;
                        continue;
                    }
                    // Transient server error — retry later
                    await markRetried(entry.clientSessionId);
                    failCount++;
                }
            }
        } finally {
            releaseReloadHold();
            isFlushing.current = false;
            setIsSyncing(false);
            await refreshCounts();

            if (successCount > 0 || failCount > 0) {
                setLastSyncResult({ success: successCount, failed: failCount });
            }
        }
    }, [refreshCounts, setPendingOfflineCapRejection]);

    // Flush on startup (if online and queue has items). Gated on isDataReady: this
    // provider mounts outside AuthGuard, so at boot auth.currentUser is null until
    // Firebase Auth restores from IndexedDB. isDataReady also re-fires after the
    // network ErrorScreen's Retry (refreshUserData), which is the one drain trigger
    // that exists when the app reloads into a still-dead network.
    useEffect(() => {
        if (!isDataReady) return;
        const init = async () => {
            const sizes = await refreshCounts();
            if (sizes.pending > 0 && isBrowserOnline()) {
                flushQueue();
            }
        };
        init();
    }, [isDataReady]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keep the counts (dashboard banner) current when gameEnd / a chain block enqueues,
    // without waiting for a remount or the next flush.
    useEffect(() => {
        const handleQueueChanged = () => { refreshCounts(); };
        window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChanged);
        return () => window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChanged);
    }, [refreshCounts]);

    // Flush when transitioning from offline → online
    useEffect(() => {
        if (!prevConnected.current && isConnected) {
            flushQueue();
        }
        prevConnected.current = isConnected;
    }, [isConnected, flushQueue]);

    // Also flush when page becomes visible (handles app backgrounded then foregrounded)
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && isBrowserOnline()) {
                refreshCounts().then((sizes) => {
                    if (sizes.pending > 0) flushQueue();
                });
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [flushQueue, refreshCounts]);

    // Manual retry: reset the current user's failed entries and flush
    const retryAll = useCallback(async () => {
        const ownEntries = await readOwnQueue();
        for (const entry of ownEntries) {
            if (entry.status === 'failed') {
                await resetEntryForRetry(entry.clientSessionId);
            }
        }
        await refreshCounts();
        flushQueue();
    }, [flushQueue, refreshCounts]);

    // Discard the current user's queued sessions (other accounts' entries stay)
    const clearAll = useCallback(async () => {
        const ownEntries = await readOwnQueue();
        for (const entry of ownEntries) {
            await dequeue(entry.clientSessionId);
        }
        await refreshCounts();
        setLastSyncResult(null);
    }, [refreshCounts]);

    const value = {
        pendingCount,
        failedCount,
        isSyncing,
        lastSyncResult,
        retryAll,
        clearAll,
    };

    return (
        <OfflineSaveContext.Provider value={value}>
            {children}
        </OfflineSaveContext.Provider>
    );
};

export const useOfflineSave = () => useContext(OfflineSaveContext);

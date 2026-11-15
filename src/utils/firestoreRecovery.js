/* src/utils/firestoreRecovery.js */
/* Detects and recovers from the Firestore IndexedDB assertion bug */
/* (firebase/firebase-js-sdk#8856, #6110, #9267) */

import { terminate, clearIndexedDbPersistence } from 'firebase/firestore';
import * as Sentry from '@sentry/react';

// Module-level state
let _firestoreBroken = false;
let _recoveryScheduled = false;

/**
 * Check if an error is the known Firestore IndexedDB assertion bug.
 * Matches: "INTERNAL ASSERTION FAILED", "Unexpected state",
 * or IndexedDB transaction failures from the persistence layer.
 */
export const isFirestoreAssertionError = (error) => {
    const message = error?.message || error?.toString() || '';
    return (
        message.includes('INTERNAL ASSERTION FAILED') ||
        message.includes('Unexpected state') ||
        (message.includes('Failed to execute') && message.includes('transaction'))
    );
};

/** Returns true if Firestore is in an unrecoverable error state. */
export const isFirestoreBroken = () => _firestoreBroken;

/**
 * Terminate Firestore, clear corrupted IndexedDB persistence, and reload.
 * Safe to call in all environments (web + Capacitor WebView).
 */
export const performFirestoreRecovery = async (db) => {
    console.warn('[FirestoreRecovery] Performing recovery: terminate + clear + reload');
    try {
        await terminate(db);
        await clearIndexedDbPersistence(db);
    } catch (e) {
        console.warn('[FirestoreRecovery] Failed to clear persistence:', e);
    }
    window.location.reload();
};

/**
 * Schedule recovery — immediately if no game is active, or deferred until the game ends.
 * Uses the existing data-game-active DOM attribute pattern to detect active gameplay.
 * No-ops if recovery is already scheduled.
 */
export const scheduleRecovery = (db) => {
    if (_recoveryScheduled) return;
    _recoveryScheduled = true;
    _firestoreBroken = true;

    const gameActive = document.querySelector('[data-game-active="true"]');
    if (!gameActive) {
        console.warn('[FirestoreRecovery] No active game. Recovering now.');
        performFirestoreRecovery(db);
        return;
    }

    // Game is active — defer recovery until game ends
    console.warn('[FirestoreRecovery] Game active. Deferring recovery until game ends.');

    const recover = () => {
        observer.disconnect();
        clearInterval(fallbackInterval);
        console.warn('[FirestoreRecovery] Game ended. Recovering now.');
        performFirestoreRecovery(db);
    };

    // Watch for data-game-active attribute removal/change
    const observer = new MutationObserver(() => {
        const stillActive = document.querySelector('[data-game-active="true"]');
        if (!stillActive) recover();
    });

    observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['data-game-active'],
    });

    // Fallback: poll every 5s in case the observer misses the change
    const fallbackInterval = setInterval(() => {
        const stillActive = document.querySelector('[data-game-active="true"]');
        if (!stillActive) recover();
    }, 5000);
};

/**
 * Install a global unhandledrejection handler that detects the Firestore assertion error
 * and triggers recovery. Call once from index.js after Sentry init.
 * Does NOT call preventDefault — lets Sentry capture the error independently.
 */
export const installGlobalHandler = (db) => {
    window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason;
        if (isFirestoreAssertionError(error)) {
            console.error('[FirestoreRecovery] Detected Firestore assertion error:', error?.message?.slice(0, 150));

            Sentry.captureException(error, {
                tags: {
                    firestoreRecovery: true,
                    source: 'unhandledrejection',
                    gameActive: !!document.querySelector('[data-game-active="true"]'),
                },
            });

            scheduleRecovery(db);
        }
    });
};

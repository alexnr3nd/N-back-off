/**
 * useUpgradeModalRollout — reads config/upgradeModalRollout once per session
 * and exposes a beta-gating decision for Pro-trial upgrade modal triggers.
 *
 * Pattern mirrors useReviewPrompt.js's config-read approach.
 *
 * Returns:
 *   { enabled, allowAllAuthenticated, isUserAllowed, isLoading }
 *
 * Where:
 *   - enabled: master kill switch
 *   - allowAllAuthenticated: when true, all authenticated users qualify
 *   - isUserAllowed: combined verdict (enabled && (allowAll || allowlist))
 *   - isLoading: true while the config is being fetched
 *
 * Cached at module scope so multiple components don't re-fetch.
 */

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useUser } from '../contexts/UserContext';

let cachedRollout = null;     // { enabled, allowAllAuthenticated, allowedEmails }
let inFlightFetch = null;     // prevents duplicate fetches when multiple components mount simultaneously

async function fetchRolloutOnce() {
    if (cachedRollout !== null) return cachedRollout;
    if (inFlightFetch) return inFlightFetch;

    inFlightFetch = (async () => {
        try {
            const snap = await getDoc(doc(db, 'config', 'upgradeModalRollout'));
            if (snap.exists()) {
                const data = snap.data() || {};
                cachedRollout = {
                    enabled: data.enabled === true,
                    allowAllAuthenticated: data.allowAllAuthenticated === true,
                    allowedEmails: Array.isArray(data.allowedEmails)
                        ? data.allowedEmails.map(e => (e || '').toLowerCase())
                        : [],
                };
            } else {
                cachedRollout = { enabled: false, allowAllAuthenticated: false, allowedEmails: [] };
            }
        } catch (err) {
            console.warn('[useUpgradeModalRollout] Could not fetch config:', err.message);
            cachedRollout = { enabled: false, allowAllAuthenticated: false, allowedEmails: [] };
        } finally {
            inFlightFetch = null;
        }
        return cachedRollout;
    })();

    return inFlightFetch;
}

export function useUpgradeModalRollout() {
    const { authUser } = useUser();
    const [state, setState] = useState(() => ({
        enabled: cachedRollout?.enabled ?? false,
        allowAllAuthenticated: cachedRollout?.allowAllAuthenticated ?? false,
        allowedEmails: cachedRollout?.allowedEmails ?? [],
        isLoading: cachedRollout === null,
    }));

    useEffect(() => {
        let cancelled = false;
        if (cachedRollout === null) {
            fetchRolloutOnce().then(rollout => {
                if (cancelled) return;
                setState({
                    enabled: rollout.enabled,
                    allowAllAuthenticated: rollout.allowAllAuthenticated,
                    allowedEmails: rollout.allowedEmails,
                    isLoading: false,
                });
            });
        }
        return () => { cancelled = true; };
    }, []);

    const userEmail = (authUser?.email || '').toLowerCase();
    const isUserAllowed = state.enabled && (
        state.allowAllAuthenticated ||
        (userEmail && state.allowedEmails.includes(userEmail))
    );

    return {
        enabled: state.enabled,
        allowAllAuthenticated: state.allowAllAuthenticated,
        isUserAllowed,
        isLoading: state.isLoading,
    };
}

// Test-only: reset cached rollout (for unit tests)
export function __resetUpgradeModalRolloutCache() {
    cachedRollout = null;
    inFlightFetch = null;
}

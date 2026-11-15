/* src/hooks/useReminderPreference.js */
import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebaseConfig';

// Daily-reminder opt-in state, fetched via getNotificationPreferences at most
// once per app load. The preference is not part of getUserDataOnLogin, so it
// is not available in UserContext — this module-level cache keeps the cost to
// a single callable invocation per page load.
// undefined = not yet fetched; true/false once known. Failures are NOT cached
// so the next mount retries (e.g., after coming back online); while unknown,
// callers should hide reminder UI rather than flash it.
// The cache is scoped to the signed-in uid: logout does not reload the page,
// so without the scope a second account on the same device would inherit the
// first account's value (and an Enable tap could clobber its saved schedule).
let cachedEnabled;
let cachedUid;
let inflightFetch = null;

function currentUid() {
    return auth?.currentUser?.uid;
}

// Called after a successful opt-in state change (in-card enable, or the
// Settings notifications save): future mounts see the fresh value without
// refetching. Already-mounted hook instances intentionally keep their value
// so the current card can show its success state instead of vanishing
// mid-view.
export function primeReminderPreferenceCache(enabled) {
    cachedEnabled = enabled === true;
    cachedUid = currentUid();
}

export function resetReminderPreferenceCacheForTests() {
    cachedEnabled = undefined;
    cachedUid = undefined;
    inflightFetch = null;
}

export function useReminderPreference() {
    const [reminderEnabled, setReminderEnabled] = useState(() => (
        cachedEnabled !== undefined && cachedUid === currentUid() ? cachedEnabled : null
    ));

    useEffect(() => {
        if (cachedEnabled !== undefined && cachedUid !== currentUid()) {
            // Another account's value — treat as unset and refetch.
            cachedEnabled = undefined;
            cachedUid = undefined;
        }
        if (cachedEnabled !== undefined) {
            setReminderEnabled(cachedEnabled);
            return undefined;
        }
        let cancelled = false;
        if (!inflightFetch) {
            const getPrefs = httpsCallable(functions, 'getNotificationPreferences');
            const uidAtFetchStart = currentUid();
            inflightFetch = getPrefs()
                .then((result) => {
                    const enabled = result?.data?.enabled === true;
                    // A prime that landed while the fetch was airborne is
                    // authoritative — never overwrite it with the response.
                    if (cachedEnabled === undefined) {
                        cachedEnabled = enabled;
                        cachedUid = uidAtFetchStart;
                    }
                    return enabled;
                })
                .catch((error) => {
                    console.warn('[useReminderPreference] Fetch failed; reminder card hidden this mount:', error);
                    return null;
                })
                .finally(() => {
                    inflightFetch = null;
                });
        }
        inflightFetch.then((value) => {
            if (!cancelled && value !== null) {
                setReminderEnabled(cachedEnabled !== undefined ? cachedEnabled : value);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return { reminderEnabled };
}

/* File: src\contexts\SettingsContext.js */

/* src/contexts/SettingsContext.js */
import React, { createContext, useState, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig'; // Import db and auth
import { onAuthStateChanged } from 'firebase/auth'; // Need listener to know the user
// Import useUser hook to get userId
import { useUser } from './UserContext';
// Import audioManager - BUT DON'T USE IT IN getDefaultSettings DIRECTLY
import audioManager from '../utils/audioManager';
// Pure feedback-settings schema migration (legacy -> per-type). Single source of truth,
// shared with the node regression test. See the file header for the per-type authority
// invariant (per-type keys win; instantFeedbackNegative is a write-only compat shadow).
import { migrateInstantFeedbackSettings } from './settings/instantFeedbackMigration';
// Text Size (Settings > Appearance). Pure root-attribute helper; see the file header
// for why 'default' clears the attribute instead of setting a sentinel value.
import { applyTextScale, normalizeTextScale } from '../utils/textScale';

/**
 * Defines the default structure and values for profile-specific settings.
 * Exported so other components can access defaults for initialization.
 * Selected Voice ID is set to null initially, handled by the provider.
 */
export const getDefaultSettings = () => ({
    // Gameplay settings
    keyBindings: {
        visual: 'ArrowLeft', // Default visual match key
        audio: 'ArrowRight', // Default audio match key
        color: 'ArrowDown',  // Default color match key (Triple/Quad modes)
        shape: 'ArrowUp',    // Default shape match key (Quad mode)
    },
    // Split instant feedback settings - controls green (correct) and red feedback separately
    instantFeedbackPositive: true, // Green feedback for correct responses
    instantFeedbackErrors: true,   // Red feedback for false-alarm clicks (wrong key)
    instantFeedbackMisses: true,   // Red feedback + grid tile for missed matches
    // Compat shadow for installed Android clients still reading the old field;
    // derived from errors||misses on save.
    instantFeedbackNegative: true,
    // Audio settings
    selectedVoiceId: null, // Set to null initially. Will be validated/set by useEffect in the Provider.
    // Time zone setting
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Default to browser's timezone
    // Display settings
    theme: 'dark', // 'light', 'dark', or 'system' - defaults to dark for backwards compatibility
    textScale: 'default', // 'default' | 'large' | 'larger' — Settings > Appearance > Text Size
    autoHideCursor: false, // Auto-hide cursor during gameplay (off by default)
    // Cohort privacy settings
    cohortPrivacy: {
        showOnlineStatus: true,
        showGameActivity: true,
    },
    // Pro feature: difficulty adjustment speed
    difficultyAdjustmentRange: 'standard',
    // Classic mode: auto level adjustment (promote/demote based on accuracy)
    classicAutoLevel: true,
    // Adaptive/Dynamic mode: auto level adjustment (promote/demote based on accuracy)
    adaptiveAutoLevel: true,
    // Response Mode per single-stimulus game mode: 'match' (default) | 'recall'.
    // Keyed by mode so other single modes can adopt Recall later. Adding a mode
    // means adding the key BOTH here and in the saveSettingsToFirestore coercion,
    // which rebuilds this map from enumerated keys (unlisted keys are dropped on save).
    // Consumed at game start (gameSetup) to resolve singleColor -> singleColorRecall.
    responseModes: {
        singleColor: 'match',
    },
});

// Create the React Context object
const SettingsContext = createContext({
    settings: getDefaultSettings(), // Initialize with basic defaults
    updateSetting: () => {}, // Placeholder for update function
    isLoading: true, // Start in loading state
    error: null,
    availableVoices: {}, // Start with empty object, populated by provider
});

/**
 * Custom hook to easily consume the SettingsContext in components.
 * Ensures the hook is used within a SettingsProvider.
 */
export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};

/**
 * SettingsProvider Component
 * Manages loading, saving, and providing profile-specific application settings.
 * Uses localStorage as a cache/offline storage and syncs with Firestore when possible.
 */
export const SettingsProvider = ({ children }) => {
    // Initialize state with basic defaults first
    const [settings, setSettings] = useState(getDefaultSettings());
    const [isLoading, setIsLoading] = useState(true); // Track loading state
    const [error, setError] = useState(null); // Track potential errors
    const [currentUserId, setCurrentUserId] = useState(null);

    // Track if we've completed initial settings load (to prevent re-triggering loading state)
    const hasCompletedInitialLoadRef = React.useRef(false);
    // Track if we've already synced with Firestore (to prevent re-running the full effect)
    const hasAttemptedFirestoreSyncRef = React.useRef(false);

    // Ref to always access the latest settings in async callbacks (avoids stale closures)
    const settingsRef = useRef(settings);
    useEffect(() => { settingsRef.current = settings; }, [settings]);

    // Get userId from UserContext for Firestore path
    const { userId, isDataReady } = useUser();

    // --- Get Available Voices from audioManager (Memoized) ---
    const availableVoices = useMemo(() => audioManager.getAvailableVoices(), []);
    const availableVoiceIds = useMemo(() => Object.keys(availableVoices), [availableVoices]);
    // const firstAvailableVoiceId = useMemo(() => (availableVoiceIds.length > 0 ? availableVoiceIds[0] : null), [availableVoiceIds]); // Keep for reference if needed

    // --- MODIFICATION START: Define preferred default voice ---
    const preferredDefaultVoiceId = useMemo(() => {
        const ELEANOR_VOICE_ID = "google-en-gb-wavenet-n"; // ID for "Eleanor (UK Female)"
        if (availableVoices && availableVoices[ELEANOR_VOICE_ID]) {
            return ELEANOR_VOICE_ID; // Use Eleanor if available
        }
        // Fallback to the first available if Eleanor isn't present
        return availableVoiceIds.length > 0 ? availableVoiceIds[0] : null;
    }, [availableVoices, availableVoiceIds]); // Depend on the list of voices
    // --- MODIFICATION END ---


    // Effect to get current user ID and handle logout reset
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            const newUserId = user ? user.uid : null;
            if (newUserId !== currentUserId) {
                setCurrentUserId(newUserId);
                // If user logs out, reset settings state to default and clear local storage
                if (!newUserId) {
                    const defaults = getDefaultSettings();
                    // --- MODIFICATION START: Use preferred default on logout ---
                    defaults.selectedVoiceId = preferredDefaultVoiceId; // Set the calculated preferred default
                    // --- MODIFICATION END ---
                    setSettings(defaults);
                    localStorage.removeItem('userAppSettings'); // Clear storage on logout
                    setIsLoading(false); // Stop loading if user logs out during initial load
                    setError(null);
                    // Reset flags so next login shows loading and syncs with Firestore
                    hasCompletedInitialLoadRef.current = false;
                    hasAttemptedFirestoreSyncRef.current = false;
                }
            }
        });
        return () => unsubscribe();
    // --- MODIFICATION START: Add preferredDefaultVoiceId dependency ---
    }, [currentUserId, preferredDefaultVoiceId]); // Depend on preferredDefaultVoiceId for logout reset
    // --- MODIFICATION END ---


    // Effect to Load Settings (from localStorage first, then Firestore if applicable)
    useEffect(() => {
        // Don't run load logic if user just logged out (handled by auth listener)
        if (currentUserId === null && !isLoading) return;

        // Skip entirely if we've already completed initial load AND attempted Firestore sync
        // This prevents re-renders when dependencies change after initial setup
        if (hasCompletedInitialLoadRef.current && hasAttemptedFirestoreSyncRef.current) {
            return;
        }

        // If initial load is complete but we haven't synced with Firestore yet,
        // only do the Firestore sync (skip localStorage reload to prevent re-renders)
        if (hasCompletedInitialLoadRef.current && !hasAttemptedFirestoreSyncRef.current) {
            if (currentUserId && userId && isDataReady) {
                hasAttemptedFirestoreSyncRef.current = true;
                const settingsDocRef = doc(db, 'users', currentUserId, 'profiles', userId, 'profileSettings', 'settings');
                getDoc(settingsDocRef).then(docSnap => {
                    if (docSnap.exists()) {
                        const loadedData = docSnap.data();
                        // Migrate the RAW doc first (consistent with the other load paths) so
                        // legacy negative-only docs upgrade and per-type keys stay authoritative.
                        const migratedLoaded = migrateInstantFeedbackSettings(loadedData);
                        // Only update if Firestore has different data
                        setSettings(prev => {
                            const merged = {
                                ...prev,
                                ...migratedLoaded,
                                keyBindings: (loadedData.keyBindings && typeof loadedData.keyBindings === 'object')
                                             ? { ...prev.keyBindings, ...loadedData.keyBindings }
                                             : prev.keyBindings,
                            };
                            if (JSON.stringify(merged) !== JSON.stringify(prev)) {
                                localStorage.setItem('userAppSettings', JSON.stringify(merged));
                                return merged;
                            }
                            return prev;
                        });
                    } else {
                        // No Firestore doc, save current settings
                        saveSettingsToFirestore(settingsRef.current);
                    }
                }).catch(err => {
                    console.error(`[SettingsContext] Firestore sync error:`, err);
                });
            } else {
                // No user/profile for Firestore sync, mark as attempted
                hasAttemptedFirestoreSyncRef.current = true;
            }
            return;
        }

        // --- Initial Load Logic (only runs once) ---
        setIsLoading(true);
        setError(null);
        // Start with base defaults and set the initial default voice ID
        let loadedSettingsState = {
            ...getDefaultSettings(),
            // --- MODIFICATION START: Use preferred default for initial state ---
            selectedVoiceId: preferredDefaultVoiceId // Set initial default based on preference
            // --- MODIFICATION END ---
        };

        // 1. Try loading from localStorage
        try {
            const storedSettings = localStorage.getItem('userAppSettings');
            if (storedSettings) {
                const parsed = JSON.parse(storedSettings);
                // Migrate the RAW stored doc first so the legacy->per-type passes can detect
                // which keys are genuinely absent (impossible once merged onto full defaults).
                const migratedParsed = migrateInstantFeedbackSettings(parsed);
                // Merge stored with defaults + preferred default
                loadedSettingsState = {
                    ...loadedSettingsState, // Start with defaults including preferred default voice
                    ...migratedParsed, // Overwrite with parsed (migrated) values
                    // Explicitly merge nested objects to avoid overwriting defaults partially
                    keyBindings: (parsed.keyBindings && typeof parsed.keyBindings === 'object')
                                 ? { ...loadedSettingsState.keyBindings, ...parsed.keyBindings }
                                 : loadedSettingsState.keyBindings,
                };

                // Validate split feedback booleans
                loadedSettingsState.instantFeedbackPositive = typeof loadedSettingsState.instantFeedbackPositive === 'boolean'
                    ? loadedSettingsState.instantFeedbackPositive
                    : true;
                loadedSettingsState.instantFeedbackErrors = typeof loadedSettingsState.instantFeedbackErrors === 'boolean'
                    ? loadedSettingsState.instantFeedbackErrors
                    : true;
                loadedSettingsState.instantFeedbackMisses = typeof loadedSettingsState.instantFeedbackMisses === 'boolean'
                    ? loadedSettingsState.instantFeedbackMisses
                    : true;
                loadedSettingsState.instantFeedbackNegative = typeof loadedSettingsState.instantFeedbackNegative === 'boolean'
                    ? loadedSettingsState.instantFeedbackNegative
                    : (loadedSettingsState.instantFeedbackErrors || loadedSettingsState.instantFeedbackMisses);

                // Validate the loaded selectedVoiceId against CURRENTLY available voices
                if (!parsed.selectedVoiceId || !availableVoices[parsed.selectedVoiceId]) {
                    // --- MODIFICATION START: Use preferred default on invalid localStorage ---
                    console.warn(`[SettingsContext Load] localStorage voice ID '${parsed.selectedVoiceId}' invalid or unavailable. Reverting to preferred default: '${preferredDefaultVoiceId}'.`);
                    loadedSettingsState.selectedVoiceId = preferredDefaultVoiceId; // Use preferred default if invalid
                    // --- MODIFICATION END ---
                } else {
                    loadedSettingsState.selectedVoiceId = parsed.selectedVoiceId; // Use valid stored value
                }

                // Try to detect timezone if not already set (or invalid)
                if (!parsed.timezone) {
                    try {
                        // Get timezone from browser API
                        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                        loadedSettingsState.timezone = browserTimezone;
                    } catch (e) {
                        console.warn("Error detecting browser timezone:", e);
                        loadedSettingsState.timezone = "UTC"; // Default to UTC if detection fails
                    }
                } else {
                    // If timezone is set, use it (assuming it's valid)
                    loadedSettingsState.timezone = parsed.timezone;
                }

            } else {
                 // State already initialized with defaults including preferred default voice
                 // Ensure timezone is set based on browser if not in localStorage
                 try {
                     const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                     loadedSettingsState.timezone = browserTimezone;
                 } catch (e) {
                     console.warn("Error detecting browser timezone:", e);
                     loadedSettingsState.timezone = "UTC"; // Default to UTC if detection fails
                 }
            }
        } catch (e) {
            console.error("Error loading/parsing settings from localStorage:", e);
            setError("Failed to load preferences.");
            // State uses defaults including preferred default voice
            // Ensure timezone is set based on browser if localStorage fails
            try {
                const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                loadedSettingsState.timezone = browserTimezone;
            } catch (e) {
                console.warn("Error detecting browser timezone:", e);
                loadedSettingsState.timezone = "UTC"; // Default to UTC if detection fails
            }
        }

        // Update state with result from localStorage/defaults BEFORE checking Firestore
        setSettings(loadedSettingsState);

        // 2. If logged in and profile selected, try fetching from Firestore to potentially update
        if (currentUserId && userId && isDataReady) {
            const settingsDocRef = doc(db, 'users', currentUserId, 'profiles', userId, 'profileSettings', 'settings');

            getDoc(settingsDocRef).then(docSnap => {
                let firestoreSettingsToApply = null; // Hold settings to apply after promise
                if (docSnap.exists()) {
                    const loadedData = docSnap.data();
                    // Start with the latest state (via ref to avoid stale closure) and merge Firestore data on top.
                    // Migrate the RAW Firestore doc first (same reason as the localStorage path) so legacy
                    // negative-only docs upgrade correctly while per-type keys stay authoritative.
                    const currentSettings = settingsRef.current;
                    const migratedLoaded = migrateInstantFeedbackSettings(loadedData);
                    const mergedFirestore = {
                        ...currentSettings,
                        ...migratedLoaded, // Overwrite with Firestore (migrated) data
                        // Explicitly merge/validate nested objects/specific types
                        keyBindings: (loadedData.keyBindings && typeof loadedData.keyBindings === 'object')
                                     ? { ...currentSettings.keyBindings, ...loadedData.keyBindings }
                                     : currentSettings.keyBindings,
                    };

                    // Validate split feedback booleans
                    mergedFirestore.instantFeedbackPositive = typeof mergedFirestore.instantFeedbackPositive === 'boolean'
                        ? mergedFirestore.instantFeedbackPositive
                        : true;
                    mergedFirestore.instantFeedbackErrors = typeof mergedFirestore.instantFeedbackErrors === 'boolean'
                        ? mergedFirestore.instantFeedbackErrors
                        : true;
                    mergedFirestore.instantFeedbackMisses = typeof mergedFirestore.instantFeedbackMisses === 'boolean'
                        ? mergedFirestore.instantFeedbackMisses
                        : true;
                    mergedFirestore.instantFeedbackNegative = typeof mergedFirestore.instantFeedbackNegative === 'boolean'
                        ? mergedFirestore.instantFeedbackNegative
                        : (mergedFirestore.instantFeedbackErrors || mergedFirestore.instantFeedbackMisses);

                     // Validate Firestore selectedVoiceId against CURRENT available voices
                     if (!loadedData.selectedVoiceId || !availableVoices[loadedData.selectedVoiceId]) {
                         // --- MODIFICATION START: Use preferred default on invalid Firestore data ---
                         console.warn(`[SettingsContext Load] Firestore voice ID '${loadedData.selectedVoiceId}' invalid or unavailable. Using preferred default: '${preferredDefaultVoiceId}'.`);
                         mergedFirestore.selectedVoiceId = preferredDefaultVoiceId; // Use preferred default if invalid
                         // --- MODIFICATION END ---
                     } else {
                          mergedFirestore.selectedVoiceId = loadedData.selectedVoiceId; // Use valid Firestore value
                     }

                     // Validate timezone from Firestore or fall back to current state
                     if (!loadedData.timezone) {
                         console.warn(`[SettingsContext Load] Firestore timezone is missing. Keeping current state value: '${currentSettings.timezone}'.`);
                         mergedFirestore.timezone = currentSettings.timezone; // Keep current state value
                     } else {
                         mergedFirestore.timezone = loadedData.timezone; // Use Firestore value
                     }

                    // Only mark for update if Firestore data is meaningfully different from current state
                    if (JSON.stringify(mergedFirestore) !== JSON.stringify(currentSettings)) {
                         firestoreSettingsToApply = mergedFirestore; // Mark for application outside promise chain
                    }
                } else {
                    // No Firestore doc — create with defaults
                    // Trial users get settings doc created server-side (initializeFreeUser/activateFreeTrial)
                    saveSettingsToFirestore(settingsRef.current);
                }

                // Apply Firestore changes if needed AFTER the main getDoc logic finishes
                if (firestoreSettingsToApply) {
                    setSettings(firestoreSettingsToApply);
                     try {
                        // Update localStorage with the fresher Firestore data
                        localStorage.setItem('userAppSettings', JSON.stringify(firestoreSettingsToApply));
                    } catch (e) {
                        console.error("Error updating localStorage with Firestore settings:", e);
                    }
                }

            }).catch(err => {
                console.error(`Error loading settings from Firestore for profile ${userId}:`, err);
                setError("Failed to check server for updated settings.");
                // Don't overwrite local settings if Firestore fails
            }).finally(() => {
                setIsLoading(false); // Mark loading as complete after Firestore check
                hasCompletedInitialLoadRef.current = true;
                hasAttemptedFirestoreSyncRef.current = true; // Firestore fetch was performed
            });
        } else {
            // Not logged in or no active profile, loading is finished (localStorage/defaults used)
            setIsLoading(false);
            hasCompletedInitialLoadRef.current = true;
        }
    // Re-run when user, profile, available voices, or preferred default changes
    }, [currentUserId, userId, isDataReady, availableVoices, preferredDefaultVoiceId]);


    // Function to save settings to Firestore (only if logged in and profile active)
    const saveSettingsToFirestore = useCallback(async (settingsToSave) => {
        if (!currentUserId || !userId) {
            // console.warn("[SettingsContext Save] Cannot save to Firestore: No user or active profile.");
            return false; // Cannot save without user/profile
        }

        const settingsDocRef = doc(db, 'users', currentUserId, 'profiles', userId, 'profileSettings', 'settings');
        const baseDefaults = getDefaultSettings(); // For structure reference
        let validVoiceId = null; // Start with null

        // --- MODIFICATION START: Validate against preferred default ---
        // Validate the voice ID against the *currently* available ones, using preferred default as fallback
        if (availableVoiceIds.length > 0) {
            validVoiceId = (settingsToSave.selectedVoiceId && availableVoices[settingsToSave.selectedVoiceId])
                           ? settingsToSave.selectedVoiceId
                           : preferredDefaultVoiceId; // Default to preferred if invalid/null
        }
         // else validVoiceId remains null if no voices available
        // --- MODIFICATION END ---

        try {
            // Prepare payload, ensuring structure and adding timestamp
            // Start with validated values from settingsToSave or fall back to defaults/validated voice
            const payload = {
                 keyBindings: (settingsToSave.keyBindings && typeof settingsToSave.keyBindings.visual === 'string' && typeof settingsToSave.keyBindings.audio === 'string')
                               ? settingsToSave.keyBindings
                               : baseDefaults.keyBindings,
                 // Split feedback settings
                 instantFeedbackPositive: typeof settingsToSave.instantFeedbackPositive === 'boolean'
                                          ? settingsToSave.instantFeedbackPositive
                                          : true,
                 instantFeedbackErrors: typeof settingsToSave.instantFeedbackErrors === 'boolean'
                                        ? settingsToSave.instantFeedbackErrors
                                        : true,
                 instantFeedbackMisses: typeof settingsToSave.instantFeedbackMisses === 'boolean'
                                        ? settingsToSave.instantFeedbackMisses
                                        : true,
                 // Write-only compat shadow for installed (pre-split) Android: derived from
                 // errors||misses so old clients still READ negative feedback when either type
                 // is on. NEVER read this back into the per-type keys — doing so was the
                 // daily "Errors/Misses turns itself back on" cross-client revert bug.
                 instantFeedbackNegative: (settingsToSave.instantFeedbackErrors !== false) ||
                                          (settingsToSave.instantFeedbackMisses !== false),
                 selectedVoiceId: validVoiceId, // Save the validated/defaulted voice ID
                 timezone: settingsToSave.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, // Use provided timezone or detect from browser
                 theme: ['light', 'dark', 'system'].includes(settingsToSave.theme)
                        ? settingsToSave.theme
                        : 'dark', // Default to dark for backwards compatibility
                 // Sent on EVERY settings save (like responseModes), so firestore.rules
                 // must allow 'textScale' in both hasOnly() lists before this ships or
                 // all client settings writes are denied.
                 textScale: normalizeTextScale(settingsToSave.textScale),
                 autoHideCursor: typeof settingsToSave.autoHideCursor === 'boolean'
                                 ? settingsToSave.autoHideCursor
                                 : false,
                 cohortPrivacy: (settingsToSave.cohortPrivacy && typeof settingsToSave.cohortPrivacy === 'object')
                     ? {
                         showOnlineStatus: typeof settingsToSave.cohortPrivacy.showOnlineStatus === 'boolean'
                             ? settingsToSave.cohortPrivacy.showOnlineStatus : true,
                         showGameActivity: typeof settingsToSave.cohortPrivacy.showGameActivity === 'boolean'
                             ? settingsToSave.cohortPrivacy.showGameActivity : true,
                     }
                     : { showOnlineStatus: true, showGameActivity: true },
                 difficultyAdjustmentRange: ['standard', 'accelerated', 'aggressive'].includes(settingsToSave.difficultyAdjustmentRange)
                     ? settingsToSave.difficultyAdjustmentRange : 'standard',
                 classicAutoLevel: typeof settingsToSave.classicAutoLevel === 'boolean'
                     ? settingsToSave.classicAutoLevel : true,
                 adaptiveAutoLevel: typeof settingsToSave.adaptiveAutoLevel === 'boolean'
                     ? settingsToSave.adaptiveAutoLevel : true,
                 responseModes: {
                     singleColor: ['match', 'recall'].includes(settingsToSave.responseModes?.singleColor)
                         ? settingsToSave.responseModes.singleColor : 'match',
                 },
                 updatedAt: serverTimestamp()
            };

            await setDoc(settingsDocRef, payload, { merge: true }); // Use merge: true to avoid overwriting other potential fields

            // Also save timezone to user document level (where notification system reads from)
            const userDocRef = doc(db, 'users', currentUserId);
            await setDoc(userDocRef, { timezone: payload.timezone, updatedAt: serverTimestamp() }, { merge: true });

            return true;
        } catch (err) {
            console.error(`Error saving settings to Firestore for profile ${userId}:`, err);
            setError("Failed to save settings to your account.");
            return false;
        }
    // --- MODIFICATION START: Add voice/preferred default dependencies ---
    }, [currentUserId, userId, availableVoices, availableVoiceIds, preferredDefaultVoiceId]); // Add voice dependencies
    // --- MODIFICATION END ---


    // Action function exposed to components for updating a single setting
    // Wrapped in useCallback for stability
    const updateSetting = useCallback((key, value) => {
        // Use functional update to ensure we're working with the latest state
        setSettings(prevSettings => {
            const newSettings = { ...prevSettings, [key]: value };

            // Update localStorage immediately
            try {
                localStorage.setItem('userAppSettings', JSON.stringify(newSettings));
                 // console.log(`SettingsContext: Updated '${key}' locally and in localStorage.`); // Reduce noise
            } catch (e) {
                 console.error("Error saving settings to localStorage:", e);
                 setError("Failed to save preference locally.");
                 // Consider if you should return prevSettings here to revert optimistic update
            }

            // Attempt to save to Firestore in the background (debouncing could be added)
            saveSettingsToFirestore(newSettings); // Fire-and-forget Firestore save

            return newSettings; // Return the new state for React to use
        });

    }, [saveSettingsToFirestore]); // Dependency: only the save function


    // Effect to apply theme class to document.documentElement
    useEffect(() => {
        const applyTheme = (themeSetting) => {
            const root = document.documentElement;

            if (themeSetting === 'system') {
                // Check system preference
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                root.classList.toggle('dark', prefersDark);
            } else {
                // Apply light or dark theme directly
                root.classList.toggle('dark', themeSetting === 'dark');
            }
        };

        // Apply the current theme
        const currentTheme = settings.theme || 'dark';
        applyTheme(currentTheme);

        // Listen for system preference changes if theme is 'system'
        if (currentTheme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = () => applyTheme('system');
            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
        }
    }, [settings.theme]);


    // Effect to apply the Text Size attribute to document.documentElement.
    //
    // Gated on isLoading. `settings` is seeded with getDefaultSettings() (textScale
    // 'default') and only picks up the stored value inside the async load effect
    // above — so running this on the first commit would call applyTextScale('default')
    // and strip the attribute the pre-paint script in public/index.html had already
    // stamped, flashing the page back to 100% before re-applying it a tick later.
    // Waiting for the load to settle means the boot-script attribute survives
    // untouched, and a user with no stored setting still ends up with no attribute.
    useEffect(() => {
        if (isLoading) return;
        applyTextScale(settings.textScale);
    }, [settings.textScale, isLoading]);


    // Assemble the final context value object using useMemo
    const value = useMemo(() => ({
        settings,
        updateSetting, // Provide the function to update a single setting
        isLoading, // Expose loading state
        error, // Expose error state
        availableVoices: availableVoices, // Expose the memoized available voices object
        // Removed resetSettings as updateSetting handles individual changes
        // Removed updateSettings (plural) as updateSetting (singular) is preferred
    }), [settings, updateSetting, isLoading, error, availableVoices]); // Dependencies for memoization

    // Render the provider, passing the context value to its children
    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};
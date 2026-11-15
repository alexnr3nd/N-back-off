/* src/contexts/user/userActionsCRUD.js */
import { useCallback } from 'react';
import {
    collection, doc, addDoc, updateDoc, deleteDoc, writeBatch,
    serverTimestamp, Timestamp, arrayUnion, increment
} from 'firebase/firestore';
import { db as firestoreDb } from '../../firebaseConfig';
import { DEFAULT_USER_DATA } from './userConstants';

// --- Constants (Copied or Imported if moved) ---
const MAX_PROFILES_PER_USER = 6;

/**
 * Hook creator for Profile Add action.
 */
export const useCreateAddProfileAction = (
    authUserRef,
    profiles, // Read-only state needed for length check
    setError,
    setProfileUsernameFn // Cloud function reference
) => {
    return useCallback(async (profileData) => {
        const currentUserId = authUserRef.current?.uid;
        if (!currentUserId) {
            setError("Authentication required to add a profile.");
            console.error("addProfile Error: User not authenticated.");
            return null;
        }

        const rawUsername = profileData?.username;
        const trimmedUsername = rawUsername?.trim();
        if (!trimmedUsername || trimmedUsername.length < 3 || trimmedUsername.length > 25 || !/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
            setError("Invalid username format (3-25 chars, a-z, A-Z, 0-9, _, -).");
            console.error("addProfile Error: Invalid username format.", { username: rawUsername });
            return null;
        }

        if (profiles.length >= MAX_PROFILES_PER_USER) {
            setError(`Maximum profiles reached (${MAX_PROFILES_PER_USER}).`);
            console.error("addProfile Error: Max profiles reached.");
            return null;
        }

        if (!setProfileUsernameFn) {
             setError("Profile creation service is currently unavailable. Please try again later.");
             console.error("addProfile Error: setProfileUsernameFn is not available.");
             return null;
        }

        setError(null);
        const db = firestoreDb;
        const profilesCollectionRef = collection(db, 'users', currentUserId, 'profiles');
        const newProfileRef = doc(profilesCollectionRef);
        const profileId = newProfileRef.id;

        const initialProfileData = {
             userId: currentUserId,
             createdAt: serverTimestamp(),
             updatedAt: serverTimestamp(),
             currentNBack: DEFAULT_USER_DATA.currentNBack,
             currentDifficulty: DEFAULT_USER_DATA.currentDifficulty,
             highestNBack: DEFAULT_USER_DATA.highestNBack,
             consecutiveSuccesses: DEFAULT_USER_DATA.consecutiveSuccesses,
             cstHistory: DEFAULT_USER_DATA.cstHistory,
             tutorialsCompleted: DEFAULT_USER_DATA.tutorialsCompleted,
             cstFamiliarizationCount: DEFAULT_USER_DATA.cstFamiliarizationCount,
             lastCstAssessmentTimestamp: DEFAULT_USER_DATA.lastCstAssessmentTimestamp,
             // --- NEW FIELD INITIALIZATION (already present and verified) ---
             highestNBackGood: DEFAULT_USER_DATA.highestNBackGood,
             highestAchievedGoodSessionId: DEFAULT_USER_DATA.highestAchievedGoodSessionId,
             previousNBackLevelDifficulties: DEFAULT_USER_DATA.previousNBackLevelDifficulties,
        };

        try {
            const initialBatch = writeBatch(db);
            initialBatch.set(newProfileRef, initialProfileData);
            await initialBatch.commit();
            const result = await setProfileUsernameFn({
                profileId: profileId,
                newUsername: rawUsername
            });

            if (!result?.data?.success) {
                const funcErrorMsg = result?.data?.message || "Failed to set username during profile creation.";
                console.error(`addProfile: setProfileUsername Cloud Function failed for profile ${profileId}. Reason: ${funcErrorMsg}`, result?.data);
                setError(funcErrorMsg);
                console.warn(`addProfile: Attempting to delete partially created profile ${profileId} due to username function failure.`);
                try { await deleteDoc(newProfileRef); } catch (cleanupError) { console.error(`addProfile: Failed to cleanup profile ${profileId} after username error:`, cleanupError); }
                return null;
            }

            const sanitizedUsername = result.data.username;

            const finalProfileData = {
                ...initialProfileData,
                id: profileId,
                username: sanitizedUsername,
                createdAt: new Date().toISOString(), // Approximation
                updatedAt: new Date().toISOString(), // Approximation
            };
            // Adjust approximation if needed (listener will override)
             if (initialProfileData.createdAt instanceof Timestamp) finalProfileData.createdAt = initialProfileData.createdAt.toDate().toISOString();
             if (initialProfileData.updatedAt instanceof Timestamp) finalProfileData.updatedAt = initialProfileData.updatedAt.toDate().toISOString();
             if (!(finalProfileData.createdAt)) finalProfileData.createdAt = new Date().toISOString();
             if (!(finalProfileData.updatedAt)) finalProfileData.updatedAt = new Date().toISOString();

            return finalProfileData; // Listener will update state

        } catch (error) {
            console.error(`addProfile: Error during profile creation process for user ${currentUserId}:`, error);
            if (!error?.message?.includes("Failed to set username")) {
                 if (error.code === 'permission-denied' || error.message?.includes('PERMISSION_DENIED')) {
                     setError("Failed to create profile shell. Check Firestore rules and data.")
                 } else {
                     setError(error.message || "An unexpected error occurred during profile creation.");
                 }
            }
            return null;
        }
    // Dependencies for the outer useCallback created in ProfileContext.js will include these
    }, [authUserRef, profiles, setError, setProfileUsernameFn]);
};

/**
 * Hook creator for Set Profile Username action.
 */
export const useCreateSetProfileUsernameAction = (
    authUserRef,
    setError,
    setProfileUsernameFn
) => {
    return useCallback(async (profileId, username) => {
        const currentUserId = authUserRef.current?.uid;
        if (!currentUserId || !profileId) {
            setError("Authentication or profile ID missing.");
            console.error("setProfileUsername Error: Auth/profile ID missing.");
            return false;
        }
        const name = username?.trim();
        if (!name || name.length < 3 || name.length > 25) {
             setError("Invalid username format (3-25 chars).");
             console.error("setProfileUsername Error: Invalid username format.", { username: username });
             return false;
        }
        if (!setProfileUsernameFn) {
             setError("Username setting service is currently unavailable.");
             console.error("setProfileUsername Error: setProfileUsernameFn is not available.");
             return false;
        }

        setError(null);

        try {
             const result = await setProfileUsernameFn({
                 profileId: profileId,
                 newUsername: name
             });

             if (result?.data?.success) {
                 const sanitizedUsername = result.data.username;
                 // Listener will update state
                 return true;
             } else {
                 const funcErrorMsg = result?.data?.message || "Failed to save username. It might be taken.";
                 console.error(`setProfileUsername: Cloud function failed for profile ${profileId}. Reason: ${funcErrorMsg}`, result?.data);
                 setError(funcErrorMsg);
                 return false;
             }
        } catch (error) {
            console.error(`setProfileUsername: Error calling cloud function for profile ${profileId}:`, error);
            const errorMessage = error.message || "An unexpected server error occurred while setting username.";
            setError(prev => prev || errorMessage);
            return false;
        }
    }, [authUserRef, setError, setProfileUsernameFn]);
};

/**
 * Hook creator for Update Profile Progress action.
 * Updated to support mode-specific progression (modeProgression.{mode}.{field}).
 * Updates only the active game mode's progression, not root-level fields.
 */
export const useCreateUpdateProfileProgressAction = (
    authUserRef,
    activeGameModeRef, // Ref to current game mode ('dual', 'triple', 'quad')
    setUserData, // Updates user data directly
    setError
) => {
    // profileId is kept for backward compatibility but ignored - we update user doc directly
    return useCallback(async (profileId, progressData) => {
        const currentUserId = authUserRef.current?.uid;
        // Allow progressData.gameMode to override activeGameModeRef (used by settings page)
        const targetGameMode = progressData?.gameMode || activeGameModeRef.current || 'dual';

        if (!currentUserId || typeof progressData !== 'object' || progressData === null) {
            setError("Invalid progress data.");
            console.error("updateProfileProgress Error: Invalid input", { currentUserId, progressData });
            return false;
        }
        setError(null);

        // Keys that belong in mode-specific progression
        const modeProgressionKeys = [
            'currentNBack', 'currentDifficulty', 'highestNBack', 'consecutiveSuccesses',
            'previousNBackLevelDifficulties', 'currentSubMode'
        ];
        // Keys that remain at root level (not mode-specific)
        const rootLevelKeys = [
            'highestNBackGood', 'highestAchievedGoodSessionId'
        ];

        const payload = { updatedAt: serverTimestamp() };
        let modeProgressionUpdates = {};
        let rootLevelUpdates = {};
        let validUpdateFound = false;

        // Process mode-specific progression keys
        for (const key of modeProgressionKeys) {
            if (Object.prototype.hasOwnProperty.call(progressData, key)) {
                if (key === 'previousNBackLevelDifficulties') {
                    if (typeof progressData[key] === 'object' && progressData[key] !== null) {
                        modeProgressionUpdates[key] = progressData[key];
                        validUpdateFound = true;
                    } else if (progressData[key] === null) {
                        modeProgressionUpdates[key] = {};
                        validUpdateFound = true;
                        console.warn(`[ProfileProgress] progressData.previousNBackLevelDifficulties was null, setting to {}.`);
                    } else {
                        console.warn(`[ProfileProgress] Invalid type for previousNBackLevelDifficulties:`, progressData[key]);
                    }
                } else if (key === 'currentSubMode' && typeof progressData[key] === 'string') {
                    modeProgressionUpdates[key] = progressData[key];
                    validUpdateFound = true;
                } else if (typeof progressData[key] === 'number' && !isNaN(progressData[key])) {
                    modeProgressionUpdates[key] = progressData[key];
                    validUpdateFound = true;
                } else {
                    console.warn(`[ProfileProgress] Field '${key}' in progressData was not a valid number:`, progressData[key]);
                }
            }
        }

        // Process root-level keys (not mode-specific)
        for (const key of rootLevelKeys) {
            if (Object.prototype.hasOwnProperty.call(progressData, key)) {
                if (progressData[key] === null || typeof progressData[key] === 'number' || typeof progressData[key] === 'string') {
                    rootLevelUpdates[key] = progressData[key];
                    payload[key] = progressData[key];
                    validUpdateFound = true;
                } else {
                    console.warn(`[ProfileProgress] Invalid type for ${key}:`, progressData[key]);
                }
            }
        }

        if (!validUpdateFound) {
            console.warn("[ProfileProgress] No valid fields found in progressData for update.", progressData);
            if (Object.keys(progressData).length === 0) return true;
            console.error("[ProfileProgress] progressData contained keys, but none were valid for update.", progressData);
            setError("Invalid progress data fields provided.");
            return false;
        }

        // Route to classicProgression or modeProgression
        const isClassicUpdate = progressData?.trainingMode === 'classic';
        const progressionRoot = isClassicUpdate ? 'classicProgression' : 'modeProgression';

        // Build Firestore payload with dot notation for nested progression fields
        for (const [key, value] of Object.entries(modeProgressionUpdates)) {
            payload[`${progressionRoot}.${targetGameMode}.${key}`] = value;
        }

        const db = firestoreDb;
        try {
            // Update local state first for responsiveness
            const stateKey = progressionRoot;
            setUserData(prev => {
                const prevModeProgression = prev[stateKey] || {};
                const prevModeData = prevModeProgression[targetGameMode] || {};
                return {
                    ...prev,
                    ...rootLevelUpdates,
                    [stateKey]: {
                        ...prevModeProgression,
                        [targetGameMode]: {
                            ...prevModeData,
                            ...modeProgressionUpdates
                        }
                    },
                    updatedAt: new Date().toISOString()
                };
            });

            // Update user doc with dot notation for nested fields
            const userRef = doc(db, 'users', currentUserId);
            await updateDoc(userRef, payload);
            return true;
        } catch (err) {
            console.error(`[ProfileProgress] Error updating user ${currentUserId}:`, err, "Payload:", payload);
            setError(`Progress save failed: ${err.message}`);
            // Revert is handled by listener eventually
            console.warn(`[ProfileProgress] Revert of local state attempted after Firestore error. Listener should correct.`);
            return false;
        }
    }, [authUserRef, activeGameModeRef, setUserData, setError]);
};

/**
 * Hook creator for Remove Profile action.
 */
export const useCreateRemoveProfileAction = (
    authUserRef,
    activeProfileIdState, // Read-only state needed
    profiles, // Read-only state needed
    selectProfile, // Action needed
    setError,
    deleteProfileAndCleanupFn
) => {
    return useCallback(async (profileId) => {
        const currentUserId = authUserRef.current?.uid;
        if (!currentUserId || !profileId) {
            setError("Cannot remove: Invalid ID/Auth.");
            return false;
        }
        if (!deleteProfileAndCleanupFn) {
            setError("Deletion service unavailable.");
            return false;
        }
        setError(null);

        let nextActiveProfileId = null;
        if (activeProfileIdState === profileId) {
             if (profiles.length > 1) {
                 const fallbackProfile = profiles.find(p => p.id !== profileId);
                 nextActiveProfileId = fallbackProfile ? fallbackProfile.id : null;
             } else {
                 nextActiveProfileId = null;
             }
        } else {
             nextActiveProfileId = activeProfileIdState;
        }

        try {
             const result = await deleteProfileAndCleanupFn({ profileId: profileId });
             if (!result?.data?.success) throw new Error(result?.data?.message || "Backend deletion failed.");
             // Select profile handles state, localStorage, Firestore update
             await selectProfile(nextActiveProfileId);
             // Listener will remove the profile from local state
             return true;
        } catch (err) {
             console.error(`[removeProfile] Error deleting ${profileId}:`, err);
             setError(err.message || "Deletion failed.");
             return false;
        }
    }, [authUserRef, activeProfileIdState, profiles, selectProfile, setError, deleteProfileAndCleanupFn]);
};

/**
 * Hook creator for Mark Tutorial Completed action.
 * Updated for flattened user structure - updates user doc directly.
 */
export const useCreateMarkTutorialCompletedAction = (
    authUserRef,
    setUserData, // Now updates user data directly (not profiles array)
    setError
) => {
    // profileId is kept for backward compatibility but ignored - we update user doc directly
    return useCallback(async (profileId, tutorialKey) => {
        const currentUserId = authUserRef.current?.uid;
        if (!currentUserId || !tutorialKey) {
            console.error("[markTutorial] Missing data.");
            return false;
        }
        const fieldPath = `tutorialsCompleted.${tutorialKey}`;
        const userDocRef = doc(firestoreDb, 'users', currentUserId);
        try {
            await updateDoc(userDocRef, { [fieldPath]: true, updatedAt: serverTimestamp() });
            // Update local state directly (now updates userData object)
            setUserData(prev => {
                const currentTutorials = (typeof prev.tutorialsCompleted === 'object' && prev.tutorialsCompleted !== null) ? prev.tutorialsCompleted : {};
                return {
                    ...prev,
                    tutorialsCompleted: { ...currentTutorials, [tutorialKey]: true },
                    updatedAt: new Date().toISOString()
                };
            });
            return true;
        } catch (error) {
            console.error(`[markTutorial] Error marking '${tutorialKey}':`, error);
            setError(`Failed to update tutorial status: ${error.message}`);
            return false;
        }
    }, [authUserRef, setUserData, setError]);
};
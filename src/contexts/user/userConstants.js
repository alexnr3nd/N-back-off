/* src/contexts/user/userConstants.js */

export const LOCAL_STORAGE_KEY = 'dualNBackActiveProfileId'; // Legacy key name preserved for compatibility
export const MAX_PROFILES_PER_USER = 6; // Legacy constant, no longer used

export const DEFAULT_USER_DATA = {
    // No username here by default in the structure for Firestore creation
    currentNBack: 2,
    currentDifficulty: 0.0,
    highestNBack: 2,
    consecutiveSuccesses: 0,
    cstHistory: [],
    tutorialsCompleted: {},
    cstFamiliarizationCount: 0,
    lastCstAssessmentTimestamp: null,
    // --- NEW FIELD ---
    previousNBackLevelDifficulties: {}, // Stores { nLevel: difficulty (0.00-0.99) }
    // --- NEW FIELDS FOR HIGHEST N-BACK GOOD (already present from previous work, verified) ---
    highestNBackGood: null, // Stores the N-back level (e.g., 3) at which a "Good" or better score was first achieved.
    highestAchievedGoodSessionId: null, // Stores the sessionId of the session where highestNBackGood was achieved.
    createdAt: null, // Set by serverTimestamp or loaded
    updatedAt: null, // Set by serverTimestamp or loaded
};

/** @deprecated Use DEFAULT_USER_DATA instead */
export const DEFAULT_PROFILE_DATA = DEFAULT_USER_DATA;

// Gifted Pro access offered after this many sessions (no card required)
export const FREE_TRIAL_SESSION_THRESHOLD = 30;
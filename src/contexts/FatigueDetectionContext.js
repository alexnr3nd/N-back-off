/* src/contexts/FatigueDetectionContext.js */
import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useMemo,
    useRef,
    useEffect
} from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { functions, db } from '../firebaseConfig';
import { useUser } from './UserContext';

// Detection thresholds
const BASE_THRESHOLD = 40; // Base threshold (40 sessions)
const TIME_GAP_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const DPRIME_DECLINE_THRESHOLD = 0.3; // D-prime drop that indicates fatigue
const RE_TRIGGER_INTERVAL = 5; // Show warning every N sessions after dismissal

// NEW: Readiness-based detection threshold
// Show fatigue warning when readiness score falls below this value
const READINESS_WARNING_THRESHOLD = 40; // Recovery zone (0-39)

// Dynamic threshold tiers based on warnings in last 8 hours
// 0 warnings → 40 sessions, 1 warning → 35 sessions, 2+ warnings → 30 sessions
const THRESHOLD_TIERS = [
    { minWarnings: 0, threshold: BASE_THRESHOLD },           // 40 sessions
    { minWarnings: 1, threshold: BASE_THRESHOLD - 5 },       // 35 sessions
    { minWarnings: 2, threshold: BASE_THRESHOLD - 10 },      // 30 sessions
];
const THRESHOLD_WINDOW_MS = 8 * 60 * 60 * 1000; // 8 hours

// Cloud function for logging fatigue warnings
const logFatigueWarningFn = httpsCallable(functions, 'logFatigueWarning');

/**
 * Context for detecting cognitive fatigue during extended play sessions.
 * Uses a Bayesian readiness system for personalized fatigue detection:
 * - Primary: Readiness score < 40 triggers warning (Recovery zone)
 * - Fallback: Legacy consecutive session + d-prime decline detection
 */
const FatigueDetectionContext = createContext({
    consecutiveSessionCount: 0,
    shouldShowFatigueWarning: false,
    currentThreshold: BASE_THRESHOLD,
    declineData: null,
    readinessScore: null, // NEW: Current readiness score
    isReadinessBased: false, // NEW: Whether warning was triggered by readiness
    recordSessionCompletion: () => {},
    dismissFatigueWarning: () => {},
    handleTakeBreak: () => {},
    updateReadinessScore: () => {}, // NEW: Called by components with access to readiness
});

/**
 * Calculates overall trajectory data for display purposes.
 * Filters to only sessions matching the current game mode, then compares
 * first half vs second half.
 * Returns decline data object with level range context, including whether
 * this represents true diminishing returns (level stagnant/declined AND d' declined).
 */
function calculateOverallTrajectory(sittingSessions, currentGameMode) {
    // Filter to only sessions matching the current game mode
    const filteredSessions = currentGameMode
        ? sittingSessions.filter(s => s.gameMode === currentGameMode)
        : sittingSessions;

    if (filteredSessions.length < 6) {
        return null;
    }

    const halfPoint = Math.floor(filteredSessions.length / 2);
    const firstHalf = filteredSessions.slice(0, halfPoint);
    const secondHalf = filteredSessions.slice(halfPoint);

    if (firstHalf.length === 0 || secondHalf.length === 0) {
        return null;
    }

    const earlyAvgDprime = firstHalf.reduce((sum, s) => sum + s.overallDprime, 0) / firstHalf.length;
    const recentAvgDprime = secondHalf.reduce((sum, s) => sum + s.overallDprime, 0) / secondHalf.length;
    const declineAmount = earlyAvgDprime - recentAvgDprime;

    // Calculate average n-back level (N.DD format) for early and recent
    // difficulty is stored as 0-1, so we add it directly to nBack
    const calcAvgLevel = (sessions) => {
        const avgNBack = sessions.reduce((sum, s) => sum + s.nBack, 0) / sessions.length;
        const avgDiff = sessions.reduce((sum, s) => sum + s.difficulty, 0) / sessions.length;
        return avgNBack + avgDiff;
    };
    const earlyAvgLevelNum = calcAvgLevel(firstHalf);
    const recentAvgLevelNum = calcAvgLevel(secondHalf);

    // Calculate level range (N.DD format)
    const levels = filteredSessions.map(s => {
        const diffHundredths = Math.round(s.difficulty * 100);
        return s.nBack + (diffHundredths / 100);
    });
    const minLevel = Math.min(...levels);
    const maxLevel = Math.max(...levels);

    // Format levels as N.DD strings
    const formatLevel = (level) => {
        const nBack = Math.floor(level);
        const diff = Math.round((level - nBack) * 100);
        return `${nBack}.${diff.toString().padStart(2, '0')}`;
    };

    // TRUE diminishing returns = level dropped/stagnant AND d' dropped
    // If they're progressing to higher levels, lower d' is expected
    const levelDeclined = recentAvgLevelNum <= earlyAvgLevelNum;
    const dprimeDeclined = declineAmount >= DPRIME_DECLINE_THRESHOLD;
    const isTrueDiminishingReturns = levelDeclined && dprimeDeclined;

    return {
        totalSessions: filteredSessions.length,
        gameMode: currentGameMode,
        levelRangeMin: formatLevel(minLevel),
        levelRangeMax: formatLevel(maxLevel),
        earlyAvgDprime: parseFloat(earlyAvgDprime.toFixed(2)),
        recentAvgDprime: parseFloat(recentAvgDprime.toFixed(2)),
        earlyAvgLevel: formatLevel(earlyAvgLevelNum),
        recentAvgLevel: formatLevel(recentAvgLevelNum),
        earlyAvgLevelNum,
        recentAvgLevelNum,
        declineAmount: parseFloat(declineAmount.toFixed(2)),
        earlySessions: firstHalf.length,
        recentSessions: secondHalf.length,
        levelDeclined,
        dprimeDeclined,
        isTrueDiminishingReturns,
    };
}

/**
 * Calculates the current threshold based on number of warnings in the time window.
 */
function calculateThreshold(warningCount) {
    // Find the highest tier that matches
    for (let i = THRESHOLD_TIERS.length - 1; i >= 0; i--) {
        if (warningCount >= THRESHOLD_TIERS[i].minWarnings) {
            return THRESHOLD_TIERS[i].threshold;
        }
    }
    return BASE_THRESHOLD;
}

export function FatigueDetectionProvider({ children }) {
    // Get user ID from profile context
    const { authUser } = useUser();
    const userId = authUser?.uid;

    // State for tracking consecutive sessions in current sitting
    const [consecutiveSessionCount, setConsecutiveSessionCount] = useState(0);
    const [shouldShowFatigueWarning, setShouldShowFatigueWarning] = useState(false);
    const [currentThreshold, setCurrentThreshold] = useState(BASE_THRESHOLD);
    const [declineData, setDeclineData] = useState(null);
    const [recentWarningsCount, setRecentWarningsCount] = useState(0);

    // NEW: Readiness-based detection state
    const [readinessScore, setReadinessScore] = useState(null);
    const [isReadinessBased, setIsReadinessBased] = useState(false);
    const lastReadinessWarningAtRef = useRef(null); // Prevent spamming

    // Refs for tracking without causing re-renders
    const lastSessionTimestampRef = useRef(null);
    const currentSittingSessionsRef = useRef([]);
    const lastWarningShownAtSessionCountRef = useRef(null);
    const hasLoggedShownRef = useRef(false); // Track if we've logged the 'shown' event
    const hasFetchedWarningsRef = useRef(false); // Track if we've fetched warnings

    /**
     * Fetches recent warnings from Firestore to calculate dynamic threshold.
     */
    const fetchRecentWarnings = useCallback(async () => {
        if (!userId) return;

        try {
            const twelveHoursAgo = new Date(Date.now() - THRESHOLD_WINDOW_MS);
            const warningsRef = collection(db, `users/${userId}/fatigueWarnings`);
            const warningsQuery = query(
                warningsRef,
                where('timestamp', '>=', Timestamp.fromDate(twelveHoursAgo)),
                where('action', '==', 'shown')
            );

            const snapshot = await getDocs(warningsQuery);
            const count = snapshot.size;

            setRecentWarningsCount(count);
            setCurrentThreshold(calculateThreshold(count));
        } catch (error) {
            console.error('[FatigueDetection] Failed to fetch recent warnings:', error);
            // Fall back to base threshold on error
            setCurrentThreshold(BASE_THRESHOLD);
        }
    }, [userId]);

    // Fetch recent warnings on mount and when userId changes
    useEffect(() => {
        if (userId && !hasFetchedWarningsRef.current) {
            hasFetchedWarningsRef.current = true;
            fetchRecentWarnings();
        }
    }, [userId, fetchRecentWarnings]);

    /**
     * Logs a fatigue warning event to the backend.
     */
    const logWarningEvent = useCallback(async (action, count) => {
        try {
            await logFatigueWarningFn({ action, consecutiveCount: count });
            // If we logged a 'shown' event, increment local count and recalculate threshold
            if (action === 'shown') {
                const newCount = recentWarningsCount + 1;
                setRecentWarningsCount(newCount);
                setCurrentThreshold(calculateThreshold(newCount));
            }
        } catch (error) {
            console.error('[FatigueDetection] Failed to log warning event:', error);
        }
    }, [recentWarningsCount]);

    // Log when warning is shown
    useEffect(() => {
        if (shouldShowFatigueWarning && !hasLoggedShownRef.current) {
            hasLoggedShownRef.current = true;
            logWarningEvent('shown', consecutiveSessionCount);
        } else if (!shouldShowFatigueWarning) {
            hasLoggedShownRef.current = false;
        }
    }, [shouldShowFatigueWarning, consecutiveSessionCount, logWarningEvent]);

    /**
     * Records completion of a session and evaluates fatigue conditions.
     * Called from GameResults when new results are received.
     */
    const recordSessionCompletion = useCallback((sessionData) => {
        if (!sessionData || typeof sessionData.overallDprime !== 'number') {
            return;
        }

        const now = Date.now();
        const lastTimestamp = lastSessionTimestampRef.current;
        const gameMode = sessionData.gameMode || 'dual';

        // Check if this session is part of the same sitting (within time gap)
        let newConsecutiveCount;
        if (lastTimestamp && (now - lastTimestamp) <= TIME_GAP_THRESHOLD_MS) {
            // Same sitting - increment count and add to sessions array
            newConsecutiveCount = consecutiveSessionCount + 1;
            currentSittingSessionsRef.current.push({
                nBack: sessionData.nBack,
                difficulty: sessionData.difficulty,
                overallDprime: sessionData.overallDprime,
                gameMode,
                timestamp: now
            });
        } else {
            // New sitting - reset everything
            newConsecutiveCount = 1;
            currentSittingSessionsRef.current = [{
                nBack: sessionData.nBack,
                difficulty: sessionData.difficulty,
                overallDprime: sessionData.overallDprime,
                gameMode,
                timestamp: now
            }];
            lastWarningShownAtSessionCountRef.current = null;
        }

        // Update state and timestamp
        setConsecutiveSessionCount(newConsecutiveCount);
        lastSessionTimestampRef.current = now;

        // Evaluate if warning should be shown
        const { shouldWarn, detectedDeclineData } = evaluateWarningConditions(
            newConsecutiveCount,
            currentSittingSessionsRef.current,
            lastWarningShownAtSessionCountRef.current,
            currentThreshold,
            gameMode
        );

        if (detectedDeclineData) {
            setDeclineData(detectedDeclineData);
        }
        setShouldShowFatigueWarning(shouldWarn);

    }, [consecutiveSessionCount, currentThreshold]);

    /**
     * Evaluates all conditions to determine if warning should be shown.
     * Triggers when BOTH conditions are met:
     * 1. Average N.DD level in second half <= first half (not progressing)
     * 2. D-prime dropped by >= DPRIME_DECLINE_THRESHOLD
     *
     * Only compares sessions within the same game mode to avoid false positives
     * when switching between dual/triple/quad.
     */
    function evaluateWarningConditions(count, sittingSessions, lastWarningAt, threshold, currentGameMode) {
        // Condition 1: Minimum consecutive sessions (using dynamic threshold)
        if (count < threshold) {
            return { shouldWarn: false, detectedDeclineData: null };
        }

        // Condition 2: Don't re-show too frequently after dismissal
        if (lastWarningAt !== null) {
            const sessionsSinceLastWarning = count - lastWarningAt;
            if (sessionsSinceLastWarning < RE_TRIGGER_INTERVAL) {
                return { shouldWarn: false, detectedDeclineData: null };
            }
        }

        // Condition 3: Calculate overall trajectory and check for TRUE diminishing returns
        // (both level stagnant/dropped AND d' dropped)
        // Only considers sessions matching the current game mode
        const trajectoryData = calculateOverallTrajectory(sittingSessions, currentGameMode);

        if (!trajectoryData) {
            // Not enough sessions for analysis
            return { shouldWarn: false, detectedDeclineData: null };
        }

        if (trajectoryData.isTrueDiminishingReturns) {
            return { shouldWarn: true, detectedDeclineData: trajectoryData };
        }

        return { shouldWarn: false, detectedDeclineData: null };
    }

    /**
     * Dismisses the fatigue warning when user chooses to continue.
     * Logs 'continued' action and records when warning was shown.
     */
    const dismissFatigueWarning = useCallback(() => {
        logWarningEvent('continued', consecutiveSessionCount);
        lastWarningShownAtSessionCountRef.current = consecutiveSessionCount;
        lastReadinessWarningAtRef.current = Date.now(); // Also record for readiness-based
        setShouldShowFatigueWarning(false);
        setIsReadinessBased(false);
    }, [consecutiveSessionCount, logWarningEvent]);

    /**
     * Called when user chooses to take a break.
     * Logs 'took_break' action and dismisses the warning.
     */
    const handleTakeBreak = useCallback(() => {
        logWarningEvent('took_break', consecutiveSessionCount);
        lastWarningShownAtSessionCountRef.current = consecutiveSessionCount;
        lastReadinessWarningAtRef.current = Date.now(); // Also record for readiness-based
        setShouldShowFatigueWarning(false);
        setIsReadinessBased(false);
    }, [consecutiveSessionCount, logWarningEvent]);

    /**
     * NEW: Update readiness score from external source (useReadinessScore hook).
     * Called by components that have access to the readiness score.
     * Evaluates if warning should be shown based on low readiness.
     */
    const updateReadinessScore = useCallback((newScore) => {
        if (newScore === null || newScore === undefined) return;

        setReadinessScore(newScore);

        // Check if readiness is in recovery zone (< 40)
        if (newScore < READINESS_WARNING_THRESHOLD) {
            // Prevent spamming: don't show if we showed in the last 30 minutes
            const now = Date.now();
            const lastWarningTime = lastReadinessWarningAtRef.current;
            const MIN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

            if (!lastWarningTime || (now - lastWarningTime) > MIN_INTERVAL_MS) {
                setIsReadinessBased(true);
                setShouldShowFatigueWarning(true);
                lastReadinessWarningAtRef.current = now;
            } else {
            }
        }
    }, []);

    // Memoize context value
    const value = useMemo(() => ({
        consecutiveSessionCount,
        shouldShowFatigueWarning,
        currentThreshold,
        declineData,
        readinessScore,
        isReadinessBased,
        recordSessionCompletion,
        dismissFatigueWarning,
        handleTakeBreak,
        updateReadinessScore,
    }), [
        consecutiveSessionCount,
        shouldShowFatigueWarning,
        currentThreshold,
        declineData,
        readinessScore,
        isReadinessBased,
        recordSessionCompletion,
        dismissFatigueWarning,
        handleTakeBreak,
        updateReadinessScore,
    ]);

    return (
        <FatigueDetectionContext.Provider value={value}>
            {children}
        </FatigueDetectionContext.Provider>
    );
}

export function useFatigueDetection() {
    return useContext(FatigueDetectionContext);
}

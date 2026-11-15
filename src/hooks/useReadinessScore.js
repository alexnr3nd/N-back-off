// src/hooks/useReadinessScore.js

/**
 * Hook to fetch and manage the user's readiness score from the backend.
 * The readiness score is calculated using a Bayesian algorithm that considers:
 * - Historical performance normalized across difficulty levels
 * - Cognitive load (acute vs chronic training load ratio)
 * - Ratchet mechanism to prevent downward spirals
 *
 * Calibration Phases (based on session count):
 * - Stage 1 (0 sessions): Initialization - no personalized data yet
 * - Stage 2 (1-5 sessions): Mapping - building initial baseline
 * - Stage 3 (6-10 sessions): Refining - improving accuracy
 * - Personalized (10+ sessions): Full personalization active
 */

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useUser } from '../contexts/UserContext';

const functions = getFunctions();
const getReadinessStateFn = httpsCallable(functions, 'getReadinessState');

// Calibration phase thresholds
export const CALIBRATION_PHASES = {
    INITIALIZATION: { min: 0, max: 0, label: 'Initializing' },
    MAPPING: { min: 1, max: 5, label: 'Calibrating' },
    REFINING: { min: 6, max: 10, label: 'Refining' },
    PERSONALIZED: { min: 11, max: Infinity, label: null }, // Uses zone label
};

// Readiness zone configuration
export const READINESS_ZONES = {
    HIGH: { min: 81, max: 100, color: 'neural-dendrite', label: 'High Readiness' },
    OPTIMAL: { min: 60, max: 80, color: 'amber-accent', label: 'Optimal Zone' },
    APPROACHING: { min: 40, max: 59, color: 'neural-pulse', label: 'Approaching Limit' },
    RECOVERY: { min: 0, max: 39, color: 'neural-focus', label: 'Recovery Mode' }
};

// Get calibration phase based on session count
export function getCalibrationPhase(sessionCount) {
    if (sessionCount === 0) return CALIBRATION_PHASES.INITIALIZATION;
    if (sessionCount <= 5) return CALIBRATION_PHASES.MAPPING;
    if (sessionCount <= 10) return CALIBRATION_PHASES.REFINING;
    return CALIBRATION_PHASES.PERSONALIZED;
}

// Get zone info for a given score
export function getReadinessZone(score) {
    if (score >= READINESS_ZONES.HIGH.min) return READINESS_ZONES.HIGH;
    if (score >= READINESS_ZONES.OPTIMAL.min) return READINESS_ZONES.OPTIMAL;
    if (score >= READINESS_ZONES.APPROACHING.min) return READINESS_ZONES.APPROACHING;
    return READINESS_ZONES.RECOVERY;
}

// Get message based on score AND calibration phase
export function getReadinessMessage(score, sessionCount = 0) {
    const phase = getCalibrationPhase(sessionCount);

    // Calibration phase messages (new users)
    if (phase === CALIBRATION_PHASES.INITIALIZATION) {
        return "Initializing neural baseline. Complete sessions to calibrate.";
    }
    if (phase === CALIBRATION_PHASES.MAPPING) {
        return "Mapping your cognitive fatigue response...";
    }
    if (phase === CALIBRATION_PHASES.REFINING) {
        return "Refining your personal performance variance...";
    }

    // Personalized messages (10+ sessions)
    const zone = getReadinessZone(score);
    switch (zone.label) {
        case 'High Readiness':
            return "Primed for challenge—great time to push for new levels.";
        case 'Optimal Zone':
            return "In the training sweet spot for working memory gains.";
        case 'Approaching Limit':
            return "Approaching cognitive limit—consider wrapping up soon.";
        case 'Recovery Mode':
            return "Recovery mode. Take a break—rest consolidates your gains.";
        default:
            return "";
    }
}

// Get the status label (either calibration phase or zone label)
export function getStatusLabel(score, sessionCount = 0) {
    const phase = getCalibrationPhase(sessionCount);
    if (phase.label) return phase.label;
    return getReadinessZone(score).label;
}

/**
 * Custom hook to fetch and manage readiness score state.
 * Now uses GLOBAL readiness (one brain for all modes).
 * @param {string} gameMode - Ignored (kept for backwards compatibility)
 * @returns {Object} - { score, isLoading, error, refetch, components, sessionCount }
 */
export function useReadinessScore(gameMode = null) {
    const { userId } = useUser();
    const [score, setScore] = useState(null);
    const [components, setComponents] = useState(null);
    const [sessionCount, setSessionCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchReadiness = useCallback(async () => {
        if (!userId) {
            setIsLoading(false);
            setScore(null);
            setComponents(null);
            setSessionCount(0);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await getReadinessStateFn({
                profileId: userId,
            });

            const data = result.data;

            if (data.success) {
                // Use global readiness score (one brain for all modes)
                setScore(data.globalReadinessScore ?? 70);
                setComponents(data.readiness?.components || null);
                setSessionCount(data.sessionCount || 0);
            } else if (data.isNewUser) {
                // New users start with default readiness (optimal zone)
                setScore(85);
                setComponents(null);
                setSessionCount(0);
            } else {
                throw new Error(data.error || 'Failed to fetch readiness state');
            }
        } catch (err) {
            console.error('[useReadinessScore] Error fetching readiness:', err);
            setError(err.message || 'Unable to load readiness score');
            // Default to 70 on error (don't block UI)
            setScore(70);
            setComponents(null);
            setSessionCount(0);
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    // Fetch on mount and when profile changes
    useEffect(() => {
        fetchReadiness();
    }, [fetchReadiness]);

    // Derived values
    const calibrationPhase = getCalibrationPhase(sessionCount);
    const isCalibrating = calibrationPhase !== CALIBRATION_PHASES.PERSONALIZED;

    return {
        score,
        globalScore: score, // Alias for backwards compatibility
        components, // { performanceComponent, loadComponent, recencyComponent }
        sessionCount, // Global session count for calibration phase
        calibrationPhase, // Current calibration phase object
        isCalibrating, // true if still in calibration (< 11 sessions)
        isLoading,
        error,
        refetch: fetchReadiness,
        zone: score !== null ? getReadinessZone(score) : null,
        statusLabel: score !== null ? getStatusLabel(score, sessionCount) : null,
        message: score !== null ? getReadinessMessage(score, sessionCount) : null,
        // Deprecated - kept for backwards compatibility
        modeState: null,
    };
}

export default useReadinessScore;

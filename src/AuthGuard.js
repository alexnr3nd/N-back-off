/* src/AuthGuard.js */

// --- React Imports ---
import React, { useState, useRef, useEffect } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';

// --- Context Imports ---
import { useUser } from './contexts/UserContext';
import { useSettings } from './contexts/SettingsContext';

// --- UI Components ---
import LoadingScreen from './components/ui/LoadingScreen';
import ErrorScreen from './components/ui/ErrorScreen';

// =============================================================================
// DEBUG: Set this to a number (in ms) to artificially delay loading states
// Set to 0 or false for production. Try 3000 (3 seconds) for testing.
// =============================================================================
const DEBUG_LOADING_DELAY = 0;
// =============================================================================

// Hook to add artificial delay to loading states (for testing)
const useDebugDelay = (actualIsLoading) => {
    const [delayedLoading, setDelayedLoading] = useState(true);
    const loadingStarted = useRef(Date.now());

    useEffect(() => {
        if (!DEBUG_LOADING_DELAY) {
            setDelayedLoading(actualIsLoading);
            return;
        }

        if (actualIsLoading) {
            loadingStarted.current = Date.now();
            setDelayedLoading(true);
        } else {
            const elapsed = Date.now() - loadingStarted.current;
            const remaining = Math.max(0, DEBUG_LOADING_DELAY - elapsed);

            if (remaining > 0) {
                const timer = setTimeout(() => setDelayedLoading(false), remaining);
                return () => clearTimeout(timer);
            } else {
                setDelayedLoading(false);
            }
        }
    }, [actualIsLoading]);

    return delayedLoading;
};

// Minimum time to show the "Setting up" message for new signups (in ms)
const NEW_SIGNUP_MIN_DELAY = 2000;

const AuthGuard = () => {
    const location = useLocation();
    const {
        authUser,
        isLoading: actualProfileLoading,
        userSubscriptionStatus,
        userSubscriptionEndDate,
        coachGrantedPremium,
        error,
        refreshUserData,
    } = useUser();
    const { isLoading: actualSettingsLoading } = useSettings();

    // Check if this is a new signup (flag set by SignupScreen)
    const [isNewSignup] = useState(() => {
        return sessionStorage.getItem('isNewSignup') === 'true';
    });

    // Track minimum delay for new signups
    const [minDelayComplete, setMinDelayComplete] = useState(!isNewSignup);
    const loadingStartTime = useRef(Date.now());

    // Apply debug delay to both loading states
    const isProfileLoading = useDebugDelay(actualProfileLoading);
    const isSettingsLoading = useDebugDelay(actualSettingsLoading);

    // Combined loading state - wait for BOTH profile and settings
    const dataLoading = isProfileLoading || isSettingsLoading;

    // For new signups, also wait for minimum delay
    const isLoading = dataLoading || (isNewSignup && !minDelayComplete);

    // Handle minimum delay for new signups
    useEffect(() => {
        if (!isNewSignup || minDelayComplete) return;

        const checkDelay = () => {
            const elapsed = Date.now() - loadingStartTime.current;
            if (elapsed >= NEW_SIGNUP_MIN_DELAY) {
                setMinDelayComplete(true);
                // Clear the flag so it doesn't persist
                sessionStorage.removeItem('isNewSignup');
            } else {
                // Check again after remaining time
                const remaining = NEW_SIGNUP_MIN_DELAY - elapsed;
                setTimeout(checkDelay, remaining);
            }
        };

        // Start checking after data loads (or immediately if already loaded)
        if (!dataLoading) {
            checkDelay();
        }
    }, [isNewSignup, minDelayComplete, dataLoading]);

    // --- Loading State ---
    // Render LoadingScreen DIRECTLY (not via useEffect) to prevent race conditions.
    // This ensures nothing mounts until all data is ready.
    if (isLoading) {
        const message = isNewSignup
            ? "Setting up your training lab..."
            : "Loading...";
        return <LoadingScreen message={message} fullScreen theme="auto" />;
    }

    // --- Error State ---
    // Show error screen if data loading failed (e.g., no internet, server error)
    if (error) {
        return (
            <ErrorScreen
                type={error === 'NETWORK_ERROR' ? 'network' : 'server'}
                onRetry={refreshUserData}
            />
        );
    }

    // --- Authentication Check ---
    if (!authUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }
    
    // --- The Active Profile Check is NO LONGER NEEDED HERE ---
    // The new /loading route handles this logic correctly before we ever get here.
    // If the code reaches this point, we can assume a valid profile has been selected.

    // --- Subscription Check (can run immediately after auth check) ---
    const isActive = userSubscriptionStatus === 'active';
    const isTrialing = userSubscriptionStatus === 'trialing';
    const isFree = userSubscriptionStatus === 'free';
    const isCanceledWithAccess = userSubscriptionStatus === 'canceled' &&
                               userSubscriptionEndDate &&
                               new Date(userSubscriptionEndDate) >= new Date();

    const hasValidSubscription = true; // TEMP: Bypassed for testing - was: isActive || isTrialing || isFree || isCanceledWithAccess || coachGrantedPremium;

    // Auth-only paths that don't require subscription
    const authOnlyPaths = [
        '/account',
        '/settings',
        // Removed: /choose-plan (now redirects to /subscribe)
        // Removed: /profile-selection (multi-profile feature removed)
    ];
    
    if (!hasValidSubscription && !authOnlyPaths.includes(location.pathname)) {
        return <Navigate to="/subscribe" state={{ from: location }} replace />;
    }

    // --- Access Granted ---
    return <Outlet />;
};

export default AuthGuard;
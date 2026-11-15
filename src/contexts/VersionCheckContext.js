/* src/contexts/VersionCheckContext.js */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

// Build version injected at build time
const CLIENT_VERSION = process.env.BUILD_VERSION || 'development';

// Check every 2 minutes in production
const CHECK_INTERVAL_MS = 2 * 60 * 1000;

// Context for version checking
const VersionCheckContext = createContext({
    isStale: false,
    serverVersion: null,
    clientVersion: CLIENT_VERSION,
    refresh: () => {},
});

export function VersionCheckProvider({ children }) {
    const [isStale, setIsStale] = useState(false);
    const [serverVersion, setServerVersion] = useState(null);
    const hasRefreshedRef = useRef(false);

    const checkVersion = useCallback(async () => {
        // Skip in development
        if (process.env.NODE_ENV === 'development') {
            return;
        }

        try {
            // Add cache-busting query param
            const response = await fetch(`/version.json?_=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });

            if (!response.ok) {
                console.warn('[VersionCheck] Failed to fetch version.json:', response.status);
                return;
            }

            const data = await response.json();
            setServerVersion(data.version);

            // Compare versions
            if (data.version && data.version !== CLIENT_VERSION) {
                setIsStale(true);

                // Auto-refresh if user is not actively engaged
                // Check if they're in the middle of a game by looking for game state
                const isInGame = document.querySelector('[data-game-active="true"]');

                if (!isInGame && !hasRefreshedRef.current) {
                    hasRefreshedRef.current = true;
                    // Small delay to ensure any pending operations complete
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }
            }
        } catch (error) {
            console.warn('[VersionCheck] Error checking version:', error);
        }
    }, []);

    const refresh = useCallback(() => {
        window.location.reload();
    }, []);

    // Initial check after a short delay, then periodic checks
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            return;
        }

        // Initial check after 10 seconds (let the app stabilize first)
        const initialTimeout = setTimeout(checkVersion, 10 * 1000);

        // Periodic checks
        const interval = setInterval(checkVersion, CHECK_INTERVAL_MS);

        // Also check when the tab becomes visible again
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkVersion();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearTimeout(initialTimeout);
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [checkVersion]);

    return (
        <VersionCheckContext.Provider value={{ isStale, serverVersion, clientVersion: CLIENT_VERSION, refresh }}>
            {children}
        </VersionCheckContext.Provider>
    );
}

export function useVersionCheck() {
    return useContext(VersionCheckContext);
}

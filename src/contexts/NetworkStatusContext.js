/* src/contexts/NetworkStatusContext.js */
/* Provides network connectivity state to the entire component tree */

import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const NetworkStatusContext = createContext({
    isConnected: true,
    connectionType: 'unknown',
    wasOffline: false,
});

const BACK_ONLINE_DISPLAY_MS = 3000;

export const NetworkStatusProvider = ({ children }) => {
    const { isConnected, connectionType } = useNetworkStatus();
    const [wasOffline, setWasOffline] = useState(false);
    const prevConnected = useRef(true);
    const timerRef = useRef(null);
    const isFirstRender = useRef(true);

    useEffect(() => {
        // Skip first render — don't show "back online" on initial mount
        if (isFirstRender.current) {
            isFirstRender.current = false;
            prevConnected.current = isConnected;
            return;
        }

        // Detect transition: offline → online
        if (!prevConnected.current && isConnected) {
            setWasOffline(true);

            // Clear any existing timer (handles rapid flickers)
            if (timerRef.current) clearTimeout(timerRef.current);

            timerRef.current = setTimeout(() => {
                setWasOffline(false);
                timerRef.current = null;
            }, BACK_ONLINE_DISPLAY_MS);
        }

        // If we go offline, clear any "back online" state
        if (!isConnected) {
            setWasOffline(false);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        }

        prevConnected.current = isConnected;
    }, [isConnected]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const value = { isConnected, connectionType, wasOffline };

    return (
        <NetworkStatusContext.Provider value={value}>
            {children}
        </NetworkStatusContext.Provider>
    );
};

export const useNetwork = () => useContext(NetworkStatusContext);

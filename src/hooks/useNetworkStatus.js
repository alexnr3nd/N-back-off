/* src/hooks/useNetworkStatus.js */
/* Network connectivity monitoring hook for native and web platforms */

import { useState, useEffect } from 'react';
import { isNative } from '../utils/platform';

/**
 * Hook that monitors network connectivity.
 * On native: Uses @capacitor/network for precise connectivity info.
 * On web: Uses navigator.onLine and online/offline events.
 *
 * @returns {{ isConnected: boolean, connectionType: string }}
 */
export function useNetworkStatus() {
    const [isConnected, setIsConnected] = useState(true);
    const [connectionType, setConnectionType] = useState('unknown');

    useEffect(() => {
        if (isNative()) {
            // Native: use Capacitor Network plugin
            let removeListener = null;

            const setupNativeNetwork = async () => {
                try {
                    const { Network } = await import('@capacitor/network');

                    // Get initial status
                    const status = await Network.getStatus();
                    setIsConnected(status.connected);
                    setConnectionType(status.connectionType);

                    // Listen for changes
                    const listener = await Network.addListener('networkStatusChange', (status) => {
                        setIsConnected(status.connected);
                        setConnectionType(status.connectionType);
                    });
                    removeListener = () => listener.remove();
                } catch (error) {
                    console.warn('[Network] Failed to initialize Capacitor Network:', error);
                    // Fallback to web API
                    setIsConnected(navigator.onLine);
                }
            };

            setupNativeNetwork();

            return () => {
                if (removeListener) removeListener();
            };
        } else {
            // Web: use browser online/offline events
            setIsConnected(navigator.onLine);

            const handleOnline = () => setIsConnected(true);
            const handleOffline = () => setIsConnected(false);

            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);

            return () => {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
            };
        }
    }, []);

    return { isConnected, connectionType };
}

/* Offline build: no native network-state plugin or network permission required. */
import { useState, useEffect } from 'react';

export function useNetworkStatus() {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionType, setConnectionType] = useState('none');

    useEffect(() => {
        // The application is intentionally offline-only. Browser online events
        // are retained for local preview, but native connectivity is not queried.
        const native = !!(window.Capacitor?.isNativePlatform?.());
        if (native) {
            setIsConnected(false);
            setConnectionType('none');
            return undefined;
        }

        setIsConnected(!!navigator.onLine);
        setConnectionType(navigator.onLine ? 'unknown' : 'none');
        const online = () => { setIsConnected(true); setConnectionType('unknown'); };
        const offline = () => { setIsConnected(false); setConnectionType('none'); };
        window.addEventListener('online', online);
        window.addEventListener('offline', offline);
        return () => {
            window.removeEventListener('online', online);
            window.removeEventListener('offline', offline);
        };
    }, []);

    return { isConnected, connectionType };
}

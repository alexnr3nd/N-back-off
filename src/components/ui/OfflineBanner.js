/* src/components/ui/OfflineBanner.js */
/* Subtle top bar indicating offline/online connectivity status */

import React from 'react';
import { useNetwork } from '../../contexts/NetworkStatusContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWifi } from '@fortawesome/free-solid-svg-icons';

const OfflineBanner = () => {
    const { isConnected, wasOffline } = useNetwork();

    // Hidden: online and not recently reconnected
    if (isConnected && !wasOffline) return null;

    const isOffline = !isConnected;

    return (
        <div
            role="alert"
            aria-live="assertive"
            className={`fixed top-0 left-0 right-0 z-[40] transition-all duration-300 border-b
                ${isOffline
                    ? 'bg-gray-100 border-gray-200 text-gray-500'
                    : 'bg-gray-50 border-gray-200 text-gray-400'
                }
            `}
        >
            <div className="flex items-center justify-center gap-1.5 px-3 py-1 text-xs">
                <FontAwesomeIcon icon={faWifi} className="text-[0.625rem]" />
                <span>{isOffline ? 'Offline mode' : 'Back online'}</span>
            </div>
        </div>
    );
};

export default OfflineBanner;

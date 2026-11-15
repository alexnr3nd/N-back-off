/* src/components/ui/ErrorScreen.js */
/* Full-page error screen with retry button for network/server errors */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWifi, faTriangleExclamation, faRotateRight } from '@fortawesome/free-solid-svg-icons';

const DARK_COLORS = {
    bg: '#0D0B09',
    elevated: '#1E1B18',
    line: '#3A352F',
    text: '#A39E96',
    accent: '#E4B85C',
};

/**
 * Full-page error screen shown when the app can't load due to network or server issues.
 * Reuses the dark theme from LoadingScreen.js for visual consistency.
 *
 * @param {'network' | 'server'} type - Error type determines icon and message
 * @param {() => void} onRetry - Called when retry button is pressed
 */
const ErrorScreen = ({ type = 'network', onRetry }) => {
    const isNetwork = type === 'network';

    return (
        <div
            className="fixed inset-0 flex flex-col items-center justify-center z-50"
            style={{ backgroundColor: DARK_COLORS.bg }}
        >
            {/* Icon */}
            <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                style={{ backgroundColor: DARK_COLORS.elevated, border: `1px solid ${DARK_COLORS.line}` }}
            >
                <FontAwesomeIcon
                    icon={isNetwork ? faWifi : faTriangleExclamation}
                    className="text-2xl"
                    style={{ color: isNetwork ? DARK_COLORS.text : DARK_COLORS.accent }}
                />
            </div>

            {/* Title */}
            <h2 className="text-lg font-semibold text-white mb-2">
                {isNetwork ? 'No internet connection' : 'Something went wrong'}
            </h2>

            {/* Subtitle */}
            <p className="text-sm text-center max-w-xs mb-8" style={{ color: DARK_COLORS.text }}>
                {isNetwork
                    ? 'Check your connection and try again.'
                    : "We couldn't reach the server. Please try again."}
            </p>

            {/* Retry button */}
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
                    style={{
                        backgroundColor: DARK_COLORS.accent,
                        color: DARK_COLORS.bg,
                    }}
                >
                    <FontAwesomeIcon icon={faRotateRight} />
                    Retry
                </button>
            )}
        </div>
    );
};

export default ErrorScreen;

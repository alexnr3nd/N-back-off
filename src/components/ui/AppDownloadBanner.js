/* src/components/ui/AppDownloadBanner.js */
/* Non-intrusive banner prompting Android mobile browser users to install the native app */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { useUser } from '../../contexts/UserContext';
import { isMobileAndroidBrowser } from '../../utils/platform';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dualnback.android&utm_source=na_Med';
const DISMISS_KEY = 'appDownloadBannerDismissed';

const AppDownloadBanner = ({ onVisibilityChange }) => {
    const { activeSessions } = useUser();
    const [isDismissed, setIsDismissed] = useState(() => {
        try { return sessionStorage.getItem(DISMISS_KEY) === 'true'; } catch { return false; }
    });

    const shouldShow = useMemo(() => {
        if (!isMobileAndroidBrowser()) return false;
        if (isDismissed) return false;
        if (!activeSessions || activeSessions.length === 0) return false;
        return true;
    }, [isDismissed, activeSessions]);

    useEffect(() => {
        if (onVisibilityChange) onVisibilityChange(shouldShow);
    }, [shouldShow, onVisibilityChange]);

    const handleDismiss = useCallback(() => {
        setIsDismissed(true);
        try { sessionStorage.setItem(DISMISS_KEY, 'true'); } catch {}
    }, []);

    if (!shouldShow) return null;

    return (
        <div className="border border-theme-accent/20 bg-theme-accent/5 p-3 sm:p-4 mb-6 sm:mb-8 flex items-center gap-3">
            <svg className="h-5 w-5 text-theme-accent flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302-2.302 2.302-2.764-2.302 2.764-2.302zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/>
            </svg>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-theme-text">
                    Get the Android app for a better experience
                </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <a
                    href={PLAY_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-theme-accent hover:text-theme-accent/80 transition-colors inline-flex items-center gap-1"
                >
                    Install
                    <FontAwesomeIcon icon={faArrowRight} className="h-2.5 w-2.5" />
                </a>
                <button
                    onClick={handleDismiss}
                    className="text-theme-text-muted/50 hover:text-theme-text-muted p-1 transition-colors"
                    aria-label="Dismiss"
                >
                    <FontAwesomeIcon icon={faTimes} className="h-3 w-3" />
                </button>
            </div>
        </div>
    );
};

export default AppDownloadBanner;

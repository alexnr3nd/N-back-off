import React, { useState, useEffect } from 'react';

const CONSENT_KEY = 'cookie_consent';

const CookieConsentBanner = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(CONSENT_KEY);
        if (!stored) setVisible(true);
    }, []);

    const handleConsent = (granted) => {
        const value = granted ? 'granted' : 'denied';
        localStorage.setItem(CONSENT_KEY, value);
        setVisible(false);

        if (typeof window.gtag === 'function') {
            window.gtag('consent', 'update', {
                'analytics_storage': value,
                'ad_storage': value,
                'ad_user_data': value,
                'ad_personalization': value,
            });
        }
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-4 bg-theme-bg-elevated border-t border-theme-line">
            <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
                <p className="text-xs font-mono text-theme-text-secondary">
                    We use cookies for analytics to improve the app.
                </p>
                <div className="flex gap-2 flex-shrink-0">
                    <button
                        onClick={() => handleConsent(false)}
                        className="px-3 py-1.5 text-xs font-mono text-theme-text-muted border border-theme-line hover:border-theme-text-muted/50 transition-colors"
                    >
                        Decline
                    </button>
                    <button
                        onClick={() => handleConsent(true)}
                        className="px-3 py-1.5 text-xs font-mono text-theme-bg bg-theme-accent hover:bg-theme-accent-hover transition-colors"
                    >
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CookieConsentBanner;

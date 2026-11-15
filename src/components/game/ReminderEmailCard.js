/* src/components/game/ReminderEmailCard.js */
/* Cognitive Lab theme — results-page promo card: one-tap opt-in to daily reminder emails */
import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faCheck, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig';
import { trackEvent } from '../../utils/analyticsTracker';
import { primeReminderPreferenceCache } from '../../hooks/useReminderPreference';

// Mirrors the backend fallback defaults in functions/notifications.js
// (getNotificationPreferences / updateNotificationPreferences): weekday mornings.
const DEFAULT_TIME_BLOCK = 'morning';
const DEFAULT_DAYS_OF_WEEK = [1, 2, 3, 4, 5];

// Anti-nagging cap: after 5 impressions the card
// stops entering the pool (GameResults checks isReminderCardCapped). Lifetime
// per browser; localStorage failures just leave the cap disengaged.
const IMPRESSION_CAP = 5;
const IMPRESSIONS_STORAGE_KEY = 'reminderCardImpressions';

export function isReminderCardCapped() {
    try {
        return (Number(localStorage.getItem(IMPRESSIONS_STORAGE_KEY)) || 0) >= IMPRESSION_CAP;
    } catch (error) {
        return false;
    }
}

function recordReminderCardImpression() {
    try {
        const count = Number(localStorage.getItem(IMPRESSIONS_STORAGE_KEY)) || 0;
        localStorage.setItem(IMPRESSIONS_STORAGE_KEY, String(count + 1));
    } catch (error) {
        // Storage unavailable — the card simply rotates without a cap.
    }
}

const ReminderEmailCard = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState('idle'); // idle | saving | enabled | error

    // Only the selected pool card is rendered, so mount = one real impression.
    useEffect(() => {
        recordReminderCardImpression();
    }, []);

    const handleEnable = async () => {
        if (status === 'saving') return;
        trackEvent('results_card_click', { link_name: 'reminder_enable' });
        setStatus('saving');
        try {
            const updatePrefs = httpsCallable(functions, 'updateNotificationPreferences');
            await updatePrefs({
                enabled: true,
                timeBlock: DEFAULT_TIME_BLOCK,
                daysOfWeek: DEFAULT_DAYS_OF_WEEK,
                optInSource: 'results_card',
            });
            primeReminderPreferenceCache(true);
            setStatus('enabled');
        } catch (error) {
            console.error('[ReminderEmailCard] Failed to enable reminders:', error);
            setStatus('error');
        }
    };

    const handleCustomize = () => {
        trackEvent('results_card_click', { link_name: 'reminder_customize' });
        navigate('/settings', { state: { section: 'notifications' } });
    };

    if (status === 'enabled') {
        return (
            <div className="p-3 sm:p-4 border border-theme-accent/30 bg-theme-accent/5">
                <p className="text-xs font-mono font-medium text-theme-text mb-1.5">
                    <FontAwesomeIcon icon={faCheck} className="w-3 h-3 text-theme-accent mr-1.5" />
                    Reminders Enabled
                </p>
                <p className="text-[0.6875rem] font-mono text-theme-text-secondary mb-3">
                    Weekday mornings (8:00 AM). Change the time or days in Settings.
                </p>
                <button
                    onClick={handleCustomize}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.6875rem] font-mono text-theme-text-secondary border border-theme-line/70 bg-theme-bg-elevated/50 hover:border-theme-text-muted/50 transition-colors"
                >
                    <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
                    Settings
                </button>
            </div>
        );
    }

    return (
        <div className="p-3 sm:p-4 border border-theme-accent/30 bg-theme-accent/5">
            <p className="text-xs font-mono font-medium text-theme-text mb-1.5">
                <FontAwesomeIcon icon={faEnvelope} className="w-3 h-3 text-theme-text-secondary mr-1.5" />
                Training Reminders
            </p>
            <p className="text-[0.6875rem] font-mono text-theme-text-secondary mb-3">
                Consistency is what drives gains. Get a short email reminder on your training days — weekday mornings by default.
            </p>
            {status === 'error' && (
                <p className="text-[0.6875rem] font-mono text-neural-synapse mb-2">
                    Could not save. Try again, or use Customize to set it up in Settings.
                </p>
            )}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={handleEnable}
                    disabled={status === 'saving'}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.6875rem] font-mono text-theme-accent border border-theme-accent/40 bg-theme-bg-elevated/50 hover:border-theme-accent/70 transition-colors disabled:opacity-60"
                >
                    <FontAwesomeIcon icon={faEnvelope} className="w-3.5 h-3.5" />
                    {status === 'saving' ? 'Enabling…' : 'Enable Reminders'}
                </button>
                <button
                    onClick={handleCustomize}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.6875rem] font-mono text-theme-text-secondary border border-theme-line/70 bg-theme-bg-elevated/50 hover:border-theme-text-muted/50 transition-colors"
                >
                    Customize
                </button>
            </div>
        </div>
    );
};

export default ReminderEmailCard;

import { logEvent, setUserId, setUserProperties } from 'firebase/analytics';
import { analytics } from '../firebaseConfig';

export const trackEvent = (eventName, params = {}) => {
    if (analytics) logEvent(analytics, eventName, params);
};

export const identifyUser = (uid, properties = {}) => {
    if (!analytics) return;
    setUserId(analytics, uid);
    if (Object.keys(properties).length > 0) {
        setUserProperties(analytics, properties);
    }
};

export const clearUser = () => {
    if (!analytics) return;
    setUserId(analytics, null);
};

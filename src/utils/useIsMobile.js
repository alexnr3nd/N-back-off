import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 639px)';

export const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(MOBILE_QUERY).matches;
    });
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const mq = window.matchMedia(MOBILE_QUERY);
        const handler = (e) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);
    return isMobile;
};

import { useMemo } from 'react';
import { useUser } from '../contexts/UserContext';
import { useSettings } from '../contexts/SettingsContext';
import { DAILY_ADAPTIVE_CAP } from '../constants/gameConstants';
import { getTodayStringInTimezone } from '../utils/dateUtils';
import { useUpgradeModal } from './useUpgradeModal';

export function useDailyCapStatus() {
    const {
        freeTier,
        isFullAdaptive,
        dailyAdaptiveCount,
        dailyAdaptiveCountDate,
    } = useUser();
    const { settings } = useSettings();
    const { openUpgradeModal } = useUpgradeModal();

    // adaptive_grandfathered counts as capped once the grandfather expires —
    // the !isFullAdaptive guard already excludes it while the grandfather is active.
    const isCappedCohort = !isFullAdaptive
        && (freeTier === 'limited_modern' || freeTier === 'classic_legacy' || freeTier === 'adaptive_grandfathered');

    // The stored counter is per local-TZ day. If the stored date isn't today in the
    // user's timezone, the cap has already rolled over and the count is effectively
    // 0 — even though the doc may still hold yesterday's value (the backend only
    // resets it lazily on the next save, which the client gate would otherwise block
    // from ever happening, locking the user out forever). Mirrors functions/game.js
    // saveGameSession + the resetStaleAdaptiveCaps cron so client and server agree.
    const isStaleDay = !dailyAdaptiveCountDate
        || dailyAdaptiveCountDate !== getTodayStringInTimezone(settings?.timezone);
    const used = isStaleDay ? 0 : (dailyAdaptiveCount ?? 0);
    const total = DAILY_ADAPTIVE_CAP;
    const remaining = Math.max(0, total - used);
    const atCap = used >= total;
    const isWarning = !atCap && remaining >= 1 && remaining <= 3;
    const hasStartedToday = used > 0;

    // Hide entirely until first session of the day. Showing "10 left today" at 0/10
    // misfires loss-aversion framing and turns the chip into a clock for new users.
    const isVisible = isCappedCohort && hasStartedToday;

    const { counterCopy, ctaCopy, resetTooltip } = useMemo(() => {
        let counter;
        if (atCap) {
            counter = 'Daily cap reached — resets at midnight';
        } else if (remaining === 1) {
            counter = '1 session left today';
        } else {
            counter = `${remaining} sessions left today`;
        }

        return {
            counterCopy: counter,
            ctaCopy: 'Go Pro for unlimited',
            resetTooltip: 'Resets at midnight local time',
        };
    }, [atCap, remaining]);

    return {
        isVisible,
        isCappedCohort,
        used,
        total,
        remaining,
        atCap,
        isWarning,
        counterCopy,
        ctaCopy,
        resetTooltip,
        openUpgradeModal,
    };
}

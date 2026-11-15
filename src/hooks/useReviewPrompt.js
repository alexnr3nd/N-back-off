import { useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { isNative, isAndroid } from '../utils/platform';
import { trackEvent } from '../utils/analyticsTracker';
import {
    checkReviewEligibility,
    setLastPromptDate,
    REVIEW_PROMPT_MIN_SESSIONS,
} from '../utils/reviewPromptHelpers';

export default function useReviewPrompt({
    levelChange, newNBack, nBackPlayed, isNewHighestNBackGood,
    performanceCategory, totalSessions, sessionId,
}) {
    const hasRunRef = useRef(null);

    useEffect(() => {
        if (!sessionId || sessionId === hasRunRef.current) return;
        hasRunRef.current = sessionId;

        (async () => {
            try {
                const forceEligible = (() => {
                    try { return localStorage.getItem('reviewPrompt_forceEligible') === 'true'; }
                    catch { return false; }
                })();

                if (!forceEligible) {
                    if (!isNative()) {
                        console.log('[ReviewPrompt] Skipped: not native');
                        return;
                    }
                    if (!isAndroid()) {
                        console.log('[ReviewPrompt] Skipped: not Android');
                        return;
                    }
                }

                const { eligible, reason, triggerType } = checkReviewEligibility(
                    { levelChange, newNBack, nBackPlayed, isNewHighestNBackGood, performanceCategory },
                    totalSessions
                );

                if (!eligible && !forceEligible) {
                    console.log(`[ReviewPrompt] Skipped: ${reason}`);
                    return;
                }

                const effectiveTrigger = forceEligible && !eligible ? 'force_eligible' : triggerType;

                try {
                    const configSnap = await getDoc(doc(db, 'config', 'reviewPrompt'));
                    if (configSnap.exists() && configSnap.data().enabled === false) {
                        console.log('[ReviewPrompt] Skipped: kill switch disabled');
                        return;
                    }
                } catch (err) {
                    console.warn('[ReviewPrompt] Could not read config, proceeding anyway:', err.message);
                }

                if (!isNative()) {
                    console.log(`[ReviewPrompt] Would trigger (${effectiveTrigger}) but not native — skipping plugin call`);
                    return;
                }

                const { InAppReview } = await import('@capacitor-community/in-app-review');
                await InAppReview.requestReview();

                setLastPromptDate();
                trackEvent('review_prompt_triggered', {
                    trigger_type: effectiveTrigger,
                    n_back_level: nBackPlayed,
                    total_sessions: totalSessions,
                    performance_category: performanceCategory,
                });
                console.log(`[ReviewPrompt] Triggered (${effectiveTrigger})`);
            } catch (err) {
                console.warn('[ReviewPrompt] Error:', err.message);
            }
        })();
    }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps
}

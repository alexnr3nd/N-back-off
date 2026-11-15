/* src/hooks/useUpgradeModal.js */
/* Single opener for the Pro-trial upgrade modal.
 *
 * ProTrialUpgradeModal only records dismiss/accept — the impression belongs to
 * whoever opens it. Routing every opener through this hook keeps the funnel
 * (impression → accept/dismiss) complete no matter which surface fired.
 *
 * `context` is an optional short tag (≤64 chars) stored in metadata.context —
 * e.g. which chart or assessment the paywall was guarding.
 */

import { useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { recordUpgradeModalImpressionFn } from '../contexts/user/userCloudFunctions';

const MAX_CONTEXT_LENGTH = 64;

function recordImpression(trigger, context) {
    if (!recordUpgradeModalImpressionFn) return;
    const payload = { trigger };
    if (typeof context === 'string' && context.trim()) {
        payload.context = context.trim().slice(0, MAX_CONTEXT_LENGTH);
    }
    recordUpgradeModalImpressionFn(payload).catch(err => {
        console.warn('[useUpgradeModal] recordUpgradeModalImpression failed:', err?.message);
    });
}

export function useUpgradeModal() {
    const { setShowProTrialUpgradeModal, setProTrialUpgradeModalTrigger } = useUser();

    const openUpgradeModal = useCallback((trigger, context) => {
        setProTrialUpgradeModalTrigger(trigger);
        setShowProTrialUpgradeModal(true);
        recordImpression(trigger, context);
    }, [setProTrialUpgradeModalTrigger, setShowProTrialUpgradeModal]);

    // For surfaces that mount their own ProTrialUpgradeModal instance (e.g. the
    // chart paywall) and only need the impression logged.
    const recordImpressionOnly = useCallback((trigger, context) => {
        recordImpression(trigger, context);
    }, []);

    return { openUpgradeModal, recordImpressionOnly };
}

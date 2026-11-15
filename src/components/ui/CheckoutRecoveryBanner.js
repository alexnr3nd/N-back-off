/* src/components/ui/CheckoutRecoveryBanner.js */
/* Second-chance strip shown on the dashboard after a Stripe checkout was abandoned. */
/* The flag is written by ProfileDashboard when Stripe returns to /dashboard?upgrade_cancelled=1. */

import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { useUser } from '../../contexts/UserContext';
import { useUpgradeModal } from '../../hooks/useUpgradeModal';

export const CHECKOUT_RECOVERY_KEY = 'checkoutRecoveryBanner';

const CheckoutRecoveryBanner = ({ flag, onClear }) => {
    const { isPaidPro } = useUser();
    const { openUpgradeModal } = useUpgradeModal();
    const [isDismissed, setIsDismissed] = useState(false);

    const clearFlag = useCallback(() => {
        setIsDismissed(true);
        try { sessionStorage.removeItem(CHECKOUT_RECOVERY_KEY); } catch {}
        if (onClear) onClear();
    }, [onClear]);

    const handleResume = useCallback(() => {
        clearFlag();
        openUpgradeModal('checkout_recovery');
    }, [clearFlag, openUpgradeModal]);

    if (!flag || isDismissed || isPaidPro) return null;

    return (
        <div className="border border-theme-accent/20 bg-theme-accent/5 p-3 sm:p-4 mb-6 sm:mb-8 flex items-center gap-3">
            <div className="flex-1 min-w-0">
                <p className="text-sm text-theme-text">
                    Your Pro trial is still available.
                </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <button
                    onClick={handleResume}
                    className="text-xs font-medium text-theme-accent hover:text-theme-accent/80 transition-colors inline-flex items-center gap-1"
                >
                    Resume
                    <FontAwesomeIcon icon={faArrowRight} className="h-2.5 w-2.5" />
                </button>
                <button
                    onClick={clearFlag}
                    className="text-theme-text-muted/50 hover:text-theme-text-muted p-1 transition-colors"
                    aria-label="Dismiss"
                >
                    <FontAwesomeIcon icon={faTimes} className="h-3 w-3" />
                </button>
            </div>
        </div>
    );
};

CheckoutRecoveryBanner.propTypes = {
    // sessionStorage flag value (the abandoned trigger, or '1') — falsy hides the banner
    flag: PropTypes.string,
    onClear: PropTypes.func,
};

export default CheckoutRecoveryBanner;

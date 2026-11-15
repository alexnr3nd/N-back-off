/* src/contexts/user/userActionsSubscription.js */
import { useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';

/**
 * Hook creator for Check Subscription action.
 */
export const useCreateCheckSubscriptionAction = (
    authUserRef,
    setIsSubscriptionLoading, // Needs setter
    setUserSubscriptionStatus, // Needs setter
    setUserSubscriptionEndDate, // Needs setter
    setUserSubscriptionPriceId, // Needs setter
    setSubscriptionError, // Needs setter
    setSubscriptionTier, // Needs setter - determines 'free' or 'premium'
    checkSubscriptionStatusFn, // Cloud function ref
    setUserSubscriptionCancelAtPeriodEnd // Needs setter
) => {
    return useCallback(async () => {
        const currentUserId = authUserRef.current?.uid;
        if (!currentUserId) {
            setIsSubscriptionLoading(false);
            setUserSubscriptionStatus(null);
            setUserSubscriptionEndDate(null);
            setUserSubscriptionPriceId(null);
            setSubscriptionError(null);
            return;
        }

        if (!checkSubscriptionStatusFn) {
            console.error("[checkSubscription Action] Cloud function reference 'checkSubscriptionStatusFn' not available.");
            setIsSubscriptionLoading(false);
            setSubscriptionError("Subscription service unavailable.");
            setUserSubscriptionStatus('error');
            return;
        }

        setIsSubscriptionLoading(true);
        setSubscriptionError(null);

        try {
            const result = await checkSubscriptionStatusFn();

            if (result?.data?.success) {
                const { status, endDate, priceId, cancelAtPeriodEnd } = result.data;
                setUserSubscriptionStatus(status);
                setUserSubscriptionEndDate(endDate && endDate.seconds ? new Timestamp(endDate.seconds, endDate.nanoseconds).toDate() : null);
                setUserSubscriptionPriceId(priceId);
                if (setUserSubscriptionCancelAtPeriodEnd) {
                    setUserSubscriptionCancelAtPeriodEnd(cancelAtPeriodEnd === true);
                }
                setSubscriptionError(null);

                // Update subscription tier based on status
                const isPremium = status === 'active' || status === 'trialing';
                setSubscriptionTier(isPremium ? 'premium' : 'free');

            } else {
                const errorMessage = result?.data?.message || "Failed to check subscription status.";
                console.warn(`[checkSubscription Action] Cloud Function reported failure. Reason: ${errorMessage}`, result?.data);
                setSubscriptionError(errorMessage);
                setUserSubscriptionStatus('error');
            }
        } catch (error) {
            console.error("[checkSubscription Action] Error calling cloud function 'checkSubscriptionStatusFn':", error);
            const message = error.message || "An unexpected server error occurred checking subscription.";
            setSubscriptionError(message);
            setUserSubscriptionStatus('error');
        } finally {
            setIsSubscriptionLoading(false);
        }
    }, [
        authUserRef,
        setIsSubscriptionLoading,
        setUserSubscriptionStatus,
        setUserSubscriptionEndDate,
        setUserSubscriptionPriceId,
        setSubscriptionError,
        setSubscriptionTier,
        checkSubscriptionStatusFn,
        setUserSubscriptionCancelAtPeriodEnd
    ]);
};
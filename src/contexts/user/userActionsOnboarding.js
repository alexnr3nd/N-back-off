/* src/contexts/user/userActionsOnboarding.js */
import { useCallback } from 'react';

/**
 * Hook creator for Mark Onboarding Complete action.
 */
export const useCreateMarkOnboardingCompleteAction = (
    setIsOnboardingComplete // Needs setter
) => {
    return useCallback(() => {
        setIsOnboardingComplete(true);
    }, [setIsOnboardingComplete]);
};
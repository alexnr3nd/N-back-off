/* File: src/components/account/AccountSubscriptionSection.js */
/* Updated: Cognitive Lab dark theme */
import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCreditCard, faCalendarAlt, faInfinity, faExclamationCircle, faExchangeAlt, faArrowUp, faTimes, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { PRICE_IDS } from '../../constants/stripeConstants';
import { isNative } from '../../utils/platform';

const AccountSubscriptionSection = ({
    isContextLoading,
    userSubscriptionStatus,
    userSubscriptionEndDate,
    userSubscriptionPriceId,
    userSubscriptionCancelAtPeriodEnd,
    subscriptionPlatform,
    subscriptionType,
    isPortalLoading,
    portalError,
    handleManageBilling,
    createCustomerPortalSession,
    handleResumeSubscription,
    isResumingSubscription,
    resumeError,
    isRestoringPurchases,
    restoreMessage,
    restoreMessageType,
    handleRestorePurchases,
    // Free trial props
    isAppManagedTrial,
    freeTrialDaysRemaining,
    // Lifetime trial props (Stripe setup-mode + day-14 charge)
    isInLifetimeTrial,
    lifetimeTrialEndsAt,
    lifetimeTrialDaysRemaining,
    handleCancelLifetimeTrial,
    isCancellingLifetimeTrial,
    cancelLifetimeTrialError,
    // UI Components passed as props
    ButtonComponent,
    AlertComponent,
    StatusBadgeComponent,
    LoadingSpinnerComponent,
}) => {
    const Button = ButtonComponent;
    const Alert = AlertComponent;
    const StatusBadge = StatusBadgeComponent;
    const LoadingSpinner = LoadingSpinnerComponent;

    if (!Button || !Alert || !StatusBadge || !LoadingSpinner) {
        console.error("AccountSubscriptionSection: Required UI component props were not provided.");
        return <div className="text-neural-synapse p-4 font-mono">Error: UI components for this section are missing.</div>;
    }

    const formatDate = (date) => {
        if (!date) return "";
        // Ensure we have a Date object (handles both Date and ISO string)
        const dateObj = date instanceof Date ? date : new Date(date);
        if (isNaN(dateObj.getTime())) return "";
        return dateObj.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Helper to safely get end date as Date object
    const getEndDate = () => {
        if (!userSubscriptionEndDate) return null;
        return userSubscriptionEndDate instanceof Date
            ? userSubscriptionEndDate
            : new Date(userSubscriptionEndDate);
    };

    const getPlanName = useCallback(() => {
        if (userSubscriptionPriceId === PRICE_IDS.monthly) {
            return "Monthly Plan";
        } else if (userSubscriptionPriceId === PRICE_IDS.yearly) {
            return "Yearly Plan";
        } else if (userSubscriptionPriceId) {
            return "Subscribed Plan";
        }
        return "Plan";
    }, [userSubscriptionPriceId]);

    const renderSubscriptionDetails = () => {
        if (isContextLoading || userSubscriptionStatus === 'loading' || userSubscriptionStatus === null) {
            return (
                <p className="text-sm text-theme-text-muted font-mono italic flex items-center">
                    <LoadingSpinner whiteText={false} theme="auto" />
                    Loading subscription status...
                </p>
            );
        }

        if (userSubscriptionStatus === 'error') {
            return <p className="text-sm text-neural-synapse font-mono">Could not load subscription status.</p>;
        }

        const endDateStr = userSubscriptionEndDate ? formatDate(userSubscriptionEndDate) : "";
        const planName = getPlanName();

        // Lifetime trial (Stripe setup-mode, awaiting day-14 charge)
        // Check before switch — userSubscriptionStatus is 'trialing' for these users too
        if (isInLifetimeTrial && lifetimeTrialDaysRemaining > 0) {
            const trialEndDate = lifetimeTrialEndsAt instanceof Date
                ? lifetimeTrialEndsAt
                : (lifetimeTrialEndsAt ? new Date(lifetimeTrialEndsAt) : null);
            const trialEndStr = trialEndDate ? formatDate(trialEndDate) : "";
            return (
                <div>
                    <div className="mb-3">
                        <StatusBadge type="info" text="Lifetime Trial" />
                        <h4 className="font-mono text-lg text-theme-text mb-1 mt-2">
                            Lifetime Trial — {lifetimeTrialDaysRemaining} day{lifetimeTrialDaysRemaining !== 1 ? 's' : ''} remaining
                        </h4>
                        {trialEndStr && (
                            <div className="mt-2 text-sm text-theme-text-secondary font-mono flex items-center">
                                <FontAwesomeIcon icon={faCalendarAlt} className="mr-2 text-theme-accent" />
                                $119.99 will be charged on {trialEndStr}
                            </div>
                        )}
                    </div>
                    <p className="text-sm text-theme-text-muted font-mono mt-2">
                        Full Pro access during the trial. Cancel anytime before the charge. No charge is applied, and Pro access ends at cancellation.
                    </p>
                    {cancelLifetimeTrialError && (
                        <div className="mt-3">
                            <Alert type="error" message={cancelLifetimeTrialError} />
                        </div>
                    )}
                    <div className="mt-4">
                        <Button
                            onClick={handleCancelLifetimeTrial}
                            disabled={isCancellingLifetimeTrial}
                            isLoading={isCancellingLifetimeTrial}
                            loadingText="Cancelling..."
                            text="Cancel Trial"
                            variant="secondary"
                            icon={faTimes}
                        />
                    </div>
                </div>
            );
        }

        // App-managed free trial (check before switch to handle 'trialing' status from app trials)
        if (isAppManagedTrial && freeTrialDaysRemaining > 0) {
            return (
                <div>
                    <div className="mb-3">
                        <StatusBadge type="info" text="Free Trial" />
                        <h4 className="font-mono text-lg text-theme-text mb-1 mt-2">
                            Free Trial — {freeTrialDaysRemaining} day{freeTrialDaysRemaining !== 1 ? 's' : ''} remaining
                        </h4>
                        <p className="text-sm text-theme-text-muted font-mono mt-2">
                            Enjoy full Pro access during your trial.
                        </p>
                    </div>
                </div>
            );
        }

        switch (userSubscriptionStatus) {
            case 'trialing':
                return (
                    <div>
                        <div className="mb-3">
                            <h4 className="font-mono text-lg text-theme-text mb-1">Trial Active</h4>
                            <p className="text-sm text-theme-text-muted font-mono">{planName}</p>
                            {endDateStr && (
                                <div className="mt-2 text-sm text-theme-text-secondary font-mono flex items-center">
                                    <FontAwesomeIcon icon={faCalendarAlt} className="mr-2 text-theme-accent" />
                                    Trial ends {endDateStr}
                                </div>
                            )}
                        </div>
                        <p className="text-sm text-theme-text-muted font-mono mt-2">
                            Enjoy your trial period! Access all premium features.
                        </p>
                    </div>
                );

            case 'active':
                if (userSubscriptionCancelAtPeriodEnd) {
                    return (
                        <div>
                            <div className="mb-3">
                                <div className="flex items-center mb-2">
                                    <StatusBadge type="warning" text="Cancellation Scheduled" />
                                    <span className="ml-3 font-mono text-lg text-theme-text">{planName}</span>
                                </div>
                                {endDateStr && (
                                    <div className="text-sm text-theme-text-secondary font-mono flex items-center">
                                        <FontAwesomeIcon icon={faCalendarAlt} className="mr-2 text-theme-accent" />
                                        Access until {endDateStr}
                                    </div>
                                )}
                            </div>
                            <p className="text-sm text-theme-text-muted font-mono mt-2">
                                {endDateStr
                                    ? `This subscription will not renew. Pro access continues until ${endDateStr}.`
                                    : 'This subscription will not renew. Pro access continues until the end of the current billing period.'}
                            </p>
                            {resumeError && (
                                <div className="mt-3">
                                    <Alert type="error" message={resumeError} />
                                </div>
                            )}
                            <div className="mt-4">
                                <Button
                                    onClick={handleResumeSubscription}
                                    disabled={isResumingSubscription || !handleResumeSubscription}
                                    isLoading={isResumingSubscription}
                                    loadingText="Resuming..."
                                    text="Resume Subscription"
                                    variant="primary"
                                    icon={faRotateRight}
                                />
                            </div>
                        </div>
                    );
                }
                return (
                    <div>
                        <div className="mb-3">
                            <div className="flex items-center mb-2">
                                <StatusBadge type="success" text="Active" />
                                <span className="ml-3 font-mono text-lg text-theme-text">{planName}</span>
                            </div>
                            {endDateStr && (
                                <div className="text-sm text-theme-text-secondary font-mono flex items-center">
                                    <FontAwesomeIcon icon={faCalendarAlt} className="mr-2 text-theme-accent" />
                                    Renews {endDateStr}
                                </div>
                            )}
                        </div>
                        <p className="text-sm text-theme-text-muted font-mono mt-2">
                            Thank you for your subscription! Enjoy unlimited access.
                        </p>
                    </div>
                );

            case 'canceled':
                const endDate = getEndDate();
                if (endDateStr && endDate && endDate > new Date()) {
                    return (
                        <div>
                            <div className="mb-3">
                                <div className="flex items-center mb-2">
                                    <StatusBadge type="warning" text="Canceled" />
                                    <span className="ml-3 font-mono text-lg text-theme-text">{planName}</span>
                                </div>
                                {endDateStr && (
                                    <div className="text-sm text-theme-text-secondary font-mono flex items-center">
                                        <FontAwesomeIcon icon={faCalendarAlt} className="mr-2 text-theme-accent" />
                                        Access until {endDateStr}
                                    </div>
                                )}
                            </div>
                            <p className="text-sm text-theme-text-muted font-mono mt-2">
                                Your subscription has been canceled but you still have access until the end date.
                            </p>
                        </div>
                    );
                } else {
                    return (
                        <div className="flex flex-col space-y-3">
                            <div className="flex items-center">
                                <StatusBadge type="error" text="Inactive" />
                                <span className="ml-3 text-sm text-theme-text-secondary font-mono">Subscription ended</span>
                            </div>
                            <Link to="/subscribe" className="text-sm text-theme-accent hover:text-amber-highlight font-mono flex items-center transition-colors">
                                <FontAwesomeIcon icon={faCreditCard} className="mr-2 h-3.5 w-3.5" />
                                View Plans to Resubscribe
                            </Link>
                        </div>
                    );
                }

            case 'past_due':
            case 'unpaid':
                return (
                    <div className="flex flex-col space-y-4">
                        <div className="flex items-center">
                            <StatusBadge type="error" text="Payment Issue" />
                            <span className="ml-3 text-sm text-theme-text-secondary font-mono">{planName} • Action required</span>
                        </div>
                        <p className="text-sm text-neural-synapse font-mono flex items-start">
                            <FontAwesomeIcon icon={faExclamationCircle} className="mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                            We couldn't process your latest payment. Please update your payment method below.
                        </p>
                        <Button
                            onClick={handleManageBilling}
                            disabled={isPortalLoading || !createCustomerPortalSession}
                            isLoading={isPortalLoading}
                            loadingText="Loading..."
                            text="Update Payment Method"
                            variant="primary"
                            icon={faCreditCard}
                        />
                    </div>
                );

            case 'incomplete':
                return (
                    <div className="flex flex-col space-y-4">
                        <div className="flex items-center">
                            <StatusBadge type="warning" text="Incomplete" />
                            <span className="ml-3 text-sm text-theme-text-secondary font-mono">{planName} • Payment processing</span>
                        </div>
                        <Button
                            onClick={handleManageBilling}
                            disabled={isPortalLoading || !createCustomerPortalSession}
                            isLoading={isPortalLoading}
                            loadingText="Loading..."
                            text="Manage Billing"
                            variant="secondary"
                            icon={faCreditCard}
                        />
                    </div>
                );

            case 'incomplete_expired':
                return (
                    <div className="flex flex-col space-y-3">
                        <div className="flex items-center">
                            <StatusBadge type="error" text="Expired" />
                            <span className="ml-3 text-sm text-theme-text-secondary font-mono">Subscription attempt failed</span>
                        </div>
                        <Link to="/subscribe" className="text-sm text-theme-accent hover:text-amber-highlight font-mono flex items-center transition-colors">
                            <FontAwesomeIcon icon={faCreditCard} className="mr-2 h-3.5 w-3.5" />
                            Choose a Plan to Try Again
                        </Link>
                    </div>
                );

            case 'free':
                return (
                    <div className="flex flex-col space-y-4">
                        <div className="flex items-center">
                            <StatusBadge type="info" text="Free Plan" />
                        </div>
                        <p className="text-sm text-theme-text-muted font-mono">
                            You're on the free plan with limited daily sessions.
                        </p>
                        <Link
                            to="/subscribe"
                            className="self-start inline-flex items-center px-5 py-2.5 bg-theme-accent hover:bg-amber-highlight text-theme-bg text-sm font-mono uppercase tracking-wider rounded-lab transition-all duration-200"
                        >
                            <FontAwesomeIcon icon={faInfinity} className="mr-2 h-3.5 w-3.5" />
                            Upgrade to Pro
                        </Link>
                    </div>
                );

            case 'no_subscription':
            case 'inactive':
                return (
                    <div className="flex flex-col space-y-4">
                        <div className="flex items-center">
                            <StatusBadge type="neutral" text="No Subscription" />
                        </div>
                        <Link
                            to="/subscribe"
                            className="self-start inline-flex items-center px-5 py-2.5 bg-theme-accent hover:bg-amber-highlight text-theme-bg text-sm font-mono uppercase tracking-wider rounded-lab transition-all duration-200"
                        >
                            <FontAwesomeIcon icon={faInfinity} className="mr-2 h-3.5 w-3.5" />
                            Upgrade to Pro
                        </Link>
                    </div>
                );

            default:
                // Unknown subscriptionStatus — render neutral state rather than "No Subscription"
                // (avoids showing wrong CTA to users in a state we don't yet recognize, e.g.
                // a stale mobile build receiving a future enum value from the backend).
                return (
                    <p className="text-sm text-theme-text-muted font-mono italic flex items-center">
                        <LoadingSpinner whiteText={false} theme="auto" />
                        Subscription status loading…
                    </p>
                );
        }
    };

    const endDateForComparison = getEndDate();
    const isIAPSubscriber = subscriptionPlatform === 'ios_iap' || subscriptionPlatform === 'android_iap';
    const hasActiveSubscription = (
        userSubscriptionStatus === 'active' ||
        userSubscriptionStatus === 'trialing' ||
        (userSubscriptionStatus === 'canceled' && endDateForComparison && endDateForComparison > new Date())
    );
    // Show manage button for IAP subscribers (no portal needed) or Stripe subscribers (portal required)
    const showManageButton = hasActiveSubscription && (isIAPSubscriber || createCustomerPortalSession);

    return (
        <>
            {/* Main Content Area */}
            <div className="mb-4 p-4 bg-theme-bg-elevated rounded-lab border border-theme-line min-h-[80px]">
                {renderSubscriptionDetails()}
            </div>

            {/* Restore Purchases (native only) */}
            {isNative() && (
                <div className="mb-4">
                    <Alert type={restoreMessageType} message={restoreMessage} />
                    <div className="flex justify-end">
                        <Button
                            onClick={handleRestorePurchases}
                            disabled={isRestoringPurchases}
                            isLoading={isRestoringPurchases}
                            loadingText="Restoring..."
                            text="Restore Purchases"
                            variant="secondary"
                            icon={faRotateRight}
                        />
                    </div>
                </div>
            )}

            {/* Alert for portal errors */}
            <Alert type="error" message={portalError} />

            {/* Manage Button Area */}
            {showManageButton && (
                <div className="flex justify-end mt-4">
                    <div className="flex flex-col items-end gap-2">
                        {subscriptionPlatform === 'android_iap' && (
                            <Link
                                to="/subscribe"
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lab border border-theme-accent text-theme-accent hover:bg-theme-accent/10 font-mono text-sm uppercase tracking-wider transition-colors"
                            >
                                <FontAwesomeIcon icon={faExchangeAlt} className="h-3.5 w-3.5" />
                                Change Plan
                            </Link>
                        )}
                        {!isIAPSubscriber && subscriptionType !== 'lifetime' && hasActiveSubscription && (
                            <Link
                                to="/subscribe"
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lab border border-theme-accent text-theme-accent hover:bg-theme-accent/10 font-mono text-sm uppercase tracking-wider transition-colors"
                            >
                                <FontAwesomeIcon icon={faArrowUp} className="h-3.5 w-3.5" />
                                Change Plan
                            </Link>
                        )}
                        <Button
                            onClick={handleManageBilling}
                            disabled={isPortalLoading}
                            isLoading={isPortalLoading}
                            loadingText="Opening..."
                            text={subscriptionPlatform === 'android_iap' ? 'Manage in Google Play' : subscriptionPlatform === 'ios_iap' ? 'Manage in App Store' : 'Manage Billing'}
                            variant="secondary"
                            icon={faCreditCard}
                            fullWidth={false}
                        />
                        <p className="text-xs text-theme-text-muted font-mono text-right mt-2">
                            {subscriptionPlatform === 'android_iap' || subscriptionPlatform === 'ios_iap'
                                ? 'Manage your subscription in the app store.'
                                : 'Access payment history and update payment methods.'}
                        </p>
                    </div>
                </div>
            )}

            {/* Message if button should show but function isn't available (Stripe subscribers only) */}
            {!isIAPSubscriber && !createCustomerPortalSession && hasActiveSubscription && (
                <p className="text-sm text-theme-text-muted font-mono italic bg-theme-bg-elevated p-3 rounded-lab border border-theme-line flex items-center">
                    <FontAwesomeIcon icon={faExclamationCircle} className="mr-2 text-theme-text-muted" />
                    Billing management is temporarily unavailable.
                </p>
            )}
        </>
    );
};

export default AccountSubscriptionSection;

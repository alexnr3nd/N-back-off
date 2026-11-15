/* src/services/paymentService.js */
/* Central payment orchestration for native IAP (RevenueCat on iOS + Android) and Web (Stripe redirect) */

import { isNative, isIOS, isAndroid } from '../utils/platform';
import { Purchases } from '@revenuecat/purchases-capacitor';

// RevenueCat entitlement identifier (must match RevenueCat dashboard)
const RC_ENTITLEMENT = 'Dual N-Back Pro';

/**
 * Initialize the purchase SDK (RevenueCat) for native platforms (iOS + Android).
 * Should be called after user authentication with their Firebase UID.
 *
 * @param {string} userId - The Firebase UID to associate with RevenueCat
 * @param {string} [email] - The user's email to set as a subscriber attribute
 */
export async function initializePurchases(userId, email) {
    if (!isNative()) return;

    try {
        const apiKey = isIOS()
            ? (process.env.REACT_APP_REVENUECAT_IOS_API_KEY || '')
            : (process.env.REACT_APP_REVENUECAT_ANDROID_API_KEY || '');

        await Purchases.configure({
            apiKey,
            appUserID: userId,
        });

        if (email) {
            await Purchases.setEmail({ email });
        }
    } catch (error) {
        console.error('[PaymentService] Failed to initialize RevenueCat:', error);
    }
}

/**
 * Get the active product identifier from RevenueCat (native only).
 * Used to detect current plan for upgrade/downgrade flows.
 *
 * @returns {Promise<string|null>} Product identifier (e.g. "pro:monthly") or null
 */
export async function getActiveProductId() {
    if (!isNative()) return null;

    try {
        const { customerInfo } = await Purchases.getCustomerInfo();
        const entitlement = customerInfo.entitlements.active[RC_ENTITLEMENT];
        if (!entitlement) return null;

        // Android: combine productIdentifier ('pro') + productPlanIdentifier ('monthly'/'yearly')
        // to get the full store product ID ('pro:monthly' / 'pro:yearly')
        const productId = entitlement.productIdentifier;
        const planId = entitlement.productPlanIdentifier;
        if (isAndroid() && planId) return `${productId}:${planId}`;
        return productId;
    } catch (error) {
        console.error('[PaymentService] Failed to get active product:', error);
        return null;
    }
}

/**
 * Get the active subscription plan type ('monthly' or 'yearly').
 * On Google Play, uses productPlanIdentifier (base plan ID) since
 * productIdentifier is just the subscription product ID (e.g. 'pro').
 * @returns {Promise<string|null>} 'monthly', 'yearly', or null
 */
export async function getActivePlanType() {
    if (!isNative()) return null;

    try {
        const { customerInfo } = await Purchases.getCustomerInfo();
        const entitlement = customerInfo.entitlements.active[RC_ENTITLEMENT];
        if (!entitlement) return null;

        // Lifetime: no expiration date means it's a one-time purchase
        if (!entitlement.expirationDate) return 'lifetime';

        // Google Play: productPlanIdentifier is the base plan ID ('monthly', 'yearly')
        // iOS: productIdentifier contains the full product ID
        const planId = entitlement.productPlanIdentifier || entitlement.productIdentifier;
        if (planId?.includes('monthly')) return 'monthly';
        if (planId?.includes('yearly') || planId?.includes('annual')) return 'yearly';
        return null;
    } catch (error) {
        console.error('[PaymentService] Failed to get active plan type:', error);
        return null;
    }
}

/**
 * Get available subscription offerings from RevenueCat (native only).
 * Returns the offerings with localized pricing from App Store / Play Store.
 *
 * @returns {Promise<object|null>} RevenueCat offerings or null on web/error
 */
export async function getOfferings() {
    if (!isNative()) return null;

    try {
        const offerings = await Purchases.getOfferings();
        return offerings.current;
    } catch (error) {
        console.error('[PaymentService] Failed to get offerings:', error);
        return null;
    }
}

/**
 * Start the checkout/purchase flow.
 * - Native (iOS/Android): RevenueCat In-App Purchase
 * - Web: Redirect to Stripe checkout URL
 *
 * @param {object} options
 * @param {string} options.checkoutUrl - Stripe checkout URL (Web only)
 * @param {string} options.selectedPlan - 'monthly', 'yearly', or 'lifetime' (native)
 * @param {object} options.rcPackage - RevenueCat package object (native, optional)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function startCheckout({ checkoutUrl, selectedPlan, rcPackage, googleProductChangeInfo }) {
    if (isNative()) {
        return startNativePurchase({ selectedPlan, rcPackage, googleProductChangeInfo });
    }

    // Web: redirect to Stripe checkout
    if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return { success: true };
    }

    return { success: false, error: 'No checkout URL provided.' };
}

/**
 * Native In-App Purchase via RevenueCat (iOS + Android).
 */
async function startNativePurchase({ selectedPlan, rcPackage, googleProductChangeInfo }) {
    try {
        let packageToPurchase = rcPackage;

        // If no package provided, get it from offerings
        if (!packageToPurchase) {
            const offerings = await Purchases.getOfferings();
            const current = offerings.current;
            if (!current) {
                return { success: false, error: 'No subscription offerings available.' };
            }
            // Select package by plan type
            packageToPurchase = selectedPlan === 'lifetime'
                ? current.lifetime
                : selectedPlan === 'yearly'
                    ? current.annual
                    : current.monthly;

            if (!packageToPurchase) {
                return { success: false, error: `${selectedPlan} plan not available.` };
            }
        }

        const purchaseOptions = { aPackage: packageToPurchase };
        if (googleProductChangeInfo) {
            purchaseOptions.googleProductChangeInfo = googleProductChangeInfo;
        }

        const { customerInfo } = await Purchases.purchasePackage(purchaseOptions);

        // Check if the user now has an active entitlement
        const isActive = customerInfo.entitlements.active[RC_ENTITLEMENT] !== undefined;

        if (isActive) {
            return { success: true };
        }

        return { success: false, error: 'Purchase completed but subscription not activated.' };
    } catch (error) {
        if (error.code === 1 || error.message?.includes('cancelled')) {
            return { success: false, error: 'Purchase cancelled.' };
        }
        console.error('[PaymentService] Native purchase error:', error);
        return { success: false, error: error.message || 'Purchase failed.' };
    }
}

/**
 * Full native IAP checkout flow — single entry point for components.
 * Handles fetching offerings and starting the purchase.
 *
 * @param {object} options
 * @param {string} options.selectedPlan - 'monthly', 'yearly', or 'lifetime'
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function startNativeCheckoutFlow({ selectedPlan }) {
    if (!isNative()) return { success: false, error: 'Not on native platform.' };

    const offerings = await getOfferings();
    if (!offerings) return { success: false, error: 'No offerings available. Please try again.' };

    const rcPackage = selectedPlan === 'lifetime'
        ? offerings.lifetime
        : selectedPlan === 'yearly' ? offerings.annual : offerings.monthly;
    if (!rcPackage) return { success: false, error: `${selectedPlan} plan not available.` };

    // For base plan changes within the same Google Play subscription product,
    // Google Play handles the replacement automatically using the policy
    // configured in Play Console ("Customer base plan and offer changes").
    // googleProductChangeInfo is only needed for cross-subscription product changes.
    return startCheckout({ selectedPlan, rcPackage });
}

/**
 * Open the billing management portal.
 * - iOS: App Store subscriptions
 * - Android: Google Play subscriptions
 * - Web: Stripe Customer Portal
 *
 * @param {string} portalUrl - Stripe customer portal URL (Web)
 */
export async function openBillingPortal(portalUrl) {
    if (isIOS()) {
        try {
            const { Browser } = await import('@capacitor/browser');
            await Browser.open({ url: 'https://apps.apple.com/account/subscriptions' });
        } catch (error) {
            console.error('[PaymentService] Failed to open App Store subscriptions:', error);
        }
        return;
    }

    if (isAndroid()) {
        try {
            const { Browser } = await import('@capacitor/browser');
            await Browser.open({ url: 'https://play.google.com/store/account/subscriptions' });
        } catch (error) {
            console.error('[PaymentService] Failed to open Google Play subscriptions:', error);
        }
        return;
    }

    // Web: redirect to Stripe portal
    if (portalUrl) {
        window.location.href = portalUrl;
    }
}

/**
 * Restore previous purchases (native only, required by Apple and recommended for Android).
 *
 * @returns {Promise<{success: boolean, isActive: boolean, error?: string}>}
 */
export async function restorePurchases() {
    if (!isNative()) {
        return { success: false, isActive: false, error: 'Restore is only available on mobile.' };
    }

    try {
        const { customerInfo } = await Purchases.restorePurchases();
        const isActive = customerInfo.entitlements.active[RC_ENTITLEMENT] !== undefined;

        return { success: true, isActive };
    } catch (error) {
        console.error('[PaymentService] Restore purchases error:', error);
        return { success: false, isActive: false, error: error.message || 'Restore failed.' };
    }
}

/* src/constants/stripeConstants.js */

// Read Price IDs from environment variables
// These are used by the FRONTEND for validation and selection logic.
// Ensure these variables are set in your .env (for local/test) and .env.production (for live)
const monthlyPriceId = process.env.REACT_APP_STRIPE_PRICE_ID_MONTHLY;
const yearlyPriceId = process.env.REACT_APP_STRIPE_PRICE_ID_YEARLY;
const lifetimePriceId = process.env.REACT_APP_STRIPE_PRICE_ID_LIFETIME;

// Basic check to ensure the environment variables are loaded
if (!monthlyPriceId || !yearlyPriceId) {
    console.error(
        "Stripe Price ID environment variables (REACT_APP_STRIPE_PRICE_ID_MONTHLY, REACT_APP_STRIPE_PRICE_ID_YEARLY) are not set! " +
        "Check your .env files and build process."
    );
}


export const PRICE_IDS = {
    monthly: monthlyPriceId,
    yearly: yearlyPriceId,
    lifetime: lifetimePriceId,
};

// Log which IDs are being used by the frontend (development only)
if (process.env.NODE_ENV === 'development') {
    console.log("[stripeConstants] Frontend using Price IDs:", PRICE_IDS);
}

// Publishable key is handled separately, usually where Stripe.js is initialized
// export const STRIPE_PUBLISHABLE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
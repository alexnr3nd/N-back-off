/* Payment integrations are deliberately absent in this offline rebuild.
 * Existing premium-only features remain gated by the local free tier.
 */
export const initializePurchases = async () => undefined;
export const getActiveProductId = async () => null;
export const getActivePlanType = async () => null;
export const getOfferings = async () => null;
export const startCheckout = async () => ({ success: false, error: 'Compras não estão disponíveis nesta versão offline.' });
export const startNativeCheckoutFlow = async () => ({ success: false, error: 'Compras não estão disponíveis nesta versão offline.' });
export const openBillingPortal = async () => ({ success: false, error: 'Portal de cobrança indisponível na versão offline.' });
export const restorePurchases = async () => ({ success: false, error: 'Restauração de compras indisponível na versão offline.' });

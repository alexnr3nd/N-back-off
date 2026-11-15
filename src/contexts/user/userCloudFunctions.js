/* src/contexts/user/userCloudFunctions.js */
import { getFunctions, httpsCallable } from 'firebase/functions';
import { functions as functionsInstance } from '../../firebaseConfig'; // Assuming functions instance is exported from firebaseConfig

// Initialize variables to hold the function references (default to null)
let deleteProfileAndCleanupFn = null;
let deleteAccountFn = null;
let setProfileUsernameFn = null;
let checkSubscriptionStatusFn = null;
let fetchUserSessionsFn = null;
let exportUserSessionsFn = null;
let getUserDataOnLoginFn = null;
let updateUserTimezoneFn = null;
let getTimezoneChangeStatusFn = null;
let fetchSessionsLightweightFn = null;
let activateFreeTrialFn = null;
let declineFreeTrialFn = null;
let markFreeTrialExpirySeenFn = null;
let updateSessionNoteFn = null;
let cancelLifetimeTrialFn = null;
let acknowledgeHealthSafetyNoticeFn = null;
let recordUpgradeModalImpressionFn = null;
let recordUpgradeModalDismissFn = null;
let recordUpgradeModalAcceptFn = null;

// Define the names of your Cloud Functions as deployed
const functionNames = {
  getUserDataOnLogin: 'getUserDataOnLogin',
  deleteProfile: 'deleteProfileAndCleanup',
  deleteAccount: 'deleteAccount',
  setProfileUsername: 'setProfileUsername',
  checkSubscription: 'checkSubscriptionStatus',
  fetchUserSessions: 'fetchUserSessions',
  exportUserSessions: 'exportUserSessions',
  fetchSessionsLightweight: 'fetchSessionsLightweight',
  updateUserTimezone: 'updateUserTimezone',
  getTimezoneChangeStatus: 'getTimezoneChangeStatus',
  activateFreeTrial: 'activateFreeTrial',
  declineFreeTrial: 'declineFreeTrial',
  markFreeTrialExpirySeen: 'markFreeTrialExpirySeen',
  updateSessionNote: 'updateSessionNote',
  cancelLifetimeTrial: 'cancelLifetimeTrial',
  acknowledgeHealthSafetyNotice: 'acknowledgeHealthSafetyNotice',
  recordUpgradeModalImpression: 'recordUpgradeModalImpression',
  recordUpgradeModalDismiss: 'recordUpgradeModalDismiss',
  recordUpgradeModalAccept: 'recordUpgradeModalAccept'
};

try {
  // Ensure the functions instance from firebaseConfig is valid
  if (functionsInstance) {
    // Get callable references for each function
    getUserDataOnLoginFn = httpsCallable(functionsInstance, functionNames.getUserDataOnLogin);
    deleteProfileAndCleanupFn = httpsCallable(functionsInstance, functionNames.deleteProfile);
    deleteAccountFn = httpsCallable(functionsInstance, functionNames.deleteAccount);
    setProfileUsernameFn = httpsCallable(functionsInstance, functionNames.setProfileUsername);
    checkSubscriptionStatusFn = httpsCallable(functionsInstance, functionNames.checkSubscription);
    fetchUserSessionsFn = httpsCallable(functionsInstance, functionNames.fetchUserSessions);
    exportUserSessionsFn = httpsCallable(functionsInstance, functionNames.exportUserSessions);
    updateUserTimezoneFn = httpsCallable(functionsInstance, functionNames.updateUserTimezone);
    getTimezoneChangeStatusFn = httpsCallable(functionsInstance, functionNames.getTimezoneChangeStatus);
    fetchSessionsLightweightFn = httpsCallable(functionsInstance, functionNames.fetchSessionsLightweight);
    activateFreeTrialFn = httpsCallable(functionsInstance, functionNames.activateFreeTrial);
    declineFreeTrialFn = httpsCallable(functionsInstance, functionNames.declineFreeTrial);
    markFreeTrialExpirySeenFn = httpsCallable(functionsInstance, functionNames.markFreeTrialExpirySeen);
    updateSessionNoteFn = httpsCallable(functionsInstance, functionNames.updateSessionNote);
    cancelLifetimeTrialFn = httpsCallable(functionsInstance, functionNames.cancelLifetimeTrial);
    acknowledgeHealthSafetyNoticeFn = httpsCallable(functionsInstance, functionNames.acknowledgeHealthSafetyNotice);
    recordUpgradeModalImpressionFn = httpsCallable(functionsInstance, functionNames.recordUpgradeModalImpression);
    recordUpgradeModalDismissFn = httpsCallable(functionsInstance, functionNames.recordUpgradeModalDismiss);
    recordUpgradeModalAcceptFn = httpsCallable(functionsInstance, functionNames.recordUpgradeModalAccept);

  } else {
    // Log a warning if the functions instance couldn't be obtained from firebaseConfig
    console.warn("[profileCloudFunctions] Firebase Functions instance not found in firebaseConfig. Cloud function calls will fail.");
  }

} catch (e) {
  // Log any errors during the httpsCallable initialization process
  console.error("[profileCloudFunctions] Error getting Firebase Cloud Function references:", e);
  // Ensure all references remain null if any error occurs
  getUserDataOnLoginFn = null;
  deleteProfileAndCleanupFn = null;
  deleteAccountFn = null;
  setProfileUsernameFn = null;
  checkSubscriptionStatusFn = null;
  fetchUserSessionsFn = null;
  exportUserSessionsFn = null;
  updateUserTimezoneFn = null;
  getTimezoneChangeStatusFn = null;
  fetchSessionsLightweightFn = null;
  activateFreeTrialFn = null;
  declineFreeTrialFn = null;
  markFreeTrialExpirySeenFn = null;
  updateSessionNoteFn = null;
  cancelLifetimeTrialFn = null;
  acknowledgeHealthSafetyNoticeFn = null;
  recordUpgradeModalImpressionFn = null;
  recordUpgradeModalDismissFn = null;
  recordUpgradeModalAcceptFn = null;
}

// Export the function references (they will be null if initialization failed)
export {
  getUserDataOnLoginFn,
  deleteProfileAndCleanupFn,
  deleteAccountFn,
  setProfileUsernameFn,
  checkSubscriptionStatusFn,
  fetchUserSessionsFn,
  exportUserSessionsFn,
  updateUserTimezoneFn,
  getTimezoneChangeStatusFn,
  fetchSessionsLightweightFn,
  activateFreeTrialFn,
  declineFreeTrialFn,
  markFreeTrialExpirySeenFn,
  updateSessionNoteFn,
  cancelLifetimeTrialFn,
  acknowledgeHealthSafetyNoticeFn,
  recordUpgradeModalImpressionFn,
  recordUpgradeModalDismissFn,
  recordUpgradeModalAcceptFn
};
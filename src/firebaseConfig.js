/* File: src/firebaseConfig.js */

// src/firebaseConfig.js
import { initializeApp } from 'firebase/app';

// Import specific service functions and emulator connectors
import { getAuth, initializeAuth, indexedDBLocalPersistence, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'; // Import Functions emulator connector and callable helper
// import { getStorage, connectStorageEmulator } from 'firebase/storage'; // Uncomment if using Storage emulator
import { getAnalytics, isSupported } from "firebase/analytics"; // Import isSupported for conditional Analytics init
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken as getAppCheckToken } from 'firebase/app-check'; // App Check for backend protection
import { isEmulatorEnv as isEmulatorEnvironment, isNative, isIOS } from './utils/platform'; // Platform detection

// --- Firebase Project Configuration ---
// IMPORTANT: It's highly recommended to load these values from environment variables
// (e.g., .env files) rather than hardcoding them directly in your source code,
// especially the apiKey.
// Example using environment variables (if using Create React App):
// const firebaseConfig = {
//   apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
//   authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
//   projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
//   storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
//   messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
//   appId: process.env.REACT_APP_FIREBASE_APP_ID,
//   measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID // Optional
// };
// Remember to add these variables to your .env and .env.production files.

// Using the hardcoded values from your example (replace with your actual config OR use env vars)
const firebaseConfig = {
    apiKey: "AIzaSyAL2q244gxFO83BT-pJrzGy1KaHSjs_Mzk", // Replace with your actual config
    authDomain: "dual-n-back-web-app.firebaseapp.com",
    projectId: "dual-n-back-web-app",
    storageBucket: "dual-n-back-web-app.appspot.com",
    messagingSenderId: "295034730281",
    appId: "1:295034730281:web:0985a41c0105e56fbe6938",
    measurementId: "G-RB23S0812K" // Optional: For Google Analytics

};

// Native iOS override: the web ("browser") API key is HTTP-referrer restricted, and
// iOS WKWebView requests originate from capacitor://localhost, which Google's key
// restrictions reject (Android is unaffected — androidScheme https makes its origin
// https://localhost). Use the iOS app's own API key from GoogleService-Info.plist.
// The appId stays the web one so the JS SDK behaves identically to Android native.
if (isIOS()) {
    firebaseConfig.apiKey = "AIzaSyC0kDfx2SjzzihLQUfePB4r6ZNFZadMfRI";
}

// --- Initialize Firebase App ---
const app = initializeApp(firebaseConfig);
// Firebase app initialized


// --- Initialize App Check ---
// Protects backend resources (Cloud Functions, Firestore) from abuse
// Uses reCAPTCHA Enterprise on web, native attestation (DeviceCheck/Play Integrity) on mobile
const isLocalDev = isEmulatorEnvironment();

if (isLocalDev && process.env.REACT_APP_APPCHECK_DEBUG_TOKEN) {
    // Enable debug mode for local development
    // This allows App Check to work with emulators
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.REACT_APP_APPCHECK_DEBUG_TOKEN;
    // App Check debug mode enabled for local development
} else if (isNative() && process.env.REACT_APP_APPCHECK_NATIVE_DEBUG_TOKEN) {
    // Native platforms: Use debug token until native attestation (DeviceCheck/Play Integrity) is set up.
    // The debug token is registered in Firebase Console > App Check > Manage debug tokens.
    // TODO: Replace with real native attestation via Capacitor plugin for production.
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.REACT_APP_APPCHECK_NATIVE_DEBUG_TOKEN;
    // App Check debug mode enabled for native
} else if (isNative()) {
    console.warn('App Check: Native debug token not configured (REACT_APP_APPCHECK_NATIVE_DEBUG_TOKEN). App Check may fail.');
}

let appCheck = null;
try {
    // Use reCAPTCHA Enterprise provider for all platforms.
    // On native/local dev, the debug token mechanism overrides the provider
    // so reCAPTCHA is never actually invoked.
    const appCheckProvider = new ReCaptchaEnterpriseProvider(process.env.REACT_APP_RECAPTCHA_SITE_KEY);

    appCheck = initializeAppCheck(app, {
        provider: appCheckProvider,
        isTokenAutoRefreshEnabled: true // Automatically refresh App Check tokens
    });
    // App Check initialized
} catch (appCheckError) {
    console.warn("Firebase App Check could not be initialized:", appCheckError);
}

/**
 * Ensures an App Check token is available before Firebase operations.
 * This helps prevent "App Check token is invalid" errors on first login attempt
 * when the token hasn't been fetched yet.
 *
 * @param {boolean} forceRefresh - If true, forces a fresh token from the server
 * @returns {Promise<string|null>} The token string, or null if unavailable
 */
export const ensureAppCheckToken = async (forceRefresh = false) => {
    const { token } = await fetchAppCheckToken(forceRefresh);
    return token;
};

/**
 * Like ensureAppCheckToken, but keeps the SDK error instead of collapsing it to null.
 * The token preflight in gameCloudFunctions needs to tell a network failure
 * (`appCheck/fetch-network-error` → queue for offline retry) from an attestation
 * failure (403 / throttled / reCAPTCHA → the SDK will send NO App Check header and
 * the backend will reject the call; the queue must retry that only a bounded number
 * of times). Never throws.
 *
 * @param {boolean} forceRefresh
 * @returns {Promise<{ token: string|null, error: Error|null }>}
 */
export const fetchAppCheckToken = async (forceRefresh = false) => {
    if (!appCheck) {
        console.warn('[AppCheck] App Check not initialized, skipping token fetch');
        return { token: null, error: null };
    }
    try {
        const result = await getAppCheckToken(appCheck, forceRefresh);
        return { token: result.token, error: null };
    } catch (error) {
        console.warn('[AppCheck] Failed to get token:', error?.message);
        return { token: null, error };
    }
};


// --- Get Service Instances ---
// Initialize service instances regardless of environment. Connection details are handled below.
// Native: initializeAuth WITHOUT a popupRedirectResolver. getAuth()'s default resolver
// loads an iframe from authDomain during startup, which hangs under iOS's capacitor://
// origin and prevents onAuthStateChanged from ever firing (app stuck on Loading).
// Native sign-in flows go through @capacitor-firebase/authentication, so the web
// popup/redirect resolver is unnecessary there. Web keeps getAuth() unchanged.
const auth = isNative()
    ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
    : getAuth(app);
// Enable Firestore offline persistence for cached data when offline.
// Platform-aware: Capacitor uses single-tab manager (avoids false multi-tab errors on WebView),
// web uses multi-tab manager for real multi-tab scenarios.
let db;
try {
    // Use single-tab manager for all platforms. Multi-tab manager uses localStorage for
    // cross-tab coordination, which can fill the ~5MB quota and crash the app (QuotaExceededError).
    // Single-tab manager uses in-memory coordination and doesn't touch localStorage at all.
    const tabManager = persistentSingleTabManager({ forceOwnership: true });
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager }),
    });
} catch (error) {
    // Fallback: if persistence fails (e.g., private browsing, corrupt IndexedDB)
    console.warn('[Firestore] Offline persistence failed, using default:', error.message);
    db = getFirestore(app);
}
let functionsInstance = getFunctions(app); // Initialize Functions instance (let allows reassignment for region)
// const storage = getStorage(app); // Uncomment if using Storage


// --- Connect to Emulators in Development Environment ---
// Uses platform-aware detection: on native, always false (prevents connecting to emulators)
// On web, checks for localhost/127.0.0.1 as before
// **** EXPORT THIS FLAG ****
export const isEmulatorEnv = isEmulatorEnvironment();

if (isEmulatorEnv) {
  console.warn(
    "!! DEVELOPMENT MODE DETECTED !! Connecting to Firebase Emulators. " +
    "Ensure emulators are running (`firebase emulators:start`)."
  );

  try {
    // Point Auth SDK to Auth Emulator
    // Port configured in firebase.json
    // Use 127.0.0.1 instead of localhost if you encounter connection issues in some environments
    connectAuthEmulator(auth, "http://localhost:9199", { disableWarnings: true });
    // Connected to Auth Emulator

    // Point Firestore SDK to Firestore Emulator
    // Port configured in firebase.json
    connectFirestoreEmulator(db, "localhost", 8180);
    // Connected to Firestore Emulator

    // *** Point Functions SDK to Functions Emulator ***
    // Port configured in firebase.json
    connectFunctionsEmulator(functionsInstance, "localhost", 5101);
    // Connected to Functions Emulator

    // Point Storage SDK to Storage Emulator (Uncomment if using)
    // Port configured in firebase.json: 9299
    // connectStorageEmulator(storage, "127.0.0.1", 9299);
    // console.log("-> Connected to Storage Emulator (http://127.0.0.1:9299)");

    // Note: You don't connect Analytics to an emulator.

  } catch (error) {
     // Log and alert if emulator connection fails
     console.error("!!! CRITICAL ERROR: Failed to connect to Firebase Emulators !!!", error);
     alert(
       "Error connecting to Firebase Emulators. Please ensure they are running " +
       "(`firebase emulators:start`) and check the browser console for details."
     );
  }
} else {
  // --- Production Environment Configuration ---
  // Production environment - using live Firebase services

  // Optional: Configure Functions region for production if it's different from the default (us-central1)
  // Example: If your functions are deployed to 'europe-west1'
  // functionsInstance = getFunctions(app, 'europe-west1');
  // console.log("Functions region configured for production:", functionsInstance.region);
}
// --- End Emulator Connection Logic ---


// --- Initialize Analytics (Conditionally) ---
let analytics = null; // Initialize as null

// Check if Analytics is supported in the current browser environment before initializing
isSupported().then((supported) => {
  // Initialize Analytics only if supported AND not in the emulator environment (optional)
  // You might want analytics disabled locally to avoid sending test data.
  if (supported && typeof window !== 'undefined' /* && !isEmulatorEnv */) {
      try {
          analytics = getAnalytics(app);
          // Analytics initialized
      } catch (error) {
          // Catch potential initialization errors (e.g., browser extensions blocking)
          console.warn("Firebase Analytics could not be initialized:", error);
      }
  } else if (isEmulatorEnv) {
       // Analytics disabled in emulator environment
  } else {
      // Analytics not supported in this browser environment
  }
}).catch(err => {
    // Catch errors during the support check itself
    console.warn("Error checking Firebase Analytics support:", err);
});


// --- Export Initialized Services ---
// Export the services for use throughout your application.
// Exporting 'functionsInstance' as 'functions' is a common convention.
export {
    app, // Export the app instance if needed elsewhere
    auth,
    db,
    functionsInstance as functions, // Export the potentially emulator-connected Functions instance
    analytics,
    appCheck, // Export App Check instance
    httpsCallable // Export httpsCallable helper for convenience
    // storage // Uncomment if using Storage
};
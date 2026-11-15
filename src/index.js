/* src/index.js */

import React from 'react';
import { createRoot } from 'react-dom/client'; // Use createRoot for React 18+
import * as Sentry from '@sentry/react';
import './index.css'; // Import global styles (including Tailwind)
import App from './App'; // Main application component
import '@fortawesome/fontawesome-free/css/all.min.css';
import { initializeLogInterceptor } from './utils/logInterceptor'; // Import the interceptor
import { initCapacitor } from './capacitorInit'; // Capacitor native platform initialization
import { isNative } from './utils/platform';
import { installGlobalHandler, isFirestoreAssertionError, scheduleRecovery } from './utils/firestoreRecovery';
import { db } from './firebaseConfig';

// Initialize Sentry as early as possible for error tracking
Sentry.init({
  dsn: "https://accb0e5398a10d1bb1b0f69cfbce54cd@o4510614840541184.ingest.us.sentry.io/4510614846701568",

  // Send default PII data (IP addresses, etc.)
  sendDefaultPii: true,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      // Unmask text so we can see UI labels, buttons, headings
      maskAllText: false,
      // Keep form inputs masked for privacy (passwords, emails, etc.)
      maskAllInputs: true,
      // Show images and media
      blockAllMedia: false,
    }),
    // Send console.warn and console.error to Sentry (not console.log to reduce noise)
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
  ],

  // Performance Monitoring - sample 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Trace propagation for Firebase Cloud Functions
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/.*\.cloudfunctions\.net/,
    /^https:\/\/.*\.run\.app/,
    /^https:\/\/app\.dualnback\.com/,
    /^https:\/\/dualnback\.com/,
  ],

  // Session Replay - capture 10% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Enable logs to be sent to Sentry
  _experiments: {
    enableLogs: true,
  },

  // Environment tag
  environment: process.env.NODE_ENV || 'development',
});

// Expose Sentry globally for debugging (can remove in production later)
window.Sentry = Sentry;

// Initialize the console log interceptor as early as possible
initializeLogInterceptor();

// Initialize Capacitor native features (status bar, etc.) on mobile platforms
initCapacitor();

// Install Firestore crash recovery handler (detects IndexedDB assertion bug, auto-recovers)
installGlobalHandler(db);

// React app initializing

// Find the root DOM element for mounting the React app
const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);

  // For development, we are removing React.StrictMode to avoid duplicate effect invocations
  // (which can cause the countdown component to mount/unmount and reset prematurely).
  // Once you've confirmed the fix, you can wrap <App /> in <React.StrictMode> again if desired.
  root.render(
    <Sentry.ErrorBoundary
      onError={(error) => {
        if (isFirestoreAssertionError(error)) {
          scheduleRecovery(db);
        }
      }}
      fallback={({ error, resetError }) => (
        <div className="min-h-screen flex items-center justify-center bg-theme-bg p-4">
          <div className="bg-theme-bg-secondary border border-theme-line p-8 rounded-lg max-w-md text-center">
            <h1 className="text-xl font-bold text-theme-text mb-4">Something went wrong</h1>
            <p className="text-theme-text-muted mb-6">We've been notified and are looking into it.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-theme-accent text-theme-bg rounded font-mono text-sm"
            >
              Reload Page
            </button>
          </div>
        </div>
      )}
      showDialog
    >
      <App />
    </Sentry.ErrorBoundary>
  );
} else {
  console.error("Failed to find the root element. Make sure your HTML file has an element with the ID 'root'.");
}

// Register service worker in production (web browsers only)
// Explicitly skip native Capacitor apps, including iOS WKWebView where service workers may be exposed
if (!isNative() && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('[SW] Registered:', registration.scope);

        // When a new SW is waiting, check if a game is active before activating
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available — check if game is active
              const gameActive = document.querySelector('[data-game-active="true"]');
              if (!gameActive) {
                // No active game — activate new SW immediately
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
              // If game is active, VersionCheckContext will handle refresh after game ends
            }
          });
        });
      })
      .catch(err => console.warn('[SW] Registration failed:', err));
  });
}
# Dual N-Back 1.1.60 — recovered source notes

This directory contains application source text recovered from the JavaScript source maps embedded in the APK.

## Confirmed from the recovered source
- The Android shell uses Capacitor 8.0.0 (`appId`: `com.dualnback.android`).
- The web client is React/JavaScript and ships its application bundles under `assets/public/static/js/`.
- The source maps include `sourcesContent`, allowing recovery of application source files.
- Firebase Auth, Firestore, Firebase Functions, Analytics and App Check are imported by the app.
- RevenueCat is registered as a native Capacitor plugin and `paymentService.js` initializes it after authentication.
- The app has a local sequence generator and an acquisition path that can fall back to local generation for regular single sessions.
- `gameSetup.js` explicitly documents continuous-chain blocks as server-only because they require `bufferTrials` and primer stimuli.
- `gameEnd.js` currently sends session results to backend functions and queues failed saves in IndexedDB for later retry; this is not equivalent to a fully local-first save system.
- `UserContext.js` says the app was changed to a flattened, single-user structure and explicitly notes that profile CRUD actions were removed. Multi-profile local support therefore needs to be reintroduced.

## Not yet included
This is recovered source code, not a complete original build project. The APK does not contain the original `package.json`, lockfile, Gradle project, signing configuration, or all original development assets. A reproducible Android build requires reconstructing those project files and verifying dependency versions.

## Requested modification target
- Preserve currently available non-subscription functionality; do not unlock subscription-only features.
- Replace mandatory account/cloud dependencies with local storage.
- Reintroduce multiple independent local profiles.
- Store sessions, progression, settings and preferences per profile.
- Provide local export/import backups.
- Remove nonessential account, analytics, remote presence, payment and Play-dependent integrations from the offline build.
- Make every retained gameplay mode work offline; continuous mode requires a local equivalent of the server-side chain primer logic before it can be considered complete.

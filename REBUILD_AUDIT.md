# Offline rebuild — audit

Branch: `offline-rebuild`
Target: Dual N-Back 1.1.60 (Capacitor appId `com.dualnback.android`)

## Verified inputs

- `dualnback_recovered_sources.zip` is present in the repository root.
- `dualnback_visual_assets.zip` is now present in the repository root (1,064,960 bytes).
- The original XAPK is available in the current reconstruction workspace. Its base APK contains 9,462 entries, including the production HTML, CSS, JavaScript source maps, media, and Capacitor configuration.
- The visual archive contains the production CSS, the eight ICAR figure images, Font Awesome font files, icons, and the original HTML/manifest. It does not contain the complete audio/face asset library.

## Source recovery findings

- 504 application source files were recovered from JavaScript source maps: 500 under `src/` and 4 under `functions/`.
- Recovered source still depends on Firebase Auth/Firestore/Functions, Sentry, RevenueCat, and Capacitor plugins.
- The current source has missing local imports: `src/contexts/game/gameUtils`, `src/components/dashboard/TrainingModeFilter`, `src/components/dashboard/ReadinessIndicator`, `src/components/account/AccountLogoutSection`, and eight ICAR image paths. The eight images are available in the visual archive under fingerprinted filenames and need to be copied/renamed to the expected source paths.
- `src/index.js` still initializes Sentry and Firestore; `src/contexts/UserContext.js` still relies on Firebase-backed identity/session data and subscription services. This is not yet an offline-first app.

## Missing build inputs

- `package.json` and lockfile
- `public/index.html` (sanitized for offline use)
- `src/index.css` and Tailwind/PostCSS configuration
- Capacitor configuration and Android Gradle project
- A repeatable Android build workflow

## Required implementation sequence

1. Restore local public assets and the eight ICAR images without copying external analytics, reCAPTCHA, or CDN dependencies from the original HTML.
2. Reconstruct a reproducible React/Capacitor dependency manifest and Android build workflow.
3. Resolve missing source modules and compile the recovered application.
4. Replace account-bound persistence with isolated local profiles, local session/history/settings storage, and JSON backup/restore.
5. Disconnect Firebase, App Check/reCAPTCHA, analytics/Sentry, RevenueCat, and account/payment screens only after their call sites are safely replaced.
6. Verify the app starts and runs in airplane mode; test each retained game mode, persistence, profile isolation, and backup/restore.

## Current status

Inputs are present and audited. No offline behavior has been implemented and no APK has been built or tested yet. Do not describe the app as offline-ready until the full verification above passes.

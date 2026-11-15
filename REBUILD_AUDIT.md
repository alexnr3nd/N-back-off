# Offline rebuild — audit

Branch: `offline-rebuild`
Base: `main`
Application target: Dual N-Back 1.1.60 (Capacitor appId `com.dualnback.android`)

## Verified repository state

- 599 Git tree entries: 500 recovered application JavaScript files and 4 recovered sequence-generator files, plus notes/workflow/archive.
- Present: `src/`, `functions/`, `RECOVERY_NOTES.md`, `dualnback_recovered_sources.zip`.
- Missing from repository: `package.json`, lockfile, `public/index.html`, CSS, public/media assets, Capacitor config, Android Gradle project.
- Recovered source still imports Firebase Auth/Firestore/Functions, Sentry, RevenueCat, and multiple Capacitor plugins.
- Recovered source has unresolved local imports, including `src/contexts/game/gameUtils`, dashboard components, `src/components/account/AccountLogoutSection`, and eight ICAR image assets.
- The original APK contains `assets/public/index.html`, compiled CSS, JS bundles, media/audio assets, and Capacitor configuration. These assets are not currently in this Git repository.

## Offline conversion requirements

1. Reconstruct the web build inputs and dependency manifest before attempting an APK build.
2. Preserve the original gameplay and current non-subscription functionality.
3. Replace account-bound user/session persistence with per-profile local storage.
4. Add profile create/select/rename/delete and isolated progression/history/settings.
5. Add JSON export/import for local backups.
6. Route normal sequence generation to the local generator; continuous-chain mode still needs a local implementation of its server primer/buffer logic.
7. Remove Firebase, App Check/reCAPTCHA, analytics/Sentry, RevenueCat, and account/payment UI from the offline build only after their call sites are replaced or safely disconnected.
8. Build and test Android in airplane mode; do not mark offline-complete until startup, each retained game mode, persistence, and backup/restore pass.

## Current status

Audit only. No gameplay or authentication code has been changed yet. The next implementation step is reconstructing the web project manifest and restoring required static assets from the supplied XAPK/APK, then establishing a repeatable Android build.

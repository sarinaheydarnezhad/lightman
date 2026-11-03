# Signed Android releases

The current release candidate is `com.lerona.app`, version **1.0.0**, Android version code **5**. Earlier version-code-1 APKs used a debug key. Production releases use the permanent `lerona-release` key, with an RSA-4096 certificate valid through October 25, 2056.

## Build the Myket APK

From the project root, with the locked dependencies installed:

```powershell
pnpm install --frozen-lockfile
pnpm run android:apk
pnpm run android:verify
```

This runs Android prebuild with the Myket and release-signing plugins, then assembles the universal APK using production environment files. It does not install the app or upload it to a store. The current release is copied to `releases/lerona-1.0.0-5-myket.apk`; Gradle also produces `android/app/build/outputs/apk/release/app-release.apk`.

The signing plugin is reapplied by prebuild. Its Gradle script loads the private key at build time and compares its certificate with the pinned public fingerprint in `android-release-signing.json`. Release builds fail if credentials are missing, invalid or belong to a different key; they cannot silently fall back to a debug key. Debug builds continue to use the debug signing configuration.

The verification command checks the packaged version, permanent signing certificate, non-debuggable build, Myket billing bridge and permission, production backend URL, and exact bytes of all four bundled Vazirmatn font files. It writes a `.release.json` report beside the APK. Temporary workspace tools are not required to build or verify releases.

## Keep the permanent key and its backup

Private signing files are in `.secrets/android-release/`, outside the generated `android/` directory. This directory is excluded from Git. Keep **both** `signing.json` and `lerona-release.p12`; the JSON contains the generated passwords. Do not put their contents in chat, source control or public environment variables.

A second, hash-verified copy was created at **`C:\a\LeronaReleaseKeys`**, with access restricted to the local user, Administrators and SYSTEM. Copy that folder to secure offline storage. Two copies on the same computer do not protect against disk failure. Future releases must use this same key; never run key generation again for this application.

For a coworker's machine or a build server, transfer the signing folder privately and either restore it to `<project>/.secrets/android-release/` or set `LERONA_ANDROID_SIGNING_FILE` to the **absolute path** of its `signing.json`. Keep the keystore beside that JSON so its relative `storeFile` path resolves. Do not generate a separate key on each machine.

The public certificate is [android-release-certificate.pem](android-release-certificate.pem). Its SHA-1 and SHA-256 fingerprints are in [android-release-signing.json](../android-release-signing.json). These public files can be committed and shared. Register the release SHA-1 with the Android Google OAuth client for `com.lerona.app` if Google sign-in is enabled. The app-signing certificate is separate from the Myket billing RSA public key; no backend payment key change is required.

## Store submission and existing test installations

The signing setup and APK build do not publish the app. Myket still needs to accept and review the uploaded APK. An earlier debug-signed version was present as an unpublished draft when last inspected; its current state and acceptance of the production certificate have not been rechecked. If Myket rejects a different certificate on that draft, resolve the draft's signing registration with Myket before the first publication. Do not change the package name to bypass it.

A debug-signed installation cannot be updated directly with this production-signed APK because Android compares signing certificates. No phone is automatically uninstalled or cleared by the build command. Preserve/sync test data before arranging the one-time switch from the old debug installation. Subsequent production updates use this permanent key and can update in place.

Increase `expo.android.versionCode` in `app.json` for every future store upload, and update the displayed version when appropriate. Real purchase fulfillment and production Google sign-in still need device acceptance with the production certificate.

## Build 5 verification - November 3, 2026

Version 1.0.0, Android build 5, includes the simplified logout confirmation with its three action buttons. Progress and actual failures are shown when needed. The signed APK is `releases/lerona-1.0.0-5-myket.apk` (105781774 bytes), with SHA-256 `7d937043f72b8fb06d3ae99b52fbb9c4b3099acc208ad962aeb257eb1871c231`.

APK verification passed for the permanent signing certificate, version/package, non-debuggable build, all four architectures, Myket bridge and permission, production API URL, private-file exclusion, and all four Vazirmatn font assets. The verification report is beside the APK. Native assembly completed successfully with 119 tasks executed and 857 up-to-date. The 29 logout and release-configuration tests, TypeScript, targeted lint, formatting and diff checks passed.

## Build 4 verification - November 3, 2026

Version 1.0.0, Android build 4, prevents an old failed-backup modal from appearing while a new backup is running. The English and Persian regression tests reproduced that false notice before the fix. The signed APK is `releases/lerona-1.0.0-4-myket.apk` (105,782,086 bytes), with SHA-256 `78b69cd8e5f0d89c1cbe95580f73c95c764b3e73fb4880fdbc7a790117dfc914`.

The APK verification passed for the pinned permanent certificate, package/version, non-debuggable build, four architectures, Myket bridge and billing permission, production API URL, exclusion of private signing files, and exact bytes of all four Vazirmatn fonts. Its machine-readable report is beside the APK. Native assembly completed successfully with 976 actionable tasks.

The verified APK was installed as an in-place update on the connected Samsung Galaxy A73. The signed-in account remained available at sync cursor 25 with zero pending changes. Backup Now confirmed success on the first attempt in build 4. Earlier read-only verification of this account's stored snapshot confirmed successful decryption, two SM-2 decks, and three scheduler states. The backend repair is live as v44 with the existing backup-key disk mounted; the SM-2 SQL migration was already applied by the owner. No migration, restore, sign-out, or app-data clearing was performed during this repair.

The focused backup and release-configuration suites passed 74 tests. TypeScript, targeted ESLint, formatting and diff checks passed. This APK has not been uploaded to Myket.

## Build 3 verification - November 2, 2026

Version 1.0.0, Android version code 3, was rebuilt with the Persian price, Vazirmatn font, and SM-2 sync/backup fixes. The signed APK is `releases/lerona-1.0.0-3-myket.apk` (105,782,078 bytes). SHA-256: `2e0952d779755760f16b332d69c885a44f4c5988dcc7292b65b9c94b6e17b572`.

`pnpm run android:verify` passed: the pinned permanent certificate matches, the APK is non-debuggable, all four architectures are included, the Myket bridge and billing permission are present, the production API URL is bundled, private signing files are excluded, and all four Vazirmatn TTF files match their source bytes. The machine-readable report is beside the APK. The superseded build-2 APK and report were removed after build 3 was verified.

The seven focused release/configuration/font suites passed 47 tests. TypeScript, targeted ESLint, formatting, and diff checks passed. Native assembly succeeded with 976 actionable tasks. This APK has not been uploaded to Myket or installed on a phone by this release operation.

On November 3, a read-only production check confirmed the owner had applied `20261102105010_AddSm2ReviewSystem`. Backend v44 restored the backup-key disk omitted by v43. The connected production-signed build-3 phone then confirmed backup creation; the stored snapshot decrypted and retained two SM-2 decks and three scheduler states. No further database migration was needed. Build 4 also suppresses the stale failure notice while a retry is running; its English and Persian regressions pass.

## Historical build 2 verification

On November 2, 2026, the universal release APK built successfully and was verified with Android SDK `apksigner` and `aapt2`. It is non-debuggable, includes ARM64 / ARMv7 / x86 / x86-64, and its actual signing certificate matches the permanent certificate pinned in source. The Myket native bridge, billing permission and production backend URL are present; private signing files are absent. The APK's SHA-256 is `958985bb5831895ab90f099163cd69dfcdd62395798a29f303a5dcaee47a60fd`. A machine-readable verification report is saved beside the APK as `lerona-1.0.0-2-myket.release.json`.

The three focused release/configuration suites pass eight tests. TypeScript, targeted ESLint and formatting checks pass. Actual Gradle dry runs reject both missing credentials and an isolated wrong-certificate test keystore; the permanent key is accepted through the Windows build runner. The production APK was not installed over the debug-signed test app or uploaded to Myket.

Reference: [Android app signing and key retention](https://developer.android.com/studio/publish/app-signing).

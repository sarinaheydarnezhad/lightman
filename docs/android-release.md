# Signed Android releases

The first production signing configuration is for `com.lerona.app`, version **1.0.0**, Android version code **2**. Earlier version-code-1 APKs used a debug key. Production releases use the permanent `lerona-release` key, with an RSA-4096 certificate valid through October 25, 2056.

## Build the Myket APK

From the project root, with the locked dependencies installed:

```powershell
pnpm install --frozen-lockfile
pnpm run android:apk
```

This runs Android prebuild with the Myket and release-signing plugins, then assembles the universal APK using production environment files. It does not install the app or upload it to a store. The first release is copied to `releases/lerona-1.0.0-2-myket.apk`; Gradle also produces `android/app/build/outputs/apk/release/app-release.apk`.

The signing plugin is reapplied by prebuild. Its Gradle script loads the private key at build time and compares its certificate with the pinned public fingerprint in `android-release-signing.json`. Release builds fail if credentials are missing, invalid or belong to a different key; they cannot silently fall back to a debug key. Debug builds continue to use the debug signing configuration.

## Keep the permanent key and its backup

Private signing files are in `.secrets/android-release/`, outside the generated `android/` directory. This directory is excluded from Git. Keep **both** `signing.json` and `lerona-release.p12`; the JSON contains the generated passwords. Do not put their contents in chat, source control or public environment variables.

A second, hash-verified copy was created at **`C:\a\LeronaReleaseKeys`**, with access restricted to the local user, Administrators and SYSTEM. Copy that folder to secure offline storage. Two copies on the same computer do not protect against disk failure. Future releases must use this same key; never run key generation again for this application.

For a coworker's machine or a build server, transfer the signing folder privately and either restore it to `<project>/.secrets/android-release/` or set `LERONA_ANDROID_SIGNING_FILE` to the **absolute path** of its `signing.json`. Keep the keystore beside that JSON so its relative `storeFile` path resolves. Do not generate a separate key on each machine.

The public certificate is [android-release-certificate.pem](android-release-certificate.pem). Its SHA-1 and SHA-256 fingerprints are in [android-release-signing.json](../android-release-signing.json). These public files can be committed and shared. Register the release SHA-1 with the Android Google OAuth client for `com.lerona.app` if Google sign-in is enabled. The app-signing certificate is separate from the Myket billing RSA public key; no backend payment key change is required.

## Store submission and existing test installations

The signing setup and APK build do not publish the app. Myket still needs to accept and review the uploaded APK. An earlier debug-signed version was present as an unpublished draft when last inspected; its current state and acceptance of the production certificate have not been rechecked. If Myket rejects a different certificate on that draft, resolve the draft's signing registration with Myket before the first publication. Do not change the package name to bypass it.

A debug-signed installation cannot be updated directly with this production-signed APK because Android compares signing certificates. No phone is automatically uninstalled or cleared by the build command. Preserve/sync test data before arranging the one-time switch from the old debug installation. Subsequent production updates use this permanent key and can update in place.

Increase `expo.android.versionCode` in `app.json` for every future store upload, and update the displayed version when appropriate. Real purchase fulfillment and production Google sign-in still need device acceptance with the production certificate.

## First release verification

On November 2, 2026, the universal release APK built successfully and was verified with Android SDK `apksigner` and `aapt2`. It is non-debuggable, includes ARM64 / ARMv7 / x86 / x86-64, and its actual signing certificate matches the permanent certificate pinned in source. The Myket native bridge, billing permission and production backend URL are present; private signing files are absent. The APK's SHA-256 is `958985bb5831895ab90f099163cd69dfcdd62395798a29f303a5dcaee47a60fd`. A machine-readable verification report is saved beside the APK as `lerona-1.0.0-2-myket.release.json`.

The three focused release/configuration suites pass eight tests. TypeScript, targeted ESLint and formatting checks pass. Actual Gradle dry runs reject both missing credentials and an isolated wrong-certificate test keystore; the permanent key is accepted through the Windows build runner. The production APK was not installed over the debug-signed test app or uploaded to Myket.

Reference: [Android app signing and key retention](https://developer.android.com/studio/publish/app-signing).

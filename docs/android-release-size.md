# Android release size

## Findings

The local universal release APK inspected on October 24, 2026 was 115,268,829 bytes
(112,568 KiB rounded up, or 109.93 MiB). Its stored ZIP contents included:

| Content                                     | Size (MiB) |
| ------------------------------------------- | ---------: |
| Native libraries, x86                       |      23.49 |
| Native libraries, x86_64                    |      22.95 |
| Native libraries, arm64-v8a                 |      22.37 |
| Native libraries, armeabi-v7a               |      15.45 |
| DEX bytecode                                |      15.07 |
| Assets, mostly the Hermes JavaScript bundle |       6.25 |

R8 code minification and unused-resource shrinking were disabled in that build.
Both are now enabled through `expo-build-properties` in `app.json`. All four
architectures remain supported; no app features or dependencies were removed.
Native libraries remain uncompressed to avoid extraction overhead on installation.

The `android` directory is generated and ignored by Git. The existing local
`android/gradle.properties` was updated as well. For another checkout or after
changing app configuration, apply the persistent settings before building:

```powershell
npx expo prebuild --platform android --no-install
```

## Choose the distribution artifact

For Google Play, configure a production upload key and build an Android App Bundle:

```powershell
cd android
.\gradlew.bat :app:bundleRelease
```

The bundle is written to `android/app/build/outputs/bundle/release/app-release.aab`
(relative to the repository root). Google Play delivers device-specific APKs;
the whole bundle's file size is not the user's download size. The existing EAS
`production` profile also uses the default Android App Bundle format.

For an APK-only store, the existing Expo release command still builds a universal
APK. If that store and the supported device population allow an ARM-only APK,
build from the repository root with:

```powershell
cd android
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
```

This excludes x86 devices and emulators. The inspected APK contained 46.44 MiB of
x86/x86_64 libraries, so excluding them is the largest identified APK-only saving.
That number is an archive-content measurement, not a measured rebuilt APK size.
Use ABI-split APKs instead if the store supports them and x86 support is required.

Another APK-only option is setting `useLegacyPackaging: true` under the Android
options of `expo-build-properties`, then regenerating the native project. This
compresses native libraries without dropping architectures, but Android must
extract them on installation. It reduces the APK file rather than guaranteeing a
smaller installed app or faster startup. It is intentionally not enabled by default.

## Release verification

Rebuild to measure the final savings; the previous APK is not modified by a config
change. Smoke-test the optimized release on supported devices, including database
access, sign-in, synchronization, reminders, import/export, and Persian/English UI.
Keep the generated R8 mapping file for crash deobfuscation.

The inspected local `android/app/build.gradle` still signs release builds with the
debug keystore. Configure real release signing before publishing; changing build
variant alone does not configure production signing. Never commit signing secrets.

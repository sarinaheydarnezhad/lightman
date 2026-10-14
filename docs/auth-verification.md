# Authentication verification — October 12, 2026

## Mobile (`C:\a\lm`)

The following validation commands were executed against the installed dependencies; no dependency installation was performed.

| Command | Actual result |
| --- | --- |
| `node --version` | `v24.21.0` |
| `npm --version` | Blocked by PowerShell execution policy for `npm.ps1`; subsequent checks used the installed Node entry points directly. |
| `node node_modules/typescript/bin/tsc --noEmit` | Final run exit 0. Initial run failed because the generated router declarations lacked `/auth`; regenerating them resolved it. |
| `node node_modules/jest/bin/jest.js --runInBand src/core/sync/cloud-client.test.ts src/core/sync/phone-auth.test.ts src/features/auth/presentation/auth-screen.test.tsx src/core/sync/sync-engine.test.ts test/architecture.test.ts` | Final run exit 0: 5 suites, 47 tests passed. |
| `node node_modules/jest/bin/jest.js --runInBand src/shared/navigation/navigation.test.tsx --testNamePattern 'authentication route'` | Exit 0: 1 passed, 69 skipped. |
| `node node_modules/jest/bin/jest.js --runInBand` | Final run exit 1: 76 suites passed, 3 failed; 598 tests passed, 6 failed, 604 total. |
| `node node_modules/expo/bin/cli export --platform android --output-dir dist/auth-validation` | Exit 0: Android Hermes bundle, 3,907 modules and 31 assets exported. |
| `git diff --check` | Exit 0; line-ending warnings only. Also executed in the backend repository. |

Selected-file lint command, final exit 0:

```powershell
node node_modules/eslint/bin/eslint.js src/core/sync/cloud-client.ts src/core/sync/phone-auth.ts src/core/sync/sync-engine.ts src/features/auth/presentation/auth-screen.tsx src/features/auth/presentation/auth-screen.test.tsx src/core/sync/cloud-client.test.ts src/core/sync/phone-auth.test.ts src/features/settings/presentation/cloud-sync-screen.tsx src/app/auth/index.tsx src/app/_layout.tsx src/shared/localization/messages.ts
```

Selected-file formatting command, final exit 0 (earlier runs reported formatting/mixed line endings, corrected in touched files):

```powershell
node node_modules/prettier/bin/prettier.cjs --check src/core/sync/cloud-client.ts src/core/sync/cloud-client.test.ts src/core/sync/phone-auth.ts src/core/sync/phone-auth.test.ts src/core/sync/sync-engine.ts src/features/auth/presentation/auth-screen.tsx src/features/auth/presentation/auth-screen.test.tsx src/features/settings/presentation/cloud-sync-screen.tsx src/app/auth/index.tsx src/app/_layout.tsx src/shared/localization/messages.ts
```

Router declaration regeneration, exit 0 after filesystem approval:

```powershell
node -e "process.env.EXPO_ROUTER_APP_ROOT=require('node:path').resolve('src/app'); require('@expo/router-server/build/typed-routes').regenerateDeclarations('.expo/types');"
```

An earlier export to `.validation-auth-export` also succeeded after approval for Expo cache/log writes. Its artifacts were moved into ignored `dist/auth-validation`, then replaced by the final export above. Generated router/build/export artifacts are not source changes.

The six full-suite failures are outside the phone-authentication assertions: navigation language switching, deck form language selection, card form RTL preview, two study-card RTL alignment assertions, and settings language validation. They were not fixed in this task. No clean pre-change baseline was run, so these failures are not asserted to be pre-existing. Full-suite output also includes React `act(...)` warnings. The authentication route and focused authentication tests pass.

## Native Android (`C:\a\lm\android`)

`.\gradlew.bat :app:assembleDebug --offline` completed with exit 0, `BUILD SUCCESSFUL in 26m 8s`, 568 actionable tasks. The debug APK exists at `android/app/build/outputs/apk/debug/app-debug.apk` (271,855,465 bytes). Gradle/Kotlin/C++ deprecation warnings remain. The build required approval to use installed caches. The APK was not installed or exercised on a device/emulator. iOS builds were not run on Windows.

## Backend (`C:\a\LeronaBackend\Backend`)

`dotnet --list-sdks` reports only `8.0.100`. Inspection of the project files confirms target framework `net10.0`. Backend `dotnet build`, `dotnet test`, EF migration generation/application and SQL Server integration checks were **not run** because the required SDK is absent; no backend compile/test success is claimed. New `PhoneAuthTests.cs` covers phone registration/login, OTP expiry/attempt/request limits, duplicate phones, nonunique usernames, proof binding, session rotation/reuse and logout, but remains unexecuted. The new migration/designer/snapshot were authored from the existing model patterns, not generated or validated by a compatible EF tool.

## Deployment checks still required

- Install .NET 10 SDK and run the backend solution tests/build, including persistence model/migration checks.
- Apply `AddPhoneAuthentication` to the configured SQL Server database; verify concurrency and uniqueness against SQL Server, not just the SQLite test fixture.
- Configure the HTTPS SMS gateway and test actual SMS delivery. Test-only senders do not constitute real SMS verification.
- Configure the native HTTPS API origin and exercise registration, both login modes, expiry, refresh and online/offline logout against the deployed backend on a device. Contract/unit/UI tests and build artifacts do not establish live integration.

# Settings account verification

October 16, 2026. Working directory: `C:\a\lm`. All source edits use apply_patch. No backend files, secrets, configuration, dependencies or server learning data were changed.

## Final focused regression run

Executed:

```powershell
node node_modules/jest/bin/jest.js --runInBand src/core/access/learning-access.test.ts src/core/composition/learning-access.test.ts src/shared/access/learning-access-notice.test.tsx src/core/sync/subscription.test.ts src/core/sync/cloud-client.test.ts src/core/sync/sync-engine.test.ts src/core/sync/guest-transfer.test.ts src/core/sync/secure-logout.test.ts src/core/storage/guest-free-tier.test.ts src/core/composition/application-scopes.test.ts src/core/composition/sync-session.test.ts src/features/transfer/application/transfer-service.test.ts src/features/transfer/data/adapters.test.ts src/features/study/application/study-queue.test.ts src/features/study/application/study-session-flow.test.ts src/features/study/application/scheduler-selection.test.ts src/features/study/data/scheduler-persistence.test.ts src/core/application/create-application.test.ts src/core/sync/server-backup.test.ts src/core/sync/logout-journal.test.ts src/features/settings/presentation/settings-account-card.test.tsx src/features/settings/presentation/logout-screen.test.tsx src/features/auth/presentation/guest-data-screen.test.tsx src/shared/bootstrap/data-scope-boundary.test.tsx test/architecture.test.ts src/features/settings/presentation/subscription-screen.test.tsx src/features/settings/presentation/settings-screen.test.tsx 2>&1 | Select-Object -Last 15; exit $LASTEXITCODE
```

Exit 0: **27 suites / 339 tests passed**, 54.839 seconds.

Covers guest labels/limits/login navigation, masked phones and actual profile data, active/expired/free/restricted/provisional/unavailable subscription states, localized start/expiration dates, subscription invalidation, independent profile/subscription/backup failures and retries, owned backup metadata/retention, verified manual backup/duplicate prevention, secure logout, late response/account-switch isolation, existing Paywall and local/sync access guards.

## Full mobile suite

Executed:

```powershell
node node_modules/jest/bin/jest.js --runInBand 2>&1 | Select-String -Pattern '^FAIL|^  ●|^Test Suites:|^Tests:|^Time:|^Ran all'; exit $LASTEXITCODE
```

Exit 1: **92 suites passed / 3 failed; 833 tests passed / 6 failed**, 839 total, 120.293 seconds.

The same six failures documented before this task remain:

- `src/shared/navigation/navigation.test.tsx`: app-language/RTL navigation, deck form errors and card form errors (3). Only the separate Settings login-button assertion was updated for the requested new label.
- `src/features/study/presentation/study-card.test.tsx`: RTL typography/alignment and answer face (2).
- `src/features/settings/application/create-settings-use-cases.test.ts`: language/reminder update (1).

These failures were not fixed, suppressed or reported as passing.

## TypeScript, scoped lint and formatting

Executed:

```powershell
node node_modules/typescript/bin/tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; node node_modules/eslint/bin/eslint.js src/features/settings/presentation/settings-account-card.tsx src/features/settings/presentation/settings-subscription-card.tsx src/features/settings/presentation/settings-backup-card.tsx src/features/settings/presentation/settings-account-card.test.tsx src/features/settings/presentation/settings-screen.test.tsx src/core/sync/sync-engine.ts src/core/sync/subscription.test.ts src/shared/navigation/navigation.test.tsx src/shared/localization/messages.ts; exit $LASTEXITCODE
node node_modules/prettier/bin/prettier.cjs --check src/features/settings/presentation/settings-account-card.tsx src/features/settings/presentation/settings-subscription-card.tsx src/features/settings/presentation/settings-backup-card.tsx src/features/settings/presentation/settings-account-card.test.tsx src/features/settings/presentation/settings-screen.test.tsx src/core/sync/sync-engine.ts src/core/sync/subscription.test.ts src/shared/navigation/navigation.test.tsx src/shared/localization/messages.ts; exit $LASTEXITCODE
git diff --check 2>$null; exit $LASTEXITCODE
```

All exit 0. Formatting uses in-memory Prettier followed by apply_patch, not a formatter writing arbitrary files. The new documentation is separately formatted and checked after creation.

## Android JavaScript export

Executed:

```powershell
node node_modules/expo/bin/cli export --platform android --output-dir .tools/settings-account-export 2>&1 | Select-Object -Last 12; exit $LASTEXITCODE
```

Exit 0. Produced one 8.1 MB Hermes bundle, `entry-f873d062c0eb8610e26214839d9896de.hbc`. This is **not** an APK/EAS/Gradle/iOS build or physical-device verification.

## Additional executed checks

- Standalone `node node_modules/typescript/bin/tsc --noEmit; exit $LASTEXITCODE` passed during implementation.
- Initial five-suite run (Settings account, Settings controls, subscription contracts, SyncEngine, secure logout; `--runInBand`, `Select-Object -Last 80`) passed: 88 tests, 105.4 seconds, before the additional cases were added.
- The updated five-suite run (`Select-Object -Last 50`) passed: 99 tests, 10.995 seconds.
- A diagnostic single-name run, `node node_modules/jest/bin/jest.js --runInBand src/features/settings/presentation/settings-account-card.test.tsx --testNamePattern='authenticated account shows' --forceExit 2>&1 | Select-Object -Last 35; exit $LASTEXITCODE`, passed 1 test and skipped 40. This was not used as the final result: the final focused/full runs use no forced exit.

## Unverified and unavailable capabilities

No backend build/test rerun was needed for source changes confined to mobile code. No live SQL Server/API deployment, native-device UI, SMS delivery, session revocation over a real network or production backup creation was verified. API contracts were inspected in the actual backend and exercised by the existing client/unit/integration fixtures.

Runtime cloud access still requires a native build with a configured HTTPS API URL and valid authentication. Backup creation still requires the backend's valid retention/size/count settings and persisted Data Protection key-ring configuration; failures are displayed rather than fabricated success. Restore, scheduled backup cleanup and real subscription payments remain unavailable. No additional backend endpoint or configuration was introduced.

See `settings-account.md` for the exact changed-file manifest, connected endpoints, state behavior and remaining configuration dependencies.

# Plus Paywall verification

Date: October 15, 2026. Working directory: `C:\a\lm`. No backend files, dependencies, migrations, configuration or secrets changed.

## Final focused regression checks

Executed:

```powershell
node node_modules/jest/bin/jest.js --runInBand src/core/access/learning-access.test.ts src/core/composition/learning-access.test.ts src/shared/access/learning-access-notice.test.tsx src/core/sync/subscription.test.ts src/core/sync/cloud-client.test.ts src/core/sync/sync-engine.test.ts src/core/sync/guest-transfer.test.ts src/core/sync/secure-logout.test.ts src/core/storage/guest-free-tier.test.ts src/core/composition/application-scopes.test.ts src/core/composition/sync-session.test.ts src/features/transfer/application/transfer-service.test.ts src/features/transfer/data/adapters.test.ts src/features/study/application/study-queue.test.ts src/features/study/application/study-session-flow.test.ts src/features/study/application/scheduler-selection.test.ts src/features/study/data/scheduler-persistence.test.ts src/core/application/create-application.test.ts src/core/sync/server-backup.test.ts src/core/sync/logout-journal.test.ts src/features/settings/presentation/settings-account-card.test.tsx src/features/settings/presentation/logout-screen.test.tsx src/features/auth/presentation/guest-data-screen.test.tsx src/shared/bootstrap/data-scope-boundary.test.tsx test/architecture.test.ts src/features/settings/presentation/subscription-screen.test.tsx src/features/settings/presentation/settings-screen.test.tsx 2>&1 | Select-Object -Last 12; exit $LASTEXITCODE
```

Exit 0: **27 suites / 326 tests passed**, 29.567 seconds. Includes plan selection/pricing, unavailable purchases, Full prevention, active/expired status, deck/card/study entry reasons, Settings in both languages, offline provisional/unknown access, network/authentication failures, retries, stale scope responses, existing sync/auth/migration/backup/isolation and access guards.

## Full mobile suite

Executed:

```powershell
node node_modules/jest/bin/jest.js --runInBand 2>&1 | Select-String -Pattern '^FAIL|^  ●|^Test Suites:|^Tests:|^Time:|^Ran all'; exit $LASTEXITCODE
```

Final exit 1: **92 suites passed / 3 failed; 820 tests passed / 6 failed**, 826 total, 75.494 seconds. The six failures match the previous access-limits verification baseline:

- `src/shared/navigation/navigation.test.tsx`: app-language/RTL navigation, deck form errors and card form errors (3).
- `src/features/study/presentation/study-card.test.tsx`: RTL alignment/typography and answer face (2).
- `src/features/settings/application/create-settings-use-cases.test.ts`: language/reminder replacement (1).

Those unrelated failures were not modified, suppressed or claimed successful.

## TypeScript and scoped lint

Executed:

```powershell
node node_modules/typescript/bin/tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; node node_modules/eslint/bin/eslint.js src/features/settings/presentation/subscription-screen.tsx src/features/settings/presentation/subscription-screen.test.tsx src/features/settings/presentation/settings-account-card.tsx src/features/settings/presentation/settings-account-card.test.tsx src/shared/access/learning-access-notice.tsx src/shared/access/learning-access-notice.test.tsx src/core/access/learning-access.ts src/shared/localization/messages.ts src/features/settings/presentation/settings-screen.test.tsx; exit $LASTEXITCODE
```

Exit 0: TypeScript and scoped ESLint passed. Standalone `node node_modules/typescript/bin/tsc --noEmit; exit $LASTEXITCODE` also passed during implementation.

## Formatting and patch checks

Executed (source/docs check):

```powershell
node node_modules/prettier/bin/prettier.cjs --check src/features/settings/presentation/subscription-screen.tsx src/features/settings/presentation/subscription-screen.test.tsx src/features/settings/presentation/settings-account-card.tsx src/features/settings/presentation/settings-account-card.test.tsx src/shared/access/learning-access-notice.tsx src/shared/access/learning-access-notice.test.tsx src/core/access/learning-access.ts src/shared/localization/messages.ts src/features/settings/presentation/settings-screen.test.tsx docs/subscriptions.md docs/access-limits.md docs/plus-paywall.md; exit $LASTEXITCODE
git diff --check; exit $LASTEXITCODE
```

Both exit 0. Git reports existing LF/CRLF normalization notices, not whitespace failures. The verification document receives a separate formatting check after creation.

## Android JavaScript export

Executed:

```powershell
node node_modules/expo/bin/cli export --platform android --output-dir .tools/plus-paywall-export 2>&1 | Select-Object -Last 12; exit $LASTEXITCODE
```

Exit 0. Exported one 8.1 MB Hermes bundle: `entry-44edb66f08b1e749ee2d73fd16c479c2.hbc`. This verifies JavaScript export, **not** an APK, EAS/Gradle/iOS build, physical-device layout or live API connectivity.

## Earlier iterations and actual failures

- Initial five-suite focused command (screen, notice, Settings account, subscription contracts and access controller; `--runInBand`, `Select-Object -Last 95`) exited 1: 85 passed / 3 failed. The new copy/guest-label assertions were corrected. Its next run (`Select-Object -Last 25`) exited 0: 5 suites / 94 tests passed.
- The expanded 26-suite regression command (`Select-Object -Last 14`) exited 0: 324 tests passed.
- Initial full suite exited 1: 818 passed / 8 failed. Two additional failures were the existing Settings controls test counting the newly added guest View plans button as a chevron row. A focused reproduction (`node node_modules/jest/bin/jest.js --runInBand src/features/settings/presentation/settings-screen.test.tsx 2>&1 | Select-Object -Last 80; exit $LASTEXITCODE`) exited 1 with those same 2 failures. The fixture now explicitly checks the new account action and excludes both account buttons from chevron-row assertions. Final focused/full results are recorded above.
- Initial scoped formatting check exited 1 for the new screen test's mixed line endings; formatting through in-memory Prettier and apply_patch corrected it. Subsequent source/docs checks passed.

## Not verified or implemented

No provider is selected or configured in the actual server catalog; it explicitly returns disabled purchase flags. There is no checkout, payment request, server transaction verification or activation operation. Real pending/cancelled/failed/successful payments and post-purchase refresh therefore cannot be tested; the tests verify unavailable purchase behavior instead. A future provider must add trusted server verification, idempotency and fresh server-side active-subscription checks before purchase.

No backend build/tests were rerun for this mobile-only task, and no live SQL Server/API/provider or native-device testing was performed. Existing backend authority, free limits, session revocation, sync ownership/versioning, data preservation and account-scope boundaries are reused.

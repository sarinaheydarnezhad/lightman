# Guest migration verification record

Checks performed October 13–14, 2026. Commands below ran from `C:\a\lm` unless a different working directory is stated. Exit codes are actual outcomes, not assumptions about a deployed service. The [implementation notes](guest-data-migration.md) contain the changed-file manifest and supported transfer behavior.

## Final focused checks

### Mobile tests

```powershell
node node_modules/jest/bin/jest.js --runInBand src/core/sync/guest-transfer.test.ts src/features/auth/presentation/guest-data-screen.test.tsx src/core/sync/cloud-client.test.ts src/core/sync/sync-engine.test.ts src/core/database/database.test.ts src/core/storage/guest-free-tier.test.ts src/features/settings/presentation/settings-account-card.test.tsx src/features/study/data/scheduler-persistence.test.ts test/architecture.test.ts 2>&1 | Select-Object -Last 85; exit $LASTEXITCODE
```

Final result: **exit 0; 9 suites and 93 tests passed**. These checks cover the final inventory/review-state verification guard, guest-only copying, account-only preservation, both/empty previews, same-name separation, cancellation, exact retries after database reopening, duplicate prevention, review-state preservation, ownership checks, quota boundaries, disk rollback, incomplete synchronization, unsupported progress and UI failure/resume states.

Transfer tests use real SQLite through the existing `sql.js` test adapter and the production SyncStore/SyncEngine, with mocked HTTP responses. They do **not** exercise a running ASP.NET Core server or SQL Server. UI tests use React Native test rendering, not a phone or emulator.

### TypeScript

```powershell
node node_modules/typescript/bin/tsc --noEmit 2>&1 | Select-Object -Last 30; exit $LASTEXITCODE
```

Final result: **exit 0**.

### Scoped lint

```powershell
node node_modules/eslint/bin/eslint.js src/core/sync/guest-transfer.ts src/core/sync/guest-transfer-snapshot.ts src/core/sync/guest-transfer.test.ts src/core/sync/cloud-client.ts src/core/sync/cloud-client.test.ts src/core/sync/sync-engine.ts src/core/sync/sync-engine.test.ts src/core/composition/guest-transfer.ts src/core/composition/sync.ts src/core/storage/local-storage-scopes.ts src/core/storage/guest-free-tier.test.ts src/features/auth/presentation/guest-data-screen.tsx src/features/auth/presentation/guest-data-screen.test.tsx src/features/settings/presentation/settings-account-card.tsx src/shared/localization/messages.ts src/app/_layout.tsx src/app/auth/guest-data.tsx src/core/database/migrations.ts src/core/database/database.test.ts src/features/study/data/scheduler-persistence.test.ts 2>&1 | Select-Object -Last 35; exit $LASTEXITCODE
```

Final result: **exit 0**.

### Formatting

```powershell
node node_modules/prettier/bin/prettier.cjs --check src/core/sync/guest-transfer.ts src/core/sync/guest-transfer-snapshot.ts src/core/sync/guest-transfer.test.ts src/features/auth/presentation/guest-data-screen.tsx src/features/auth/presentation/guest-data-screen.test.tsx src/app/auth/guest-data.tsx src/core/composition/guest-transfer.ts src/core/composition/sync.ts src/core/sync/sync-engine.ts src/core/sync/sync-engine.test.ts src/core/sync/cloud-client.ts src/core/sync/cloud-client.test.ts src/core/storage/local-storage-scopes.ts src/core/storage/guest-free-tier.test.ts src/features/settings/presentation/settings-account-card.tsx src/app/_layout.tsx src/shared/localization/messages.ts src/core/database/migrations.ts src/core/database/database.test.ts src/features/study/data/scheduler-persistence.test.ts README.md docs/guest-mode.md docs/phone-authentication.md docs/SYNC.md docs/guest-data-migration.md 2>&1 | Select-Object -Last 22; exit $LASTEXITCODE
```

Final result: **exit 0; all matched files use Prettier formatting**. Earlier formatting, TypeScript and scoped-lint failures introduced while developing this task were corrected before these final checks. Files were edited through patches, not formatter write commands.

The verification record and mobile patch were also checked:

```powershell
node node_modules/prettier/bin/prettier.cjs --check docs/guest-migration-verification.md 2>&1 | Select-Object -Last 12; exit $LASTEXITCODE
git diff --check
```

Both returned **exit 0**; Git reported only line-ending conversion warnings.

### Android JavaScript/Hermes export

```powershell
node node_modules/expo/bin/cli export --platform android --output-dir .tools/guest-migration-export 2>&1 | Select-Object -Last 32; exit $LASTEXITCODE
```

The sandboxed invocation failed with **exit 7**, `EPERM` opening `.expo/dev/logs/export.log`. The same command was rerun with approved escalation. Final approved result: **exit 0**, 3,916 modules bundled, 31 assets, one approximately 8 MB Hermes bundle, exported to the ignored `.tools/guest-migration-export` directory.

This verifies an Android bundle export only. Native APK compilation, iOS compilation, device navigation, secure-device storage and live network integration were **not verified**.

## Broader mobile checks

Executed October 13 before the final additional review-state/feed-gap guard:

```powershell
node node_modules/jest/bin/jest.js --runInBand 2>&1 | Select-Object -Last 180; exit $LASTEXITCODE
node node_modules/jest/bin/jest.js --runInBand 2>&1 | Select-String -Pattern '^(PASS|FAIL)|^  ●|^Test Suites:|^Tests:|^Snapshots:|^Time:|^Ran all'; exit $LASTEXITCODE
```

The first run returned **exit 1: 81/85 suites passed, 660/667 tests passed**. Two scheduler-persistence assertions still expected local schema version 5; those were updated to version 6 without changing the review-history assertions. The second run returned **exit 1: 82/85 suites passed, 661/667 tests passed**. The six remaining failures match the existing unrelated baseline:

- Two `study-card.test.tsx` RTL alignment cases.
- Three `navigation.test.tsx` cases concerning RTL/app language, the missing “Other” language choice and RTL card preview.
- One `create-settings-use-cases.test.ts` Arabic UI-language/reminder validation case.

Those failures were not changed as part of migration. The complete suite was not rerun after the last safety guard; the final focused 93-test run covers that code.

```powershell
node node_modules/eslint/bin/eslint.js . 2>&1 | Select-Object -Last 50; exit $LASTEXITCODE
```

Result: **exit 1**, with the existing `react/no-children-prop` error at `src/shared/ui/text.tsx:134` and an unused `Sm2Scheduler` warning at `src/features/study/domain/review-engine.test.ts:6`. These unrelated findings remain untouched; scoped lint passed.

Earlier transfer-test iterations also exposed an undefined native crypto mock. The fixture now uses `jest.requireActual('node:crypto').randomUUID`; the final retry tests exercise distinct persisted UUIDs rather than an undefined mock value.

## Backend availability and unverified checks

Working directory: `C:\a\LeronaBackend\Backend`.

```powershell
dotnet --list-sdks
rg -n '<TargetFramework>' backend -g '*.csproj'
git diff --check
```

SDK inspection returned only **8.0.100**; all five backend projects target **net10.0**. `git diff --check` passed with line-ending conversion warnings only.

Backend tests and build were **not executed**, because the installed SDK cannot build the target framework. The new backend historical-copy/retry/progress/ownership and same-name/quota tests are authored but unverified. SQL Server transactions, actual HTTP response serialization, EF migration application and mobile-to-server integration were not verified here.

With .NET 10 installed and the existing test/database prerequisites configured, the next commands are:

```powershell
dotnet test backend/Flashcards.Tests/Flashcards.Tests.csproj --filter FullyQualifiedName~SyncTests
dotnet build backend/Flashcards.Api/Flashcards.Api.csproj
```

These are recommendations, **not commands executed in this task**.

## Safety and remaining dependencies

- Deploy the additive owned review-state response fields before attempting verified mobile copying.
- Existing authoritative limits remain one active deck and 50 active cards. Both-data previews can keep datasets separate, but cannot add a second deck without trusted entitlement support.
- Whole-transfer server atomicity is unavailable: existing individual sync operations are transactional. Partial copies retain stable retry receipts and local journals; original guest data is never removed.
- Active Leitner cards require complete, reproducible history. Archived data, study sessions, other schedulers and arbitrary progress snapshots are not copied.
- Legacy server inventory/progress missing from the sync feed requires an authoritative backend backfill; copying blocks rather than inventing cursors or declaring an empty account.
- Only one frozen snapshot per guest device/account is supported. Later guest edits, destructive merging/replacement and incremental linking require separate consent/conflict design.

There are no live SMS-delivery, subscription, destructive merge, device or end-to-end migration success claims in these results.

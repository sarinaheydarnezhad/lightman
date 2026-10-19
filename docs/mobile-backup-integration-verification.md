# Mobile backup integration verification

Executed October 15, 2026, from `C:\a\lm`. This task integrates the existing Task 5 backend, without modifying backend implementation, applying database migrations, changing configuration, deploying, or creating a second backup/sync mechanism. The exact changed-file manifest and behavior are in `docs/server-backups.md`.

## Connected API

- `GET /api/v1/backups/status`: existing `latestCompleted` metadata (non-expired completed backups only).
- `GET /api/v1/backups/?page=1&limit=1`: latest owned record, including Failed or expired status; an empty page means no stored records.
- `POST /api/v1/backups/`: `{ requestId, formatVersion: 1, expectedSyncVersion }`, with owner derived only from the existing JWT on the server.
- `GET /api/v1/backups/{id}`: verify the created owned artifact before claiming success.

No backup payload download or restore is attempted. Creation uses existing synchronization and verification before and after the backup. A pending request UUID survives an interrupted response/restart; after successful POST/GET verification it is cleared so a later explicit operation requests a fresh artifact.

## Focused tests

```powershell
node node_modules/jest/bin/jest.js --runInBand src/core/sync/server-backup.test.ts src/core/sync/secure-logout.test.ts src/core/sync/cloud-client.test.ts src/core/sync/sync-engine.test.ts src/core/sync/guest-transfer.test.ts src/core/sync/logout-journal.test.ts src/features/settings/presentation/settings-account-card.test.tsx src/features/auth/presentation/guest-data-screen.test.tsx src/features/settings/presentation/logout-screen.test.tsx src/core/composition/application-scopes.test.ts src/core/composition/sync-session.test.ts src/core/storage/guest-free-tier.test.ts src/shared/bootstrap/data-scope-boundary.test.tsx test/architecture.test.ts 2>&1 | Select-Object -Last 24; exit $LASTEXITCODE
```

Final result: **exit 0; 14 suites, 172 tests passed**, 20.595 seconds. Earlier versions of this focused selection also passed (168, then 171 tests); the final run includes the final status-refresh correction and new regression test. The first narrower run selected server-backup, secure-logout, settings-account-card, guest-data-screen and logout-screen tests, with `Select-Object -Last 100`: **5 suites, 84 tests passed**.

Coverage includes Settings status/empty/Pending/Failed/expired display; localized local timestamps and retention; manual completion only after verification; duplicate submissions; server/network/auth/rate/capacity/size/configuration errors; status refresh after uncertain creation; retained metadata after a post-success refresh failure; logout without backup; backup failure without logout; interrupted request retries and fresh explicit requests; guest/account separation and two-account switching; stale responses after logout; expired sessions; optional backup failure before any guest staging/copy; cancellation and successful explicit retry; unchanged quota/conflict/journal/guest transfer behavior.

The guest transfer implementation is additive-only. There is no supported replace/overwrite/destructive-merge operation, so no test claims that such an operation was implemented. Optional pre-copy backup failures block all transfer calls; the normal explicit additive-copy choice does not require backup. Existing blockers and preview validation remain authoritative even after backup success.

Tests exercise real SQLite isolation for the sync/logout/transfer fixtures. HTTP, SecureStore/native modules and the server backup repository are mocked. These are not live ASP.NET/SQL Server or physical-device integration tests, and test response objects are not production mock success paths.

## Types, lint and formatting

```powershell
node node_modules/typescript/bin/tsc --noEmit; exit $LASTEXITCODE
node node_modules/eslint/bin/eslint.js src/core/sync/cloud-client.ts src/core/sync/cloud-client.test.ts src/core/sync/server-backup.ts src/core/sync/server-backup.test.ts src/core/sync/sync-engine.ts src/core/sync/secure-logout.test.ts src/features/settings/presentation/settings-account-card.tsx src/features/settings/presentation/settings-backup-card.tsx src/features/settings/presentation/settings-account-card.test.tsx src/features/auth/presentation/guest-data-screen.tsx src/features/auth/presentation/guest-data-screen.test.tsx src/shared/localization/messages.ts; exit $LASTEXITCODE
node node_modules/prettier/bin/prettier.cjs --check src/core/sync/cloud-client.ts src/core/sync/cloud-client.test.ts src/core/sync/server-backup.ts src/core/sync/server-backup.test.ts src/core/sync/sync-engine.ts src/core/sync/secure-logout.test.ts src/features/settings/presentation/settings-account-card.tsx src/features/settings/presentation/settings-backup-card.tsx src/features/settings/presentation/settings-account-card.test.tsx src/features/auth/presentation/guest-data-screen.tsx src/features/auth/presentation/guest-data-screen.test.tsx src/shared/localization/messages.ts docs/server-backups.md docs/mobile-backup-integration-verification.md; exit $LASTEXITCODE
git diff --check; exit $LASTEXITCODE
```

Final commands exit **0**; TypeScript and scoped ESLint report no diagnostics, formatting matches Prettier, and diff checks have no whitespace errors. An earlier scoped lint pass reported an unnecessary refresh-version dependency; it was replaced with a stable explicit refresh callback and rerun cleanly. Formatting changes were applied through patches.

## Full mobile suite

```powershell
node node_modules/jest/bin/jest.js --runInBand 2>&1 | Select-String -Pattern '^(PASS|FAIL)|^  ●|^Test Suites:|^Tests:|^Snapshots:|^Time:|^Ran all'; exit $LASTEXITCODE
```

Observed **exit 1; 87 suites passed, 3 failed; 747 tests passed, 6 failed, 753 total**, 86.463 seconds. The failures match the prior documented language/RTL failures in `src/shared/navigation/navigation.test.tsx` (3), `src/features/study/presentation/study-card.test.tsx` (2) and `src/features/settings/application/create-settings-use-cases.test.ts` (1). Those files were not changed. This full run precedes the final explicit-status-refresh state correction and its one new UI test; the final focused run, typecheck, lint and export were rerun afterward. No full-suite success is claimed.

## Android JavaScript export

```powershell
node node_modules/expo/bin/cli export --platform android --output-dir .tools/mobile-backup-integration-export 2>&1 | Select-Object -Last 12; exit $LASTEXITCODE
```

Final result: **exit 0**, one 8.1 MB Hermes bundle `entry-57344845df99f429949d3eb40d670799.hbc`, assets and metadata. An earlier export also passed before the final status-refresh correction. This is not a native APK/Gradle build, iOS compilation or real-device verification.

## Remaining dependencies

The backend must be deployed with its existing `AddUserBackups` migration, existing SQL/JWT settings and protected durable `Backups__KeyRingPath`. The native mobile build needs its existing phone-accessible HTTPS `EXPO_PUBLIC_API_URL`. No values or secrets were changed by this task. Backup creation fails closed when the backend/configuration is unavailable; status failure is shown as unconfirmed, not Never backed up.

Restore and destructive migration are not supported by the existing architecture. Automatic physical cleanup is not scheduled; expired/failed artifacts can exhaust the configured per-user capacity until operators perform artifact-only cleanup. Expired backups are not advertised as restorable. Pending is normally a local in-flight UI state because server creation is synchronous/transactional, not a background-job API. Settings reads are independently authenticated metadata requests, not an atomic combined status endpoint; no account metadata is persisted into guest storage. Historical last-success timestamps can only be shown when returned by latest-completed metadata or the latest expired completed record; the card is not a full backup-history browser.

Live backend/SQL Server behavior, durable-key recovery, actual phone connectivity, native secure storage and physical-device logout/migration remain unverified here. Backend tests/builds were not rerun in this mobile-only task; previous backend verification remains in `LeronaBackend/Backend/BACKUP-VERIFICATION.md`.

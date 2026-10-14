# Guest-mode verification - October 12, 2026

## Mobile (`C:\a\lm`)

Checks use already installed dependencies, including `sql.js`; no package installation or lockfile change was performed for this task.

The final focused command was executed with PowerShell output limiting:

```powershell
node node_modules/jest/bin/jest.js --runInBand --silent src/core/storage/guest-free-tier.test.ts src/core/composition/application-scopes.test.ts src/core/sync/cloud-client.test.ts src/core/sync/sync-engine.test.ts src/shared/bootstrap/data-scope-boundary.test.tsx src/features/decks/presentation/deck-form.test.tsx src/features/decks/presentation/card-form.vocabulary.test.tsx src/features/auth/presentation/auth-screen.test.tsx test/architecture.test.ts 2>&1 | Select-Object -Last 60; exit $LASTEXITCODE
```

Result: exit 0, **9 suites and 64 tests passed**. Earlier focused iterations exposed an invalid study fixture, scope-proxy/mock restoration behavior and a synchronous stale-command assertion; these were corrected before this final run. An earlier focused command without `application-scopes.test.ts` also passed 8 suites/63 tests.

Coverage includes exact 1-deck/50-card boundaries, rejected second deck/51st card, editing, real offline review persistence, SQLite byte export/reopen simulating an app restart, guest/account-A/account-B storage isolation, legacy ownership, failed scope opens, stale application results, screen unmounting, total counts including archived parents, concurrent deck creation, rollback on injected persistence failure, oversized data preservation, guest sync suppression, account activation/logout and localized form errors. The SQLite restart test is not a physical-device restart test.

The final full-suite command was:

```powershell
node node_modules/jest/bin/jest.js --runInBand --silent 2>&1 | Select-Object -Last 110; exit $LASTEXITCODE
```

Result: exit 1, **79 suites passed / 3 failed; 616 tests passed / 6 failed / 622 total**. These are the same six failures recorded before Task 2:

- `src/shared/navigation/navigation.test.tsx`: RTL ancestor alignment, missing "Other" deck-language choice, RTL card preview (3).
- `src/features/study/presentation/study-card.test.tsx`: RTL study-card alignment (2).
- `src/features/settings/application/create-settings-use-cases.test.ts`: Arabic language validation vs expected notification error (1).

The navigation-only command `node node_modules/jest/bin/jest.js --runInBand --silent src/shared/navigation/navigation.test.tsx` finally returned exit 1 with 67 passed/3 failed. Earlier full/navigation runs had additional scope-proxy mock regressions; those were corrected, not counted as passing checks. No unrelated baseline failures were repaired.

Other executed commands:

```powershell
node node_modules/typescript/bin/tsc --noEmit
```

Final result: exit 0. Initial development errors were corrected and rechecked.

```powershell
node node_modules/eslint/bin/eslint.js src/core/storage src/core/database/free-tier-guards.ts src/core/database/database-error.ts src/core/errors/app-error.ts src/core/composition src/core/bootstrap/initialize-application.ts src/core/sync/cloud-client.ts src/core/sync/cloud-client.test.ts src/core/sync/sync-store.ts src/core/sync/sync-engine.ts src/core/sync/sync-engine.test.ts src/shared/bootstrap/data-scope-boundary.tsx src/shared/bootstrap/data-scope-boundary.test.tsx test/real-sqlite.ts src/app/_layout.tsx src/features/decks/presentation/deck-form.tsx src/features/decks/presentation/deck-form.test.tsx src/features/decks/presentation/card-form.tsx src/features/decks/presentation/card-form.vocabulary.test.tsx src/features/settings/presentation/cloud-sync-screen.tsx src/shared/localization/messages.ts
```

Final result: exit 0, no warnings.

```powershell
node node_modules/prettier/bin/prettier.cjs --check src/core/storage/local-storage-scopes.ts src/core/storage/guest-free-tier.test.ts src/core/database/free-tier-guards.ts src/core/database/database-error.ts src/core/errors/app-error.ts src/core/composition/repositories.ts src/core/composition/application.ts src/core/composition/sync.ts src/core/composition/transfer.ts src/core/bootstrap/initialize-application.ts src/core/sync/cloud-client.ts src/core/sync/cloud-client.test.ts src/core/sync/sync-store.ts src/core/sync/sync-engine.ts src/core/sync/sync-engine.test.ts src/shared/bootstrap/data-scope-boundary.tsx src/shared/bootstrap/data-scope-boundary.test.tsx test/real-sqlite.ts src/app/_layout.tsx src/features/decks/presentation/deck-form.tsx src/features/decks/presentation/deck-form.test.tsx src/features/decks/presentation/card-form.tsx src/features/decks/presentation/card-form.vocabulary.test.tsx src/features/settings/presentation/cloud-sync-screen.tsx src/shared/localization/messages.ts src/core/composition/application-scopes.test.ts
```

Final result: exit 0; all 26 matched files use Prettier style. This is a focused source check, not a claim that every preexisting repository file is formatted.

```powershell
node node_modules/expo/bin/cli export --platform android --output-dir dist/guest-validation
```

Both exports returned exit 0 with 3,910 modules, 31 assets and a 7.9 MB Hermes bundle, including the repeat after the final runtime edits. The final bundle was `entry-9cb5578ab5e63f22df96ab8576a1233f.hbc`. Metro emitted environment-color warnings. Exports are ignored build artifacts, not device execution.

From `C:\a\lm\android`:

```powershell
.\gradlew.bat :app:assembleDebug --offline
```

Result: exit 0, `BUILD SUCCESSFUL in 44s`, 568 actionable tasks (64 executed, 504 up-to-date). Gradle emitted deprecation warnings. This cached native debug build does not prove offline device behavior, and no device installation was performed. The separate export checks the JavaScript bundle.

`git diff --check` was executed in both repositories and passed (line-ending warnings only). No iOS build, device/emulator guest-mode exercise, SMS delivery, subscription entitlement integration or live backend/SQL Server test was performed.

## Backend (`C:\a\LeronaBackend\Backend`)

```powershell
dotnet --list-sdks
rg 'TargetFramework' backend -g '*.csproj'
```

Installed SDK: **8.0.100**; API, infrastructure and tests target **net10.0**. No backend build, `dotnet test` or migration-application command was executed for this task because a compatible SDK is absent. The new quota/rollback tests are therefore **unverified**, not passing.

`backend/Flashcards.Tests/SyncTests.cs` adds REST/sync deck-limit and owner-isolation coverage, the 50/51 card boundary, allowed editing/reviews, oversized-data preservation and whole-batch rollback including versions/feed. Existing deck persistence-failure and conflict tests were adjusted to avoid an unrelated second-deck quota rejection masking their intended failure. Static inspection also corrected quota fixtures to meet the existing nonempty card-meaning and 50-changes-per-push validation rules; this is not test execution. Live SQL Server concurrent quota enforcement remains unverified.

There is no trusted subscription authority in the current backend. All accounts are limited to the free tier until server-verified entitlements and a safe offline entitlement policy are implemented. No Task 2 entities or migrations were added. Existing phone-auth changes/migrations belong to the previous task and remain intact.

# Secure logout verification

Executed on October 14, 2026. Mobile working directory: `C:\a\lm`; backend working directory: `C:\a\LeronaBackend\Backend`. Existing uncommitted work was preserved. The changed-file manifest and supported behavior are in [secure-logout.md](secure-logout.md).

## Final mobile checks

### Focused tests

```powershell
node node_modules/jest/bin/jest.js --runInBand src/core/sync/secure-logout.test.ts src/core/sync/logout-journal.test.ts src/features/settings/presentation/logout-screen.test.tsx src/core/sync/cloud-client.test.ts src/core/sync/sync-engine.test.ts src/core/sync/guest-transfer.test.ts src/core/composition/application-scopes.test.ts src/core/composition/sync-session.test.ts src/core/storage/guest-free-tier.test.ts src/shared/bootstrap/data-scope-boundary.test.tsx src/features/settings/presentation/settings-account-card.test.tsx test/architecture.test.ts 2>&1 | Select-Object -Last 80; exit $LASTEXITCODE
```

Exit **0**: **12 suites, 102 tests passed**; 16.363 seconds on the final run. Coverage includes verified synchronization before logout, no-backup logout, failure/cancellation, immediate offline isolation, incomplete credential removal, guest preservation, actual SQLite restart/reopen, two-account ownership isolation, deferred-revocation references, stale requests/handles, navigation-history reset and prevention of automatic guest synchronization. Tests use real SQLite through the existing sql.js test adapter and mocked HTTP/SecureStore/native/navigation boundaries, not a live backend or physical device.

### TypeScript

```powershell
node node_modules/typescript/bin/tsc --noEmit 2>&1 | Select-Object -Last 30; exit $LASTEXITCODE
```

Exit **0**, no diagnostics.

### Scoped lint

```powershell
node node_modules/eslint/bin/eslint.js src/core/sync/cloud-client.ts src/core/sync/cloud-client.test.ts src/core/sync/logout-journal.ts src/core/sync/logout-journal.test.ts src/core/sync/phone-auth.ts src/core/sync/sync-engine.ts src/core/sync/sync-store.ts src/core/sync/secure-logout.test.ts src/core/composition/application.ts src/core/composition/application-scopes.test.ts src/core/composition/sync.ts src/core/storage/local-storage-scopes.ts src/features/settings/presentation/logout-screen.tsx src/features/settings/presentation/logout-screen.test.tsx src/features/auth/presentation/logout-notice.tsx src/features/settings/presentation/settings-account-card.tsx src/features/settings/presentation/settings-account-card.test.tsx src/features/settings/presentation/cloud-sync-screen.tsx src/shared/bootstrap/data-scope-boundary.tsx src/shared/localization/messages.ts src/app/_layout.tsx src/app/settings/logout.tsx src/core/sync/guest-transfer.test.ts src/core/composition/sync-session.test.ts src/shared/bootstrap/data-scope-boundary.test.tsx 2>&1 | Select-Object -Last 35; exit $LASTEXITCODE
```

Exit **0**, no diagnostics.

### Mobile formatting

```powershell
node node_modules/prettier/bin/prettier.cjs --check src/core/sync/cloud-client.ts src/core/sync/cloud-client.test.ts src/core/sync/logout-journal.ts src/core/sync/logout-journal.test.ts src/core/sync/phone-auth.ts src/core/sync/sync-engine.ts src/core/sync/sync-store.ts src/core/sync/secure-logout.test.ts src/core/composition/application.ts src/core/composition/application-scopes.test.ts src/core/composition/sync.ts src/core/storage/local-storage-scopes.ts src/features/settings/presentation/logout-screen.tsx src/features/settings/presentation/logout-screen.test.tsx src/features/auth/presentation/logout-notice.tsx src/features/settings/presentation/settings-account-card.tsx src/features/settings/presentation/settings-account-card.test.tsx src/features/settings/presentation/cloud-sync-screen.tsx src/shared/bootstrap/data-scope-boundary.tsx src/shared/localization/messages.ts src/app/_layout.tsx src/app/settings/logout.tsx src/core/sync/guest-transfer.test.ts src/core/composition/sync-session.test.ts src/shared/bootstrap/data-scope-boundary.test.tsx README.md docs/phone-authentication.md docs/secure-logout.md 2>&1 | Select-Object -Last 12; exit $LASTEXITCODE
```

Exit **0**: all matched files use Prettier style. The separate check below initially found a missing final newline; after formatting through a patch, its final run also exited **0**.

```powershell
node node_modules/prettier/bin/prettier.cjs --check docs/secure-logout-verification.md; exit $LASTEXITCODE
```

### Android JavaScript/Hermes export

```powershell
node node_modules/expo/bin/cli export --platform android --output-dir .tools/secure-logout-export 2>&1 | Select-Object -Last 28; exit $LASTEXITCODE
```

The initial sandbox attempt exited **7**, with EPERM opening Expo's log file. The same command was rerun with approved escalation. Final approved run exited **0**: 31 assets, one 8 MB Hermes bundle (`entry-12a64d83b9ab65c21477d0bd2e85d484.hbc`) and metadata exported. This is **not** an Android APK/native compilation, iOS build, device test or live-service validation.

## Broader checks and existing failures

The full suite was run earlier during this task, before the final targeted cache, legacy-restoration and navigation safeguards:

```powershell
node node_modules/jest/bin/jest.js --runInBand 2>&1 | Select-String -Pattern '^(PASS|FAIL)|^  ●|^Test Suites:|^Tests:|^Snapshots:|^Time:|^Ran all'; exit $LASTEXITCODE
```

Exit **1**: 85 suites passed, 3 failed; 679 tests passed, 6 failed, 685 total. Existing failures in `study-card.test.tsx` (2 RTL alignment checks), `navigation.test.tsx` (3 language/RTL checks), and `create-settings-use-cases.test.ts` (1 language/reminder check) remain unchanged. The final full suite was not rerun; only the final focused command above was rerun.

```powershell
node node_modules/eslint/bin/eslint.js . 2>&1 | Select-Object -Last 45; exit $LASTEXITCODE
```

Exit **1**: existing `src/shared/ui/text.tsx:134` `react/no-children-prop` error and `src/features/study/domain/review-engine.test.ts:6` unused `Sm2Scheduler` warning. These unrelated files were not changed by this task.

An earlier formatting check that additionally included `../LeronaBackend/Backend/README.md` exited **1** on its existing Markdown table alignment. Those tables were not reformatted. The final scoped mobile formatting command passes.

## Backend environment and unverified checks

Executed in the backend directory:

```powershell
dotnet --list-sdks
rg -n '<TargetFramework>' backend -g '*.csproj'
```

Exit **0**: only **8.0.100** installed; all five backend projects target **net10.0**. Backend tests/build were **not executed** because that installed SDK does not support the target framework. The added C# ownership, revocation, session-deadline, no-store and server-data-preservation assertions are authored but unverified.

After installing .NET 10, recommended commands (not executed):

```powershell
dotnet test backend/Flashcards.Tests/Flashcards.Tests.csproj --filter FullyQualifiedName~AuthTests
dotnet build backend/Flashcards.Api/Flashcards.Api.csproj
```

Deploy the additive token response fields and authenticated deferred-revocation route before depending on owner-authenticated offline-revocation retry. Without that capability the client does not claim revocation succeeded. Verification also requires the existing complete review-state endpoint and sync versions/feed for all supported data; missing versions, conflicts or unsupported scheduler data prevent a backup success claim.

## Scope and limitations

Executed in both repository directories:

```powershell
git diff --check
```

Exit **0** in each repository, with only Git's LF-to-CRLF conversion warnings and no whitespace errors.

No new backup service, retention policy, subscription system, database entity or migration was added in this task. There is no retained historical backup/expiry guarantee. Existing account databases/queues stay owner-scoped on disk; this is application isolation, not forensic erasure or newly added database encryption. Logout never deletes server decks, cards or reviews and never transfers guest data automatically. Offline server revocation remains unconfirmed until the same owner signs in online and the server confirms the authenticated retry.

Native SecureStore failure behavior, real-device navigation/storage, live JWT middleware/revocation, live server synchronization and native APK/iOS builds remain unverified. No SMS delivery was invoked or claimed.

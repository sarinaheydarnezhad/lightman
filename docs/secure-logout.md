# Secure logout and account isolation

## Choices and supported synchronization

The authenticated Account section at the top of Settings and the existing Cloud Sync screen both open `/settings/logout`. The dialog offers **Back Up and Log Out**, **Log Out Without Backing Up**, and cancellation. Repeated taps cannot submit multiple operations; native back/gestures cannot dismiss an in-progress synchronization. If cloud sync is unavailable, the dialog explains the limitation and disables the verified-sync choice, not local logout.

“Back Up” reuses the existing account SyncEngine, outbox, acknowledgements, versions and pull feed. It is **not a new backup service**. Before logout, it drains the account queue, pulls all pages, checks for failed/conflicted/pending changes, checks known versions for local decks/cards/history/progress/settings, verifies the pulled cursor covers acknowledgements, and compares owned server inventory/card text and review progress. Missing feed/version data, unsupported schedulers, incomplete cursors, conflicts or network failures block the backup success claim. If the session remains valid, the user stays signed in and may retry, cancel, or explicitly choose logout without backup. Actual session expiration can instead require signing in again.

Supported synchronization covers the existing deck/card contract, immutable review history, compatible Leitner progress and user settings. Local study-session records/queues, other scheduler metadata and historical restore points are not backed up. There is no configured backup retention period, expiry or historical restore guarantee. These limits are disclosed before choosing either operation. The result says “synchronized and verified,” not that a retained backup was created.

## Immediate local isolation

After confirmation (or successful verified sync for the backup choice), the account scope is locked synchronously, before any storage/network await. Account repositories become unavailable, cached application/settings services are invalidated, and scope revisions invalidate captured methods even if the same user later returns. The root boundary unmounts the old navigation tree and screens, then routes to guest Settings; previous account screens cannot be revisited through their stale navigation state. Account profile responses and pre-logout auth/refresh/sync responses are rejected or ignored.

The existing separate guest database is opened without copying, binding, merging, deleting or uploading data. Guest mode shows only guest decks/cards/history/preferences. Empty guest storage remains empty. Existing guest quotas still apply without deleting oversized data. Account databases and pending queues remain on disk, inaccessible through the signed-out application scope, for their original owner's next verified login. This is scope isolation, not a claim of forensic erasure or new database encryption.

Cloud requests bypass HTTP caches and send `Cache-Control: no-cache, no-store`; authenticated backend responses use `no-store`. A new account must obtain a fresh owned response instead of reusing a previous user's cached account inventory/profile.

Access/refresh credentials are removed from the existing SecureStore key before awaiting remote revocation. A persistent signed-out barrier prevents startup from restoring leftover credentials if deletion fails. Deletion falls back to overwriting the credential value with a non-credential sentinel. If both erasure attempts fail, the UI states that removal is incomplete and offers retry; it does not claim credentials were erased. If even the persistent barrier and erasure fail, the live app remains locked but cannot guarantee protection after a restart: keep it open and retry. Guest/account databases are not wiped to work around a credential-storage error.

## Server revocation and interrupted logout

The existing authenticated `POST /api/v1/auth/logout` revokes the JWT's current session. Confirmation requires HTTP 204. If access has expired and the server returns 401, the existing refresh endpoint may rotate the captured token solely for this immediate revocation attempt; those rotated credentials are never saved locally. Logout aborts other requests and invalidates token-write generations, so a late rotation cannot re-establish the session.

Before erasing credentials, the app saves only the user UUID, session UUID and request time in a small SecureStore revocation journal. No JWT, refresh token, password, OTP, account contents or guest contents are kept for retry. The additive token response provides `sessionId` and the original absolute `sessionExpiresAtUtc`; rotation does not extend that deadline. Older JWTs may provide non-secret `sub`/`sid` references through local decoding, which is not authentication or authorization. If a valid reference cannot be saved, the UI explicitly says retry is unavailable rather than claiming success.

Offline logout immediately isolates the account and clears credentials, but cannot revoke an authenticated server session with only public IDs. Pending references are retried only after **the same user** obtains a fresh authenticated session, on login or a later online account sync. The additive authenticated `POST /api/v1/auth/logout/{sessionId}` delegates to the existing TokenService with ownership derived from JWT claims. It is idempotent, returns no account data, cannot revoke another user's session, and does not revoke the new session simply because an old one was queued. IDs are not anonymous revocation credentials. A different user's login never submits those references or the old account's data queue.

Until confirmed, the result says server revocation is unconfirmed. Server access may remain possible from another copy of the old credentials until revocation or the existing 30-day absolute session expiry. Logout does not delete server decks, cards or reviews. Returning to guest does not initiate guest migration; the existing separate confirmation flow remains required.

Known absolute session expiration prevents offline account restoration. Legacy credentials without a session deadline must be refreshed online once their access token expires; they cannot silently restore an unverifiable expired session offline. A failed legacy refresh clears credentials and opens guest mode, preserving account data for a future login. Newly issued credentials with a known still-valid session deadline retain existing offline account behavior.

Legacy credentials missing the originally verified account ID also require a fresh `/me/` response before opening an account database. The old database's owner metadata is not authentication evidence. If that verification cannot complete offline, credentials are cleared and guest mode remains selected; neither dataset is deleted.

## Deployment and limitations

- Deploy the additive token fields and owner-authenticated deferred revocation endpoint. No backend entities, migrations, packages, subscriptions or backup service are added.
- The existing full review-state response is required for verified sync before logout; the client fails closed against incomplete responses.
- Existing server rows absent from sync versions/feed need authoritative backfill before the backup choice can succeed. Logout without backup remains available.
- A multi-operation sync can partially complete before a backup failure. A failure is not rolled back across the server, not called a successful backup, and does not delete either dataset.
- New backend behavior requires .NET 10 and the existing configured database/JWT infrastructure. Native storage/navigation and live HTTP revocation require device/server verification beyond these tests.

## Files changed for this task

Mobile paths relative to `lm`:

- `src/core/sync/logout-journal.ts`, `src/core/sync/logout-journal.test.ts`: non-secret references and durable result storage.
- `src/core/sync/cloud-client.ts`, `src/core/sync/cloud-client.test.ts`: immediate invalidation, credential erasure/barrier, late-response protection, expiry handling and owner-authenticated retry.
- `src/core/sync/phone-auth.ts`: additive token response validation.
- `src/core/sync/sync-engine.ts`: verified-sync logout, duplicate-operation guard, immediate scope lock and guarded sync results.
- `src/core/sync/sync-store.ts`: acknowledgement/version/inventory/progress verification for logout.
- `src/core/sync/secure-logout.test.ts`: real SQLite scopes and production sync/auth client exercised with mocked transport.
- `src/core/sync/guest-transfer.test.ts`: keep testing operation exclusivity for backup logout during migration; ordinary logout may now isolate immediately.
- `src/core/storage/local-storage-scopes.ts`: synchronous lock, cancelled selection generations and revision-bound access checks.
- `src/core/composition/application.ts`, `src/core/composition/application-scopes.test.ts`: invalidate cached account services and stale handles across re-login.
- `src/core/composition/sync.ts`, `src/core/composition/sync-session.test.ts`: lifecycle lock, restart result restoration and fail-closed legacy identity verification.
- `src/features/settings/presentation/logout-screen.tsx`, `src/features/settings/presentation/logout-screen.test.tsx`: confirmation, loading, failure, cancellation and explicit choices.
- `src/features/auth/presentation/logout-notice.tsx`: actual local/sync/revocation results in the signed-out environment.
- `src/features/settings/presentation/settings-account-card.tsx`, `src/features/settings/presentation/settings-account-card.test.tsx`: top-level Settings logout entry.
- `src/features/settings/presentation/cloud-sync-screen.tsx`: route existing logout through the same confirmation.
- `src/shared/bootstrap/data-scope-boundary.tsx`, `src/shared/bootstrap/data-scope-boundary.test.tsx`: clear old stack history, reset navigation to guest Settings and display the result.
- `src/shared/localization/messages.ts`: English/Persian messages.
- `src/app/settings/logout.tsx`, `src/app/_layout.tsx`: route registration.
- `README.md`, `docs/phone-authentication.md`, this document and `docs/secure-logout-verification.md`: behavior and actual checks.

Backend paths relative to `LeronaBackend/Backend`:

- `backend/Flashcards.Infrastructure/Auth/TokenService.cs`: additive session ID/absolute expiry in token responses; existing rotation/reuse behavior preserved.
- `backend/Flashcards.Infrastructure/Auth/AuthService.cs`: owner-scoped old-session revocation using the existing service.
- `backend/Flashcards.Api/Endpoints/V1Endpoints.cs`: authenticated deferred logout route and no-store responses.
- `backend/Flashcards.Tests/AuthTests.cs`: revocation ownership/idempotency, unchanged rotation deadline and server data preservation assertions (not executed with SDK 8).
- `README.md`: API compatibility and deployment notes.

Pre-existing uncommitted authentication, guest, migration, quota, SMS and other work remains intact. See [verification](secure-logout-verification.md) for commands and actual outcomes.

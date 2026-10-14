# Guest-to-account copying and safe separation

## Supported behavior

After verified password, OTP, email login or registration, the app opens `/auth/guest-data`. The authenticated Account card in Settings also opens this page, including after an interrupted transfer. A network connection is required to inspect and verify the account; guest study remains offline and independent.

- **Guest only:** preview active guest decks/cards and supported review history; explicitly confirm separate copies into the empty account.
- **Account only:** synchronize and show account inventory, preserving all guest storage (including archived data).
- **Both:** show both deck lists and card counts. Warn about titles matched only by trimming, collapsing whitespace and lowercasing. Matching titles or card text never identify equivalent entities. The existing backend free limits currently prohibit adding another active deck; the UI explains this and offers keeping the datasets separate. It does not offer replacement or destructive merging.
- **Neither:** show an empty-account completion message. Archived-only data remains untouched; it is not called an active transferable dataset.

The user can cancel the confirmation or keep datasets separate before staging without creating an account copy or journal. Preview synchronizes already-owned account operations only; it never uploads the guest outbox. Loading errors are not interpreted as an empty account.

## Transfer coverage and limits

Transfer copies **active Leitner decks, their active cards, complete immutable review history, and verified Leitner progress**. It preserves deck/card/event relationships, text, examples, box, due date, last review, consecutive successes, total reviews and total successes. Different source card IDs remain different target cards even if their text is identical. IDs are newly generated per account to avoid collisions with existing server-owned IDs, then frozen in a local journal.

For reviewed cards, replay must reproduce the guest state under the existing backend UTC-day Leitner rules before copying. Incomplete/missing history, another scheduler, incompatible local-calendar due dates, oversized payloads, missing state, or backend-incompatible card contents block copying with a reason. Unreviewed cards transfer their initial due date through the existing review-state operation. Reviewed cards upload events, not a final-state seed, preventing double counting.

**Not transferred:** archived decks/cards or their history, app settings, study-session records/queues/summaries, scheduler metadata outside Leitner, and original server creation timestamps. Event study-session associations are set to null because those sessions are not transferred. Originals remain recoverable in guest storage. Unsupported progress is not silently reset or reported as migrated.

## Persistence, retry and verification

The existing SyncEngine, SyncStore, sync feed, entity versions, cursors, conflict responses and server idempotency receipts are reused. There is no migration endpoint or second sync transport.

1. Validate the verified `/me` identity against the selected account database and read guest data in a consistent SQLite snapshot. Guest storage must still be unowned.
2. Strictly synchronize the account, compare the preview again, and cross-check the authenticated deck/card read APIs and review-state API against pulled inventory and progress. Missing or different account review state is not silently replaced with a guessed initial state. Legacy data missing from the feed blocks copying rather than appearing to be an empty server or a fully loaded account.
3. After explicit confirmation, one account SQLite transaction inserts the mapped copies, substitutes backend-compatible outbox operations for only the trigger rows generated in that transaction, and records the frozen snapshot, mapping and operation IDs in `guest_transfers` (local schema version 6). Normal quota triggers remain enabled. A disk/SQL failure rolls everything back.
4. Existing sync pushes each queued operation atomically on the server. Exact retries retain device ID, operation ID, payload, creation time and expected version. Failed operation retries preserve their fingerprint; conflicts/discarded operations are never automatically rebased or resolved.
5. Drain the existing queue and fully paginate pull. Completion requires every journal operation to be acknowledged, the local cursor to cover every acknowledged version, the copied owned decks to be server-visible, and mapped card/history relationships and review state to verify. The authenticated backend review-state read now exposes success/streak/last-review fields for authoritative comparison.

The **whole transfer is not a single server transaction**: the existing single-operation push transport may leave an acknowledged partial copy after interruption. The page reports incomplete completion, acknowledgement progress, preserved originals and how to retry the same snapshot. No guest or server data is deleted. Automatic synchronization may continue a previously consented durable queue after reconnect/restart. Do not study/edit a partially transferred account copy until verification finishes: a concurrent change deliberately causes verification to stop rather than overwrite it.

One frozen snapshot is allowed per guest-device identity and account database. Retrying or revisiting a completed transfer does not recopy later guest edits. Additional incremental guest linking and per-deck replacement/recovery need separately designed consent and conflict handling. Manual conflict resolution that discards a migration receipt does not make this transfer complete; preserve both histories for inspection.

## Backend dependencies

- All authenticated writes retain the existing 1-active-deck/50-active-card limits, ownership checks and sync-head lock. Adding guest decks to a nonempty account is unavailable until trusted entitlement support permits it; no premium override or automatic archive is introduced.
- Rows created outside sync without feed entries require an authoritative backend backfill. This task detects that gap but does not invent cursors or bypass versions.
- Only Leitner scheduling is represented on the backend. Other schedulers and arbitrary progress snapshots require a compatible scheduler/history contract before migration.
- Deploy the additive review-state response fields before using final verification. No backend entities or EF migrations are added by this task. The local journal migration is necessary for restart-safe, stable-ID retry.
- .NET 10 SDK, configured SQL Server, the existing schema/auth migrations, HTTPS API URL and existing JWT configuration remain prerequisites. No SMS or payment configuration is added here.

## Files changed for this task

Mobile (paths relative to `lm`):

- `src/core/storage/local-storage-scopes.ts` — read guest storage without changing account scope.
- `src/core/storage/guest-free-tier.test.ts` — scope isolation test for the source reader.
- `src/core/database/migrations.ts`, `src/core/database/database.test.ts` — durable local journal and schema tests.
- `src/features/study/data/scheduler-persistence.test.ts` — update the existing upgrade expectation to schema version 6 without changing its review-history assertions.
- `src/core/sync/guest-transfer-snapshot.ts` — snapshot, backend compatibility and progress preflight.
- `src/core/sync/guest-transfer.ts`, `src/core/sync/guest-transfer.test.ts` — preview, consented staging, retry and verified completion.
- `src/core/sync/sync-engine.ts`, `src/core/sync/sync-engine.test.ts` — exclusive account operation, strict full synchronization and post-authentication callback.
- `src/core/sync/cloud-client.ts`, `src/core/sync/cloud-client.test.ts` — owned inventory/progress reads and compatible Leitner wire contract; non-Leitner writes fail closed.
- `src/core/composition/guest-transfer.ts`, `src/core/composition/sync.ts` — existing infrastructure composition and post-authentication navigation.
- `src/features/auth/presentation/guest-data-screen.tsx`, `src/features/auth/presentation/guest-data-screen.test.tsx` — preview, confirmation, cancellation, progress, errors and resume UI.
- `src/app/auth/guest-data.tsx`, `src/app/_layout.tsx` — route and existing stack registration.
- `src/features/settings/presentation/settings-account-card.tsx` — account-level transfer entry point.
- `src/shared/localization/messages.ts` — English/Persian flow messages.
- `README.md`, `docs/guest-mode.md`, `docs/phone-authentication.md`, `docs/SYNC.md`, this document and `docs/guest-migration-verification.md` — behavior and verification notes.

Backend (paths relative to `LeronaBackend/Backend`):

- `backend/Flashcards.Api/Endpoints/V1Endpoints.cs` — additive owned review-state verification fields.
- `backend/Flashcards.Tests/SyncTests.cs` — historical copy/retry/progress/ownership and same-name/quota tests.
- `README.md`, `GUEST-MIGRATION.md` — API compatibility, prerequisites and unverified checks.

Pre-existing uncommitted authentication, guest mode, quotas, SMS and other changes were preserved. See [the verification record](guest-migration-verification.md) for actual checks, not device/live-service claims.

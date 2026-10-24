# Guest mode and local free limits

## Storage and ownership

The app is usable without signing in. Deck/card creation, editing, review scheduling and review history run against local SQLite without contacting the backend. The root navigation shows guest/account mode and unmounts previous screens during storage switches or storage errors. A failed storage operation displays an error instead of reporting a successful save; unsaved deck/card form values remain available after a quota error.

`src/core/storage/local-storage-scopes.ts` selects persistent database files:

- An existing `lerona.db` with an empty `sync_account.user_id` remains guest storage. It is never assigned to an account.
- If `lerona.db` already belongs to an account, only that exact account may reopen it. Guest data goes into `lerona-guest.db` instead.
- Other accounts use `lerona-account-{verified-user-uuid}.db`.
- Unknown/corrupt ownership fails closed. Account data is never copied or overwritten by a scope switch. Explicit logout resets only unowned guest learning storage.

Per-scope application services capture their own repositories. Stale reads/results are rejected after a switch, and navigation/settings subscriptions no longer expose the former scope. Existing import/export operations also capture their originating scope; a stale import preview cannot be applied to another account. The separately implemented [guest-data copy flow](guest-data-migration.md) reads unowned guest storage without rebinding it and requires explicit confirmation before creating account copies.

The existing SecureStore token record retains the verified `/me/` account UUID to restore its scope offline. Legacy credentials without this metadata require a verified identity, not a guess from database ownership. Logout/session loss locks account access and resets guest learning data before opening an empty guest space. Account data remains private for its owner's next login. Reset failures remain locked and a durable intent retries cleanup after restart. Offline logout clears local credentials but cannot confirm remote revocation.

Guest sync returns before credential reads, outbox reads or network calls. Account binding is explicitly denied while in guest mode. Signing in immediately synchronizes separate account storage, then asks whether to add guest data or discard it permanently. Discard requires destructive confirmation. The additive transfer uses new account-owned identities and durable receipts; only verified completion permits guest cleanup. Pending transfers must resume, not be discarded as if no copies exist. Guest outbox records are never uploaded or bound directly, and decks are never combined by name. With no guest learning data, the synchronized account opens automatically.

## Limit policy

There is no implemented trusted subscription/entitlement authority in either project. All local scopes and authenticated accounts therefore receive the free limits; the mobile client cannot opt into a paid tier. Supporting active subscribers requires a verified backend entitlement source and a defined offline entitlement policy, not a client-provided premium flag.

- At most one unarchived deck and 50 unarchived cards in total may be created.
- Cards count across all owned decks, including cards whose parent deck was archived. Archiving a deck alone does not free card capacity; archiving a card does.
- Edits and study/reviews remain available, including for existing oversized datasets. Quota checks never delete existing data.
- Restoring an archived record locally must also satisfy the limit. Backend archival remains terminal under its existing contract.

`src/core/database/free-tier-guards.ts` installs idempotent SQLite insert/restore triggers after existing migrations. These protect repository writes, bulk/import writes and concurrent local creation atomically. Rejected writes roll back related review state/outbox changes through existing transactions. The deck/card forms translate the quota error into English/Persian explanations. Test-only in-memory navigation fixtures are not the production persistence implementation; quota tests execute real SQLite with the installed `sql.js` dependency.

The existing trusted remote-pull transaction sets `sync_account.applying_remote`; quota triggers do not reject those server snapshots, so pulling existing oversized account data never silently discards it. This flag is not an entitlement and does not allow new local growth. Authenticated permissions remain server-authoritative.

Backend `SyncService` checks authenticated ownership and quotas inside its existing per-user sync-head lock/transaction. Both `POST /api/v1/decks` and existing sync push creation paths use this guard. Rejections return HTTP 403 with `{ error, code }`, where `code` is `free_tier_deck_limit` or `free_tier_card_limit`; the entire push rolls back. Direct database writes outside the API must not be treated as authorized user operations.

Free-tier enforcement itself adds no entities or migrations. The later guest-copy flow adds a local version-six journal for retry safety; it adds no backend entities or migrations. Existing phone-auth migrations are unchanged.

## Remaining verification/dependencies

See [the guest-mode validation record](guest-verification.md) and [the later migration checks](guest-migration-verification.md). Real-device offline/restart UI behavior, iOS builds and live SQL Server concurrency remain unverified. Backend compilation/tests require a .NET 10 SDK; this environment has only SDK 8.0.100. No payment, subscription purchase, backup or second sync transport is implemented.

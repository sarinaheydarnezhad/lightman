# Subscription read contracts

The server subscription model and rules live in `LeronaBackend/Backend/SUBSCRIPTIONS.md`. The mobile app has no second plan catalog or purchase/activation operation. The Plus Paywall and duration-selection UI use these read contracts; see `plus-paywall.md` for entry points and payment limitations.

The existing CloudClient and SyncEngine expose:

- `planCatalog()`: public `GET /api/v1/plans`, no credentials. Prices/durations/currency come only from server data. Plus prices are not duplicated in production mobile code.
- `subscription()`: authenticated `GET /api/v1/me/subscription`; current/historical metadata and effective entitlements.
- `entitlements()`: authenticated `GET /api/v1/me/entitlements`.

User-specific methods use existing JWT/refresh handling, session epochs and the SyncEngine account-operation guard. They accept no owner ID and reject late responses after logout. CloudClient itself does not persist entitlements; the subsequent scoped access controller maintains bounded provisional metadata as documented in `access-limits.md`. Expired authentication uses existing session clearing/isolation. Public catalog reads remain available without signing in through the existing native HTTPS API configuration.

`src/core/sync/subscription.ts` defines/validates the actual DTOs, including supported periods/statuses, effective active access, limits/features and disabled purchase flags. `src/core/sync/subscription.test.ts` checks contracts, server price preservation, malformed catalogs, expiration boundaries, authorization requests, network failures and stale-session rejection. Test fixtures contain prices solely to verify the server contract; they are not the mobile source of truth.

Full is reserved, has no prices or current entitlements and cannot be purchased. No payment provider is integrated, so Plus purchases are also disabled despite published price offers. Real activation requires a verified server payment integration, not a local flag or client-submitted subscription.

The subsequent access-enforcement task connects these APIs to local creation/study guards, imports and explicit guest-copy previews. Guest behavior remains local at 1 deck/50 cards. Authenticated offline access is provisional and bounded by expiration and a five-minute lease, while server mutations always revalidate current rights. Over-limit free accounts retain viewing, editing and export but cannot study or add content. See `access-limits.md`; no guest data is migrated by an entitlement read.

Changed files: this document, `src/core/sync/subscription.ts`, `src/core/sync/subscription.test.ts`, `src/core/sync/cloud-client.ts`, `src/core/sync/sync-engine.ts`. API/schema/test/deployment details and actual verification commands are in the backend `SUBSCRIPTIONS.md` and `SUBSCRIPTION-VERIFICATION.md`. No environment values/secrets or purchase configuration were changed.

# Plus Paywall

The existing `/settings/subscription` route now presents Plus duration selection using the existing design system and English/Persian localization. Selection is informational: **no payment provider or trusted purchase-verification endpoint exists**, so the purchase action is always disabled. No activation, checkout, pending payment, cancellation or payment-success state is simulated. Full is text-only and never selectable.

## Entry points and status

- Settings offers View plans in both guest and account sections.
- Rejected deck/card editor entry shows a centered, localized free-plan limit with View plans and Browse decks actions, rather than an unavailable-feature message. The free plan allows at most 1 active deck and 50 active cards total across all decks. Save-time failures remain beside the form actions and preserve unsaved fields.
- Access errors and subscription warnings never render a global top-of-screen banner. Background entitlement refresh remains active; Settings and the Paywall show subscription status. The Paywall preserves structured deck/card/operation reasons through its initial refresh, unless confirmed Plus now permits access. Free study remains allowed within the free limits after expiration.
- The Paywall shows guest/account scope, current effective access, supported subscription metadata and expiration in local time, current usage and free-limit comparison. Offline cached Plus is explicitly provisional; unknown access does not become Plus. Scope boundaries remount the screen on account changes, and focused-resource cancellation plus existing API epochs ignore late responses.
- Plan buttons expose selected and disabled accessibility states. Text/number formatting uses existing RTL/LTR-aware components and locale helpers. The screen has loading, empty, catalog-failure, status-failure and refresh states. Refresh/purchase controls cannot initiate duplicate purchases; there is no purchase request at all.

## Existing API integration

- `GET /api/v1/plans`: public catalog, actual durations, prices, currency and disabled purchase flags; production mobile code has no fallback price list.
- `GET /api/v1/me/entitlements`: refreshed through the existing owner-scoped learning-access controller; no second subscription authority or persistent state store.
- `GET /api/v1/me/subscription`: subscription metadata/status only for the authenticated scope, through existing JWT refresh/session guards.
- Local counts reuse `localLearningUsage`, including the existing archived-deck card counting rule. Cloud capability copy is conditional on existing native HTTPS availability; sync/backup still require sign-in and configuration and are not advertised as new Plus-only functionality. Guest data is not uploaded by opening/selecting plans.

The backend catalog currently returns 1/6/12-month Plus offers of 49,000/279,000/499,000 toman. Prices in tests assert this contract; changing server prices changes the UI without maintaining another production catalog. An unavailable catalog shows an error or empty state, never invented prices.

## Payment follow-up

Select/configure an authorized purchase provider, implement trusted server transaction verification and idempotency, and add checkout/pending/cancelled/failure/success states only with that integration. Before any future purchase, recheck effective subscription state on the server and reject active/overlapping subscriptions and Full purchases; refresh the existing entitlement controller only after verified activation. The present UI blocks all purchases, including for active Plus accounts, and cannot grant access.

No backend files, migrations, dependencies, authentication behavior or live learning records are changed by this task. Existing excess data is never deleted or modified by selection, expiration messages or refresh.

## Files changed

- `src/features/settings/presentation/subscription-screen.tsx` and new `subscription-screen.test.tsx`
- `src/features/settings/presentation/settings-account-card.tsx` and its tests
- `src/features/settings/presentation/settings-screen.test.tsx` (existing Settings controls exclude the new account action; its presence is checked in both languages)
- `src/shared/access/learning-access-notice.tsx` and its tests
- `src/core/access/learning-access.ts`
- `src/shared/localization/messages.ts`
- `docs/subscriptions.md`, `docs/access-limits.md`, this document and `docs/plus-paywall-verification.md`

The route, Stack registration, auth/session handling, catalog DTO validation and protected operations reuse their existing implementations. Actual verification commands and results are recorded in `plus-paywall-verification.md`.

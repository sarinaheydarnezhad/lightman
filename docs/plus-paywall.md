# Plus Paywall

The existing `/settings/subscription` route presents Plus duration selection and a separate Premium card using the existing design system and English/Persian localization. Selection is informational: **no payment provider or trusted purchase-verification endpoint exists**, so the purchase action is always disabled. No activation, checkout, pending payment, cancellation or payment-success state is simulated. Premium is visibly marked as not available to all users right now and is never selectable. The reserved internal/API `Full` identifier is retained for compatibility; its user-facing name is Premium.

## Entry points and status

- Settings shows the account phone number (email for legacy accounts) and a Subscription button, labeled Subscription (Plus) only after current server confirmation. Guest Settings offers sign-in and Subscription. Logout remains available; backup details and controls live under Cloud sync, reachable from Settings > About.
- Rejected deck/card editor entry shows a centered, localized free-plan limit with View plans and Browse decks actions, rather than an unavailable-feature message. The free plan allows at most 1 active deck and 50 active cards total across all decks. Save-time failures remain beside the form actions and preserve unsaved fields.
- Access errors and subscription warnings never render a global top-of-screen banner. Background entitlement refresh remains active. The Paywall preserves structured deck/card/operation reasons in a modal through its initial refresh, unless confirmed Plus now permits access. Free study remains allowed within the free limits after expiration.
- Subscription status and valid start/end dates appear inside the Plus plan card. Dates use the local English/Persian calendar without a time of day. The old Subscription and access diagnostic section, usage comparisons, active-purchase warning and Refresh access buttons are removed. Active Plus hides duration selection and purchase controls. Offline cached Plus remains explicitly provisional; unknown access does not become Plus. Scope boundaries remount the screen on account changes, and focused-resource cancellation plus existing API epochs ignore late responses.
- Plan buttons expose selected and disabled accessibility states. Text/number formatting uses existing RTL/LTR-aware components and locale helpers. Focus/background refresh happens automatically; failures and empty catalogs offer a generic Try again action. There is no purchase request at all.

## Existing API integration

- `GET /api/v1/plans`: public catalog, actual durations, prices, currency and disabled purchase flags; production mobile code has no fallback price list.
- `GET /api/v1/me/entitlements`: refreshed through the existing owner-scoped learning-access controller; no second subscription authority or persistent state store.
- `GET /api/v1/me/subscription`: subscription metadata/status only for the authenticated scope, through existing JWT refresh/session guards.
- The subscription page no longer queries local learning counts just to display diagnostics. Existing learning-access checks still enforce limits. Sync/backup still require sign-in and configuration, and guest data is not uploaded by opening/selecting plans.

The backend catalog returns the following Plus offers, in toman:

| Duration  |   Total | Monthly equivalent | Discount |
| --------- | ------: | -----------------: | -------: |
| 1 month   |  70,000 |             70,000 |        — |
| 6 months  | 294,000 |             49,000 |      30% |
| 12 months | 420,000 |             35,000 |      50% |

Multi-month buttons show the total and the monthly equivalent beneath it, with the discount relative to the server's one-month price. The selected multi-month summary also shows its monthly equivalent. These are derived from the server catalog, not another production price list; no discount is invented if the one-month baseline is missing. An unavailable catalog shows an error or empty state, never invented prices.

## Payment follow-up

Select/configure an authorized purchase provider, implement trusted server transaction verification and idempotency, and add checkout/pending/cancelled/failure/success states only with that integration. Before any future purchase, recheck effective subscription state on the server and reject active/overlapping subscriptions and Full purchases; refresh the existing entitlement controller only after verified activation. The present UI blocks all purchases, including for active Plus accounts, and cannot grant access.

Pricing changes are made in the backend catalog and require no schema migration. Dependencies, authentication behavior and live learning records are unchanged. Existing excess data is never deleted or modified by selection, expiration messages or refresh.

## Files changed

- `src/features/settings/presentation/subscription-screen.tsx` and new `subscription-screen.test.tsx`
- `src/features/settings/presentation/settings-account-card.tsx` and its tests
- `src/features/settings/presentation/settings-screen.test.tsx` (existing Settings controls exclude the new account action; its presence is checked in both languages)
- `src/shared/access/learning-access-notice.tsx` and its tests
- `src/core/access/learning-access.ts`
- `src/shared/localization/messages.ts`
- `docs/subscriptions.md`, `docs/access-limits.md`, this document and `docs/plus-paywall-verification.md`

The route, Stack registration, auth/session handling, catalog DTO validation and protected operations reuse their existing implementations. Actual verification commands and results are recorded in `plus-paywall-verification.md`.

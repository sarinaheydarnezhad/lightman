# Settings account, subscription and backup

Updated on October 24, 2026. Existing authentication, guest scopes, entitlement controller, backup client and secure logout are reused; no backend, database schema, dependencies or configuration changed.

## What was already implemented

Settings already had account/guest switching, authentication navigation, Paywall navigation, account profile loading, a server-backed backup card and the backup-before-logout route. The backup card already verified creation through SyncEngine, displayed backend metadata and retention, and handled errors/retries. Logout already isolates guest storage, clears credentials and attempts server revocation without deleting server learning records. These are reused, not replaced.

## Gaps completed

- Guests see **Log In / Sign Up** and **Subscription**, without subscription or backup queries.
- Authenticated Settings shows only the owner's phone (email for legacy accounts), a **Subscription** button and the retained logout action. Username, signed-in text, access explanations and subscription marketing are omitted. Profile failures use a safe localized modal with retry.
- The subscription button uses the existing owner-scoped entitlement controller and refreshes stale access automatically. Confirmed active Plus labels it **Subscription (Plus)**, never **Upgrade to Plus**. Unknown, loading, invalidated and provisional offline access use the neutral **Subscription** label.
- Opening the existing subscription page shows server status and valid start/end dates without times, inside the Plus card. The old Subscription and access section and Refresh access controls are removed. Active Plus hides purchase/duration controls. Premium remains unavailable; no purchase activation exists.
- Backup details and controls now live under **Settings > About > Cloud sync**, retaining verified creation, failure recovery and account isolation rather than cluttering the top-level account card.
- Profile, subscription and backup resources remount on storage revision/owner changes. Late focus requests cannot repopulate an unmounted scope, and existing CloudClient session epochs protect API reads. Guest/account datasets are never copied or modified by opening Settings.
- Read-only subscription/entitlement/backup-status methods no longer take the exclusive account-write/sync lock. Their scope, session and operation-epoch checks remain; they can load independently instead of one read failing merely because another section is loading. Mutating backup/sync/logout operations retain the existing exclusive transactional/synchronization paths.
- Backup status refresh failures label the current status unconfirmed while preserving historical successful metadata. A genuinely verified creation remains reported as completed even if its subsequent metadata refresh fails. No local save is called a server backup.
- All new copy supports English and Persian. Shared Text/Button components retain existing direction/accessibility behavior; fixed navigation/icon placement is unchanged.

## Connected existing APIs

All paths have the existing `/api/v1` prefix and use the existing JWT/refresh/session client for authenticated requests. No caller supplies an ownership ID.

- `GET /me/`: `{ id, displayName, phoneNumber, email }`; owner ID checked against the active local scope before presenting the contact.
- `GET /me/entitlements`: current effective access through `learningAccess().refreshIfStale()` in Settings and automatic refresh on the subscription page; no second entitlement store.
- `GET /me/subscription`: read only on the subscription page, where metadata supplements but does not replace the controller's authoritative effective access.
- `GET /backups/status` plus `GET /backups/?page=1&limit=1`: the existing `backupStatus()` adapter combines last completed and latest-operation metadata.
- `POST /backups/`: existing retry-safe verified `createBackup()` flow, including synchronization, sync-version verification and post-creation verification. UI duplicate submissions remain blocked.
- Logout only navigates to `/settings/logout`; that existing flow offers backup/no-backup/cancel and invokes existing revocation/local isolation. Settings does not implement its own token clearing or server deletion.
- `/settings/subscription` uses the existing public `GET /plans` catalog when opened.

## Changed files

- `src/features/settings/presentation/settings-account-card.tsx`
- `src/features/settings/presentation/settings-subscription-card.tsx`
- `src/features/settings/presentation/subscription-screen.tsx`
- `src/features/settings/presentation/cloud-sync-screen.tsx`
- `src/features/settings/presentation/cloud-sync-backup.test.tsx`
- `src/features/settings/presentation/settings-backup-card.tsx`
- `src/core/sync/sync-engine.ts`
- `src/shared/localization/messages.ts`
- `src/features/settings/presentation/settings-account-card.test.tsx`
- `src/features/settings/presentation/settings-screen.test.tsx`
- `src/core/sync/subscription.test.ts`
- `src/shared/navigation/navigation.test.tsx` (Settings subscription navigation)
- This document and `settings-account-verification.md`

## Availability and remaining dependencies

Live API/SQL connectivity and native-device layout are not verified by unit tests or JavaScript export. Account cloud features still require the existing native build, HTTPS API URL and working authenticated backend. The UI reports configuration/service failures rather than fabricating account or backup information.

The inspected backend backup configuration requires `Backups:RetentionDays`, `Backups:MaxPayloadBytes`, `Backups:MaxStoredBackupsPerUser` and a valid absolute `Backups:KeyRingPath`; operational key-ring persistence is still required. Runtime deployment configuration was not changed or claimed verified. Restore and scheduled expired-artifact cleanup are not available through this UI. The backend plan catalog still declares no configured payment provider; Plus purchases and Full purchase/activation remain unavailable.

Actual executed checks and results are recorded in `settings-account-verification.md`.

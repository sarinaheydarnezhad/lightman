# Optional cloud synchronization

SQLite is the source of truth during normal use. Deck/card edits, settings, and review transactions work without a connection. SQLite triggers add a compact operation to `sync_operations` in the **same transaction**; they do not copy the application database. Upgrade v3 queues existing local records once. Local review events cannot be updated or deleted. Without an account, data stays local.

Automatic first-run settings defaults are not uploaded: a new device can pull the account's preferences without a false conflict. User edits, including edits made offline before sign-in, are queued normally.

## Setup

Install native dependencies with `pnpm install` and rebuild the native app after adding `expo-secure-store` and `expo-network`. Set `EXPO_PUBLIC_API_URL` to the backend's **HTTPS** origin (no `/api/v1` suffix). For a physical phone, use a network-accessible hostname with a certificate trusted by the phone; `localhost` on the phone is not the development PC. Apply EF migrations on SQL Server first. Open Settings → Cloud sync to register or sign in; signing in binds this installation's SQLite database to one account. Switching to another user requires a separate local database/reset, to prevent uploading one person's offline work into another account. Web continues to work locally without cloud sync.

The mobile token pair is stored only in the OS secure credential store. Access tokens are refreshed with a rotating refresh token before expiry or after a 401; a rejected refresh clears local credentials. Sign out revokes the server session when online and always deletes the local credential; if offline, server revocation cannot be confirmed until the session expires. Never put tokens into SQLite, analytics, error messages, or logs. The server derives user identity from bearer authentication; `entityId` for settings is forced to that user's ID. Production requests require HTTPS.

## Push and pull

Each queued operation stores a persistent operation UUID, entity type/UUID, operation, payload, base version, creation time, retry count, and status. One operation at a time is pushed to `POST /api/v1/sync/push` so a conflict cannot roll back unrelated changes. Its UUID and device UUID remain unchanged on retry; applied and duplicate acknowledgements both mark it synced. An acknowledgement and entity version are saved atomically. If a prior local edit of the same entity was acknowledged, a not-yet-attempted dependent edit gets that acknowledged version. Once an operation is attempted its base version is frozen, so a lost acknowledgement can be safely retried.

`GET /api/v1/sync/pull?cursor=N&limit=100` returns versions strictly greater than `N`, in sequence. Each bounded page is applied within one SQLite transaction with queuing temporarily disabled. The cursor advances in that same transaction, **after** every entity change, conflict record, and review event is saved. A failed page rolls back both changes and cursor; reconnect replays it. At most 25 queued operations and three 100-change pull pages are processed per cycle; further work is scheduled separately. The server cursor, never wall-clock time, identifies changes. Pull does not scan or upload the database on each launch.

Transient network/429/5xx failures back off exponentially from one second to 16 seconds. Each operation gets at most five attempts, then is shown as failed with a manual retry button. Network reconnect or app foreground also triggers an idle sync. Pull retries are limited to five consecutive failures before another foreground/reconnect/manual attempt. Neither study nor analytics awaits the scheduler.

## Conflicts and review state

Deck/card/settings updates use optimistic **per-entity server versions**, not timestamps. An existing local edit is never silently overwritten by a remote snapshot: the server value and attempted local value are retained in `sync_conflicts`. In Cloud sync the user chooses either the server version (discard this local edit) or a new operation with the user's edit rebased on the displayed server version. Settings obey this same explicit last-confirmed-version policy; device clock time never decides a winner. Archives are terminal, including for cards with review history; review events are never deleted. A superseded edit remains visible until the user resolves it.

Only new card review states are uploaded initially. The server projects later state from accepted immutable review events in server version order and rejects stale mutable review-state updates. On mobile, historical events from both devices are stored by stable event ID and replayed in **server cursor order**, followed by still-pending local events. The existing Leitner success/failure transitions derive box, counters and due date using UTC calendar days; the original `previousBox`/`newBox` on each historical event remains untouched. If an event cannot be applied, the entire pull page and cursor roll back. A review-state conflict without safe event history is surfaced rather than choosing a device's box. Before sync, local study retains its established local-calendar SRS behavior; after merging two devices, UTC days ensure both devices derive the same state.

## Manual device smoke test

1. On device A, register while online; disconnect network. Create a deck/card, review twice, inspect analytics, change theme and reminder, use speech/dictionary, and archive a second card. Verify every action returns immediately and the pending count rises.
2. Reconnect A; inspect Cloud sync until pending is zero. Restart A, then sign in to the same account on a fresh device B. Pull and verify deck, card, both review events, counters, settings, and archive (including history).
3. Disconnect both devices. Review the **same** card with different outcomes on A and B, and edit the same deck/settings separately. Reconnect both, then foreground each. Verify both events persist with distinct IDs and identical derived SRS state on each device; verify deck/settings conflicts remain visible until explicitly resolved.
4. Toggle connectivity during a push and pull; verify no duplicate review events and no cursor advancement before successful local application. Force access-token expiry, check refresh, then sign out and confirm authenticated sync stops.

This automated environment has no connected physical device; perform the above on devices with a reachable SQL Server-backed HTTPS API before release.

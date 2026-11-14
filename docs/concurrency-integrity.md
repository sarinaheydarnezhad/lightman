# Settings and study-session concurrency

Phase 3 preserves the scheduling-v2 and card-content-v1 contracts. SQLite schema 9 adds
only two study-session triggers. No session, review, card, replay baseline or outbox row
is changed by this migration.

## Settings

`SettingsRepository.update` is an atomic patch of the supplied fields. A full object
explicitly replaces every supplied preference; callers must not pass stale snapshots
when they intend a partial change. `initialize` inserts defaults only when the row is
absent. SQLite merges and validates against durable settings inside a transaction,
including outbox triggers. Cached settings are published after COMMIT, never on a failed
write. Reads, writes and publication share a FIFO for each database object, including
independent repository instances.

All settings application commands, default initialization and reminder reconciliation
share a separate FIFO keyed by `mutationScope` (the owner database, forwarded through
decorators). Invocation order determines the final value for the same field. A failed
command does not prevent later commands. There is no optimistic Zustand copy:
`useSyncExternalStore` observes the committed repository snapshot.

The command FIFO deliberately includes permission and reminder side effects. Settings
commands for that owner can wait for a permission prompt; database transactions are
never held during platform work. Other owners and unrelated application commands can
continue. The bound is 128 outstanding tasks per FIFO; excess requests fail with an
actionable unavailable error and may be explicitly retried. There is no delay or polling.

Reminder scheduling/cancellation happens before the preference commit, preserving the
existing permission and compensation workflow. A platform error leaves preferences
unchanged; if replacement and platform restoration both fail, only the reminder-enabled
flag is disabled. If persistence fails after scheduling, restoration is attempted and
the original persistence error is retained. A later reconciliation can repair a failed
platform restoration; preferences and OS notification state cannot share a transaction.
Reconciliation patches only its own flag, so unrelated settings survive even a direct
repository write during a slow effect. Generic language updates also reconcile an active
reminder. This does not change reminder planning horizon (R06).

Device language remains the existing device-local override, separate from account sync.
Only an explicit language update writes that override. Its writes have a device-local
FIFO, so an unrelated preference or a slow old device write cannot republish a previous
language. The existing account-row/device-language two-store workflow is not a distributed
transaction; a device-store I/O failure is reported, and retry/reload is required. Account
preference data is retained. This phase does not add a two-database commit protocol.

Owner-specific repositories are captured when an application is created. Queued commands
and delayed side effects check the storage revision before proceeding. Writes also check
inside the SQLite transaction before commit. Existing facade guards suppress late results
after switching owner. An already-issued atomic database operation can finish in its
original owner; it cannot redirect to the newly selected database. New owner state never
subscribes to the former owner's cache. Sync/restore continue using their existing
transaction, conflict and refresh rules; pending local settings are preserved as conflicts,
not overwritten by a remote full snapshot.

## Connection transactions

`OpSqliteDatabase` coordinates statements and transactions per connection. A transaction
uses `BEGIN IMMEDIATE`, its supplied transaction handle, COMMIT, and ROLLBACK on failure.
Ordinary statements wait outside the callback. This prevents a session INSERT or settings
write from joining another awaited transaction and reporting success before its rollback.
It also avoids the installed web adapter's unsupported transaction rollback method.
An escaped transaction handle rejects after callback completion. If rollback itself fails,
the connection is invalidated; reopen the application instead of continuing uncertain work.
The connection queue has the same 128-task bound. Transaction callbacks must exclusively
use the supplied handle; reacquiring the wrapper from inside the callback is unsupported.
Current production callbacks follow this rule. No network/platform effect is placed inside
these transactions. Separate connections rely on SQLite locking; lock/busy failures are
failures, never successful writes, and can be retried by the caller.

## Study sessions

The scope is one owner database, shared by Home, Study, deck details, application use cases
and repositories. Guest/account databases remain independent. `in-progress` alone is active
and resumable; `not-started` is not active; `completed` and `cancelled` are historical terminal
states. An interrupted application leaves its in-progress record resumable. Empty queues
create completed records as before.

Schema-9 BEFORE INSERT and BEFORE UPDATE triggers reject any new transition that would
introduce another in-progress session. The trigger executes inside SQLite's write statement
and protects independent connections as well as repository callers. A partial unique index
was deliberately avoided: it cannot be installed over legacy duplicates without selecting
and terminating unfinished work. The triggers permit existing duplicate sessions to be
inspected and explicitly cancelled without automatic reconciliation.

First successful creation wins. Repeated compatible starts return that session with its
original order, queues and progress. Compatible means the same all-decks/specific-deck scope,
the same deck when applicable, and the same review-again source session. A different requested
order does not rebuild an active queue. Incompatible starts return the existing conflict and
resume/leave workflow. A creation race re-reads the active session after a controlled conflict;
it never overwrites or merges queues. Concurrent hook instances opening the same result
navigate once within their overlapping request group. A later explicit resume can navigate.

Start/resume overlapping completion or cancellation can return the snapshot read before the
terminal transition. Opening the session reads its current durable status. No claim is made
that another command cannot cancel a session after it was read. Later starts can create a
new session after the old one becomes terminal. Existing compare-and-set session updates
and the atomic answer/event/state/outbox transaction are preserved: a cancelled or already
advanced session rejects a stale answer without adding a review event.

## Existing duplicate recovery

No survivor can be inferred safely from timestamps or queue positions alone. Migration
preserves every duplicate verbatim. `getActiveStudySession` reports a controlled conflict
instead of hiding one; `listActiveStudySessions` exposes all retained IDs/scopes/positions.
New creation is blocked while any incompatible/ambiguous active set exists.

Recovery is an explicit support/user choice, not an automatic migration:

1. Preserve an owner-scoped copy of the database and its journal/WAL files. Test on an isolated
   copy. Record session IDs, scopes, timestamps, positions, queues and attached event IDs.
2. Use `listActiveStudySessions` and `getStudySession(id)` to inspect every unfinished record.
   Let the user choose which unfinished queue to resume. Do not infer intent or merge queues.
3. For each session the user explicitly chooses to leave, call the existing
   `cancelStudySession(id)` against the correct owner. This retains answered positions,
   session records, review events, review state and outbox operations.
4. Re-read the inventory. Once one remains, an ordinary compatible start resumes it. If the
   user elects to leave all, a new start builds the ordinary due queue. Learning progress is
   never reset. Ambiguous sessions can instead remain preserved and blocked pending a decision.

The new inventory is an application/support API, not a new in-app recovery wizard. No repair
against real user data was performed. Migration rollback/interruption tests use synthetic
databases exclusively. Keep schema 9 on binary rollback; do not drop the triggers or alter
history to restore the old race. Older binaries can hit the trigger and show a persistence
error instead of the improved resume behavior; upgrade them for the corrected workflow.

SQL.js tests establish application logic and SQLite statement behavior. Worker tests also
exercise file-backed SQLite connections and process interruption. They are not certification
of native OP SQLite JSI, mobile OS lifecycle, OPFS multi-tab locking or a physical device.

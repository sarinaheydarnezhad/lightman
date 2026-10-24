# Guest data at login and empty logout

## Login decision

Guest data is handled at login; Settings has no separate guest-data transfer button.

After verified password, OTP, Google or email authentication, account storage is selected before credentials are saved. The root boundary hides account screens until authentication finishes and a blocking guest-data modal completes. The navigator remains mounted behind the modal so finishing cannot race an unmounted root navigator.

The preview immediately performs strict account synchronization and checks owned inventory and review progress against the server. A loading/network error is never interpreted as an empty account.

- **No guest learning data:** open the synchronized account automatically.
- **Guest data exists:** explicitly choose **Transfer my data to account** or **Discard guest data**. Existing account data is never replaced.
- **Discard:** a second destructive confirmation explains that all guest decks, cards, history and study sessions will be deleted permanently. Cancel preserves them. Confirm removes guest learning data and its outbox, without changing account/server records.
- **Transfer:** add separate account-owned copies, synchronize and verify them, then clear guest storage and open the account. Guest deletion cannot happen before verified completion.
- **Archived-only guest data:** still requires an explicit discard decision; it is not silently deleted as an empty dataset.
- **Pending transfer:** resume the same approved snapshot/IDs. Discard is refused because copies may already be uploaded. A completed transfer retries cleanup instead of staging another copy.
- **Failures:** preserve recoverable source/copies, remain gated, and provide retry. A separately confirmed logout without backup remains available if initial sync cannot finish.

An interrupted login with guest data reopens the decision on restart. Existing account-only sessions retain offline restoration; login itself requires online synchronization. Login language is captured before switching account settings and remains fixed during preview, including English/Persian labels, counts and recovery messages.

## Transfer coverage

Transfer copies active Leitner decks, active cards, complete immutable review history and review progress reproducible under the backend UTC-day rules. Relationships, card text/examples, box, due date, last review, successes/streaks and review totals are verified. Distinct source IDs remain distinct even when names/text match.

Archived records, settings, study sessions, other scheduler metadata and original server creation timestamps are not transferred. The modal explains these limits before consent. Successful transfer clears guest learning storage, including archived data and sessions; device preferences remain. Unsupported active data or incomplete history blocks copying rather than silently resetting progress.

## Safety and retry

The existing SyncEngine, SyncStore, owner-authenticated reads, sync feed, entity versions, conflict responses and server idempotency receipts are reused. No new migration endpoint or sync transport is added.

1. Compare the authenticated identity against the selected account database. Require unowned guest storage.
2. Synchronize the account and cross-check pulled inventory/progress before consent.
3. Stage mapped copies and frozen operation IDs in one account transaction using the existing local `guest_transfers` journal.
4. Push/drain the queue and fully paginate pull. Verify acknowledgements, cursor coverage, owned copies and review progress.
5. Reverify completed receipts and the unchanged guest snapshot before atomically deleting guest learning data. Rotate the guest device identity so later guest work cannot reuse a previous journal.

The whole transfer is not a single server transaction. Interrupted uploads may leave partial copies. Retrying preserves the same IDs and receipts; conflicting/discarded operations are not automatically rebased. Guest cleanup is separate, transactional and retryable after completion. Changes to the source invalidate the preview rather than deleting new active data. Do not edit/study partial account copies until verification finishes.

Current trusted plan limits apply to the combined account/guest inventory. No client-side entitlement bypass or automatic replacement/archive is used. Missing backend sync-feed data, unsupported progress or ownership mismatches fail closed.

## Logout

Explicit logout immediately locks account access, clears guest learning data and opens an empty guest space, even offline. Private account databases and unsynced account queues remain isolated for their original owner's next verified login; server learning data is not deleted.

Guest reset validates ownership, removes learning/history/session/outbox/cache records in one SQLite transaction, restores the review-history immutability trigger, and keeps preferences. A durable reset intent ensures an interrupted/failed logout reset is retried before guest storage is exposed on restart. Storage errors remain locked instead of revealing old data. This is application-level deletion/isolation, not forensic secure erasure.

The existing backup/revocation and signed-out credential-barrier guarantees remain unchanged; see [secure logout](secure-logout.md).

## Verification

Automated coverage includes additive copies and stable-ID retries, source-change/ownership checks, discard confirmation, quota/compatibility blockers, pending/completed transfer recovery, localized modal decisions, empty account auto-entry, failed cleanup rollback, immutable-trigger restoration, durable reset intent after restart, offline logout, account/server preservation and late-response isolation. Native-device and live-service checks are not implied.

# Synchronization review replay

Pull pages retain the existing maximum of 100 changes and bounded payload contract. All
checkpoint installation, ordered record validation/insertion, review projection writes and
cursor advancement remain in one database transaction. No network operation occurs inside it.

`SyncStore.applyPage` collects distinct affected review card IDs, including checkpoint cards.
It reconstructs each projection once after all records are persisted and before updating the
cursor. A checkpoint appearing alongside its raw events no longer causes repeated empty
reconstructions. The set is local to the transaction and is discarded on success or failure.

This boundary preserves the former semantics:

- Checkpoints install before records, with the same watermark, progress and ambiguity guards.
- A local baseline captures the saved projection and covered IDs before its first incoming
  event. It is never synthesized from an unprojected batch.
- Every event still undergoes identity, calendar and storage validation in feed order.
  Duplicate identities retain their original version and immutable contents.
- Mutable review-state snapshots ignore a card with events; they do not consume a partially
  replayed projection. Card content/archive operations do not consume review projections.
  Deck scheduler eligibility checks retained cards/history, independently of review counters.
- If a retained card has neither a baseline nor a projection, the first event is replayed
  immediately. This preserves the original initialization/capture boundary for subsequent
  events, including the exact covered IDs. Subsequent events can be grouped normally.
- Replay still uses ascending server version, followed by unversioned local events in rowid
  order. Timestamps and current device timezone never replace that ordering.
- Accepted baselines, authoritative server checkpoints, immutable calendar metadata and
  ambiguous historical evidence retain their existing meaning. No optimization checkpoints,
  history compaction, guessed metadata or cache are introduced.

For a normal page with `m` events affecting `k` cards, reconstruction calls and projection
writes fall from `m` (plus checkpoint reconstructions) to `k`. Event validation/insertion
remains per event. Replay loads the necessary suffix for one affected card at a time; no
all-account history read, multi-card IN list or bind-limit dependency is added. The temporary
ID set is bounded by distinct page/checkpoint cards from the existing server contract.

This is not a global linear-time claim. With an accepted checkpoint at watermark `W`, the
existing SQL excludes versions through `W` and covered local IDs; only the remaining suffix
is processed. Current backend pulls provide such authoritative checkpoints under the sync
head lock. The client does not promote its mutable projection to a new authoritative baseline.
Without a newer checkpoint, repeated pages reconstruct growing suffixes: for one card with
`N` events in pages of `B`, replay input is approximately `N²/(2B) + N/2` rows instead of
`N(N+1)/2`. Sorting, baseline membership and SQL join costs remain. Late or ambiguous history
always follows the established deterministic reconstruction rather than an unsafe append
shortcut. Large individual uncheckpointed histories can still block the JavaScript thread.

The existing history/card-ID and event/version primary-key indexes serve these queries.
Ordering can require a temporary SQLite sort; grouping removes repeated sorts without adding
a speculative index. Schema 9, migrations 1–9, protocol/capabilities, receipts, outbox IDs,
backup format, operation budgets and 12,000 ms HTTP deadlines are unchanged.

PostCommitDatabase emits one hint after a committed page. Remote application remains marked
inside the transaction so it cannot fabricate local outbox operations. The existing coordinator
checks the durable outbox and coalesces hints; an empty remote commit does not cause HTTP
polling. Owner-specific captured stores remain the persistence boundary: issued atomic work
may finish only in its original database; existing revision/epoch checks suppress stale UI
publication after account switching or logout.

`review-replay-performance.test.ts` enforces query/row/write counts, while equivalence and
integrity suites compare the eager reference ordering and force failure/ownership boundaries.
Expensive synthetic measurements live outside the repositories in
`D:\Lerona\remediation-phase-05`, using SQL.js rather than claiming native OP SQLite, OPFS
browser responsiveness or SQL Server runtime performance. No migration or backend rollout
is required for this frontend optimization. Rolling back the frontend reintroduces repeated
work but requires no data rollback; preserve history, checkpoints and schema integrity guards.

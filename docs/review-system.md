# Review systems

Study use cases call the generic `ReviewEngine`. It selects a registered `Scheduler`
using the deck's persisted `reviewSystem` ID. The production registry currently
contains `LeitnerScheduler` and `Sm2Scheduler`; no FSRS implementation or unavailable UI option
is included. Missing selections on existing decks default to `leitner`. Unknown
selections fail explicitly rather than silently running a different algorithm.

The scheduler owns initial state, review transitions and next due dates, due-card
selection and queue priority, current-state descriptions, event construction, and
distribution sections. Presentation renders scheduler-provided labels and counts,
not a universal set of boxes. Analytics groups current distributions by scheduler;
retention, activity, reviewed-card counts, and streaks still use actual review events.
The existing box-distribution API remains available for Leitner compatibility.

## Adding a scheduler later

Implement `Scheduler` and register it through `createReviewEngine`, then inject
that engine at the application composition boundary. Deck settings automatically
list registered implementations. Study, card creation, distribution, analytics,
and navigation use the same contracts. Scheduler-specific memory belongs in
`CardReviewState.schedulerState.data`, with an identifying scheduler ID and state
key. Generic review events carry scheduler IDs and previous/new state keys.
Additional algorithms must not be implemented by reinterpreting Leitner boxes.

Leitner's optional legacy box fields remain intact for existing states and history.
SQLite's additive version-four migration stores generic scheduler metadata in JSON
alongside the legacy columns, and stores the deck selection and session workflow.
Those legacy SQL columns are compatibility projections, not generic scheduler state.
No card progress, due dates, review counters, or history are reset. Switching a
populated deck to a different scheduler is rejected until an explicit state-conversion
policy exists; changing the same selection never changes card progress.

## Session results and Review again

The existing original-session behavior is preserved: each initial failure receives
at most one automatic retry. The summary shows unique cards studied, successful
and failed first-pass recalls, retry count, and duration. First-pass outcomes are
labelled separately because automatic retries create additional real review events.

Every card failed at least once is saved in the session's unique `missedQueue`, in
first-failure order. A completed original session with missed cards offers
**Review again**. This creates a new persisted session from that completed list,
even when a subsequently recalled card is no longer due. Archived cards and decks
are excluded. Opening the summary, creating the queue, revealing an answer, and
pressing Review again never record a review or alter scheduling state.

A review-again session presents each missed card once, records results only when
answered, and shows the normal summary. Its `sourceSessionId` prevents recursive
retry sessions and automatic retry queues. The user can finish or cancel normally.
Legacy completed sessions without workflow metadata derive missed cards from their
existing saved failure/retry queue.

SQLite commits each actual study answer's event, updated scheduling state, and
session advancement in one transaction. Failed commits roll all three back, so
retrying a failed save cannot create duplicate review history.

## Verification

Scheduler contract and Leitner parity tests live in `review-engine.test.ts`; selection
and missed-card workflows are covered by study application tests. Distribution,
summary, deck settings, and Review again are covered by presentation/navigation tests.
`scheduler-persistence.test.ts` exercises real in-memory SQLite upgrades, repository
reloads, generic metadata, and atomic rollbacks using Node's built-in SQLite module
when available (these integration tests skip on Node versions without it).

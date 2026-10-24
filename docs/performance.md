# Mobile network load and cache policy

## Shared reads

Each `CloudClient` instance owns a small in-memory request cache with fixed keys. Concurrent callers share one pending request. Failed requests are evicted immediately, and invalidation prevents a late response from repopulating an old cache entry.

| Read                                   | Completed-response lifetime                   |
| -------------------------------------- | --------------------------------------------- |
| Public plan catalog                    | 5 minutes                                     |
| Backup metadata overview               | 15 seconds                                    |
| Profile, subscription and entitlements | None; in-flight coalescing only               |
| Study authorization                    | Never cached or coalesced with metadata reads |

`planCatalog(true)` and `backupStatus(true)` bypass completed metadata entries while still sharing an already pending read. Backup creation invalidates backup status before and after the request. Logout/session invalidation clears the cache and aborts requests; successful sign-in also clears it. Backup cache hits still require a local session and are protected by the session epoch. Metadata is never evidence of server-side authorization.

## Background refresh

Account entitlement monitoring uses a recursive, jittered 4–5 minute timeout rather than synchronized one-minute intervals. It pauses when the app is inactive/backgrounded or a network event reports disconnection, and resumes on foreground/reconnect. Unmount removes listeners and timers. Initial/foreground/network events share a refresh; successful confirmations suppress background repeats for one minute. Background failures back off from 30 seconds to five minutes. Sync-driven metadata updates use the same stale check rather than refetching for each incoming page.

Explicit access checks still refresh online. Study waits for an in-flight metadata refresh and then performs its own study authorization request. Background throttling does not extend the existing provisional entitlement lease (at most five minutes and bounded by subscription expiry), and cached responses cannot grant indefinite paid access. Server quotas and session checks are never bypassed.

## Sync retries

Sync retains a single in-flight pass. Transient failures use exponential backoff with jitter (normally 0.5–60 seconds). HTTP Retry-After supports seconds and HTTP dates; server cooldown takes precedence, with an additional 0–25% jitter to avoid a synchronized retry wave. Parsed server cooldowns are bounded to 24 hours before jitter. Overload during token refresh also preserves this cooldown.

Foreground/reconnect notifications cannot bypass a pending background retry deadline; automatic sync does not run while inactive/backgrounded. Stop/logout clears retry timers; logout also resets cooldown/failure state for the next account. Existing retry-count limits remain. A user-requested sync is still explicit and can retry immediately; sustained abuse and aggregate concurrency are controlled by server admission/gateway limits.

## Validation

Focused Jest coverage includes simultaneous consumers, exact TTL expiry, forced refresh, failed-read eviction, late-result invalidation, logout safety, background event storms, study authorization isolation, polling cleanup and Retry-After cooldown/jitter. Backend regression tests verify the associated SQL reductions, index migration and admission limit. Before production scaling, perform mixed-workload load tests against SQL Server and tune the per-instance API request ceiling; no production capacity claim follows from unit tests.

# Final QA — source-supported visual refinement

2026-11-15. Authority D-30. Baseline frontend `5c51b346ea38cca37896588c493ccc72a12dbfb2`, initially clean. No commit or deployment. Backend baseline is unchanged/clean. The previous feedback, localization, accessibility and recovery implementation is retained.

## Implemented and reviewed

Source-supported visual work is complete: shared surface/action/gutter hierarchy; Settings grouping/metadata; subscription status/radio choices/eligibility; structured logout/recovery; Home hierarchy/chevrons with no fixed decorative progress ring; content navigation, analytics, auth/speech selection and backup type; portal theme-variable scope and scrollable review information. Details, evidence categories and regression risks are in [VISUAL_REFINEMENT_REPORT.md](VISUAL_REFINEMENT_REPORT.md).

Seven current supplied JPGs and the approved PDF were reviewed against source. Source review includes both themes and UI languages, selected/disabled/loading/error/empty/recovery branches, wrapping/scroll support, unchanged bidi price formatting, canonical font/palette values, chronological charts and physical study outcomes. No business/auth/payment/security/algorithm/storage contract, dependency or backend behavior changed. Eight translation entries add only four bilingual logout section headings.

## Executed verification

| Check                             | Current result                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Intermediate typecheck            | Passed, exit 0                                                                                              |
| Intermediate lint                 | Passed, exit 0; one pre-existing unused `Sm2Scheduler` import warning                                       |
| Focused regression                | 6/6 suites, 113/113 tests passed, exit 0; existing 20-second timeout option, no skipped/weakened assertions |
| Full final-source Jest            | Running; not yet a final pass                                                                               |
| Final typecheck/lint/architecture | Queued after full Jest                                                                                      |
| Full/scoped formatting            | Final check pending; earlier full traversal failed on restricted `.secrets`                                 |
| Git diff validation               | Intermediate `git diff --check` passed; final check pending                                                 |

The focused run precedes the last bounded feedback/backup typography and deck-action ordering adjustments; the final full run covers the final source. Exact final commands/timing/exit codes are saved in `evidence/visual-qa/checks.json`; source hashes in `final-source.json`, complete local logs in `.tools/visual-refinement-final-*.log`. No earlier implementation pass is substituted for current results. Only obsolete presentation assertions changed; exact prices/bidi, selection, no premature purchase, navigation, busy, logout, credentials, queue and recovery checks remain.

An earlier completed broad run reported 143/145 suites and 1516/1520 tests passed (exit 1, 1214.134 seconds). Two analytics assertions still required the old font hierarchy; two transfer assertions observed no export/share call after simulated presses. The unchanged transfer assertions both passed in isolation (2 selected, 5 intentionally not selected). The tests now explicitly wait for enabled action controls and press their accessible button roles, retaining the exact CSV guidance, no-partial-save and sharing/format assertions and adding an explicit CSV export-call assertion. Analytics still checks bundled font faces, with the intended supporting streak/stronger reviewed-today hierarchy. The follow-up passed **9/9 tests, 2/2 suites**, exit 0. No production operation or safeguard was altered to address these failures. The broad run, isolated diagnostic and follow-up remain recorded separately; they do not substitute for the restarted final full run.

One earlier broad attempt was interrupted before completion to update obsolete settings metadata/divider and duplicate-title assertions. After the completed failed broad run, its remaining lint process was stopped to restart the entire final verification sequence after the two bounded test follow-ups. Interrupted commands are not claimed as passing. A supplementary Tailwind compilation passed with an outdated Browserslist database warning; no database/dependency update was applied.

## Runtime acceptance remains pending

The owner-provided web URL is **http://localhost:8081**; no server was launched in D-30. Earlier web delivery/browser failures remain historical execution context. The latest instruction removes runtime reproduction as a prerequisite for these reversible changes. No further browser/ADB investigation was performed. No new app capture or before/after screenshot was produced or fabricated.

Actual rendered screens inspected in D-30: **none**. All 360/390/430px × light/dark × Persian/English cells, larger text, scrolling, keyboard and loading/empty/error/success/recovery composition require manual/runtime review. Source support does not establish optical alignment, effective contrast, eye flow, target geometry, focus or accessibility. Supplied images may be earlier builds and are not relabeled as current evidence.

V03/V04/V05 are improved at source level, not visually accepted. V08 has width/scroll support but needs actual reachability checks. V06 has a bounded correction that reapplies current NativeWind variables at portals; the historical dark-modal problem has **not** been reproduced or closed. Check computed foreground/backgrounds, overlays, theme changes, queue/focus/retry and Android modal rendering.

## Manual and native handoff

Use [MANUAL_VISUAL_REVIEW_CHECKLIST.md](MANUAL_VISUAL_REVIEW_CHECKLIST.md) to inspect the resulting Android application. Myket purchases/handoff/recovery, Android notifications, native SQLite/SecureStore, Android accessibility/TalkBack/text/display scaling, native Back/keyboard/gestures and restart/interruption remain separately unverified with safe fixtures. No unsupported native feature was enabled on web and no live account, SMS, payment, backup, sync or data mutation was used for evidence.

Historical OPFS/bootstrap, SQL Server/backend, external spreadsheet, key-ring/rollback/retention and operational gates remain open in their existing registers. The intended handoff is implementation ready for manual review after final checks, **not release readiness**.

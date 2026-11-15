# Integrated frontend implementation

Completed source-supported work on 2026-11-15 under owner authorization D-28. Stopped at the **final QA/release-review boundary**, with documented limitations. Evidence-dependent whole-screen visual/native work remains blocked, not accepted or silently closed. No release-readiness claim. Backend, business rules, security/payment contracts, learning algorithms and dependencies remain outside changes. No commits or deployment.

## Readiness and evidence

Starting frontend HEAD `067e60cbfe38e78d06f1a084f78cfc9fed5c0423`; existing untracked refinement documents preserved. Backend clean at `2fd5889fc4e4795f9d587c744fcbe5dd28c5e7ea`. ADB version repeats `Cannot mkdir '\.android': Permission denied`, exit -1073740791. Workspace-only process-local ANDROID_USER_HOME and ANDROID_SDK_HOME diagnostics failed identically; no global environment/permission change. No enumeration, device interaction, installation or data clearing. A fresh hidden, headless Edge profile with normal security flags failed to expose a CDP endpoint within 10 seconds; no app was launched or rendered. See `evidence/browser-readiness.json`. Its generated isolated profile was moved into ignored `.tools`, not retained among review artifacts. Runtime-dependent optical/layout hypotheses and the historical dark-web-modal gate are deferred until reproduction is possible. Source-confirmed task hierarchy/feedback/accessibility corrections proceed independently; no rendered improvement is claimed.

Read the five-page approved PDF and three supplied JPGs again. Preserve purple, charcoal, Vazirmatn, contextual competence/sincerity/excitement and truthful recovery copy. No eye-tracking or user study was performed.

A second bounded headless software-rendering probe reached the CDP connection but `Browser.getVersion` timed out. `evidence/browser-software-readiness.json` records `rendered=false` and `applicationLaunched=false`. Neither probe produced application screenshots. No browser security/sandbox bypass was used.

## Baseline test diagnosis

Executed original two suites, unchanged assertions: `pnpm.cmd test --runTestsByPath src/features/decks/presentation/card-form.vocabulary.test.tsx src/features/auth/presentation/guest-data-screen.test.tsx --silent`: exit 1, 36 passed/1 failed of 37. Account recovery passed; card quota exceeded the existing 5000ms timeout. Diagnostic targeted run with `--testNamePattern 'card quota|previously failed' --testTimeout=20000 --silent`: exit 0, all three selected original assertions passed, 34 intentionally not selected. Quota message and English recovery choices are present under this run. Current evidence supports test execution timing sensitivity; it does not establish a reproducible product defect or justify changing expected safety behavior. Original historical missing-text failures remain recorded, not silently deleted. No assertions were weakened or expectations changed for these two diagnoses.

## Incremental verification

- Foundation: five suites (FeedbackNotice, primitives, ErrorState, unchanged FeedbackModal, architecture), 26/26 tests passed, exit 0; command uses `--runTestsByPath ... --silent --testTimeout=20000`. Test timeout increase is an execution option recorded above, not a changed product assertion.
- Critical recovery/localization: 6 suites, 84/84 passed, exit 0. Covers guest/settings recovery, sync/conflicts, verified backup versus refresh failure, preserved import rows and localization contracts.
- Initial feature integration: 15 suites, 151/154 passed, exit 1. Three remaining old presentation assertions (guest subscription filled style in two languages, raw unknown file error) were updated to the approved hierarchy/safe error copy while retaining navigation and no-save assertions.
- Follow-up: 4 suites, 51/51 passed, exit 0, including new late-account-response and overlapping-sync tests.
- Speech/auth follow-up: 2 suites, 20/20 passed, exit 0; updated approved copy and verified speech failure clears on card change while stopping old speech.
- First broad run: 145 suites, 141 passed/4 failed; 1516/1520 tests passed, 0 skipped/pending, exit 1, 1058.817 seconds. Four failures expected obsolete study-start, speech-capability, Persian reset and notification wording. Updated to actual approved copy, retaining behavioral assertions, exact Persian numerals/isolation and notification counts. No production-service or real notification call.
- Final broad run: **145/145 suites and 1520/1520 tests passed**, exit 0; 0 skipped/pending/todo, 0 snapshots; Jest reported 1479.86 seconds.
- Final speech-state follow-up: 2 suites, 27/27 passed, exit 0. Lint rejected the initial effect-driven stale-error reset; replaced it with guarded task-content state reset, then verified speech/card changes and scoped lint without disabling a rule.
- Final copy/recovery follow-up: 3 suites, 32/32 passed, exit 0. Kept optional example fields accurate and made incomplete-logout text compatible with a separately verified backup receipt; explicit no-backup consent remains required. These bounded final adjustments were checked after the broad run started; the broad pass is not misrepresented as native/exact-artifact verification.
- Final repository typecheck and lint: exits 0; lint has 0 errors and the one pre-existing unused Sm2Scheduler warning. Full `pnpm.cmd format:check` exits 2 because directory expansion hits EPERM on `.secrets`; this is not a formatting pass. Owned-file formatting result is retained in `evidence/scoped-format.json` after the explicit-path check. `git diff --check` passes.

Tests use `pnpm.cmd test` (existing Jest runInBand) with `--silent --testTimeout=20000 --json --outputFile=.tools/<recorded-name>-results.json`; scoped runs add `--runTestsByPath` with the named suites. `evidence/implementation-checks.json` retains exact arguments/counts/exit codes and sanitized per-suite outcomes. `--silent` suppresses console output, so a passing silent run does not mean there are no React/native-mock console warnings; earlier act/VirtualizedList/mock-reminder diagnostics remain recorded in the baseline. No test assertions were weakened to fix the two original failures. One intermediate command named a nonexistent appearance-screen test file; this was an execution-path error, corrected using the actual test inventory, not an application failure.

## Implementation packages

- Foundations: retained tokens/palette/font/spacing architecture. Logical button-icon placement, explicit disabled setting semantics, consequence-selectable confirmation action, inline localized field errors and first-invalid field focus. Localized component showcase adds contextual recovery and a clearly labeled non-destructive confirmation example. Technical token/variant identifiers remain developer-facing names.
- Feedback: introduced small task-owned persistent FeedbackNotice with no timeout/queue/focus theft. ErrorState retains explanation and retry in place. The existing global logout/credential modal queue and its event/dismiss/retained-retry semantics remain unchanged. Actual confirmations/name/guest gates remain. The lifecycle register enumerates current producers and required QA; no blanket AppError-to-surface mapping or new snackbar framework.

## Feature implementation and rationale

| Feature / package                         | Implemented change and rationale                                                                                                                                                                                                                                                             | Preserved contract / evidence limit                                                                                                                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Settings / appearance / language / speech | Guest sign-in remains primary; subscription navigation becomes secondary. Explicit disabled switch/row state. Typed bilingual setting/reconciliation failures; selection itself communicates routine success.                                                                                | Existing use cases/repositories and device/account persistence unchanged; native preference/voice/permission behavior unverified.                                                                                              |
| Home and navigation                       | Persistent localized resource and study-start recovery; existing Resume action retained. Supportive accurate copy.                                                                                                                                                                           | Four visible tabs, hidden Study route, real metrics and navigation remain. No hero/artwork/spacing change based on unrendered hypothesis.                                                                                      |
| Deck and card management                  | Field errors beside input, focus first required card/deck field, actionable deck-name bounds, preserved save/quota errors and unsaved values. Restriction screen keeps plans/browse available and scrolls.                                                                                   | Exact content/validation limits/CRUD operations unchanged. Save confirmation only after existing successful create; no auto lookup or submit.                                                                                  |
| Study / review                            | Typed contextual load/save/end/review-again errors; removed duplicate action-error announcement. Copy now accurately states once-per-session and explicit Review again.                                                                                                                      | Physical left failure/right success, reveal/buttons, accepted-answer atomicity, counters/history/scheduling and existing results/navigation untouched. Outcome-label alternatives deferred.                                    |
| Analytics                                 | Persistent localized read recovery and nonjudgmental copy.                                                                                                                                                                                                                                   | Real metrics/distribution/chronological LTR charts preserved; no new metric/progress/achievement claim or chart re-composition.                                                                                                |
| Authentication / account                  | Stage feedback in context; one success Continue action; name errors inline, save errors preserve input.                                                                                                                                                                                      | Proof purposes/expiry/cooldown/password rules, token binding and required name/guest gates untouched. Unknown diagnostics not displayed as the user's explanation.                                                             |
| Guest data                                | Preview errors/blockers/settings-conflict choices remain visible in gate. Safe bilingual known-error mapping in both languages; explicit discard remains separate.                                                                                                                           | Existing IDs/journal/preview, additive copy, completion/cleanup, blockers, mounted/submitting guards and irreversible discard/logout confirmations unchanged. No backend or data operation performed.                          |
| Subscriptions / payments                  | Duration selection retains check/purple border on secondary surface; filled purchase action remains distinct. Persistent pending/recovery/restriction/result copy with context-appropriate tone. Removed false no-purchase claim from failed status read.                                    | Server catalog/eligibility/verification, original account, do-not-pay-again, Myket prerequisite and one-hour duration recovery retained. No purchase/installation attempted.                                                   |
| Cloud sync                                | Failed-operation recovery and conflict choices visible together, including after failed resolution. Meaningful pending count replaces routine account ID/cursor display. View state keyed by scope and ignores unmounted responses; synchronous pending guard prevents duplicate UI actions. | Core UUID/version/outbox/retry/epoch/immutable-history semantics unchanged. Explicit server/local choice still uses original operationId. Session uncertainty not mislabeled as expiry; definite 401 maps to sign-in guidance. |
| Backup / logout                           | Verified backup text can coexist with independent metadata-read error. Busy refresh disabled. Logout confirmation now includes actual deletion/privacy/coverage/retention consequences before existing actions. Credential receipt queue retained.                                           | No false backup/read equivalence, restore feature, credential-clear acknowledgement or no-backup consent bypass. Existing signOut(backup), backup validation/ownership/expiry and receipt behavior preserved.                  |
| Import / export                           | Bilingual format help, recognized errors/issues and row/note locations; unrecognized diagnostics use safe context text. Summary/partial result is a scrollable receipt with Close; failed approval keeps edits.                                                                              | Front/Back/extra columns, CSV/XLSX safeguards, file limits, parser/adapters, user content and confirm/cancel/finalized guards unchanged. Native picker/share and external spreadsheet apps unverified.                         |
| Reminders / vocabulary / pronunciation    | Nonmodal capability/help/retry feedback, respectful Persian notification copy retaining counts/isolation, local voice guidance. Speech error clears when card text/language changes.                                                                                                         | Reminder horizon/counts/permissions/scope/delivery rules, existing one-retry dictionary behavior, manual entry and API disclosure retained. No real notification/speech/provider operation tested.                             |

## Findings and design decisions

Resolved at source level: W01 active contextual Persian voice, W02 localized field hint, W03 known contextual error paths, W04 overbroad learning promise, W05 benefit language, W07 sign-in purchase explanation, W10 transfer help, W11 missing Persian keys and W12 raw cloud diagnostics. W06 retains all payment uncertainty/recovery terms. V01/V02 receive bounded source-confirmed action-role corrections; V05 logical button-icon side; V07 confirmation role support; A01/A02 semantics corrected. This does not assert rendered acceptance for any finding.

V03/V04/V06/V08 and wider whole-screen hierarchy/optical hypotheses remain dependent on rendering and native interaction. Retain source/image observations without claiming causal proof of the owner's eye-flow report. No speculative palette/typography/border/hero rewrite was made. W08 legacy/unreachable copy is retained and identified rather than mechanically rewritten/deleted; W09 outcome terminology awaits domain clarification. Accurate natural existing copy is retained. Active factual errors discovered during contextual review (automatic retries, sync as backup, session-only persistence, missing Persian restore caveat) are corrected without changing behavior.

## Editorial and feedback evidence

Current dictionaries contain 788 English keys and matching Persian coverage. Exact diff evidence records 172 existing-copy edits and 140 added translations (312 language/key changes), retaining the remaining accurate/legacy copy. The lifecycle ledger contains 156 direct component/announcement/live-region/OS-reminder entries, including 42 FeedbackNotice instances and one retained global FeedbackModal. These counts describe source coverage, not rendered/linguistic certification.

`evidence/editorial-changes.json` records exact original-HEAD/current values, additions and source revision. `evidence/feedback-lifecycle.json` indexes direct producers with file/line/trigger/profile; FEEDBACK_LIFECYCLE.md defines timing, persistence, dismissal, scope/deduplication, automatic recovery, actions and announcements per family. `evidence/implementation-source-index.json` hashes non-test sources; `evidence/changed-files.json` records the final review file list.

Before/after rendered evidence is unavailable. The supplied JPGs were re-inspected as problem evidence, not current-build captures or targets. Code/semantic and editorial before/after evidence is available. An intermediate PowerShell pipeline corrupted Persian edits; this was detected, replaced from UTF-8 files and checked by dictionary completeness/placeholder/corruption tests before acceptance. No corrupted text is intentionally retained as current copy.

## Protected-contract verification

Production `src/core`, domain/application/data layers, payment orchestration, app/signing/build configuration and dependencies remain unchanged; the notification test only updates exact approved wording while retaining counts and isolation. Backend clean. Architecture tests and the existing frontend suites exercise scope separation, auth proofs, Myket uncertainty/idempotence, guest copy/discard/journal, sync acknowledgements/replay, backup verification, secure logout, transfer exact content/safety, scheduler vectors and atomic study persistence. New cloud tests cover late owner response and duplicate action guards. These are mocked/in-memory/local-fixture results, not SQL Server/native/provider verification. Backend suites were not executed; required later suites remain listed in the master plan.

## Remaining risks and final QA requirements

1. Obtain supported ADB in the agent/host environment, record authorized device model/OS and installed-artifact provenance. Version 1.0.0/code 5 alone is insufficient. No current-source native screenshot or installed-build claim.
2. Use separately approved synthetic guest/account data and isolated OTP/Myket/cloud/backup arrangements. Installing/replacing a build, device clearing, system permissions and production operations still need separate explicit authority.
3. Validate whole-screen hierarchy, eye flow, optical alignment, spacing, density, action visibility and all relevant states in light/fa, light/en, dark/fa and dark/en. Validate broad visual hypotheses before implementing their deferred changes. Retain purple/charcoal/Vazirmatn.
4. Execute TalkBack, focus entry/restoration, announcements once, targets, effective contrast, keyboard/Back, reduced motion, gesture alternatives and default/large/max font/display settings on the exact artifact. Nonmodal notices may wrap/change scroll positions; actual focus and reachability are not proven by tests.
5. Recheck pending/unknown payment recovery, failed settings resolution, guest pending/completed cleanup, credential failure after Close, backup success plus read failure, interrupted study, scope switch and file/share cancellation in safe native fixtures. No timer or dismissed notice may be the only recovery path.
6. Preserve all historical gates: OPFS/bootstrap, retained dark-web modal, browser GPU/CDP limitations, EF/PKCS graph, native SQLite/JSI/reminders, SQL Server races/lifecycle, Excel/LibreOffice, key-ring/rollback, retention and final artifact review. No closure is inferred from frontend tests.

Stop at QA/release review. Implementation authority does not authorize deployment, backend changes or release readiness. Complete the external/runtime dependencies and review remaining risks under further instructions.

## Verification limits and final QA

Native Android, TalkBack/focus restoration, effective rendered contrast, large font/display settings, visual composition, provider handoffs and exact-build provenance remain unverified. Historical OPFS, dark modal, SQL Server, dependency, spreadsheet, key-ring/retention and final-artifact gates remain open. No production account, SMS, payment or destructive data operation is authorized or performed. Final implementation inventory, automated results, deferred changes and regression risks will be updated at the QA boundary.

## Changed file review index

Full source hashes and document dispositions are in `evidence/changed-files.json`. Historical baseline artifacts remain preserved.

| File                                                                | Review category                |
| ------------------------------------------------------------------- | ------------------------------ |
| `docs/accessibility-qa.md`                                          | existing product documentation |
| `docs/app-feedback.md`                                              | existing product documentation |
| `docs/localization-qa.md`                                           | existing product documentation |
| `docs/visual-theme.md`                                              | existing product documentation |
| `src/app/design-system.tsx`                                         | frontend production            |
| `src/core/infrastructure/expo-notification-service.test.ts`         | test                           |
| `src/features/analytics/presentation/analytics-screen.tsx`          | frontend production            |
| `src/features/auth/presentation/account-name-gate.tsx`              | frontend production            |
| `src/features/auth/presentation/auth-screen.test.tsx`               | test                           |
| `src/features/auth/presentation/auth-screen.tsx`                    | frontend production            |
| `src/features/auth/presentation/guest-data-screen.test.tsx`         | test                           |
| `src/features/auth/presentation/guest-data-screen.tsx`              | frontend production            |
| `src/features/auth/presentation/guest-transfer-feedback.test.ts`    | test                           |
| `src/features/auth/presentation/guest-transfer-feedback.ts`         | frontend production            |
| `src/features/decks/presentation/card-details-screen.tsx`           | frontend production            |
| `src/features/decks/presentation/card-editor-screen.tsx`            | frontend production            |
| `src/features/decks/presentation/card-form.tsx`                     | frontend production            |
| `src/features/decks/presentation/card-form.vocabulary.test.tsx`     | test                           |
| `src/features/decks/presentation/card-list-screen.tsx`              | frontend production            |
| `src/features/decks/presentation/deck-details-screen.tsx`           | frontend production            |
| `src/features/decks/presentation/deck-editor-screen.tsx`            | frontend production            |
| `src/features/decks/presentation/deck-form.tsx`                     | frontend production            |
| `src/features/decks/presentation/decks-screen.tsx`                  | frontend production            |
| `src/features/decks/presentation/editor-limits.test.tsx`            | test                           |
| `src/features/home/presentation/home-screen.tsx`                    | frontend production            |
| `src/features/settings/presentation/appearance-screen.tsx`          | frontend production            |
| `src/features/settings/presentation/cloud-sync-backup.test.tsx`     | test                           |
| `src/features/settings/presentation/cloud-sync-screen.test.tsx`     | test                           |
| `src/features/settings/presentation/cloud-sync-screen.tsx`          | frontend production            |
| `src/features/settings/presentation/language-screen.tsx`            | frontend production            |
| `src/features/settings/presentation/logout-screen.test.tsx`         | test                           |
| `src/features/settings/presentation/logout-screen.tsx`              | frontend production            |
| `src/features/settings/presentation/settings-account-card.test.tsx` | test                           |
| `src/features/settings/presentation/settings-account-card.tsx`      | frontend production            |
| `src/features/settings/presentation/settings-backup-card.tsx`       | frontend production            |
| `src/features/settings/presentation/settings-screen.test.tsx`       | test                           |
| `src/features/settings/presentation/settings-screen.tsx`            | frontend production            |
| `src/features/settings/presentation/speech-settings-screen.tsx`     | frontend production            |
| `src/features/settings/presentation/subscription-screen.tsx`        | frontend production            |
| `src/features/settings/presentation/use-settings-view-model.ts`     | frontend production            |
| `src/features/study/presentation/study-screen.tsx`                  | frontend production            |
| `src/features/study/presentation/study-session-screen.tsx`          | frontend production            |
| `src/features/study/presentation/use-start-study.test.ts`           | test                           |
| `src/features/study/presentation/use-start-study.ts`                | frontend production            |
| `src/features/study/presentation/use-study-session-view-model.ts`   | frontend production            |
| `src/features/transfer/presentation/import-preview-screen.test.tsx` | test                           |
| `src/features/transfer/presentation/import-preview-screen.tsx`      | frontend production            |
| `src/features/transfer/presentation/transfer-feedback.test.ts`      | test                           |
| `src/features/transfer/presentation/transfer-feedback.ts`           | frontend production            |
| `src/features/transfer/presentation/transfer-screen.test.tsx`       | test                           |
| `src/features/transfer/presentation/transfer-screen.tsx`            | frontend production            |
| `src/features/vocabulary/presentation/vocabulary-helper.tsx`        | frontend production            |
| `src/shared/access/free-plan-limit.tsx`                             | frontend production            |
| `src/shared/localization/localization.test.ts`                      | test                           |
| `src/shared/localization/messages.ts`                               | frontend production            |
| `src/shared/navigation/navigation.test.tsx`                         | test                           |
| `src/shared/speech/pronunciation-button.test.tsx`                   | test                           |
| `src/shared/speech/pronunciation-button.tsx`                        | frontend production            |
| `src/shared/speech/use-pronunciation.ts`                            | frontend production            |
| `src/shared/ui/button.tsx`                                          | frontend production            |
| `src/shared/ui/confirmation-panel.tsx`                              | frontend production            |
| `src/shared/ui/error-state.tsx`                                     | frontend production            |
| `src/shared/ui/feedback-notice.test.tsx`                            | test                           |
| `src/shared/ui/feedback-notice.tsx`                                 | frontend production            |
| `src/shared/ui/input.tsx`                                           | frontend production            |

Program tracking and audit/standards documents were maintained under `docs/refinement/`; the implementation report, lifecycle register and sanitized evidence are new deliverables. No source changes outside the listed frontend presentation/shared paths and corresponding tests.

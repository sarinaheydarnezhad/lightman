# Lerona Refinement — Initial Audit Coverage

## Implementation coverage — D-28, 2026-11-15

All 26 route files/two layouts and nine features remain covered by source review and the existing automated navigation/contract suites where applicable. No route is marked native/rendered passed. The final change manifest and tests are in IMPLEMENTATION_REPORT.md. `evidence/implementation-source-index.json` hashes 240 non-test sources; `evidence/feedback-lifecycle.json` indexes 156 component/announcement/live-region/OS-reminder entries. These are source counts, not runtime state coverage. [FEEDBACK_LIFECYCLE.md](FEEDBACK_LIFECYCLE.md) defines their persistence, scope, recovery and announcement contracts.

| Area                                | Safely implemented / reviewed                                                                                                                                         | Remaining acceptance                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Shared foundation/showcase          | Logical icon side; disabled semantics; inline validation/resource/task patterns; localized showcase/confirmation roles; existing purple/charcoal/tokens/font retained | Rendered optical hierarchy, inherited modal theme, contrast, target bounds and scaling        |
| Settings/appearance/language/speech | Secondary guest subscription navigation; typed localized save/reconciliation errors; persistent reasons; preference scopes unchanged                                  | Native persistence, denied/regranted permission, installed voices, large text                 |
| Home/navigation                     | Study-start/resource recovery and bilingual copy; four tabs/hidden Study architecture preserved                                                                       | Current hero/metric/eye-flow hypotheses, native layouts                                       |
| Deck/card management                | Inline first-required field focus, saved/unsaved/invalid/quota errors and explicit restriction recovery; content unchanged                                            | Native keyboard/scroll/focus, mixed long content and default/max text                         |
| Study/review                        | Typed task recovery, no duplicate action-error announcement, truthful once-per-session/explicit Review again guidance; scheduling/swipe/atomicity untouched           | Native reveal/gesture/Back/reduced-motion and interruption persistence                        |
| Analytics/progress                  | Persistent localized read errors and nonjudgmental copy; real metrics/distribution/chronology retained                                                                | Chart speech/visual density/scaling on device                                                 |
| Auth/account/guest                  | Contextual staged errors, inline name validation, persistent preview/settings choices; consent/journal/proofs and gates preserved                                     | Synthetic native auth/reset/guest restart/ownership scenarios; no real OTP                    |
| Subscription/payment                | Selection/submission distinction, persistent pending/recovery/availability, no false no-payment claim on failed status read                                           | Safe provider fixture/handoff, original-account/process-death/uncertainty matrix              |
| Sync/backup/logout                  | Persistent conflict choices/retry; view scope isolation; verification versus refresh distinction; visible logout consequences and unchanged credential receipt queue  | Native scoped SQLite/SecureStore, isolated SQL Server/concurrency/backup/credential scenarios |
| Import/export                       | Localized help/known issues, unknown diagnostics suppressed, scrollable partial/result receipt and preserved edits/guards                                             | Native picker/share, desktop Excel/LibreOffice round-trip and artifact checks                 |
| Reminders/vocabulary/pronunciation  | Useful bilingual notices and permissions/capability guidance; existing scheduling/provider/privacy rules retained                                                     | OS delivery/voice behavior, external dictionary availability and device accessibility         |

Language/theme matrix is source/automated only: light/fa, light/en, dark/fa, dark/en remain **pending native/rendered QA**, as do loading/empty/error/success/disabled/pending/recovery across guest/account and offline/online fixtures. Existing historical checkboxes below retain their acceptance meaning; they are not bulk checked because implementation/source discovery occurred.

## Coordinated audit coverage update — 2026-11-15

All 26 route files/two layouts and nine feature directories remain in scope. VISUAL_AUDIT.md adds a 119-file route/presentation/shared source screening ledger and detailed screen-family findings; FEEDBACK_INVENTORY.md adds 118 static producer sites and task-specific presentation decisions; UX_WRITING_AUDIT.md includes 719 bilingual dictionary keys with explicit mechanical/editorial limits. Source index hashes 238 non-test source files. These counts measure inventory, not rendered coverage or completed linguistic approval.

Coverage additions now explicit: study-order popup/menu, required account-name and guest gates, native keyboard/system prompts, background/scope transitions, financial pending/unknown outcomes, per-field accessible hints, legacy-key reachability, direct English transfer help and dynamic placeholder semantics. BASELINE_VERIFICATION.md records automated results; RUNTIME_VERIFICATION_PLAN.md defines capture/accessibility/safe scenario matrix. Shared primitives and feature families are source-screened; full current visual/state/TalkBack execution remains pending. Existing unchecked boxes below remain pending acceptance/runtime checks, not claims that source discovery completed them.

No current screenshot/build equivalence, native accessibility or critical-flow safety pass is asserted. Supplied images were inspected, but not assigned to current HEAD. Historical gates remain open; standards/master plan are proposals awaiting approval.

## Original preparation checklist

Prepared: 2026-11-15 against the revisions in [PROGRAM_STATUS.md](PROGRAM_STATUS.md). **Inventory only. Every audit/verification item below is pending.** Discovering a source file, reading the brand PDF, or recording a historical report does not mean its screen, behavior, writing, accessibility or design has been audited.

## Tracking and evidence rules

- `[ ]` means coverage is planned and not completed. Do not check an item until the relevant audit has actual evidence and recorded limitations.
- For each future entry record audit subphase, reviewer/date, source revision, screen/state, platform/artifact/device, theme/language/font settings, evidence references, findings or no-finding result, and unresolved verification needs.
- Distinguish source review, automated execution, native Android execution, supplementary web execution and historical evidence. A completed source review can coexist with pending runtime coverage.
- Use explicit `blocked`, `not supported`, or `not applicable — reason/evidence` dispositions rather than silently excluding cells. No present item is declared passed or not applicable.
- Source links below are inventory/contract candidates, not judgments of design quality or document authority. Reconcile conflicts using [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

## Phase 0.0 — Architecture and verification baseline

- [ ] Recheck source/artifact revisions, repository instructions and change state before auditing.
- [ ] Confirm Expo Router/root/tab/modal navigation, startup and data-scope boundaries; preserve layer/import restrictions.
- [ ] Validate the route/component/feature inventory below against current source, including embedded views and native/system surfaces.
- [ ] Establish which documents/contracts are current and validated; disposition conflicting historical descriptions explicitly.
- [ ] Establish physical Android connection and supported build/capture path in a later authorized task. ADB initialization remains blocked; do not infer execution from phone availability.
- [ ] Define safe fixtures, state setup, evidence naming/provenance and verification methods; identify unsupported web features and external-service dependencies.
- [ ] Record existing test/typecheck/lint capabilities and an executed baseline when authorized; do not import historical passes as new results.

Entry sources: [package.json](../../package.json), [root layout](../../src/app/_layout.tsx), [tab layout](<../../src/app/(tabs)/_layout.tsx>), [application composition](../../src/core/composition/application.ts), [repository composition](../../src/core/composition/repositories.ts), `src/core/ports/`, `src/core/storage/`, `src/core/database/`, `src/core/sync/`.

## Routes and screens

All **26 route files** are listed below, excluding the two layouts above. Paths are relative to `Frontend/`. A route may contain multiple stages or views; the table is not a claim of 26 distinct user-visible screens. Audit dimensions apply across rows: visual/design system (0.1), writing/localization (0.2), feedback/errors (0.3), and applicable critical-flow/accessibility coverage (0.4).

| Pending | Route source                                                                                             | Surface / coverage context                                                             |
| ------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [ ]     | [src/app/(tabs)/index.tsx](<../../src/app/(tabs)/index.tsx>)                                             | Home, due learning entry and live summary states                                       |
| [ ]     | [src/app/(tabs)/decks.tsx](<../../src/app/(tabs)/decks.tsx>)                                             | Deck list, search/filter and empty/populated states                                    |
| [ ]     | [src/app/(tabs)/study.tsx](<../../src/app/(tabs)/study.tsx>)                                             | Study entry/options; registered route is hidden from visible tab buttons               |
| [ ]     | [src/app/(tabs)/analytics.tsx](<../../src/app/(tabs)/analytics.tsx>)                                     | Analytics, activity chart and meaningful data descriptions                             |
| [ ]     | [src/app/(tabs)/settings.tsx](<../../src/app/(tabs)/settings.tsx>)                                       | Settings, account/subscription summary and preferences                                 |
| [ ]     | [src/app/decks/create.tsx](../../src/app/decks/create.tsx)                                               | Create deck modal and validation/save/cancel states                                    |
| [ ]     | [src/app/decks/[deckId]/index.tsx](../../src/app/decks/[deckId]/index.tsx)                               | Deck details/actions and scoped study entry                                            |
| [ ]     | [src/app/decks/[deckId]/edit.tsx](../../src/app/decks/[deckId]/edit.tsx)                                 | Edit deck, archive/destructive actions where present                                   |
| [ ]     | [src/app/decks/[deckId]/cards/index.tsx](../../src/app/decks/[deckId]/cards/index.tsx)                   | Card list, search and empty/error states                                               |
| [ ]     | [src/app/decks/[deckId]/cards/create.tsx](../../src/app/decks/[deckId]/cards/create.tsx)                 | Create card modal, fields/examples and vocabulary suggestions                          |
| [ ]     | [src/app/decks/[deckId]/cards/[cardId]/index.tsx](../../src/app/decks/[deckId]/cards/[cardId]/index.tsx) | Card detail/content, pronunciation and actions                                         |
| [ ]     | [src/app/decks/[deckId]/cards/[cardId]/edit.tsx](../../src/app/decks/[deckId]/cards/[cardId]/edit.tsx)   | Edit card, preservation of text, validation/save/delete where present                  |
| [ ]     | [src/app/study/[sessionId].tsx](../../src/app/study/[sessionId].tsx)                                     | Active study session, reveal/answers, cancellation and result summary                  |
| [ ]     | [src/app/auth/index.tsx](../../src/app/auth/index.tsx)                                                   | Phone/password login, signup and password reset stages within one route                |
| [ ]     | [src/app/auth/guest-data.tsx](../../src/app/auth/guest-data.tsx)                                         | Guest preview, additive copy/confirmation/resume and blockers                          |
| [ ]     | [src/app/settings/appearance.tsx](../../src/app/settings/appearance.tsx)                                 | Light/dark selection, persistence and immediate update                                 |
| [ ]     | [src/app/settings/language.tsx](../../src/app/settings/language.tsx)                                     | Persian/English selection and device preference persistence                            |
| [ ]     | [src/app/settings/speech.tsx](../../src/app/settings/speech.tsx)                                         | Speech preferences, deck-language/voice dependencies and failures                      |
| [ ]     | [src/app/settings/cloud.tsx](../../src/app/settings/cloud.tsx)                                           | Cloud sync, conflicts and embedded server-backup card                                  |
| [ ]     | [src/app/settings/subscription.tsx](../../src/app/settings/subscription.tsx)                             | Plans, real availability, purchase/verification/pending recovery                       |
| [ ]     | [src/app/settings/logout.tsx](../../src/app/settings/logout.tsx)                                         | Logout choices, backup verification, credential-clearing failure/recovery              |
| [ ]     | [src/app/settings/transfer.tsx](../../src/app/settings/transfer.tsx)                                     | File import/export and platform share/file-system outcomes                             |
| [ ]     | [src/app/settings/import-preview.tsx](../../src/app/settings/import-preview.tsx)                         | Preview, validation and confirmed import/result states                                 |
| [ ]     | [src/app/vocabulary/helper.tsx](../../src/app/vocabulary/helper.tsx)                                     | Vocabulary helper explanation; card-editor suggestions are a separate embedded surface |
| [ ]     | [src/app/design-system.tsx](../../src/app/design-system.tsx)                                             | Existing in-app showcase; previews are not complete feature/runtime coverage           |
| [ ]     | [src/app/+not-found.tsx](../../src/app/+not-found.tsx)                                                   | Unknown route and recovery navigation                                                  |

Visible tab buttons are Home, Decks, Analytics and Settings. Audit navigation by actual route behavior and entry points, not a presumed fifth visible Study tab.

### Embedded, global and system surfaces

- [ ] [BootstrapGate](../../src/shared/bootstrap/bootstrap-gate.tsx), root route ErrorBoundary and [DataScopeBoundary](../../src/shared/bootstrap/data-scope-boundary.tsx): loading, initialization failure/retry, storage lock and account-scope transitions.
- [ ] [AccountNameGate](../../src/features/auth/presentation/account-name-gate.tsx), [LogoutNotice](../../src/features/auth/presentation/logout-notice.tsx), auth-stage and guest-transfer dialogs: these are not independent routes.
- [ ] [StudyResultSummary](../../src/features/study/presentation/study-result-summary.tsx), answer/reveal controls, confirmation panels and explicit review-again path.
- [ ] Settings account/subscription/backup cards, reminder/haptic controls, and existing confirmation/feedback surfaces within their parent screens.
- [ ] Native permission prompts, keyboard/insets, status/navigation bars, Android Back, file chooser/share sheet, speech and Myket handoff/return where supported. Distinguish system-owned from app-owned presentation.

## Feature directory coverage

| Pending | Directory                                                | Dedicated audit area / cross-feature dependency                                                       |
| ------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [ ]     | [src/features/home](../../src/features/home)             | Home composition, real metrics and learning entry                                                     |
| [ ]     | [src/features/decks](../../src/features/decks)           | Deck/card lifecycle, forms, search, content, archive/delete and limits                                |
| [ ]     | [src/features/study](../../src/features/study)           | Learning interaction, session lifecycle, answers/results, reminders and scheduler-facing explanations |
| [ ]     | [src/features/analytics](../../src/features/analytics)   | Data hierarchy, chart semantics and truthful progress communication                                   |
| [ ]     | [src/features/auth](../../src/features/auth)             | Multi-stage authentication/reset, account-name gate, guest transfer and logout notice                 |
| [ ]     | [src/features/payments](../../src/features/payments)     | Myket driver/orchestration, server verification and recovery; no independent screen directory         |
| [ ]     | [src/features/settings](../../src/features/settings)     | Account, appearance/language/speech, sync/backups, subscriptions and logout presentation              |
| [ ]     | [src/features/transfer](../../src/features/transfer)     | Import/export/preview, exact content and file safety                                                  |
| [ ]     | [src/features/vocabulary](../../src/features/vocabulary) | Dictionary suggestions/helper, loading, no results and failures                                       |

Feature coverage includes presentation and necessary application/domain/data contract tracing. It does not authorize changes to domain logic or adapters. Cent is excluded.

## Shared components and design-system foundation

Each item needs all applicable visual, language, state and accessibility variants; showcase presence is not proof of correct usage in features.

| Pending | Source                                                                 | Coverage                                                                       |
| ------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [ ]     | [text.tsx](../../src/shared/ui/text.tsx)                               | Typography, scaling, alignment, mixed scripts, semantics and color inheritance |
| [ ]     | [button.tsx](../../src/shared/ui/button.tsx)                           | Variants, hierarchy, labels, loading/disabled/pressed states                   |
| [ ]     | [icon-button.tsx](../../src/shared/ui/icon-button.tsx)                 | Accessible name/state, target size and focus                                   |
| [ ]     | [input.tsx](../../src/shared/ui/input.tsx)                             | Label/help/error, focus/keyboard, validation, scaling and direction            |
| [ ]     | [card.tsx](../../src/shared/ui/card.tsx)                               | Surface, grouping, nesting, padding and hierarchy                              |
| [ ]     | [badge.tsx](../../src/shared/ui/badge.tsx)                             | Meaning, semantics and text/color cues                                         |
| [ ]     | [chip.tsx](../../src/shared/ui/chip.tsx)                               | Selection, states and labels                                                   |
| [ ]     | [tab.tsx](../../src/shared/ui/tab.tsx)                                 | Selection, navigation semantics and scaling                                    |
| [ ]     | [screen.tsx](../../src/shared/ui/screen.tsx)                           | Safe areas, width, scrolling, keyboard and reading order                       |
| [ ]     | [screen-header.tsx](../../src/shared/ui/screen-header.tsx)             | Title/actions/back order and RTL handling                                      |
| [ ]     | [divider.tsx](../../src/shared/ui/divider.tsx)                         | Grouping and section relationships                                             |
| [ ]     | [progress.tsx](../../src/shared/ui/progress.tsx)                       | Accurate meaning, accessible value and non-color cues                          |
| [ ]     | [loading-state.tsx](../../src/shared/ui/loading-state.tsx)             | Progress semantics, waiting and duplication with other feedback                |
| [ ]     | [empty-state.tsx](../../src/shared/ui/empty-state.tsx)                 | Context, next action and announcements                                         |
| [ ]     | [error-state.tsx](../../src/shared/ui/error-state.tsx)                 | Failure meaning, dismissal/retry and persistent recovery                       |
| [ ]     | [feedback-modal.tsx](../../src/shared/ui/feedback-modal.tsx)           | Queue/event/dismiss/retry, tone, theme inheritance, focus and Back             |
| [ ]     | [confirmation-panel.tsx](../../src/shared/ui/confirmation-panel.tsx)   | Consequences, action hierarchy, in-progress/back behavior and nested errors    |
| [ ]     | [feature-placeholder.tsx](../../src/shared/ui/feature-placeholder.tsx) | Truthful availability and navigation/recovery where used                       |

Additional shared/foundation coverage:

- [ ] [Theme values](../../src/shared/theme/values.json), [typed tokens](../../src/shared/theme/tokens.ts), [ThemeProvider](../../src/shared/theme/theme-provider.tsx), [global CSS](../../src/shared/theme/global.css), [Tailwind mappings](../../tailwind.config.js): semantic roles, actual use, component inheritance and modal boundaries in both themes.
- [ ] [Font configuration](../../src/shared/theme/font.ts), [surface styles](../../src/shared/theme/use-surface-style.ts), [screen backdrop](../../src/shared/theme/screen-backdrop.tsx): typography, optical alignment, spacing/radii/dimensions, shadows and decoration in actual context.
- [ ] [LearningAccessNotice](../../src/shared/access/learning-access-notice.tsx), [FreePlanLimit](../../src/shared/access/free-plan-limit.tsx), [PronunciationButton](../../src/shared/speech/pronunciation-button.tsx) and [focused-resource lifecycle](../../src/shared/navigation/use-focused-resource.ts): shared access, speech and asynchronous-state behavior.
- [ ] Feature components: deck/card rows/forms/header/content; study/flip/swipe cards, answer controls, order/distribution/results; activity chart; settings account/subscription/backup cards; Home illustration. Inventory paths: `src/features/*/presentation/`.
- [ ] Existing [design-system route](../../src/app/design-system.tsx): typography, colors, buttons, inputs, surfaces, badges/chips/tabs, loading/empty/progress previews, theme changes and actual feature usages. No Storybook or equivalent independent preview framework was located in discovery.

## Major and critical user flows

All rows remain pending. “Critical” identifies protected safety/integrity or primary learning paths, not an observed defect. Include entry, successful path, cancellation, interruption/restart, repeated action and recoverable failure where applicable.

| Pending | Flow                                                                                                       | Classification and preservation checks                                                                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ ]     | Cold start → correct guest/account scope → navigation                                                      | Critical: initialization failure/retry, account locking, no cross-scope exposure or stale responses                                                                       |
| [ ]     | Guest use → explicit authentication → guest-data preview/copy/resume                                       | Critical: additive copy, explicit consent, IDs/history/ownership, quota/conflict checks, no automatic merge or deletion                                                   |
| [ ]     | Login, signup/SMS proof, reset/password proof, account name and expired session                            | Critical: actual purpose-bound flows, token/session behavior, clear next steps, no false authentication success                                                           |
| [ ]     | Create/edit/archive/delete decks and cards → retained content → study eligibility                          | Critical for data: exact content, confirmations, persistence failures, free-tier limits without data loss                                                                 |
| [ ]     | Home/deck/study entry → reveal → answer → next card → results → Done/Analytics or explicit review again    | Critical learning: left failure/right success remains physical, gesture-free equivalent, answer/state atomicity, no accidental duplicate answer or implicit retry session |
| [ ]     | Study cancellation/background/interruption/relaunch                                                        | Critical: accepted answers persist, remaining/session behavior matches validated contract, no invented completed review                                                   |
| [ ]     | Subscription → Myket handoff → verification → entitlement / pending-payment recovery                       | Critical financial: actual pricing/terms/availability, server authority, denial/cancellation/network interruption, no mock success or coercion                            |
| [ ]     | Sync → versions/outbox → conflict → explicit recovery                                                      | Critical: idempotency, no premature acknowledgement, account/session epochs, retry/deadline semantics, no silent destructive conflict resolution                          |
| [ ]     | Backup status → manual creation → verified receipt → expiry/refresh                                        | Critical recovery: distinguish local progress, stored artifact, status-read failure and restore limitations; no false recovery promise                                    |
| [ ]     | Optional verified backup before guest copy; backup-and-logout / logout without backup → signed-out receipt | Critical: backup failure does not masquerade as success, credential clearing/isolation, persistent retry and receipt validity                                             |
| [ ]     | File selection → import preview/confirm → saved data; export/share/reimport                                | Critical content: format/error recovery, CSV formula-like rejection, XLSX text preservation and exact mixed-language content                                              |
| [ ]     | Reminder opt-in/time → scheduled due-card notice → tap into valid study                                    | Critical notification/learning entry: denial/regrant, empty queue, updated counts/language, scope changes, OS-delivery limitations                                        |
| [ ]     | Language/theme/speech/haptic preferences → navigate/restart/account switch                                 | Major and persistence-sensitive: intended setting scope, immediate update and retained behavior; menu language does not alter deck language or speech                     |
| [ ]     | Card editor vocabulary suggestions and pronunciation                                                       | Major: real result/no result/loading/unavailable/voice failure, content selection and device dependencies                                                                 |
| [ ]     | Browse/search decks/cards and interpret analytics                                                          | Major: search/content direction, empty versus no-results, accurate metrics/chronology and accessible descriptions                                                         |
| [ ]     | Feedback across concurrent operations → dismiss → retry / reopen conflict                                  | Cross-cutting critical recovery: correct event ownership/queue, persistent choices, no blocked or duplicated recovery                                                     |

## Themes, languages and relevant states

Required baseline combinations for applicable surfaces and flows:

| Theme                               | Persian (`fa`) | English (`en`) |
| ----------------------------------- | -------------- | -------------- |
| Light                               | [ ] Pending    | [ ] Pending    |
| Dark — intentional neutral charcoal | [ ] Pending    | [ ] Pending    |

- [ ] Preserve purple brand identity and charcoal dark intent; examine semantic roles/effective contrast and actual backgrounds, not token values alone.
- [ ] Live theme/language change, restart persistence, guest/account transitions, legacy theme preference compatibility and modal-open cases.
- [ ] Persian RTL and English LTR within the actual selective-direction architecture; app provider/tab navigation uses LTR baseline with explicit local direction handling. Do not assume globally mirrored navigation.
- [ ] English UI with Persian/RTL deck, Persian UI with English/LTR deck, centered content, mixed-script numbers/time/punctuation, long labels, names and examples.
- [ ] Translation coverage/fallback/interpolation and bidirectional isolation, numeric/date meaning, phone digit normalization where applicable; distinguish current formatting from approved writing policy.
- [ ] Analytics chronology remains left-to-right; physical study swipe meanings remain unchanged; speech follows deck/voice preferences rather than menu language.

State checklist to apply where supported, or explicitly explain non-applicability:

- [ ] Loading/initializing, ready, empty, no matches, unavailable and not found.
- [ ] Enabled, disabled, selected, focused, pressed, submitting, duplicate tap and long/wrapped content.
- [ ] Validation failure, quota/capacity limit, permission denied, missing/unsupported native capability and offline/network/timeout/rate-limit/service failure.
- [ ] Success only after confirmed completion, partial progress, interrupted/unknown outcome, explicit retry and cancellation/dismissal.
- [ ] Concurrent feedback, repeated same-message events, stale async responses, modal-in-modal errors, focus restoration and recovery after notice dismissal.
- [ ] Guest versus account; free versus valid/expired/pending entitlement; session expiry and account switch.
- [ ] Sync pending/conflicted/recovered; backup none/Pending/Completed/Failed/expired and independent status-read failure.
- [ ] App background/foreground, restart, storage lock, denied/regranted notification permission and time-zone/clock changes.

These state names are coverage prompts. They do not claim every API/platform produces every state or that each needs a new UI.

## Accessibility requirements to verify

Use [accessibility-qa](../accessibility-qa.md) and [localization-qa](../localization-qa.md) as source candidates, checking their historical/currentness limits. The final acceptance standard/ranges remain an open question, not a claimed compliance pass.

- [ ] Physical Android TalkBack: meaningful names, roles/states/values, reading/focus order, announcements, input labeling and error/retry discovery in both languages.
- [ ] Modal focus entry/containment/restoration, Back dismissal, pending confirmation behavior, queued notices and persistent recovery controls.
- [ ] System font scaling and display size at agreed default/large/maximum supported settings on a narrow physical device: reachable controls, scroll range, keyboard/insets, no hidden required text/actions.
- [ ] Reduced motion: reveal/flip/swipe/feedback/progress remain understandable; no gesture-only interaction or hidden card-face speech leakage.
- [ ] Effective text/essential non-text contrast in light/dark, overlays/opacity, disabled/selected/focused/pressed states; non-color cues and touch targets.
- [ ] Accessible analytics/progress descriptions and truthful values, long/mixed-script text, logical RTL order and stable physical answer semantics.
- [ ] Where supplementary web is equivalent: keyboard navigation, visible focus, dialogs/escape, screen-reader semantics and scaling; do not count these as native TalkBack results.

## Runtime and automated verification requirements

| Pending | Capability / evidence requirement                                                                                     | Current limit                                                                                                                                                                       |
| ------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ ]     | Physical Android connection, device OS/model, package/build/hash, install/start and reproducible fixture              | Device exists per owner; ADB initialization permission failure unresolved; no retry here                                                                                            |
| [ ]     | Native screenshots and interaction evidence for themes/languages, large text and critical states                      | No captures or runtime tests performed in initialization; native development/release build needed for OP SQLite, not full Expo Go parity                                            |
| [ ]     | Native SQLite, SecureStore, lifecycle/interruption and scoped persistence                                             | Web/mocks do not substitute; retain historical native gate                                                                                                                          |
| [ ]     | TalkBack, font/display scaling, reduced motion, Android Back, keyboard and native modals                              | Code support is not observed accessibility behavior                                                                                                                                 |
| [ ]     | Myket/OTP/speech/notifications/file-picker integrations under suitable controlled arrangements                        | Platform/service support and safe test setup must be established; no live actions authorized here                                                                                   |
| [ ]     | Supplementary web launch/captures with secure origin and cross-origin isolation for WASM/OPFS                         | Historical browser/CDP and OPFS gates remain unresolved; confirm feature parity before relying on web                                                                               |
| [ ]     | Frontend automated baseline: `pnpm test`, `pnpm typecheck`, `pnpm lint`; formatting checks as applicable              | Scripts exist in [package.json](../../package.json); none executed here; later runs may create caches/artifacts and require appropriate scope                                       |
| [ ]     | Targeted architecture, pure scheduler, scope isolation, sync, backup, payment, localization and shared-UI regressions | Existing tests are evidence candidates; passing mocks do not verify CSS/native/SQL Server behavior                                                                                  |
| [ ]     | Contract integration evidence when needed                                                                             | Default Jest discovery does not automatically run all `.e2e.ts` paths; backend mobile-cloud harness/environment requirements must be inspected before treating coverage as complete |
| [ ]     | Final-artifact verification after approved changes                                                                    | Historical builds/tests/screenshots are not final-artifact native verification; no release approval implied                                                                         |

Repository-inspected launch commands: `pnpm start`, `pnpm android`, `pnpm ios`, `pnpm web`. Commands are documented capabilities, **not executed results**. Android/iOS run commands can build or generate files and are not part of this documentation task. Step 01 verified installed tool versions/resolution separately; it did not establish successful application runtime.

## Dedicated audit boundaries and exclusions

- [ ] 0.1: visual/design-system foundation and full-screen composition, with the owner's eye-flow report and JPG/current-artifact comparison. Cover all special investigation dimensions in the [brief](PROGRAM_BRIEF.md); no diagnosis is made here.
- [ ] 0.2: Persian/English brand voice, terminology and contextual tone across normal, error, financial/security, learning and reminder text; local/remote/native-owned strings distinguished.
- [ ] 0.3: event/state taxonomy, context, queue/dismiss/retry behavior, confirmations, sync/payment/backup recovery and local notification lifecycle. Existing modal policy is current-behavior evidence pending future standards.
- [ ] 0.4: protected critical flows and physical Android accessibility baseline, with explicit unverified states and dependencies.

Backend contracts are inspection dependencies; backend behavior changes, Cent, production operations, dependency/security remediation and new capabilities are outside the authorized frontend refinement scope unless separately approved. Historical release gates remain visible and cannot be closed through this checklist alone. Stop at preparation until further instruction for Phase 0.

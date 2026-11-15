# Safe runtime and accessibility verification plan

Implementation update, 2026-11-15: D-28 approves frontend refinements and the working accessibility references. Safe ADB home diagnostics and an isolated browser readiness probe remain blocked before rendering. Existing synthetic automated fixtures were used; no native fixture/build, production account, real SMS/payment/notification or device mutation occurred. This matrix remains required at final QA for the exact artifact. Broader spatial/optical refinements remain deferred until current rendered evidence is available.

2026-11-15. Proposed verification protocol, not execution results. ADB initialization currently blocks native access. No assumption that installed Lerona equals current HEAD; do not launch private account/content merely to obtain screenshots.

## Environment and scenario isolation

| Scenarios                                  | Existing evidence/fixture capability                                                                      | Required runtime arrangement                                                                                                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest/decks/cards/study/analytics/settings | `test/fixtures.ts`, scheduler/replay fixtures, in-memory repositories, explicit development-seed function | Isolated disposable device/profile with approved synthetic data; existing user's guest database is not disposable                                                                               |
| Auth/name/signup/reset                     | Mock fetch/SecureStore in tests; backend WebApplicationFactory suites                                     | Separately authorized nonproduction backend with stub OTP, synthetic identities and no real SMS                                                                                                 |
| Subscription/eligibility/payment states    | Myket orchestration/driver mocks and subscription tests                                                   | Isolated catalog/account fixture and approved provider sandbox if supported; sandbox availability not established. No real purchase or simulated success in production                          |
| Sync/conflict/backup/logout                | Unit/integration fixtures and typed state/error contracts                                                 | Synthetic account/database and isolated backend/key ring; no production restore, deletion, cleanup or credential operations                                                                     |
| Error/recovery/offline                     | Injected errors/mocks in existing tests                                                                   | Approved nonproduction error fixtures; do not mutate current behavior or intentionally corrupt storage. Do not disable a user's network or interrupt real payment/sync                          |
| Reminder/speech/vocabulary/import/export   | Native mocks, test file fixtures and adapters                                                             | Explicit test-notification arrangement, harmless file fixtures, synthetic content and known device voices. Dictionary endpoint is external; avoid assuming network availability or data privacy |

`development-seed.ts` is not authorization to seed an installed app. NODE_ENV=test adapters do not constitute a runtime sandbox. No new fixture, mock build or environment was created. Source-only and mocked results must remain labeled.

## Native readiness and artifact association

After host access is supported: enumerate authorized device without publishing serial; query model/OS and `pm list packages com.lerona.app`, package version metadata and app binary path. Record non-sensitive build metadata only. Version 1.0.0/code5 alone cannot identify a commit. Associate installed artifact through retained build manifest/commit, artifact hash and signing provenance when safely available; otherwise label “installed build, source association unverified”. Do not pull private application data or read arbitrary logcat history. Never uninstall, clear data or install/replace without explicit approval.

Screen capture is available in principle through `adb exec-out screencap -p` with binary-safe host capture, but not verified here. Avoid Windows text-pipeline corruption; use a binary-safe process stream. Verify current screen contains synthetic/non-sensitive content before capturing. Runtime log collection should be package/process-filtered and brief, with token/phone/account/content/provider redaction before retention. If sanitization is uncertain, retain only a summary. No screenshot is better than exposing private content.

## Reproducible screenshot protocol

For each approved fixture: identify route and actual stage/dialog, device/model, Android version, viewport/density, installed app version/code/hash and source-association status. Record local capture time plus UTC, interface language, deck language/alignment, theme, font scale/display size, connectivity, guest/account/entitlement state, relevant data count, loading/error/disabled state and known limitation. Use in-app preferences only on a disposable approved environment; changing existing preferences is still a user-data change.

Filename: `YYYYMMDDTHHmmssZ__android-OS_model__build-ID__route-state__light-fa__font-default.png` (safe ASCII identifiers; no serial/account/name/content). Sidecar Markdown/JSON records metadata and artifact/source hash; filenames alone do not prove provenance. Store sanitized captures under `docs/refinement/evidence/baseline/`. Keep owner JPGs distinct from fresh captures and installed-build captures distinct from verified-current-source captures.

Cover light/fa, light/en, dark/fa, dark/en at default text; repeat narrow/complex/critical views at larger and maximum supported text/display settings. Include startup, empty/populated/error, field validation, menus/dialogs, unavailable/pending financial states, conflict/recovery and long mixed text. Capture only synthetic fixtures. Native screenshots are evidence for future review, not a substitute for interaction/TalkBack/lifecycle checks.

## Proposed accessibility matrix — owner approval pending

| Dimension      | Practical method / proposed criterion                                                                               | Evidence needed                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Touch          | Native target bounds at least 48dp; check adjacent controls and expanded hit areas                                  | Device measurements, not token height alone                                    |
| Text           | Default, 1.3/1.5/2× where supported, maximum system text and larger display size                                    | Actual recorded settings, scroll/keyboard/reachable controls in both languages |
| Contrast       | WCAG 2.2 AA principles: 4.5:1 ordinary text, 3:1 qualifying large text and applicable essential non-text indicators | Effective rendered colors/opacity/background; disabled exceptions documented   |
| TalkBack       | Every control's name/role/state/value, logical order, meaningful chart/result descriptions                          | Native spoken traversal in both languages; no hidden card-back leakage         |
| Focus          | Dialog entry, containment/background exclusion, dismissal/restoration, first invalid field                          | Native actions and Back; supplementary web keyboard separately                 |
| Announcements  | Loading/error/success/reveal changes announced once with appropriate urgency                                        | Actual announcements; prevent duplicate live/modal events                      |
| Reduced motion | Device reduced-motion and existing flip/swipe alternatives                                                          | Interactions still available and understandable                                |
| Gestures       | Reveal/Success/Failure buttons, menus and Back path                                                                 | No required gesture-only task; stable physical outcome mapping                 |
| RTL            | Persian UI + English deck and inverse, punctuation/amounts/times, chart chronology                                  | Reading and visual order, no blanket mirroring                                 |
| Modals         | Long content, large text, multiple events, busy confirmations and safe exits                                        | Focus/scroll/actions/recovery reachable after dismissal                        |

References: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Android app accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps). These are proposed acceptance references, not a compliance claim. Owner decisions needed: supported Android/device range, acceptance text/display settings, reviewer/assistive versions and justified exceptions. iOS formal coverage remains open; web is supplementary only for equivalent features.

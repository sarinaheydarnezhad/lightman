# Lerona Product Experience Refinement — Program Brief

Initialized: 2026-11-15. Authority: product owner's Step 02 instructions and the approved brand document. Status: preparation only; no audit or implementation authorized by this initialization task.

## Mission

Refine Lerona's entire frontend product experience around the brand essence **“Learn intelligently, progress calmly.”** The approved visual direction is **Modern Calm Minimalism**. Improve the coherence of visual composition, the design system, Persian and English UX writing, accessibility, errors, recovery, feedback, notifications, and light/dark presentation through evidence and approved standards.

This is a refinement program. Preserve the product identity and required functionality; establish evidence before diagnosing problems or choosing changes. The current implementation describes existing behavior and is not, by itself, proof of correct UX.

## Approved product decisions

- The authoritative brand source is [Lerona-brand-personality(1).pdf](<../../../information/Lerona-brand-personality(1).pdf>), read in full during initialization (five pages, internal document date 2026-11-06).
- The three JPGs in `information/` show existing interfaces the owner considers visually problematic. They are problem evidence, not a desired design direction. Their correspondence to the current build is unverified.
- The owner's report that the eye does not move comfortably or naturally through these interfaces is a qualitative observation; its causes remain undiagnosed.
- Android is primary. A physical Android device is available according to the owner; connection and runtime verification have not been established.
- Preserve the purple brand identity and intentional neutral charcoal dark theme. Evidence may justify refining semantic colors, contrast, visual balance, and color usage. No specific palette changes are approved here.
- The scope includes the whole Lerona frontend, including complex and sensitive flows. Backend contracts may be inspected; changing backend behavior requires separate explicit approval. Cent is excluded.
- Theme and language persistence, business/domain rules, and architectural/data/security safeguards remain protected.

The complete decision record is [DECISION_LOG.md](DECISION_LOG.md). Operational status and unresolved dependencies are in [PROGRAM_STATUS.md](PROGRAM_STATUS.md) and [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

## Brand authority and faithful interpretation

The approved PDF governs brand identity and communication. This section preserves its operating principles for program preparation; the PDF remains authoritative where a summary omits nuance. Do not turn its example copy into unverified product claims.

### Personality and behavioral roles

PDF §§1–2, page 1: Lerona is an intelligent, warm, trustworthy companion for making learning a regular and enjoyable part of life. The personality compass is a smart, thoughtful companion who takes learning seriously without taking itself too seriously.

| Strategic personality dimension | Weight | Meaning                                              |
| ------------------------------- | ------ | ---------------------------------------------------- |
| Competence — صلاحیت             | 50%    | Intelligent, capable, precise, dependable, organized |
| Sincerity — صداقت               | 30%    | Warm, honest, simple, respectful, supportive         |
| Excitement — هیجان              | 20%    | Curious, creative, lively, slightly playful          |

These are strategic weights, not scientific test scores, visual proportions, color ratios, or per-screen quotas. Sophistication and ruggedness are not the primary personality dimensions in the PDF; do not substitute luxury/prestige or toughness/adventure for the approved identity.

PDF §§3–5, page 2: competence means useful accurate responses, clear guidance, and claims grounded in actual capabilities and valid data. Sincerity means revealing limitations, avoiding unrealistic promises, and speaking without judgment. Excitement means discovery and creative energy with restrained humor. Behavioral values are intelligence, honesty, support, curiosity, and responsibility.

The PDF's complementary behavioral roles are **همراه هوشمند** (intelligent companion, 50%), **مربی حرفه‌ای** (professional coach, 30%), and **دوست کنجکاو** (curious friend, 20%). These roles translate personality into behavior; they are not interchangeable labels for the strategic dimensions or a separate scientific model.

Apply expression by context, as confirmed by the owner:

- Competence dominates complex, financial, security-sensitive, and information-dense interactions.
- Sincerity becomes more prominent during learning difficulties, errors, recovery, onboarding, and supportive guidance.
- Excitement appears selectively during discovery, meaningful progress, and positive learning moments.
- Do not force all traits into each interface or message. Clear, honest, supportive communication remains the PDF's final cross-context rule.

### Voice, language, and writing boundaries

PDF §§6–8, pages 2–4:

- Be thoughtful, warm and respectful, precise, realistic and supportive, curious, modern, and dependable. Humor is measured.
- Avoid arrogance, a know-it-all voice, excessive familiarity, childishness, blame, controlling language, slogans, exaggeration, bureaucratic lifelessness, and trend chasing for attention.
- Maintain a consistent identity while adapting formality and energy to the user's situation. Guide the user without deciding for them.
- Persian uses **«تو»**, rather than «شما», with controlled conversational language; avoid both stiff official prose and excessive broken/slang spelling.
- English is natural and conversational, not a literal translation of Persian. Both languages use everyday precise vocabulary, short or medium-length sentences, and direct wording where possible.
- Use emoji sparingly and purposefully, limit exclamation marks, and reserve subtle occasional humor for suitable contexts.
- Preserve the five writing rules: write simply without being superficial; speak with the user rather than lecture; encourage without fabricating achievements; know when humor is appropriate; be direct.

### Contextual tone

PDF §9, page 4:

| Context                    | Required expression                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Welcome/onboarding         | Warm and friendly; explain the experience clearly                                                                      |
| Starting learning          | Encouraging and clear; identify the next step                                                                          |
| Review completion          | Positive and lively; use actual data only                                                                              |
| Wrong answer               | Calm and supportive; treat mistakes as part of learning                                                                |
| Returning after inactivity | Nonjudgmental; enable return without guilt                                                                             |
| Reminder                   | Friendly, brief, useful, without pressure                                                                              |
| Technical failure          | Precise and responsible; explain the problem and next action                                                           |
| Payment/subscription       | Professional and transparent about prices, terms, and limitations                                                      |
| Feature discovery          | Curious and engaging about actual benefits                                                                             |
| Social communication       | Creative and educational, with a useful point and clear perspective; external channels are outside this frontend scope |

PDF §10, pages 4–5: sample welcome, review, return, error, and deck-creation texts are illustrative. Validate each against the real release and operation before adopting it. A sample result count or server-error explanation is not evidence that the current operation had that result or cause.

PDF §§11–13, page 5:

- Do not promise learning without forgetting or guaranteed results.
- Do not induce guilt to increase return, define success only through streaks, or use unsupported motivational clichés.
- Do not joke about technical errors, payments, or security, or apply psychological pressure to sell subscriptions.
- Do not present unreleased features as available or certain. Do not invent statistics, progress, or outcomes.
- Before publishing copy, check clarity, respectful warmth, factual accuracy, absence of exaggeration, contextual tone, brevity without surplus information, and alignment with Lerona's intelligent, supportive, curious personality.

## Product and architectural boundaries

Implementation scope is `Frontend/`. Source candidates include [root composition](../../src/app/_layout.tsx), [application composition](../../src/core/composition/application.ts), [repository composition](../../src/core/composition/repositories.ts), and the feature-level presentation/application/domain/data directories. Preserve existing layer/import boundaries, platform-independent domain/use cases, and repository/port-based persistence and native integrations.

The following must survive refinement and be verified in affected flows:

| Protected area                                                                                                 | Contract/source candidates to validate during Phase 0                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Learning, scheduling, answer atomicity, session lifecycle and real analytics                                   | [review-system](../review-system.md), [scheduling-contract-v2](../scheduling-contract-v2.md), [concurrency-integrity](../concurrency-integrity.md), `src/features/study/`, `src/features/analytics/`                                                                           |
| Entitlement limits and truthful plan availability                                                              | [access-limits](../access-limits.md), [plus-paywall](../plus-paywall.md), `src/core/access/`, `src/core/sync/subscription.ts`; inspect [backend limits](../../../Backend/ACCESS-LIMITS.md) when needed                                                                         |
| Authentication, reset proofs, token/session transitions and credential clearing                                | [phone-authentication](../phone-authentication.md), [secure-logout](../secure-logout.md), [current backend authentication report](../../../Backend/docs/PHONE_PASSWORD_OTP_REPORT.md), `src/features/auth/`, `src/core/sync/phone-auth.ts`                                     |
| Myket verification, pending-payment recovery and server authority                                              | [myket-payments](../myket-payments.md), [backend Myket contract](../../../Backend/MYKET-PAYMENTS.md), `src/features/payments/`, `src/core/sync/myket-payment.ts`                                                                                                               |
| Guest/account storage isolation and explicit additive guest transfer                                           | [guest-mode](../guest-mode.md), [guest-data-migration](../guest-data-migration.md), `src/core/storage/`, `src/core/sync/guest-transfer.ts`                                                                                                                                     |
| Sync idempotency, versions/cursors, immutable review history, outbox durability and explicit conflict recovery | [synchronization-reliability](../synchronization-reliability.md), `src/core/sync/contract.ts`, `src/core/sync/sync-engine.ts`                                                                                                                                                  |
| Backup verification, ownership, encryption/key retention, expiry, safe logout and recovery limitations         | [server-backups](../server-backups.md), [backend restore contract](../../../Backend/BACKUP-RESTORE-FIX.md), [backup lifecycle](../../../Backend/docs/backup-lifecycle.md)                                                                                                      |
| Exact card content, file-transfer safety and no silent content alteration                                      | [card-content-contract](../card-content-contract.md), [import-export](../import-export.md), [spreadsheet-export-security](../spreadsheet-export-security.md)                                                                                                                   |
| Theme and device-language persistence and scope behavior                                                       | `src/features/settings/data/sqlite-settings-repository.ts`, `src/features/settings/data/device-language-settings-repository.ts`, [theme provider](../../src/shared/theme/theme-provider.tsx), [localization provider](../../src/shared/localization/localization-provider.tsx) |

These are source candidates, not a declaration that every document is current or that every behavior is desirable. Validate contract authority and record contradictions. Backend inspection is read-only within this program unless separately authorized. Do not expand into Cent, dependency/security remediation, infrastructure operations, data cleanup, migrations, or new product capabilities by implication.

## Source-of-truth hierarchy and conflict handling

| Source class                                  | Governs                                                                | Does not establish                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Approved brand document                       | Brand identity, voice, communication principles                        | Actual feature availability, runtime correctness, or business rules   |
| Current implementation at a recorded revision | Existing technical behavior                                            | Correct UX, approved future behavior, or successful runtime execution |
| Validated business/domain/API contracts       | Required functionality and invariants                                  | Visual quality or approval for changes                                |
| Historical documents/reports                  | Dated decisions, observations, prior test results and unresolved gates | A current pass or automatically binding future presentation policy    |
| Approved refinement decisions                 | Authorized direction, standards and specific future changes            | Permission to break protected contracts or change backend behavior    |

This is a hierarchy by authority and subject, not a rule that code overrides brand or brand overrides safety. Record both sides of a conflict with exact sources, revisions/dates, affected flows, and consequences in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md). Distinguish a recommendation from a decision. Request owner/contract-owner clarification when the conflict prevents a safe conclusion; do not silently choose a source or implement a resolution. Record subsequent explicit approvals in [DECISION_LOG.md](DECISION_LOG.md).

## Program phases and approval rules

| Stage                                      | Scope/output                                                                                   | Gate                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Preparation                                | Repository discovery (completed and reviewed), program initialization (this task)              | Stop after these five documents; await instruction for Phase 0            |
| Phase 0 — Comprehensive Audit: 0.0         | Architecture, audit coverage, verification baseline                                            | Begin only after further instruction; no implementation                   |
| Phase 0: 0.1                               | Visual and design-system audit                                                                 | Evidence-based findings; no redesign implementation                       |
| Phase 0: 0.2                               | UX writing and localization audit                                                              | Brand/context and actual behavior traced in both languages                |
| Phase 0: 0.3                               | Feedback, notification and error-handling audit                                                | State, cause, recovery and delivery evidence                              |
| Phase 0: 0.4                               | Critical-flow and accessibility baseline review                                                | Native evidence and explicit limitations                                  |
| Phase 1 — Unified Experience Standards     | Visual guidelines, UX writing guidelines, feedback presentation policy, master refinement plan | Product owner approval required; do not treat draft standards as approved |
| Phase 2 — Visual Design-System Foundation  | Approved foundation work                                                                       | Explicit implementation approval required                                 |
| Phase 3 — Feedback Architecture Refinement | Approved feedback work                                                                         | Within explicitly approved implementation scope                           |
| Phase 4 — Integrated Feature Refinement    | Feature work following unified standards                                                       | Within explicitly approved implementation scope                           |
| Phase 5 — Critical-Flow Safety Review      | Review protected flow behavior and recovery                                                    | Evidence against approved contracts                                       |
| Phase 6 — Final Quality Assurance          | Integrated visual, language, accessibility, theme and critical-flow verification               | Record remaining gates and approvals; no automatic release authorization  |

No implementation before explicit approval. Approval for one phase or frontend task does not imply backend, deployment, purchases, live SMS, production data actions, or closure of historical release gates. The current authorization permits only creating/modifying `PROGRAM_BRIEF.md`, `PROGRAM_STATUS.md`, `DECISION_LOG.md`, `OPEN_QUESTIONS.md`, and `AUDIT_COVERAGE.md` in this directory. Preserve unrelated changes; do not commit without instruction.

## Special visual investigation for Phase 0.1

Inspect these supplied images during the future visual audit, not during initialization:

- [تصویر ChatGPT ۲۴ آبان ۱۴۰۵، ۱۲_۳۸_۲۲.jpg](<../../../information/تصویر ChatGPT ۲۴ آبان ۱۴۰۵، ۱۲_۳۸_۲۲.jpg>)
- [تصویر ChatGPT ۲۴ آبان ۱۴۰۵، ۱۲_۳۸_۳۴.jpg](<../../../information/تصویر ChatGPT ۲۴ آبان ۱۴۰۵، ۱۲_۳۸_۳۴.jpg>)
- [تصویر ChatGPT ۲۴ آبان ۱۴۰۵، ۱۲_۳۹_۵۳.jpg](<../../../information/تصویر ChatGPT ۲۴ آبان ۱۴۰۵، ۱۲_۳۹_۵۳.jpg>)

Map each image to its screen/state, establish available build/date/device/theme/language provenance, and compare against a known current artifact. If exact provenance is unavailable, say so and label the comparison's limits. Do not copy these images as a design target.

Investigate visual hierarchy, natural eye flow, visual weight, optical alignment, grouping, spacing rhythm, competing focal points, information density, primary/secondary action hierarchy, excessive borders/dividers/cards/decoration, relationships between sections, typography hierarchy, and cognitive load. These are investigation dimensions, not findings. Treat the owner's discomfort as a qualitative report; do not invent eye-tracking measurements, participant testing, or a confirmed causal diagnosis.

## Evidence and runtime requirements

- Separate owner-approved decisions, source-confirmed facts, executed observations, historical evidence, hypotheses and recommendations. Coverage discovery is not an audit pass.
- For future findings record affected source/screen, reproducible state, platform/build/revision, theme/language, evidence, uncertainty, user consequence, relevant brand/contract, and needed verification. Do not infer failures from missing evidence.
- Physical Android is primary. Record device/Android version, app/build identity, font/display settings, language, theme, fixture and capture conditions. Web is supplementary only where equivalent support is demonstrated; it cannot establish native persistence, Myket, SecureStore, reminder delivery, TalkBack, or native modal behavior.
- Cover light/dark × Persian/English, mixed-direction content, large text/display settings, reduced motion, TalkBack, focus/announcements, modal dismissal/retry, and applicable offline/denied/interrupted/recovery states.
- The Step 01 ADB initialization failure (`adb` unable to create `\.android`, permission denied) remains unresolved. Do not attempt resolution in this task. Owner availability of a phone does not close connection, installation, or runtime evidence gaps.
- Preserve [historical release gates](../../../remediation-phase-07/RELEASE-GATES.md) and [Phase 7A risk register](../../../remediation-phase-07a/FINAL-RISK-REGISTER.md). Their phase numbering belongs to an earlier effort, not this program. Prior browser/OPFS, dark-feedback, dependency, native, SQL Server, spreadsheet and recovery limitations remain carried forward until supported evidence or an explicit decision updates them.
- Token calculations, mocks, tests, static compilation, old screenshots and browser-sized mobile viewports are useful evidence with limits; none are physical Android verification. Never relabel old results as fresh execution.

## Success criteria

Initialization is complete when these five linked documents record the approved authority, boundaries, baseline, decisions, unresolved questions and actual inventory with no area falsely marked audited. No code, existing documentation, configuration, dependencies or backend files change.

For later phases, success requires traceable coverage and findings; owner-approved unified standards and implementation scope; preservation of purple identity, neutral charcoal dark theme and protected behavior; context-appropriate Persian/English communication; evidence for affected states in both themes; Android accessibility and critical-flow verification; and explicit disposition of limitations and release gates. Improvement claims must name their evidence. Targets and acceptance methods not already approved are established in Phase 0/1 rather than invented as completed outcomes here.

# App feedback

Errors and operation notices use `src/shared/ui/feedback-modal.tsx`, not top banners or inline status paragraphs. This includes logout receipts, authentication, resource-loading failures, form validation, card creation, dictionary/pronunciation failures, guest transfer, backups, and file import/export results.

- Modals provide localized English/Persian headings and close buttons, accessible focus, Android back dismissal, and scrollable content for long messages or large text.
- Concurrent feedback is queued so only one feedback modal is presented at a time. Unmounted messages are removed from the queue.
- Dismissal hides a notice until its message or explicit `eventKey` changes. Use a stable operation result as `eventKey` when separate operations can return the same message. Clear form errors on dismissal so a repeated invalid submission can present them again.
- `onRetry` provides recovery in the modal and keeps a retry button available after dismissal. Do not duplicate that button elsewhere while the modal is visible.
- Errors inside an existing confirmation modal remain there. Shared destructive confirmations now use a native modal as well.
- Free-plan limits also use feedback modals. Sync conflict choices stay inside their notice, with a button to reopen dismissed conflicts; credential-removal retry remains available after closing a logout failure.

Keep essential page content inline: editable fields, study questions/results, charts, current account/subscription/backup status, loading/progress indicators, and explanations required to make a safe choice. These are not transient notifications. Study completion still shows the result screen first; its Done action opens analytics.

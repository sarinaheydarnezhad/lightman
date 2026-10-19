# Due-card reminders

The existing local reminder preference now schedules dated notifications only when the current
storage scope has cards due. Counts use the same scheduler rules as the study queue; deleted cards
and decks are excluded. English and Persian notification bodies include the localized count.

The app plans the next 30 local daily reminder times. Counts reflect the saved local review state
for each date, assuming no further reviews. Creation, deletion, edits, reviews, sync pulls, startup,
foregrounding, and storage-scope changes refresh the plan. Empty queues produce no notifications
while retaining the enabled preference. Guest and account scopes never contribute to one another's
counts. A refresh failure cancels stale reminders without undoing a successful learning-data write.

These are local OS-scheduled notifications, not a background server job. Opening the app replenishes
the 30-day window. Changes on another device cannot affect notifications until this device syncs.
Notification permission, OS delivery, timezone/DST changes, and delivery with the app terminated
still require physical-device verification. No claim is made of continuous background database
checks or delivery beyond the planning window without reopening the app.

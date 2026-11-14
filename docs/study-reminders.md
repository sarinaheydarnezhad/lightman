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

## Calendar and refresh behavior

Each of the 30 dates independently applies the selected local `HH:mm`. A nonexistent spring-forward
minute moves forward by the device calendar's gap for that date; later days return to the selected
time. A repeated fall-back minute uses the first occurrence and schedules only once for that local
day. A time equal to or before the current instant starts on the next day. No additional reminder
frequency or indefinite repeating fallback is introduced: a repeating notification cannot maintain
the existing due-card counts and suppress empty dates without database execution.

The OS queue contains absolute date triggers. A timezone change is reconciled on the next existing
startup/foreground/data/settings refresh; until then, previously queued instants retain their old
interpretation. There is no background timezone observer or replenishment job. Reopening after
more than 30 days creates a new bounded window, without backfilling missed alerts. Incremental
reconciliation keeps uniquely matching notifications, cancels obsolete/duplicate entries and adds
only missing dates. Existing replacement compensation and owner-scoped settings ordering remain.

Installed expo-notifications 57.0.21 uses Android exact-and-allow-while-idle when permitted and
inexact-and-allow-while-idle otherwise. Its boot receiver restores persisted requests after reboot;
this cannot replenish the application plan. No exact-alarm permission, background service, remote
push or dependency was added. iOS scheduling is bounded to 30 Lerona requests, below the historical
64-pending-notification limit; capacity shared with other app requests and current OS behavior need
device verification. Permission revocation, disabled channels, Focus modes, battery optimization,
force-stop and vendor restrictions can delay or suppress delivery. Web local reminders remain
unsupported. Saved settings are not evidence of OS delivery.

## Phase 7 device checklist

Use synthetic data on supported release-build Android/iOS devices. Verify enabled/disabled states,
selected time changes, empty/due queues, repeated refresh and restart without duplicates, partial
scheduling/cancellation failures and compensation, permission denial/revocation/regrant, unrelated
alerts, original owner isolation and the existing logout/account-switch behavior. Do not alter
authentication or account transitions. Check offline/terminated delivery, Android reboot/force-stop,
notification channels, battery saver/Doze, iOS Focus/summary, timezone travel while closed and after
foreground, spring-forward/fall-back, midnight/year boundaries and inactivity past the horizon.
Record actual pending native requests and delivery timestamps; mocked API tests cannot establish
these guarantees. Obtain explicit permission before triggering any real device notification.

References: [Expo notifications](https://docs.expo.dev/versions/latest/sdk/notifications/),
[Android alarms](https://developer.android.com/develop/background-work/services/alarms/schedule),
[Apple notification scheduling](https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app),
and Apple's [historical pending limit](https://developer.apple.com/documentation/uikit/uilocalnotification).
Installed package source is authoritative for this pinned SDK; latest online examples may differ.

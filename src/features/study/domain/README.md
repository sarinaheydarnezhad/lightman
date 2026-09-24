# Leitner review rules

- New cards start in Box 1, due on the local review calendar day, with zero reviews and no last-reviewed instant.
- Success advances one box, capped at Box 5. The **new** box determines the next interval: Boxes 1–5 correspond to 1, 2, 4, 8, and 16 calendar days. The interval policy is replaceable.
- Failure resets to Box 1 and is due again on the same review day; no additional penalty applies.
- Due means `dueDate <= targetDate`. Overdue cards stay due and keep their box until reviewed. The due queue orders by earliest due date, lower box, then card ID.
- Every review increments total reviews. Success increments total successes and consecutive successes; failure resets consecutive successes only. Box and consecutive successes are independent.
- Review instants are UTC timestamps. Due dates and the supplied review date are `YYYY-MM-DD` local calendar dates with no offset. The application converts its clock's review instant using the clock's current IANA time zone in `core/domain/values.ts`. Calendar-day addition uses date components, so daylight saving and timezone changes do not turn a day into 24 elapsed hours. A stored due date is compared with the user's current local calendar date.

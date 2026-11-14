import { calendarDate, instant, type CalendarDate, type Instant } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';

export interface ReviewCalendar {
  readonly reviewDate: CalendarDate;
  /** Minutes east of UTC at the review instant, not the device's current offset. */
  readonly utcOffsetMinutes: number;
}

export const futureClockToleranceMs = 5 * 60_000;

export function validateReviewCalendar(value: ReviewCalendar, reviewedAt: Instant): ReviewCalendar {
  instant(reviewedAt);
  const date = calendarDate(value.reviewDate);
  if (
    !Number.isInteger(value.utcOffsetMinutes) ||
    Math.abs(value.utcOffsetMinutes) > 840 ||
    new Date(Date.parse(reviewedAt) + value.utcOffsetMinutes * 60_000)
      .toISOString()
      .slice(0, 10) !== date
  )
    throw new AppError(
      'validation',
      'Review calendar does not match the review instant and UTC offset.',
    );
  return Object.freeze({ reviewDate: date, utcOffsetMinutes: value.utcOffsetMinutes });
}

export function reviewCalendarAt(reviewedAt: Instant, timeZone: string): ReviewCalendar {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(reviewedAt));
  const part = (name: string) => Number(parts.find((item) => item.type === name)!.value);
  const wall = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  const utcOffsetMinutes = Math.round(
    (wall - Math.floor(Date.parse(reviewedAt) / 1000) * 1000) / 60_000,
  );
  return validateReviewCalendar(
    { reviewDate: calendarDate(new Date(wall).toISOString().slice(0, 10)), utcOffsetMinutes },
    reviewedAt,
  );
}

/** A date-only queue cannot diagnose sub-day skew. More than one UTC day ahead is unambiguous. */
export function needsClockRecovery(lastReviewedAt: Instant | null, today: CalendarDate): boolean {
  return (
    lastReviewedAt !== null &&
    Date.parse(lastReviewedAt) > Date.parse(`${today}T23:59:59.999Z`) + 86_400_000
  );
}

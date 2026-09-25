import type { AppClock } from '@/core/ports/platform';
import { AppError } from '@/core/errors/app-error';

/** ISO 8601 UTC instant, for events and entity timestamps. */
export type Instant = string & { readonly __instant: unique symbol };
/** ISO calendar day without a time zone, for due dates. */
export type CalendarDate = string & { readonly __calendarDate: unique symbol };
/** Wall-clock hour and minute, interpreted in the user's local time zone. */
export type LocalTime = string & { readonly __localTime: unique symbol };
/** BCP 47 language tag such as en, es, or fa-IR. */
export type LanguageTag = string & { readonly __languageTag: unique symbol };

export function instant(value: string): Instant {
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    throw new AppError('validation', 'Expected a valid UTC instant.');
  return value as Instant;
}

export function now(clock: AppClock): Instant {
  return instant(clock.now().toISOString());
}

export function calendarDate(value: string): CalendarDate {
  instant(`${value}T00:00:00.000Z`);
  return value as CalendarDate;
}

/** Add calendar days in the date-only space; no local elapsed-hour arithmetic is involved. */
export function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  calendarDate(date);
  if (!Number.isSafeInteger(days))
    throw new AppError('validation', 'Calendar-day interval must be a safe integer.');
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(0);
  value.setUTCFullYear(year!, month! - 1, day! + days);
  const next = `${String(value.getUTCFullYear()).padStart(4, '0')}-${String(
    value.getUTCMonth() + 1,
  ).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  return calendarDate(next);
}

/** Interpret a UTC review instant in the user's current IANA time zone. */
export function calendarDateAtInstant(value: Instant, timeZone: string): CalendarDate {
  return localCalendarDateConverter(timeZone)(value);
}

/** Reuse one formatter for bulk local-day calculations such as analytics. */
export function localCalendarDateConverter(timeZone: string): (value: Instant) => CalendarDate {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return (value) => {
      instant(value);
      const parts = formatter.formatToParts(new Date(value));
      const part = (type: string) => parts.find((item) => item.type === type)?.value;
      return calendarDate(`${part('year')}-${part('month')}-${part('day')}`);
    };
  } catch {
    throw new AppError('validation', 'Invalid review time zone.');
  }
}

/** Workflow durations use instants, independently of review calendar dates. */
export function durationInMilliseconds(start: Instant, end: Instant): number {
  instant(start);
  instant(end);
  if (end < start) throw new AppError('validation', 'End time cannot precede start time.');
  return Date.parse(end) - Date.parse(start);
}

export function localTime(value: string): LocalTime {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new AppError('validation', 'Local time must use HH:mm (24-hour time).');
  }
  return value as LocalTime;
}

export function languageTag(value: string): LanguageTag {
  const normalized = value.trim();
  if (!/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(normalized)) {
    throw new AppError('validation', 'Expected a language tag such as en or fa-IR.');
  }
  return normalized as LanguageTag;
}

export function requiredId(value: string, name = 'ID'): string {
  if (!value?.trim()) throw new AppError('validation', `${name} is required.`);
  return value;
}

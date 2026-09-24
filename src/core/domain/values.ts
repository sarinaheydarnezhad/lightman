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

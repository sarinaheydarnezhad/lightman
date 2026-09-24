import { AppError } from '@/core/errors/app-error';
import { fixedClock } from '@/../test/fixtures';
import {
  addCalendarDays,
  calendarDate,
  calendarDateAtInstant,
  durationInMilliseconds,
  instant,
  languageTag,
  localTime,
  now,
} from './values';

test('clock controls instants, while dates and local times are distinct', () => {
  expect(now(fixedClock)).toBe('2026-09-24T10:00:00.000Z');
  expect(calendarDate('2026-02-28')).toBe('2026-02-28');
  expect(localTime('23:59')).toBe('23:59');
  expect(languageTag('fa-IR')).toBe('fa-IR');
  for (const value of ['2026-02-30', '2026-13-01'])
    expect(() => calendarDate(value)).toThrow(AppError);
  expect(() => localTime('9:00')).toThrow(AppError);
  expect(() => instant('2026-02-30T00:00:00.000Z')).toThrow(AppError);
});

test.each([
  ['2026-01-31', 1, '2026-02-01'],
  ['2026-02-28', 1, '2026-03-01'],
  ['2028-02-28', 1, '2028-02-29'],
  ['2028-02-29', 1, '2028-03-01'],
  ['2026-09-24', 7, '2026-10-01'],
  ['2026-12-31', 1, '2027-01-01'],
  ['2026-03-08', 1, '2026-03-09'],
  ['2026-11-01', 1, '2026-11-02'],
] as const)('calendar arithmetic adds %i to %s as %s', (date, days, expected) => {
  expect(addCalendarDays(calendarDate(date), days)).toBe(expected);
});

test('local review days follow the supplied IANA time zone at DST and travel boundaries', () => {
  const beforeSpring = instant('2026-03-08T04:59:00.000Z');
  const afterSpring = instant('2026-03-08T07:01:00.000Z');
  expect(calendarDateAtInstant(beforeSpring, 'America/New_York')).toBe('2026-03-07');
  expect(calendarDateAtInstant(afterSpring, 'America/New_York')).toBe('2026-03-08');
  expect(calendarDateAtInstant(afterSpring, 'Asia/Tehran')).toBe('2026-03-08');
  const beforeFall = instant('2026-11-01T03:59:00.000Z');
  const afterFall = instant('2026-11-01T06:01:00.000Z');
  expect(calendarDateAtInstant(beforeFall, 'America/New_York')).toBe('2026-10-31');
  expect(calendarDateAtInstant(afterFall, 'America/New_York')).toBe('2026-11-01');
  const travel = instant('2026-09-24T23:30:00.000Z');
  expect(calendarDateAtInstant(travel, 'America/Los_Angeles')).toBe('2026-09-24');
  expect(calendarDateAtInstant(travel, 'Asia/Tehran')).toBe('2026-09-25');
  expect(() => calendarDateAtInstant(travel, 'Not/A_Time_Zone')).toThrow(AppError);
  expect(() => addCalendarDays(calendarDate('2026-09-24'), 1.5)).toThrow(AppError);
});

test('session duration uses instants and rejects reverse time', () => {
  const start = instant('2026-09-24T10:00:00.000Z');
  const end = instant('2026-09-24T10:05:00.000Z');
  expect(durationInMilliseconds(start, end)).toBe(300000);
  expect(() => durationInMilliseconds(end, start)).toThrow(AppError);
});

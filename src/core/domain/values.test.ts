import { AppError } from '@/core/errors/app-error';
import { fixedClock } from '@/../test/fixtures';
import { calendarDate, instant, languageTag, localTime, now } from './values';

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

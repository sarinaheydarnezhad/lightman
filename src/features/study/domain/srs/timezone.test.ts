import {
  addCalendarDays,
  calendarDate,
  calendarDateAtInstant,
  instant,
} from '@/core/domain/values';
import { makeState } from '@/../test/fixtures';
import { calculateReviewTransition, isCardDue } from '../leitner-srs';

test('review instant and local review date remain separate when offset crosses UTC midnight', () => {
  // 2026-09-24T23:45:12+03:30 = 2026-09-24T20:15:12.000Z.
  const reviewedAt = instant('2026-09-24T20:15:12.000Z');
  const reviewDate = calendarDateAtInstant(reviewedAt, 'Asia/Tehran');
  expect(reviewDate).toBe('2026-09-24');
  expect(calculateReviewTransition(makeState(), 'success', reviewDate, reviewedAt)).toMatchObject({
    newDueDate: '2026-09-26',
    updatedReviewState: { lastReviewedAt: reviewedAt },
  });
});

test('same UTC instant may have different local review dates without changing stored due-day semantics', () => {
  const at = instant('2026-09-24T23:30:00.000Z');
  const storedDue = calendarDate('2026-09-24');
  const west = calendarDateAtInstant(at, 'America/Los_Angeles');
  const east = calendarDateAtInstant(at, 'Asia/Tehran');
  expect(west).toBe('2026-09-24');
  expect(east).toBe('2026-09-25');
  expect(storedDue).toBe('2026-09-24');
  expect(isCardDue(storedDue, west)).toBe(true);
  expect(isCardDue(storedDue, east)).toBe(true);
  expect(isCardDue(calendarDate('2026-09-25'), west)).toBe(false);
  expect(isCardDue(calendarDate('2026-09-25'), east)).toBe(true);
});

test.each([
  ['America/New_York', '2026-03-08T04:59:00.000Z', '2026-03-07'],
  ['America/New_York', '2026-03-08T07:01:00.000Z', '2026-03-08'],
  ['America/New_York', '2026-11-01T03:59:00.000Z', '2026-10-31'],
  ['America/New_York', '2026-11-01T06:01:00.000Z', '2026-11-01'],
  ['Europe/Berlin', '2026-03-29T00:30:00.000Z', '2026-03-29'],
  ['Europe/Berlin', '2026-10-25T00:30:00.000Z', '2026-10-25'],
] as const)('%s maps %s to local date %s across DST', (zone, value, date) => {
  expect(calendarDateAtInstant(instant(value), zone)).toBe(date);
});

test.each([
  ['2026-03-08', '2026-03-09'],
  ['2026-11-01', '2026-11-02'],
  ['2026-03-29', '2026-03-30'],
  ['2026-10-25', '2026-10-26'],
] as const)('DST boundary %s plus one day always yields calendar day %s', (date, next) => {
  expect(addCalendarDays(calendarDate(date), 1)).toBe(next);
});

test('an invalid IANA time zone is rejected at the conversion boundary', () => {
  expect(() =>
    calendarDateAtInstant(instant('2026-09-24T23:30:00.000Z'), 'Invalid/TimeZone'),
  ).toThrow('Invalid review time zone.');
});

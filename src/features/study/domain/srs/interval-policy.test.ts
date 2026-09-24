import { makeState } from '@/../test/fixtures';
import { calendarDate, instant } from '@/core/domain/values';
import { calculateReviewTransition, getIntervalDays } from '../leitner-srs';
import type { LeitnerBox } from '../review';

test.each([
  [1, 1],
  [2, 2],
  [3, 4],
  [4, 8],
  [5, 16],
] as const)('Box %i has exactly a %i-calendar-day interval', (box, interval) => {
  expect(getIntervalDays(box)).toBe(interval);
});

test.each([0, 6, -1, 1.5, NaN, Infinity, -Infinity])(
  'rejects invalid interval-policy box %s at runtime',
  (box) => {
    expect(() => getIntervalDays(box as LeitnerBox)).toThrow('Leitner box must be 1 through 5.');
  },
);

test('a custom policy changes successful spacing but cannot change box promotion or same-day failure', () => {
  const policy = { getIntervalDays: (box: LeitnerBox) => box * 3 };
  const date = calendarDate('2026-09-24');
  const at = instant('2026-09-24T18:45:12.000Z');
  expect(calculateReviewTransition(makeState(), 'success', date, at, policy)).toMatchObject({
    newBox: 2,
    intervalDays: 6,
    newDueDate: '2026-09-30',
  });
  expect(calculateReviewTransition(makeState(), 'failure', date, at, policy)).toMatchObject({
    newBox: 1,
    intervalDays: 0,
    newDueDate: date,
  });
});

test.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid custom calendar-day interval %s',
  (interval) => {
    expect(() => getIntervalDays(2, { getIntervalDays: () => interval })).toThrow(
      'Review interval must be a positive number of calendar days.',
    );
  },
);

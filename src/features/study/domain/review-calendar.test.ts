import vectors from '@/../test/fixtures/review-calendar-vectors.json';
import { calendarDate, instant } from '@/core/domain/values';
import { reviewCalendarAt, validateReviewCalendar } from './review-calendar';
import { mergeReviewEvents } from '@/core/sync/review-merge';
import { createReviewEngine } from './review-engine-impl';

describe.each(['leitner', 'sm2'] as const)('%s cross-runtime calendar vectors', (system) => {
  test.each(vectors)(
    '$zone at $instant preserves $day through duplicates and timezone changes',
    (vector) => {
      const time = instant(vector.instant);
      const calendar = reviewCalendarAt(time, vector.zone);
      expect(calendar).toEqual({ reviewDate: vector.day, utcOffsetMinutes: vector.offset });
      const scheduler = createReviewEngine().getScheduler(system);
      const event = {
        id: 'same-event',
        reviewedAt: time,
        result: 'success' as const,
        reviewCalendar: calendar,
        serverVersion: 1,
      };
      const before = JSON.stringify(event);
      // The device may have travelled or its current timezone service may be unavailable.
      // Reconstruction must use only the saved calendar, never consult that service again.
      const currentZone = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
        throw new Error('Current device timezone changed or is unavailable');
      });
      try {
        expect(mergeReviewEvents('card', time, [event, event], scheduler).dueDate).toBe(
          vector[system],
        );
      } finally {
        currentZone.mockRestore();
      }
      expect(JSON.stringify(event)).toBe(before);
    },
  );
});

test('calendar metadata must describe the actual recorded instant and offset', () => {
  expect(() =>
    validateReviewCalendar(
      { reviewDate: calendarDate('2026-11-13'), utcOffsetMinutes: 0 },
      instant('2026-11-12T21:30:00.000Z'),
    ),
  ).toThrow('does not match');
  expect(() =>
    validateReviewCalendar(
      { reviewDate: calendarDate('2026-11-13'), utcOffsetMinutes: 841 },
      instant('2026-11-13T00:00:00.000Z'),
    ),
  ).toThrow();
});

test('legacy events use a documented UTC fallback without inventing a zone', () => {
  expect(
    mergeReviewEvents('card', instant('2026-11-12T00:00:00.000Z'), [
      { id: 'legacy', reviewedAt: instant('2026-11-12T21:30:00.000Z'), result: 'success' },
    ]).dueDate,
  ).toBe('2026-11-14');
});

test('immutable identity collisions cannot be hidden by duplicate suppression', () => {
  const time = instant('2026-11-13T00:00:00.000Z');
  expect(() =>
    mergeReviewEvents('card', time, [
      { id: 'same', reviewedAt: time, result: 'success' },
      { id: 'same', reviewedAt: time, result: 'failure' },
    ]),
  ).toThrow('identity collision');
});

import { instant } from '@/core/domain/values';
import { mergeReviewEvents } from './review-merge';

test('two offline devices merge all review results in server-cursor order rather than choosing a box', () => {
  const cardId = '00000000-0000-4000-8000-000000000001';
  const createdAt = instant('2026-09-20T00:00:00.000Z');
  const phoneA = [
    { reviewedAt: instant('2026-09-21T10:00:00.000Z'), result: 'success' as const },
    { reviewedAt: instant('2026-09-22T10:00:00.000Z'), result: 'success' as const },
    { reviewedAt: instant('2026-09-23T10:00:00.000Z'), result: 'success' as const },
  ];
  const phoneB = [{ reviewedAt: instant('2026-09-22T09:00:00.000Z'), result: 'failure' as const }];
  const canonical = [...phoneB, ...phoneA];
  const mergedA = mergeReviewEvents(cardId, createdAt, canonical);
  const mergedB = mergeReviewEvents(cardId, instant('2026-09-24T00:00:00.000Z'), canonical);
  expect(mergedA).toEqual(mergedB);
  expect(mergedA.totalReviews).toBe(4);
  expect(mergedA.totalSuccesses).toBe(3);
  expect(mergedA.box).toBe(4);
  expect(phoneA).toHaveLength(3);
  expect(phoneB).toHaveLength(1);
});

test('client timestamps cannot reorder server history; earlier clocks never erase an event', () => {
  const state = mergeReviewEvents('00000000-0000-4000-8000-000000000001',
    instant('2026-09-20T00:00:00.000Z'), [
      { reviewedAt: instant('2026-09-25T12:00:00.000Z'), result: 'success' },
      { reviewedAt: instant('2026-09-21T08:00:00.000Z'), result: 'failure' },
    ]);
  expect(state.box).toBe(1);
  expect(state.totalReviews).toBe(2);
  expect(state.totalSuccesses).toBe(1);
});

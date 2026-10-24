import { calendarDate, instant } from '@/core/domain/values';
import { timestamp } from '@/../test/fixtures';
import { validateStudySession, validateStudyScope, type StudyQueueItem } from './study-session';
import {
  advanceStudySession,
  assertCurrentStudyItem,
  cancelStudySession,
  getCurrentStudyItem,
  getStudyProgress,
  startStudySession,
} from './study-session-workflow';

const item = (cardId: string): StudyQueueItem => ({
  cardId,
  deckId: 'deck-1',
  dueDate: calendarDate('2026-09-24'),
  box: 1,
});
const scope = { kind: 'specific-deck' as const, deckId: 'deck-1' };

test('a study session copies its queue and checks scope and bounded position', () => {
  const queue = [item('card-a'), item('card-b')];
  const session = startStudySession('session-1', scope, queue, timestamp);
  queue.push(item('card-c'));
  expect(session.initialQueue.map((card) => card.cardId)).toEqual(['card-a', 'card-b']);
  expect(session).toMatchObject({ status: 'in-progress', currentIndex: 0, retryQueue: [] });
  expect(() => validateStudySession({ ...session, currentIndex: -1 })).toThrow();
  expect(() => validateStudySession({ ...session, currentIndex: 3 })).toThrow();
  expect(() =>
    validateStudySession({ ...session, initialQueue: [item('card-a'), item('card-a')] }),
  ).toThrow();
  expect(() => validateStudyScope({ kind: 'specific-deck', deckId: '' })).toThrow();
  expect(() => validateStudyScope({ kind: 'other' } as never)).toThrow();
  expect(() =>
    startStudySession('session-2', scope, [item('card-a'), item('card-a')], timestamp),
  ).toThrow();
});

test('failed cards are saved for optional review without extending the session', () => {
  const start = startStudySession('session-1', scope, [item('card-a'), item('card-b')], timestamp);
  const first = getCurrentStudyItem(start)!;
  const afterFirst = advanceStudySession(start, first, 'failure', timestamp);
  expect(getCurrentStudyItem(afterFirst)).toMatchObject({ cardId: 'card-b', kind: 'initial' });
  expect(afterFirst.retryQueue).toEqual([]);
  expect(afterFirst.missedQueue?.map((card) => card.cardId)).toEqual(['card-a']);
  expect(getStudyProgress(afterFirst)).toMatchObject({ completed: 1, remaining: 1, failures: 1 });
  const completed = advanceStudySession(
    afterFirst,
    getCurrentStudyItem(afterFirst)!,
    'success',
    timestamp,
  );
  expect(completed).toMatchObject({ status: 'completed', currentIndex: 2, completedAt: timestamp });
  expect(completed.retryQueue).toEqual([]);
  expect(getCurrentStudyItem(completed)).toBeNull();
  expect(getStudyProgress(completed)).toMatchObject({
    completed: 2,
    remaining: 0,
    failures: 1,
    retries: 0,
    successfulInitialAnswers: 1,
    failedInitialAnswers: 1,
    finalSuccessCount: 1,
    missedCardCount: 1,
    canReviewAgain: true,
  });
  expect(start.currentIndex).toBe(0);
  expect(start.retryQueue).toEqual([]);
});

test('one failed card completes immediately and rejects repeated answers', () => {
  const start = startStudySession('session-1', scope, [item('card-a')], timestamp);
  const initial = getCurrentStudyItem(start)!;
  const afterFailure = advanceStudySession(start, initial, 'failure', timestamp);
  expect(afterFailure.status).toBe('completed');
  expect(getCurrentStudyItem(afterFailure)).toBeNull();
  expect(() =>
    assertCurrentStudyItem(afterFailure, initial.cardId, initial.presentationId),
  ).toThrow();
  expect(() => advanceStudySession(afterFailure, initial, 'success', timestamp)).toThrow();
});

test('saved legacy retry queues remain valid and do not gain additional retries', () => {
  const start = startStudySession('session-1', scope, [item('card-a')], timestamp);
  const legacy = validateStudySession({
    ...start,
    currentIndex: 1,
    retryQueue: [item('card-a')],
    missedQueue: undefined,
    initialFailures: undefined,
  });
  const retry = getCurrentStudyItem(legacy)!;
  expect(retry).toMatchObject({ cardId: 'card-a', kind: 'retry', presentationId: 'session-1:1' });
  const completed = advanceStudySession(legacy, retry, 'failure', timestamp);
  expect(completed.status).toBe('completed');
  expect(completed.retryQueue).toHaveLength(1);
  expect(completed.missedQueue?.map((card) => card.cardId)).toEqual(['card-a']);
  expect(getStudyProgress(completed)).toMatchObject({ completed: 2, failures: 2, retries: 1 });
});

test('empty study session completes normally and active sessions can be cancelled without fake progress', () => {
  const empty = startStudySession('session-empty', { kind: 'all-decks' }, [], timestamp);
  expect(empty.status).toBe('completed');
  expect(getCurrentStudyItem(empty)).toBeNull();
  expect(getStudyProgress(empty)).toMatchObject({
    initialQueueSize: 0,
    isComplete: true,
    completed: 0,
    remaining: 0,
    durationMs: 0,
  });
  const active = startStudySession('session-1', scope, [item('card-a')], timestamp);
  const cancelledAt = instant('2026-09-24T10:00:03.000Z');
  const cancelled = cancelStudySession(active, cancelledAt);
  expect(cancelled).toMatchObject({ status: 'cancelled', cancelledAt, currentIndex: 0 });
  expect(getStudyProgress(cancelled).durationMs).toBe(3000);
  expect(() => cancelStudySession(cancelled, cancelledAt)).toThrow();
  expect(() =>
    validateStudySession({ ...active, completedAt: instant('2026-09-24T09:00:00.000Z') }),
  ).toThrow();
  expect(() => cancelStudySession(active, instant('2026-09-24T09:00:00.000Z'))).toThrow();
});

test('session validation rejects invalid retry history, status, and queue metadata', () => {
  const start = startStudySession('session-1', scope, [item('card-a')], timestamp);
  expect(() => validateStudySession({ ...start, retryQueue: [item('unknown')] })).toThrow();
  expect(() => validateStudySession({ ...start, retrySuccesses: 1 })).toThrow();
  expect(() =>
    validateStudySession({ ...start, status: 'completed', completedAt: timestamp }),
  ).toThrow();
  expect(() =>
    validateStudySession({ ...start, initialQueue: [{ ...item('card-a'), box: 6 as never }] }),
  ).toThrow();
  expect(() =>
    startStudySession('invalid', scope, [{ ...item('card-a'), deckId: 'other' }], timestamp),
  ).toThrow();
});

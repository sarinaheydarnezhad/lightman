import { calendarDate } from '@/core/domain/values';
import { timestamp } from '@/../test/fixtures';
import {
  startStudySession,
  advanceStudySession,
  getCurrentStudyItem,
  cancelStudySession,
} from '../domain/study-session-workflow';
import { InMemoryStudySessionRepository } from './development-in-memory-study-session-repository';

const scope = { kind: 'all-decks' as const };
const item = {
  cardId: 'card-a',
  deckId: 'deck-1',
  dueDate: calendarDate('2026-09-24'),
  box: 1 as const,
};

test('repository starts empty, returns detached snapshots and rejects duplicate session IDs', async () => {
  const repository = new InMemoryStudySessionRepository();
  expect(await repository.getById('missing')).toBeNull();
  expect(await repository.getActive()).toBeNull();
  const input = startStudySession('session-1', scope, [item], timestamp);
  await repository.create(input);
  const detached = await repository.getById('session-1');
  expect(detached).toEqual(input);
  expect(detached).not.toBe(input);
  expect(detached?.initialQueue[0]).not.toBe(input.initialQueue[0]);
  Object.assign(detached!.initialQueue[0]!, { cardId: 'tampered' });
  expect((await repository.getActive())?.initialQueue[0]?.cardId).toBe('card-a');
  await expect(repository.create(input)).rejects.toMatchObject({ code: 'conflict' });
});

test('repository prevents concurrent sessions and stale progress updates', async () => {
  const repository = new InMemoryStudySessionRepository();
  const first = await repository.create(startStudySession('session-1', scope, [item], timestamp));
  await expect(
    repository.create(startStudySession('session-2', scope, [item], timestamp)),
  ).rejects.toMatchObject({ code: 'conflict' });
  const next = advanceStudySession(first, getCurrentStudyItem(first)!, 'success', timestamp);
  await expect(repository.update(next, 1)).rejects.toMatchObject({ code: 'conflict' });
  expect((await repository.getById(first.id))?.currentIndex).toBe(0);
  await repository.update(next, 0);
  expect(await repository.getActive()).toBeNull();
  await expect(repository.update(next, 0)).rejects.toMatchObject({ code: 'conflict' });
  expect(
    (await repository.create(startStudySession('session-2', scope, [item], timestamp))).status,
  ).toBe('in-progress');
});

test('repository retains completed/cancelled history and allows a new active session', async () => {
  const repository = new InMemoryStudySessionRepository();
  const empty = startStudySession('empty', scope, [], timestamp);
  await repository.create(empty);
  expect(await repository.getActive()).toBeNull();
  const active = await repository.create(startStudySession('active', scope, [item], timestamp));
  const cancelled = cancelStudySession(active, timestamp);
  await repository.update(cancelled, 0);
  expect(await repository.getActive()).toBeNull();
  expect((await repository.getById('active'))?.status).toBe('cancelled');
  expect((await repository.getById('empty'))?.status).toBe('completed');
  await expect(repository.update(cancelled, 0)).rejects.toMatchObject({ code: 'conflict' });
});

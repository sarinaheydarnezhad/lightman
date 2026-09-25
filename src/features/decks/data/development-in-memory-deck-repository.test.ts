import { AppError } from '@/core/errors/app-error';
import { instant } from '@/core/domain/values';
import { makeDeck } from '@/../test/fixtures';
import { InMemoryDeckRepository } from './development-in-memory-deck-repository';

test('deck search retains mixed Persian, Arabic, and Latin words', async () => {
  const decks = new InMemoryDeckRepository();
  await decks.create(makeDeck({ id: 'fa', name: 'فارسی English' }));
  await decks.create(makeDeck({ id: 'ar', name: 'العربية Travel' }));
  expect((await decks.list({ search: 'فارسی' })).map((deck) => deck.id)).toEqual(['fa']);
  expect((await decks.list({ search: 'العربية' })).map((deck) => deck.id)).toEqual(['ar']);
  expect((await decks.list({ search: 'TRAVEL' })).map((deck) => deck.id)).toEqual(['ar']);
});

test('create, update, search, archive and copy boundaries satisfy the deck contract', async () => {
  const repository = new InMemoryDeckRepository();
  const deck = makeDeck();
  expect(await repository.getById(deck.id)).toBeNull();
  expect(await repository.list()).toEqual([]);
  await repository.create(deck);
  await repository.create(makeDeck({ id: 'deck-2', name: 'Travel' }));
  expect((await repository.list({ search: '  VOCAB ' })).map((item) => item.id)).toEqual([
    'deck-1',
  ]);
  await expect(repository.create(deck)).rejects.toMatchObject({ code: 'conflict' });
  await expect(repository.update(makeDeck({ id: 'missing' }))).rejects.toMatchObject({
    code: 'not-found',
  });
  const result = await repository.getById(deck.id);
  expect(result).toEqual(deck);
  expect(result).not.toBe(deck);
  await repository.update({ ...deck, name: 'Languages' });
  expect(result?.name).toBe('Vocabulary');
  const archivedAt = instant('2026-09-24T11:00:00.000Z');
  await repository.archive(deck.id, archivedAt);
  expect((await repository.list()).map((item) => item.id)).toEqual(['deck-2']);
  expect(await repository.list({ includeArchived: true })).toHaveLength(2);
  await expect(repository.update(deck)).rejects.toMatchObject({ code: 'conflict' });
  await expect(repository.archive(deck.id, archivedAt)).rejects.toMatchObject({ code: 'conflict' });
  await expect(repository.archive('missing', archivedAt)).rejects.toMatchObject({
    code: 'not-found',
  });
  await expect(repository.create(makeDeck({ id: 'invalid', name: ' ' }))).rejects.toBeInstanceOf(
    AppError,
  );
});

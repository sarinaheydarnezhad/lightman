import { DevelopmentInMemoryDeckRepository } from './development-in-memory-deck-repository';

test('respects the deck repository contract and isolates returned values', async () => {
  const repository = new DevelopmentInMemoryDeckRepository();
  const deck = { id: 'd1', title: 'Vocabulary', createdAt: '2026-01-01T00:00:00.000Z' };
  expect(await repository.getById(deck.id)).toBeNull();
  await repository.save(deck);
  expect(await repository.list()).toEqual([deck]);
  const result = await repository.getById(deck.id);
  expect(result).toEqual(deck);
  expect(result).not.toBe(deck);
  await repository.save({ ...deck, title: 'Languages' });
  expect(result?.title).toBe('Vocabulary');
});

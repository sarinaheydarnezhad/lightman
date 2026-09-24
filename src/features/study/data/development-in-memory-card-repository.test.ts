import { instant } from '@/core/domain/values';
import { makeCard } from '@/../test/fixtures';
import { InMemoryCardRepository } from './development-in-memory-card-repository';

test('card repository creates, filters, updates and archives without exposing its copies', async () => {
  const cards = new InMemoryCardRepository();
  expect(await cards.getById('missing')).toBeNull();
  expect(await cards.listByDeck('deck-1')).toEqual([]);
  const original = makeCard();
  await cards.create(original);
  await cards.create(
    makeCard({ id: 'card-2', frontText: 'travel', meaning: 'journey', category: 'noun' }),
  );
  await cards.create(makeCard({ id: 'card-3', deckId: 'deck-2' }));
  await expect(cards.create(original)).rejects.toMatchObject({ code: 'conflict' });
  expect((await cards.listByDeck('deck-1', { search: 'NOUN' })).map((card) => card.id)).toEqual([
    'card-2',
  ]);
  const returned = await cards.getById('card-1');
  (returned?.examples as { sentence: string }[])[0]!.sentence = 'Changed';
  expect((await cards.getById('card-1'))?.examples[0]?.sentence).toBe('Hello, friend.');
  await cards.update(makeCard({ meaning: 'a greeting' }));
  expect((await cards.getById('card-1'))?.meaning).toBe('a greeting');
  await expect(cards.update(makeCard({ id: 'missing' }))).rejects.toMatchObject({
    code: 'not-found',
  });
  const archivedAt = instant('2026-09-24T11:00:00.000Z');
  await cards.archive('card-1', archivedAt);
  expect(await cards.listByDeck('deck-1')).toHaveLength(1);
  expect(await cards.listByDeck('deck-1', { includeArchived: true })).toHaveLength(2);
  await expect(cards.update(original)).rejects.toMatchObject({ code: 'conflict' });
  await expect(cards.archive('card-1', archivedAt)).rejects.toMatchObject({ code: 'conflict' });
  await expect(cards.archive('missing', archivedAt)).rejects.toMatchObject({ code: 'not-found' });
});

import { strToU8 } from 'fflate';
import { createApplication } from '@/core/application/create-application';
import { fixedClock, makeCard, makeDeck, makeRepositories, sequenceIds } from '@/../test/fixtures';
import { csvAdapter } from '../data/csv-adapter';
import { createTransferService } from './transfer-service';

function setup() {
  const repositories = makeRepositories();
  const app = createApplication(repositories, fixedClock, sequenceIds());
  const service = createTransferService(app, repositories, {
    csv: csvAdapter,
    xlsx: csvAdapter,
    apkg: csvAdapter,
  });
  return { repositories, app, service };
}

test('preview is read-only; confirm skips existing/in-file duplicates, validates, and initializes normal SRS', async () => {
  const { repositories, app, service } = setup();
  await repositories.decks.create(makeDeck());
  await repositories.cards.create(makeCard());
  const bytes = strToU8(
    'Deck,Front,Back,Phonetic,Category,Examples\n vocabulary , HELLO ,greeting,,,[]\n VOCABULARY ,سلام,مرحبا,/ipa/,اسم,[]\nVocabulary, سلام ,مرحبا,,,[]\n NEW   deck ,new,back,,,[]\nnew deck,second,answer,,,[]\nInvalid,,missing,,,[]\nInvalid,front,back,,,bad-json',
  );
  const preview = await service.preview('csv', bytes, 'source.csv');
  expect(preview).toMatchObject({ totalCards: 7, newCards: 3, duplicates: 2, invalidRows: 2 });
  expect(await repositories.decks.list()).toHaveLength(1);
  expect(await repositories.cards.listByDeck('deck-1')).toHaveLength(1);
  expect(await app.listReviewEvents()).toEqual([]);
  const summary = await service.confirm(preview);
  expect(summary).toMatchObject({ imported: 3, duplicatesSkipped: 2, invalidSkipped: 2 });
  expect(await repositories.decks.list()).toHaveLength(2);
  const cards = await app.listCardsForDeck('deck-1');
  expect(cards).toHaveLength(2);
  const imported = cards.find((card) => card.frontText === 'سلام')!;
  expect(await app.getReviewState(imported.id)).toMatchObject({
    box: 1,
    totalReviews: 0,
    lastReviewedAt: null,
    dueDate: '2026-09-24',
  });
  expect(await app.listReviewEvents()).toEqual([]);
  expect(await repositories.cards.getById('card-1')).toEqual(makeCard());
  await expect(service.confirm(preview)).rejects.toThrow('preview');
});

test('cancel and forged confirmations never write repositories', async () => {
  const { app, service } = setup();
  const preview = await service.preview('csv', strToU8('Front,Back\na,b'), 'Deck.csv');
  await expect(service.confirm({ ...preview })).rejects.toThrow('preview');
  service.cancel(preview);
  await expect(service.confirm(preview)).rejects.toThrow('preview');
  expect(await app.listDecks()).toEqual([]);
});

test('confirmation rechecks duplicates added after preview', async () => {
  const { repositories, service } = setup();
  const preview = await service.preview(
    'csv',
    strToU8('Deck,Front,Back\nVocabulary,hello,greeting'),
    'Deck.csv',
  );
  await repositories.decks.create(makeDeck());
  await repositories.cards.create(makeCard());
  expect(await service.confirm(preview)).toMatchObject({ imported: 0, duplicatesSkipped: 1 });
});

test('deck matching is Unicode/case/whitespace normalized and does not combine distinct decks', async () => {
  const { repositories, service } = setup();
  await repositories.decks.create(makeDeck({ name: ' My   Deck ' }));
  const preview = await service.preview(
    'csv',
    strToU8('Deck,Front,Back\nmy deck,one,two\nMY DECK,three,four\nOther,one,two'),
    'Deck.csv',
  );
  expect(preview).toMatchObject({ newCards: 3, duplicates: 0 });
  await service.confirm(preview);
  expect(await repositories.decks.list()).toHaveLength(2);
  expect(await repositories.cards.listByDeck('deck-1')).toHaveLength(2);
});

test('archived cards still count as duplicates; matching archived decks are not recreated', async () => {
  const { repositories, service } = setup();
  await repositories.decks.create(makeDeck());
  await repositories.cards.create(makeCard());
  await repositories.cards.archive('card-1', makeCard().createdAt);
  await repositories.decks.archive('deck-1', makeDeck().createdAt);
  const preview = await service.preview(
    'csv',
    strToU8('Deck,Front,Back\nVocabulary,hello,greeting\nVocabulary,new,back'),
    'Deck.csv',
  );
  expect(preview).toMatchObject({ duplicates: 1, invalidRows: 1, newCards: 0 });
  await service.confirm(preview);
  expect(await repositories.decks.list({ includeArchived: true })).toHaveLength(1);
});

test('selected-deck/all-deck export round trips and skips every card on reimport', async () => {
  const { repositories, app, service } = setup();
  await repositories.decks.create(makeDeck());
  await repositories.cards.create(makeCard());
  await repositories.decks.create(makeDeck({ id: 'deck-2', name: 'Second' }));
  await repositories.cards.create(
    makeCard({ id: 'card-2', deckId: 'deck-2', frontText: 'سلام\nمتن' }),
  );
  const selected = await service.preview(
    'csv',
    await service.export('csv', 'deck-2'),
    'Export.csv',
  );
  expect(selected).toMatchObject({ totalCards: 1, newCards: 0, duplicates: 1 });
  const all = await service.preview('csv', await service.export('csv'), 'Export.csv');
  expect(all).toMatchObject({ totalCards: 2, duplicates: 2 });
  expect(await service.confirm(all)).toMatchObject({ imported: 0, duplicatesSkipped: 2 });
  expect(await app.listReviewEvents()).toEqual([]);
});

test('invalid required fields, field lengths, and invalid examples are reported per record', async () => {
  const { service } = setup();
  const records = [
    { deckName: '', frontText: '', meaning: '' },
    { deckName: 'Deck', frontText: 'front', meaning: '', category: null },
    { deckName: 'Deck', frontText: 'front', meaning: 'back', phonetic: 'x'.repeat(501) },
    { deckName: 'Deck', frontText: 'front', meaning: 'back', category: 'x'.repeat(121) },
    { deckName: 'x'.repeat(121), frontText: 'front', meaning: 'back' },
    { deckName: 'Deck', frontText: 'front', meaning: 'back', examples: [{ sentence: '' }] },
  ].map((card) => ({ phonetic: null, category: null, examples: [], ...card }));
  const preview = await service.preview('csv', await csvAdapter.serialize(records, []), 'Deck.csv');
  expect(preview).toMatchObject({ totalCards: 6, invalidRows: 6, newCards: 0 });
});

test('save failures are counted without claiming unsaved cards were imported', async () => {
  const { repositories, service } = setup();
  jest.spyOn(repositories.cards, 'create').mockRejectedValueOnce(new Error('Disk full'));
  const preview = await service.preview('csv', strToU8('Front,Back\na,b\nc,d'), 'Deck.csv');
  expect(await service.confirm(preview)).toMatchObject({
    imported: 1,
    invalidSkipped: 1,
    issues: [{ location: 'Row 2' }],
  });
});

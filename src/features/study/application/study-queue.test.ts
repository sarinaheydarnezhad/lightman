import { calendarDate } from '@/core/domain/values';
import { createApplication } from '@/core/application/create-application';
import {
  makeCard,
  makeDeck,
  makeRepositories,
  makeState,
  fixedClock,
  sequenceIds,
  timestamp,
} from '@/../test/fixtures';
import type { Repositories } from '@/core/ports/repositories';
import type { LeitnerBox } from '../domain/review';

const today = calendarDate('2026-09-24');
const all = { kind: 'all-decks' as const };
const specific = (deckId: string) => ({ kind: 'specific-deck' as const, deckId });

async function addCard(
  repos: Repositories,
  cardId: string,
  deckId: string,
  dueDate: string,
  box: LeitnerBox = 1,
) {
  await repos.cards.create(makeCard({ id: cardId, deckId }));
  await repos.reviews.saveState(makeState({ cardId, box, dueDate: calendarDate(dueDate) }));
}

test('empty collection and future-only cards produce a normal empty queue', async () => {
  const repos = makeRepositories();
  const app = createApplication(repos, fixedClock, sequenceIds());
  expect(await app.getStudyQueue({ scope: all, targetDate: today })).toEqual([]);
  await repos.decks.create(makeDeck());
  await addCard(repos, 'future', 'deck-1', '2026-09-25');
  expect(await app.getStudyQueue({ scope: all, targetDate: today })).toEqual([]);
});

test('one due card is a compact identifier snapshot, not full card content', async () => {
  const repos = makeRepositories();
  await repos.decks.create(makeDeck());
  await addCard(repos, 'due', 'deck-1', '2026-09-24');
  const app = createApplication(repos, fixedClock, sequenceIds());
  expect(await app.getStudyQueue({ scope: all, targetDate: today })).toEqual([
    { cardId: 'due', deckId: 'deck-1', dueDate: today, box: 1 },
  ]);
});

test('all active decks contribute due and overdue cards, ordered by date, box, then ID', async () => {
  const repos = makeRepositories();
  await repos.decks.create(makeDeck({ id: 'deck-z' }));
  await repos.decks.create(makeDeck({ id: 'deck-a' }));
  await addCard(repos, 'A', 'deck-z', '2026-09-20', 4);
  await addCard(repos, 'B', 'deck-a', '2026-09-20', 2);
  await addCard(repos, 'D', 'deck-z', '2026-09-20', 2);
  await addCard(repos, 'C', 'deck-a', '2026-09-22', 1);
  await addCard(repos, 'today', 'deck-a', '2026-09-24', 1);
  await addCard(repos, 'future', 'deck-z', '2026-09-25');
  const app = createApplication(repos, fixedClock, sequenceIds());
  const first = await app.getStudyQueue({ scope: all, targetDate: today });
  expect(first.map((entry) => entry.cardId)).toEqual(['B', 'D', 'A', 'C', 'today']);
  expect(first.map((entry) => entry.deckId)).toEqual([
    'deck-a',
    'deck-z',
    'deck-z',
    'deck-a',
    'deck-a',
  ]);
  expect(await app.getStudyQueue({ scope: all, targetDate: today })).toEqual(first);
  expect(
    (await app.getStudyQueue({ scope: specific('deck-z'), targetDate: today })).map(
      (item) => item.cardId,
    ),
  ).toEqual(['D', 'A']);
});

test('archived decks and archived cards never enter a normal queue or deck scope', async () => {
  const repos = makeRepositories();
  await repos.decks.create(makeDeck({ id: 'active' }));
  await repos.decks.create(makeDeck({ id: 'archived' }));
  await addCard(repos, 'kept', 'active', '2026-09-24');
  await addCard(repos, 'discarded', 'active', '2026-09-24');
  await addCard(repos, 'hidden', 'archived', '2026-09-24');
  await repos.cards.archive('discarded', timestamp);
  await repos.decks.archive('archived', timestamp);
  const app = createApplication(repos, fixedClock, sequenceIds());
  expect(
    (await app.getStudyQueue({ scope: all, targetDate: today })).map((item) => item.cardId),
  ).toEqual(['kept']);
  expect(
    (await app.getStudyQueue({ scope: specific('active'), targetDate: today })).map(
      (item) => item.cardId,
    ),
  ).toEqual(['kept']);
  await expect(
    app.getStudyQueue({ scope: specific('archived'), targetDate: today }),
  ).rejects.toMatchObject({ code: 'not-found' });
});

test('newly created card enters today’s queue using its initial review state', async () => {
  const repos = makeRepositories();
  await repos.decks.create(makeDeck());
  const app = createApplication(repos, fixedClock, sequenceIds());
  const card = await app.createCard({
    deckId: 'deck-1',
    frontText: 'New term',
    meaning: 'Meaning',
    phonetic: null,
    category: null,
    examples: [],
  });
  expect(await app.getStudyQueue({ scope: specific('deck-1'), targetDate: today })).toEqual([
    { cardId: card.id, deckId: 'deck-1', dueDate: today, box: 1 },
  ]);
});

test('duplicate card IDs from a faulty repository list cannot duplicate the study queue', async () => {
  const repos = makeRepositories();
  await repos.decks.create(makeDeck());
  await addCard(repos, 'one', 'deck-1', '2026-09-24');
  const original = repos.cards.listByDeck.bind(repos.cards);
  const list = jest.spyOn(repos.cards, 'listByDeck').mockImplementation(async (deckId) => {
    const cards = await original(deckId);
    return [...cards, ...cards];
  });
  const app = createApplication(repos, fixedClock, sequenceIds());
  expect(
    (await app.getStudyQueue({ scope: all, targetDate: today })).map((item) => item.cardId),
  ).toEqual(['one']);
  list.mockRestore();
});

test('invalid scope, missing review state, and repository failure produce meaningful errors', async () => {
  const repos = makeRepositories();
  const app = createApplication(repos, fixedClock, sequenceIds());
  await expect(
    app.getStudyQueue({ scope: { kind: 'other' } as never, targetDate: today }),
  ).rejects.toMatchObject({ code: 'validation' });
  await expect(
    app.getStudyQueue({ scope: all, targetDate: '2026-02-30' as never }),
  ).rejects.toMatchObject({ code: 'validation' });
  await expect(
    app.getStudyQueue({ scope: specific('missing'), targetDate: today }),
  ).rejects.toMatchObject({ code: 'not-found' });
  await repos.decks.create(makeDeck());
  await repos.cards.create(makeCard());
  await expect(app.getStudyQueue({ scope: all, targetDate: today })).rejects.toMatchObject({
    code: 'not-found',
  });
  const list = jest.spyOn(repos.decks, 'list').mockRejectedValueOnce(new Error('storage detail'));
  await expect(app.getStudyQueue({ scope: all, targetDate: today })).rejects.toMatchObject({
    code: 'persistence',
  });
  list.mockRestore();
});

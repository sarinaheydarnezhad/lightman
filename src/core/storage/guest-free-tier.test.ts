import { LocalStorageScopes } from './local-storage-scopes';
import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { runMigrations } from '@/core/database/migrations';
import { installFreeTierGuards } from '@/core/database/free-tier-guards';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';
import { createApplication } from '@/core/application/create-application';
import { fixedClock, sequenceIds, makeDeck, makeCard, makeSettings } from '@/../test/fixtures';
import type { Repositories } from '@/core/ports/repositories';
import { SyncStore } from '@/core/sync/sync-store';

const accountA = '11111111-1111-1111-1111-111111111111';
const accountB = '22222222-2222-2222-2222-222222222222';

test('migration reads unowned guest storage without switching or rebinding the authenticated account', async () => {
  const { scopes } = setup();
  await scopes.initialize();
  const guest = scopes.current();
  await guest.value.decks.create(makeDeck());
  await scopes.enterAccount(accountA);
  const account = scopes.current();
  const source = await scopes.guestScope();
  expect(source).toBe(guest);
  expect(scopes.current()).toBe(account);
  expect(scopes.snapshot().userId).toBe(accountA);
  expect(await new SyncStore(source.database!).account()).toMatchObject({ userId: '' });
  expect(await source.value.decks.list()).toHaveLength(1);
  expect(await account.value.decks.list()).toHaveLength(0);
});

function setup(saved = new Map<string, Uint8Array>()) {
  const files = new Map<string, RealSqliteDatabase>();
  const scopes = new LocalStorageScopes<Repositories>(async (name) => {
    const database = await RealSqliteDatabase.open(saved.get(name));
    await runMigrations(database);
    await installFreeTierGuards(database);
    files.set(name, database);
    return { database, value: createSqliteRepositories(database) };
  });
  const app = () => createApplication(scopes.current().value, fixedClock, sequenceIds());
  const persist = () =>
    new Map([...files].map(([name, database]) => [name, database.handle.export()]));
  return { scopes, files, app, persist };
}

async function addCard(repositories: Repositories, index: number, deckId = 'deck-1') {
  return repositories.cards.create(
    makeCard({ id: `card-${index}`, deckId, frontText: `Word ${index}` }),
  );
}

test('guest creates and edits one deck and exactly 50 cards; rejecting growth preserves all records', async () => {
  const { scopes } = setup();
  await scopes.initialize();
  const repositories = scopes.current().value;
  await repositories.decks.create(makeDeck());
  await expect(repositories.decks.create(makeDeck({ id: 'deck-2' }))).rejects.toMatchObject({
    code: 'free-tier-limit',
  });
  for (let index = 1; index <= 50; index++) await addCard(repositories, index);
  await expect(addCard(repositories, 51)).rejects.toMatchObject({ code: 'free-tier-limit' });
  await expect(repositories.decks.update(makeDeck({ name: 'Edited deck' }))).resolves.toMatchObject(
    { name: 'Edited deck' },
  );
  await expect(
    repositories.cards.update(makeCard({ frontText: 'Edited card' })),
  ).resolves.toMatchObject({ frontText: 'Edited card' });
  expect(await repositories.decks.list()).toHaveLength(1);
  expect(await repositories.cards.countByDeck('deck-1')).toBe(50);
  expect((await new SyncStore(scopes.current().database!).account()).userId).toBe('');
  await expect(
    new SyncStore(scopes.current().database!, () => false).bind(accountA),
  ).rejects.toThrow('Guest data cannot be linked');
});

test('guest study and review progress work offline and survive a database/application restart', async () => {
  const first = setup();
  await first.scopes.initialize();
  globalThis.fetch = jest.fn().mockRejectedValue(new Error('Offline'));
  const app = first.app();
  const deck = await app.createDeck(makeDeck());
  const card = await app.createCard({ ...makeCard(), deckId: deck.id });
  const session = await app.startStudySession({ kind: 'all-decks' });
  const item = await app.getCurrentStudyItem(session.id);
  await app.submitStudyAnswer({
    sessionId: session.id,
    cardId: card.id,
    presentationId: item!.presentationId,
    result: 'success',
  });
  const second = setup(first.persist());
  await second.scopes.initialize();
  expect(await second.app().getDeck(deck.id)).toMatchObject({ name: deck.name });
  expect(await second.app().getCard(card.id)).toMatchObject({ frontText: card.frontText });
  expect(await second.scopes.current().value.reviews.getState(card.id)).toMatchObject({
    totalReviews: 1,
    totalSuccesses: 1,
  });
  expect(await second.scopes.current().value.reviews.listEvents()).toHaveLength(1);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('sign-in opens separate account databases; guest data and outbox are never bound, copied or overwritten', async () => {
  const first = setup();
  await first.scopes.initialize();
  const guest = first.scopes.current();
  await guest.value.decks.create(makeDeck({ name: 'Guest words' }));
  await addCard(guest.value, 1);
  await guest.value.settings.update(makeSettings({ theme: 'dark' }));
  const before = await new SyncStore(guest.database!).pending();
  await first.scopes.enterAccount(accountA);
  expect(await first.scopes.current().value.decks.list()).toEqual([]);
  await first.scopes.current().value.decks.create(makeDeck({ name: 'Private account words' }));
  expect((await new SyncStore(first.scopes.current().database!).account()).userId).toBe(accountA);
  expect((await new SyncStore(guest.database!).account()).userId).toBe('');
  expect(await new SyncStore(guest.database!).pending()).toEqual(before);
  await first.scopes.enterGuest();
  expect(await first.scopes.current().value.decks.list()).toEqual([
    makeDeck({ name: 'Guest words' }),
  ]);
  expect(await first.scopes.current().value.settings.get()).toMatchObject({ theme: 'dark' });
  await first.scopes.enterAccount(accountB);
  expect(await first.scopes.current().value.decks.list()).toEqual([]);
  await first.scopes.enterAccount(accountA);
  expect(await first.scopes.current().value.decks.list()).toEqual([
    makeDeck({ name: 'Private account words' }),
  ]);
  const second = setup(first.persist());
  await second.scopes.initialize();
  expect(second.scopes.snapshot().mode).toBe('guest');
  expect(await second.scopes.current().value.decks.list()).toEqual([
    makeDeck({ name: 'Guest words' }),
  ]);
  await second.scopes.enterAccount(accountA);
  expect(await second.scopes.current().value.decks.list()).toEqual([
    makeDeck({ name: 'Private account words' }),
  ]);
});

test('legacy account-owned lerona.db is never exposed as guest storage', async () => {
  const first = setup();
  await first.scopes.initialize();
  await first.scopes.current().value.decks.create(makeDeck({ name: 'Legacy private' }));
  await first.scopes.current().database!.execute('UPDATE sync_account SET user_id = ?', [accountA]);
  const second = setup(first.persist());
  await second.scopes.initialize();
  expect(await second.scopes.current().value.decks.list()).toEqual([]);
  expect(second.files.has('lerona-guest.db')).toBe(true);
  await second.scopes.enterAccount(accountA);
  expect(await second.scopes.current().value.decks.list()).toEqual([
    makeDeck({ name: 'Legacy private' }),
  ]);
});

test('existing over-limit data is retained and editable; new inserts and restoration are blocked', async () => {
  const { scopes } = setup();
  await scopes.initialize();
  const { database, value: repositories } = scopes.current();
  await database!.execute('UPDATE sync_account SET applying_remote = 1');
  await repositories.decks.create(makeDeck());
  await repositories.decks.create(makeDeck({ id: 'deck-2' }));
  for (let index = 1; index <= 51; index++) await addCard(repositories, index);
  await database!.execute('UPDATE sync_account SET applying_remote = 0');
  await expect(repositories.decks.create(makeDeck({ id: 'deck-3' }))).rejects.toMatchObject({
    code: 'free-tier-limit',
  });
  await expect(addCard(repositories, 52)).rejects.toMatchObject({ code: 'free-tier-limit' });
  await repositories.cards.update(makeCard({ meaning: 'New meaning' }));
  expect(await repositories.decks.list()).toHaveLength(2);
  expect(await repositories.cards.countByDeck('deck-1')).toBe(51);
  await repositories.cards.archive('card-51', makeCard().updatedAt);
  await expect(
    database!.execute('UPDATE cards SET archived_at = NULL WHERE id = ?', ['card-51']),
  ).rejects.toThrow('free_tier_card_limit');
  expect(await repositories.cards.listByDeck('deck-1', { includeArchived: true })).toHaveLength(51);
});

test('storage failures roll back card, initial review state and outbox without deleting prior data', async () => {
  const { scopes, app } = setup();
  await scopes.initialize();
  const application = app();
  const deck = await application.createDeck(makeDeck());
  const database = scopes.current().database as RealSqliteDatabase;
  const before = await new SyncStore(database).pending();
  database.failStatement = 'INSERT INTO card_review_state';
  await expect(application.createCard({ ...makeCard(), deckId: deck.id })).rejects.toMatchObject({
    code: 'persistence',
  });
  database.failStatement = null;
  expect(await application.listDecks()).toHaveLength(1);
  expect(await application.listCardsForDeck(deck.id)).toEqual([]);
  expect(await new SyncStore(database).pending()).toEqual(before);
});

test('atomic SQLite guards stop concurrent deck creation and count cards across every deck', async () => {
  const { scopes } = setup();
  await scopes.initialize();
  const { database, value: repositories } = scopes.current();
  const created = await Promise.allSettled([
    repositories.decks.create(makeDeck()),
    repositories.decks.create(makeDeck({ id: 'deck-2' })),
  ]);
  expect(created.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  await database!.execute('UPDATE sync_account SET applying_remote = 1');
  await repositories.decks.create(makeDeck({ id: 'legacy-other-deck' }));
  await database!.execute('UPDATE sync_account SET applying_remote = 0');
  for (let index = 1; index <= 50; index++) await addCard(repositories, index);
  await expect(addCard(repositories, 51, 'legacy-other-deck')).rejects.toMatchObject({
    code: 'free-tier-limit',
  });
  await repositories.decks.archive('deck-1', makeDeck().updatedAt);
  await expect(addCard(repositories, 52, 'legacy-other-deck')).rejects.toMatchObject({
    code: 'free-tier-limit',
  });
  expect(await repositories.cards.countByDeck('deck-1')).toBe(50);
});

test('failed scope activation hides prior account storage and can be retried without data loss', async () => {
  const files = new Map<string, RealSqliteDatabase>();
  let failGuest = false;
  const scopes = new LocalStorageScopes<Repositories>(async (name) => {
    if (failGuest && name === 'lerona-guest.db') throw new Error('Disk unavailable');
    const database = files.get(name) ?? (await RealSqliteDatabase.open());
    files.set(name, database);
    await runMigrations(database);
    return { database, value: createSqliteRepositories(database) };
  });
  await scopes.enterAccount(accountA);
  const privateScope = scopes.current();
  await privateScope.value.decks.create(makeDeck());
  failGuest = true;
  await expect(scopes.enterGuest()).rejects.toThrow('Disk unavailable');
  expect(scopes.snapshot().phase).toBe('error');
  expect(() => scopes.current()).toThrow('unavailable');
  failGuest = false;
  await scopes.enterGuest();
  expect(await scopes.current().value.decks.list()).toEqual([]);
  expect(await privateScope.value.decks.list()).toHaveLength(1);
  expect(() => scopes.assertCurrent(privateScope)).toThrow('storage scope changed');
});

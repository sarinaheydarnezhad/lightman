import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { fixedClock, sequenceIds, makeCard, makeDeck, makeSettings } from '@/../test/fixtures';
import { runMigrations } from '@/core/database/migrations';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';
import { createApplication } from './create-application';

async function setup() {
  const db = await RealSqliteDatabase.open();
  await runMigrations(db);
  const repositories = createSqliteRepositories(db);
  const app = createApplication(repositories, fixedClock, sequenceIds(), undefined, undefined, {
    assertAllowed: async () => {},
  });
  await repositories.settings.update(makeSettings({ theme: 'light', hapticsEnabled: true }));
  return { db, repositories, app };
}

test('F06: concurrent theme and haptics preserve both successful writes in SQLite and published state', async () => {
  const { db, app } = await setup();
  try {
    await Promise.all([app.settings.setTheme('dark'), app.settings.setHaptics(false)]);
    expect(app.settings.snapshot()).toMatchObject({ theme: 'dark', hapticsEnabled: false });
    expect((await db.execute('SELECT theme, haptics_enabled FROM user_settings')).rows).toEqual([
      { theme: 'dark', haptics_enabled: 0 },
    ]);
  } finally {
    db.handle.close();
  }
});

test('F07: concurrent all-decks starts return one persisted active session', async () => {
  const { db, app } = await setup();
  try {
    const deck = await app.createDeck(makeDeck());
    await app.createCard({ ...makeCard(), deckId: deck.id });
    const sessions = await Promise.all([
      app.startStudySession({ kind: 'all-decks' }),
      app.startStudySession({ kind: 'all-decks' }),
    ]);
    expect(new Set(sessions.map((session) => session.id)).size).toBe(1);
    expect(
      (await db.execute("SELECT id FROM study_sessions WHERE status = 'in-progress'")).rows,
    ).toHaveLength(1);
  } finally {
    db.handle.close();
  }
});

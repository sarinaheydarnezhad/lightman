import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { fixedClock, makeDeck, makeCard, sequenceIds } from '@/../test/fixtures';
import { migrations, runMigrations } from './migrations';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';
import { createApplication } from '@/core/application/create-application';

test.each([false, true])(
  'file-backed SQLite connections enforce the correct owner scope; separate owners=%s',
  async (separate) => {
    const database = await RealSqliteDatabase.open();
    const directory = mkdtempSync(path.join(tmpdir(), 'lerona-phase03-sqlite-'));
    try {
      await runMigrations(database);
      const repos = createSqliteRepositories(database);
      const app = createApplication(repos, fixedClock, sequenceIds());
      const deck = await app.createDeck(makeDeck());
      await app.createCard({ ...makeCard(), deckId: deck.id });
      const seed = await app.startStudySession({ kind: 'all-decks' });
      await app.cancelStudySession(seed.id);
      const one = path.join(directory, 'guest.db');
      const two = separate ? path.join(directory, 'account.db') : one;
      writeFileSync(one, database.handle.export());
      if (separate) writeFileSync(two, database.handle.export());
      const result = JSON.parse(
        execFileSync(
          process.execPath,
          [path.resolve(__dirname, '../../../test/sqlite-concurrency.cjs'), one, two, seed.id],
          { encoding: 'utf8', timeout: 15000, windowsHide: true },
        ),
      ) as {
        results: { status: string; error?: string }[];
        counts: number[];
      };
      expect(result.counts).toEqual(separate ? [1, 1] : [1]);
      expect(result.results.filter((item) => item.status === 'created')).toHaveLength(
        separate ? 2 : 1,
      );
      if (!separate)
        expect(result.results.find((item) => item.status === 'rejected')?.error).toContain(
          'study_active_session_conflict',
        );
    } finally {
      database.handle.close();
      const resolved = path.resolve(directory);
      if (
        path.dirname(resolved) !== path.resolve(tmpdir()) ||
        !path.basename(resolved).startsWith('lerona-phase03-sqlite-')
      )
        throw new Error('Unexpected synthetic database directory');
      rmSync(resolved, { recursive: true });
    }
  },
);

test('process interruption before migration COMMIT recovers schema 8 and allows a clean schema-9 retry', async () => {
  const database = await RealSqliteDatabase.open();
  const directory = mkdtempSync(path.join(tmpdir(), 'lerona-phase03-sqlite-'));
  let reopened: RealSqliteDatabase | undefined;
  try {
    for (const migration of migrations.filter((migration) => migration.version <= 8)) {
      await database.transaction(async (tx) => {
        for (const sql of migration.statements) await tx.execute(sql);
        await tx.execute(`PRAGMA user_version = ${migration.version}`);
      });
    }
    const file = path.join(directory, 'interrupted.db');
    writeFileSync(file, database.handle.export());
    const script = path.resolve(__dirname, '../../../test/sqlite-concurrency.cjs');
    let status: number | null = null;
    try {
      execFileSync(
        process.execPath,
        [script, '--interrupt-migration', file, migrations[8]!.statements[0]!],
        { windowsHide: true, timeout: 15000 },
      );
    } catch (error) {
      status = (error as { status: number }).status;
    }
    expect(status).toBe(23);
    const result = JSON.parse(
      execFileSync(process.execPath, [script, '--inspect', file], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 15000,
      }),
    );
    expect(result).toEqual({ version: 8, triggers: [] });
    reopened = await RealSqliteDatabase.open(readFileSync(file));
    expect(await runMigrations(reopened)).toBe(9);
  } finally {
    database.handle.close();
    reopened?.handle.close();
    const resolved = path.resolve(directory);
    if (
      path.dirname(resolved) !== path.resolve(tmpdir()) ||
      !path.basename(resolved).startsWith('lerona-phase03-sqlite-')
    )
      throw new Error('Unexpected synthetic database directory');
    rmSync(resolved, { recursive: true });
  }
});

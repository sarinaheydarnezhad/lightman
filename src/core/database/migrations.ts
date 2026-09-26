import type { Database } from './database';

export interface Migration {
  readonly version: number;
  readonly statements: readonly string[];
}

export const migrations: readonly Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS decks (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        language TEXT NOT NULL,
        text_alignment TEXT NOT NULL,
        typography_size TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY NOT NULL,
        deck_id TEXT NOT NULL,
        front_text TEXT NOT NULL,
        phonetic TEXT,
        category TEXT,
        meaning TEXT NOT NULL,
        examples_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT
      )`,
      'CREATE INDEX IF NOT EXISTS cards_deck_id_idx ON cards(deck_id)',
      `CREATE TABLE IF NOT EXISTS review_states (
        card_id TEXT PRIMARY KEY NOT NULL,
        box INTEGER NOT NULL,
        due_date TEXT NOT NULL,
        last_reviewed_at TEXT,
        consecutive_successes INTEGER NOT NULL,
        total_reviews INTEGER NOT NULL,
        total_successes INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS review_events (
        id TEXT PRIMARY KEY NOT NULL,
        card_id TEXT NOT NULL,
        deck_id TEXT NOT NULL,
        previous_box INTEGER NOT NULL,
        new_box INTEGER NOT NULL,
        result TEXT NOT NULL,
        reviewed_at TEXT NOT NULL,
        study_session_id TEXT
      )`,
      'CREATE INDEX IF NOT EXISTS review_events_card_id_idx ON review_events(card_id)',
      'CREATE INDEX IF NOT EXISTS review_events_deck_id_idx ON review_events(deck_id)',
      `CREATE TABLE IF NOT EXISTS study_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        scope_json TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        cancelled_at TEXT,
        initial_queue_json TEXT NOT NULL,
        retry_queue_json TEXT NOT NULL,
        current_index INTEGER NOT NULL,
        retry_successes INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
        theme TEXT NOT NULL,
        haptics_enabled INTEGER NOT NULL,
        language TEXT NOT NULL,
        daily_reminder_enabled INTEGER NOT NULL,
        daily_reminder_time TEXT,
        preferred_speech_language TEXT NOT NULL,
        preferred_speech_accent TEXT
      )`,
    ],
  },
];

export async function runMigrations(database: Database): Promise<number> {
  const result = await database.execute('PRAGMA user_version');
  let currentVersion = Number(result.rows[0]?.user_version ?? 0);
  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;
    await database.transaction(async (transaction) => {
      for (const statement of migration.statements) await transaction.execute(statement);
      await transaction.execute(`PRAGMA user_version = ${migration.version}`);
    });
    currentVersion = migration.version;
  }
  return currentVersion;
}

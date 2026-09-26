import type { Database } from './database';

export interface Migration {
  readonly version: number;
  readonly statements: readonly string[];
}

const initialSchemaStatements = [
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
] as const;

const productionSchemaStatements = [
  'DROP INDEX IF EXISTS cards_deck_id_idx',
  'DROP INDEX IF EXISTS review_events_card_id_idx',
  'DROP INDEX IF EXISTS review_events_deck_id_idx',
  'ALTER TABLE decks RENAME TO decks_v1',
  'ALTER TABLE cards RENAME TO cards_v1',
  'ALTER TABLE review_states RENAME TO review_states_v1',
  'ALTER TABLE review_events RENAME TO review_events_v1',
  'ALTER TABLE settings RENAME TO settings_v1',
  `CREATE TABLE decks (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    language TEXT NOT NULL,
    text_alignment TEXT NOT NULL CHECK (text_alignment IN ('ltr', 'rtl', 'center')),
    typography_size TEXT NOT NULL CHECK (typography_size IN ('small', 'medium', 'large')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT
  )`,
  `CREATE TABLE cards (
    id TEXT PRIMARY KEY NOT NULL,
    deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE RESTRICT,
    front_text TEXT NOT NULL,
    phonetic TEXT,
    category TEXT,
    meaning TEXT NOT NULL,
    examples_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT
  )`,
  `CREATE TABLE card_review_state (
    card_id TEXT PRIMARY KEY NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    box INTEGER NOT NULL CHECK (box BETWEEN 1 AND 5),
    due_date TEXT NOT NULL,
    last_reviewed_at TEXT,
    consecutive_successes INTEGER NOT NULL CHECK (consecutive_successes >= 0),
    total_reviews INTEGER NOT NULL CHECK (total_reviews >= 0),
    total_successes INTEGER NOT NULL CHECK (total_successes >= 0 AND total_successes <= total_reviews),
    updated_at TEXT NOT NULL,
    CHECK (consecutive_successes <= total_successes)
  )`,
  `CREATE TABLE review_events (
    id TEXT PRIMARY KEY NOT NULL,
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
    deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE RESTRICT,
    previous_box INTEGER NOT NULL CHECK (previous_box BETWEEN 1 AND 5),
    new_box INTEGER NOT NULL CHECK (new_box BETWEEN 1 AND 5),
    result TEXT NOT NULL CHECK (result IN ('success', 'failure')),
    reviewed_at TEXT NOT NULL,
    study_session_id TEXT
  )`,
  `CREATE TABLE user_settings (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    theme TEXT NOT NULL CHECK (theme IN ('system', 'light', 'dark', 'oled')),
    haptics_enabled INTEGER NOT NULL CHECK (haptics_enabled IN (0, 1)),
    language TEXT NOT NULL,
    daily_reminder_enabled INTEGER NOT NULL CHECK (daily_reminder_enabled IN (0, 1)),
    daily_reminder_time TEXT,
    preferred_speech_language TEXT NOT NULL,
    preferred_speech_accent TEXT CHECK (preferred_speech_accent IS NULL OR preferred_speech_accent IN ('us', 'uk'))
  )`,
  `INSERT INTO decks (id, name, description, language, text_alignment, typography_size, created_at, updated_at, archived_at)
   SELECT id, name, description, language, text_alignment, typography_size, created_at, updated_at, archived_at FROM decks_v1`,
  `INSERT INTO cards (id, deck_id, front_text, phonetic, category, meaning, examples_json, created_at, updated_at, archived_at)
   SELECT id, deck_id, front_text, phonetic, category, meaning, examples_json, created_at, updated_at, archived_at FROM cards_v1`,
  `INSERT INTO card_review_state (card_id, box, due_date, last_reviewed_at, consecutive_successes, total_reviews, total_successes, updated_at)
   SELECT card_id, box, due_date, last_reviewed_at, consecutive_successes, total_reviews, total_successes, updated_at FROM review_states_v1`,
  `INSERT INTO review_events (id, card_id, deck_id, previous_box, new_box, result, reviewed_at, study_session_id)
   SELECT id, card_id, deck_id, previous_box, new_box, result, reviewed_at, study_session_id FROM review_events_v1`,
  `INSERT INTO user_settings (id, theme, haptics_enabled, language, daily_reminder_enabled, daily_reminder_time, preferred_speech_language, preferred_speech_accent)
   SELECT id, theme, haptics_enabled, language, daily_reminder_enabled, daily_reminder_time, preferred_speech_language, preferred_speech_accent FROM settings_v1`,
  'DROP TABLE settings_v1',
  'DROP TABLE review_events_v1',
  'DROP TABLE review_states_v1',
  'DROP TABLE cards_v1',
  'DROP TABLE decks_v1',
  'CREATE INDEX cards_active_deck_idx ON cards(deck_id, archived_at)',
  'CREATE INDEX card_review_state_due_date_idx ON card_review_state(due_date)',
  'CREATE INDEX review_events_card_id_idx ON review_events(card_id)',
  'CREATE INDEX review_events_deck_id_idx ON review_events(deck_id)',
  'CREATE INDEX review_events_reviewed_at_idx ON review_events(reviewed_at)',
  `CREATE TRIGGER review_events_no_update
   BEFORE UPDATE ON review_events
   BEGIN
     SELECT RAISE(ABORT, 'review events are immutable');
   END`,
  `CREATE TRIGGER review_events_no_delete
   BEFORE DELETE ON review_events
   BEGIN
     SELECT RAISE(ABORT, 'review events are immutable');
   END`,
] as const;

export const migrations: readonly Migration[] = [
  { version: 1, statements: initialSchemaStatements },
  { version: 2, statements: productionSchemaStatements },
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

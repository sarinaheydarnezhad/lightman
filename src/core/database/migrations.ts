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

const syncUuid = `lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6)))`;
const syncSchemaStatements = [
  `CREATE TABLE sync_account (id INTEGER PRIMARY KEY CHECK (id = 1), user_id TEXT NOT NULL DEFAULT '', device_id TEXT NOT NULL, cursor INTEGER NOT NULL DEFAULT 0 CHECK (cursor >= 0), applying_remote INTEGER NOT NULL DEFAULT 0)`,
  `INSERT INTO sync_account (id, device_id) VALUES (1, ${syncUuid})`,
  `CREATE TABLE sync_operations (sequence INTEGER PRIMARY KEY AUTOINCREMENT, operation_id TEXT NOT NULL UNIQUE, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, operation TEXT NOT NULL, payload_json TEXT NOT NULL, expected_version INTEGER NOT NULL DEFAULT 0, ack_version INTEGER, created_at TEXT NOT NULL, retry_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'conflict', 'failed', 'discarded')))`,
  'CREATE INDEX sync_operations_pending_idx ON sync_operations(status, sequence)',
  `CREATE TABLE sync_entity_versions (entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, server_version INTEGER NOT NULL CHECK (server_version >= 0), PRIMARY KEY (entity_type, entity_id))`,
  `CREATE TABLE sync_conflicts (operation_id TEXT PRIMARY KEY NOT NULL REFERENCES sync_operations(operation_id), server_value_json TEXT, client_value_json TEXT, actual_version INTEGER NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE sync_review_versions (event_id TEXT PRIMARY KEY NOT NULL REFERENCES review_events(id) ON DELETE RESTRICT, server_version INTEGER NOT NULL)`,
  `CREATE TRIGGER sync_deck_insert AFTER INSERT ON decks WHEN (SELECT applying_remote FROM sync_account WHERE id = 1) = 0 BEGIN
    INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, created_at)
      VALUES (${syncUuid}, 'deck', NEW.id, 'upsert', json_object('name', NEW.name, 'description', NEW.description, 'language', NEW.language, 'textAlignment', NEW.text_alignment, 'typographySize', NEW.typography_size), NEW.updated_at);
  END`,
  `CREATE TRIGGER sync_deck_update AFTER UPDATE ON decks WHEN (SELECT applying_remote FROM sync_account WHERE id = 1) = 0 BEGIN
    INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, expected_version, created_at)
    VALUES (${syncUuid}, 'deck', NEW.id, CASE WHEN NEW.archived_at IS NOT NULL THEN 'archive' ELSE 'upsert' END,
      CASE WHEN NEW.archived_at IS NOT NULL THEN 'null' ELSE json_object('name', NEW.name, 'description', NEW.description, 'language', NEW.language, 'textAlignment', NEW.text_alignment, 'typographySize', NEW.typography_size) END,
      COALESCE((SELECT server_version FROM sync_entity_versions WHERE entity_type = 'deck' AND entity_id = NEW.id), 0), NEW.updated_at);
  END`,
  `CREATE TRIGGER sync_card_insert AFTER INSERT ON cards WHEN (SELECT applying_remote FROM sync_account WHERE id = 1) = 0 BEGIN
    INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, created_at)
    VALUES (${syncUuid}, 'card', NEW.id, 'upsert', json_object('deckId', NEW.deck_id, 'frontText', NEW.front_text, 'meaning', NEW.meaning, 'phonetic', NEW.phonetic, 'category', NEW.category, 'examples', json(NEW.examples_json)), NEW.updated_at);
  END`,
  `CREATE TRIGGER sync_card_update AFTER UPDATE ON cards WHEN (SELECT applying_remote FROM sync_account WHERE id = 1) = 0 BEGIN
    INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, expected_version, created_at)
    VALUES (${syncUuid}, 'card', NEW.id, CASE WHEN NEW.archived_at IS NOT NULL THEN 'archive' ELSE 'upsert' END,
      CASE WHEN NEW.archived_at IS NOT NULL THEN 'null' ELSE json_object('deckId', NEW.deck_id, 'frontText', NEW.front_text, 'meaning', NEW.meaning, 'phonetic', NEW.phonetic, 'category', NEW.category, 'examples', json(NEW.examples_json)) END,
      COALESCE((SELECT server_version FROM sync_entity_versions WHERE entity_type = 'card' AND entity_id = NEW.id), 0), NEW.updated_at);
  END`,
  `CREATE TRIGGER sync_review_insert AFTER INSERT ON review_events WHEN (SELECT applying_remote FROM sync_account WHERE id = 1) = 0 BEGIN
    INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, created_at)
    VALUES (${syncUuid}, 'reviewEvent', NEW.id, 'create', json_object('cardId', NEW.card_id, 'deckId', NEW.deck_id, 'previousBox', NEW.previous_box, 'newBox', NEW.new_box, 'result', NEW.result, 'reviewedAtUtc', NEW.reviewed_at, 'studySessionId', NEW.study_session_id), NEW.reviewed_at);
  END`,
  `CREATE TRIGGER sync_state_insert AFTER INSERT ON card_review_state WHEN (SELECT applying_remote FROM sync_account WHERE id = 1) = 0 BEGIN
    INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, created_at)
    VALUES (${syncUuid}, 'reviewState', NEW.card_id, 'upsert', json_object('box', NEW.box, 'dueDate', NEW.due_date, 'lastReviewedAtUtc', NEW.last_reviewed_at, 'consecutiveSuccesses', NEW.consecutive_successes, 'totalReviews', NEW.total_reviews, 'totalSuccesses', NEW.total_successes), NEW.updated_at);
  END`,
  `CREATE TRIGGER sync_settings_insert AFTER INSERT ON user_settings WHEN (SELECT applying_remote FROM sync_account WHERE id = 1) = 0
    AND NOT (NEW.theme = 'system' AND NEW.haptics_enabled = 1 AND NEW.language = 'en'
      AND NEW.daily_reminder_enabled = 0 AND NEW.daily_reminder_time = '09:00'
      AND NEW.preferred_speech_language = 'en' AND NEW.preferred_speech_accent IS NULL) BEGIN
    INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, created_at)
    VALUES (${syncUuid}, 'settings', '', 'upsert', json_object('theme', NEW.theme, 'hapticsEnabled', json(CASE WHEN NEW.haptics_enabled = 1 THEN 'true' ELSE 'false' END), 'language', NEW.language, 'dailyReminderEnabled', json(CASE WHEN NEW.daily_reminder_enabled = 1 THEN 'true' ELSE 'false' END), 'dailyReminderTime', CASE WHEN NEW.daily_reminder_time IS NULL THEN NULL ELSE NEW.daily_reminder_time || ':00' END, 'preferredSpeechLanguage', NEW.preferred_speech_language, 'preferredSpeechAccent', NEW.preferred_speech_accent), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
  END`,
  `CREATE TRIGGER sync_settings_update AFTER UPDATE ON user_settings WHEN (SELECT applying_remote FROM sync_account WHERE id = 1) = 0 BEGIN
    INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, expected_version, created_at)
    VALUES (${syncUuid}, 'settings', '', 'upsert', json_object('theme', NEW.theme, 'hapticsEnabled', json(CASE WHEN NEW.haptics_enabled = 1 THEN 'true' ELSE 'false' END), 'language', NEW.language, 'dailyReminderEnabled', json(CASE WHEN NEW.daily_reminder_enabled = 1 THEN 'true' ELSE 'false' END), 'dailyReminderTime', CASE WHEN NEW.daily_reminder_time IS NULL THEN NULL ELSE NEW.daily_reminder_time || ':00' END, 'preferredSpeechLanguage', NEW.preferred_speech_language, 'preferredSpeechAccent', NEW.preferred_speech_accent), COALESCE((SELECT server_version FROM sync_entity_versions WHERE entity_type = 'settings' AND entity_id = (SELECT user_id FROM sync_account WHERE id = 1)), 0), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
  END`,
  `INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, created_at)
   SELECT ${syncUuid}, 'deck', id, 'upsert', json_object('name', name, 'description', description, 'language', language, 'textAlignment', text_alignment, 'typographySize', typography_size), updated_at FROM decks`,
  `INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, created_at)
   SELECT ${syncUuid}, 'card', id, 'upsert', json_object('deckId', deck_id, 'frontText', front_text, 'meaning', meaning, 'phonetic', phonetic, 'category', category, 'examples', json(examples_json)), updated_at FROM cards`,
  `INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, created_at)
   SELECT ${syncUuid}, 'reviewState', card_id, 'upsert', json_object('box', 1, 'dueDate', substr((SELECT created_at FROM cards WHERE id = card_id), 1, 10), 'lastReviewedAtUtc', NULL, 'consecutiveSuccesses', 0, 'totalReviews', 0, 'totalSuccesses', 0), updated_at FROM card_review_state`,
  `INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, created_at)
   SELECT ${syncUuid}, 'reviewEvent', id, 'create', json_object('cardId', card_id, 'deckId', deck_id, 'previousBox', previous_box, 'newBox', new_box, 'result', result, 'reviewedAtUtc', reviewed_at, 'studySessionId', study_session_id), reviewed_at FROM review_events`,
  `INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, created_at)
   SELECT ${syncUuid}, 'settings', '', 'upsert', json_object('theme', theme, 'hapticsEnabled', json(CASE WHEN haptics_enabled = 1 THEN 'true' ELSE 'false' END), 'language', language, 'dailyReminderEnabled', json(CASE WHEN daily_reminder_enabled = 1 THEN 'true' ELSE 'false' END), 'dailyReminderTime', CASE WHEN daily_reminder_time IS NULL THEN NULL ELSE daily_reminder_time || ':00' END, 'preferredSpeechLanguage', preferred_speech_language, 'preferredSpeechAccent', preferred_speech_accent), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM user_settings
   WHERE NOT (theme = 'system' AND haptics_enabled = 1 AND language = 'en'
     AND daily_reminder_enabled = 0 AND daily_reminder_time = '09:00'
     AND preferred_speech_language = 'en' AND preferred_speech_accent IS NULL)`,
  `INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, created_at)
   SELECT ${syncUuid}, 'card', id, 'archive', 'null', archived_at FROM cards WHERE archived_at IS NOT NULL`,
  `INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, created_at)
   SELECT ${syncUuid}, 'deck', id, 'archive', 'null', archived_at FROM decks WHERE archived_at IS NOT NULL`,
] as const;

const schedulerSchemaStatements = [
  "ALTER TABLE decks ADD COLUMN review_system TEXT NOT NULL DEFAULT 'leitner'",
  "ALTER TABLE study_sessions ADD COLUMN workflow_json TEXT NOT NULL DEFAULT '{}'",
  'ALTER TABLE card_review_state ADD COLUMN scheduler_state_json TEXT',
  'ALTER TABLE review_events ADD COLUMN scheduler_json TEXT',
] as const;

const schedulerSyncStatements = [
  'DROP TRIGGER IF EXISTS sync_deck_insert',
  'DROP TRIGGER IF EXISTS sync_deck_update',
  `CREATE TRIGGER sync_deck_insert AFTER INSERT ON decks WHEN (SELECT applying_remote FROM sync_account WHERE id = 1) = 0 BEGIN
    INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, created_at)
    VALUES (${syncUuid}, 'deck', NEW.id, 'upsert', json_object('name', NEW.name, 'description', NEW.description, 'language', NEW.language, 'textAlignment', NEW.text_alignment, 'typographySize', NEW.typography_size, 'reviewSystem', NEW.review_system), NEW.updated_at);
  END`,
  `CREATE TRIGGER sync_deck_update AFTER UPDATE ON decks WHEN (SELECT applying_remote FROM sync_account WHERE id = 1) = 0 BEGIN
    INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, expected_version, created_at)
    VALUES (${syncUuid}, 'deck', NEW.id, CASE WHEN NEW.archived_at IS NOT NULL THEN 'archive' ELSE 'upsert' END,
      CASE WHEN NEW.archived_at IS NOT NULL THEN 'null' ELSE json_object('name', NEW.name, 'description', NEW.description, 'language', NEW.language, 'textAlignment', NEW.text_alignment, 'typographySize', NEW.typography_size, 'reviewSystem', NEW.review_system) END,
      COALESCE((SELECT server_version FROM sync_entity_versions WHERE entity_type = 'deck' AND entity_id = NEW.id), 0), NEW.updated_at);
  END`,
] as const;

export const migrations: readonly Migration[] = [
  { version: 1, statements: initialSchemaStatements },
  { version: 2, statements: productionSchemaStatements },
  { version: 3, statements: syncSchemaStatements },
  { version: 4, statements: schedulerSchemaStatements },
  { version: 5, statements: schedulerSyncStatements },
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

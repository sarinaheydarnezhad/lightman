import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { migrations } from '../src/core/database/migrations.ts';

const sqlite3 = await sqlite3InitModule();
const database = new sqlite3.oo1.DB(':memory:');
database.exec('PRAGMA foreign_keys = ON');
for (const migration of migrations) {
  database.exec('BEGIN');
  try {
    for (const statement of migration.statements) database.exec(statement);
    database.exec(`PRAGMA user_version = ${migration.version}`);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

const deckId = '00000000-0000-4000-8000-000000000001';
const cardId = '00000000-0000-4000-8000-000000000002';
const eventId = '00000000-0000-4000-8000-000000000003';
const time = '2026-09-30T10:00:00.000Z';
const save = () => {
  database.exec(`INSERT INTO decks (id,name,description,language,text_alignment,typography_size,created_at,updated_at)
    VALUES ('${deckId}','Words','','en','ltr','medium','${time}','${time}')`);
  database.exec(`INSERT INTO cards (id,deck_id,front_text,meaning,examples_json,created_at,updated_at)
    VALUES ('${cardId}','${deckId}','hello','greeting','[]','${time}','${time}')`);
  database.exec(`INSERT INTO card_review_state (card_id,box,due_date,last_reviewed_at,consecutive_successes,total_reviews,total_successes,updated_at)
    VALUES ('${cardId}',1,'2026-09-30',NULL,0,0,0,'${time}')`);
  database.exec(`INSERT INTO review_events (id,card_id,deck_id,previous_box,new_box,result,reviewed_at)
    VALUES ('${eventId}','${cardId}','${deckId}',1,2,'success','${time}')`);
};
const count = () => database.exec('SELECT count(*) FROM sync_operations', { returnValue: 'resultRows' })[0][0];
database.exec('BEGIN');
save();
if (count() !== 4) throw new Error('Local changes were not enqueued inside the transaction.');
database.exec('ROLLBACK');
if (count() !== 0) throw new Error('Queue did not roll back with the review.');

database.exec('BEGIN');
save();
database.exec('COMMIT');
const types = database.exec('SELECT entity_type FROM sync_operations ORDER BY sequence', { returnValue: 'resultRows' })
  .map(([type]) => type);
if (types.join(',') !== 'deck,card,reviewState,reviewEvent') throw new Error(`Unexpected queue order: ${types}`);
database.exec(`INSERT INTO user_settings
  (id, theme, haptics_enabled, language, daily_reminder_enabled, daily_reminder_time, preferred_speech_language)
  VALUES (1, 'system', 1, 'en', 0, '09:00', 'en')`);
if (count() !== 4) throw new Error('Boot defaults should not overwrite another device’s settings.');
database.exec(`UPDATE user_settings SET theme = 'dark', language = 'fa', daily_reminder_enabled = 1,
  daily_reminder_time = '09:30' WHERE id = 1`);
const settingsJson = database.exec(`SELECT payload_json FROM sync_operations WHERE entity_type = 'settings'`,
  { returnValue: 'resultRows' })[0][0];
const settings = JSON.parse(settingsJson);
if (settings.hapticsEnabled !== true || settings.dailyReminderEnabled !== true ||
    settings.dailyReminderTime !== '09:30:00') throw new Error('Settings serialization is incompatible with the API.');
database.exec(`UPDATE decks SET archived_at = '${time}' WHERE id = '${deckId}'`);
const archive = database.exec('SELECT operation FROM sync_operations ORDER BY sequence DESC LIMIT 1', { returnValue: 'resultRows' });
if (archive[0][0] !== 'archive') throw new Error('Archive operation not queued.');
let protectedHistory = false;
try { database.exec(`DELETE FROM review_events WHERE id = '${eventId}'`); }
catch { protectedHistory = true; }
if (!protectedHistory) throw new Error('Review history was deleted.');

database.exec('UPDATE sync_account SET applying_remote = 1 WHERE id = 1');
database.exec(`UPDATE cards SET meaning = 'remote' WHERE id = '${cardId}'`);
if (count() !== 6) throw new Error('Pulled writes re-enqueued local operations.');
database.close();
console.log('SQLite migrations, offline queue, rollback, archive and immutable history validated.');

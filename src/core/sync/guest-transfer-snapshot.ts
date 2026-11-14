import type { Database, DatabaseTransaction, SqlRow } from '@/core/database/database';
import { calendarDate, instant } from '@/core/domain/values';
import { reviewResult } from '@/features/study/domain/review';
import { mergeReviewEvents } from './review-merge';
import { validateCardContent } from '@/features/study/domain/card';

export interface GuestSnapshot {
  deviceId: string;
  decks: SqlRow[];
  cards: SqlRow[];
  states: SqlRow[];
  events: SqlRow[];
}

export function text(row: SqlRow, key: string): string {
  const value = row[key];
  if (typeof value !== 'string')
    throw new Error(`Local ${key} is unavailable. No guest data was removed.`);
  return value;
}

export async function snapshot(transaction: DatabaseTransaction): Promise<GuestSnapshot> {
  const account = (
    await transaction.execute('SELECT user_id, device_id FROM sync_account WHERE id = 1')
  ).rows[0];
  if (!account || account.user_id !== '')
    throw new Error('Only unowned guest storage can be transferred.');
  return {
    deviceId: text(account, 'device_id'),
    decks: [
      ...(await transaction.execute('SELECT * FROM decks WHERE archived_at IS NULL ORDER BY id'))
        .rows,
    ],
    cards: [
      ...(
        await transaction.execute(
          'SELECT c.* FROM cards c JOIN decks d ON d.id = c.deck_id WHERE c.archived_at IS NULL AND d.archived_at IS NULL ORDER BY c.id',
        )
      ).rows,
    ],
    states: [
      ...(
        await transaction.execute(
          'SELECT s.* FROM card_review_state s JOIN cards c ON c.id = s.card_id JOIN decks d ON d.id = c.deck_id WHERE c.archived_at IS NULL AND d.archived_at IS NULL ORDER BY s.card_id',
        )
      ).rows,
    ],
    events: [
      ...(
        await transaction.execute(
          'SELECT e.* FROM review_events e JOIN cards c ON c.id = e.card_id JOIN decks d ON d.id = c.deck_id WHERE c.archived_at IS NULL AND d.archived_at IS NULL ORDER BY e.rowid',
        )
      ).rows,
    ],
  };
}

export async function readGuest(database: Database): Promise<GuestSnapshot> {
  let result: GuestSnapshot | null = null;
  await database.transaction(async (transaction) => {
    result = await snapshot(transaction);
  });
  return result!;
}

export function stateMatches(row: SqlRow, state: ReturnType<typeof mergeReviewEvents>): boolean {
  return (
    row.box === state.box &&
    row.due_date === state.dueDate &&
    row.last_reviewed_at === state.lastReviewedAt &&
    row.total_reviews === state.totalReviews &&
    row.total_successes === state.totalSuccesses &&
    row.consecutive_successes === state.consecutiveSuccesses
  );
}

export function unsupportedReasons(source: GuestSnapshot): string[] {
  const reasons = new Set<string>();
  for (const deck of source.decks) {
    instant(text(deck, 'created_at'));
    instant(text(deck, 'updated_at'));
    if (deck.review_system !== 'leitner')
      reasons.add(
        'Only Leitner decks can be transferred with the current backend. Other scheduler data stays local.',
      );
    if (!/^[a-zA-Z0-9-]{1,35}$/.test(text(deck, 'language')))
      reasons.add(
        'A guest deck language does not meet backend validation. Edit it in guest mode first.',
      );
    if (
      !text(deck, 'name').trim() ||
      text(deck, 'name').length > 120 ||
      text(deck, 'description').length > 1000
    )
      reasons.add('A guest deck exceeds the backend text limits. Edit it in guest mode first.');
  }
  for (const card of source.cards) {
    instant(text(card, 'created_at'));
    instant(text(card, 'updated_at'));
    try {
      validateCardContent({
        frontText: card.front_text,
        meaning: card.meaning,
        phonetic: card.phonetic,
        category: card.category,
        examples: JSON.parse(text(card, 'examples_json')) as unknown,
      } as Parameters<typeof validateCardContent>[0]);
    } catch {
      reasons.add(
        `Guest card ${text(card, 'id')} needs content integrity repair. Original data and learning history were retained.`,
      );
    }
    const state = source.states.find((item) => item.card_id === card.id);
    const events = source.events.filter((item) => item.card_id === card.id);
    if (!state) {
      reasons.add(
        'A card is missing review state. Guest data was preserved; transfer needs repair first.',
      );
      continue;
    }
    calendarDate(text(state, 'due_date'));
    if (state.scheduler_state_json) {
      const scheduler = JSON.parse(text(state, 'scheduler_state_json')) as { schedulerId?: string };
      if (scheduler.schedulerId !== 'leitner')
        reasons.add('Unsupported scheduler progress stays local.');
    }
    if (!events.length) {
      if (
        state.total_reviews !== 0 ||
        state.total_successes !== 0 ||
        state.consecutive_successes !== 0 ||
        state.box !== 1 ||
        state.last_reviewed_at !== null
      )
        reasons.add(
          'Review progress without complete immutable history cannot safely be transferred.',
        );
      continue;
    }
    if (
      events.some(
        (event) =>
          event.deck_id !== card.deck_id ||
          (event.scheduler_json &&
            (JSON.parse(text(event, 'scheduler_json')) as { schedulerId?: string }).schedulerId !==
              'leitner'),
      )
    )
      reasons.add('A review history has unsupported scheduler data or relationships.');
    const replay = mergeReviewEvents(
      text(card, 'id'),
      instant(text(card, 'created_at')),
      events.map((event) => ({
        id: text(event, 'id'),
        reviewedAt: instant(new Date(text(event, 'reviewed_at')).toISOString()),
        result: reviewResult(event.result),
        ...(event.review_calendar_json
          ? { reviewCalendar: JSON.parse(text(event, 'review_calendar_json')) }
          : {}),
      })),
    );
    const normalized = {
      ...state,
      last_reviewed_at: state.last_reviewed_at
        ? new Date(text(state, 'last_reviewed_at')).toISOString()
        : null,
    };
    if (!stateMatches(normalized, replay))
      reasons.add(
        'Guest review progress cannot be reproduced from its recorded calendar/history. No progress was changed.',
      );
  }
  return [...reasons];
}

import { randomUUID } from 'expo-crypto';
import type { Database, SqlRow } from '@/core/database/database';
import type { SyncEngine } from './sync-engine';
import { CloudError, type CloudClient } from './cloud-client';
import type { SyncStore } from './sync-store';
import { serverEntitlementCache } from '@/core/access/learning-access';
import { writeEntitlementCache } from '@/core/database/entitlement-cache';
import { readGuest, text, unsupportedReasons, type GuestSnapshot } from './guest-transfer-snapshot';

export interface TransferDeck {
  id: string;
  name: string;
  cards: number;
}
export interface TransferProgress {
  acknowledged: number;
  total: number;
}
export interface TransferPreview {
  scenario: 'guest-only' | 'account-only' | 'both' | 'empty';
  guest: TransferDeck[];
  account: TransferDeck[];
  reviewEvents: number;
  sameNames: string[];
  blockers: string[];
  token: string;
  journal: 'pending' | 'complete' | null;
  accountVerified: boolean;
}

interface TransferPlan {
  source: GuestSnapshot;
  decks: Record<string, string>;
  cards: Record<string, string>;
  events: Record<string, string>;
}

interface Context {
  guest: Database;
  account: Database;
  assertCurrent(): void;
}

export class GuestTransfer {
  private busy = false;

  constructor(
    private readonly engine: SyncEngine,
    private readonly context: () => Promise<Context>,
  ) {}

  private async exclusively<Result>(
    action: (
      context: Context,
      store: SyncStore,
      cloud: CloudClient,
      synchronize: (progress?: () => Promise<void>) => Promise<void>,
    ) => Promise<Result>,
  ): Promise<Result> {
    if (this.busy) throw new Error('A guest transfer is already in progress.');
    this.busy = true;
    try {
      return await this.engine.withAccount(async (store, cloud, synchronize) => {
        const context = await this.context();
        context.assertCurrent();
        const owner = (
          await context.account.execute('SELECT user_id FROM sync_account WHERE id = 1')
        ).rows[0]?.user_id;
        if (!owner || owner !== (await store.account()).userId)
          throw new Error('Account ownership changed. Sign in again.');
        if ((await cloud.accountProfile()).id !== owner)
          throw new Error(
            'The authenticated identity does not own this local account. Sign in again.',
          );
        context.assertCurrent();
        return action(context, store, cloud, synchronize);
      });
    } finally {
      this.busy = false;
    }
  }

  async preview(): Promise<TransferPreview> {
    return this.exclusively(async (context, store, cloud, synchronize) => {
      const source = await readGuest(context.guest);
      const journal = (
        await context.account.execute('SELECT * FROM guest_transfers WHERE source_device_id = ?', [
          source.deviceId,
        ])
      ).rows[0];
      if (!journal || journal.status === 'complete') await synchronize();
      context.assertCurrent();
      const frozen =
        journal?.status === 'pending'
          ? (JSON.parse(text(journal, 'snapshot_json')) as TransferPlan).source
          : source;
      return this.describe(context.account, frozen, cloud, store, journal);
    });
  }

  private async describe(
    database: Database,
    source: GuestSnapshot,
    cloud: CloudClient,
    store: SyncStore,
    journal?: SqlRow,
  ): Promise<TransferPreview> {
    const rows = (
      await database.execute(
        'SELECT d.id, d.name, (SELECT COUNT(*) FROM cards c WHERE c.deck_id = d.id AND c.archived_at IS NULL) AS cards FROM decks d WHERE d.archived_at IS NULL ORDER BY d.id',
      )
    ).rows;
    let account = rows.map((row) => ({
      id: text(row, 'id'),
      name: text(row, 'name'),
      cards: Number(row.cards),
    }));
    const guest = source.decks.map((row) => ({
      id: text(row, 'id'),
      name: text(row, 'name'),
      cards: source.cards.filter((card) => card.deck_id === row.id).length,
    }));
    const blockers = unsupportedReasons(source);
    let accountVerified = true;
    if (journal?.status !== 'pending') {
      const server = (await cloud.ownedDecks()).filter((deck) => !deck.archivedAtUtc);
      if (
        server.length !== account.length ||
        server.some((deck) => !account.some((local) => local.id === deck.id))
      ) {
        blockers.push(
          'Account decks are missing from the sync feed. A backend sync backfill is required before transfer.',
        );
        accountVerified = false;
      }
      const serverPreview: TransferDeck[] = [];
      for (const deck of server) {
        const serverCards = (await cloud.ownedCards(deck.id)).filter((card) => !card.archivedAtUtc);
        serverPreview.push({ id: deck.id, name: deck.name, cards: serverCards.length });
        const localCards = (
          await database.execute('SELECT id FROM cards WHERE deck_id = ? AND archived_at IS NULL', [
            deck.id,
          ])
        ).rows;
        if (
          serverCards.length !== localCards.length ||
          serverCards.some((card) => !localCards.some((local) => local.id === card.id))
        ) {
          blockers.push(
            'Account cards are missing from the sync feed. A backend sync backfill is required before transfer.',
          );
          accountVerified = false;
        }
        for (const card of serverCards) {
          const localState = (
            await database.execute('SELECT * FROM card_review_state WHERE card_id = ?', [card.id])
          ).rows[0];
          try {
            const remoteState = await cloud.ownedReviewState(card.id);
            const remoteLastReviewed = remoteState.lastReviewedAtUtc
              ? new Date(remoteState.lastReviewedAtUtc).toISOString()
              : null;
            if (
              !localState ||
              localState.box !== remoteState.box ||
              localState.due_date !== remoteState.dueDate ||
              localState.total_reviews !== remoteState.totalReviews ||
              localState.total_successes !== remoteState.totalSuccesses ||
              localState.consecutive_successes !== remoteState.consecutiveSuccesses ||
              localState.last_reviewed_at !== remoteLastReviewed
            ) {
              blockers.push(
                'Account review progress differs from the pulled sync data. Refresh first; legacy progress may require a backend sync backfill.',
              );
              accountVerified = false;
            }
          } catch (error) {
            if (!(error instanceof CloudError) || error.status !== 404) throw error;
            blockers.push(
              'An account card has no server review state. Finish its initial synchronization or repair the backend state before transfer.',
            );
            accountVerified = false;
          }
        }
      }
      account = serverPreview.sort((first, second) => first.id.localeCompare(second.id));
      const cards = Number(
        (await database.execute('SELECT COUNT(*) AS count FROM cards WHERE archived_at IS NULL'))
          .rows[0]?.count,
      );
      const entitlementRequestedAt = Date.now();
      const entitlements = await cloud.entitlements();
      const entitlementCache = await writeEntitlementCache(
        database,
        (await store.account()).userId,
        serverEntitlementCache(entitlements, entitlementRequestedAt),
      );
      if (
        !entitlementCache ||
        entitlementCache.validUntil <= Date.now() ||
        entitlementCache.fetchedAt > Date.now()
      )
        throw new Error(
          'Account permissions expired while preparing the preview. Reconnect and refresh before transferring.',
        );
      const limits = entitlementCache.entitlements.limits;
      if (
        !journal &&
        ((limits.decks !== null &&
          Math.max(account.length, entitlements.usage.decks) + guest.length > limits.decks) ||
          (limits.cards !== null &&
            Math.max(cards, entitlements.usage.cards) + source.cards.length > limits.cards))
      )
        blockers.push(
          'Adding these decks would exceed the current free limits: 1 active deck and 50 active cards. Keep the datasets separate.',
        );
    }
    if (journal?.user_id !== undefined && journal.user_id !== (await store.account()).userId)
      throw new Error('Transfer journal belongs to another account.');
    const normalize = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
    return {
      scenario: guest.length
        ? account.length
          ? 'both'
          : 'guest-only'
        : account.length
          ? 'account-only'
          : 'empty',
      guest,
      account,
      reviewEvents: source.events.length,
      sameNames: guest
        .filter((deck) => account.some((other) => normalize(deck.name) === normalize(other.name)))
        .map((deck) => deck.name),
      blockers: [...new Set(blockers)],
      token: JSON.stringify({ source, account }),
      journal: journal?.status === 'complete' ? 'complete' : journal ? 'pending' : null,
      accountVerified,
    };
  }

  async transfer(
    preview: TransferPreview,
    progress: (value: TransferProgress) => void = () => {},
  ): Promise<void> {
    return this.exclusively(async (context, store, cloud, synchronize) => {
      const source = await readGuest(context.guest);
      let journal = (
        await context.account.execute('SELECT * FROM guest_transfers WHERE source_device_id = ?', [
          source.deviceId,
        ])
      ).rows[0];
      if (!journal) {
        await synchronize();
        const current = await this.describe(context.account, source, cloud, store);
        if (current.token !== preview.token)
          throw new Error(
            'The data changed since the preview. Refresh and confirm the new preview.',
          );
        if (!current.guest.length || current.blockers.length)
          throw new Error(current.blockers[0] ?? 'There is no active guest data to transfer.');
        context.assertCurrent();
        journal = await this.stage(context.account, source, (await store.account()).userId);
      }
      const userId = (await store.account()).userId;
      if (journal.user_id !== userId) throw new Error('Transfer ownership mismatch.');
      const plan = JSON.parse(text(journal, 'snapshot_json')) as TransferPlan;
      const operationIds = JSON.parse(text(journal, 'operation_ids_json')) as string[];
      const report = async () => {
        const statuses = await this.operations(context.account, operationIds);
        progress({
          acknowledged: statuses.filter((row) => row.status === 'synced').length,
          total: operationIds.length,
        });
      };
      await report();
      const statuses = await this.operations(context.account, operationIds);
      if (statuses.some((row) => row.status === 'conflict' || row.status === 'discarded'))
        throw new Error(
          'A transfer operation has a sync conflict. Keep both histories and resolve the conflict before retrying.',
        );
      await context.account.transaction(async (transaction) => {
        for (const operationId of operationIds)
          await transaction.execute(
            "UPDATE sync_operations SET status = 'pending', retry_count = 1 WHERE operation_id = ? AND status = 'failed'",
            [operationId],
          );
      });
      await synchronize(report);
      context.assertCurrent();
      await this.verify(context.account, store, cloud, plan, operationIds);
      await context.account.execute(
        "UPDATE guest_transfers SET status = 'complete' WHERE id = ? AND user_id = ?",
        [text(journal, 'id'), userId],
      );
      await report();
    });
  }

  private async operations(database: Database, ids: string[]): Promise<SqlRow[]> {
    const rows: SqlRow[] = [];
    for (const id of ids) {
      const row = (
        await database.execute(
          'SELECT status, ack_version FROM sync_operations WHERE operation_id = ?',
          [id],
        )
      ).rows[0];
      if (!row)
        throw new Error(
          'Transfer receipt is missing. Guest data remains intact; do not start another copy.',
        );
      rows.push(row);
    }
    return rows;
  }

  private async stage(database: Database, source: GuestSnapshot, userId: string): Promise<SqlRow> {
    const map = (rows: SqlRow[], key: string) =>
      Object.fromEntries(rows.map((row) => [text(row, key), randomUUID()]));
    const plan: TransferPlan = {
      source,
      decks: map(source.decks, 'id'),
      cards: map(source.cards, 'id'),
      events: map(source.events, 'id'),
    };
    const operationIds: string[] = [];
    const id = randomUUID();
    await database.transaction(async (transaction) => {
      const owner = (await transaction.execute('SELECT user_id FROM sync_account WHERE id = 1'))
        .rows[0]?.user_id;
      if (owner !== userId) throw new Error('Account ownership changed.');
      const sequence = Number(
        (
          await transaction.execute(
            'SELECT COALESCE(MAX(sequence), 0) AS sequence FROM sync_operations',
          )
        ).rows[0]?.sequence,
      );
      for (const deck of source.decks)
        await transaction.execute(
          'INSERT INTO decks (id, name, description, language, text_alignment, typography_size, created_at, updated_at, review_system) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            plan.decks[text(deck, 'id')]!,
            deck.name!,
            deck.description!,
            deck.language!,
            deck.text_alignment!,
            deck.typography_size!,
            deck.created_at!,
            deck.updated_at!,
            'leitner',
          ],
        );
      for (const card of source.cards)
        await transaction.execute(
          'INSERT INTO cards (id, deck_id, front_text, meaning, phonetic, category, examples_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            plan.cards[text(card, 'id')]!,
            plan.decks[text(card, 'deck_id')]!,
            card.front_text!,
            card.meaning!,
            card.phonetic!,
            card.category!,
            card.examples_json!,
            card.created_at!,
            card.updated_at!,
          ],
        );
      for (const state of source.states)
        await transaction.execute(
          'INSERT INTO card_review_state (card_id, box, due_date, last_reviewed_at, consecutive_successes, total_reviews, total_successes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            plan.cards[text(state, 'card_id')]!,
            state.box!,
            state.due_date!,
            state.last_reviewed_at ? new Date(text(state, 'last_reviewed_at')).toISOString() : null,
            state.consecutive_successes!,
            state.total_reviews!,
            state.total_successes!,
            state.updated_at!,
          ],
        );
      for (const event of source.events)
        await transaction.execute(
          'INSERT INTO review_events (id, card_id, deck_id, previous_box, new_box, result, reviewed_at, study_session_id) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)',
          [
            plan.events[text(event, 'id')]!,
            plan.cards[text(event, 'card_id')]!,
            plan.decks[text(event, 'deck_id')]!,
            event.previous_box!,
            event.new_box!,
            event.result!,
            new Date(text(event, 'reviewed_at')).toISOString(),
          ],
        );
      await transaction.execute('DELETE FROM sync_operations WHERE sequence > ?', [sequence]);
      const enqueue = async (type: string, entityId: string, payload: unknown, time: string) => {
        const operationId = randomUUID();
        operationIds.push(operationId);
        await transaction.execute(
          'INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [
            operationId,
            type,
            entityId,
            type === 'reviewEvent' ? 'create' : 'upsert',
            JSON.stringify(payload),
            time,
          ],
        );
      };
      for (const deck of source.decks)
        await enqueue(
          'deck',
          plan.decks[text(deck, 'id')]!,
          {
            name: deck.name,
            description: deck.description,
            language: deck.language,
            textAlignment: deck.text_alignment,
            typographySize: deck.typography_size,
          },
          text(deck, 'updated_at'),
        );
      for (const card of source.cards)
        await enqueue(
          'card',
          plan.cards[text(card, 'id')]!,
          {
            deckId: plan.decks[text(card, 'deck_id')],
            frontText: card.front_text,
            meaning: card.meaning,
            phonetic: card.phonetic,
            category: card.category,
            examples: JSON.parse(text(card, 'examples_json')) as unknown,
          },
          text(card, 'updated_at'),
        );
      for (const state of source.states.filter(
        (row) => !source.events.some((event) => event.card_id === row.card_id),
      ))
        await enqueue(
          'reviewState',
          plan.cards[text(state, 'card_id')]!,
          {
            box: state.box,
            dueDate: state.due_date,
            lastReviewedAtUtc: null,
            consecutiveSuccesses: 0,
            totalReviews: 0,
            totalSuccesses: 0,
          },
          text(state, 'updated_at'),
        );
      for (const event of source.events)
        await enqueue(
          'reviewEvent',
          plan.events[text(event, 'id')]!,
          {
            cardId: plan.cards[text(event, 'card_id')],
            deckId: plan.decks[text(event, 'deck_id')],
            previousBox: event.previous_box,
            newBox: event.new_box,
            result: event.result,
            reviewedAtUtc: new Date(text(event, 'reviewed_at')).toISOString(),
            studySessionId: null,
          },
          text(event, 'reviewed_at'),
        );
      await transaction.execute(
        "INSERT INTO guest_transfers (id, source_device_id, user_id, snapshot_json, operation_ids_json, status) VALUES (?, ?, ?, ?, ?, 'pending')",
        [id, source.deviceId, userId, JSON.stringify(plan), JSON.stringify(operationIds)],
      );
    });
    return (await database.execute('SELECT * FROM guest_transfers WHERE id = ?', [id])).rows[0]!;
  }

  private async verify(
    database: Database,
    store: SyncStore,
    cloud: CloudClient,
    plan: TransferPlan,
    ids: string[],
  ): Promise<void> {
    const operations = await this.operations(database, ids);
    const cursor = (await store.account()).cursor;
    if (
      operations.some(
        (row) =>
          row.status !== 'synced' ||
          typeof row.ack_version !== 'number' ||
          row.ack_version > cursor,
      )
    )
      throw new Error(
        'Transfer is not fully acknowledged and pulled. Retry; guest data is preserved.',
      );
    const serverDecks = await cloud.ownedDecks();
    for (const deck of plan.source.decks) {
      const target = plan.decks[text(deck, 'id')]!;
      if (
        !serverDecks.some(
          (item) =>
            item.id === target && !item.archivedAtUtc && item.name === text(deck, 'name').trim(),
        )
      )
        throw new Error(
          'A transferred deck is not visible to this account. Transfer is incomplete.',
        );
      const local = (await database.execute('SELECT * FROM decks WHERE id = ?', [target])).rows[0];
      if (
        !local ||
        local.archived_at ||
        local.name !== text(deck, 'name').trim() ||
        local.description !== text(deck, 'description').trim() ||
        local.language !== deck.language ||
        local.text_alignment !== deck.text_alignment ||
        local.typography_size !== deck.typography_size ||
        local.review_system !== 'leitner'
      )
        throw new Error(
          'A transferred deck changed on the server. Review both datasets before continuing.',
        );
    }
    for (const card of plan.source.cards) {
      const target = plan.cards[text(card, 'id')]!;
      const local = (await database.execute('SELECT * FROM cards WHERE id = ?', [target])).rows[0];
      if (
        !local ||
        local.archived_at ||
        local.deck_id !== plan.decks[text(card, 'deck_id')] ||
        local.front_text !== text(card, 'front_text').trim() ||
        local.meaning !== text(card, 'meaning').trim() ||
        local.phonetic !== card.phonetic ||
        local.category !== card.category ||
        JSON.stringify(JSON.parse(text(local, 'examples_json')) as unknown) !==
          JSON.stringify(JSON.parse(text(card, 'examples_json')) as unknown)
      )
        throw new Error('A transferred card changed. Guest data remains intact.');
      const expected = plan.source.states.find((state) => state.card_id === card.id)!;
      const state = (
        await database.execute('SELECT * FROM card_review_state WHERE card_id = ?', [target])
      ).rows[0];
      const remote = await cloud.ownedReviewState(target);
      for (const field of [
        'box',
        'due_date',
        'total_reviews',
        'total_successes',
        'consecutive_successes',
      ] as const)
        if (state?.[field] !== expected[field])
          throw new Error('Review progress verification failed. Keep guest data and retry.');
      const lastReviewed = expected.last_reviewed_at
        ? new Date(text(expected, 'last_reviewed_at')).toISOString()
        : null;
      const remoteLastReviewed = remote.lastReviewedAtUtc
        ? new Date(remote.lastReviewedAtUtc).toISOString()
        : null;
      if (
        state?.last_reviewed_at !== lastReviewed ||
        remote.cardId !== target ||
        remote.box !== expected.box ||
        remote.dueDate !== expected.due_date ||
        remote.totalReviews !== expected.total_reviews ||
        remote.totalSuccesses !== expected.total_successes ||
        remote.consecutiveSuccesses !== expected.consecutive_successes ||
        remoteLastReviewed !== lastReviewed
      )
        throw new Error(
          'Server review progress does not match the guest snapshot. Transfer is not complete.',
        );
    }
    for (const event of plan.source.events) {
      const confirmed = (
        await database.execute(
          'SELECT e.card_id, e.deck_id, e.previous_box, e.new_box, e.result, e.reviewed_at FROM review_events e JOIN sync_review_versions v ON v.event_id = e.id WHERE e.id = ?',
          [plan.events[text(event, 'id')]!],
        )
      ).rows[0];
      if (
        !confirmed ||
        confirmed.card_id !== plan.cards[text(event, 'card_id')] ||
        confirmed.deck_id !== plan.decks[text(event, 'deck_id')] ||
        confirmed.previous_box !== event.previous_box ||
        confirmed.new_box !== event.new_box ||
        confirmed.result !== event.result ||
        confirmed.reviewed_at !== new Date(text(event, 'reviewed_at')).toISOString()
      )
        throw new Error('Review history is not fully verified. Retry without removing guest data.');
    }
  }
}

import type { Database } from '@/core/database/database';
import { AppError } from '@/core/errors/app-error';
import { resetGuestData } from './reset-guest-data';

export interface LocalScope<Value> {
  readonly database: Database | null;
  readonly value: Value;
}

export interface StorageState {
  readonly phase: 'loading' | 'ready' | 'error';
  readonly mode: 'guest' | 'account';
  readonly userId: string | null;
  readonly revision: number;
  readonly accountEntry?: 'authenticating' | 'review';
  readonly entryLanguage?: 'en' | 'fa';
}

export class LocalStorageScopes<Value> {
  private selected: LocalScope<Value> | null;
  private state: StorageState;
  private readonly listeners = new Set<() => void>();
  private readonly scopes = new Map<string, Promise<LocalScope<Value>>>();
  private legacyOwner: string | null = null;
  private initialization: Promise<void> | null = null;
  private pending: Promise<void> = Promise.resolve();
  private selectionEpoch = 0;

  constructor(
    private readonly open: (name: string) => Promise<LocalScope<Value>>,
    initial?: LocalScope<Value>,
  ) {
    this.selected = initial ?? null;
    this.state = { phase: initial ? 'ready' : 'loading', mode: 'guest', userId: null, revision: 0 };
  }

  snapshot = (): StorageState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  current(): LocalScope<Value> {
    if (this.state.phase !== 'ready' || !this.selected)
      throw new AppError('unavailable', 'Local storage is switching or unavailable. Please retry.');
    return this.selected;
  }

  assertCurrent(scope: LocalScope<Value>, revision = this.state.revision): void {
    if (this.current() !== scope || revision !== this.state.revision)
      throw new AppError('unavailable', 'The storage scope changed. Please reopen this screen.');
  }

  initialize(): Promise<void> {
    if (this.selected && this.legacyOwner === null) return Promise.resolve();
    if (!this.initialization) {
      this.initialization = (async () => {
        const legacy = await this.load('lerona.db');
        const account = await legacy.database!.execute(
          'SELECT user_id FROM sync_account WHERE id = 1',
        );
        const owner = account.rows[0]?.user_id;
        if (typeof owner !== 'string')
          throw new AppError('persistence', 'Unable to determine local data ownership.');
        this.legacyOwner = owner;
        await this.enterGuest();
      })().catch((error: unknown) => {
        this.initialization = null;
        this.publish({ ...this.state, phase: 'error' });
        throw error;
      });
    }
    return this.initialization;
  }

  legacyAccountId(): string | null {
    return this.legacyOwner || null;
  }

  lockAccount(): void {
    this.selectionEpoch++;
    this.selected = null;
    this.publish({
      phase: 'loading',
      mode: 'guest',
      userId: null,
      revision: this.state.revision + 1,
    });
  }

  async guestScope(): Promise<LocalScope<Value>> {
    const scope = await this.load(this.legacyOwner === '' ? 'lerona.db' : 'lerona-guest.db');
    const owner = (await scope.database!.execute('SELECT user_id FROM sync_account WHERE id = 1'))
      .rows[0]?.user_id;
    if (owner !== '') throw new AppError('conflict', 'Guest storage ownership is unavailable.');
    return scope;
  }

  enterGuest(): Promise<void> {
    return this.select(this.legacyOwner === '' ? 'lerona.db' : 'lerona-guest.db', 'guest', null);
  }

  enterEmptyGuest(): Promise<void> {
    return this.select(
      this.legacyOwner === '' ? 'lerona.db' : 'lerona-guest.db',
      'guest',
      null,
      true,
    );
  }

  prepareAccountEntry(language?: 'en' | 'fa'): void {
    if (this.state.phase === 'ready' && this.state.mode === 'account')
      this.publish({ ...this.state, accountEntry: 'review', entryLanguage: language });
  }

  completeAccountEntry(): void {
    if (this.state.phase !== 'ready' || this.state.mode !== 'account')
      throw new AppError('unavailable', 'The account changed. Sign in again.');
    this.publish({ ...this.state, accountEntry: undefined });
  }

  enterAccount(userId: string): Promise<void> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId))
      return Promise.reject(new AppError('validation', 'Invalid account identity.'));
    const normalized = userId.toLowerCase();
    return this.select(
      this.legacyOwner?.toLowerCase() === normalized
        ? 'lerona.db'
        : `lerona-account-${normalized}.db`,
      'account',
      normalized,
    );
  }

  private select(
    name: string,
    mode: StorageState['mode'],
    userId: string | null,
    emptyGuest = false,
  ): Promise<void> {
    const epoch = this.selectionEpoch;
    const operation = this.pending
      .catch(() => {})
      .then(async () => {
        if (epoch !== this.selectionEpoch)
          throw new AppError('unavailable', 'The account selection was cancelled.');
        if (
          this.state.phase === 'ready' &&
          !emptyGuest &&
          this.state.mode === mode &&
          this.state.userId === userId
        )
          return;
        this.publish({ ...this.state, phase: 'loading', revision: this.state.revision + 1 });
        try {
          const scope = await this.load(name);
          const owner = (
            await scope.database!.execute('SELECT user_id FROM sync_account WHERE id = 1')
          ).rows[0]?.user_id;
          if (mode === 'guest' ? owner !== '' : owner !== '' && owner !== userId)
            throw new AppError(
              'conflict',
              'Local storage belongs to another account. No data was changed.',
            );
          if (mode === 'account' && owner === '')
            await scope.database!.execute(
              'UPDATE sync_account SET user_id = ? WHERE id = 1 AND user_id = ?',
              [userId, ''],
            );
          if (epoch !== this.selectionEpoch)
            throw new AppError('unavailable', 'The account selection was cancelled.');
          if (emptyGuest) {
            await scope.database!.execute(
              'CREATE TABLE IF NOT EXISTS guest_reset_intent (id INTEGER PRIMARY KEY CHECK (id = 1))',
            );
            await scope.database!.execute(
              'INSERT OR IGNORE INTO guest_reset_intent (id) VALUES (1)',
            );
          }
          const resetIntent =
            mode === 'guest'
              ? await scope.database!.execute(
                  "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'guest_reset_intent'",
                )
              : null;
          const resetPending = resetIntent?.rows.length
            ? await scope.database!.execute('SELECT id FROM guest_reset_intent WHERE id = 1')
            : null;
          if (emptyGuest || resetPending?.rows.length)
            await resetGuestData(scope.database!, undefined, () => {
              if (epoch !== this.selectionEpoch)
                throw new AppError('unavailable', 'The account selection was cancelled.');
            });
          this.selected = scope;
          this.publish({
            phase: 'ready',
            mode,
            userId,
            revision: this.state.revision,
            ...(mode === 'account' ? { accountEntry: 'authenticating' as const } : {}),
          });
        } catch (error) {
          if (epoch === this.selectionEpoch) this.publish({ ...this.state, phase: 'error' });
          throw error;
        }
      });
    this.pending = operation;
    return operation;
  }

  private load(name: string): Promise<LocalScope<Value>> {
    let scope = this.scopes.get(name);
    if (!scope) {
      scope = this.open(name).catch((error: unknown) => {
        this.scopes.delete(name);
        throw error;
      });
      this.scopes.set(name, scope);
    }
    return scope;
  }

  private publish(state: StorageState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
}

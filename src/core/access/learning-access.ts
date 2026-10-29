import { AppError } from '@/core/errors/app-error';
import type { LearningAccess, LearningOperation } from '@/core/ports/learning-access';
import type { Repositories } from '@/core/ports/repositories';
import { validateEntitlements, type Entitlements } from '@/core/sync/subscription';

export const freeLearningLimits = { decks: 1, cards: 50 } as const;

export interface EntitlementCache {
  readonly entitlements: Entitlements;
  readonly fetchedAt: number;
  readonly validUntil: number;
}

export function serverEntitlementCache(
  entitlements: Entitlements,
  fetchedAt: number,
): EntitlementCache {
  const remaining =
    entitlements.isActive && entitlements.expiresAtUtc
      ? Date.parse(entitlements.expiresAtUtc) - Date.parse(entitlements.validatedAtUtc)
      : null;
  return {
    entitlements,
    fetchedAt,
    validUntil: remaining === null ? Number.MAX_SAFE_INTEGER : fetchedAt + remaining,
  };
}

export function reconcileEntitlementCache(
  previous: EntitlementCache | null,
  incoming: EntitlementCache,
): EntitlementCache {
  if (!previous) return incoming;
  const previousTime = Date.parse(previous.entitlements.validatedAtUtc);
  const incomingTime = Date.parse(incoming.entitlements.validatedAtUtc);
  if (
    incomingTime < previousTime ||
    (incomingTime === previousTime &&
      incoming.entitlements.isActive &&
      !previous.entitlements.isActive)
  )
    throw new AppError('unavailable', 'Stale entitlement response. Refresh access online.');
  if (
    incomingTime === previousTime &&
    incoming.entitlements.isActive &&
    previous.entitlements.isActive
  )
    return {
      ...incoming,
      fetchedAt: previous.fetchedAt,
      validUntil: Math.min(incoming.validUntil, previous.validUntil),
    };
  return incoming;
}

interface Dependencies {
  readonly userId: string | null;
  readonly usage: () => Promise<{ decks: number; cards: number }>;
  readonly fetch?: (operation?: LearningOperation) => Promise<Entitlements>;
  readonly online?: () => Promise<boolean>;
  readonly readCache?: () => Promise<EntitlementCache | null>;
  readonly writeCache?: (cache: EntitlementCache | null) => Promise<EntitlementCache | null | void>;
  readonly assertCurrent?: () => void;
  readonly now?: () => number;
}

export interface AccessState {
  readonly entitlements: Entitlements | null;
  readonly provisional: boolean;
  readonly message: string | null;
  readonly restriction?: {
    readonly decks: boolean;
    readonly cards: boolean;
    readonly operation?: LearningOperation;
  };
}

export class LearningAccessController implements LearningAccess {
  private cache: EntitlementCache | null = null;
  private loaded = false;
  private restoring: Promise<void> | null = null;
  private refreshing: Promise<void> | null = null;
  private refreshingOperation?: LearningOperation;
  private refreshedAt: number | null = null;
  private nextBackgroundAttempt = 0;
  private backgroundFailures = 0;
  private generation = 0;
  private state: AccessState = { entitlements: null, provisional: true, message: null };
  private readonly listeners = new Set<() => void>();
  private readonly now: () => number;

  constructor(private readonly dependencies: Dependencies) {
    this.now = dependencies.now ?? Date.now;
  }

  get isAccount(): boolean {
    return this.dependencies.userId !== null;
  }

  snapshot = (): AccessState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(state: AccessState): void {
    this.dependencies.assertCurrent?.();
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  async invalidate(message: string): Promise<void> {
    this.dependencies.assertCurrent?.();
    this.generation++;
    this.refreshedAt = null;
    this.nextBackgroundAttempt = 0;
    this.backgroundFailures = 0;
    this.cache = null;
    this.loaded = true;
    await this.dependencies.writeCache?.(null);
    this.publish({ entitlements: null, provisional: true, message });
  }

  refresh(operation?: LearningOperation): Promise<void> {
    if (this.refreshing && operation === 'study' && this.refreshingOperation !== 'study')
      return this.refreshing.then(() => this.refresh(operation));
    if (!this.refreshing) {
      this.refreshingOperation = operation;
      this.refreshing = this.load(operation).finally(() => {
        this.refreshing = null;
        this.refreshingOperation = undefined;
      });
    }
    return this.refreshing;
  }

  refreshIfStale(): Promise<void> {
    this.dependencies.assertCurrent?.();
    const now = this.now();
    if (
      !this.isAccount ||
      now < this.nextBackgroundAttempt ||
      (this.refreshedAt !== null &&
        now >= this.refreshedAt &&
        now - this.refreshedAt < 60_000 &&
        !this.state.provisional &&
        this.freshCache())
    )
      return Promise.resolve();
    const generation = this.generation;
    this.nextBackgroundAttempt = now + 30_000;
    return this.refresh().finally(() => {
      if (generation !== this.generation) return;
      const confirmed = !this.state.provisional && !!this.freshCache();
      this.backgroundFailures = confirmed ? 0 : Math.min(this.backgroundFailures + 1, 5);
      this.nextBackgroundAttempt =
        this.now() +
        (confirmed ? 60_000 : Math.min(5 * 60_000, 30_000 * 2 ** (this.backgroundFailures - 1)));
    });
  }

  private async load(operation?: LearningOperation): Promise<void> {
    const dependencies = this.dependencies;
    const generation = this.generation;
    dependencies.assertCurrent?.();
    if (!dependencies.userId) return;
    await this.restore();
    dependencies.assertCurrent?.();
    try {
      if (!dependencies.fetch || !(await dependencies.online?.())) throw new Error('offline');
      const requestedAt = this.now();
      const entitlements = validateEntitlements(await dependencies.fetch(operation));
      dependencies.assertCurrent?.();
      if (generation !== this.generation)
        throw new AppError('unavailable', 'Account permissions changed. Refresh online.');
      let cache = reconcileEntitlementCache(
        this.cache,
        serverEntitlementCache(entitlements, requestedAt),
      );
      cache = (await dependencies.writeCache?.(cache)) || cache;
      dependencies.assertCurrent?.();
      if (generation !== this.generation) {
        await dependencies.writeCache?.(null);
        throw new AppError('unavailable', 'Account permissions changed. Refresh online.');
      }
      this.cache = cache;
      const accepted = this.freshCache();
      this.refreshedAt = accepted ? this.now() : null;
      this.publish({
        entitlements: accepted?.entitlements ?? null,
        provisional: !accepted,
        restriction: accepted?.entitlements.isActive ? undefined : this.state.restriction,
        message: !accepted
          ? 'The server response is too old to confirm access. Refresh online; free limits apply.'
          : !accepted.entitlements.isActive &&
              accepted.entitlements.expiresAtUtc &&
              Date.parse(accepted.entitlements.expiresAtUtc) <=
                Date.parse(accepted.entitlements.validatedAtUtc)
            ? 'Your Plus subscription has expired. Free limits apply; your data is preserved. View plans.'
            : null,
      });
    } catch (error) {
      dependencies.assertCurrent?.();
      const status = (error as { status?: number } | null)?.status;
      if (status === 401 || status === 403) {
        if (generation === this.generation)
          await this.invalidate(
            error instanceof Error ? error.message : 'Refresh account permissions online.',
          );
        throw new AppError(
          status === 403 ? 'free-tier-limit' : 'unavailable',
          this.state.message!,
          error,
        );
      }
      if (generation !== this.generation) throw error;
      const cache = this.freshCache();
      this.publish({
        entitlements: cache?.entitlements ?? null,
        provisional: true,
        message: cache
          ? 'Offline or server unavailable: access is provisional, not server-confirmed. Reconnect to refresh.'
          : 'Subscription status is unconfirmed or expired. Free limits apply until refreshed online.',
      });
    }
  }

  /** Restore account access from disk without waiting for a network request. */
  async restore(): Promise<void> {
    this.dependencies.assertCurrent?.();
    if (this.loaded || !this.isAccount) return;
    if (!this.restoring) {
      const generation = this.generation;
      this.restoring = (async () => {
        const cache = (await this.dependencies.readCache?.()) ?? null;
        this.dependencies.assertCurrent?.();
        if (generation !== this.generation)
          throw new AppError('unavailable', 'Account permissions changed. Refresh online.');
        this.cache = cache;
        this.loaded = true;
        this.publish({
          entitlements: this.freshCache()?.entitlements ?? null,
          provisional: true,
          message: null,
        });
      })().finally(() => {
        this.restoring = null;
      });
    }
    await this.restoring;
  }

  private freshCache(): EntitlementCache | null {
    const cache = this.cache;
    const time = this.now();
    return cache &&
      cache.fetchedAt <= time &&
      time < cache.validUntil &&
      Number.isSafeInteger(cache.validUntil) &&
      cache.validUntil <= serverEntitlementCache(cache.entitlements, cache.fetchedAt).validUntil
      ? cache
      : null;
  }

  async assertAllowed(operation: LearningOperation, amount = 1): Promise<void> {
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw new AppError('validation', 'Invalid content count.');
    await this.restore();
    this.dependencies.assertCurrent?.();
    let local: { decks: number; cards: number };
    try {
      local = await this.dependencies.usage();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        'persistence',
        'Unable to verify local learning limits. Your data is preserved.',
        error,
      );
    }
    this.dependencies.assertCurrent?.();
    const entitlement = this.freshCache()?.entitlements;
    if (!entitlement && this.state.entitlements)
      this.publish({ entitlements: null, provisional: true, message: null });
    if (this.dependencies.userId && entitlement?.isActive && entitlement.currentPlan === 'Plus')
      return;
    const usage = local;
    const decksExceeded =
      usage.decks + (operation === 'deck' ? amount : 0) > freeLearningLimits.decks;
    const cardsExceeded =
      usage.cards + (operation === 'card' ? amount : 0) > freeLearningLimits.cards;
    if (decksExceeded || cardsExceeded) {
      const message = `${decksExceeded ? 'The free limit is 1 active deck. ' : ''}${cardsExceeded ? 'The free limit is 50 active cards in total. ' : ''}Existing data is preserved. View plans or explicitly delete unwanted data; viewing, editing and export remain available.`;
      this.publish({
        ...this.state,
        message,
        restriction: { decks: decksExceeded, cards: cardsExceeded, operation },
      });
      throw new AppError('free-tier-limit', message);
    }
    if (!this.dependencies.userId && this.state.message)
      this.publish({ ...this.state, message: null, restriction: undefined });
  }
}

export function localLearningUsage(repositories: Pick<Repositories, 'decks' | 'cards'>) {
  return async () => {
    const decks = await repositories.decks.list({ includeArchived: true });
    const counts = await Promise.all(decks.map((deck) => repositories.cards.countByDeck(deck.id)));
    return {
      decks: decks.filter((deck) => !deck.archivedAt).length,
      cards: counts.reduce((total, count) => total + count, 0),
    };
  };
}

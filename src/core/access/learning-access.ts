import { AppError } from '@/core/errors/app-error';
import type { LearningAccess, LearningOperation } from '@/core/ports/learning-access';
import type { Repositories } from '@/core/ports/repositories';
import { validateEntitlements, type Entitlements } from '@/core/sync/subscription';

export const provisionalEntitlementLifetimeMs = 5 * 60 * 1000;
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
      : provisionalEntitlementLifetimeMs;
  return {
    entitlements,
    fetchedAt,
    validUntil: fetchedAt + Math.min(remaining, provisionalEntitlementLifetimeMs),
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
  private refreshing: Promise<void> | null = null;
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
    this.cache = null;
    this.loaded = true;
    await this.dependencies.writeCache?.(null);
    this.publish({ entitlements: null, provisional: true, message });
  }

  refresh(operation?: LearningOperation): Promise<void> {
    if (!this.refreshing)
      this.refreshing = this.load(operation).finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  private async load(operation?: LearningOperation): Promise<void> {
    const dependencies = this.dependencies;
    const generation = this.generation;
    dependencies.assertCurrent?.();
    if (!dependencies.userId) return;
    if (!this.loaded) {
      const cache = (await dependencies.readCache?.()) ?? null;
      dependencies.assertCurrent?.();
      if (generation !== this.generation)
        throw new AppError('unavailable', 'Account permissions changed. Refresh online.');
      this.cache = cache;
      this.loaded = true;
    }
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
      this.publish({
        entitlements: accepted?.entitlements ?? null,
        provisional: !accepted,
        restriction:
          accepted && !accepted.entitlements.isActive && !accepted.entitlements.withinFreeTierLimits
            ? {
                decks: accepted.entitlements.usage.decks > freeLearningLimits.decks,
                cards: accepted.entitlements.usage.cards > freeLearningLimits.cards,
              }
            : undefined,
        message: !accepted
          ? 'The server response is too old to confirm access. Refresh online; free limits apply.'
          : !accepted.entitlements.isActive && !accepted.entitlements.withinFreeTierLimits
            ? 'Your account exceeds 1 active deck or 50 active cards. Study and new content are restricted. Existing data, editing and export remain available.'
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

  private freshCache(): EntitlementCache | null {
    const cache = this.cache;
    const time = this.now();
    return cache &&
      cache.fetchedAt <= time &&
      time < cache.validUntil &&
      cache.validUntil - cache.fetchedAt <= provisionalEntitlementLifetimeMs
      ? cache
      : null;
  }

  async assertAllowed(operation: LearningOperation, amount = 1): Promise<void> {
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw new AppError('validation', 'Invalid content count.');
    await this.refresh(operation);
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
    if (this.dependencies.userId && entitlement?.isActive && entitlement.currentPlan === 'Plus')
      return;
    const usage = {
      decks: Math.max(local.decks, this.dependencies.userId ? (entitlement?.usage.decks ?? 0) : 0),
      cards: Math.max(local.cards, this.dependencies.userId ? (entitlement?.usage.cards ?? 0) : 0),
    };
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

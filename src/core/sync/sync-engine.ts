import { AppState } from 'react-native';
import * as Network from 'expo-network';
import type { CloudClient } from './cloud-client';
import { CloudError } from './cloud-client';
import type { SyncStore } from './sync-store';

export class SyncEngine {
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pullFailures = 0;
  private active = false;

  constructor(private readonly store: SyncStore, private readonly cloud: CloudClient,
    private readonly online: () => Promise<boolean> = async () => {
      const state = await Network.getNetworkStateAsync();
      return state.isConnected !== false && state.isInternetReachable !== false;
    }, private readonly afterPull: () => Promise<void> = async () => {}) {}

  get available(): boolean {
    return this.cloud.available;
  }

  async signIn(email: string, password: string, displayName?: string): Promise<void> {
    await this.cloud.signIn(email, password, (id) => this.store.bind(id), displayName);
    this.trigger();
  }

  async signOut(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.cloud.signOut();
  }

  async status() {
    const account = await this.store.account();
    return { userId: account.userId, cursor: account.cursor, signedIn: this.cloud.available && await this.cloud.hasSession(),
      ...(await this.store.counts()), conflicts: await this.store.conflicts() };
  }

  async resolve(operationId: string, choice: 'server' | 'local'): Promise<void> {
    if (this.running) await this.running;
    await this.store.resolve(operationId, choice);
    if (choice === 'server') await this.afterPull();
    this.trigger();
  }

  async retryFailed(): Promise<void> {
    if (this.running) await this.running;
    await this.store.retryFailed();
    await this.syncNow();
  }

  syncNow(): Promise<void> {
    if (!this.running) {
      this.running = this.perform().finally(() => { this.running = null; });
    }
    return this.running;
  }

  private async perform(): Promise<void> {
    if (!this.cloud.available || !(await this.cloud.hasSession()) || !(await this.online())) return;
    const account = await this.store.account();
    if (!account.userId) return;
    const pending = await this.store.pending();
    for (const candidate of pending) {
      const operation = await this.store.prepare(candidate);
      try {
        const response = await this.cloud.push(operation, account.deviceId, account.userId);
        const version = response.changes[0]?.serverVersion;
        if (!Number.isSafeInteger(version) || !version || version < 1)
          throw new Error('Invalid sync acknowledgement.');
        await this.store.acknowledge(operation, version);
      } catch (error) {
        if (error instanceof CloudError && error.status === 409 && error.conflict) {
          await this.store.conflict(operation, error.conflict);
          continue;
        }
        if (error instanceof CloudError && error.status === 401) return;
        const retryable = !(error instanceof CloudError) || error.status === 429 || error.status >= 500;
        await this.store.failed(operation, retryable);
        if (retryable && operation.retryCount < 5) this.retry(operation.retryCount);
        if (retryable) return;
      }
    }

    let pageCount = 0;
    try {
      let page;
      do {
        const cursor = (await this.store.account()).cursor;
        page = await this.cloud.pull(cursor);
        await this.store.applyPage(page);
        if (page.changes.length) await this.afterPull();
        pageCount++;
      } while (page.hasMore && pageCount < 3);
      this.pullFailures = 0;
      if (page.hasMore || pending.length === 25) this.retry(0);
    } catch (error) {
      if (error instanceof CloudError && error.status === 401) return;
      this.pullFailures++;
      if (this.pullFailures < 5) this.retry(this.pullFailures);
      throw error;
    }
  }

  private retry(attempt: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; this.trigger(); },
      Math.min(16_000, 1000 * 2 ** Math.max(0, attempt - 1)));
  }

  private trigger(): void {
    if (this.active) void this.syncNow().catch(() => {});
  }

  start(): () => void {
    if (!this.cloud.available) return () => {};
    this.active = true;
    const reconnect = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        this.pullFailures = 0;
        this.trigger();
      }
    });
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') this.trigger();
    });
    this.trigger();
    return () => {
      this.active = false;
      reconnect.remove();
      foreground.remove();
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
    };
  }
}

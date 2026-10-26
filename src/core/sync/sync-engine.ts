import { AppState } from 'react-native';
import * as Network from 'expo-network';
import type { CloudClient } from './cloud-client';
import { CloudError } from './cloud-client';
import type { SyncStore } from './sync-store';
import type { OtpPurpose, PhonePasswordRegistration, PhoneRegistration } from './phone-auth';
import type { LogoutResult } from './logout-journal';
import type { ServerBackup } from './server-backup';
import { retryDelay } from './retry-policy';

export interface LocalScopeLifecycle {
  isAccount(): boolean;
  enterAccount(userId: string): Promise<void>;
  enterGuest(): Promise<void>;
  enterEmptyGuest?(): Promise<void>;
  lockAccount?(): void;
}

export class SyncEngine {
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pullFailures = 0;
  private retryAt = 0;
  private active = false;
  private scopeChanging = false;
  private signOutError: string | null = null;
  private accountTaskRunning = false;
  private operationEpoch = 0;
  private logoutInFlight: Promise<LogoutResult> | null = null;
  private logoutResult: LogoutResult | null = null;
  private readonly logoutListeners = new Set<() => void>();

  logoutSnapshot = (): LogoutResult | null => this.logoutResult;
  subscribeLogout = (listener: () => void): (() => void) => {
    this.logoutListeners.add(listener);
    return () => this.logoutListeners.delete(listener);
  };

  async restoreLogoutNotice(): Promise<void> {
    this.setLogoutResult(await this.cloud.logoutStatus());
  }

  private setLogoutResult(result: LogoutResult | null): void {
    this.logoutResult = result;
    this.logoutListeners.forEach((listener) => listener());
  }

  constructor(
    private readonly store: SyncStore,
    private readonly cloud: CloudClient,
    private readonly online: () => Promise<boolean> = async () => {
      const state = await Network.getNetworkStateAsync();
      return state.isConnected !== false && state.isInternetReachable !== false;
    },
    private readonly afterPull: () => Promise<void> = async () => {},
    private readonly scopes?: LocalScopeLifecycle,
    private readonly afterAuthentication: () => void = () => {},
  ) {}

  get available(): boolean {
    return this.cloud.available;
  }

  async accountProfile() {
    if (this.scopes && !this.scopes.isAccount()) throw new Error('Please sign in first.');
    return this.cloud.accountProfile();
  }

  updateAccountName(displayName: string) {
    return this.readAccount((cloud) => cloud.updateAccountName(displayName));
  }

  backupStatus() {
    return this.readAccount((cloud) => cloud.backupStatus());
  }

  planCatalog() {
    return this.cloud.planCatalog();
  }

  subscription() {
    return this.readAccount((cloud) => cloud.subscription());
  }

  entitlements() {
    return this.readAccount((cloud) => cloud.entitlements());
  }

  private async readAccount<Result>(
    read: (cloud: CloudClient) => Promise<Result>,
  ): Promise<Result> {
    const epoch = this.operationEpoch;
    const assertSession = () => {
      if (
        epoch !== this.operationEpoch ||
        this.scopeChanging ||
        (this.scopes && !this.scopes.isAccount())
      )
        throw new Error('An authenticated account is required.');
    };
    assertSession();
    if (!this.cloud.available || !(await this.cloud.hasSession())) throw new CloudError(401);
    assertSession();
    const result = await read(this.cloud);
    assertSession();
    return result;
  }

  createBackup(): Promise<ServerBackup> {
    return this.withAccount((store, cloud, synchronize) =>
      this.backupSynchronizedAccount(store, cloud, synchronize),
    );
  }

  private async backupSynchronizedAccount(
    store: SyncStore,
    cloud: CloudClient,
    synchronize: () => Promise<void>,
  ): Promise<ServerBackup> {
    await synchronize();
    await store.verifySynchronized(cloud);
    const backup = await cloud.createBackup((await store.account()).cursor);
    await store.verifySynchronized(cloud);
    return backup;
  }

  async signIn(email: string, password: string, displayName?: string): Promise<void> {
    await this.authenticate((bind) => this.cloud.signIn(email, password, bind, displayName));
  }

  signOut(synchronize = false): Promise<LogoutResult> {
    if (this.logoutInFlight) return this.logoutInFlight;
    const action = synchronize
      ? this.withAccount(async (store, cloud, sync) => {
          const backup = await this.backupSynchronizedAccount(store, cloud, sync);
          return this.finishSignOut(true, backup);
        })
      : this.finishSignOut(false);
    this.logoutInFlight = action.finally(() => {
      this.logoutInFlight = null;
    });
    return this.logoutInFlight;
  }

  private async finishSignOut(synchronized: boolean, backup?: ServerBackup): Promise<LogoutResult> {
    this.scopeChanging = true;
    this.operationEpoch++;
    this.scopes?.lockAccount?.();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.retryAt = 0;
    this.pullFailures = 0;
    this.signOutError = null;
    this.setLogoutResult(null);
    const guest = (
      this.scopes?.enterEmptyGuest?.() ??
      this.scopes?.enterGuest() ??
      Promise.resolve()
    ).then(
      () => null,
      (error: unknown) => error,
    );
    try {
      const result = await this.cloud.signOut(
        synchronized,
        (local) => this.setLogoutResult(backup ? { ...local, backup } : local),
        backup,
      );
      this.setLogoutResult(result);
      if (!result.serverRevoked) this.signOutError = 'Server revocation could not be confirmed.';
      return result;
    } catch (error) {
      this.setLogoutResult({
        synchronized,
        serverRevoked: false,
        credentialsCleared: false,
        retryAvailable: false,
        ...(backup ? { backup } : {}),
      });
      this.signOutError =
        error instanceof Error ? error.message : 'Server sign-out could not be confirmed.';
      throw error;
    } finally {
      const guestError = await guest;
      this.scopeChanging = false;
      if (guestError) throw guestError;
    }
  }

  async enterGuest(): Promise<void> {
    if (!this.scopes || this.scopeChanging) return;
    this.setLogoutResult(null);
    this.scopeChanging = true;
    this.operationEpoch++;
    this.scopes.lockAccount?.();
    try {
      await (this.scopes.enterEmptyGuest?.() ?? this.scopes.enterGuest());
    } finally {
      this.scopeChanging = false;
    }
  }

  private async authenticate(
    action: (bind: (id: string) => Promise<void>) => Promise<string>,
  ): Promise<void> {
    if (this.scopeChanging || this.accountTaskRunning || this.logoutInFlight)
      throw new Error('Please wait for the current account change.');
    this.scopeChanging = true;
    let activated = false;
    try {
      if (this.running) await this.running.catch(() => {});
      await action(async (id) => {
        if (this.scopes) {
          await this.scopes.enterAccount(id);
          activated = true;
        }
        await this.store.bind(id);
      });
      this.signOutError = null;
      this.setLogoutResult(null);
    } catch (error) {
      if (activated && this.scopes) {
        await this.cloud.forgetLocalSession();
        await this.scopes.enterGuest();
      }
      throw error;
    } finally {
      this.scopeChanging = false;
    }
    this.afterAuthentication();
  }

  async withAccount<Result>(
    action: (
      store: SyncStore,
      cloud: CloudClient,
      synchronize: (progress?: () => Promise<void>) => Promise<void>,
    ) => Promise<Result>,
  ): Promise<Result> {
    if (this.scopeChanging || this.accountTaskRunning || (this.scopes && !this.scopes.isAccount()))
      throw new Error('An authenticated account without another pending operation is required.');
    this.accountTaskRunning = true;
    let task: Promise<void> | null = null;
    try {
      if (this.running) await this.running.catch(() => {});
      if (!this.cloud.available || !(await this.cloud.hasSession()))
        throw new Error('Please sign in first.');
      if (this.scopeChanging || (this.scopes && !this.scopes.isAccount()))
        throw new Error('The account session changed. Sign in again.');
      const result = action(this.store, this.cloud, async (progress) => {
        do {
          await this.syncPass(true, progress);
          const counts = await this.store.counts();
          if (counts.failed || counts.conflict)
            throw new Error('Resolve account sync errors before continuing.');
          if (!counts.pending) break;
        } while (true);
      });
      task = result.then(
        () => {},
        () => {},
      );
      this.running = task;
      return await result;
    } finally {
      if (task && this.running === task) this.running = null;
      this.accountTaskRunning = false;
    }
  }

  requestOtp(phoneNumber: string, purpose: OtpPurpose) {
    return this.cloud.requestOtp(phoneNumber, purpose);
  }

  verifyRegistrationOtp(challengeId: string, code: string) {
    return this.cloud.verifyRegistrationOtp(challengeId, code);
  }

  async registerPhone(registration: PhoneRegistration): Promise<void> {
    await this.authenticate((bind) => this.cloud.registerPhone(registration, bind));
  }

  async registerPhoneWithPassword(registration: PhonePasswordRegistration): Promise<void> {
    await this.authenticate((bind) => this.cloud.registerPhoneWithPassword(registration, bind));
  }

  async signInPhone(phoneNumber: string, password: string): Promise<void> {
    await this.authenticate((bind) => this.cloud.signInPhone(phoneNumber, password, bind));
  }

  async signInGoogle(idToken: string): Promise<void> {
    await this.authenticate((bind) => this.cloud.signInGoogle(idToken, bind));
  }

  async loginWithOtp(challengeId: string, code: string): Promise<void> {
    await this.authenticate((bind) => this.cloud.loginWithOtp(challengeId, code, bind));
  }

  async status() {
    if (this.scopes && !this.scopes.isAccount())
      return {
        userId: '',
        cursor: 0,
        signedIn: false,
        sessionError: this.signOutError,
        pending: 0,
        failed: 0,
        conflict: 0,
        conflicts: [],
      };
    const account = await this.store.account();
    return {
      userId: account.userId,
      cursor: account.cursor,
      signedIn:
        (!this.scopes || this.scopes.isAccount()) &&
        this.cloud.available &&
        (await this.cloud.hasSession()),
      sessionError: this.signOutError,
      ...(await this.store.counts()),
      conflicts: await this.store.conflicts(),
    };
  }

  async resolve(operationId: string, choice: 'server' | 'local'): Promise<void> {
    if (this.scopeChanging || (this.scopes && !this.scopes.isAccount()))
      throw new Error('Please sign in first.');
    if (this.running) await this.running;
    if (this.scopeChanging || (this.scopes && !this.scopes.isAccount()))
      throw new Error('The account session changed.');
    await this.store.resolve(operationId, choice);
    if (choice === 'server') await this.afterPull();
    this.trigger();
  }

  async retryFailed(): Promise<void> {
    if (this.scopeChanging || (this.scopes && !this.scopes.isAccount()))
      throw new Error('Please sign in first.');
    if (this.running) await this.running;
    if (this.scopeChanging || (this.scopes && !this.scopes.isAccount()))
      throw new Error('The account session changed.');
    await this.store.retryFailed();
    await this.syncNow();
  }

  syncNow(): Promise<void> {
    if (!this.running) {
      this.running = this.perform().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private async perform(): Promise<void> {
    if (this.scopeChanging || this.accountTaskRunning || (this.scopes && !this.scopes.isAccount()))
      return;
    await this.syncPass(false);
  }

  private async syncPass(
    strict: boolean,
    progress: () => Promise<void> = async () => {},
  ): Promise<void> {
    const epoch = this.operationEpoch;
    const assertSession = () => {
      if (
        epoch !== this.operationEpoch ||
        this.scopeChanging ||
        (this.scopes && !this.scopes.isAccount())
      )
        throw new CloudError(401);
    };
    if (!this.cloud.available || !(await this.cloud.hasSession()) || !(await this.online())) {
      if (strict) throw new Error('A connection is required to verify account synchronization.');
      return;
    }
    assertSession();
    if (typeof this.cloud.retryPendingRevocations === 'function')
      await this.cloud.retryPendingRevocations().catch(() => {});
    assertSession();
    const account = await this.store.account();
    if (!account.userId) {
      if (strict) throw new Error('The authenticated account is unavailable.');
      return;
    }
    const pending = await this.store.pending();
    for (const candidate of pending) {
      assertSession();
      const operation = await this.store.prepare(candidate);
      assertSession();
      try {
        const response = await this.cloud.push(operation, account.deviceId, account.userId);
        assertSession();
        const version = response.changes[0]?.serverVersion;
        if (!Number.isSafeInteger(version) || !version || version < 1)
          throw new Error('Invalid sync acknowledgement.');
        await this.store.acknowledge(operation, version);
        await progress();
      } catch (error) {
        assertSession();
        if (error instanceof CloudError && error.status === 409 && error.conflict) {
          await this.store.conflict(operation, error.conflict);
          if (strict) throw error;
          continue;
        }
        if (error instanceof CloudError && error.status === 401) {
          if (strict) throw error;
          return;
        }
        const retryable =
          !(error instanceof CloudError) ||
          error.status === 0 ||
          error.status === 429 ||
          error.status >= 500;
        await this.store.failed(operation, retryable);
        if (strict) throw error;
        if (retryable && operation.retryCount < 5)
          this.retry(operation.retryCount, error instanceof CloudError ? error.retryAfterMs : 0);
        if (retryable) return;
      }
    }

    let pageCount = 0;
    try {
      let page;
      do {
        const cursor = (await this.store.account()).cursor;
        assertSession();
        page = await this.cloud.pull(cursor);
        assertSession();
        await this.store.applyPage(page);
        if (page.changes.length) await this.afterPull();
        pageCount++;
        if (strict && pageCount >= 1000 && page.hasMore)
          throw new Error('Account pull is incomplete. Retry before transferring data.');
      } while (page.hasMore && (strict || pageCount < 3));
      if (strict && (await this.store.account()).cursor < page.latestVersion)
        throw new Error(
          'Server sync cursor has not been fully pulled. Synchronization is incomplete.',
        );
      this.pullFailures = 0;
      if (!strict && (page.hasMore || pending.length === 25)) this.retry(0);
    } catch (error) {
      if (error instanceof CloudError && error.status === 401 && !strict) return;
      this.pullFailures++;
      if (!strict && this.pullFailures < 5)
        this.retry(this.pullFailures, error instanceof CloudError ? error.retryAfterMs : 0);
      throw error;
    }
  }

  private retry(attempt: number, minimumMs = 0): void {
    if (this.timer) clearTimeout(this.timer);
    const delay = retryDelay(attempt, minimumMs);
    this.retryAt = Date.now() + delay;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.retryAt = 0;
      this.trigger();
    }, delay);
  }

  private trigger(): void {
    if (
      this.active &&
      AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive' &&
      Date.now() >= this.retryAt
    )
      void this.syncNow().catch(() => {});
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
      this.retryAt = 0;
    };
  }
}

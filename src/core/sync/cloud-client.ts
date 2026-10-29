import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { validateEntitlements, validatePlanCatalog, validateSubscription } from './subscription';
import { RequestCache } from './request-cache';
import { validateMyketCheckout, validateMyketConfiguration } from './myket-payment';
import { retryAfterDelay } from './retry-policy';
import {
  validateBackupMetadata,
  validateServerBackup,
  type BackupOverview,
  type ServerBackup,
} from './server-backup';
import {
  LogoutJournal,
  logoutBarrierKey,
  sessionReference,
  type LogoutResult,
} from './logout-journal';
import type { PendingOperation, PullPage, SyncConflict } from './contract';
import {
  normalizePhoneNumber,
  validateTokens,
  type AuthTokens as Tokens,
  type OtpChallenge,
  type OtpPurpose,
  type OtpVerification,
  type PhonePasswordRegistration,
  type PhoneRegistration,
} from './phone-auth';

const tokenKey = 'lerona.cloud.credentials.v1';
type StoredTokens = Tokens & { readonly userId?: string };

export interface AccountProfile {
  readonly id: string;
  readonly displayName: string;
  readonly phoneNumber: string | null;
  readonly email: string | null;
}

function normalizeAccountProfile(account: AccountProfile): AccountProfile {
  if (!account || typeof account.id !== 'string' || !account.id)
    throw new Error('Invalid account response.');
  return {
    id: account.id,
    displayName: typeof account.displayName === 'string' ? account.displayName : '',
    phoneNumber: typeof account.phoneNumber === 'string' ? account.phoneNumber : null,
    email: typeof account.email === 'string' ? account.email : null,
  };
}

interface AccountReviewState {
  cardId: string;
  box: number;
  dueDate: string;
  totalReviews: number;
  totalSuccesses: number;
  consecutiveSuccesses: number;
  lastReviewedAtUtc: string | null;
}

export class CloudError extends Error {
  constructor(
    readonly status: number,
    readonly conflict?: SyncConflict,
    message?: string,
    readonly code?: string,
    readonly retryAfterMs?: number,
  ) {
    super(
      message ??
        (status === 401
          ? 'Please sign in again.'
          : status === 409
            ? 'Sync conflict.'
            : 'Cloud request failed.'),
    );
  }
}

export class CloudClient {
  private readonly reads = new RequestCache();
  private refreshInFlight: Promise<Tokens> | null = null;
  private sessionEpoch = 0;
  private locallySignedOut = false;
  private readonly requests = new Set<AbortController>();
  private readonly logoutJournal = new LogoutJournal();
  private credentialWrites: Promise<void> = Promise.resolve();
  constructor(
    private readonly onSessionLost: () => void = () => {},
    private readonly onAccessDenied: (message: string) => Promise<void> = async () => {},
  ) {}

  private async clearTokens(): Promise<void> {
    this.invalidateSession();
    await SecureStore.setItemAsync(logoutBarrierKey, 'signed-out').catch(() => {});
    await this.credentialWrites.catch(() => {});
    await SecureStore.deleteItemAsync(tokenKey);
  }

  private invalidateSession(): void {
    this.reads.clear();
    this.locallySignedOut = true;
    this.sessionEpoch++;
    this.requests.forEach((controller) => controller.abort());
    this.onSessionLost();
  }

  async storedUserId(): Promise<string | null> {
    const tokens = await this.readTokens();
    return typeof tokens?.userId === 'string' && tokens.userId ? tokens.userId : null;
  }

  async forgetLocalSession(): Promise<void> {
    this.sessionEpoch++;
    await this.clearTokens();
  }

  private get baseUrl(): string | undefined {
    return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  }

  get available(): boolean {
    return Platform.OS !== 'web' && !!this.baseUrl && this.baseUrl.startsWith('https://');
  }

  private url(path: string): string {
    if (!this.available)
      throw new Error('Cloud sync requires an HTTPS API URL and a native build.');
    return `${this.baseUrl}/api/v1${path}`;
  }

  private async fetchWithTimeout(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    this.requests.add(controller);
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      return await fetch(this.url(path), {
        ...init,
        cache: 'no-store',
        headers: { ...init.headers, 'Cache-Control': 'no-cache, no-store' },
        signal: controller.signal,
      });
    } catch (error) {
      if (!this.available) throw error;
      throw new CloudError(
        0,
        undefined,
        'Network request failed. Check your connection and try again.',
        'network_error',
      );
    } finally {
      clearTimeout(timeout);
      this.requests.delete(controller);
    }
  }

  private async readTokens(): Promise<StoredTokens | null> {
    if (
      this.locallySignedOut ||
      (await SecureStore.getItemAsync(logoutBarrierKey)) === 'signed-out'
    )
      return null;
    const stored = await SecureStore.getItemAsync(tokenKey);
    if (!stored || this.locallySignedOut) return null;
    try {
      return validateTokens(JSON.parse(stored));
    } catch {
      await this.clearTokens();
      return null;
    }
  }

  async hasSession(): Promise<boolean> {
    // Token expiry controls cloud requests; it must not hide the account's local data.
    return !!(await this.readTokens()) && !this.locallySignedOut;
  }

  accountProfile(): Promise<AccountProfile> {
    return this.reads.get('profile', () => this.loadAccountProfile());
  }

  private async loadAccountProfile(): Promise<AccountProfile> {
    const account = await this.request<AccountProfile>('/me/', { method: 'GET' });
    return normalizeAccountProfile(account);
  }

  async updateAccountName(displayName: string): Promise<AccountProfile> {
    const name = displayName.trim();
    if (!name || name.length > 120) throw new Error('Invalid display name.');
    const account = normalizeAccountProfile(
      await this.request<AccountProfile>('/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name }),
      }),
    );
    if (account.displayName !== name) throw new Error('The account name was not saved.');
    this.reads.delete('profile');
    return account;
  }

  async ownedReviewState(cardId: string): Promise<AccountReviewState> {
    const result = await this.request<AccountReviewState>(
      `/me/cards/${encodeURIComponent(cardId)}/review-state`,
      { method: 'GET' },
    );
    if (
      !result ||
      result.cardId !== cardId ||
      !Number.isInteger(result.box) ||
      result.box < 1 ||
      result.box > 5 ||
      typeof result.dueDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(result.dueDate) ||
      [result.totalReviews, result.totalSuccesses, result.consecutiveSuccesses].some(
        (value) => !Number.isSafeInteger(value) || value < 0,
      ) ||
      result.totalSuccesses > result.totalReviews ||
      result.consecutiveSuccesses > result.totalSuccesses ||
      (result.lastReviewedAtUtc !== null &&
        (typeof result.lastReviewedAtUtc !== 'string' ||
          !Number.isFinite(Date.parse(result.lastReviewedAtUtc))))
    )
      throw new Error(
        'Backend review verification is incomplete or invalid. Deploy the compatible review-state API before completing this transfer.',
      );
    return result;
  }

  async ownedCards(deckId: string): Promise<
    {
      id: string;
      deckId: string;
      frontText?: string;
      meaning?: string;
      archivedAtUtc: string | null;
    }[]
  > {
    const result = await this.request<
      {
        id: string;
        deckId: string;
        frontText?: string;
        meaning?: string;
        archivedAtUtc: string | null;
      }[]
    >(`/me/decks/${encodeURIComponent(deckId)}/cards`, { method: 'GET' });
    if (
      !Array.isArray(result) ||
      result.some((card) => !card || typeof card.id !== 'string' || card.deckId !== deckId)
    )
      throw new Error('Invalid account card response.');
    return result;
  }

  async ownedDecks(): Promise<{ id: string; name: string; archivedAtUtc: string | null }[]> {
    const decks = await this.request<{ id: string; name: string; archivedAtUtc: string | null }[]>(
      '/me/decks',
      { method: 'GET' },
    );
    if (
      !Array.isArray(decks) ||
      decks.some((deck) => typeof deck.id !== 'string' || typeof deck.name !== 'string')
    )
      throw new Error('Invalid account deck response.');
    return decks;
  }

  private saveTokens(tokens: StoredTokens, epoch = this.sessionEpoch): Promise<void> {
    const operation = this.credentialWrites
      .catch(() => {})
      .then(async () => {
        if (epoch !== this.sessionEpoch) throw new CloudError(401);
        await SecureStore.setItemAsync(tokenKey, JSON.stringify(tokens));
        if (epoch !== this.sessionEpoch) {
          await SecureStore.deleteItemAsync(tokenKey);
          throw new CloudError(401);
        }
      });
    this.credentialWrites = operation;
    return operation;
  }

  async signIn(
    email: string,
    password: string,
    bindUser: (userId: string) => Promise<void>,
    displayName?: string,
  ): Promise<string> {
    const epoch = this.sessionEpoch;
    const response = await this.fetchWithTimeout(displayName ? '/auth/register' : '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, ...(displayName ? { displayName } : {}) }),
    });
    if (!response.ok)
      throw new CloudError(
        response.status,
        undefined,
        undefined,
        response.status === 401 ? 'invalid_credentials' : undefined,
      );
    const tokens = validateTokens(await response.json());
    return this.completeSignIn(tokens, bindUser, epoch);
  }

  private async completeSignIn(
    tokens: Tokens,
    bindUser: (userId: string) => Promise<void>,
    epoch: number,
  ): Promise<string> {
    try {
      if (epoch !== this.sessionEpoch) throw new CloudError(401);
      const account = await this.request<{ id: string }>(
        '/me/',
        { method: 'GET' },
        tokens.accessToken,
      );
      if (typeof account.id !== 'string' || !account.id)
        throw new Error('Invalid account response.');
      if (epoch !== this.sessionEpoch) throw new CloudError(401);
      await bindUser(account.id);
      if (epoch !== this.sessionEpoch) throw new CloudError(401);
      await this.saveTokens({ ...tokens, userId: account.id }, epoch);
      if (epoch !== this.sessionEpoch) {
        await this.clearTokens();
        throw new CloudError(401);
      }
      await SecureStore.deleteItemAsync(logoutBarrierKey);
      if (epoch !== this.sessionEpoch) throw new CloudError(401);
      this.reads.clear();
      this.locallySignedOut = false;
      await this.logoutJournal
        .update((journal) => {
          journal.result = null;
        })
        .catch(() => {});
      await this.retryPendingRevocations().catch(() => {});
      return account.id;
    } catch (error) {
      try {
        await this.request('/auth/logout', { method: 'POST' }, tokens.accessToken);
      } catch {}
      throw error;
    }
  }

  private async authPost<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetchWithTimeout(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
      throw new CloudError(
        response.status,
        undefined,
        typeof error.error === 'string' ? error.error : undefined,
        error.code,
      );
    }
    return (await response.json()) as T;
  }

  async requestOtp(phoneNumber: string, purpose: OtpPurpose): Promise<OtpChallenge> {
    const challenge = await this.authPost<OtpChallenge>('/auth/phone/otp/request', {
      phoneNumber: normalizePhoneNumber(phoneNumber),
      purpose,
    });
    if (
      !challenge ||
      typeof challenge.challengeId !== 'string' ||
      !challenge.challengeId ||
      !Number.isFinite(Date.parse(challenge.expiresAtUtc)) ||
      !Number.isFinite(Date.parse(challenge.resendAtUtc))
    )
      throw new Error('Invalid OTP response.');
    return challenge;
  }

  async verifyRegistrationOtp(challengeId: string, code: string): Promise<OtpVerification> {
    const result = await this.authPost<OtpVerification>('/auth/phone/otp/verify', {
      challengeId,
      code,
    });
    if (
      !result ||
      !result.registrationToken ||
      !result.expiresAtUtc ||
      result.tokens ||
      !Number.isFinite(Date.parse(result.expiresAtUtc))
    )
      throw new Error('Invalid OTP verification response.');
    return result;
  }

  async loginWithOtp(
    challengeId: string,
    code: string,
    bindUser: (userId: string) => Promise<void>,
  ): Promise<string> {
    const epoch = this.sessionEpoch;
    const result = await this.authPost<OtpVerification>('/auth/phone/otp/verify', {
      challengeId,
      code,
    });
    return this.completeSignIn(validateTokens(result?.tokens), bindUser, epoch);
  }

  async registerPhone(
    registration: PhoneRegistration,
    bindUser: (userId: string) => Promise<void>,
  ): Promise<string> {
    const epoch = this.sessionEpoch;
    const tokens = validateTokens(
      await this.authPost('/auth/phone/register', {
        ...registration,
        phoneNumber: normalizePhoneNumber(registration.phoneNumber),
      }),
    );
    return this.completeSignIn(tokens, bindUser, epoch);
  }

  async registerPhoneWithPassword(
    registration: PhonePasswordRegistration,
    bindUser: (userId: string) => Promise<void>,
  ): Promise<string> {
    const epoch = this.sessionEpoch;
    const tokens = validateTokens(
      await this.authPost('/auth/phone/register-password', {
        ...registration,
        phoneNumber: normalizePhoneNumber(registration.phoneNumber),
      }),
    );
    return this.completeSignIn(tokens, bindUser, epoch);
  }

  async signInGoogle(
    idToken: string,
    bindUser: (userId: string) => Promise<void>,
  ): Promise<string> {
    const epoch = this.sessionEpoch;
    const tokens = validateTokens(await this.authPost('/auth/google', { idToken }));
    return this.completeSignIn(tokens, bindUser, epoch);
  }

  async signInPhone(
    phoneNumber: string,
    password: string,
    bindUser: (userId: string) => Promise<void>,
  ): Promise<string> {
    const epoch = this.sessionEpoch;
    const tokens = validateTokens(
      await this.authPost('/auth/phone/login', {
        phoneNumber: normalizePhoneNumber(phoneNumber),
        password,
      }),
    );
    return this.completeSignIn(tokens, bindUser, epoch);
  }

  async logoutStatus(): Promise<LogoutResult | null> {
    return (await this.logoutJournal.read()).result;
  }

  planCatalog(force = false) {
    return this.reads.get(
      'plans',
      async () => {
        const response = await this.fetchWithTimeout('/plans', {
          method: 'GET',
          headers: { 'X-Lerona-Payments': 'myket-v1' },
        });
        if (!response.ok) throw new CloudError(response.status);
        return validatePlanCatalog(await response.json());
      },
      5 * 60_000,
      force,
    );
  }

  async subscription() {
    return this.reads.get('subscription', async () =>
      validateSubscription(await this.request('/me/subscription', { method: 'GET' })),
    );
  }

  async myketConfiguration() {
    return validateMyketConfiguration(await this.request('/payments/myket/', { method: 'GET' }));
  }

  async beginMyketCheckout(durationMonths: number) {
    return validateMyketCheckout(
      await this.request('/payments/myket/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMonths }),
      }),
    );
  }

  async verifyMyketPurchase(sku: string, token: string) {
    const result = validateSubscription(
      await this.request('/payments/myket/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, token }),
      }),
    );
    this.reads.clear();
    return result;
  }

  cancelMyketCheckout(id: string): Promise<void> {
    return this.request(`/payments/myket/orders/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    });
  }

  async entitlements() {
    return this.reads.get('entitlements', async () =>
      validateEntitlements(await this.request('/me/entitlements', { method: 'GET' })),
    );
  }

  async authorizeStudy() {
    return validateEntitlements(await this.request('/me/study/authorize', { method: 'POST' }));
  }

  async backupStatus(force = false): Promise<BackupOverview> {
    const epoch = this.sessionEpoch;
    if (!(await this.hasSession()) || epoch !== this.sessionEpoch) throw new CloudError(401);
    const result = await this.reads.get('backups', () => this.loadBackupStatus(), 15_000, force);
    if (epoch !== this.sessionEpoch || this.locallySignedOut) throw new CloudError(401);
    return result;
  }

  private async loadBackupStatus(): Promise<BackupOverview> {
    const epoch = this.sessionEpoch;
    const [status, page] = await Promise.all([
      this.request<{ latestCompleted: unknown }>('/backups/status', { method: 'GET' }),
      this.request<{ items: unknown[] }>('/backups/?page=1&limit=1', { method: 'GET' }),
    ]);
    if (epoch !== this.sessionEpoch || this.locallySignedOut) throw new CloudError(401);
    if (!status || !page || !Array.isArray(page.items) || page.items.length > 1)
      throw new Error('Invalid server backup status. Refresh or try again later.');
    const lastSuccessful =
      status.latestCompleted === null ? null : validateBackupMetadata(status.latestCompleted);
    if (lastSuccessful && lastSuccessful.status !== 'Completed')
      throw new Error('Invalid latest completed backup. Refresh or try again later.');
    return {
      lastSuccessful,
      latest: page.items.length ? validateBackupMetadata(page.items[0]) : null,
    };
  }

  async createBackup(expectedSyncVersion: number): Promise<ServerBackup> {
    this.reads.delete('backups');
    try {
      return await this.createBackupRequest(expectedSyncVersion);
    } finally {
      this.reads.delete('backups');
    }
  }

  private async createBackupRequest(expectedSyncVersion: number): Promise<ServerBackup> {
    const epoch = this.sessionEpoch;
    const tokens = await this.readTokens();
    if (!tokens?.userId || !Number.isSafeInteger(expectedSyncVersion) || expectedSyncVersion < 0)
      throw new Error('A verified account and sync version are required for backup.');
    const key = `lerona.cloud.backup-request.v1.${tokens.userId}`;
    const raw = await SecureStore.getItemAsync(key);
    const previous = raw ? (JSON.parse(raw) as { requestId: string; version: number }) : null;
    if (
      previous &&
      (typeof previous.requestId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          previous.requestId,
        ) ||
        !Number.isSafeInteger(previous.version) ||
        previous.version < 0)
    )
      throw new Error('The saved backup retry reference is invalid. Account data was preserved.');
    const attempt =
      previous?.version === expectedSyncVersion
        ? previous
        : { requestId: randomUUID(), version: expectedSyncVersion };
    if (epoch !== this.sessionEpoch || this.locallySignedOut) throw new CloudError(401);
    await SecureStore.setItemAsync(key, JSON.stringify(attempt));
    if (epoch !== this.sessionEpoch || this.locallySignedOut) throw new CloudError(401);
    let created: ServerBackup;
    try {
      created = validateServerBackup(
        await this.request('/backups/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: attempt.requestId,
            formatVersion: 1,
            expectedSyncVersion,
          }),
        }),
        expectedSyncVersion,
      );
    } catch (error) {
      if (error instanceof CloudError && error.status === 410)
        await SecureStore.deleteItemAsync(key);
      if (error instanceof CloudError && error.status !== 401)
        throw new CloudError(
          error.status,
          error.conflict,
          `Server backup was not confirmed (HTTP ${error.status}). Retry, or explicitly log out without backup.`,
          error.code,
        );
      throw error;
    }
    const verified = validateServerBackup(
      await this.request(`/backups/${encodeURIComponent(created.id)}`, { method: 'GET' }),
      expectedSyncVersion,
    );
    if (
      verified.id !== created.id ||
      verified.completedAtUtc !== created.completedAtUtc ||
      verified.expiresAtUtc !== created.expiresAtUtc ||
      verified.syncVersion !== created.syncVersion ||
      verified.sizeBytes !== created.sizeBytes
    )
      throw new Error(
        'The stored backup could not be verified. Retry with the existing backup request.',
      );
    if (epoch !== this.sessionEpoch || this.locallySignedOut) throw new CloudError(401);
    await SecureStore.deleteItemAsync(key);
    if (epoch !== this.sessionEpoch || this.locallySignedOut) throw new CloudError(401);
    return verified;
  }

  async retryPendingRevocations(): Promise<void> {
    const tokens = await this.readTokens();
    if (!tokens?.userId) return;
    const epoch = this.sessionEpoch;
    const receipts = (await this.logoutJournal.read()).receipts;
    for (const receipt of receipts) {
      if (receipt.userId !== tokens.userId.toLowerCase()) continue;
      if (epoch !== this.sessionEpoch || this.locallySignedOut) throw new CloudError(401);
      await this.request(`/auth/logout/${encodeURIComponent(receipt.sessionId)}`, {
        method: 'POST',
      });
      if (epoch !== this.sessionEpoch) throw new CloudError(401);
      await this.logoutJournal.remove(receipt);
    }
  }

  async signOut(
    synchronized = false,
    localCompleted: (result: LogoutResult) => void = () => {},
    backup?: ServerBackup,
  ): Promise<LogoutResult> {
    const original = SecureStore.getItemAsync(tokenKey);
    this.invalidateSession();
    let tokens: StoredTokens | null = null;
    let barrierWritten = false;
    let credentialsCleared = false;
    let retryAvailable = false;
    let serverRevoked = false;
    try {
      await SecureStore.setItemAsync(logoutBarrierKey, 'signed-out');
      barrierWritten = true;
    } catch {}
    try {
      const raw = await original;
      if (raw) tokens = validateTokens(JSON.parse(raw));
    } catch {}
    const receipt = tokens ? sessionReference(tokens) : null;
    if (receipt) {
      try {
        await this.logoutJournal.add(receipt);
        retryAvailable = true;
      } catch {}
    }
    await this.credentialWrites.catch(() => {});
    try {
      await SecureStore.deleteItemAsync(tokenKey);
      credentialsCleared = true;
    } catch {
      try {
        await SecureStore.setItemAsync(tokenKey, 'null');
        credentialsCleared = true;
      } catch {}
    }
    if (!barrierWritten && !credentialsCleared)
      throw new Error(
        'Secure storage could not disable saved credentials. Account access is blocked now; keep the app open and retry logout before restarting.',
      );
    await this.logoutJournal
      .update((journal) => {
        journal.result = {
          synchronized,
          serverRevoked: false,
          credentialsCleared,
          retryAvailable,
          ...(backup ? { backup } : {}),
        };
      })
      .catch(() => {});
    localCompleted({ synchronized, serverRevoked: false, credentialsCleared, retryAvailable });
    if (tokens && this.available) {
      try {
        let response = await this.fetchWithTimeout('/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
        if (response.status === 401) {
          const refreshed = validateTokens(
            await this.authPost('/auth/refresh', { refreshToken: tokens.refreshToken }),
          );
          response = await this.fetchWithTimeout('/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${refreshed.accessToken}` },
          });
        }
        serverRevoked = response.status === 204;
      } catch {}
    }
    if (serverRevoked && receipt) await this.logoutJournal.remove(receipt).catch(() => {});
    const result = {
      synchronized,
      serverRevoked,
      credentialsCleared,
      retryAvailable,
      ...(backup ? { backup } : {}),
    };
    await this.logoutJournal
      .update((journal) => {
        journal.result = result;
      })
      .catch(() => {});
    return result;
  }

  private async refresh(): Promise<Tokens> {
    if (this.refreshInFlight) return this.refreshInFlight;
    const epoch = this.sessionEpoch;
    this.refreshInFlight = (async () => {
      const existing = await this.readTokens();
      if (!existing) throw new CloudError(401);
      const response = await this.fetchWithTimeout('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: existing.refreshToken }),
      });
      if (!response.ok) {
        if (response.status === 401) await this.clearTokens();
        throw new CloudError(
          response.status,
          undefined,
          undefined,
          undefined,
          retryAfterDelay(response.headers?.get('Retry-After')),
        );
      }
      const tokens = validateTokens(await response.json());
      if (epoch !== this.sessionEpoch || this.locallySignedOut) throw new CloudError(401);
      await this.saveTokens(
        {
          ...tokens,
          ...(existing.userId ? { userId: existing.userId } : {}),
          ...(tokens.sessionId ? {} : existing.sessionId ? { sessionId: existing.sessionId } : {}),
        },
        epoch,
      );
      if (epoch !== this.sessionEpoch) {
        await this.clearTokens();
        throw new CloudError(401);
      }
      return tokens;
    })()
      .catch(async (error) => {
        if (
          epoch === this.sessionEpoch &&
          error instanceof CloudError &&
          error.status === 401 &&
          !this.locallySignedOut
        )
          await this.clearTokens();
        throw error;
      })
      .finally(() => {
        this.refreshInFlight = null;
      });
    return this.refreshInFlight;
  }

  private async request<T>(path: string, init: RequestInit, overrideToken?: string): Promise<T> {
    const epoch = this.sessionEpoch;
    let tokens = overrideToken ? null : await this.readTokens();
    if (epoch !== this.sessionEpoch) throw new CloudError(401);
    if (!overrideToken && !tokens) throw new CloudError(401);
    if (tokens && Date.parse(tokens.accessExpiresAtUtc) - Date.now() < 30_000)
      tokens = await this.refresh();
    const send = (token: string) =>
      this.fetchWithTimeout(path, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${token}` },
      });
    if (epoch !== this.sessionEpoch || (!overrideToken && this.locallySignedOut))
      throw new CloudError(401);
    let response = await send(overrideToken ?? tokens!.accessToken);
    if (epoch !== this.sessionEpoch) throw new CloudError(401);
    if (response.status === 401 && !overrideToken) {
      tokens = await this.refresh();
      response = await send(tokens.accessToken);
      if (epoch !== this.sessionEpoch) throw new CloudError(401);
    }
    if (!response.ok) {
      if (response.status === 401 && !overrideToken) await this.clearTokens();
      if (response.status === 403) {
        const body = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
        if (epoch !== this.sessionEpoch) throw new CloudError(401);
        if (body.code?.startsWith('free_tier_'))
          await this.onAccessDenied(
            body.error ?? 'Access restricted. Refresh your subscription online.',
          );
        throw new CloudError(403, undefined, body.error, body.code);
      }
      if (response.status === 409) {
        const body = (await response.json()) as { conflict?: SyncConflict; code?: string };
        throw new CloudError(409, body.conflict, undefined, body.code);
      }
      throw new CloudError(
        response.status,
        undefined,
        undefined,
        (
          (typeof response.json === 'function' ? await response.json().catch(() => ({})) : {}) as {
            code?: string;
          }
        ).code,
        retryAfterDelay(response.headers?.get('Retry-After')),
      );
    }
    const result = response.status === 204 ? (undefined as T) : ((await response.json()) as T);
    if (epoch !== this.sessionEpoch) throw new CloudError(401);
    return result;
  }

  push(
    operation: PendingOperation,
    deviceId: string,
    userId: string,
  ): Promise<{
    cursor: number;
    changes: { status: 'applied' | 'duplicate'; serverVersion: number }[];
  }> {
    let payload = operation.payload;
    if (
      operation.entityType === 'deck' &&
      operation.operation === 'upsert' &&
      payload &&
      typeof payload === 'object' &&
      'reviewSystem' in payload
    ) {
      if (payload.reviewSystem !== 'leitner')
        throw new CloudError(
          400,
          undefined,
          'The backend only supports Leitner decks. Other scheduler data remains local.',
        );
      const { reviewSystem: _reviewSystem, ...supported } = payload;
      payload = supported;
    }
    return this.request('/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changes: [
          {
            clientChangeId: operation.operationId,
            deviceId,
            entityType: operation.entityType,
            entityId: operation.entityType === 'settings' ? userId : operation.entityId,
            operation: operation.operation,
            clientChangedAtUtc: operation.createdAt,
            expectedVersion: operation.expectedVersion,
            payload,
          },
        ],
      }),
    });
  }

  pull(cursor: number): Promise<PullPage> {
    return this.request(`/sync/pull?cursor=${cursor}&limit=100`, { method: 'GET' });
  }
}

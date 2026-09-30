import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { PendingOperation, PullPage, SyncConflict } from './contract';

interface Tokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAtUtc: string;
}

const tokenKey = 'lightman.cloud.credentials.v1';

export class CloudError extends Error {
  constructor(readonly status: number, readonly conflict?: SyncConflict) {
    super(status === 401 ? 'Please sign in again.' : status === 409 ? 'Sync conflict.' : 'Cloud request failed.');
  }
}

export class CloudClient {
  private refreshInFlight: Promise<Tokens> | null = null;

  private get baseUrl(): string | undefined {
    return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  }

  get available(): boolean {
    return Platform.OS !== 'web' && !!this.baseUrl && this.baseUrl.startsWith('https://');
  }

  private url(path: string): string {
    if (!this.available) throw new Error('Cloud sync requires an HTTPS API URL and a native build.');
    return `${this.baseUrl}/api/v1${path}`;
  }

  private async fetchWithTimeout(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try { return await fetch(this.url(path), { ...init, signal: controller.signal }); }
    finally { clearTimeout(timeout); }
  }

  private async readTokens(): Promise<Tokens | null> {
    const stored = await SecureStore.getItemAsync(tokenKey);
    return stored ? (JSON.parse(stored) as Tokens) : null;
  }

  async hasSession(): Promise<boolean> {
    return !!(await this.readTokens());
  }

  private async saveTokens(tokens: Tokens): Promise<void> {
    await SecureStore.setItemAsync(tokenKey, JSON.stringify(tokens));
  }

  async signIn(email: string, password: string, bindUser: (userId: string) => Promise<void>, displayName?: string): Promise<string> {
    const response = await this.fetchWithTimeout(displayName ? '/auth/register' : '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, ...(displayName ? { displayName } : {}) }),
    });
    if (!response.ok) throw new CloudError(response.status);
    const tokens = (await response.json()) as Tokens;
    const account = await this.request<{ id: string }>('/me/', { method: 'GET' }, tokens.accessToken);
    await bindUser(account.id);
    await this.saveTokens(tokens);
    return account.id;
  }

  async signOut(): Promise<void> {
    try {
      if (await this.hasSession()) await this.request('/auth/logout', { method: 'POST' });
    } finally {
      await SecureStore.deleteItemAsync(tokenKey);
    }
  }

  private async refresh(): Promise<Tokens> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = (async () => {
      const existing = await this.readTokens();
      if (!existing) throw new CloudError(401);
      const response = await this.fetchWithTimeout('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: existing.refreshToken }),
      });
      if (!response.ok) {
        if (response.status === 401) await SecureStore.deleteItemAsync(tokenKey);
        throw new CloudError(response.status);
      }
      const tokens = (await response.json()) as Tokens;
      await this.saveTokens(tokens);
      return tokens;
    })().finally(() => { this.refreshInFlight = null; });
    return this.refreshInFlight;
  }

  private async request<T>(path: string, init: RequestInit, overrideToken?: string): Promise<T> {
    let tokens = overrideToken ? null : await this.readTokens();
    if (!overrideToken && !tokens) throw new CloudError(401);
    if (tokens && Date.parse(tokens.accessExpiresAtUtc) - Date.now() < 30_000) tokens = await this.refresh();
    const send = (token: string) => this.fetchWithTimeout(path, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
    let response = await send(overrideToken ?? tokens!.accessToken);
    if (response.status === 401 && !overrideToken) {
      tokens = await this.refresh();
      response = await send(tokens.accessToken);
    }
    if (!response.ok) {
      if (response.status === 409) {
        const body = await response.json() as { conflict?: SyncConflict };
        throw new CloudError(409, body.conflict);
      }
      throw new CloudError(response.status);
    }
    return response.status === 204 ? (undefined as T) : (await response.json() as T);
  }

  push(operation: PendingOperation, deviceId: string, userId: string): Promise<{
    cursor: number; changes: { status: 'applied' | 'duplicate'; serverVersion: number }[]
  }> {
    return this.request('/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes: [{
        clientChangeId: operation.operationId,
        deviceId,
        entityType: operation.entityType,
        entityId: operation.entityType === 'settings' ? userId : operation.entityId,
        operation: operation.operation,
        clientChangedAtUtc: operation.createdAt,
        expectedVersion: operation.expectedVersion,
        payload: operation.payload,
      }] }),
    });
  }

  pull(cursor: number): Promise<PullPage> {
    return this.request(`/sync/pull?cursor=${cursor}&limit=100`, { method: 'GET' });
  }
}

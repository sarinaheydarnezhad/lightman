import * as SecureStore from 'expo-secure-store';
import { CloudClient } from './cloud-client';
import type { PendingOperation } from './contract';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const credential = {
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
  accessExpiresAtUtc: '2026-01-01T00:00:00.000Z',
};

const rotated = {
  accessToken: 'new-access',
  refreshToken: 'new-refresh',
  accessExpiresAtUtc: '2099-01-01T00:00:00.000Z',
};

test('backup status uses authenticated metadata APIs with no owner or payload supplied by the client', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(rotated));
  globalThis.fetch = jest.fn().mockImplementation(async (url) => ({
    ok: true,
    json: async () =>
      String(url).endsWith('/backups/status')
        ? {
            latestCompleted: null,
            retentionDays: 30,
            maxPayloadBytes: 10485760,
            restoreSupported: false,
            automaticCleanup: false,
          }
        : { items: [], nextPage: null },
  }));
  expect(await new CloudClient().backupStatus()).toEqual({ latest: null, lastSuccessful: null });
  expect(jest.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
    'https://api.example.test/api/v1/backups/status',
    'https://api.example.test/api/v1/backups/?page=1&limit=1',
  ]);
  for (const [, init] of jest.mocked(fetch).mock.calls) {
    expect(init!.method).toBe('GET');
    expect(init!.body).toBeUndefined();
    expect(init!.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer new-access' }));
  }
});

test.each([undefined, { items: {} }, { items: [null] }, { items: [null, null] }])(
  'invalid backup status is not treated as never backed up: %j',
  async (page) => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(rotated));
    globalThis.fetch = jest.fn().mockImplementation(async (url) => ({
      ok: true,
      json: async () =>
        String(url).endsWith('/backups/status') ? { latestCompleted: null } : page,
    }));
    await expect(new CloudClient().backupStatus()).rejects.toThrow();
  },
);

test('expired backup authentication clears credentials rather than returning cached status', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(rotated));
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
  const lost = jest.fn();
  await expect(new CloudClient(lost).backupStatus()).rejects.toMatchObject({ status: 401 });
  expect(lost).toHaveBeenCalled();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('lerona.cloud.credentials.v1');
});

test('late backup status after local logout is rejected by the existing session epoch', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(rotated));
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  globalThis.fetch = jest.fn().mockImplementation(async (url) => {
    await gate;
    return {
      ok: true,
      json: async () =>
        String(url).endsWith('/backups/status') ? { latestCompleted: null } : { items: [] },
    };
  });
  const cloud = new CloudClient();
  const result = cloud.backupStatus();
  const rejected = expect(result).rejects.toMatchObject({ status: 401 });
  await cloud.forgetLocalSession();
  finish();
  await rejected;
});

test('backup capacity machine codes survive the existing authenticated request pipeline', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(rotated));
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => ({ code: 'backup_capacity_reached', error: 'Capacity reached.' }),
  });
  await expect(new CloudClient().backupStatus()).rejects.toMatchObject({
    status: 409,
    code: 'backup_capacity_reached',
  });
});

test('Leitner sync writes match the backend contract and unsupported schedulers never upload', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(rotated));
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ cursor: 1, changes: [{ status: 'applied', serverVersion: 1 }] }),
  });
  const payload = {
    name: 'Words',
    description: '',
    language: 'en',
    textAlignment: 'ltr',
    typographySize: 'medium',
    reviewSystem: 'leitner',
  };
  const operation: PendingOperation = {
    sequence: 1,
    operationId: 'receipt',
    entityType: 'deck',
    entityId: 'deck',
    operation: 'upsert',
    payload,
    expectedVersion: 0,
    createdAt: '2026-10-01T12:00:00.000Z',
    retryCount: 1,
    status: 'pending',
  };
  await new CloudClient().push(operation, 'device', 'owner');
  const body = JSON.parse(jest.mocked(fetch).mock.calls[0]![1]!.body as string) as {
    changes: { payload: unknown }[];
  };
  expect(body.changes[0]!.payload).toEqual({
    name: 'Words',
    description: '',
    language: 'en',
    textAlignment: 'ltr',
    typographySize: 'medium',
  });
  expect(payload.reviewSystem).toBe('leitner');
  expect(() =>
    new CloudClient().push(
      { ...operation, payload: { ...payload, reviewSystem: 'sm2' } },
      'device',
      'owner',
    ),
  ).toThrow('only supports Leitner');
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('owned account inventory and full review verification use authenticated existing read APIs', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(rotated));
  const state = {
    cardId: 'card',
    box: 2,
    dueDate: '2026-10-06',
    totalReviews: 3,
    totalSuccesses: 2,
    consecutiveSuccesses: 1,
    lastReviewedAtUtc: '2026-10-04T12:00:00Z',
  };
  globalThis.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'deck', name: 'Words', archivedAtUtc: null }],
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'card', deckId: 'deck', archivedAtUtc: null }],
    })
    .mockResolvedValueOnce({ ok: true, json: async () => state });
  const client = new CloudClient();
  expect(await client.ownedDecks()).toHaveLength(1);
  expect(await client.ownedCards('deck')).toHaveLength(1);
  expect(await client.ownedReviewState('card')).toEqual(state);
  for (const request of jest.mocked(fetch).mock.calls)
    expect(request[1]?.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer new-access' }),
    );
  jest.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ cardId: 'card', box: 2, dueDate: '2026-10-06', totalReviews: 3 }),
  } as Response);
  await expect(client.ownedReviewState('card')).rejects.toThrow(
    'Deploy the compatible review-state API',
  );
});

test('cached account identity supports offline scope restoration and survives refresh rotation', async () => {
  jest
    .mocked(SecureStore.getItemAsync)
    .mockResolvedValue(JSON.stringify({ ...credential, userId: 'account-id' }));
  const client = new CloudClient();
  globalThis.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => rotated })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ cursor: 0, latestVersion: 0, hasMore: false, changes: [] }),
    });
  expect(await client.storedUserId()).toBe('account-id');
  expect(globalThis.fetch).not.toHaveBeenCalled();
  await client.pull(0);
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    expect.any(String),
    JSON.stringify({ ...rotated, userId: 'account-id' }),
  );
});

test('session rejection immediately isolates account access before clearing secure credentials', async () => {
  const lost = jest.fn();
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
  await expect(new CloudClient(lost).pull(0)).rejects.toMatchObject({ status: 401 });
  expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  expect(lost).toHaveBeenCalled();
  expect(jest.mocked(SecureStore.deleteItemAsync).mock.invocationCallOrder[0]).toBeGreaterThan(
    lost.mock.invocationCallOrder[0]!,
  );
});

test('authoritative backend quota errors retain the restriction message and machine code', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(rotated));
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({
      error: 'The free plan allows 1 active deck.',
      code: 'free_tier_deck_limit',
    }),
  });
  const rejected = jest.fn(async () => {});
  await expect(new CloudClient(undefined, rejected).pull(0)).rejects.toMatchObject({
    status: 403,
    code: 'free_tier_deck_limit',
    message: 'The free plan allows 1 active deck.',
  });
  expect(rejected).toHaveBeenCalledWith('The free plan allows 1 active deck.');
});

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue(JSON.stringify(credential));
  jest.mocked(SecureStore.setItemAsync).mockReset().mockResolvedValue();
  jest.mocked(SecureStore.deleteItemAsync).mockReset().mockResolvedValue();
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

test('account profile uses the existing authenticated me API', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(rotated));
  const profile = {
    id: 'account-id',
    displayName: 'Student',
    phoneNumber: '+989121234567',
    email: null,
  };
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => profile });
  expect(await new CloudClient().accountProfile()).toEqual(profile);
  expect(globalThis.fetch).toHaveBeenCalledWith(
    'https://api.example.test/api/v1/me/',
    expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ Authorization: 'Bearer new-access' }),
    }),
  );
});

test('legacy account profile responses normalize absent optional details', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(rotated));
  globalThis.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ id: 'account-id' }) });
  expect(await new CloudClient().accountProfile()).toEqual({
    id: 'account-id',
    displayName: '',
    phoneNumber: null,
    email: null,
  });
});

test('access expiry refreshes securely before an authenticated pull', async () => {
  globalThis.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => rotated })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ cursor: 0, latestVersion: 0, hasMore: false, changes: [] }),
    });
  await new CloudClient().pull(0);
  expect(globalThis.fetch).toHaveBeenCalledWith(
    'https://api.example.test/api/v1/sync/pull?cursor=0&limit=100',
    expect.objectContaining({
      cache: 'no-store',
      headers: { Authorization: 'Bearer new-access', 'Cache-Control': 'no-cache, no-store' },
    }),
  );
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    expect.any(String),
    JSON.stringify(rotated),
  );
});

test('registration never persists tokens before confirming the local account binding', async () => {
  globalThis.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => rotated })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'other-user' }) });
  await expect(
    new CloudClient().signIn(
      'student@example.com',
      'password',
      async () => {
        throw new Error('Another user owns the offline database.');
      },
      'Student',
    ),
  ).rejects.toThrow('Another user');
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

test('logout revokes the session and removes secure credentials', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(rotated));
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 204 });
  await new CloudClient().signOut();
  expect(globalThis.fetch).toHaveBeenCalledWith(
    'https://api.example.test/api/v1/auth/logout',
    expect.objectContaining({
      cache: 'no-store',
      headers: { Authorization: 'Bearer new-access', 'Cache-Control': 'no-cache, no-store' },
    }),
  );
  expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
});

test('phone password login matches the backend contract and binds before storing tokens', async () => {
  const bind = jest.fn(async () => {});
  globalThis.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => rotated })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'phone-user' }) });
  await expect(
    new CloudClient().signInPhone('۰۹۱۲۱۲۳۴۵۶۷', 'private-password', bind),
  ).resolves.toBe('phone-user');
  expect(globalThis.fetch).toHaveBeenCalledWith(
    'https://api.example.test/api/v1/auth/phone/login',
    expect.objectContaining({
      body: JSON.stringify({ phoneNumber: '+989121234567', password: 'private-password' }),
    }),
  );
  expect(bind).toHaveBeenCalledWith('phone-user');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    expect.any(String),
    JSON.stringify({ ...rotated, userId: 'phone-user' }),
  );
});

test('OTP request and registration verification never persist OTPs or registration proofs', async () => {
  const challenge = {
    challengeId: 'challenge',
    expiresAtUtc: '2099-01-01T00:05:00Z',
    resendAtUtc: '2099-01-01T00:01:00Z',
  };
  const verification = {
    registrationToken: 'proof',
    expiresAtUtc: '2099-01-01T00:10:00Z',
    tokens: null,
  };
  globalThis.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => challenge })
    .mockResolvedValueOnce({ ok: true, json: async () => verification });
  const cloud = new CloudClient();
  await expect(cloud.requestOtp('09121234567', 'register')).resolves.toEqual(challenge);
  await expect(cloud.verifyRegistrationOtp('challenge', '123456')).resolves.toEqual(verification);
  expect(globalThis.fetch).toHaveBeenNthCalledWith(
    1,
    'https://api.example.test/api/v1/auth/phone/otp/request',
    expect.objectContaining({
      body: JSON.stringify({ phoneNumber: '+989121234567', purpose: 'register' }),
    }),
  );
  expect(globalThis.fetch).toHaveBeenNthCalledWith(
    2,
    'https://api.example.test/api/v1/auth/phone/otp/verify',
    expect.objectContaining({ body: JSON.stringify({ challengeId: 'challenge', code: '123456' }) }),
  );
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

test('registration sends the proof password confirmation and non-unique username', async () => {
  const registration = {
    phoneNumber: '09121234567',
    registrationToken: 'proof',
    password: 'long-password',
    confirmPassword: 'long-password',
    username: 'Student',
  };
  globalThis.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => rotated })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'phone-user' }) });
  await new CloudClient().registerPhone(registration, async () => {});
  expect(globalThis.fetch).toHaveBeenCalledWith(
    'https://api.example.test/api/v1/auth/phone/register',
    expect.objectContaining({
      body: JSON.stringify({ ...registration, phoneNumber: '+989121234567' }),
    }),
  );
  expect(SecureStore.setItemAsync).toHaveBeenCalled();
});

test('OTP login does not submit a password and uses the existing token storage', async () => {
  globalThis.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ registrationToken: null, expiresAtUtc: null, tokens: rotated }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'phone-user' }) });
  await new CloudClient().loginWithOtp('challenge', '123456', async () => {});
  expect(globalThis.fetch).toHaveBeenCalledWith(
    'https://api.example.test/api/v1/auth/phone/otp/verify',
    expect.objectContaining({ body: JSON.stringify({ challengeId: 'challenge', code: '123456' }) }),
  );
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    expect.any(String),
    JSON.stringify({ ...rotated, userId: 'phone-user' }),
  );
});

test.each([
  [401, 'invalid_otp'],
  [409, 'duplicate_phone'],
  [429, 'otp_rate_limit'],
  [503, 'sms_unavailable'],
])(
  'authentication status %s preserves its error code and never stores credentials',
  async (status, code) => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status, json: async () => ({ error: 'Safe error', code }) });
    await expect(
      new CloudClient().verifyRegistrationOtp('challenge', '123456'),
    ).rejects.toMatchObject({ status, code });
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  },
);

test('a lost refresh response clears uncertain credentials rather than replaying the consumed token', async () => {
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network disconnected'));
  await expect(new CloudClient().pull(0)).rejects.toMatchObject({
    status: 0,
    code: 'network_error',
  });
  expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
    'lerona.cloud.credentials.v1',
    expect.anything(),
  );
});

test('refresh rejection clears the expired session', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
  await expect(new CloudClient().pull(0)).rejects.toMatchObject({ status: 401 });
  expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
});

test('concurrent requests share a single refresh rotation', async () => {
  const page = { cursor: 0, latestVersion: 0, hasMore: false, changes: [] };
  globalThis.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => rotated })
    .mockResolvedValue({ ok: true, json: async () => page });
  const cloud = new CloudClient();
  await Promise.all([cloud.pull(0), cloud.pull(0)]);
  const refreshes = jest
    .mocked(globalThis.fetch)
    .mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'));
  expect(refreshes).toHaveLength(1);
});

test('offline logout removes local tokens and explicitly reports unconfirmed server revocation', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(rotated));
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network disconnected'));
  await expect(new CloudClient().signOut()).resolves.toMatchObject({
    serverRevoked: false,
    credentialsCleared: true,
  });
  expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
});

test('online logout can rotate an expired access token solely for revocation without saving new credentials', async () => {
  globalThis.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: false, status: 401 })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => rotated })
    .mockResolvedValueOnce({ ok: true, status: 204 });
  await expect(new CloudClient().signOut()).resolves.toMatchObject({
    serverRevoked: true,
    credentialsCleared: true,
  });
  expect(fetch).toHaveBeenNthCalledWith(
    2,
    'https://api.example.test/api/v1/auth/refresh',
    expect.objectContaining({ body: JSON.stringify({ refreshToken: credential.refreshToken }) }),
  );
  expect(fetch).toHaveBeenNthCalledWith(
    3,
    'https://api.example.test/api/v1/auth/logout',
    expect.objectContaining({
      cache: 'no-store',
      headers: { Authorization: 'Bearer new-access', 'Cache-Control': 'no-cache, no-store' },
    }),
  );
  expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
    'lerona.cloud.credentials.v1',
    expect.anything(),
  );
});

test('corrupt secure credentials do not count as a session', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('{bad-json');
  await expect(new CloudClient().hasSession()).resolves.toBe(false);
  expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
});

test('known session expiration disables offline credential restoration and isolates account state', async () => {
  jest
    .mocked(SecureStore.getItemAsync)
    .mockResolvedValue(JSON.stringify({ ...rotated, sessionExpiresAtUtc: '2020-01-01T00:00:00Z' }));
  const lost = jest.fn();
  await expect(new CloudClient(lost).hasSession()).resolves.toBe(false);
  expect(lost).toHaveBeenCalled();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('lerona.cloud.credentials.v1');
});

test('legacy credentials with expired access and no known session deadline cannot restore offline account access', async () => {
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Offline'));
  const lost = jest.fn();
  await expect(new CloudClient(lost).hasSession()).resolves.toBe(false);
  expect(lost).toHaveBeenCalled();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('lerona.cloud.credentials.v1');
});

test('logout invalidates active rotation immediately and never persists its late token response', async () => {
  const saved = new Map([['lerona.cloud.credentials.v1', JSON.stringify(credential)]]);
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => saved.get(key) ?? null);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => {
    saved.set(key, value);
  });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => {
    saved.delete(key);
  });
  let finishRefresh: (response: unknown) => void = () => {};
  globalThis.fetch = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRefresh = resolve;
        }),
    )
    .mockImplementation(async (url) =>
      String(url).endsWith('/auth/logout')
        ? { ok: true, status: 204 }
        : {
            ok: true,
            json: async () => ({ cursor: 0, latestVersion: 0, hasMore: false, changes: [] }),
          },
    );
  const cloud = new CloudClient();
  const pull = cloud.pull(0);
  for (let tick = 0; tick < 10; tick++) await Promise.resolve();
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  const rejected = expect(pull).rejects.toMatchObject({ status: 401 });
  const logout = cloud.signOut();
  finishRefresh({ ok: true, json: async () => rotated });
  await Promise.all([rejected, logout]);
  expect(globalThis.fetch).toHaveBeenCalledWith(
    'https://api.example.test/api/v1/auth/logout',
    expect.objectContaining({
      cache: 'no-store',
      headers: { Authorization: 'Bearer old-access', 'Cache-Control': 'no-cache, no-store' },
    }),
  );
  expect(saved.has('lerona.cloud.credentials.v1')).toBe(false);
  expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
    'lerona.cloud.credentials.v1',
    JSON.stringify(rotated),
  );
});

test('an authentication response arriving after logout cannot restore the session', async () => {
  let respond: (response: unknown) => void = () => {};
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  globalThis.fetch = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          respond = resolve;
        }),
    )
    .mockResolvedValue({ ok: true, status: 204 });
  const cloud = new CloudClient();
  const signIn = cloud.signInPhone('+989121234567', 'private-password', async () => {});
  await cloud.signOut();
  respond({ ok: true, json: async () => rotated });
  await expect(signIn).rejects.toMatchObject({ status: 401 });
  expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
    'lerona.cloud.credentials.v1',
    expect.anything(),
  );
});

import { withRequestDeadline } from './request-deadline';
import { CloudClient } from './cloud-client';
import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const controllers = new Set<AbortController>();
const originalFetch = globalThis.fetch;
beforeEach(() => {
  jest.useFakeTimers();
  process.env.EXPO_PUBLIC_API_URL = 'https://phase-four.invalid';
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
    JSON.stringify({
      accessToken: 'synthetic',
      refreshToken: 'synthetic-refresh',
      accessExpiresAtUtc: '2099-01-01T00:00:00Z',
      phoneVerified: true,
    }),
  );
});
afterEach(() => {
  expect(controllers.size).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
  jest.restoreAllMocks();
  globalThis.fetch = originalFetch;
});
function response(body: () => Promise<unknown>, status = 200) {
  return { ok: status < 400, status, json: body, headers: new Headers() } as Response;
}
function run(init: RequestInit = {}) {
  return withRequestDeadline(
    'https://phase-four.invalid',
    init,
    (value) => value.json(),
    controllers,
  );
}

test.each(['headers', 'body'])(
  'a never completing %s phase is bounded even if transport ignores abort',
  async (phase) => {
    const body = deferred<unknown>();
    const headers = deferred<Response>();
    let signal: AbortSignal | undefined;
    globalThis.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return phase === 'headers' ? headers.promise : response(() => body.promise);
    });
    const request = run();
    const rejected = expect(request).rejects.toMatchObject({ code: 'request_timeout' });
    await jest.advanceTimersByTimeAsync(12_000);
    await rejected;
    expect(signal?.aborted).toBe(true);
    body.resolve({ late: true });
    headers.resolve(response(async () => ({ late: true })));
  },
);

test.each(['headers', 'body'])('delayed %s within the overall deadline succeeds', async (phase) => {
  globalThis.fetch = jest.fn(async () => {
    if (phase === 'headers') await new Promise((resolve) => setTimeout(resolve, 11_999));
    return response(async () => {
      if (phase === 'body') await new Promise((resolve) => setTimeout(resolve, 11_999));
      return { complete: true };
    });
  });
  const request = run();
  await jest.advanceTimersByTimeAsync(11_999);
  await expect(request).resolves.toEqual({ complete: true });
});

test('header time and body time share one budget', async () => {
  const body = deferred<unknown>();
  globalThis.fetch = jest.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, 7_000));
    return response(() => body.promise);
  });
  const result = expect(run()).rejects.toMatchObject({ code: 'request_timeout' });
  await jest.advanceTimersByTimeAsync(12_000);
  await result;
  body.resolve({ late: true });
});

test.each(['before headers', 'during body', 'already aborted'])(
  'caller cancellation %s cleans up both listeners',
  async (phase) => {
    const external = new AbortController();
    const add = jest.spyOn(external.signal, 'addEventListener');
    const remove = jest.spyOn(external.signal, 'removeEventListener');
    const body = deferred<unknown>();
    const headers = deferred<Response>();
    globalThis.fetch = jest.fn(async () =>
      phase === 'before headers' ? headers.promise : response(() => body.promise),
    );
    if (phase === 'already aborted') external.abort();
    const request = run({ signal: external.signal });
    const rejection = expect(request).rejects.toMatchObject({ code: 'request_cancelled' });
    await jest.advanceTimersByTimeAsync(0);
    external.abort();
    await rejection;
    expect(add).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    if (phase === 'already aborted') expect(fetch).not.toHaveBeenCalled();
    body.resolve({ late: true });
    headers.resolve(response(async () => ({})));
  },
);

test.each(['timeout first', 'cancel first'])(
  'concurrent timeout and cancellation retain first terminal cause (%s)',
  async (order) => {
    const external = new AbortController();
    globalThis.fetch = jest.fn(async () => response(() => new Promise(() => {})));
    if (order === 'cancel first') setTimeout(() => external.abort(), 12_000);
    const request = run({ signal: external.signal });
    if (order === 'timeout first') setTimeout(() => external.abort(), 12_000);
    const result = expect(request).rejects.toMatchObject({
      code: order === 'timeout first' ? 'request_timeout' : 'request_cancelled',
    });
    await jest.advanceTimersByTimeAsync(12_000);
    await result;
  },
);

test.each(['success', 'network failure', 'invalid JSON', 'interrupted body'])(
  'terminal %s releases the deadline and registry',
  async (terminal) => {
    const error =
      terminal === 'invalid JSON'
        ? new SyntaxError('Unexpected end of JSON input')
        : new TypeError('connection reset');
    globalThis.fetch = jest.fn(async () => {
      if (terminal === 'network failure') throw error;
      return response(async () => {
        if (terminal !== 'success') throw error;
        return {};
      });
    });
    if (terminal === 'success') await expect(run()).resolves.toEqual({});
    else await expect(run()).rejects.toBe(error);
  },
);

test('repeated requests release streams, timer handles and external listeners', async () => {
  const external = new AbortController();
  const remove = jest.spyOn(external.signal, 'removeEventListener');
  const cancel = jest.fn(async () => {});
  globalThis.fetch = jest.fn(
    async () =>
      ({ ...response(async () => ({})), body: { cancel }, bodyUsed: false }) as unknown as Response,
  );
  for (let i = 0; i < 50; i++) await run({ signal: external.signal });
  expect(cancel).toHaveBeenCalledTimes(50);
  expect(remove).toHaveBeenCalledTimes(50);
});

test.each([200, 400, 403, 409, 429, 503])(
  'CloudClient status %s cannot escape the body deadline',
  async (status) => {
    globalThis.fetch = jest.fn(async () => response(() => new Promise(() => {}), status));
    const request = new CloudClient().pull(0);
    const result = expect(request).rejects.toMatchObject({ status: 0, code: 'request_timeout' });
    await jest.advanceTimersByTimeAsync(12_000);
    await result;
  },
);

test('empty response completes without attempting JSON parsing', async () => {
  const json = jest.fn(async () => {
    throw new Error('empty body');
  });
  globalThis.fetch = jest.fn(async () => response(json, 204));
  // A successful authenticated endpoint using the shared helper.
  await expect(new CloudClient().pull(0)).resolves.toBeUndefined();
  expect(json).not.toHaveBeenCalled();
});

test.each([429, 503])('known Retry-After survives a stalled %s error body', async (status) => {
  globalThis.fetch = jest.fn(async () => ({
    ...response(() => new Promise(() => {}), status),
    headers: new Headers({ 'Retry-After': '120' }),
  }));
  const result = expect(new CloudClient().pull(0)).rejects.toMatchObject({
    status: 0,
    code: 'request_timeout',
    retryAfterMs: 120_000,
  });
  await jest.advanceTimersByTimeAsync(12_000);
  await result;
});

test('invalid success JSON remains a decoding failure; malformed error text preserves its HTTP status', async () => {
  globalThis.fetch = jest.fn(async () =>
    response(async () => {
      throw new SyntaxError('invalid');
    }),
  );
  await expect(new CloudClient().pull(0)).rejects.toBeInstanceOf(SyntaxError);
  globalThis.fetch = jest.fn(async () =>
    response(async () => {
      throw new SyntaxError('not JSON');
    }, 503),
  );
  await expect(new CloudClient().pull(0)).rejects.toMatchObject({ status: 503 });
});

test('large valid body can finish immediately before the existing deadline', async () => {
  const data = 'x'.repeat(1_493_000);
  globalThis.fetch = jest.fn(async () =>
    response(async () => {
      await new Promise((resolve) => setTimeout(resolve, 11_999));
      return { data };
    }),
  );
  const request = run();
  await jest.advanceTimersByTimeAsync(11_999);
  await expect(request).resolves.toEqual({ data });
});

test('account invalidation cancels a stalled registered body and prevents late publication', async () => {
  const body = deferred<unknown>();
  globalThis.fetch = jest.fn(async () => response(() => body.promise));
  const cloud = new CloudClient();
  const request = cloud.pull(0);
  const result = expect(request).rejects.toMatchObject({ code: 'request_cancelled' });
  await jest.advanceTimersByTimeAsync(0);
  cloud.cancelRequests();
  await result;
  body.resolve({ cursor: 999 });
});

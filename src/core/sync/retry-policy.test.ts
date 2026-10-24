import { retryAfterDelay, retryDelay } from './retry-policy';

test('Retry-After supports seconds and HTTP dates, bounds long waits and rejects invalid headers', () => {
  const now = Date.parse('2026-10-24T12:00:00Z');
  expect(retryAfterDelay('120', now)).toBe(120_000);
  expect(retryAfterDelay('Sat, 24 Oct 2026 12:01:00 GMT', now)).toBe(60_000);
  expect(retryAfterDelay('Sat, 24 Oct 2026 11:00:00 GMT', now)).toBe(0);
  expect(retryAfterDelay('999999999', now)).toBe(86_400_000);
  expect(retryAfterDelay('invalid', now)).toBeUndefined();
  expect(retryAfterDelay(null, now)).toBeUndefined();
});

test('exponential retries add jitter, stay bounded and never undercut server cooldown', () => {
  expect(retryDelay(1, 0, () => 0)).toBe(500);
  expect(retryDelay(1, 0, () => 1)).toBe(1500);
  expect(retryDelay(3, 0, () => 0.5)).toBe(4000);
  expect(retryDelay(100, 0, () => 1)).toBe(60_000);
  expect(retryDelay(1, 120_000, () => 0)).toBe(120_000);
  expect(retryDelay(1, 120_000, () => 1)).toBe(150_000);
});

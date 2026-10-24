import { RequestCache } from './request-cache';

test('concurrent consumers share one request, but uncached permissions are fetched again', async () => {
  const cache = new RequestCache();
  const load = jest.fn(async () => ({ active: true }));
  const first = cache.get('permissions', load);
  expect(cache.get('permissions', load)).toBe(first);
  await expect(first).resolves.toEqual({ active: true });
  await cache.get('permissions', load);
  expect(load).toHaveBeenCalledTimes(2);
});

test('metadata TTL expires exactly and an explicit refresh bypasses it', async () => {
  let now = 0;
  const cache = new RequestCache(() => now);
  const load = jest.fn(async () => 'metadata');
  await cache.get('backup', load, 15_000);
  now = 14_999;
  await cache.get('backup', load, 15_000);
  expect(load).toHaveBeenCalledTimes(1);
  now++;
  await cache.get('backup', load, 15_000);
  await cache.get('backup', load, 15_000, true);
  expect(load).toHaveBeenCalledTimes(3);
});

test.each(['clear', 'delete'] as const)(
  '%s prevents an old response from warming a new session cache',
  async (invalidate) => {
    const cache = new RequestCache();
    let finish!: (value: string) => void;
    const old = cache.get(
      'backup',
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
      15_000,
    );
    await Promise.resolve();
    if (invalidate === 'clear') cache.clear();
    else cache.delete('backup');
    const load = jest.fn(async () => 'new account');
    await cache.get('backup', load, 15_000);
    finish('old account');
    await old;
    await expect(cache.get('backup', load, 15_000)).resolves.toBe('new account');
    expect(load).toHaveBeenCalledTimes(1);
  },
);

test('failures are never cached', async () => {
  const cache = new RequestCache();
  const load = jest
    .fn<Promise<string>, []>()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue('online');
  await expect(cache.get('backup', load, 15_000)).rejects.toThrow('offline');
  await expect(cache.get('backup', load, 15_000)).resolves.toBe('online');
  expect(load).toHaveBeenCalledTimes(2);
});

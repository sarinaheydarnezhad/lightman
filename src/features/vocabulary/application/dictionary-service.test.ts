import { createInMemoryDictionaryCache } from '../data/in-memory-dictionary-cache';
import type { DictionaryProvider } from '../domain/dictionary-provider';
import type { NormalizedDictionarySuggestion } from '../domain/dictionary';
import { DictionaryProviderError } from '../domain/dictionary-provider';
import { createDictionaryService, normalizeLookupWord } from './dictionary-service';

const suggestion: NormalizedDictionarySuggestion = {
  word: 'Hello',
  meanings: [{ definition: 'A greeting.', examples: [] }],
};
let timestamp: number;
const clock = { now: () => new Date(timestamp), timeZone: () => 'UTC' };
function setup() {
  timestamp = 1_000_000;
  const provider: DictionaryProvider = {
    supports: (language) => language.toLowerCase().startsWith('en'),
    lookup: jest.fn(async () => suggestion),
  };
  return {
    provider,
    service: createDictionaryService(provider, createInMemoryDictionaryCache(2), clock),
  };
}

test('normalizes only the query; case/whitespace variants use one cached entry', async () => {
  const { provider, service } = setup();
  expect(normalizeLookupWord('  take-off   phrase  ')).toBe('take-off phrase');
  expect(await service.lookup('  Hello  ', 'en')).toMatchObject({ status: 'found' });
  expect(await service.lookup('hELLO', 'en')).toMatchObject({ status: 'found' });
  expect(provider.lookup).toHaveBeenCalledTimes(1);
  expect(provider.lookup).toHaveBeenCalledWith('Hello', 'en');
  expect(await service.lookup('hello', 'fa')).toEqual({ status: 'unsupported' });
  expect(provider.lookup).toHaveBeenCalledTimes(1);
  await service.lookup('hello', 'en-GB');
  expect(provider.lookup).toHaveBeenCalledTimes(2);
});

test('expired entries refetch; LRU evicts oldest while retaining recently read key', async () => {
  const { provider, service } = setup();
  await service.lookup('one', 'en');
  await service.lookup('two', 'en');
  await service.lookup('ONE', 'en');
  await service.lookup('three', 'en');
  await service.lookup('two', 'en');
  expect(provider.lookup).toHaveBeenCalledTimes(4);
  timestamp += 60 * 60 * 1000 + 1;
  await service.lookup('one', 'en');
  expect(provider.lookup).toHaveBeenCalledTimes(5);
});

test('not-found results are cached briefly; transient errors have a short cooldown and one forced retry', async () => {
  const { provider, service } = setup();
  jest.mocked(provider.lookup).mockRejectedValueOnce(new DictionaryProviderError('not-found'));
  expect(await service.lookup('unknown', 'en')).toEqual({ status: 'not-found' });
  expect(await service.lookup('UNKNOWN', 'en')).toEqual({ status: 'not-found' });
  expect(provider.lookup).toHaveBeenCalledTimes(1);
  timestamp += 5 * 60 * 1000 + 1;
  jest.mocked(provider.lookup).mockRejectedValueOnce(new DictionaryProviderError('offline'));
  expect(await service.lookup('unknown', 'en')).toEqual({ status: 'offline' });
  expect(await service.lookup('unknown', 'en')).toEqual({ status: 'offline' });
  expect(provider.lookup).toHaveBeenCalledTimes(2);
  expect(await service.lookup('unknown', 'en', true)).toMatchObject({ status: 'found' });
});

test('cached results remain available when the provider later goes offline', async () => {
  const { provider, service } = setup();
  expect(await service.lookup('hello', 'en')).toMatchObject({ status: 'found' });
  jest.mocked(provider.lookup).mockRejectedValue(new DictionaryProviderError('offline'));
  expect(await service.lookup('HELLO', 'en')).toMatchObject({ status: 'found' });
  expect(provider.lookup).toHaveBeenCalledTimes(1);
});

test('simultaneous requests share one provider request, and invalid input never contacts it', async () => {
  const { provider, service } = setup();
  let release: (value: NormalizedDictionarySuggestion) => void = () => {};
  jest.mocked(provider.lookup).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const one = service.lookup(' Hello ', 'en');
  const two = service.lookup('HELLO', 'en');
  expect(one).toBe(two);
  await Promise.resolve();
  expect(provider.lookup).toHaveBeenCalledTimes(1);
  release(suggestion);
  expect(await one).toMatchObject({ status: 'found' });
  expect(await service.lookup(' ', 'en')).toEqual({ status: 'invalid' });
  expect(await service.lookup('x'.repeat(121), 'en')).toEqual({ status: 'invalid' });
});

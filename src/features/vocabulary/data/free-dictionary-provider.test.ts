import { createFreeDictionaryProvider } from './free-dictionary-provider';
import type { DictionaryHttpClient, DictionaryHttpResponse } from '../domain/dictionary-provider';

const definition = { definition: 'A friendly greeting.', example: 'Hello, friend.' };
const entry = {
  word: 'hello',
  phonetics: [{ text: '/həˈloʊ/' }],
  meanings: [
    {
      partOfSpeech: 'noun',
      definitions: [
        definition,
        { definition: 'An utterance.', examples: ['Hello!', 'Hello again.'] },
      ],
    },
    { partOfSpeech: 'verb', definitions: [{ definition: 'To greet.' }] },
  ],
};

function response(status: number, body: unknown): DictionaryHttpResponse {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
  };
}

function setup(reply = response(200, [entry])) {
  const http: DictionaryHttpClient = { get: jest.fn(async () => reply) };
  return {
    provider: createFreeDictionaryProvider(
      { dictionaryApiBaseUrl: 'https://example.test/api/v2' },
      http,
    ),
    http,
  };
}

test('requests only the documented English v2 endpoint, encoding punctuation and spaces', async () => {
  const { provider, http } = setup();
  expect(provider.supports('en-US')).toBe(true);
  expect(provider.supports('fa-IR')).toBe(false);
  expect(await provider.lookup('take-off phrase', 'en-GB')).toEqual({
    word: 'hello',
    phonetic: '/həˈloʊ/',
    meanings: [
      { definition: 'A friendly greeting.', partOfSpeech: 'noun', examples: ['Hello, friend.'] },
      { definition: 'An utterance.', partOfSpeech: 'noun', examples: ['Hello!', 'Hello again.'] },
      { definition: 'To greet.', partOfSpeech: 'verb', examples: [] },
    ],
  });
  expect(http.get).toHaveBeenCalledWith(
    'https://example.test/api/v2/entries/en/take-off%20phrase',
    expect.any(Object),
  );
  await expect(provider.lookup('hello', 'fa')).rejects.toMatchObject({ reason: 'unavailable' });
  expect(http.get).toHaveBeenCalledTimes(1);
});

test('missing phonetics/examples and empty definitions do not fabricate content', async () => {
  const { provider } = setup(
    response(200, [{ meanings: [{ definitions: [{ definition: 'Meaning' }] }] }]),
  );
  expect(await provider.lookup('term', 'en')).toEqual({
    word: 'term',
    meanings: [{ definition: 'Meaning', examples: [] }],
  });
  const empty = setup(response(200, [{ meanings: [{ definitions: [] }] }]));
  expect(await empty.provider.lookup('term', 'en')).toBeNull();
});

test.each([404, 400, 429, 500])(
  'classifies HTTP %s without exposing response body',
  async (status) => {
    const { provider } = setup(response(status, { message: 'private server response' }));
    await expect(provider.lookup('word', 'en')).rejects.toMatchObject({
      reason: status === 404 ? 'not-found' : status === 429 ? 'rate-limited' : 'unavailable',
    });
  },
);

test('rejects malformed JSON and unexpected schema; an empty list is not found', async () => {
  const { provider } = setup({ ...response(200, []), text: async () => '{bad' });
  await expect(provider.lookup('word', 'en')).rejects.toMatchObject({ reason: 'unavailable' });
  for (const body of [{ unexpected: true }, [{ meanings: 'not an array' }]]) {
    const broken = setup(response(200, body));
    await expect(broken.provider.lookup('word', 'en')).rejects.toMatchObject({
      reason: 'unavailable',
    });
  }
  expect(await setup(response(200, [])).provider.lookup('word', 'en')).toBeNull();
});

test('network failures appear as offline and do not leak native errors', async () => {
  const http: DictionaryHttpClient = {
    get: jest.fn(async () => {
      throw new TypeError('secret DNS details');
    }),
  };
  const provider = createFreeDictionaryProvider(
    { dictionaryApiBaseUrl: 'https://example.test' },
    http,
  );
  await expect(provider.lookup('word', 'en')).rejects.toMatchObject({ reason: 'offline' });
});

test('timeout is bounded even if transport ignores abort', async () => {
  jest.useFakeTimers();
  try {
    let signal: AbortSignal | undefined;
    const http: DictionaryHttpClient = {
      get: jest.fn((_url, activeSignal) => {
        signal = activeSignal;
        return new Promise<DictionaryHttpResponse>(() => {});
      }),
    };
    const provider = createFreeDictionaryProvider(
      { dictionaryApiBaseUrl: 'https://example.test' },
      http,
      50,
    );
    const expectation = expect(provider.lookup('word', 'en')).rejects.toMatchObject({
      reason: 'timeout',
    });
    await jest.advanceTimersByTimeAsync(50);
    await expectation;
    expect(signal?.aborted).toBe(true);
  } finally {
    jest.useRealTimers();
  }
});

test('oversized provider bodies are rejected before parsing', async () => {
  const readBody = jest.fn();
  const http: DictionaryHttpClient = {
    get: jest.fn(async () => ({
      ...response(200, [entry]),
      headers: { get: () => '300000' },
      text: readBody,
    })),
  };
  const provider = createFreeDictionaryProvider(
    { dictionaryApiBaseUrl: 'https://example.test' },
    http,
  );
  await expect(provider.lookup('hello', 'en')).rejects.toMatchObject({ reason: 'unavailable' });
  expect(readBody).not.toHaveBeenCalled();
});

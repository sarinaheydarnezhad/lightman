import { MAX_CARD_TEXT_LENGTH } from '@/core/constants';
import type { AppConfig } from '@/core/ports/platform';
import type { NormalizedDictionarySuggestion, DictionaryMeaning } from '../domain/dictionary';
import {
  DictionaryProviderError,
  type DictionaryHttpClient,
  type DictionaryProvider,
} from '../domain/dictionary-provider';

const MAX_BODY_LENGTH = 256_000;
const REQUEST_TIMEOUT_MS = 6_000;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, limit: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= limit ? trimmed : undefined;
}

function phonetic(entries: readonly unknown[]): string | undefined {
  const direct: string[] = [];
  const nested: string[] = [];
  for (const value of entries) {
    const entry = record(value);
    if (!entry) continue;
    const candidate = text(entry.phonetic, 500);
    if (candidate) direct.push(candidate);
    if (Array.isArray(entry.phonetics)) {
      for (const item of entry.phonetics.slice(0, 30)) {
        const part = record(item);
        const transcribed = part && text(part.text, 500);
        if (transcribed) nested.push(transcribed);
      }
    }
  }
  // Top-level phonetic first; stable selection within a tier independent of provider ordering.
  return (direct.length ? direct : nested).sort((a, b) => a.localeCompare(b, 'en'))[0];
}

export function normalizeFreeDictionaryResponse(
  payload: unknown,
  searchedWord: string,
): NormalizedDictionarySuggestion | null {
  if (!Array.isArray(payload)) throw new DictionaryProviderError('unavailable');
  if (!payload.length) return null;
  const meanings: DictionaryMeaning[] = [];
  for (const raw of payload.slice(0, 8)) {
    const entry = record(raw);
    if (!entry || !Array.isArray(entry.meanings)) throw new DictionaryProviderError('unavailable');
    for (const rawMeaning of entry.meanings.slice(0, 30)) {
      const meaning = record(rawMeaning);
      if (!meaning || !Array.isArray(meaning.definitions))
        throw new DictionaryProviderError('unavailable');
      const partOfSpeech = text(meaning.partOfSpeech, 120);
      for (const rawDefinition of meaning.definitions.slice(0, 100)) {
        const definition = record(rawDefinition);
        if (!definition) continue;
        const description = text(definition.definition, MAX_CARD_TEXT_LENGTH);
        if (!description) continue;
        const samples = [
          ...(typeof definition.example === 'string' ? [definition.example] : []),
          ...(Array.isArray(definition.examples) ? definition.examples.slice(0, 20) : []),
        ];
        const examples = samples
          .map((sample) => text(sample, MAX_CARD_TEXT_LENGTH))
          .filter((sample): sample is string => !!sample)
          .slice(0, 20);
        meanings.push({
          definition: description,
          ...(partOfSpeech ? { partOfSpeech } : {}),
          examples,
        });
        if (meanings.length === 60) break;
      }
      if (meanings.length === 60) break;
    }
    if (meanings.length === 60) break;
  }
  if (!meanings.length) return null;
  const transcription = phonetic(payload.slice(0, 8));
  return {
    word: text(record(payload[0])?.word, 120) ?? searchedWord,
    ...(transcription ? { phonetic: transcription } : {}),
    meanings,
  };
}

/** The published v2 route is English-only; never substitute English for a different deck. */
export function createFreeDictionaryProvider(
  config: Pick<AppConfig, 'dictionaryApiBaseUrl'>,
  http: DictionaryHttpClient,
  timeoutMs = REQUEST_TIMEOUT_MS,
): DictionaryProvider {
  const supports = (language: string) => language.toLowerCase().split('-')[0] === 'en';
  return {
    supports,
    async lookup(word, language) {
      if (!supports(language)) throw new DictionaryProviderError('unavailable');
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
          reject(new DictionaryProviderError('timeout'));
        }, timeoutMs);
      });
      try {
        const url = `${config.dictionaryApiBaseUrl}/entries/en/${encodeURIComponent(word)}`;
        const response = await Promise.race([http.get(url, controller.signal), timeout]);
        if (response.status === 404) throw new DictionaryProviderError('not-found');
        if (response.status === 429) throw new DictionaryProviderError('rate-limited');
        if (!response.ok) throw new DictionaryProviderError('unavailable');
        if (Number(response.headers.get('content-length')) > MAX_BODY_LENGTH)
          throw new DictionaryProviderError('unavailable');
        const body = await Promise.race([response.text(), timeout]);
        if (body.length > MAX_BODY_LENGTH) throw new DictionaryProviderError('unavailable');
        let parsed: unknown;
        try {
          parsed = JSON.parse(body);
        } catch {
          throw new DictionaryProviderError('unavailable');
        }
        return normalizeFreeDictionaryResponse(parsed, word);
      } catch (error) {
        if (timedOut) throw new DictionaryProviderError('timeout');
        if (error instanceof DictionaryProviderError) throw error;
        // Native and browser fetch failures are usually connection/DNS failures.
        if (error instanceof TypeError) throw new DictionaryProviderError('offline');
        throw new DictionaryProviderError('unavailable');
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}

export const dictionaryHttpClient: DictionaryHttpClient = {
  get: (url, signal) =>
    fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal,
    }),
};

import { MAX_CARD_TEXT_LENGTH } from '@/core/constants';
import type {
  AvailableSpeechVoice,
  SpeechRequest,
  SpeechService,
  SpeechStatus,
} from '@/core/ports/speech';
import type { SpeechAdapter } from './expo-speech-adapter';
import { resolveSpeechLanguage, resolveVoice, type DeviceVoice } from './voice-selection';

function bounded(value: number | undefined, minimum: number, maximum: number, fallback: number) {
  return value !== undefined && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

/** The queue serializes native stop/start; a generation token discards stale rapid taps/callbacks. */
export function createSpeechService(
  adapter: SpeechAdapter,
  reportUnavailable: () => void = () => {},
): SpeechService {
  let status: SpeechStatus = 'idle';
  let generation = 0;
  let active = false;
  let cachedVoices: readonly DeviceVoice[] | null = null;
  let pendingVoices: Promise<readonly DeviceVoice[]> | null = null;
  let operations: Promise<void> = Promise.resolve();
  let reported = false;
  const listeners = new Set<() => void>();

  function setStatus(next: SpeechStatus) {
    if (status === next) return;
    status = next;
    listeners.forEach((listener) => listener());
  }

  function unavailable() {
    setStatus('unavailable');
    if (reported) return;
    reported = true;
    try {
      reportUnavailable();
    } catch {
      // Optional diagnostics cannot interrupt study.
    }
  }

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = operations.then(operation, operation);
    operations = result.then(
      () => {},
      () => {},
    );
    return result;
  }

  async function voices(): Promise<readonly DeviceVoice[]> {
    if (cachedVoices) return cachedVoices;
    if (!pendingVoices) {
      pendingVoices = adapter
        .getVoices()
        .then((available) => {
          // Retry an empty result later; engines can finish initializing after a first query.
          if (available.length) cachedVoices = available;
          return available;
        })
        .catch(() => {
          unavailable();
          return [];
        })
        .finally(() => {
          pendingVoices = null;
        });
    }
    return pendingVoices;
  }

  async function stopActive() {
    if (!active) return;
    setStatus('stopping');
    try {
      await adapter.stop();
      active = false;
      setStatus('idle');
    } catch {
      unavailable();
      // Leave active set: never start an overlapping utterance after a failed stop.
    }
  }

  return {
    speak(text, options: SpeechRequest = {}) {
      const request = ++generation;
      return enqueue(async () => {
        if (request !== generation) return false;
        const term = text.trim();
        const maxLength = Number.isFinite(adapter.maxInputLength)
          ? Math.min(MAX_CARD_TEXT_LENGTH, adapter.maxInputLength)
          : MAX_CARD_TEXT_LENGTH;
        if (!term || term.length > maxLength) {
          setStatus('unavailable');
          return false;
        }
        await stopActive();
        if (active || request !== generation) return false;
        const available = await voices();
        if (request !== generation) return false;
        const language = resolveSpeechLanguage(term, options);
        const voice = resolveVoice(available, language, options.accent);
        if (!voice) {
          setStatus('unavailable');
          return false;
        }
        active = true;
        setStatus('speaking');
        try {
          adapter.speak(term, {
            language: voice.language,
            voiceId: voice.id,
            rate: bounded(options.rate, 0.1, 2, 0.95),
            pitch: bounded(options.pitch, 0.5, 2, 1),
            volume: bounded(options.volume, 0, 1, 1),
            onStart: () => {
              if (request === generation) setStatus('speaking');
            },
            onDone: () => {
              if (request !== generation) return;
              active = false;
              setStatus('idle');
            },
            onStopped: () => {
              if (request !== generation) return;
              active = false;
              setStatus('idle');
            },
            onError: () => {
              if (request !== generation) return;
              active = false;
              unavailable();
            },
          });
          return true;
        } catch {
          active = false;
          unavailable();
          return false;
        }
      });
    },
    stop() {
      ++generation;
      return enqueue(async () => {
        await stopActive();
      });
    },
    isSpeaking: () => status === 'speaking',
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async getAvailableVoices(): Promise<readonly AvailableSpeechVoice[]> {
      return (await voices()).map(({ name, language, quality }) => ({ name, language, quality }));
    },
  };
}

import type { AvailableSpeechVoice, SpeechService, SpeechStatus } from '@/core/ports/speech';

/** Minimal platform-free service double with observable state for component tests. */
export function createFakeSpeechService(): SpeechService & {
  setStatus(value: SpeechStatus): void;
} {
  let status: SpeechStatus = 'idle';
  const listeners = new Set<() => void>();
  const setStatus = (value: SpeechStatus) => {
    status = value;
    listeners.forEach((listener) => listener());
  };
  return {
    setStatus,
    speak: jest.fn(async () => {
      setStatus('speaking');
      return true;
    }),
    stop: jest.fn(async () => {
      setStatus('idle');
    }),
    isSpeaking: () => status === 'speaking',
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getAvailableVoices: jest.fn(async (): Promise<readonly AvailableSpeechVoice[]> => []),
  };
}

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { application } from '@/core/composition/application';
import { haptics } from '@/core/composition/haptics';
import { speech } from '@/core/composition/speech';

/** Shared by study and card details. A second press stops; a later press starts again. */
export function usePronunciation(text: string, language: string) {
  const status = useSyncExternalStore(speech.subscribe, speech.getStatus, speech.getStatus);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  useEffect(() => {
    const pendingRequest = request;
    return () => {
      ++pendingRequest.current;
      void speech.stop();
    };
  }, [text, language]);

  const press = useCallback(async () => {
    const current = ++request.current;
    void haptics.selection();
    setError(null);
    if (speech.isSpeaking()) {
      await speech.stop();
      return;
    }
    try {
      const settings = await application.getSettings();
      if (current !== request.current) return;
      const started = await speech.speak(text, {
        language,
        preferredLanguage: settings?.preferredSpeechLanguage,
        accent: settings?.preferredSpeechAccent,
      });
      if (current === request.current && !started)
        setError('Pronunciation is unavailable on this device.');
    } catch {
      if (current === request.current) setError('Pronunciation is unavailable on this device.');
    }
  }, [text, language]);

  return { status, error, press };
}

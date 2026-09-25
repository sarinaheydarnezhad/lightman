import type { EnglishAccent, SpeechRequest } from '@/core/ports/speech';

export interface DeviceVoice {
  readonly id: string;
  readonly name: string;
  readonly language: string;
  readonly quality: 'enhanced' | 'default';
  readonly isDefault: boolean;
}

/** Explicit deck language outranks the user's fallback; script detection is deliberately narrow. */
export function resolveSpeechLanguage(text: string, options: SpeechRequest): string | undefined {
  if (options.language?.trim()) return options.language.trim();
  if (options.preferredLanguage?.trim()) return options.preferredLanguage.trim();
  if (/[\u067e\u0686\u0698\u06af\u06a9\u06cc]/u.test(text)) return 'fa';
  if (/[\u0600-\u06ff]/u.test(text)) return 'ar';
  return undefined;
}

/** No device-specific IDs are persisted or selected by array position. */
export function resolveVoice(
  voices: readonly DeviceVoice[],
  language: string | undefined,
  accent: EnglishAccent | null | undefined,
): DeviceVoice | null {
  const requested = language?.toLowerCase().replaceAll('_', '-');
  const base = requested?.split('-')[0];
  const candidates = base
    ? voices.filter(
        (voice) => voice.language.toLowerCase().replaceAll('_', '-').split('-')[0] === base,
      )
    : [...voices];
  if (!candidates.length) return null;
  const preferredAccent = base === 'en' && accent ? (accent === 'uk' ? 'en-gb' : 'en-us') : null;
  return (
    [...candidates].sort((a, b) => {
      const rank = (voice: DeviceVoice) => {
        const tag = voice.language.toLowerCase().replaceAll('_', '-');
        if (!requested) return voice.isDefault ? 0 : 1;
        if (requested?.includes('-') && tag === requested) return 0;
        if (preferredAccent && tag === preferredAccent) return 1;
        if (requested && tag === requested) return 2;
        return 3;
      };
      return (
        rank(a) - rank(b) ||
        Number(b.quality === 'enhanced') - Number(a.quality === 'enhanced') ||
        Number(b.isDefault) - Number(a.isDefault) ||
        a.name.localeCompare(b.name, 'en') ||
        a.id.localeCompare(b.id, 'en')
      );
    })[0] ?? null
  );
}

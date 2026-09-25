import { resolveSpeechLanguage, resolveVoice, type DeviceVoice } from './voice-selection';

const voices: DeviceVoice[] = [
  { id: 'persian', name: 'Persian', language: 'fa-IR', quality: 'default', isDefault: false },
  { id: 'us', name: 'US Voice', language: 'en-US', quality: 'default', isDefault: false },
  { id: 'uk', name: 'UK Voice', language: 'en-GB', quality: 'enhanced', isDefault: false },
  { id: 'arabic', name: 'Arabic', language: 'ar-SA', quality: 'default', isDefault: false },
];

test('deck language outranks speech fallback and narrow script detection', () => {
  expect(resolveSpeechLanguage('bonjour', { language: 'fr', preferredLanguage: 'en' })).toBe('fr');
  expect(resolveSpeechLanguage('سلام', { preferredLanguage: 'en' })).toBe('en');
  expect(resolveSpeechLanguage('کتاب', {})).toBe('fa');
  expect(resolveSpeechLanguage('مرحبا', {})).toBe('ar');
  expect(resolveSpeechLanguage('bonjour', {})).toBeUndefined();
});

test('UK/US preferences choose available English voices without crossing languages', () => {
  expect(resolveVoice([...voices].reverse(), 'en', 'uk')?.id).toBe('uk');
  expect(resolveVoice(voices, 'en', 'us')?.id).toBe('us');
  expect(resolveVoice(voices, 'fa', 'uk')?.id).toBe('persian');
  expect(resolveVoice(voices, 'ar', 'us')?.id).toBe('arabic');
  expect(resolveVoice(voices, 'es', null)).toBeNull();
  expect(resolveVoice(voices, 'en-GB', 'us')?.id).toBe('uk');
  expect(
    resolveVoice(
      voices.filter((voice) => voice.id !== 'uk'),
      'en',
      'uk',
    )?.id,
  ).toBe('us');
});

test('tie breaks by quality, default, name and ID rather than device enumeration order', () => {
  const candidates: DeviceVoice[] = [
    { id: 'z', name: 'Alex', language: 'en-US', quality: 'default', isDefault: true },
    { id: 'c', name: 'Zoe', language: 'en-US', quality: 'enhanced', isDefault: false },
    { id: 'b', name: 'Alex', language: 'en-US', quality: 'enhanced', isDefault: false },
    { id: 'a', name: 'Alex', language: 'en-US', quality: 'enhanced', isDefault: false },
  ];
  expect(resolveVoice(candidates, 'en', 'us')?.id).toBe('a');
  expect(resolveVoice([...candidates].reverse(), 'en', 'us')?.id).toBe('a');
  expect(resolveVoice(candidates, undefined, null)?.id).toBe('z');
});

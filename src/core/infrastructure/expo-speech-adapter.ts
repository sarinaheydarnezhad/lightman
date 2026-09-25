import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

import type { DeviceVoice } from './voice-selection';

export interface SpeechAdapter {
  readonly maxInputLength: number;
  getVoices(): Promise<readonly DeviceVoice[]>;
  speak(
    text: string,
    options: {
      language?: string;
      voiceId?: string;
      rate: number;
      pitch: number;
      volume: number;
      onStart(): void;
      onDone(): void;
      onStopped(): void;
      onError(): void;
    },
  ): void;
  stop(): Promise<void>;
}

export const expoSpeechAdapter: SpeechAdapter = {
  maxInputLength: Speech.maxSpeechInputLength,
  async getVoices() {
    const voices = await Speech.getAvailableVoicesAsync();
    // Browser voices can be remote. Offer web speech only for voices known to be local.
    return voices
      .filter(
        (voice) =>
          Platform.OS !== 'web' || ('localService' in voice && voice.localService === true),
      )
      .map((voice) => ({
        id: voice.identifier,
        name: voice.name,
        language: voice.language.replaceAll('_', '-'),
        quality: voice.quality === Speech.VoiceQuality.Enhanced ? 'enhanced' : 'default',
        isDefault: 'isDefault' in voice && voice.isDefault === true,
      }));
  },
  speak(text, options) {
    Speech.speak(text, {
      language: options.language,
      voice: options.voiceId,
      rate: options.rate,
      pitch: options.pitch,
      volume: options.volume,
      onStart: options.onStart,
      onDone: options.onDone,
      onStopped: options.onStopped,
      onError: options.onError,
    });
  },
  stop: () => Speech.stop(),
};

import * as ExpoSpeech from 'expo-speech';
import { Platform } from 'react-native';

import { expoSpeechAdapter } from './expo-speech-adapter';

jest.mock('expo-speech', () => ({
  maxSpeechInputLength: 4000,
  VoiceQuality: { Enhanced: 'Enhanced', Default: 'Default' },
  getAvailableVoicesAsync: jest.fn(),
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
}));

const deviceVoices = [
  {
    identifier: 'local',
    name: 'Local English',
    language: 'en-US',
    quality: ExpoSpeech.VoiceQuality.Enhanced,
    isDefault: true,
    localService: true,
  },
  {
    identifier: 'remote',
    name: 'Remote English',
    language: 'en-GB',
    quality: ExpoSpeech.VoiceQuality.Default,
    isDefault: false,
    localService: false,
  },
];

test('web exposes only local browser voices without leaking native IDs into UI', async () => {
  const restore = jest.replaceProperty(Platform, 'OS', 'web');
  jest.mocked(ExpoSpeech.getAvailableVoicesAsync).mockResolvedValue(deviceVoices);
  try {
    expect(await expoSpeechAdapter.getVoices()).toEqual([
      {
        id: 'local',
        name: 'Local English',
        language: 'en-US',
        quality: 'enhanced',
        isDefault: true,
      },
    ]);
  } finally {
    restore.restore();
  }
});

test('native voice inventory is normalized, and adapter forwards lifecycle/stop', async () => {
  const restore = jest.replaceProperty(Platform, 'OS', 'android');
  jest.mocked(ExpoSpeech.getAvailableVoicesAsync).mockResolvedValue(deviceVoices);
  try {
    expect(await expoSpeechAdapter.getVoices()).toHaveLength(2);
    const onDone = jest.fn();
    expoSpeechAdapter.speak('term', {
      language: 'en-US',
      voiceId: 'local',
      rate: 0.95,
      pitch: 1,
      volume: 1,
      onStart: jest.fn(),
      onStopped: jest.fn(),
      onDone,
      onError: jest.fn(),
    });
    expect(ExpoSpeech.speak).toHaveBeenCalledWith(
      'term',
      expect.objectContaining({ language: 'en-US', voice: 'local', onDone }),
    );
    await expoSpeechAdapter.stop();
    expect(ExpoSpeech.stop).toHaveBeenCalled();
  } finally {
    restore.restore();
  }
});

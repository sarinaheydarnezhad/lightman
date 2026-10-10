import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { performExpoHaptic } from './expo-haptic-feedback';
import { createHapticFeedbackService } from './haptic-feedback';

jest.mock('expo-haptics', () => ({
  ...jest.requireActual<typeof import('expo-haptics')>('expo-haptics'),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  performAndroidHapticsAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

test('a correct answer uses one light impact on iOS', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  await performExpoHaptic('answerSuccess');
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  expect(Haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
});

test('a correct answer uses a native Android tick without forcing a vibration fallback', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  await performExpoHaptic('answerSuccess');
  expect(Haptics.performAndroidHapticsAsync).toHaveBeenCalledTimes(1);
  expect(Haptics.performAndroidHapticsAsync).toHaveBeenCalledWith(
    Haptics.AndroidHaptics.Segment_Tick,
  );
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  expect(Haptics.selectionAsync).not.toHaveBeenCalled();
});

test('unavailable native correct-answer feedback is optional and never falls back to vibration', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.mocked(Haptics.performAndroidHapticsAsync).mockRejectedValueOnce(new Error('unavailable'));
  const feedback = createHapticFeedbackService(async () => true, performExpoHaptic);
  await expect(feedback.answerSuccess()).resolves.toBeUndefined();
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
});

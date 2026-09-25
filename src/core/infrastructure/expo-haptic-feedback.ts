import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import type { HapticEvent } from '@/core/ports/haptic-feedback';

/** Android uses the device haptics engine; no custom vibration permission is needed. */
export function performExpoHaptic(event: HapticEvent): Promise<void> {
  if (Platform.OS === 'android') {
    const effects: Record<HapticEvent, Haptics.AndroidHaptics> = {
      selection: Haptics.AndroidHaptics.Segment_Tick,
      cardReveal: Haptics.AndroidHaptics.Segment_Frequent_Tick,
      answerSuccess: Haptics.AndroidHaptics.Confirm,
      answerFailure: Haptics.AndroidHaptics.Segment_Tick,
      swipeCommit: Haptics.AndroidHaptics.Segment_Frequent_Tick,
      actionConfirmed: Haptics.AndroidHaptics.Confirm,
      actionRejected: Haptics.AndroidHaptics.Reject,
    };
    return Haptics.performAndroidHapticsAsync(effects[event]);
  }
  switch (event) {
    case 'selection':
    case 'swipeCommit':
      return Haptics.selectionAsync();
    case 'cardReveal':
    case 'answerFailure':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    case 'answerSuccess':
    case 'actionConfirmed':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case 'actionRejected':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
}

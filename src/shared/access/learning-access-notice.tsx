import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { learningAccess } from '@/core/composition/learning-access';

export function LearningAccessNotice() {
  const access = learningAccess();
  useEffect(() => {
    if (!access.isAccount) return;
    const refresh = () => {
      void access.refresh().catch(() => {});
    };
    refresh();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refresh();
    }, 60_000);
    const foreground = AppState.addEventListener('change', (phase) => {
      if (phase === 'active') refresh();
    });
    const network = Network.addNetworkStateListener(() => refresh());
    return () => {
      clearInterval(timer);
      foreground.remove();
      network.remove();
    };
  }, [access]);
  return null;
}

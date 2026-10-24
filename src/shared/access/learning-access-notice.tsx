import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { learningAccess } from '@/core/composition/learning-access';

export function LearningAccessNotice() {
  const access = learningAccess();
  useEffect(() => {
    if (!access.isAccount) return;
    let disposed = false;
    let online = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (
        disposed ||
        !online ||
        AppState.currentState === 'background' ||
        AppState.currentState === 'inactive'
      )
        return;
      void access.refreshIfStale().catch(() => {});
    };
    const schedule = () => {
      if (
        disposed ||
        !online ||
        timer !== undefined ||
        AppState.currentState === 'background' ||
        AppState.currentState === 'inactive'
      )
        return;
      timer = setTimeout(
        () => {
          timer = undefined;
          refresh();
          schedule();
        },
        Math.round(4 * 60_000 + Math.random() * 60_000),
      );
    };
    refresh();
    schedule();
    const foreground = AppState.addEventListener('change', (phase) => {
      clearTimeout(timer);
      timer = undefined;
      if (phase === 'active') {
        refresh();
        schedule();
      }
    });
    const network = Network.addNetworkStateListener((state) => {
      online = state.isConnected === true && state.isInternetReachable !== false;
      if (online) {
        refresh();
        schedule();
      } else {
        clearTimeout(timer);
        timer = undefined;
      }
    });
    return () => {
      disposed = true;
      clearTimeout(timer);
      foreground.remove();
      network.remove();
    };
  }, [access]);
  return null;
}

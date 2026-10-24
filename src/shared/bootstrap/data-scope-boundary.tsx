import { useEffect, useRef, useSyncExternalStore, type PropsWithChildren } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { storageScopes } from '@/core/composition/repositories';
import { syncEngine } from '@/core/composition/sync';
import { useLocalization } from '@/shared/localization/localization-provider';
import { LoadingState } from '@/shared/ui/loading-state';
import { ErrorState } from '@/shared/ui/error-state';
import { Screen } from '@/shared/ui/screen';
import { LogoutNotice } from '@/features/auth/presentation/logout-notice';
import { GuestDataScreen } from '@/features/auth/presentation/guest-data-screen';

export function DataScopeBoundary({ children }: PropsWithChildren) {
  const state = useSyncExternalStore(storageScopes.subscribe, storageScopes.snapshot);
  const revision = useRef(state.revision);
  const { t } = useLocalization();
  useEffect(() => {
    if (state.phase === 'ready' && revision.current !== state.revision) {
      revision.current = state.revision;
      if (state.mode === 'guest') {
        router.dismissAll();
        router.replace('/(tabs)/settings');
      }
    }
  }, [state]);
  if (state.phase !== 'ready' || state.accountEntry === 'authenticating')
    return (
      <Screen>
        {state.phase !== 'error' ? (
          <LoadingState label={t('guest.switching')} />
        ) : (
          <ErrorState
            title={t('guest.storageError')}
            description={t('guest.storageErrorHint')}
            onRetry={() => {
              void (syncEngine ? syncEngine.signOut() : storageScopes.enterGuest()).catch(() => {});
            }}
          />
        )}
      </Screen>
    );
  return (
    <View key={state.revision} className="flex-1">
      {state.mode === 'guest' ? <LogoutNotice /> : null}
      <View
        className="flex-1"
        style={state.accountEntry === 'review' ? { display: 'none' } : undefined}
      >
        {children}
      </View>
      {state.accountEntry === 'review' ? (
        <GuestDataScreen embedded language={state.entryLanguage} />
      ) : null}
    </View>
  );
}

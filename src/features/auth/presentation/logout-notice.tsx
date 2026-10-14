import { useSyncExternalStore } from 'react';
import { syncEngine } from '@/core/composition/sync';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Text } from '@/shared/ui/text';
import { Button } from '@/shared/ui/button';
import { View } from 'react-native';

const emptySubscribe = () => () => {};
const emptySnapshot = () => null;

export function LogoutNotice() {
  const { t } = useLocalization();
  const result = useSyncExternalStore(
    syncEngine?.subscribeLogout ?? emptySubscribe,
    syncEngine?.logoutSnapshot ?? emptySnapshot,
  );
  if (!result) return null;
  return (
    <View className="gap-sm px-xl py-sm" accessibilityLiveRegion="polite">
      <Text tone={result.credentialsCleared ? 'secondary' : 'error'}>
        {t(result.credentialsCleared ? 'logout.success' : 'logout.clearFailed')}
      </Text>
      <Text tone="secondary">{t(result.synchronized ? 'logout.synced' : 'logout.skipped')}</Text>
      <Text tone={result.serverRevoked ? 'secondary' : 'warning'}>
        {t(
          result.serverRevoked
            ? 'logout.revoked'
            : result.retryAvailable
              ? 'logout.pending'
              : 'logout.unconfirmed',
        )}
      </Text>
      {!result.credentialsCleared ? (
        <Button
          label={t('logout.retryClear')}
          onPress={() => void syncEngine?.signOut().catch(() => {})}
        />
      ) : null}
    </View>
  );
}

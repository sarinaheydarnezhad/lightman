import { useCallback, useSyncExternalStore } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { learningAccess } from '@/core/composition/learning-access';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from '@/shared/ui/button';

export function SettingsSubscriptionCard() {
  const { t } = useLocalization();
  const access = learningAccess();
  const state = useSyncExternalStore(access.subscribe, access.snapshot);
  useFocusEffect(
    useCallback(() => {
      void access.refreshIfStale().catch(() => {});
    }, [access]),
  );
  const active = !state.provisional && state.entitlements?.isActive === true;
  return (
    <Button
      label={
        active
          ? t('subscription.current', { plan: t('account.plusPlan') })
          : t('subscription.title')
      }
      variant={active ? 'primary' : 'secondary'}
      onPress={() => router.push('/settings/subscription' as import('expo-router').Href)}
    />
  );
}

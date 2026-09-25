import { router } from 'expo-router';

import { Button } from '@/shared/ui/button';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { EmptyState } from '@/shared/ui/empty-state';
import { Screen } from '@/shared/ui/screen';
import { View } from 'react-native';
import { useLocalization } from '@/shared/localization/localization-provider';

export default function NotFound() {
  const { t } = useLocalization();
  return (
    <Screen edges={stackScreenEdges}>
      <View className="flex-1 justify-center gap-lg">
        <EmptyState title={t('common.notFound')} description={t('common.notFoundHint')} />
        <Button label={t('common.returnHome')} onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}

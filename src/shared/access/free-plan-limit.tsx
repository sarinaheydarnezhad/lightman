import { router } from 'expo-router';
import { View } from 'react-native';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from '@/shared/ui/button';
import { FeedbackNotice } from '@/shared/ui/feedback-notice';
import { Screen } from '@/shared/ui/screen';

export function FreePlanLimit({ operation }: { operation: 'deck' | 'card' }) {
  const { t } = useLocalization();
  return (
    <Screen scroll>
      <View className="flex-1 justify-center gap-md">
        <FeedbackNotice
          title={t('guest.limitTitle')}
          message={t(operation === 'deck' ? 'guest.deckLimit' : 'guest.cardLimit')}
          tone="warning"
        />
        <Button label={t('access.plans')} onPress={() => router.push('/settings/subscription')} />
        <Button
          label={t('common.browseDecks')}
          variant="secondary"
          onPress={() => router.replace('/decks')}
        />
      </View>
    </Screen>
  );
}

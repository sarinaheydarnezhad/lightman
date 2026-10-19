import { router } from 'expo-router';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from '@/shared/ui/button';
import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';

export function FreePlanLimit({ operation }: { operation: 'deck' | 'card' }) {
  const { t } = useLocalization();
  return (
    <FeaturePlaceholder
      title={t('guest.limitTitle')}
      description={t(operation === 'deck' ? 'guest.deckLimit' : 'guest.cardLimit')}
    >
      <Button label={t('access.plans')} onPress={() => router.push('/settings/subscription')} />
      <Button
        label={t('common.browseDecks')}
        variant="secondary"
        onPress={() => router.replace('/decks')}
      />
    </FeaturePlaceholder>
  );
}

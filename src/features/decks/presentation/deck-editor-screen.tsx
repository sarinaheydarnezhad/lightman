import { useCallback } from 'react';
import { router } from 'expo-router';

import type { CreateDeckInput } from '@/core/application/create-application';
import { haptics } from '@/core/composition/haptics';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';
import { useLocalization } from '@/shared/localization/localization-provider';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { DeckForm } from './deck-form';
import { useDeckActions } from './use-decks-view-model';

export function DeckEditorScreen({ deckId }: { deckId?: string }) {
  const { t, language } = useLocalization();
  const { get, create, update } = useDeckActions();
  const resource = useFocusedResource(
    useCallback(() => (deckId ? get(deckId) : Promise.resolve(null)), [deckId, get]),
  );

  async function save(values: CreateDeckInput) {
    if (deckId) {
      await update(deckId, values);
      void haptics.actionConfirmed();
      router.replace({ pathname: '/decks/[deckId]', params: { deckId } });
    } else {
      await create(values);
      void haptics.actionConfirmed();
      router.replace('/decks');
    }
  }

  if (deckId && resource.loading && !resource.data)
    return (
      <Screen edges={stackScreenEdges}>
        <LoadingState label={t('details.deckLoading')} />
      </Screen>
    );
  if (deckId && !resource.data)
    return (
      <FeaturePlaceholder
        title={t('details.deckUnavailable')}
        description={
          language === 'en'
            ? (resource.error ?? t('details.deckUnavailableHint'))
            : t('details.deckUnavailableHint')
        }
        onRetry={resource.refresh}
      >
        <Button
          label={t('common.browseDecks')}
          variant="secondary"
          onPress={() => router.replace('/decks')}
        />
      </FeaturePlaceholder>
    );
  return (
    <DeckForm key={deckId ?? 'create'} existing={resource.data ?? undefined} onSubmit={save} />
  );
}

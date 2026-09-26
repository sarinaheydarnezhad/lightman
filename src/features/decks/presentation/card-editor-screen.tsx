import { useEffect, useRef } from 'react';
import { router } from 'expo-router';

import type { CreateCardInput } from '@/core/application/create-application';
import { haptics } from '@/core/composition/haptics';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from '@/shared/ui/button';
import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { CardForm } from './card-form';
import { useCardActions, useCardEditorViewModel } from './use-cards-view-model';

export function CardEditorScreen({ deckId, cardId }: { deckId: string; cardId?: string }) {
  const { t, language } = useLocalization();
  const { create, update } = useCardActions();
  const resource = useCardEditorViewModel(deckId, cardId);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  async function save(content: Omit<CreateCardInput, 'deckId'>) {
    if (cardId) {
      await update(cardId, content);
      if (!mounted.current) return;
      void haptics.actionConfirmed();
      router.dismissTo({
        pathname: '/decks/[deckId]/cards/[cardId]',
        params: { deckId, cardId },
      });
    } else {
      const card = await create({ ...content, deckId });
      if (!mounted.current) return;
      void haptics.actionConfirmed();
      router.replace({
        pathname: '/decks/[deckId]/cards/[cardId]',
        params: { deckId, cardId: card.id },
      });
    }
  }

  if (resource.loading && !resource.data)
    return (
      <Screen edges={stackScreenEdges}>
        <LoadingState label={t('details.cardLoading')} />
      </Screen>
    );
  if (!resource.data || resource.error)
    return (
      <FeaturePlaceholder
        title={t('details.cardUnavailable')}
        description={
          language === 'en'
            ? (resource.error ?? t('details.cardUnavailableHint'))
            : t('details.cardUnavailableHint')
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
    <CardForm
      key={cardId ?? deckId}
      deck={resource.data.deck}
      existing={resource.data.card ?? undefined}
      onSubmit={save}
    />
  );
}

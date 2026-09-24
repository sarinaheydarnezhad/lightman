import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';

import { application } from '@/core/composition/application';
import { AppError } from '@/core/errors/app-error';
import type { Card } from '@/features/study/domain/card';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { Input } from '@/shared/ui/input';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';

function CardForm({ deckId, existing }: { deckId: string; existing?: Card }) {
  const [frontText, setFrontText] = useState(existing?.frontText ?? '');
  const [meaning, setMeaning] = useState(existing?.meaning ?? '');
  const [phonetic, setPhonetic] = useState(existing?.phonetic ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [examplesText, setExamplesText] = useState(
    existing?.examples.map((example) => example.sentence).join('\n') ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const examples = examplesText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((sentence, index) => {
          const previous = existing?.examples[index];
          return previous?.sentence === sentence ? { ...previous } : { sentence };
        });
      const changes = {
        frontText,
        meaning,
        phonetic: phonetic || null,
        category: category || null,
        examples,
      };
      const card = existing
        ? await application.updateCard(existing.id, changes)
        : await application.createCard({ ...changes, deckId });
      router.replace({
        pathname: '/decks/[deckId]/cards/[cardId]',
        params: { deckId, cardId: card.id },
      });
    } catch (cause) {
      setError(cause instanceof AppError ? cause.message : 'Unable to save this card.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-lg">
        <ScreenHeader
          title={existing ? 'Edit card' : 'Create a card'}
          description="Add a term, its meaning, and optional usage examples."
        />
        <Input label="Front text" value={frontText} onChangeText={setFrontText} />
        <Input label="Meaning" value={meaning} onChangeText={setMeaning} multiline />
        <Input label="Phonetic" value={phonetic} onChangeText={setPhonetic} />
        <Input label="Category" value={category} onChangeText={setCategory} />
        <Input
          label="Examples (one sentence per line)"
          value={examplesText}
          onChangeText={setExamplesText}
          multiline
        />
        {error ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button
          label={existing ? 'Save card' : 'Create card'}
          loading={saving}
          onPress={() => void save()}
        />
      </View>
    </Screen>
  );
}

export function CardEditorScreen({ deckId, cardId }: { deckId: string; cardId?: string }) {
  const resource = useFocusedResource(
    useCallback(async () => {
      await application.getDeck(deckId);
      if (!cardId) return null;
      const card = await application.getCard(cardId);
      if (card.deckId !== deckId) throw new AppError('not-found', 'Card not found.');
      return card;
    }, [deckId, cardId]),
  );
  if (resource.loading)
    return (
      <Screen edges={stackScreenEdges}>
        <LoadingState label="Loading card" />
      </Screen>
    );
  if (resource.error || (cardId && !resource.data))
    return (
      <Screen edges={stackScreenEdges}>
        <EmptyState
          title="Card unavailable"
          description={resource.error ?? "This card isn't available."}
        />
        <Button label="Try again" onPress={resource.refresh} />
      </Screen>
    );
  return <CardForm key={cardId ?? deckId} deckId={deckId} existing={resource.data ?? undefined} />;
}

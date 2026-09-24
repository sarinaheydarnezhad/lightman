import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';

import { application } from '@/core/composition/application';
import { languageTag } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import type { Deck, DeckTextAlignment, TypographySize } from '@/features/decks/domain/deck';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { Input } from '@/shared/ui/input';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';

function DeckForm({ existing }: { existing?: Deck }) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [language, setLanguage] = useState<string>(existing?.language ?? 'en');
  const [alignment, setAlignment] = useState<DeckTextAlignment>(existing?.textAlignment ?? 'ltr');
  const [size, setSize] = useState<TypographySize>(existing?.typographySize ?? 'medium');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const changes = {
        name,
        description,
        language: languageTag(language),
        textAlignment: alignment,
        typographySize: size,
      };
      const saved = existing
        ? await application.updateDeck(existing.id, changes)
        : await application.createDeck(changes);
      router.replace({ pathname: '/decks/[deckId]', params: { deckId: saved.id } });
    } catch (cause) {
      setError(cause instanceof AppError ? cause.message : 'Unable to save this deck.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-lg">
        <ScreenHeader
          title={existing ? `Edit ${existing.name}` : 'Create a deck'}
          description="Choose the language and reading style for your cards."
        />
        <Input label="Deck name" value={name} onChangeText={setName} />
        <Input label="Description" value={description} onChangeText={setDescription} multiline />
        <Input
          label="Language tag"
          helperText="Examples: en, es, fa-IR"
          value={language}
          onChangeText={setLanguage}
          autoCapitalize="none"
        />
        <Text variant="labelLarge">Text alignment</Text>
        <View className="flex-row gap-sm">
          {(['ltr', 'rtl', 'center'] as const).map((choice) => (
            <Button
              key={choice}
              label={choice.toUpperCase()}
              variant={alignment === choice ? 'primary' : 'secondary'}
              accessibilityState={{ selected: alignment === choice }}
              onPress={() => setAlignment(choice)}
            />
          ))}
        </View>
        <Text variant="labelLarge">Typography size</Text>
        <View className="flex-row gap-sm">
          {(['small', 'medium', 'large'] as const).map((choice) => (
            <Button
              key={choice}
              label={choice}
              variant={size === choice ? 'primary' : 'secondary'}
              accessibilityState={{ selected: size === choice }}
              onPress={() => setSize(choice)}
            />
          ))}
        </View>
        {error ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button
          label={existing ? 'Save deck' : 'Create deck'}
          loading={saving}
          onPress={() => void save()}
        />
      </View>
    </Screen>
  );
}

export function DeckEditorScreen({ deckId }: { deckId?: string }) {
  const resource = useFocusedResource(
    useCallback(() => (deckId ? application.getDeck(deckId) : Promise.resolve(null)), [deckId]),
  );
  if (resource.loading)
    return (
      <Screen edges={stackScreenEdges}>
        <LoadingState label="Loading deck" />
      </Screen>
    );
  if (deckId && !resource.data)
    return (
      <Screen edges={stackScreenEdges}>
        <EmptyState
          title="Deck unavailable"
          description={resource.error ?? "This deck isn't available."}
        />
        <Button label="Try again" onPress={resource.refresh} />
      </Screen>
    );
  return <DeckForm key={deckId ?? 'create'} existing={resource.data ?? undefined} />;
}

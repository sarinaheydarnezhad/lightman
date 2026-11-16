import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect, type Href } from 'expo-router';
import { View } from 'react-native';
import { application } from '@/core/composition/application';
import {
  downloadSampleFile,
  saveTransferFile,
  shareTransferFile,
  selectTransferFile,
  transferService,
} from '@/core/composition/transfer';
import type { Deck } from '@/features/decks/domain/deck';
import { SpreadsheetUnsafeCsvError, type TransferFormat } from '../domain/transfer';
import { useLocalization } from '@/shared/localization/localization-provider';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Chip } from '@/shared/ui/chip';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { FeedbackNotice } from '@/shared/ui/feedback-notice';
import { formatTransferLocation } from './format-transfer-location';
import { transferFeedbackKey } from './transfer-feedback';

const formatHelp = [
  ['CSV', 'transfer.csvHelp'],
  ['XLSX', 'transfer.xlsxHelp'],
  ['Anki', 'transfer.ankiHelp'],
] as const;

export function TransferScreen({ initialDeckId }: { initialDeckId?: string }) {
  const { t, direction } = useLocalization();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [deckId, setDeckId] = useState(initialDeckId);
  const [format, setFormat] = useState<TransferFormat>('csv');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const active = useRef(false);
  const mounted = useRef(true);
  const importTextStyle = {
    textAlign: direction === 'rtl' ? 'right' : 'left',
    writingDirection: direction,
  } as const;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let focused = true;
      void application
        .listDecks()
        .then((items) => {
          if (focused) {
            setDecks(items);
            setLoaded(true);
          }
        })
        .catch(() => {
          if (focused) setError(t('common.genericError'));
        });
      return () => {
        focused = false;
      };
    }, [t]),
  );

  async function run(operation: () => Promise<void>) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      await operation();
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof SpreadsheetUnsafeCsvError
            ? t('transfer.csvUnsafe')
            : t(transferFeedbackKey(cause, 'transfer.operationError')),
        );
    } finally {
      active.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-2xl">
        <ScreenHeader title={t('transfer.title')} description={t('transfer.description')} />
        <Card className="gap-md">
          <Text variant="headingSmall" style={importTextStyle}>
            {t('transfer.import')}
          </Text>
          <Text tone="secondary" style={importTextStyle}>
            {t('transfer.importHint')}
          </Text>
          <View className="gap-lg py-sm">
            <View className="gap-sm">
              <Text variant="bodySmall" style={importTextStyle}>
                {t('transfer.requiredColumns')}
              </Text>
              <Text
                variant="bodySmall"
                weight="semibold"
                style={{ ...importTextStyle, writingDirection: 'ltr' }}
              >
                Front, Back
              </Text>
            </View>
            <View className="gap-sm">
              <Text variant="bodySmall" style={importTextStyle}>
                {t('transfer.optionalColumns')}
              </Text>
              <Text
                variant="bodySmall"
                weight="semibold"
                style={{ ...importTextStyle, writingDirection: 'ltr' }}
              >
                Deck, Phonetic, Category, Examples
              </Text>
              <Text variant="bodySmall" tone="secondary" style={importTextStyle}>
                {t('transfer.additionalColumnsHint')}
              </Text>
            </View>
          </View>
          <View className="gap-lg border-t border-border pt-lg">
            {formatHelp.map(([name, description]) => (
              <View key={name} className="gap-sm">
                <Text weight="bold" style={{ ...importTextStyle, writingDirection: 'ltr' }}>
                  {name}
                </Text>
                <Text variant="bodySmall" tone="secondary" style={importTextStyle}>
                  {t(description)}
                </Text>
              </View>
            ))}
          </View>
          <Button
            label={t('transfer.sample')}
            variant="secondary"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const name = await downloadSampleFile();
                setResult(t('transfer.saved', { name: formatTransferLocation(name) }));
              })
            }
          />
          <Button
            label={t('transfer.select')}
            disabled={busy}
            loading={busy}
            onPress={() =>
              void run(async () => {
                const file = await selectTransferFile();
                if (!file || !mounted.current) return;
                const cancelPreview = transferService.cancel;
                const next = await transferService.preview(file.format, file.bytes, file.name);
                if (!mounted.current) {
                  cancelPreview(next);
                  return;
                }
                router.push('/settings/import-preview' as Href);
              })
            }
          />
        </Card>
        <Card className="gap-md">
          <Text variant="headingSmall">{t('transfer.export')}</Text>
          <Text tone="secondary">{t('transfer.exportHint')}</Text>
          <View className="flex-row flex-wrap gap-sm">
            <Chip
              label={t('transfer.allDecks')}
              selected={!deckId}
              disabled={busy}
              onPress={() => setDeckId(undefined)}
            />
            {decks.map((deck) => (
              <Chip
                key={deck.id}
                label={deck.name}
                selected={deckId === deck.id}
                disabled={busy}
                onPress={() => setDeckId(deck.id)}
              />
            ))}
          </View>
          <View className="flex-row flex-wrap gap-sm">
            {(['csv', 'xlsx', 'apkg'] as const).map((choice) => (
              <Chip
                key={choice}
                label={choice === 'apkg' ? 'Anki (.apkg)' : choice.toUpperCase()}
                selected={format === choice}
                disabled={busy}
                onPress={() => setFormat(choice)}
              />
            ))}
          </View>
          <Button
            label={t('transfer.save')}
            disabled={busy || !loaded}
            onPress={() =>
              void run(async () => {
                const bytes = await transferService.export(format, deckId);
                const name = await saveTransferFile(format, bytes);
                setResult(t('transfer.saved', { name: formatTransferLocation(name) }));
              })
            }
          />
          <Button
            label={t('transfer.share')}
            variant="secondary"
            disabled={busy || !loaded}
            onPress={() =>
              void run(async () => {
                const bytes = await transferService.export(format, deckId);
                const name = await shareTransferFile(format, bytes);
                setResult(t('transfer.shared', { name: formatTransferLocation(name) }));
              })
            }
          />
        </Card>
        <FeedbackNotice message={result} tone="success" onDismiss={() => setResult(null)} />
        <FeedbackNotice message={error} onDismiss={() => setError(null)} />
      </View>
    </Screen>
  );
}

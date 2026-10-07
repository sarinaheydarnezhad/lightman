import { useEffect, useRef, useState } from 'react';
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
import type {
  ImportPreview,
  ImportPreviewRow,
  ImportSummary,
} from '../application/transfer-service';
import type { TransferFormat } from '../domain/transfer';
import { useLocalization } from '@/shared/localization/localization-provider';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Chip } from '@/shared/ui/chip';
import { Input } from '@/shared/ui/input';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';

const formatHelp = [
  [
    'CSV',
    'A comma-separated text file. The first row is headers; Front and Back are required. Deck, Phonetic, Category, Examples, and any other columns are optional.',
  ],
  [
    'XLSX',
    'An Excel workbook. Put headers in the first row of a sheet; Front and Back are required. Additional columns are preserved.',
  ],
  [
    'Anki',
    'An Anki .apkg or .colpkg package. Cards and available fields are extracted for review before saving.',
  ],
] as const;

export function TransferScreen({ initialDeckId }: { initialDeckId?: string }) {
  const { t, language } = useLocalization();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [deckId, setDeckId] = useState(initialDeckId);
  const [format, setFormat] = useState<TransferFormat>('csv');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const active = useRef(false);
  const currentPreview = useRef<ImportPreview | null>(null);

  useEffect(() => {
    let mounted = true;
    void application
      .listDecks()
      .then((items) => {
        if (mounted) {
          setDecks(items);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (mounted) setError(t('common.genericError'));
      });
    return () => {
      mounted = false;
      if (currentPreview.current) transferService.cancel(currentPreview.current);
    };
  }, [t]);

  async function run(operation: () => Promise<void>) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      await operation();
    } catch (cause) {
      setError(
        language === 'en' && cause instanceof Error ? cause.message : t('common.genericError'),
      );
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  function cancel() {
    if (preview) transferService.cancel(preview);
    currentPreview.current = null;
    setPreview(null);
    setRows([]);
  }
  function updateRow(location: string, field: string, value: string) {
    setRows((current) =>
      current.map((row) =>
        row.location === location
          ? {
              ...row,
              card:
                field === 'deckName' || field === 'frontText' || field === 'meaning'
                  ? { ...row.card, [field]: value }
                  : { ...row.card, extra: { ...(row.card.extra ?? {}), [field]: value } },
            }
          : row,
      ),
    );
  }

  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-2xl">
        <ScreenHeader title={t('transfer.title')} description={t('transfer.description')} />
        <Card className="gap-md">
          <Text variant="headingSmall">{t('transfer.import')}</Text>
          <Text tone="secondary">{t('transfer.importHint')}</Text>
          <Text variant="bodySmall">{t('transfer.requiredColumns')}</Text>
          {formatHelp.map(([name, description]) => (
            <Text key={name} variant="bodySmall" tone="secondary">
              {name}: {description}
            </Text>
          ))}
          <Button
            label={t('transfer.sample')}
            variant="secondary"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const name = await downloadSampleFile();
                setResult(t('transfer.saved', { name }));
              })
            }
          />
          <Button
            label={t('transfer.select')}
            disabled={busy || !!preview}
            loading={busy}
            onPress={() =>
              void run(async () => {
                setSummary(null);
                const file = await selectTransferFile();
                if (!file) return;
                const next = await transferService.preview(file.format, file.bytes, file.name);
                currentPreview.current = next;
                setPreview(next);
                setRows(next.rows ? [...next.rows] : []);
              })
            }
          />
        </Card>
        {preview ? (
          <Card className="gap-md">
            <Text variant="headingSmall">{t('transfer.preview')}</Text>
            <Text>
              {t('transfer.previewCounts', {
                format: preview.format.toUpperCase(),
                total: preview.totalCards,
                new: preview.rows ? rows.length : preview.newCards,
                duplicates: preview.duplicates,
                invalid: preview.invalidRows,
              })}
            </Text>
            <Text>
              {t('transfer.decks', { names: preview.decks.join(', ') || t('transfer.noDeck') })}
            </Text>
            <Text tone="secondary">{t('transfer.editHint')}</Text>
            {rows.map((row) => (
              <Card key={row.location} className="gap-sm">
                <Text variant="labelMedium">{row.location}</Text>
                <Input
                  label="Deck"
                  value={row.card.deckName}
                  onChangeText={(value) => updateRow(row.location, 'deckName', value)}
                />
                <Input
                  label="Front *"
                  value={row.card.frontText}
                  onChangeText={(value) => updateRow(row.location, 'frontText', value)}
                  multiline
                />
                <Input
                  label="Back *"
                  value={row.card.meaning}
                  onChangeText={(value) => updateRow(row.location, 'meaning', value)}
                  multiline
                />
                {(preview.columns ?? []).map((column) => (
                  <Input
                    key={column}
                    label={column}
                    value={row.card.extra?.[column] ?? ''}
                    onChangeText={(value) => updateRow(row.location, column, value)}
                  />
                ))}
                <Button
                  label={t('transfer.deleteRow')}
                  variant="secondary"
                  disabled={busy}
                  onPress={() =>
                    setRows((current) =>
                      current.filter((candidate) => candidate.location !== row.location),
                    )
                  }
                />
              </Card>
            ))}
            {preview.issues.slice(0, 20).map((issue, index) => (
              <Text key={index} tone="error" variant="bodySmall">
                {issue.location}: {issue.message}
              </Text>
            ))}
            <Text tone="secondary">{t('transfer.confirmHint')}</Text>
            <Button
              label={t('common.cancel')}
              variant="secondary"
              disabled={busy}
              onPress={cancel}
            />
            <Button
              label={t('transfer.confirm')}
              disabled={(!rows.length && !preview.newCards) || busy}
              loading={busy}
              onPress={() =>
                void run(async () => {
                  const result = await transferService.confirm(preview, rows);
                  currentPreview.current = null;
                  setPreview(null);
                  setRows([]);
                  setSummary(result);
                  setDecks(await application.listDecks());
                })
              }
            />
          </Card>
        ) : null}
        {summary ? (
          <Card className="gap-sm">
            <Text accessibilityLiveRegion="polite">
              {t('transfer.summary', {
                imported: summary.imported,
                duplicates: summary.duplicatesSkipped,
                invalid: summary.invalidSkipped,
              })}
            </Text>
            {summary.issues.slice(0, 20).map((issue, index) => (
              <Text key={index} variant="bodySmall" tone="error">
                {issue.location}: {issue.message}
              </Text>
            ))}
          </Card>
        ) : null}
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
                setResult(t('transfer.saved', { name }));
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
                setResult(t('transfer.shared', { name }));
              })
            }
          />
        </Card>
        {result ? <Text accessibilityLiveRegion="polite">{result}</Text> : null}
        {error ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

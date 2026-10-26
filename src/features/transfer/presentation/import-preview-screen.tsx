import { useEffect, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { transferService } from '@/core/composition/transfer';
import type { ImportPreviewRow, ImportSummary } from '../application/transfer-service';
import { useLocalization } from '@/shared/localization/localization-provider';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { spacing } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { FeedbackModal } from '@/shared/ui/feedback-modal';
import { Input } from '@/shared/ui/input';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';

export function ImportPreviewScreen() {
  const { t, language, direction } = useLocalization();
  const [{ preview, confirm, cancel }] = useState(() => ({
    preview: transferService.pendingPreview(),
    confirm: transferService.confirm,
    cancel: transferService.cancel,
  }));
  const [rows, setRows] = useState<ImportPreviewRow[]>(() => [...(preview?.rows ?? [])]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const finalized = useRef(false);
  const mounted = useRef(true);

  usePreventRemove(busy, () => {});

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void Promise.resolve().then(() => {
        if (preview && !mounted.current && !finalized.current) {
          try {
            cancel(preview);
          } catch {}
        }
      });
    };
  }, [preview, cancel]);

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/settings/transfer');
  }

  function reject() {
    if (submitting.current || finalized.current || !preview) return;
    cancel(preview);
    finalized.current = true;
    leave();
  }

  async function approve() {
    if (submitting.current || finalized.current || !preview || !rows.length) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await confirm(preview, rows);
      finalized.current = true;
      if (mounted.current) setSummary(result);
    } catch (cause) {
      if (mounted.current)
        setError(
          language === 'en' && cause instanceof Error ? cause.message : t('common.genericError'),
        );
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
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

  if (!preview)
    return (
      <Screen edges={stackScreenEdges}>
        <EmptyState title={t('transfer.preview')} description={t('transfer.previewMissing')} />
        <Button label={t('transfer.select')} onPress={leave} />
      </Screen>
    );

  return (
    <Screen edges={stackScreenEdges} testID="import-preview-screen">
      <Stack.Screen options={{ gestureEnabled: !busy, headerBackVisible: !busy }} />
      <View className="flex-1 gap-md">
        <FlatList
          testID="import-preview-cards"
          style={{ flex: 1 }}
          data={rows}
          keyExtractor={(row) => row.location}
          contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.md }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          ListHeaderComponent={
            <View className="gap-lg">
              <ScreenHeader title={t('transfer.preview')} description={preview.fileName} />
              <Card className="gap-sm">
                <Text>
                  {t('transfer.previewCounts', {
                    format: preview.format.toUpperCase(),
                    total: preview.totalCards,
                    new: preview.newCards,
                    duplicates: preview.duplicates,
                    invalid: preview.invalidRows,
                  })}
                </Text>
                <Text>
                  {t('transfer.decks', { names: preview.decks.join(', ') || t('transfer.noDeck') })}
                </Text>
                <Text tone="secondary">{t('transfer.editHint')}</Text>
                <Text tone="secondary">{t('transfer.confirmHint')}</Text>
                {preview.issues.slice(0, 20).map((issue, index) => (
                  <Text key={index} variant="bodySmall" tone="warning">
                    {issue.location}: {issue.message}
                  </Text>
                ))}
              </Card>
            </View>
          }
          renderItem={({ item: row }) => (
            <Card className="gap-sm">
              <Text variant="labelMedium">{row.location}</Text>
              <Input
                label={t('form.deckName')}
                value={row.card.deckName}
                disabled={busy || !!summary}
                onChangeText={(value) => updateRow(row.location, 'deckName', value)}
              />
              <Input
                label={`${t('form.front')} *`}
                value={row.card.frontText}
                disabled={busy || !!summary}
                onChangeText={(value) => updateRow(row.location, 'frontText', value)}
                multiline
              />
              <Input
                label={`${t('form.back')} *`}
                value={row.card.meaning}
                disabled={busy || !!summary}
                onChangeText={(value) => updateRow(row.location, 'meaning', value)}
                multiline
              />
              {(preview.columns ?? []).map((column) => (
                <Input
                  key={column}
                  label={column}
                  value={row.card.extra?.[column] ?? ''}
                  disabled={busy || !!summary}
                  onChangeText={(value) => updateRow(row.location, column, value)}
                />
              ))}
              <Button
                label={t('transfer.deleteRow')}
                variant="secondary"
                disabled={busy || !!summary}
                onPress={() =>
                  setRows((current) =>
                    current.filter((candidate) => candidate.location !== row.location),
                  )
                }
              />
            </Card>
          )}
        />
        <View
          testID="import-preview-actions"
          className={`gap-md border-t border-border bg-background pt-md ${direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}
        >
          <Button
            label={t('transfer.reject')}
            variant="secondary"
            disabled={busy || !!summary}
            style={{ flex: 1 }}
            onPress={reject}
          />
          <Button
            label={t('transfer.approve')}
            disabled={busy || !!summary || !rows.length}
            loading={busy}
            style={{ flex: 1 }}
            onPress={() => void approve()}
          />
        </View>
      </View>
      {summary ? (
        <FeedbackModal
          tone="info"
          eventKey={summary}
          message={t('transfer.summary', {
            imported: summary.imported,
            duplicates: summary.duplicatesSkipped,
            invalid: summary.invalidSkipped,
          })}
          onDismiss={leave}
        >
          {summary.issues.slice(0, 20).map((issue, index) => (
            <Text key={index} variant="bodySmall" tone="error">
              {issue.location}: {issue.message}
            </Text>
          ))}
        </FeedbackModal>
      ) : null}
      <FeedbackModal message={error} onDismiss={() => setError(null)} />
    </Screen>
  );
}

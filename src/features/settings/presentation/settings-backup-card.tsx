import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { syncEngine } from '@/core/composition/sync';
import { CloudError } from '@/core/sync/cloud-client';
import type { BackupMetadata, BackupOverview } from '@/core/sync/server-backup';
import { useLocalization } from '@/shared/localization/localization-provider';
import type { MessageKey } from '@/shared/localization/messages';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { LoadingState } from '@/shared/ui/loading-state';
import { Text } from '@/shared/ui/text';
import { FeedbackModal } from '@/shared/ui/feedback-modal';

function failureMessage(error: unknown): MessageKey {
  if (error instanceof CloudError) {
    if (error.code === 'backup_capacity_reached') return 'backup.capacityError';
    if (error.status === 401) return 'backup.authError';
    if (error.status === 0) return 'backup.networkError';
    if (error.status === 429) return 'backup.rateError';
    if (error.status === 503 || error.status === 404) return 'backup.unavailable';
    if (error.status === 413) return 'backup.sizeError';
  }
  return 'backup.error';
}

export function SettingsBackupCard() {
  const { t, language, number } = useLocalization();
  const [overview, setOverview] = useState<BackupOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<'completed' | 'failed' | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const statusRequest = useRef<Promise<BackupOverview> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (inFlight.current) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!syncEngine?.available) throw new CloudError(503);
      const pending = statusRequest.current ?? syncEngine.backupStatus();
      statusRequest.current = pending;
      const result = await pending;
      if (mounted.current) {
        setOverview(result);
        setOperation(null);
      }
    } catch (failure) {
      if (mounted.current) setError(failureMessage(failure));
    } finally {
      statusRequest.current = null;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      setNow(Date.now());
      const timer = setInterval(() => setNow(Date.now()), 60_000);
      return () => {
        clearInterval(timer);
      };
    }, [refresh]),
  );

  const backUp = async () => {
    if (loading || inFlight.current || !syncEngine?.available) return;
    inFlight.current = true;
    setBusy(true);
    setOperation(null);
    setError(null);
    try {
      const result = await syncEngine.createBackup();
      if (!mounted.current) return;
      const metadata: BackupMetadata = { ...result, failureCode: null };
      setOverview({ latest: metadata, lastSuccessful: metadata });
      setOperation('completed');
      try {
        const refreshed = await syncEngine.backupStatus();
        if (mounted.current) setOverview(refreshed);
      } catch (failure) {
        if (mounted.current) setError(failureMessage(failure));
      }
    } catch (failure) {
      if (mounted.current) {
        setOperation('failed');
        setError(failureMessage(failure));
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setNow(Date.now());
        setBusy(false);
      }
    }
  };

  const latest = overview?.latest;
  const successful = overview?.lastSuccessful ?? (latest?.completedAtUtc ? latest : null);
  const current = latest ?? successful;
  const expired = !!current && (current.isExpired || Date.parse(current.expiresAtUtc) <= now);
  const status: MessageKey =
    error && !operation && !busy
      ? 'backup.unknown'
      : busy
        ? 'backup.inProgress'
        : operation === 'failed'
          ? 'backup.failed'
          : expired
            ? 'backup.expired'
            : latest?.status === 'Failed'
              ? 'backup.failed'
              : latest?.status === 'Pending'
                ? 'backup.inProgress'
                : latest?.status === 'Completed' || overview?.lastSuccessful
                  ? 'backup.completed'
                  : overview
                    ? 'backup.never'
                    : 'backup.unknown';
  const localTime = (value: string) => new Date(value).toLocaleString(language);

  return (
    <Card className="gap-md" testID="settings-backup-card">
      <Text variant="headingSmall" accessibilityRole="header">
        {t('backup.title')}
      </Text>
      {loading ? <LoadingState label={t('backup.loading')} /> : null}
      <Text accessibilityLiveRegion="polite">{t(status)}</Text>
      {busy ? <LoadingState label={t('backup.progress')} /> : null}
      {successful?.completedAtUtc ? (
        <>
          <Text>{t('backup.last', { time: localTime(successful.completedAtUtc) })}</Text>
          <Text>{t('backup.expires', { time: localTime(successful.expiresAtUtc) })}</Text>
          <Text>
            {Date.parse(successful.expiresAtUtc) <= now
              ? t('backup.expired')
              : t('backup.remaining', {
                  hours: number(Math.ceil((Date.parse(successful.expiresAtUtc) - now) / 3_600_000)),
                })}
          </Text>
        </>
      ) : null}
      {operation === 'completed' ? (
        <FeedbackModal message={t('backup.verified')} tone="success" onDismiss={() => setOperation(null)} />
      ) : null}
      {error ? (
        <FeedbackModal message={t(error)} onRetry={() => void refresh()} retryLabel={t('backup.refresh')} />
      ) : null}
      {latest?.status === 'Failed' && !error ? <FeedbackModal message={t('backup.error')} eventKey={latest} /> : null}
      <Text tone="secondary">{t('backup.coverage')}</Text>
      <Button
        label={t('backup.now')}
        loading={busy}
        disabled={loading || !syncEngine?.available}
        onPress={() => void backUp()}
      />
    </Card>
  );
}

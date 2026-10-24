import { useEffect, useState, useSyncExternalStore } from 'react';
import { syncEngine } from '@/core/composition/sync';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Text } from '@/shared/ui/text';
import { FeedbackModal } from '@/shared/ui/feedback-modal';
import { AppState } from 'react-native';

const emptySubscribe = () => () => {};
const emptySnapshot = () => null;

export function LogoutNotice() {
  const { t } = useLocalization();
  const result = useSyncExternalStore(
    syncEngine?.subscribeLogout ?? emptySubscribe,
    syncEngine?.logoutSnapshot ?? emptySnapshot,
  );
  const [now, setNow] = useState(() => Date.now());
  const expiry = result?.backup ? Date.parse(result.backup.expiresAtUtc) : 0;
  useEffect(() => {
    if (!expiry) return;
    const refresh = () => setNow(Date.now());
    const timer =
      expiry > now
        ? setTimeout(refresh, Math.min(Math.max(expiry - Date.now() + 1, 0), 2_147_483_647))
        : undefined;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      subscription.remove();
    };
  }, [expiry, now]);
  if (!result) return null;
  return (
    <FeedbackModal
      message={t(result.credentialsCleared ? 'logout.success' : 'logout.clearFailed')}
      tone={result.credentialsCleared ? 'info' : 'error'}
      eventKey={result}
      onRetry={
        result.credentialsCleared ? undefined : () => void syncEngine?.signOut().catch(() => {})
      }
      retryLabel={t('logout.retryClear')}
    >
      <Text tone="secondary">
        {result.backup
          ? t(expiry <= now ? 'logout.backupExpired' : 'logout.backupCompleted', {
              id: result.backup.id,
              expires: result.backup.expiresAtUtc,
              days: result.backup.retentionDays,
            })
          : t(result.synchronized ? 'logout.synced' : 'logout.skipped')}
      </Text>
      <Text tone={result.serverRevoked ? 'secondary' : 'warning'}>
        {t(
          result.serverRevoked
            ? 'logout.revoked'
            : result.retryAvailable
              ? 'logout.pending'
              : 'logout.unconfirmed',
        )}
      </Text>
    </FeedbackModal>
  );
}

import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Modal, View } from 'react-native';
import { syncEngine } from '@/core/composition/sync';
import type { AccountProfile } from '@/core/sync/cloud-client';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from '@/shared/ui/button';
import { ConfirmationPanel } from '@/shared/ui/confirmation-panel';
import { ErrorState } from '@/shared/ui/error-state';
import { FeedbackModal } from '@/shared/ui/feedback-modal';
import { Input } from '@/shared/ui/input';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';

export function AccountNameGate({ children }: PropsWithChildren) {
  const { t } = useLocalization();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'invalid' | 'save' | 'logout' | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const mounted = useRef(false);
  const submitting = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      if (!syncEngine) throw new Error('Unavailable');
      const account = await syncEngine.accountProfile();
      if (mounted.current) setProfile(account);
    } catch {
      if (mounted.current) setLoadError(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [load]);

  async function save() {
    if (submitting.current || !profile || !syncEngine) return;
    const displayName = name.trim();
    if (!displayName || displayName.length > 120) {
      setError('invalid');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const account = await syncEngine.updateAccountName(displayName);
      if (account.id !== profile.id) throw new Error('Account changed');
      if (mounted.current) setProfile(account);
    } catch {
      if (mounted.current) setError('save');
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function logout() {
    if (submitting.current || !syncEngine) return;
    submitting.current = true;
    setBusy(true);
    try {
      await syncEngine.signOut();
    } catch {
      if (mounted.current) setError('logout');
    } finally {
      submitting.current = false;
      if (mounted.current) {
        setBusy(false);
        setConfirmLogout(false);
      }
    }
  }

  if (profile?.displayName.trim()) return children;

  return (
    <Modal visible animationType="slide" onRequestClose={() => {}}>
      <Screen scroll keyboardAware testID="account-name-prompt">
        <View className="gap-lg">
          <ScreenHeader
            title={t('onboarding.nameTitle')}
            description={t('onboarding.nameDescription')}
          />
          {loading ? <LoadingState label={t('account.loading')} /> : null}
          {loadError ? (
            <ErrorState
              title={t('common.errorTitle')}
              description={t('onboarding.nameLoadError')}
              onRetry={() => void load()}
            />
          ) : null}
          {profile ? (
            <>
              <Input
                label={t('onboarding.nameLabel')}
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  setError(null);
                }}
                disabled={busy}
                maxLength={120}
                autoComplete="name"
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={() => void save()}
              />
              <Button label={t('onboarding.nameSave')} loading={busy} onPress={() => void save()} />
            </>
          ) : null}
          {error ? (
            <FeedbackModal
              message={t(
                error === 'invalid'
                  ? 'onboarding.nameInvalid'
                  : error === 'save'
                    ? 'onboarding.nameSaveError'
                    : 'common.genericError',
              )}
              onDismiss={() => setError(null)}
            />
          ) : null}
          <Button
            label={t('account.logout')}
            variant="secondary"
            disabled={busy || loading}
            onPress={() => setConfirmLogout(true)}
          />
          {confirmLogout ? (
            <ConfirmationPanel
              title={t('logout.title')}
              description={t('logout.confirm')}
              cancelLabel={t('common.cancel')}
              confirmLabel={t('logout.withoutBackup')}
              busy={busy}
              onCancel={() => setConfirmLogout(false)}
              onConfirm={() => void logout()}
            />
          ) : null}
        </View>
      </Screen>
    </Modal>
  );
}

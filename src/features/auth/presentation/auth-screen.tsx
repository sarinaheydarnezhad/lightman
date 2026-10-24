import { useEffect, useRef, useState } from 'react';
import { FeedbackModal } from '@/shared/ui/feedback-modal';
import { router } from 'expo-router';
import { View } from 'react-native';
import { syncEngine } from '@/core/composition/sync';
import { CloudError } from '@/core/sync/cloud-client';
import { isValidRegistrationPassword, normalizeLocalPhoneNumber } from '@/core/sync/phone-auth';
import { useLocalization } from '@/shared/localization/localization-provider';
import type { MessageKey } from '@/shared/localization/messages';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';

type Mode = 'password' | 'register';

function errorKey(error: unknown): MessageKey {
  if (error instanceof Error && error.message === 'invalid_phone') return 'auth.invalidPhone';
  if (error instanceof CloudError) {
    switch (error.code) {
      case 'invalid_phone':
        return 'auth.invalidPhone';
      case 'invalid_password':
        return 'auth.invalidPassword';
      case 'password_mismatch':
        return 'auth.passwordMismatch';
      case 'invalid_credentials':
        return 'auth.credentials';
      case 'duplicate_phone':
        return 'auth.duplicate';
      case 'network_error':
        return 'auth.network';
    }
    if (error.status === 429) return 'auth.rateLimit';
    if (error.status === 401) return 'auth.sessionExpired';
  }
  return 'auth.unexpected';
}

export function AuthScreen() {
  const { t } = useLocalization();
  const [mode, setMode] = useState<Mode>('password');
  const [success, setSuccess] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function reset(nextMode: Mode) {
    if (inFlight.current) return;
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setError('');
  }

  async function submit() {
    if (inFlight.current || !syncEngine?.available) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const phoneNumber = normalizeLocalPhoneNumber(phone);
      if (mode === 'register') {
        if (!isValidRegistrationPassword(password)) {
          setError(t('auth.invalidPassword'));
          return;
        }
        if (password !== confirmPassword) {
          setError(t('auth.passwordMismatch'));
          return;
        }
        await syncEngine.registerPhoneWithPassword({ phoneNumber, password, confirmPassword });
      } else {
        if (!password) {
          setError(t('auth.passwordRequired'));
          return;
        }
        await syncEngine.signInPhone(phoneNumber, password);
      }
      if (mounted.current) {
        setPassword('');
        setConfirmPassword('');
        setSuccess(true);
      }
    } catch (failure) {
      if (mounted.current) setError(t(errorKey(failure)));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const registering = mode === 'register';

  return (
    <Screen scroll keyboardAware>
      <View className="gap-lg">
        <ScreenHeader title={t('auth.title')} />
        {!syncEngine?.available ? (
          <FeedbackModal message={t('sync.unavailable')} tone="info" />
        ) : success ? (
          <FeedbackModal message={t('auth.success')} tone="success" onDismiss={() => router.replace('/settings/cloud')}>
            <Button label={t('auth.done')} onPress={() => router.replace('/settings/cloud')} />
          </FeedbackModal>
        ) : (
          <>
            <View className="gap-sm">
              <Button
                label={t('auth.passwordLogin')}
                variant="secondary"
                disabled={busy}
                accessibilityState={{ selected: !registering }}
                onPress={() => reset('password')}
              />
              <Button
                label={t('auth.register')}
                variant="secondary"
                disabled={busy}
                accessibilityState={{ selected: registering }}
                onPress={() => reset('register')}
              />
            </View>
            <Input
              label={t('auth.phone')}
              helperText={t('auth.phoneHint')}
              placeholder="09121234567"
              value={phone}
              onChangeText={setPhone}
              disabled={busy}
              maxLength={11}
              keyboardType="phone-pad"
              autoComplete="tel"
              autoCapitalize="none"
              textAlign="left"
            />
            <Input
              label={t('sync.password')}
              helperText={registering ? t('auth.passwordHint') : undefined}
              value={password}
              onChangeText={setPassword}
              disabled={busy}
              maxLength={128}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={registering ? 'new-password' : 'current-password'}
            />
            {registering && (
              <Input
                label={t('auth.confirmPassword')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                disabled={busy}
                maxLength={128}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
              />
            )}
            <Button
              label={t(registering ? 'auth.complete' : 'sync.signIn')}
              loading={busy}
              onPress={() => void submit()}
            />
          </>
        )}
        {!!error && (
          <FeedbackModal message={error} onDismiss={() => setError('')} />
        )}
      </View>
    </Screen>
  );
}

import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { syncEngine } from '@/core/composition/sync';
import { CloudError } from '@/core/sync/cloud-client';
import { normalizeLocalPhoneNumber, type OtpChallenge } from '@/core/sync/phone-auth';
import { useLocalization } from '@/shared/localization/localization-provider';
import type { MessageKey } from '@/shared/localization/messages';
import { FeedbackModal } from '@/shared/ui/feedback-modal';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { Text } from '@/shared/ui/text';

function errorKey(error: unknown): MessageKey {
  if (error instanceof Error && error.message === 'invalid_phone') return 'auth.invalidPhone';
  if (error instanceof CloudError) {
    if (error.status === 429) return 'auth.rateLimit';
    switch (error.code) {
      case 'invalid_phone':
        return 'auth.invalidPhone';
      case 'invalid_otp':
        return 'auth.invalidOtp';
      case 'account_recovery_required':
        return 'auth.recoveryRequired';
      case 'sms_unavailable':
        return 'auth.smsUnavailable';
      case 'network_error':
        return 'auth.network';
    }
  }
  return 'auth.unexpected';
}

export function AuthScreen() {
  const { t } = useLocalization();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [busy, setBusy] = useState<'send' | 'verify' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const resendSeconds = Math.max(0, Math.ceil((Math.max(retryAt, resendAt) - now) / 1000));

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!challenge && !retryAt && !resendAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [challenge, retryAt, resendAt]);

  async function submit(operation: 'send' | 'verify') {
    if (inFlight.current || !syncEngine?.available || (operation === 'send' && resendSeconds > 0))
      return;
    inFlight.current = true;
    setBusy(operation);
    setError('');
    try {
      if (operation === 'send') {
        const requested = await syncEngine.requestOtp(
          normalizeLocalPhoneNumber(phone),
          'authenticate',
        );
        if (mounted.current) {
          setChallenge(requested);
          setResendAt(Date.parse(requested.resendAtUtc));
          setCode('');
          setNow(Date.now());
        }
      } else {
        if (!challenge || !/^[0-9]{6}$/.test(code)) {
          setError(t('auth.invalidCode'));
          return;
        }
        if (Date.parse(challenge.expiresAtUtc) <= Date.now()) {
          setError(t('auth.expired'));
          return;
        }
        await syncEngine.loginWithOtp(challenge.challengeId, code);
        if (mounted.current) {
          setCode('');
          setChallenge(null);
          setSuccess(true);
        }
      }
    } catch (failure) {
      if (mounted.current) {
        setError(t(errorKey(failure)));
        if (failure instanceof CloudError && failure.status === 429) {
          setRetryAt(Date.now() + (failure.retryAfterMs ?? 60000));
          setNow(Date.now());
        }
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  return (
    <Screen scroll keyboardAware>
      <View className="gap-lg">
        <ScreenHeader title={t('auth.title')} />
        {!syncEngine?.available ? (
          <FeedbackModal message={t('sync.unavailable')} tone="info" />
        ) : success ? (
          <FeedbackModal
            message={t('auth.success')}
            tone="success"
            onDismiss={() => router.replace('/settings/cloud')}
          >
            <Button label={t('auth.done')} onPress={() => router.replace('/settings/cloud')} />
          </FeedbackModal>
        ) : (
          <>
            <Input
              label={t('auth.phone')}
              helperText={t('auth.phoneHint')}
              placeholder="09121234567"
              value={phone}
              onChangeText={(value) => {
                setPhone(value);
                setChallenge(null);
                setCode('');
                setError('');
              }}
              disabled={!!busy}
              maxLength={32}
              keyboardType="phone-pad"
              autoComplete="tel"
              autoCapitalize="none"
              textAlign="left"
            />
            <Button
              label={t(busy === 'send' ? 'auth.sending' : 'auth.request')}
              loading={busy === 'send'}
              disabled={!!busy || resendSeconds > 0}
              onPress={() => void submit('send')}
            />
            {resendSeconds > 0 && <Text>{t('auth.resendWait', { time: resendSeconds })}</Text>}
            {challenge && (
              <>
                <Text>{t('auth.requested')}</Text>
                <Input
                  label={t('auth.code')}
                  value={code}
                  onChangeText={(value) =>
                    setCode(
                      value.replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) =>
                        String(digit.charCodeAt(0) - (digit >= '\u06f0' ? 0x06f0 : 0x0660)),
                      ),
                    )
                  }
                  disabled={!!busy}
                  maxLength={6}
                  keyboardType="number-pad"
                  autoComplete="sms-otp"
                  textAlign="left"
                />
                {Date.parse(challenge.expiresAtUtc) <= now && <Text>{t('auth.expired')}</Text>}
                <Button
                  label={t(busy === 'verify' ? 'auth.verifying' : 'auth.verify')}
                  loading={busy === 'verify'}
                  disabled={!!busy || now < retryAt || Date.parse(challenge.expiresAtUtc) <= now}
                  onPress={() => void submit('verify')}
                />
              </>
            )}
          </>
        )}
        {!!error && <FeedbackModal message={error} onDismiss={() => setError('')} />}
      </View>
    </Screen>
  );
}

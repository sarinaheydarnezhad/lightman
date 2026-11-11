import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { syncEngine } from '@/core/composition/sync';
import { CloudError } from '@/core/sync/cloud-client';
import {
  isValidRegistrationPassword,
  normalizeLocalPhoneNumber,
  type OtpChallenge,
} from '@/core/sync/phone-auth';
import { useLocalization } from '@/shared/localization/localization-provider';
import type { MessageKey } from '@/shared/localization/messages';
import { FeedbackModal } from '@/shared/ui/feedback-modal';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { Text } from '@/shared/ui/text';

type Mode = 'login' | 'register' | 'reset';
type Step = 'phone' | 'code' | 'password' | 'name';
type Action = 'login' | 'send' | 'verify' | 'complete';

function errorKey(error: unknown): MessageKey {
  if (error instanceof Error && error.message === 'invalid_phone') return 'auth.invalidPhone';
  if (error instanceof CloudError) {
    if (error.status === 429) return 'auth.rateLimit';
    switch (error.code) {
      case 'invalid_phone':
        return 'auth.invalidPhone';
      case 'invalid_password':
        return 'auth.invalidPassword';
      case 'password_mismatch':
        return 'auth.passwordMismatch';
      case 'invalid_credentials':
        return 'auth.credentials';
      case 'invalid_username':
        return 'auth.invalidUsername';
      case 'duplicate_phone':
        return 'auth.duplicate';
      case 'invalid_otp':
        return 'auth.invalidOtp';
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
  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [name, setName] = useState('');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [proof, setProof] = useState<string | null>(null);
  const [proofExpiry, setProofExpiry] = useState(0);
  const [busy, setBusy] = useState<Action | null>(null);
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
    if (!challenge && !proofExpiry && !retryAt && !resendAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [challenge, proofExpiry, retryAt, resendAt]);

  function reset(nextMode: Mode) {
    if (inFlight.current) return;
    setMode(nextMode);
    setStep('phone');
    setChallenge(null);
    setProof(null);
    setProofExpiry(0);
    setCode('');
    setPassword('');
    setConfirmation('');
    setName('');
    setError('');
  }

  function passwordValid(): boolean {
    if (!isValidRegistrationPassword(password)) {
      setError(t('auth.invalidPassword'));
      return false;
    }
    if (password !== confirmation) {
      setError(t('auth.passwordMismatch'));
      return false;
    }
    return true;
  }

  function nextPassword() {
    if (busy || !passwordValid()) return;
    setError('');
    setStep('name');
  }

  async function submit(action: Action) {
    if (inFlight.current || !syncEngine?.available || (action === 'send' && resendSeconds > 0))
      return;
    inFlight.current = true;
    setBusy(action);
    setError('');
    try {
      const phoneNumber = normalizeLocalPhoneNumber(phone);
      if (action === 'send') {
        const requested = await syncEngine.requestOtp(
          phoneNumber,
          mode === 'reset' ? 'reset' : 'register',
        );
        if (mounted.current) {
          setChallenge(requested);
          setCode('');
          setProof(null);
          setProofExpiry(0);
          setResendAt(Date.parse(requested.resendAtUtc));
          setNow(Date.now());
          setStep('code');
        }
        return;
      }
      if (action === 'verify') {
        if (!challenge || !/^[0-9]{6}$/.test(code)) {
          setError(t('auth.invalidCode'));
          return;
        }
        if (Date.parse(challenge.expiresAtUtc) <= Date.now()) {
          setError(t('auth.expired'));
          return;
        }
        const result = await syncEngine.verifyRegistrationOtp(challenge.challengeId, code);
        const token = mode === 'reset' ? result.resetPasswordToken : result.registrationToken;
        if (!token || !result.expiresAtUtc || result.tokens != null)
          throw new Error('Invalid verification response.');
        if (mounted.current) {
          setProof(token);
          setProofExpiry(Date.parse(result.expiresAtUtc));
          setCode('');
          setPassword('');
          setConfirmation('');
          setStep('password');
          setNow(Date.now());
        }
        return;
      }
      if (action === 'login') {
        if (!password) {
          setError(t('auth.passwordRequired'));
          return;
        }
        await syncEngine.signInPhone(phoneNumber, password);
      } else {
        if (!proof || proofExpiry <= Date.now()) {
          setError(t('auth.expired'));
          return;
        }
        if (!passwordValid()) return;
        if (mode === 'reset') {
          await syncEngine.resetPhonePassword({
            phoneNumber,
            resetToken: proof,
            password,
            confirmPassword: confirmation,
          });
        } else {
          if (!name.trim() || name.trim().length > 120) {
            setError(t('auth.invalidUsername'));
            return;
          }
          await syncEngine.registerPhone({
            phoneNumber,
            registrationToken: proof,
            password,
            confirmPassword: confirmation,
            username: name.trim(),
          });
        }
      }
      if (mounted.current) {
        setPassword('');
        setConfirmation('');
        setCode('');
        setProof(null);
        setChallenge(null);
        setSuccess(true);
      }
    } catch (failure) {
      if (mounted.current) {
        setError(t(errorKey(failure)));
        if (failure instanceof CloudError && failure.status === 429) {
          setRetryAt(Date.now() + (failure.retryAfterMs ?? 60000));
          setNow(Date.now());
        }
        if (
          action === 'complete' &&
          failure instanceof CloudError &&
          failure.code === 'invalid_otp'
        ) {
          setProof(null);
          setProofExpiry(0);
          setChallenge(null);
          setPassword('');
          setConfirmation('');
          setStep('phone');
        }
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  const expiredProof = !!proofExpiry && proofExpiry <= now;
  return (
    <Screen scroll keyboardAware>
      <View className="gap-lg">
        <ScreenHeader title={t(mode === 'reset' ? 'auth.forgotPassword' : 'auth.title')} />
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
            <View className="gap-sm">
              <Button
                label={t('auth.passwordLogin')}
                variant="secondary"
                disabled={!!busy}
                accessibilityState={{ selected: mode === 'login' }}
                onPress={() => reset('login')}
              />
              <Button
                label={t('auth.register')}
                variant="secondary"
                disabled={!!busy}
                accessibilityState={{ selected: mode === 'register' }}
                onPress={() => reset('register')}
              />
            </View>
            {(mode === 'login' || step === 'phone' || step === 'code') && (
              <Input
                label={t('auth.phone')}
                helperText={t('auth.phoneHint')}
                placeholder="09121234567"
                value={phone}
                onChangeText={(value) => {
                  setPhone(value);
                  setChallenge(null);
                  setProof(null);
                  setProofExpiry(0);
                  setCode('');
                  if (mode !== 'login') setStep('phone');
                  setError('');
                }}
                disabled={!!busy}
                maxLength={32}
                keyboardType="phone-pad"
                autoComplete="tel"
                autoCapitalize="none"
                textAlign="left"
              />
            )}
            {mode !== 'login' && (step === 'phone' || step === 'code') && (
              <>
                <Text>{t(mode === 'reset' ? 'auth.resetHint' : 'auth.signupHint')}</Text>
                <Button
                  label={t(busy === 'send' ? 'auth.sending' : 'auth.request')}
                  loading={busy === 'send'}
                  disabled={!!busy || resendSeconds > 0}
                  onPress={() => void submit('send')}
                />
                {resendSeconds > 0 && <Text>{t('auth.resendWait', { time: resendSeconds })}</Text>}
              </>
            )}
            {mode !== 'login' && step === 'code' && challenge && (
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
            {(mode === 'login' || step === 'password') && (
              <>
                <Input
                  label={t('sync.password')}
                  helperText={mode !== 'login' ? t('auth.passwordHint') : undefined}
                  value={password}
                  onChangeText={setPassword}
                  disabled={!!busy}
                  secureTextEntry
                  maxLength={128}
                  autoCapitalize="none"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                {mode !== 'login' && (
                  <Input
                    label={t('auth.confirmPassword')}
                    value={confirmation}
                    onChangeText={setConfirmation}
                    disabled={!!busy}
                    secureTextEntry
                    maxLength={128}
                    autoCapitalize="none"
                    autoComplete="new-password"
                  />
                )}
                <Button
                  label={t(
                    mode === 'login'
                      ? 'sync.signIn'
                      : mode === 'reset'
                        ? 'auth.resetPassword'
                        : 'auth.next',
                  )}
                  loading={busy === 'login' || busy === 'complete'}
                  disabled={!!busy || now < retryAt || expiredProof}
                  onPress={() =>
                    mode === 'register'
                      ? nextPassword()
                      : void submit(mode === 'login' ? 'login' : 'complete')
                  }
                />
                {mode === 'login' && (
                  <Button
                    label={t('auth.forgotPassword')}
                    variant="secondary"
                    disabled={!!busy}
                    onPress={() => reset('reset')}
                  />
                )}
              </>
            )}
            {mode === 'register' && step === 'name' && (
              <>
                <Input
                  label={t('auth.name')}
                  value={name}
                  onChangeText={setName}
                  disabled={!!busy}
                  maxLength={120}
                  autoComplete="name"
                  autoCapitalize="words"
                />
                <Button
                  label={t('auth.complete')}
                  loading={busy === 'complete'}
                  disabled={!!busy || expiredProof || now < retryAt}
                  onPress={() => void submit('complete')}
                />
                <Button
                  label={t('auth.editPassword')}
                  variant="secondary"
                  disabled={!!busy}
                  onPress={() => setStep('password')}
                />
              </>
            )}
            {mode !== 'login' && (step === 'password' || step === 'name') && (
              <>
                {expiredProof && <Text>{t('auth.expired')}</Text>}
                <Button
                  label={t('auth.changePhone')}
                  variant="secondary"
                  disabled={!!busy}
                  onPress={() => reset(mode)}
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

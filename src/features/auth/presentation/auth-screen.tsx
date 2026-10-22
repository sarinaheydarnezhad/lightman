import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { syncEngine } from '@/core/composition/sync';
import { CloudError } from '@/core/sync/cloud-client';
import { GoogleSignInError, requestGoogleIdToken } from '@/core/sync/google-sign-in';
import {
  normalizeLocalPhoneNumber,
  type OtpChallenge,
  type OtpVerification,
} from '@/core/sync/phone-auth';
import { useLocalization } from '@/shared/localization/localization-provider';
import type { MessageKey } from '@/shared/localization/messages';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { Text } from '@/shared/ui/text';

type Mode = 'password' | 'register' | 'email';
type Step = 'phone' | 'otp' | 'details' | 'success';

function errorKey(error: unknown): MessageKey {
  if (error instanceof Error && error.message === 'invalid_phone') return 'auth.invalidPhone';
  if (error instanceof GoogleSignInError) {
    if (error.code === 'google_unavailable') return 'auth.googleUnavailable';
    if (error.code === 'google_play_services') return 'auth.googlePlayServices';
    return 'auth.googleFailed';
  }
  if (error instanceof CloudError) {
    switch (error.code) {
      case 'google_unavailable':
        return 'auth.googleUnavailable';
      case 'invalid_google_token':
        return 'auth.googleFailed';
      case 'google_account_conflict':
        return 'auth.googleConflict';
      case 'invalid_phone':
        return 'auth.invalidPhone';
      case 'invalid_otp':
        return 'auth.invalidOtp';
      case 'invalid_credentials':
        return 'auth.credentials';
      case 'duplicate_phone':
        return 'auth.duplicate';
      case 'sms_unavailable':
        return 'auth.smsUnavailable';
      case 'network_error':
        return 'auth.network';
    }
    if (error.status === 429) return 'auth.rateLimit';
    if (error.status === 401) return 'auth.sessionExpired';
  }
  return 'auth.unexpected';
}

export function AuthScreen() {
  const { t, number } = useLocalization();
  const [mode, setMode] = useState<Mode>('password');
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [verification, setVerification] = useState<OtpVerification | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const mounted = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);

  function reset(nextMode: Mode) {
    setMode(nextMode);
    setStep('phone');
    setPassword('');
    setConfirmPassword('');
    setCode('');
    setChallenge(null);
    setVerification(null);
    setError('');
  }

  async function perform(action: () => Promise<void>) {
    if (inFlight.current || !syncEngine?.available) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      if (mounted.current) setError(t(errorKey(failure)));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function signedIn() {
    if (!mounted.current) return;
    setPassword('');
    setConfirmPassword('');
    setCode('');
    setVerification(null);
    setChallenge(null);
    setStep('success');
  }

  async function requestCode() {
    const phoneNumber = normalizeLocalPhoneNumber(phone);
    const result = await syncEngine!.requestOtp(phoneNumber, 'register');
    if (!mounted.current) return;
    setPhone(phoneNumber);
    setChallenge(result);
    setCode('');
    setVerification(null);
    setNow(Date.now());
    setStep('otp');
  }

  async function verifyCode() {
    if (!challenge || Date.parse(challenge.expiresAtUtc) <= Date.now()) {
      setError(t('auth.expired'));
      return;
    }
    const normalizedCode = code.replace(/[۰-۹٠-٩]/g, (digit) =>
      String(digit.charCodeAt(0) - (digit >= '۰' ? 0x06f0 : 0x0660)),
    );
    if (!/^\d{6}$/.test(normalizedCode)) {
      setError(t('auth.invalidCode'));
      return;
    }
    const result = await syncEngine!.verifyRegistrationOtp(challenge.challengeId, normalizedCode);
    if (!mounted.current) return;
    setVerification(result);
    setCode('');
    setStep('details');
  }

  async function register() {
    if (
      !verification?.registrationToken ||
      !verification.expiresAtUtc ||
      Date.parse(verification.expiresAtUtc) <= Date.now()
    ) {
      setError(t('auth.expired'));
      return;
    }
    if (password.length < 12 || password.length > 128) {
      setError(t('auth.invalidPassword'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (!username.trim() || username.trim().length > 120) {
      setError(t('auth.invalidUsername'));
      return;
    }
    await syncEngine!.registerPhone({
      phoneNumber: phone,
      registrationToken: verification.registrationToken,
      password,
      confirmPassword,
      username: username.trim(),
    });
    signedIn();
  }

  async function passwordLogin() {
    if (mode === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError(t('auth.invalidEmail'));
        return;
      }
      if (!password) {
        setError(t('auth.passwordRequired'));
        return;
      }
      await syncEngine!.signIn(email.trim(), password);
      signedIn();
      return;
    }
    const phoneNumber = normalizeLocalPhoneNumber(phone);
    if (!password) {
      setError(t('auth.passwordRequired'));
      return;
    }
    await syncEngine!.signInPhone(phoneNumber, password);
    signedIn();
  }

  async function googleLogin() {
    const idToken = await requestGoogleIdToken();
    if (!idToken || !mounted.current) return;
    await syncEngine!.signInGoogle(idToken);
    signedIn();
  }

  const resendSeconds = challenge
    ? Math.max(0, Math.ceil((Date.parse(challenge.resendAtUtc) - now) / 1000))
    : 0;
  const passwordMode = mode === 'password' || mode === 'email';
  const expiresSeconds = challenge
    ? Math.max(0, Math.ceil((Date.parse(challenge.expiresAtUtc) - now) / 1000))
    : 0;

  function countdown(seconds: number): string {
    const minutes = number(Math.floor(seconds / 60)).padStart(2, number(0));
    const remainingSeconds = number(seconds % 60).padStart(2, number(0));
    return `${minutes}:${remainingSeconds}`;
  }

  return (
    <Screen scroll keyboardAware>
      <View className="gap-lg">
        <ScreenHeader title={t('auth.title')} />
        {!syncEngine?.available ? (
          <Text>{t('sync.unavailable')}</Text>
        ) : (
          <>
            {step === 'phone' && (
              <>
                <View className="gap-sm">
                  <Button
                    label={t('auth.googleContinue')}
                    variant="secondary"
                    disabled={busy}
                    onPress={() => void perform(googleLogin)}
                  />
                  <Button
                    label={t('auth.passwordLogin')}
                    variant="secondary"
                    disabled={busy}
                    accessibilityState={{ selected: mode === 'password' }}
                    onPress={() => reset('password')}
                  />
                  <Button
                    label={t('auth.register')}
                    variant="secondary"
                    disabled={busy}
                    accessibilityState={{ selected: mode === 'register' }}
                    onPress={() => reset('register')}
                  />
                  <Button
                    label={t('auth.emailLogin')}
                    variant="ghost"
                    disabled={busy}
                    accessibilityState={{ selected: mode === 'email' }}
                    onPress={() => reset('email')}
                  />
                </View>
                {mode === 'email' ? (
                  <Input
                    label={t('sync.email')}
                    value={email}
                    onChangeText={setEmail}
                    disabled={busy}
                    maxLength={256}
                    keyboardType="email-address"
                    autoComplete="email"
                    autoCapitalize="none"
                  />
                ) : (
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
                )}
                {passwordMode && (
                  <Input
                    label={t('sync.password')}
                    value={password}
                    onChangeText={setPassword}
                    disabled={busy}
                    maxLength={128}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="current-password"
                  />
                )}
                <Button
                  label={t(passwordMode ? 'sync.signIn' : 'auth.request')}
                  loading={busy}
                  onPress={() => void perform(passwordMode ? passwordLogin : requestCode)}
                />
              </>
            )}
            {step === 'otp' && (
              <>
                <Text accessibilityLiveRegion="polite">{t('auth.requested')}</Text>
                <Text>{phone}</Text>
                <Text tone={expiresSeconds ? 'secondary' : 'error'}>
                  {expiresSeconds
                    ? t('auth.codeExpiry', { time: countdown(expiresSeconds) })
                    : t('auth.expired')}
                </Text>
                <Input
                  label={t('auth.code')}
                  value={code}
                  onChangeText={setCode}
                  disabled={busy}
                  maxLength={6}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textAlign="left"
                />
                <Button
                  label={t('auth.verify')}
                  loading={busy}
                  disabled={!expiresSeconds}
                  onPress={() => void perform(verifyCode)}
                />
                {!!resendSeconds && (
                  <Text>{t('auth.resendWait', { time: countdown(resendSeconds) })}</Text>
                )}
                <Button
                  label={t('auth.resend')}
                  variant="secondary"
                  disabled={busy || !!resendSeconds}
                  onPress={() => void perform(requestCode)}
                />
                <Button
                  label={t('auth.changePhone')}
                  variant="ghost"
                  disabled={busy}
                  onPress={() => reset(mode)}
                />
              </>
            )}
            {step === 'details' && (
              <>
                <Text accessibilityLiveRegion="polite">{t('auth.verified')}</Text>
                <Input
                  label={t('auth.username')}
                  value={username}
                  onChangeText={setUsername}
                  disabled={busy}
                  maxLength={120}
                  autoComplete="username-new"
                />
                <Input
                  label={t('sync.password')}
                  helperText={t('auth.passwordHint')}
                  value={password}
                  onChangeText={setPassword}
                  disabled={busy}
                  maxLength={128}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                />
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
                <Button
                  label={t('auth.complete')}
                  loading={busy}
                  onPress={() => void perform(register)}
                />
                <Button
                  label={t('auth.changePhone')}
                  variant="ghost"
                  disabled={busy}
                  onPress={() => reset(mode)}
                />
              </>
            )}
            {step === 'success' && (
              <>
                <Text accessibilityLiveRegion="polite">{t('auth.success')}</Text>
                <Button label={t('auth.done')} onPress={() => router.replace('/settings/cloud')} />
              </>
            )}
          </>
        )}
        {!!error && (
          <Text tone="error" accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
      </View>
    </Screen>
  );
}

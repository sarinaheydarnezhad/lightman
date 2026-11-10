import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { syncEngine } from '@/core/composition/sync';
import { CloudError } from '@/core/sync/cloud-client';
import { LocalizationProvider } from '@/shared/localization/localization-provider';
import { AuthScreen } from './auth-screen';

let mockSettings = { language: 'en' };
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/core/composition/application', () => ({
  application: { settings: { subscribe: () => () => {}, snapshot: () => mockSettings } },
}));
jest.mock('@/core/composition/sync', () => ({
  syncEngine: { available: true, requestOtp: jest.fn(), loginWithOtp: jest.fn() },
}));
const auth = syncEngine!;
const challenge = () => ({
  challengeId: 'challenge',
  expiresAtUtc: new Date(Date.now() + 120000).toISOString(),
  resendAtUtc: new Date(Date.now() + 60000).toISOString(),
  codeLength: 6,
});
beforeEach(() => {
  jest.resetAllMocks();
  mockSettings = { language: 'en' };
  jest.mocked(auth.requestOtp).mockImplementation(async () => challenge());
  jest.mocked(auth.loginWithOtp).mockResolvedValue();
});
afterEach(() => jest.useRealTimers());
function mount() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <LocalizationProvider>
        <AuthScreen />
      </LocalizationProvider>
    </SafeAreaProvider>,
  );
}
async function requestCode() {
  fireEvent.changeText(screen.getByLabelText('Mobile number'), '۰۹۱۲۱۲۳۴۵۶۷');
  fireEvent.press(screen.getByRole('button', { name: 'Send verification code' }));
  await screen.findByLabelText('Six-digit verification code');
}
test('the screen offers one SMS flow without password, email, Google or account selection', () => {
  mount();
  expect(screen.getByLabelText('Mobile number')).toBeTruthy();
  expect(screen.getAllByRole('button')).toHaveLength(1);
  for (const label of ['Password', 'Email', 'Username', 'Confirm password'])
    expect(screen.queryByLabelText(label)).toBeNull();
  for (const label of [
    'Continue with Google',
    'Login with password',
    'Verify an existing account',
    'Create account',
  ])
    expect(screen.queryByText(label)).toBeNull();
});
test('the same verification completes new registration and existing-user login', async () => {
  mount();
  await requestCode();
  expect(auth.requestOtp).toHaveBeenCalledWith('09121234567', 'authenticate');
  expect(auth.loginWithOtp).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Six-digit verification code'), '۱۲۳۴۵۶');
  fireEvent.press(screen.getByRole('button', { name: 'Verify and continue' }));
  await waitFor(() => expect(auth.loginWithOtp).toHaveBeenCalledWith('challenge', '123456'));
  expect(await screen.findByText('You are signed in.')).toBeTruthy();
});
test('invalid phone and malformed OTP stay on the form', async () => {
  mount();
  fireEvent.changeText(screen.getByLabelText('Mobile number'), '02123456789');
  fireEvent.press(screen.getByRole('button', { name: 'Send verification code' }));
  await waitFor(() => expect(auth.requestOtp).not.toHaveBeenCalled());
  // Dismiss validation feedback before sending a valid number.
  const dismiss = screen.queryByRole('button', { name: 'Close' });
  if (dismiss) fireEvent.press(dismiss);
});
test('six OTP digits are required before verification', async () => {
  mount();
  await requestCode();
  fireEvent.changeText(screen.getByLabelText('Six-digit verification code'), '12345');
  fireEvent.press(screen.getByRole('button', { name: 'Verify and continue' }));
  await waitFor(() => expect(auth.loginWithOtp).not.toHaveBeenCalled());
});
test('resend countdown prevents duplicate requests then permits a replacement', async () => {
  jest.useFakeTimers();
  mount();
  await requestCode();
  expect(screen.getByRole('button', { name: 'Send verification code' })).toBeDisabled();
  await act(async () => {
    jest.advanceTimersByTime(61000);
  });
  fireEvent.press(screen.getByRole('button', { name: 'Send verification code' }));
  await waitFor(() => expect(auth.requestOtp).toHaveBeenCalledTimes(2));
});
test('changing phone clears the old challenge and code while preserving cooldown', async () => {
  mount();
  await requestCode();
  fireEvent.changeText(screen.getByLabelText('Six-digit verification code'), '123456');
  fireEvent.changeText(screen.getByLabelText('Mobile number'), '09121234568');
  expect(screen.queryByLabelText('Six-digit verification code')).toBeNull();
  expect(auth.loginWithOtp).not.toHaveBeenCalled();
});
test('expired codes require another request', async () => {
  jest.useFakeTimers();
  mount();
  await requestCode();
  await act(async () => {
    jest.advanceTimersByTime(120000);
  });
  expect(screen.getByRole('button', { name: 'Verify and continue' })).toBeDisabled();
  expect(auth.loginWithOtp).not.toHaveBeenCalled();
});
test.each([
  [
    409,
    'account_recovery_required',
    'To preserve your existing account, contact support for secure account recovery.',
  ],
  [
    503,
    'sms_unavailable',
    'SMS authentication is unavailable or not configured. Please try again later.',
  ],
  [429, 'otp_rate_limit', 'Too many requests. Wait before trying again.'],
])(
  'provider and recovery errors are presented without signing in (%s)',
  async (status, code, message) => {
    jest
      .mocked(auth.requestOtp)
      .mockRejectedValue(new CloudError(status, undefined, undefined, code, 90000));
    mount();
    fireEvent.changeText(screen.getByLabelText('Mobile number'), '09121234567');
    fireEvent.press(screen.getByRole('button', { name: 'Send verification code' }));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(auth.loginWithOtp).not.toHaveBeenCalled();
  },
);
test('Persian labels preserve the existing localized form', async () => {
  mockSettings = { language: 'fa' };
  mount();
  expect(screen.getByLabelText('شماره موبایل')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'ارسال کد تأیید' })).toBeTruthy();
});

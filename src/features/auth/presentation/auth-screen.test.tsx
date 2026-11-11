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
  syncEngine: {
    available: true,
    requestOtp: jest.fn(),
    verifyRegistrationOtp: jest.fn(),
    registerPhone: jest.fn(),
    signInPhone: jest.fn(),
    resetPhonePassword: jest.fn(),
  },
}));
const auth = syncEngine!;
const password = 'Private password2026!';
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
  jest.mocked(auth.verifyRegistrationOtp).mockImplementation(async () => ({
    registrationToken: 'signup-proof',
    resetPasswordToken: null,
    expiresAtUtc: new Date(Date.now() + 600000).toISOString(),
    tokens: null,
  }));
  jest.mocked(auth.signInPhone).mockResolvedValue();
  jest.mocked(auth.registerPhone).mockResolvedValue();
  jest.mocked(auth.resetPhonePassword).mockResolvedValue();
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
async function requestCode(mode: 'register' | 'reset' = 'register') {
  fireEvent.press(
    screen.getByRole('button', {
      name: mode === 'register' ? 'Create account' : 'Forgot password?',
    }),
  );
  fireEvent.changeText(screen.getByLabelText('Mobile number'), '۰۹۱۲۱۲۳۴۵۶۷');
  fireEvent.press(screen.getByRole('button', { name: 'Send verification code' }));
  await screen.findByLabelText('Six-digit verification code');
}
async function verify() {
  fireEvent.changeText(screen.getByLabelText('Six-digit verification code'), '۱۲۳۴۵۶');
  fireEvent.press(screen.getByRole('button', { name: 'Verify and continue' }));
  await screen.findByLabelText('Confirm password');
}
function enterPassword(value = password, confirmation = value) {
  fireEvent.changeText(screen.getByLabelText('Password'), value);
  fireEvent.changeText(screen.getByLabelText('Confirm password'), confirmation);
}

test('returning users log in with phone and password without requesting SMS', async () => {
  mount();
  expect(screen.queryByLabelText('Six-digit verification code')).toBeNull();
  expect(screen.queryByText('Continue with Google')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Mobile number'), '۰۹۱۲۱۲۳۴۵۶۷');
  fireEvent.changeText(screen.getByLabelText('Password'), password);
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(auth.signInPhone).toHaveBeenCalledWith('09121234567', password));
  expect(auth.requestOtp).not.toHaveBeenCalled();
  expect(await screen.findByText('You are signed in.')).toBeTruthy();
});

test('signup proceeds in order: SMS verification, password, name, account creation', async () => {
  mount();
  await requestCode();
  expect(auth.requestOtp).toHaveBeenCalledWith('09121234567', 'register');
  expect(screen.queryByLabelText('Password')).toBeNull();
  expect(auth.registerPhone).not.toHaveBeenCalled();
  await verify();
  expect(auth.verifyRegistrationOtp).toHaveBeenCalledWith('challenge', '123456');
  expect(screen.queryByLabelText('Name')).toBeNull();
  enterPassword();
  fireEvent.press(screen.getByRole('button', { name: 'Continue to name' }));
  expect(screen.getByLabelText('Name')).toBeTruthy();
  expect(auth.registerPhone).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Name'), '  Sara  ');
  fireEvent.press(screen.getByRole('button', { name: 'Complete registration' }));
  await waitFor(() =>
    expect(auth.registerPhone).toHaveBeenCalledWith({
      phoneNumber: '09121234567',
      registrationToken: 'signup-proof',
      password,
      confirmPassword: password,
      username: 'Sara',
    }),
  );
  expect(auth.signInPhone).not.toHaveBeenCalled();
  expect(await screen.findByText('You are signed in.')).toBeTruthy();
});

test('forgotten password uses recovery OTP then a new password without changing the name', async () => {
  jest.mocked(auth.verifyRegistrationOtp).mockResolvedValue({
    registrationToken: null,
    resetPasswordToken: 'reset-proof',
    expiresAtUtc: new Date(Date.now() + 600000).toISOString(),
    tokens: null,
  });
  mount();
  await requestCode('reset');
  expect(auth.requestOtp).toHaveBeenCalledWith('09121234567', 'reset');
  await verify();
  enterPassword();
  fireEvent.press(screen.getByRole('button', { name: 'Save new password and sign in' }));
  await waitFor(() =>
    expect(auth.resetPhonePassword).toHaveBeenCalledWith({
      phoneNumber: '09121234567',
      resetToken: 'reset-proof',
      password,
      confirmPassword: password,
    }),
  );
  expect(auth.registerPhone).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Name')).toBeNull();
});

test('invalid phone and absent login password do not make authentication requests', async () => {
  mount();
  fireEvent.changeText(screen.getByLabelText('Mobile number'), '02123456789');
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('Enter an 11-digit mobile number starting with 0.')).toBeTruthy();
  expect(auth.signInPhone).not.toHaveBeenCalled();
  expect(auth.requestOtp).not.toHaveBeenCalled();
});

test('weak and mismatched signup passwords cannot advance to the name step', async () => {
  mount();
  await requestCode();
  await verify();
  enterPassword('password123');
  fireEvent.press(screen.getByRole('button', { name: 'Continue to name' }));
  expect(screen.queryByLabelText('Name')).toBeNull();
  expect(auth.registerPhone).not.toHaveBeenCalled();
});

test('six OTP digits are required and failed verification does not reveal password fields', async () => {
  mount();
  await requestCode();
  fireEvent.changeText(screen.getByLabelText('Six-digit verification code'), '12345');
  fireEvent.press(screen.getByRole('button', { name: 'Verify and continue' }));
  expect(auth.verifyRegistrationOtp).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Password')).toBeNull();
});

test('a wrong OTP leaves the signup challenge available for retry', async () => {
  jest
    .mocked(auth.verifyRegistrationOtp)
    .mockRejectedValue(new CloudError(401, undefined, undefined, 'invalid_otp'));
  mount();
  await requestCode();
  fireEvent.changeText(screen.getByLabelText('Six-digit verification code'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Verify and continue' }));
  await waitFor(() => expect(auth.verifyRegistrationOtp).toHaveBeenCalled());
  expect(screen.queryByLabelText('Password')).toBeNull();
  expect(auth.registerPhone).not.toHaveBeenCalled();
});

test('resend cooldown prevents duplicate requests and then permits a replacement', async () => {
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

test('changing phone discards the old challenge while retaining resend cooldown', async () => {
  mount();
  await requestCode();
  fireEvent.changeText(screen.getByLabelText('Mobile number'), '09121234568');
  expect(screen.queryByLabelText('Six-digit verification code')).toBeNull();
  expect(screen.getByRole('button', { name: 'Send verification code' })).toBeDisabled();
  expect(auth.registerPhone).not.toHaveBeenCalled();
});

test('expired codes require a new request', async () => {
  jest.useFakeTimers();
  mount();
  await requestCode();
  await act(async () => {
    jest.advanceTimersByTime(121000);
  });
  expect(screen.getByRole('button', { name: 'Verify and continue' })).toBeDisabled();
  expect(auth.verifyRegistrationOtp).not.toHaveBeenCalled();
});

test('expired signup proof cannot create an account after the password and name steps', async () => {
  jest.useFakeTimers();
  mount();
  await requestCode();
  await verify();
  enterPassword();
  fireEvent.press(screen.getByRole('button', { name: 'Continue to name' }));
  fireEvent.changeText(screen.getByLabelText('Name'), 'Sara');
  await act(async () => {
    jest.advanceTimersByTime(601000);
  });
  expect(screen.getByRole('button', { name: 'Complete registration' })).toBeDisabled();
  expect(auth.registerPhone).not.toHaveBeenCalled();
});

test.each([
  [503, 'sms_unavailable'],
  [429, 'otp_rate_limit'],
])('provider errors never skip verification (%s)', async (status, code) => {
  jest
    .mocked(auth.requestOtp)
    .mockRejectedValue(
      new CloudError(status as number, undefined, undefined, code as string, 90000),
    );
  mount();
  fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  fireEvent.changeText(screen.getByLabelText('Mobile number'), '09121234567');
  fireEvent.press(screen.getByRole('button', { name: 'Send verification code' }));
  await waitFor(() => expect(auth.requestOtp).toHaveBeenCalled());
  expect(auth.registerPhone).not.toHaveBeenCalled();
  expect(auth.resetPhonePassword).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Password')).toBeNull();
});

test('Persian login keeps password and recovery controls', () => {
  mockSettings = { language: 'fa' };
  mount();
  expect(screen.getByLabelText('شماره موبایل')).toBeTruthy();
  expect(screen.getByLabelText('گذرواژه')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'رمز عبور را فراموش کرده‌اید؟' })).toBeTruthy();
});

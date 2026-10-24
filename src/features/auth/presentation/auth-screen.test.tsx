import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { syncEngine } from '@/core/composition/sync';
import { CloudError } from '@/core/sync/cloud-client';
import { LocalizationProvider } from '@/shared/localization/localization-provider';
import { AuthScreen } from './auth-screen';

let mockSettings = { language: 'en' };

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/core/composition/application', () => ({
  application: {
    settings: { subscribe: () => () => {}, snapshot: () => mockSettings },
  },
}));
jest.mock('@/core/composition/sync', () => ({
  syncEngine: {
    available: true,
    requestOtp: jest.fn(),
    verifyRegistrationOtp: jest.fn(),
    registerPhone: jest.fn(),
    registerPhoneWithPassword: jest.fn(),
    loginWithOtp: jest.fn(),
    signInPhone: jest.fn(),
    signInGoogle: jest.fn(),
    signIn: jest.fn(),
  },
}));

const auth = syncEngine!;
const phone = '09121234567';
const password = 'Maple7xy';
const invalidPasswordMessage =
  'Use 8–128 characters with letters and numbers, and avoid common passwords.';

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings = { language: 'en' };
  jest.mocked(auth.registerPhoneWithPassword).mockReset().mockResolvedValue();
  jest.mocked(auth.signInPhone).mockReset().mockResolvedValue();
});

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

function registration(value = password, confirmation = value) {
  fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  fireEvent.changeText(screen.getByLabelText('Mobile number'), phone);
  fireEvent.changeText(screen.getByLabelText('Password'), value);
  fireEvent.changeText(screen.getByLabelText('Confirm password'), confirmation);
}

test.each([false, true])(
  'Google, email and OTP options are hidden (registration: %s)',
  (register) => {
    mount();
    if (register) fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText('Mobile number')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Existing email account' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Request code' })).toBeNull();
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(screen.queryByLabelText('Six-digit verification code')).toBeNull();
    expect(screen.queryByLabelText('Username')).toBeNull();
    expect(auth.requestOtp).not.toHaveBeenCalled();
    expect(auth.signInGoogle).not.toHaveBeenCalled();
    expect(auth.signIn).not.toHaveBeenCalled();
  },
);

test('registration accepts matching eight-character passwords without OTP or a username', async () => {
  mount();
  registration();
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  expect(screen.getByLabelText('Confirm password').props.secureTextEntry).toBe(true);
  fireEvent.press(screen.getByRole('button', { name: 'Complete registration' }));
  await screen.findByText('You are signed in.');
  expect(auth.registerPhoneWithPassword).toHaveBeenCalledWith({
    phoneNumber: phone,
    password,
    confirmPassword: password,
  });
  expect(auth.requestOtp).not.toHaveBeenCalled();
  expect(auth.verifyRegistrationOtp).not.toHaveBeenCalled();
  expect(auth.registerPhone).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Continue to cloud sync' }));
  expect(router.replace).toHaveBeenCalledWith('/settings/cloud');
});

test.each(['', 'Maple7x', '12345678', 'onlyletters', 'Password123!', 'a1'.repeat(65)])(
  'weak registration password is rejected: %s',
  async (value) => {
    mount();
    registration(value);
    fireEvent.press(screen.getByRole('button', { name: 'Complete registration' }));
    await screen.findByText(invalidPasswordMessage);
    expect(auth.registerPhoneWithPassword).not.toHaveBeenCalled();
  },
);

test.each(['', 'Different7xy'])(
  'missing or mismatched password confirmation is rejected: %s',
  async (confirmation) => {
    mount();
    registration(password, confirmation);
    fireEvent.press(screen.getByRole('button', { name: 'Complete registration' }));
    await screen.findByText('The passwords do not match.');
    expect(auth.registerPhoneWithPassword).not.toHaveBeenCalled();
  },
);

test('phone login uses one password and preserves access for existing passwords', async () => {
  mount();
  expect(screen.queryByLabelText('Confirm password')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Mobile number'), '۰۹۱۲۱۲۳۴۵۶۷');
  fireEvent.changeText(screen.getByLabelText('Password'), 'private-password');
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByText('You are signed in.');
  expect(auth.signInPhone).toHaveBeenCalledWith(phone, 'private-password');
  expect(auth.requestOtp).not.toHaveBeenCalled();
  expect(auth.loginWithOtp).not.toHaveBeenCalled();
});

test('a missing login password is rejected locally', async () => {
  mount();
  fireEvent.changeText(screen.getByLabelText('Mobile number'), phone);
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByText('Enter your password.');
  expect(auth.signInPhone).not.toHaveBeenCalled();
});

test.each([false, true])(
  'invalid phone is rejected before authentication (registration: %s)',
  async (register) => {
    mount();
    if (register) registration();
    fireEvent.changeText(screen.getByLabelText('Mobile number'), '0912123456');
    fireEvent.press(
      screen.getByRole('button', { name: register ? 'Complete registration' : 'Sign in' }),
    );
    await screen.findByText('Enter an 11-digit mobile number starting with 0.');
    expect(auth.registerPhoneWithPassword).not.toHaveBeenCalled();
    expect(auth.signInPhone).not.toHaveBeenCalled();
  },
);

test('switching modes clears both password fields and validation errors', async () => {
  mount();
  registration('short');
  fireEvent.press(screen.getByRole('button', { name: 'Complete registration' }));
  await screen.findByText(invalidPasswordMessage);
  fireEvent.press(screen.getByRole('button', { name: 'Login with password' }));
  expect(screen.getByLabelText('Password').props.value).toBe('');
  expect(screen.queryByText(invalidPasswordMessage)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByLabelText('Password').props.value).toBe('');
  expect(screen.getByLabelText('Confirm password').props.value).toBe('');
});

test.each([
  [400, 'invalid_password', invalidPasswordMessage],
  [400, 'password_mismatch', 'The passwords do not match.'],
  [409, 'duplicate_phone', 'This mobile number already has an account. Please sign in.'],
  [429, undefined, 'Too many requests. Wait before trying again.'],
  [
    0,
    'network_error',
    'Network request failed. Check your connection and try again. If registration was interrupted, try signing in.',
  ],
])(
  'registration error %s/%s is visible and restores enabled controls',
  async (status, code, message) => {
    jest
      .mocked(auth.registerPhoneWithPassword)
      .mockRejectedValueOnce(new CloudError(status, undefined, undefined, code));
    mount();
    registration();
    fireEvent.press(screen.getByRole('button', { name: 'Complete registration' }));
    await screen.findByText(message!);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Complete registration', disabled: false }),
      ).toBeTruthy(),
    );
    expect(screen.queryByText('You are signed in.')).toBeNull();
  },
);

test('pending signup blocks duplicate submissions and mode changes', async () => {
  let finish!: () => void;
  jest.mocked(auth.registerPhoneWithPassword).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  mount();
  registration();
  const submit = screen.getByRole('button', { name: 'Complete registration' });
  fireEvent.press(submit);
  fireEvent.press(submit);
  expect(auth.registerPhoneWithPassword).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Mobile number').props.editable).toBe(false);
  expect(screen.getByLabelText('Password').props.editable).toBe(false);
  expect(screen.getByLabelText('Confirm password').props.editable).toBe(false);
  expect(screen.getByRole('button', { name: 'Login with password', disabled: true })).toBeTruthy();
  await act(async () => finish());
  await screen.findByText('You are signed in.');
});

test('a late signup response after unmount does not navigate', async () => {
  let finish!: () => void;
  jest.mocked(auth.registerPhoneWithPassword).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = mount();
  registration();
  fireEvent.press(screen.getByRole('button', { name: 'Complete registration' }));
  view.unmount();
  await act(async () => finish());
  expect(router.replace).not.toHaveBeenCalled();
});

test('Persian registration localizes the password rule and accepts localized phone digits', async () => {
  mockSettings = { language: 'fa' };
  mount();
  fireEvent.press(screen.getByRole('button', { name: 'ساخت حساب' }));
  fireEvent.changeText(screen.getByLabelText('شماره موبایل'), '۰۹۱۲۱۲۳۴۵۶۷');
  expect(
    screen.getByText('از ۸ تا ۱۲۸ نویسه شامل حروف و عدد استفاده کنید. رمز رایج انتخاب نکنید.'),
  ).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('گذرواژه'), 'درختسبز۷');
  fireEvent.changeText(screen.getByLabelText('تکرار رمز عبور'), 'درختسبز۷');
  fireEvent.press(screen.getByRole('button', { name: 'تکمیل ثبت‌نام' }));
  await screen.findByText('وارد حساب شدید.');
  expect(auth.registerPhoneWithPassword).toHaveBeenCalledWith({
    phoneNumber: phone,
    password: 'درختسبز۷',
    confirmPassword: 'درختسبز۷',
  });
});

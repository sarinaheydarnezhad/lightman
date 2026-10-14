import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { syncEngine } from '@/core/composition/sync';
import { CloudError } from '@/core/sync/cloud-client';
import { AuthScreen } from './auth-screen';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/core/composition/application', () => ({ application: {} }));
jest.mock('@/core/composition/sync', () => ({
  syncEngine: {
    available: true,
    requestOtp: jest.fn(),
    verifyRegistrationOtp: jest.fn(),
    registerPhone: jest.fn(),
    loginWithOtp: jest.fn(),
    signInPhone: jest.fn(),
    signIn: jest.fn(),
  },
}));

const auth = syncEngine!;
const phone = '+989121234567';

jest.setTimeout(15_000);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(auth.requestOtp).mockResolvedValue({
    challengeId: 'challenge',
    expiresAtUtc: new Date(Date.now() + 300_000).toISOString(),
    resendAtUtc: new Date(Date.now() + 60_000).toISOString(),
  });
  jest.mocked(auth.verifyRegistrationOtp).mockResolvedValue({
    registrationToken: 'proof',
    expiresAtUtc: new Date(Date.now() + 600_000).toISOString(),
    tokens: null,
  });
  jest.mocked(auth.registerPhone).mockResolvedValue();
  jest.mocked(auth.loginWithOtp).mockResolvedValue();
  jest.mocked(auth.signInPhone).mockResolvedValue();
  jest.mocked(auth.signIn).mockResolvedValue();
});

function mount() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <AuthScreen />
    </SafeAreaProvider>,
  );
}

async function request(mode: 'Create account' | 'Login with OTP') {
  fireEvent.press(screen.getByRole('button', { name: mode }));
  fireEvent.changeText(screen.getByLabelText('Mobile number'), phone);
  fireEvent.press(screen.getByRole('button', { name: 'Request code' }));
  await screen.findByLabelText('Six-digit verification code');
}

test('registration verifies phone before showing password confirmation and username', async () => {
  mount();
  await request('Create account');
  expect(screen.queryByLabelText('Confirm password')).toBeNull();
  expect(screen.getByRole('button', { name: 'Request another code', disabled: true })).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Six-digit verification code'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  await screen.findByLabelText('Confirm password');
  fireEvent.changeText(screen.getByLabelText('Username'), 'Student');
  fireEvent.changeText(screen.getByLabelText('Password'), 'private-password');
  fireEvent.changeText(screen.getByLabelText('Confirm password'), 'private-password');
  fireEvent.press(screen.getByRole('button', { name: 'Complete registration' }));
  await screen.findByText('You are signed in.');
  expect(auth.verifyRegistrationOtp).toHaveBeenCalledWith('challenge', '123456');
  expect(auth.registerPhone).toHaveBeenCalledWith({
    phoneNumber: phone,
    registrationToken: 'proof',
    password: 'private-password',
    confirmPassword: 'private-password',
    username: 'Student',
  });
});

test('OTP login requires no password and shows success', async () => {
  mount();
  await request('Login with OTP');
  expect(screen.queryByLabelText('Password')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Six-digit verification code'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  await screen.findByText('You are signed in.');
  expect(auth.loginWithOtp).toHaveBeenCalledWith('challenge', '123456');
});

test('password login validates phone then submits the password', async () => {
  mount();
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByText('Enter a mobile number with + and its country code.');
  expect(auth.signInPhone).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Mobile number'), phone);
  fireEvent.changeText(screen.getByLabelText('Password'), 'private-password');
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByText('You are signed in.');
  expect(auth.signInPhone).toHaveBeenCalledWith(phone, 'private-password');
});

test('existing email accounts retain access without an implicit account migration', async () => {
  mount();
  fireEvent.press(screen.getByRole('button', { name: 'Existing email account' }));
  fireEvent.changeText(screen.getByLabelText('Email'), 'existing@example.com');
  fireEvent.changeText(screen.getByLabelText('Password'), 'private-password');
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByText('You are signed in.');
  expect(auth.signIn).toHaveBeenCalledWith('existing@example.com', 'private-password');
});

test('mismatched registration passwords prevent an account request', async () => {
  mount();
  await request('Create account');
  fireEvent.changeText(screen.getByLabelText('Six-digit verification code'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
  await screen.findByLabelText('Confirm password');
  fireEvent.changeText(screen.getByLabelText('Password'), 'private-password');
  fireEvent.changeText(screen.getByLabelText('Confirm password'), 'different-password');
  fireEvent.press(screen.getByRole('button', { name: 'Complete registration' }));
  await screen.findByText('The passwords do not match.');
  expect(auth.registerPhone).not.toHaveBeenCalled();
});

test.each([
  [
    401,
    'invalid_otp',
    'Verification is invalid, expired, already used, or has too many attempts. Request another code.',
  ],
  [429, 'otp_rate_limit', 'Too many requests. Wait before trying again.'],
  [
    503,
    'sms_unavailable',
    'SMS authentication is unavailable or not configured. Please try again later.',
  ],
  [
    0,
    'network_error',
    'Network request failed. Check your connection and try again. If verification was interrupted, request a new code.',
  ],
])(
  'authentication error %s is visible and restores enabled controls',
  async (status, code, message) => {
    jest
      .mocked(auth.requestOtp)
      .mockRejectedValueOnce(new CloudError(status, undefined, undefined, code));
    mount();
    fireEvent.press(screen.getByRole('button', { name: 'Login with OTP' }));
    fireEvent.changeText(screen.getByLabelText('Mobile number'), phone);
    fireEvent.press(screen.getByRole('button', { name: 'Request code' }));
    await screen.findByText(message);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Request code', disabled: false })).toBeTruthy(),
    );
  },
);

test('pending requests disable input and duplicate submissions', async () => {
  let finish: (value: Awaited<ReturnType<typeof auth.requestOtp>>) => void = () => {};
  jest.mocked(auth.requestOtp).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  mount();
  fireEvent.press(screen.getByRole('button', { name: 'Login with OTP' }));
  fireEvent.changeText(screen.getByLabelText('Mobile number'), phone);
  fireEvent.press(screen.getByRole('button', { name: 'Request code' }));
  expect(
    screen.getByRole('button', { name: 'Request code', busy: true, disabled: true }),
  ).toBeTruthy();
  expect(screen.getByLabelText('Mobile number').props.editable).toBe(false);
  fireEvent.press(screen.getByRole('button', { name: 'Request code' }));
  expect(auth.requestOtp).toHaveBeenCalledTimes(1);
  finish({
    challengeId: 'challenge',
    expiresAtUtc: new Date(Date.now() + 300_000).toISOString(),
    resendAtUtc: new Date().toISOString(),
  });
  await screen.findByLabelText('Six-digit verification code');
});

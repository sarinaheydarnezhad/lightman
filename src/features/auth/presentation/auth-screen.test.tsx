import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { syncEngine } from '@/core/composition/sync';
import { CloudError } from '@/core/sync/cloud-client';
import { GoogleSignInError, requestGoogleIdToken } from '@/core/sync/google-sign-in';
import { AuthScreen } from './auth-screen';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/core/composition/application', () => ({ application: {} }));
jest.mock('@/core/sync/google-sign-in', () => ({
  ...jest.requireActual('@/core/sync/google-sign-in'),
  requestGoogleIdToken: jest.fn(),
}));
jest.mock('@/core/composition/sync', () => ({
  syncEngine: {
    available: true,
    requestOtp: jest.fn(),
    verifyRegistrationOtp: jest.fn(),
    registerPhone: jest.fn(),
    loginWithOtp: jest.fn(),
    signInPhone: jest.fn(),
    signInGoogle: jest.fn(),
    signIn: jest.fn(),
  },
}));

const auth = syncEngine!;
const phone = '09121234567';

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
  jest.mocked(auth.signInGoogle).mockResolvedValue();
  jest.mocked(requestGoogleIdToken).mockResolvedValue('google-id-token');
});

test.each([false, true])(
  'Google signs in or registers without phone/password/OTP (%s)',
  async (register) => {
    mount();
    if (register) fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    await screen.findByText('You are signed in.');
    expect(auth.signInGoogle).toHaveBeenCalledWith('google-id-token');
    expect(auth.signInPhone).not.toHaveBeenCalled();
    expect(auth.registerPhone).not.toHaveBeenCalled();
    expect(auth.requestOtp).not.toHaveBeenCalled();
  },
);

test('cancelling Google sign-in does not authenticate or display a failure', async () => {
  jest.mocked(requestGoogleIdToken).mockResolvedValueOnce(null);
  mount();
  fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Continue with Google', disabled: false }),
    ).toBeTruthy(),
  );
  expect(auth.signInGoogle).not.toHaveBeenCalled();
  expect(screen.queryByText('You are signed in.')).toBeNull();
  expect(screen.queryByText('Google sign-in could not be completed. Please try again.')).toBeNull();
});

test('Google configuration failures leave phone login available', async () => {
  jest
    .mocked(requestGoogleIdToken)
    .mockRejectedValueOnce(new GoogleSignInError('google_unavailable'));
  mount();
  fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
  await screen.findByText(
    'Google sign-in is not configured or is temporarily unavailable. Use another sign-in option.',
  );
  expect(auth.signInGoogle).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Sign in', disabled: false })).toBeTruthy();
});

test('Google account conflicts are visible without signing in or requesting an OTP', async () => {
  jest
    .mocked(auth.signInGoogle)
    .mockRejectedValueOnce(new CloudError(409, undefined, undefined, 'google_account_conflict'));
  mount();
  fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
  await screen.findByText(
    'This email already belongs to an account. Sign in using its existing method; accounts are not linked automatically.',
  );
  expect(screen.queryByText('You are signed in.')).toBeNull();
  expect(auth.requestOtp).not.toHaveBeenCalled();
});

test('a pending Google chooser blocks duplicate authentication and mode changes', async () => {
  let finish!: (token: string | null) => void;
  jest.mocked(requestGoogleIdToken).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  mount();
  fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
  expect(screen.getByRole('button', { name: 'Login with password', disabled: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Create account', disabled: true })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
  expect(requestGoogleIdToken).toHaveBeenCalledTimes(1);
  finish('google-id-token');
  await screen.findByText('You are signed in.');
  expect(auth.signInGoogle).toHaveBeenCalledTimes(1);
});

test('closing the auth screen during Google sign-in does not start a backend session', async () => {
  let finish!: (token: string | null) => void;
  jest.mocked(requestGoogleIdToken).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = mount();
  fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
  view.unmount();
  await act(async () => {
    finish('google-id-token');
  });
  expect(auth.signInGoogle).not.toHaveBeenCalled();
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

async function request() {
  fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  fireEvent.changeText(screen.getByLabelText('Mobile number'), phone);
  fireEvent.press(screen.getByRole('button', { name: 'Request code' }));
  await screen.findByLabelText('Six-digit verification code');
  expect(auth.requestOtp).toHaveBeenCalledWith(phone, 'register');
  expect(screen.getByText(phone)).toBeTruthy();
}

test('registration countdowns use padded minutes and seconds and retain expiry behavior', async () => {
  jest.useFakeTimers();
  const view = mount();
  try {
    jest.mocked(auth.requestOtp).mockResolvedValueOnce({
      challengeId: 'challenge',
      expiresAtUtc: new Date(Date.now() + 246_000).toISOString(),
      resendAtUtc: new Date(Date.now() + 66_000).toISOString(),
    });
    await request();
    expect(screen.getByText('Code expires in 04:06.')).toBeTruthy();
    expect(screen.getByText('You can request another code in 01:06.')).toBeTruthy();
    act(() => jest.advanceTimersByTime(6000));
    expect(screen.getByText('Code expires in 04:00.')).toBeTruthy();
    expect(screen.getByText('You can request another code in 01:00.')).toBeTruthy();
    act(() => jest.advanceTimersByTime(60_000));
    expect(screen.getByText('Code expires in 03:00.')).toBeTruthy();
    expect(screen.queryByText(/You can request another code in/)).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Request another code', disabled: false }),
    ).toBeTruthy();
    act(() => jest.advanceTimersByTime(180_000));
    expect(screen.queryByText(/Code expires in/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Verify code', disabled: true })).toBeTruthy();
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});

test('registration verifies phone before showing password confirmation and username', async () => {
  mount();
  await request();
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

test('phone login offers password authentication without an OTP option', () => {
  mount();
  expect(screen.getByLabelText('Mobile number')).toBeTruthy();
  expect(screen.getByLabelText('Password')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Login with OTP' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Request code' })).toBeNull();
  expect(screen.queryByLabelText('Six-digit verification code')).toBeNull();
});

test('password login validates phone then submits the password', async () => {
  mount();
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByText('Enter an 11-digit mobile number starting with 0.');
  expect(auth.signInPhone).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Mobile number'), phone);
  fireEvent.changeText(screen.getByLabelText('Password'), 'private-password');
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByText('You are signed in.');
  expect(auth.signInPhone).toHaveBeenCalledWith(phone, 'private-password');
  expect(auth.requestOtp).not.toHaveBeenCalled();
  expect(auth.verifyRegistrationOtp).not.toHaveBeenCalled();
  expect(auth.loginWithOtp).not.toHaveBeenCalled();
});

test('phone login requires a password without requesting an OTP', async () => {
  mount();
  fireEvent.changeText(screen.getByLabelText('Mobile number'), phone);
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByText('Enter your password.');
  expect(auth.signInPhone).not.toHaveBeenCalled();
  expect(auth.requestOtp).not.toHaveBeenCalled();
});

test('incorrect phone login credentials show an error without falling back to OTP', async () => {
  jest
    .mocked(auth.signInPhone)
    .mockRejectedValueOnce(new CloudError(401, undefined, undefined, 'invalid_credentials'));
  mount();
  fireEvent.changeText(screen.getByLabelText('Mobile number'), phone);
  fireEvent.changeText(screen.getByLabelText('Password'), 'wrong-password');
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByText('Invalid mobile number or password.');
  expect(screen.getByRole('button', { name: 'Sign in', disabled: false })).toBeTruthy();
  expect(auth.requestOtp).not.toHaveBeenCalled();
  expect(auth.loginWithOtp).not.toHaveBeenCalled();
});

test.each(['۰۹۱۲۱۲۳۴۵۶۷', '٠٩١٢١٢٣٤٥٦٧'])(
  'localized local phone digits support password login: %s',
  async (value) => {
    mount();
    expect(screen.getByLabelText('Mobile number').props.maxLength).toBe(11);
    expect(
      screen.getByText('Enter 11 digits starting with 0, for example 09121234567.'),
    ).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Mobile number'), value);
    fireEvent.changeText(screen.getByLabelText('Password'), 'private-password');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('You are signed in.');
    expect(auth.signInPhone).toHaveBeenCalledWith(phone, 'private-password');
  },
);

test.each(['0912123456', '091212345678', '19121234567', '+989121234567'])(
  'invalid local phone entry cannot request an OTP: %s',
  async (value) => {
    mount();
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    fireEvent.changeText(screen.getByLabelText('Mobile number'), value);
    fireEvent.press(screen.getByRole('button', { name: 'Request code' }));
    await screen.findByText('Enter an 11-digit mobile number starting with 0.');
    expect(auth.requestOtp).not.toHaveBeenCalled();
  },
);

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
  await request();
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
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
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
  fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
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

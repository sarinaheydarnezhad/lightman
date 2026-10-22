import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { requestGoogleIdToken } from './google-sign-in';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signOut: jest.fn(),
    signIn: jest.fn(),
  },
  isSuccessResponse: (response: { type: string }) => response.type === 'success',
  isErrorWithCode: (error: unknown) => !!error && typeof error === 'object' && 'code' in error,
  statusCodes: { SIGN_IN_CANCELLED: 'cancelled', PLAY_SERVICES_NOT_AVAILABLE: 'not-available' },
}));

const originalPlatform = Platform.OS;
const originalWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const originalIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

beforeEach(() => {
  jest.resetAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web.apps.googleusercontent.com';
  delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  jest.mocked(GoogleSignin.hasPlayServices).mockResolvedValue(true);
  jest.mocked(GoogleSignin.signOut).mockResolvedValue(null);
  jest.mocked(GoogleSignin.signIn).mockResolvedValue({
    type: 'success',
    data: { idToken: 'google-id-token' },
  } as Awaited<ReturnType<typeof GoogleSignin.signIn>>);
});

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  if (originalWebClientId === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  else process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = originalWebClientId;
  if (originalIosClientId === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  else process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = originalIosClientId;
});

test('Android requests a Google ID token for the backend without requesting offline access', async () => {
  await expect(requestGoogleIdToken()).resolves.toBe('google-id-token');
  expect(GoogleSignin.configure).toHaveBeenCalledWith({
    webClientId: 'web.apps.googleusercontent.com',
  });
  expect(GoogleSignin.hasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: true });
  expect(GoogleSignin.signOut).toHaveBeenCalledTimes(1);
  expect(jest.mocked(GoogleSignin.signOut).mock.invocationCallOrder[0]).toBeLessThan(
    jest.mocked(GoogleSignin.signIn).mock.invocationCallOrder[0]!,
  );
});

test('iOS uses its own client ID and does not check Google Play services', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios.apps.googleusercontent.com';
  await expect(requestGoogleIdToken()).resolves.toBe('google-id-token');
  expect(GoogleSignin.configure).toHaveBeenCalledWith({
    webClientId: 'web.apps.googleusercontent.com',
    iosClientId: 'ios.apps.googleusercontent.com',
  });
  expect(GoogleSignin.hasPlayServices).not.toHaveBeenCalled();
});

test.each(['missing-web-id', 'missing-ios-id', 'web'])(
  'unsupported or unconfigured Google sign-in fails before opening the chooser: %s',
  async (scenario) => {
    if (scenario === 'missing-web-id') delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    else
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: scenario === 'web' ? 'web' : 'ios',
      });
    await expect(requestGoogleIdToken()).rejects.toMatchObject({ code: 'google_unavailable' });
    expect(GoogleSignin.configure).not.toHaveBeenCalled();
  },
);

test('Google cancellation returns no token', async () => {
  jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({ type: 'cancelled', data: null });
  await expect(requestGoogleIdToken()).resolves.toBeNull();
});

test('legacy cancellation errors also return no token', async () => {
  jest.mocked(GoogleSignin.signIn).mockRejectedValueOnce({ code: 'cancelled' });
  await expect(requestGoogleIdToken()).resolves.toBeNull();
});

test('missing Google Play services produces an actionable error', async () => {
  jest.mocked(GoogleSignin.hasPlayServices).mockRejectedValueOnce({ code: 'not-available' });
  await expect(requestGoogleIdToken()).rejects.toMatchObject({ code: 'google_play_services' });
  expect(GoogleSignin.signIn).not.toHaveBeenCalled();
});

test('a successful SDK response without an ID token is not authentication', async () => {
  jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({
    type: 'success',
    data: { idToken: null },
  } as Awaited<ReturnType<typeof GoogleSignin.signIn>>);
  await expect(requestGoogleIdToken()).rejects.toMatchObject({ code: 'google_failed' });
});

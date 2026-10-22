import appConfig from './app.json';
import configure from './app.config';
const originalIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

afterEach(() => {
  if (originalIosClientId === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  else process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = originalIosClientId;
});

test('unconfigured Google sign-in preserves the existing Expo build configuration', () => {
  delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  expect(configure({ config: appConfig.expo })).toBe(appConfig.expo);
});

test('Google iOS configuration adds the reversed client URL scheme without removing other plugins', () => {
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = '12345-ios-client.apps.googleusercontent.com';
  expect(configure({ config: appConfig.expo }).plugins).toEqual([
    ...appConfig.expo.plugins,
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme: 'com.googleusercontent.apps.12345-ios-client',
      },
    ],
  ]);
});

test('malformed Google iOS client IDs cannot produce a broken native callback scheme', () => {
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'not-a-google-client-id';
  expect(() => configure({ config: appConfig.expo })).toThrow('Google iOS OAuth client ID');
});

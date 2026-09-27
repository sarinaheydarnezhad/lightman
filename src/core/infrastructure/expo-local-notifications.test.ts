/** Importing local notification APIs must not initialize Expo's push-token registration. */
jest.mock('expo-notifications/build/DevicePushTokenAutoRegistration.fx', () => {
  throw new Error('Expo Go cannot register push tokens');
});

test('the local notification adapter does not load push registration on app startup', () => {
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const local =
      require('./expo-local-notifications') as typeof import('./expo-local-notifications');
    /* eslint-enable @typescript-eslint/no-require-imports */
    expect(local.scheduleNotificationAsync).toEqual(expect.any(Function));
    expect(local.setNotificationHandler).toEqual(expect.any(Function));
  });
});

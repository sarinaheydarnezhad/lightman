import appConfig from './app.json';
import configure from './app.config';

test.each([undefined, '12345-ios-client.apps.googleusercontent.com', 'invalid'])(
  'legacy Google configuration cannot enable Google authentication (%s)',
  (value) => {
    const original = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    try {
      if (value === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
      else process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = value;
      const result = configure({ config: appConfig.expo });
      expect(result.plugins).toEqual(expect.arrayContaining(appConfig.expo.plugins));
      expect(result.plugins).toContain('./plugins/withReleaseSigning');
      expect(JSON.stringify(result.plugins)).not.toContain('google-signin');
    } finally {
      if (original === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
      else process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = original;
    }
  },
);

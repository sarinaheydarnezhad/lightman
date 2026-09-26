import appConfig from './app.json';

describe('iOS release configuration', () => {
  it('declares release metadata and supported native settings', () => {
    expect(appConfig.expo.ios).toMatchObject({
      bundleIdentifier: 'com.example.lightman',
      buildNumber: '1',
      deploymentTarget: '16.4',
      supportsTablet: true,
    });
  });

  it('declares only required-reason APIs used by installed native modules', () => {
    expect(appConfig.expo.ios.privacyManifests).toEqual({
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['0A2A.1', '3B52.1', 'C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['85F4.1', 'E174.1'],
        },
      ],
    });
  });

  it('does not request unrelated native permissions', () => {
    expect(appConfig.expo.ios).not.toHaveProperty('infoPlist');
  });
});

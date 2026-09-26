import appConfig from './app.json';

describe('native release configuration', () => {
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

  it('pins Android release settings and blocks broad storage permissions', () => {
    expect(appConfig.expo.android).toMatchObject({
      package: 'com.example.lightman',
      versionCode: 1,
      blockedPermissions: [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ],
    });

    const buildProperties = appConfig.expo.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
    );

    expect(buildProperties).toEqual([
      'expo-build-properties',
      expect.objectContaining({
        android: {
          minSdkVersion: 24,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
        },
      }),
    ]);
  });
});

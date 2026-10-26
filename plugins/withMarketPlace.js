const fs = require('node:fs/promises');
const path = require('node:path');
const {
  withAppBuildGradle,
  withProjectBuildGradle,
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');

const addMarketPlaceToGradle = (config, values) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let gradleContent = config.modResults.contents;
      const placeholdersString = Object.entries(values)
        .map(([key, value]) => `manifestPlaceholders["${key}"] = "${value}"`)
        .join('\n        ');
      const defaultConfigPattern = /defaultConfig\s*\{/;

      if (!gradleContent.includes(placeholdersString)) {
        gradleContent = gradleContent.replace(
          defaultConfigPattern,
          (match) => `${match}\n        ${placeholdersString}`,
        );
      }

      config.modResults.contents = gradleContent;
    }
    return config;
  });
};

const withMarketPlace = (config, options = {}) => {
  const { marketApplicationId, marketBindAddress, marketPermission } = options;

  if (
    ![marketApplicationId, marketBindAddress, marketPermission].every(
      (value) => typeof value === 'string' && /^[a-zA-Z0-9_.]+$/.test(value),
    )
  ) {
    throw new Error('withMarketPlace requires three valid manifest values');
  }
  config = addMarketPlaceToGradle(config, {
    marketApplicationId,
    marketBindAddress,
    marketPermission,
  });
  config = withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy')
      throw new Error('withMarketPlace requires a Groovy project build.gradle');
    const repository = `
allprojects {
    repositories {
        exclusiveContent {
            forRepository { maven { url 'https://maven.myket.ir' } }
            filter { includeGroup 'ir.myket' }
        }
    }
}
`;
    if (!mod.modResults.contents.includes(repository)) mod.modResults.contents += repository;
    return mod;
  });
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const permissions = (manifest['uses-permission'] ??= []);
    if (!permissions.some((entry) => entry.$['android:name'] === marketPermission))
      permissions.push({ $: { 'android:name': marketPermission } });
    const queries = (manifest.queries ??= [{}]);
    const packages = (queries[0].package ??= []);
    if (!packages.some((entry) => entry.$['android:name'] === marketApplicationId))
      packages.push({ $: { 'android:name': marketApplicationId } });
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const packageFile = require.resolve('iab-myket-reactnative/package.json', {
        paths: [mod.modRequest.projectRoot],
      });
      const metadata = JSON.parse(await fs.readFile(packageFile, 'utf8'));
      if (metadata.version !== '2.2.0')
        throw new Error('Review the Myket Android compatibility shim before upgrading the SDK.');
      await fs.copyFile(
        require.resolve('./myket-build.gradle'),
        path.join(path.dirname(packageFile), 'android', 'build.gradle'),
      );
      const packageSource = path.join(
        path.dirname(packageFile),
        'android',
        'src',
        'main',
        'java',
        'ir',
        'myketBillingReactNative',
        'BillingReactNativePackage.kt',
      );
      const source = await fs.readFile(packageSource, 'utf8');
      await fs.writeFile(
        packageSource,
        source.replace(/,\s*MyketBillingModule\(reactContext\)/g, ''),
      );
      return mod;
    },
  ]);
};

module.exports = withMarketPlace;

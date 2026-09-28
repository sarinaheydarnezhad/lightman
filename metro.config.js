const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('node:path');

const config = withNativeWind(getDefaultConfig(__dirname), {
  input: './src/shared/theme/global.css',
});

config.resolver.assetExts.push('wasm');

// sqlite-wasm uses package-relative worker URLs without `./`; Metro treats those
// as bare imports even though the files are present beside its entry point.
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'web' &&
    ['sqlite3-worker1.mjs', 'sqlite3-opfs-async-proxy.js'].includes(moduleName) &&
    context.originModulePath.includes(path.join('@sqlite.org', 'sqlite-wasm', 'dist'))
  ) {
    return context.resolveRequest(
      context,
      path.join(path.dirname(context.originModulePath), moduleName),
      platform,
    );
  }
  return resolveRequest
    ? resolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

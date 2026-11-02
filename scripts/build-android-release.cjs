/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const signingFile = process.env.LERONA_ANDROID_SIGNING_FILE
  ? path.resolve(process.env.LERONA_ANDROID_SIGNING_FILE)
  : path.join(root, '.secrets', 'android-release', 'signing.json');

if (!fs.existsSync(signingFile)) {
  console.error(
    'Restore the permanent release signing backup before building. See docs/android-release.md.',
  );
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'inherit',
    ...options,
  });
  if (result.error || result.status !== 0) {
    console.error(
      result.error ? 'Could not start the Android build tool.' : 'Android release build failed.',
    );
    process.exit(result.status || 1);
  }
}

run(process.execPath, [
  require.resolve('expo/bin/cli'),
  'prebuild',
  '--platform',
  'android',
  '--no-install',
]);
const gradleOptions = { cwd: path.join(root, 'android') };
if (process.platform === 'win32') {
  run(
    'cmd.exe',
    ['/d', '/s', '/c', 'gradlew.bat :app:assembleRelease --console=plain'],
    gradleOptions,
  );
} else {
  run('./gradlew', [':app:assembleRelease', '--console=plain'], gradleOptions);
}

const app = require('../app.json').expo;
const destinationDir = path.join(root, 'releases');
const destination = path.join(
  destinationDir,
  `lerona-${app.version}-${app.android.versionCode}-myket.apk`,
);
fs.mkdirSync(destinationDir, { recursive: true });
fs.copyFileSync(
  path.join(root, 'android/app/build/outputs/apk/release/app-release.apk'),
  destination,
);
console.log(`Signed Myket APK: ${destination}`);

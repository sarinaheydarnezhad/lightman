/* global __dirname */
const fs = require('node:fs');
const { Buffer } = require('node:buffer');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const { unzipSync } = require(path.join(root, 'node_modules/fflate'));
const app = require(path.join(root, 'app.json')).expo;
const identity = require(path.join(root, 'android-release-signing.json'));
const apk = path.join(
  root,
  'releases',
  `lerona-${app.version}-${app.android.versionCode}-myket.apk`,
);
const sdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  (process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'));
if (!sdk || !fs.existsSync(path.join(sdk, 'build-tools')))
  throw new Error('Set ANDROID_HOME to the Android SDK.');
const toolVersion = fs
  .readdirSync(path.join(sdk, 'build-tools'))
  .filter((name) => /^\d+\.\d+\.\d+$/.test(name))
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
  .at(-1);
if (!toolVersion) throw new Error('Install Android SDK build tools before verifying the APK.');
const sdkTools = path.join(sdk, 'build-tools', toolVersion);
const aapt = path.join(sdkTools, process.platform === 'win32' ? 'aapt2.exe' : 'aapt2');
const signature = execFileSync(
  'java',
  [
    '-jar',
    path.join(sdkTools, 'lib', 'apksigner.jar'),
    'verify',
    '--verbose',
    '--print-certs',
    apk,
  ],
  { encoding: 'utf8' },
);
const certificateDigests = new Set(
  [
    ...signature.matchAll(
      /^(?:Signer #1|V[\d.]+ Signer):? certificate SHA-256 digest:\s*([0-9a-f]{64})\s*$/gim,
    ),
  ].map((match) => match[1].toLowerCase()),
);
const actualFingerprint = [...certificateDigests][0];
if (
  !/^Number of signers:\s*1\s*$/m.test(signature) ||
  certificateDigests.size !== 1 ||
  actualFingerprint !== identity.certificateSha256.toLowerCase()
)
  throw new Error('APK certificate does not match the permanent release key');
const badging = execFileSync(aapt, ['dump', 'badging', apk], { encoding: 'utf8' });
const packageLine = badging.match(/^package: (.*)$/m)?.[1] ?? '';
if (
  !packageLine.includes(`name='${identity.packageName}'`) ||
  !packageLine.includes(`versionCode='${app.android.versionCode}'`) ||
  !packageLine.includes(`versionName='${app.version}'`)
)
  throw new Error('Incorrect packaged release identity');
if (/^application-debuggable/m.test(badging)) throw new Error('APK is debuggable');
const permissions = execFileSync(aapt, ['dump', 'permissions', apk], { encoding: 'utf8' });
if (!permissions.includes('ir.mservices.market.BILLING'))
  throw new Error('Myket billing permission missing');
const bytes = fs.readFileSync(apk);
const entries = [];
const files = unzipSync(bytes, {
  filter: (file) => {
    entries.push(file.name);
    return (
      file.name === 'assets/index.android.bundle' ||
      /^classes\d*\.dex$/.test(file.name) ||
      file.name.endsWith('.ttf')
    );
  },
});
if (entries.some((name) => /\.p12$|(^|\/)signing\.json$|(^|\/)\.secrets\//i.test(name))) {
  throw new Error('Private signing files must not be packaged');
}
if (
  !Object.entries(files).some(
    ([name, data]) =>
      name.endsWith('.dex') &&
      Buffer.from(data).includes(Buffer.from('MyketReactiveBillingModule')),
  )
)
  throw new Error('Native Myket bridge missing');
if (
  !Buffer.from(files['assets/index.android.bundle']).includes(Buffer.from('https://lerona-app.com'))
) {
  throw new Error('Production backend URL missing from bundle');
}
const digest = (data) => crypto.createHash('sha256').update(data).digest('hex');
const packagedFontHashes = new Set(
  Object.entries(files)
    .filter(([name]) => name.endsWith('.ttf'))
    .map(([, data]) => digest(data)),
);
const bundledFonts = fs
  .readdirSync(path.join(root, 'font', 'fonts', 'ttf'))
  .filter((name) => name.startsWith('Vazirmatn-') && name.endsWith('.ttf'));
for (const font of bundledFonts) {
  if (
    !packagedFontHashes.has(digest(fs.readFileSync(path.join(root, 'font', 'fonts', 'ttf', font))))
  ) {
    throw new Error('Bundled Vazirmatn font is missing or different: ' + font);
  }
}
const report = {
  apk: path.relative(root, apk),
  bundledFonts,
  packageName: identity.packageName,
  versionName: app.version,
  versionCode: app.android.versionCode,
  sizeBytes: bytes.length,
  sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  signingCertificateSha256: actualFingerprint,
  debuggable: false,
  signatureVerified: true,
  architectures: badging
    .match(/^native-code:\s*(.*)$/m)?.[1]
    ?.match(/'[^']+'/g)
    ?.map((value) => value.slice(1, -1)),
  myketNativeBridgeIncluded: true,
  myketPermissionIncluded: true,
  productionBackendIncluded: true,
  privateSigningFilesExcluded: true,
  verifiedAtUtc: new Date().toISOString(),
};
fs.writeFileSync(apk.replace(/\.apk$/, '.release.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

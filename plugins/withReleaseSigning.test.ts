import { applyReleaseSigning } from './withReleaseSigning';

test('release signing is applied after existing build types without changing debug builds', () => {
  const native = 'android { buildTypes { debug { signingConfig signingConfigs.debug } } }\n';
  const configured = applyReleaseSigning(native);
  expect(configured).toContain(native.trim());
  expect(configured).toMatch(
    /apply from: new File\(rootDir, "\.\.\/plugins\/release-signing.gradle"\)\s*$/,
  );
  expect(applyReleaseSigning(configured)).toBe(configured);
});

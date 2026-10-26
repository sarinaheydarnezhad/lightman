import withMarketPlace from './withMarketPlace';

let mockGradle: { modResults: { language: string; contents: string } };
let mockProjectGradle: typeof mockGradle;
let mockManifest: { modResults: { manifest: Record<string, any> } };

jest.mock('@expo/config-plugins', () => ({
  withAppBuildGradle: (config: unknown, mod: (value: typeof mockGradle) => void) => {
    mod(mockGradle);
    return config;
  },
  withProjectBuildGradle: (config: unknown, mod: (value: typeof mockGradle) => void) => {
    mod(mockProjectGradle);
    return config;
  },
  withAndroidManifest: (config: unknown, mod: (value: typeof mockManifest) => void) => {
    mod(mockManifest);
    return config;
  },
  withDangerousMod: (config: unknown) => config,
}));

const options = {
  marketApplicationId: 'ir.mservices.market',
  marketBindAddress: 'ir.mservices.market.InAppBillingService.BIND',
  marketPermission: 'ir.mservices.market.BILLING',
};

beforeEach(() => {
  mockProjectGradle = { modResults: { language: 'groovy', contents: 'allprojects {}' } };
  mockGradle = {
    modResults: {
      language: 'groovy',
      contents: 'android { defaultConfig { manifestPlaceholders["existing"] = "kept" } }',
    },
  };
  mockManifest = {
    modResults: {
      manifest: {
        queries: [
          { intent: [{ action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }] }] },
        ],
      },
    },
  };
});

test('repeated prebuild preserves other placeholders, permissions and package queries', () => {
  withMarketPlace({}, options);
  const first = mockGradle.modResults.contents;
  const firstProject = mockProjectGradle.modResults.contents;
  withMarketPlace({}, options);
  expect(mockGradle.modResults.contents).toBe(first);
  expect(mockProjectGradle.modResults.contents).toBe(firstProject);
  expect(firstProject).toContain("url 'https://maven.myket.ir'");
  expect(firstProject).toContain("includeGroup 'ir.myket'");
  expect(first).toContain('manifestPlaceholders["existing"] = "kept"');
  for (const [key, value] of Object.entries(options))
    expect(first).toContain(`manifestPlaceholders["${key}"] = "${value}"`);
  expect(mockManifest.modResults.manifest['uses-permission']).toEqual([
    { $: { 'android:name': options.marketPermission } },
  ]);
  expect(mockManifest.modResults.manifest.queries[0].intent).toHaveLength(1);
  expect(mockManifest.modResults.manifest.queries[0].package).toEqual([
    { $: { 'android:name': options.marketApplicationId } },
  ]);
});

test('invalid manifest values fail before editing Gradle', () => {
  expect(() => withMarketPlace({}, { ...options, marketPermission: 'injected"' })).toThrow();
  expect(mockGradle.modResults.contents).not.toContain('marketPermission');
});

const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', 'android/**', 'ios/**', '.expo/**', 'coverage/**', '.tools/**'] },
  {
    files: ['src/features/*/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-*',
                '@react-native/**',
                'expo',
                'expo-*',
                '@expo/**',
                '@/core/infrastructure/**',
                'zustand',
                'nativewind',
                '@/store/**',
                '**/data/**',
                '**/presentation/**',
              ],
              message:
                'Domain must remain platform independent and must not import data or presentation.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/*/presentation/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/data/**'],
              message:
                'Use repository contracts through the composition root; do not import data adapters in presentation.',
            },
          ],
        },
      ],
    },
  },
]);

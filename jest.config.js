module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.{ts,tsx}'],
  modulePathIgnorePatterns: ['<rootDir>/.tools/'],
  moduleNameMapper: {
    '^.+[.]css$': '<rootDir>/test/style-mock.js',
    '^react-native-reanimated/mock$': '<rootDir>/test/reanimated-mock-impl.ts',
    '^react-native-reanimated$': '<rootDir>/test/reanimated-mock.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
};

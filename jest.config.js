module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.{ts,tsx}'],
  modulePathIgnorePatterns: ['<rootDir>/.tools/'],
  moduleNameMapper: {
    '^.+[.]css$': '<rootDir>/test/style-mock.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
};

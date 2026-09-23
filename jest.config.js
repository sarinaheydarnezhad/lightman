module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.{ts,tsx}'],
  modulePathIgnorePatterns: ['<rootDir>/.tools/'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};

const { transformIgnorePatterns: defaultPatterns } = require('jest-expo/jest-preset');

module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.native.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/*.component.test.tsx'],
  passWithNoTests: true,
  transformIgnorePatterns: defaultPatterns.map((pattern) =>
    pattern.includes('standard-navigation')
      ? pattern.replace(
          'standard-navigation',
          'standard-navigation|drizzle-orm'
        )
      : pattern
  ),
};

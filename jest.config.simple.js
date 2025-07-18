export default {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  collectCoverageFrom: [
    'server/**/*.ts',
    'client/src/**/*.ts',
    'client/src/**/*.tsx',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  coverageDirectory: 'coverage',
  testTimeout: 30000,
  verbose: true
};
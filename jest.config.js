/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@server/(.*)$': '<rootDir>/server/$1',
    '^@client/(.*)$': '<rootDir>/client/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
  testMatch: [
    '**/server/__tests__/**/*.test.ts',
    '**/server/**/*.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/server/__tests__/setup.ts'],
};
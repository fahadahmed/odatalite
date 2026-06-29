/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/tests/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/tests/**', '!src/config/**'],
  coverageDirectory: 'coverage',
};

module.exports = config;

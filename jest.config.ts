import type { Config } from 'jest'

// Common module name mapper for path aliases
const moduleNameMapper = {
  // Support ESM-style explicit .js in TS imports by stripping the extension
  '^(\\.{1,2}/.*)\\.js$': '$1',
  // Alias mappings (both with and without .js in specifier)
  '^@/(.*)\\.js$': '<rootDir>/src/$1',
  '^@/(.*)$': '<rootDir>/src/$1',
  '^@common/(.*)\\.js$': '<rootDir>/src/common/$1',
  '^@common/(.*)$': '<rootDir>/src/common/$1',
  '^@modules/(.*)\\.js$': '<rootDir>/src/modules/$1',
  '^@modules/(.*)$': '<rootDir>/src/modules/$1',
  '^@config/(.*)\\.js$': '<rootDir>/src/config/$1',
  '^@config/(.*)$': '<rootDir>/src/config/$1',
  '^@test/(.*)\\.js$': '<rootDir>/test/$1',
  '^@test/(.*)$': '<rootDir>/test/$1',
}

// Common module file extensions
const moduleFileExtensions = ['ts', 'js', 'json']

// Transforms for unit (CJS) and e2e (ESM)
const transformUnit = {
  '^.+\\.ts$': [
    'ts-jest',
    {
      // Force CommonJS for unit tests so setup files can use require/jest.mock
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node',
        isolatedModules: false,
      },
      useESM: false,
    },
  ],
}

const transformE2E = {
  '^.+\\.ts$': [
    'ts-jest',
    {
      tsconfig: 'tsconfig.spec.json',
      useESM: true,
    },
  ],
}

const config: Config = {
  // Parallel test execution - use 50% of CPU cores locally, limit to 2 in CI
  maxWorkers: process.env.CI ? 2 : '50%',
  // Stop test execution on first failure in CI for faster feedback
  bail: process.env.CI ? 1 : 0,
  // Verbose output in CI for better debugging
  verbose: process.env.CI === 'true',

  projects: [
    // Unit tests configuration
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      injectGlobals: true,
      moduleFileExtensions,
      rootDir: '.',
      testMatch: ['<rootDir>/test/unit/**/*.spec.ts', '<rootDir>/test/unit/**/*.test.ts'],
      testPathIgnorePatterns: ['<rootDir>/test/e2e/', '<rootDir>/dist/'],
      setupFilesAfterEnv: ['<rootDir>/test/setup/unit.setup.ts'],
      collectCoverageFrom: ['src/**/*.(t|j)s'],
      coverageDirectory: 'coverage',
      coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/test/', '.module.ts$', 'main.ts$'],
      transform: transformUnit,
      moduleNameMapper,
      // Unit project runs in CJS to keep jest.mock working in setup
      // Global timeout for unit tests (default: 5 seconds)
      testTimeout: 5000,
    },
    // E2E tests configuration
    {
      displayName: 'e2e',
      preset: 'ts-jest',
      testEnvironment: 'node',
      injectGlobals: true,
      moduleFileExtensions,
      rootDir: '.',
      testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
      setupFilesAfterEnv: ['<rootDir>/test/setup/e2e.setup.ts'],
      collectCoverageFrom: ['src/**/*.(t|j)s'],
      coverageDirectory: 'coverage',
      coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/test/', '.module.ts$', 'main.ts$'],
      transform: transformE2E,
      moduleNameMapper,
      extensionsToTreatAsEsm: ['.ts'],
      // Global timeout for e2e tests (default: 30 seconds)
      testTimeout: 30000,
    },
  ],
}

export default config

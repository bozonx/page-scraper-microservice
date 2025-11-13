/**
 * Shared mock objects for tests
 *
 * This file contains reusable mock factories to avoid duplication across test files.
 * All mocks follow the DRY principle and provide type-safe implementations.
 */

import type { PinoLogger } from 'nestjs-pino';
import type { ConfigService } from '@nestjs/config';

/**
 * Creates a mock PinoLogger instance with all required methods
 *
 * @returns Mock PinoLogger with jest.fn() for all methods
 */
export const createMockLogger = (): PinoLogger =>
  ({
    setContext: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    fatal: jest.fn(),
    trace: jest.fn(),
  }) as unknown as PinoLogger;

/**
 * Placeholder for future HTTP-related mocks if needed.
 */

/**
 * Creates a mock ConfigService instance with customizable configuration
 *
 * @param overrides - Object with config key-value pairs to override defaults
 * @returns Mock ConfigService that returns overridden values or defaults
 *
 * @example
 * const mockConfig = createMockConfigService({
 *   'app.port': 3000,
 *   'app.logLevel': 'debug'
 * });
 */
export const createMockConfigService = (overrides: Record<string, any> = {}) =>
  ({
    get: jest.fn((key: string, defaultValue?: any) => {
      return overrides[key] ?? defaultValue;
    }),
    getOrThrow: jest.fn((key: string) => {
      if (!(key in overrides)) {
        throw new Error(`Configuration key "${key}" not found`);
      }
      return overrides[key];
    }),
  }) as unknown as ConfigService;

/**
 * Shared mock objects for tests
 *
 * This file contains reusable mock factories to avoid duplication across test files.
 * All mocks follow the DRY principle and provide type-safe implementations.
 */

import type { PinoLogger } from 'nestjs-pino';
import type { ConfigService } from '@nestjs/config';
import type { IArticleExtractor } from '../../src/modules/scraper/services/article-extractor.interface';
import type { TurndownConverterService } from '../../src/modules/scraper/services/turndown.service';

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

/**
 * Creates a mock TurndownConverterService instance
 *
 * @param overrides - Object with method implementations to override defaults
 * @returns Mock TurndownConverterService with customizable methods
 */
export const createMockTurndownConverterService = (overrides: Partial<TurndownConverterService> = {}) =>
  ({
    convertToMarkdown: jest.fn((html: string) => html ? `# Mocked Markdown\n${html}` : ''),
    turndownService: {
      turndown: jest.fn((html: string) => html ? `# Mocked Markdown\n${html}` : ''),
      addRule: jest.fn(),
      removeRule: jest.fn(),
      use: jest.fn(),
    },
    ...overrides,
  }) as unknown as TurndownConverterService;

/**
 * Creates a mock IArticleExtractor instance
 *
 * @param overrides - Object with method implementations to override defaults
 * @returns Mock IArticleExtractor with customizable methods
 */
export const createMockArticleExtractor = (overrides: Partial<IArticleExtractor> = {}) =>
  ({
    extract: jest.fn((url: string) => Promise.resolve({
      title: 'Mock Article Title',
      content: '<p>Mock article content</p>',
      description: 'Mock article description',
      author: 'Mock Author',
      url,
    })),
    extractFromHtml: jest.fn((html: string) => Promise.resolve({
      title: 'Mock Article Title',
      content: html || '<p>Mock article content</p>',
      description: 'Mock article description',
      author: 'Mock Author',
    })),
    ...overrides,
  }) as unknown as IArticleExtractor;

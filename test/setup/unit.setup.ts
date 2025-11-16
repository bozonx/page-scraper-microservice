/**
 * Unit tests global setup
 *
 * Network handling:
 * - External network calls are blocked via nock to ensure test isolation
 * - Localhost connections are allowed for local adapters
 * - All nock interceptors are cleaned after each test
 *
 * Timeout:
 * - Global timeout for unit tests is configured in jest.config.ts (5 seconds)
 * - Override per-test if needed using jest.setTimeout() or passing timeout as third arg to it()
 */

import nock from 'nock';
let originalFetch: any;

// Lightweight mocks for heavy/IO-bound modules to ensure unit tests never hit real network/engines
jest.mock('crawlee', () => {
  class MockPlaywrightCrawler {
    private handler: (ctx: any) => Promise<void> | void;
    constructor(options: any) {
      this.handler = options?.requestHandler ?? (async () => undefined);
    }
    addRequests = jest.fn();
    run = jest.fn(async () => {
      const page = {
        addInitScript: jest.fn(async () => undefined),
        setViewportSize: jest.fn(async () => undefined),
        route: jest.fn(async (_: any, cb: any) => cb({ abort: () => undefined })),
        goto: jest.fn(async () => undefined),
        content: jest.fn(async () => '<html><body><p>Mock Content</p></body></html>'),
      };
      await this.handler({ page });
    });
  }
  return { PlaywrightCrawler: MockPlaywrightCrawler };
});

// Note: @extractus/article-extractor is mocked at the test level
// to handle dynamic imports properly

// Block all external network calls; allow localhost for tests that use local adapters
beforeAll(() => {
  nock.disableNetConnect();
  nock.enableNetConnect('127.0.0.1');
  originalFetch = (global as any).fetch;
  (global as any).fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => '',
    json: async () => ({}),
  }));
});

afterEach(() => {
  nock.cleanAll();
  jest.clearAllMocks();
});

afterAll(() => {
  (global as any).fetch = originalFetch;
});

afterAll(() => {
  nock.enableNetConnect();
});

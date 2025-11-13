/**
 * E2E tests global setup
 *
 * Network handling:
 * - External network calls are allowed for e2e tests (unlike unit tests)
 * - If specific external calls must be mocked, do so per-test rather than globally
 *
 * Timeout:
 * - Global timeout for e2e tests is set to 30 seconds (see below)
 * - Override per-test if needed using jest.setTimeout() or passing timeout as third arg to it()
 */

// Set global timeout for all e2e tests to 30 seconds
// This prevents individual tests from needing to specify timeout manually
jest.setTimeout(30000);

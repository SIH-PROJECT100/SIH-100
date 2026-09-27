import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration — Phase 10
 *
 * Runs test suites sequentially (fileParallelism: false) so that test files
 * operating on shared seeded entities (e.g. tender-001, bidder-005) do not
 * collide or encounter database lock/concurrency conflicts.
 */
export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/gem_compliance?schema=public',
      DIRECT_URL: 'postgresql://postgres:postgres@localhost:5432/gem_compliance?schema=public',
      GEMINI_API_KEY: 'mock_gemini_api_key_for_preflight',
      RATE_LIMIT_TEST_MODE: 'true',
    },
  },
});

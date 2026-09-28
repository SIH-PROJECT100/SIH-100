import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    isolate: true,
    testTimeout: 45000,
    hookTimeout: 45000,
    teardownTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://backend_app:backend_app_secure_password_2026@localhost:5432/gem_compliance?schema=public',
      DIRECT_URL: process.env.DIRECT_URL || 'postgresql://postgres:postgres@localhost:5432/gem_compliance?schema=public',
      GEMINI_API_KEY: 'mock_gemini_api_key_for_preflight',
      RATE_LIMIT_TEST_MODE: 'true',
      DEMO_MODE: 'true',
    },
  },
});

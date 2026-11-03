import path from "node:path";
import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL, TEST_REDIS_URL } from "./tests/integration/env";

/**
 * Integration suite: real Postgres + Redis, real queue, worker poll code and API routes.
 * Run with `npm run test:integration` (needs `npm run docker:up` locally).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/web"),
    },
  },
  test: {
    include: ["tests/integration/**/*.integration.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    // Files share one database and one queue, so run them one at a time.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      REDIS_URL: TEST_REDIS_URL,
      MOCK_MARKETPLACE: "true",
      MOCK_MARKETPLACE_DELAY_MS: "0",
      MOCK_MARKETPLACE_FAILURE_RATE: "0",
      DEMO_MODE: "false",
    },
  },
});

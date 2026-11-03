import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/web"),
    },
  },
  test: {
    include: ["**/*.test.ts"],
    // Integration tests need Postgres + Redis; they run via `npm run test:integration`.
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
  },
});

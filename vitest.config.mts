import { defineConfig } from "vitest/config";

// Unit tests for all workspace packages. Run with `pnpm test` (or `pnpm test:watch`).
export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.{ts,tsx}", "apps/*/src/**/*.test.{ts,tsx}"],
    environment: "node",
    passWithNoTests: false,
  },
});

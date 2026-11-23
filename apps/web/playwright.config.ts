import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const isCI = !!process.env.CI;

// Browser smoke tests. Locally they reuse the running dev server on port 3100;
// in CI they build the app and run the production server.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /.isolated.spec.ts$/,
    },
    {
      // Tests that measure real time (simulation speed, frame rate) run alone, after all the
      // others, one at a time: parallel browsers would compete for the CPU and skew the numbers.
      name: "isolated",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /.isolated.spec.ts$/,
      dependencies: ["chromium"],
      fullyParallel: false,
    },
  ],
  webServer: {
    command: isCI ? "pnpm start" : "pnpm dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});

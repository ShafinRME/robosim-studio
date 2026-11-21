import { defineConfig, devices } from "@playwright/test";

// Captures the User Manual screenshots into docs/manual/images (run: pnpm manual:screenshots).
// Uses the running dev server on port 3100, or starts one.
export default defineConfig({
  testDir: "./e2e-manual",
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3100",
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1.5,
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});

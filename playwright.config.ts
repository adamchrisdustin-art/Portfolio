import { defineConfig, devices } from "@playwright/test";

/**
 * Automates the manual Playwright check already described in README.md's
 * "Verified live" section (zero console errors, evidence drawer opens, no
 * forbidden carrier text) so it runs on every push instead of once by
 * hand. Assumes `npm run build` has already run - CI (.github/workflows/
 * ci.yml) always builds first; running `npm run test:e2e` locally
 * requires a prior `npm run build` for the same reason.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  // A dedicated port, not 3000 - avoids colliding with a dev server a
  // developer may already have running locally on the default port.
  use: {
    baseURL: "http://localhost:3100",
  },
  webServer: {
    command: "npm run start -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Pixel 5 (Chromium-based) rather than an iOS device, so this suite
    // only needs the chromium browser binary, not webkit too.
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
});

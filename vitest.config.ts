import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // e2e/ holds Playwright specs (*.spec.ts), run via `npm run test:e2e`,
    // not vitest - vitest's default include pattern matches *.spec.ts too,
    // so this repo needs an explicit exclude once e2e/ exists.
    exclude: ["node_modules/**", "e2e/**"],
  },
});

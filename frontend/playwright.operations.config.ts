import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
const port = Number(process.env.SC_E2E_OPERATIONS_PORT ?? "18193");
const starterPort = Number(process.env.SC_E2E_OPERATIONS_STARTER_PORT ?? "18194");
export default defineConfig({
  testDir: "./e2e",
  testMatch: "012-operations.spec.ts",
  outputDir: "./test-results-operations",
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: "chromium",
    viewport: { width: 1366, height: 844 },
    actionTimeout: 15_000,
    launchOptions: process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {},
    screenshot: "only-on-failure",
    trace: "off",
  },
  webServer: [
    {
      command: "python3 ../scripts/e2e-operations-server.py reference",
      cwd: fileURLToPath(new URL(".", import.meta.url)),
      url: `http://127.0.0.1:${port}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 45_000 },
    },
    {
      command: "python3 ../scripts/e2e-operations-server.py starter",
      cwd: fileURLToPath(new URL(".", import.meta.url)),
      url: `http://127.0.0.1:${starterPort}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 45_000 },
    },
  ],
});

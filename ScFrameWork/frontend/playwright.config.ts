import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const port = Number(process.env.SC_E2E_PORT ?? "18183");
const starterPort = Number(process.env.SC_E2E_STARTER_PORT ?? "18184");

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/012-operations.spec.ts",
  outputDir: "./test-results",
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: "chromium",
    viewport: { width: 1366, height: 768 },
    actionTimeout: 15_000,
    launchOptions: process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {},
    screenshot: "only-on-failure",
    // 인증 요청과 합성 비밀번호가 trace에 기록되지 않도록 기본 trace를 끈다.
    trace: "off",
  },
  webServer: [
    {
      command: "python3 ../scripts/e2e-server.py reference",
      cwd: fileURLToPath(new URL(".", import.meta.url)),
      url: `http://127.0.0.1:${port}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 45_000 },
    },
    {
      command: "python3 ../scripts/e2e-server.py starter",
      cwd: fileURLToPath(new URL(".", import.meta.url)),
      url: `http://127.0.0.1:${starterPort}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 45_000 },
    },
  ],
});

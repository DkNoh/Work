import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const port = Number(process.env.SC_REPORT_E2E_PORT ?? "18185");
if (!Number.isInteger(port) || port < 1024 || port > 65535 || [18183, 18184].includes(port))
  throw new Error("보고서 검증은 일반 E2E와 분리된 유효한 포트를 사용해야 합니다.");

export default defineConfig({
  testDir: "./e2e-reports",
  outputDir: "./test-results-reports",
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
  webServer: {
    command: "python3 ../scripts/e2e-report-server.py",
    cwd: fileURLToPath(new URL(".", import.meta.url)),
    // 초기 bootstrap은 임의 포트다. 이 포트는 seed 이후 재기동한 서버만 연다.
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 45_000 },
  },
});

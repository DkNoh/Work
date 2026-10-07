// 실제 task-local Grafana를 조회한다. private 암호는 메모리에서만 사용하고 trace를 만들지 않는다.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

const root = new URL("../", import.meta.url);
const options = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  assert(["--output", "--secret-file"].includes(process.argv[i]) && process.argv[i + 1]);
  options.set(process.argv[i], process.argv[i + 1]);
}
const output = path.resolve(options.get("--output"));
await fs.mkdir(output, { recursive: false });
const password = (await fs.readFile(options.get("--secret-file"), "utf8")).trim();
const dashboard = JSON.parse(
  await fs.readFile(new URL("infra/operations/grafana/dashboards/sc-framework.json", root), "utf8"),
);
const report = {
  stage: "012",
  passed: false,
  panels: [],
  successfulQueries: 0,
  dataFrames: 0,
  populatedMetricQueries: 0,
  pageErrorTypes: [],
  screenshots: [],
};
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const queries = [];
page.on("pageerror", (error) => report.pageErrorTypes.push(error.name));
page.on("response", (response) => {
  const url = new URL(response.url());
  if (url.pathname.includes("/query") && url.hostname === "127.0.0.1") {
    queries.push(
      response
        .json()
        .then((body) => {
          if (response.ok() && body.results) {
            report.successfulQueries++;
            let populatedMetric = false;
            for (const result of Object.values(body.results)) {
              report.dataFrames += result.frames?.length ?? 0;
              for (const frame of result.frames ?? []) {
                for (const [index, field] of (frame.schema?.fields ?? []).entries()) {
                  if (
                    field.type === "number" &&
                    frame.data?.values?.[index]?.some(
                      (value) => typeof value === "number" && Number.isFinite(value),
                    )
                  )
                    populatedMetric = true;
                }
              }
            }
            if (populatedMetric) report.populatedMetricQueries++;
          }
        })
        .catch(() => undefined),
    );
  }
});
try {
  await page.goto("http://127.0.0.1:13000/login");
  await page.locator('input[name="user"]').fill("sc-admin");
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await page.goto(
    "http://127.0.0.1:13000/d/sc-framework-operations?from=now-15m&to=now&refresh=off",
  );
  for (const panel of dashboard.panels) {
    await expect(page.getByText(panel.title, { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });
    report.panels.push({ id: panel.id, title: panel.title, visible: true });
  }
  await expect
    .poll(() => report.populatedMetricQueries, { timeout: 45_000 })
    .toBeGreaterThanOrEqual(5);
  await Promise.all(queries);
  assert.deepEqual(report.pageErrorTypes, []);
  await page.screenshot({ path: path.join(output, "grafana-1440.png"), fullPage: true });
  report.screenshots.push("grafana-1440.png");
  report.passed = true;
  console.log(
    `PASS actual Grafana dashboard: ${report.panels.length} visible panels, ${report.successfulQueries} successful queries, ${report.dataFrames} data frames`,
  );
} catch (error) {
  report.failureType = error.name;
  console.log(`FAIL actual Grafana dashboard (${error.name})`);
} finally {
  await context.close();
  await browser.close();
  await fs.writeFile(path.join(output, "summary.json"), JSON.stringify(report, null, 2) + "\n");
}
if (!report.passed) process.exitCode = 1;

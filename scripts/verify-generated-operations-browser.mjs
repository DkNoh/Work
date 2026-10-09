// 외부 소비 JAR의 설치 UI만 검증한다. 원문 오류·계정 값·trace를 증거에 기록하지 않는다.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { chromium, expect } from "@playwright/test";

const require = createRequire(import.meta.url);
const args = {};
for (let index = 2; index < process.argv.length; index++) {
  const key = process.argv[index];
  if (
    !["--consumer", "--base-url", "--secret-file", "--output"].includes(key) ||
    args[key] ||
    !process.argv[index + 1]
  )
    throw new Error("GENERATED_BROWSER_ARGUMENTS");
  args[key] = process.argv[++index];
}
const base = new URL(args["--base-url"]);
if (base.hostname !== "127.0.0.1") throw new Error("GENERATED_BROWSER_LOOPBACK");
const output = path.resolve(args["--output"]);
await fs.mkdir(output);
const password = await fs.readFile(args["--secret-file"], "utf8");
const consumer = path.resolve(args["--consumer"]);
const canary = "SC_GENERATED_WINDOW_PRIVATE_" + crypto.randomUUID();
const report = {
  stage: "012",
  passed: false,
  groups: [],
  axe: [],
  screenshots: [],
  unexpectedErrors: [],
  failedAssets: [],
  manualReviewComplete: false,
  traceEnabled: false,
};
let phase = "initialization";
let expectingErrors = false;
let expectedErrors = 0;
const collected = [];
const browser = await chromium.launch();
const context = await browser.newContext({
  baseURL: base.href,
  viewport: { width: 1366, height: 844 },
});
const page = await context.newPage();
page.on("pageerror", (error) => {
  if (expectingErrors && error.message === canary) expectedErrors++;
  else report.unexpectedErrors.push(error.name);
});
page.on("requestfailed", (request) => {
  if (!new URL(request.url()).pathname.startsWith("/api/"))
    report.failedAssets.push(new URL(request.url()).pathname);
});
page.on("request", (request) => {
  if (
    new URL(request.url()).pathname === "/api/operations/browser-errors" &&
    request.method() === "POST"
  ) {
    try {
      collected.push(request.postDataJSON());
    } catch {
      report.unexpectedErrors.push("INVALID_COLLECTOR_BODY");
    }
  }
});
page.on("dialog", (dialog) => dialog.accept());
function check(condition, code) {
  if (!condition) throw new Error(code);
}
async function group(name, action) {
  phase = name;
  await action();
  report.groups.push({ name, passed: true });
  console.log("PASS " + name);
}
async function read(url) {
  const response = await context.request.get(url);
  check(response.status() === 200, "GENERATED_BROWSER_READ_STATUS");
  return response.json();
}
async function command(url, data, status = 200, method = "POST") {
  const token = await read("/api/auth/csrf");
  const response = await context.request.fetch(url, {
    method,
    data,
    headers: { [token.headerName]: token.token },
  });
  check(response.status() === status, "GENERATED_BROWSER_COMMAND_STATUS");
  return response.json();
}
async function accessible(name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState === "running" &&
            Number.isFinite(animation.effect?.getComputedTiming().endTime),
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  if (!(await page.evaluate(() => !!window.axe)))
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const result = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
      },
    }),
  );
  const duplicates = await page.evaluate(() => {
    const seen = new Set();
    return [...document.querySelectorAll("[id]")]
      .filter((element) => {
        const duplicate = seen.has(element.id);
        seen.add(element.id);
        return duplicate;
      })
      .map((element) => element.id);
  });
  const violations = result.violations.map((item) => ({
    id: item.id,
    impact: item.impact,
    nodes: item.nodes.map((node) => ({
      target: node.target,
      checks: [...node.any, ...node.all, ...node.none].map((check) => check.id),
    })),
  }));
  const diagnostic = {
    name,
    violations,
    duplicateIds: duplicates,
    incomplete: result.incomplete.length,
    manualReviewComplete: false,
  };
  await fs.writeFile(
    path.join(output, name + "-axe.json"),
    JSON.stringify(diagnostic, null, 2) + "\n",
  );
  report.axe.push({
    name,
    violations: violations.length,
    duplicateIds: duplicates.length,
    incomplete: result.incomplete.length,
  });
  await page.screenshot({ path: path.join(output, name + ".png"), fullPage: true });
  report.screenshots.push(name + ".png");
  check(!violations.length && !duplicates.length, "GENERATED_BROWSER_ACCESSIBILITY");
  if (name.startsWith("messages-"))
    check(
      await page.evaluate(() =>
        [...document.querySelectorAll(".sc-table td")]
          .filter((cell) => /^[a-f0-9-]{36}$/.test(cell.textContent.trim()))
          .every((cell) => cell.scrollWidth <= cell.clientWidth + 1),
      ),
      "GENERATED_BROWSER_MESSAGE_ID_OVERLAP",
    );
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "GENERATED_BROWSER_OVERFLOW",
  );
}
async function locale(value) {
  await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption(value);
  await expect(page.locator("html")).toHaveAttribute("lang", value);
}
try {
  await group("installed-cohort-and-native-notes-login", async () => {
    for (const name of ["ui", "runtime"])
      check(
        JSON.parse(
          await fs.readFile(
            path.join(consumer, "node_modules/@sc/" + name + "/package.json"),
            "utf8",
          ),
        ).version === "0.3.0",
        "GENERATED_BROWSER_INSTALLED_COHORT",
      );
    await page.goto("/notes");
    await expect(page).toHaveURL(/\/login$/);
    await accessible("login-1366-ko");
    await page.getByRole("textbox", { name: "사용자 이름", exact: true }).fill("admin");
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page
      .getByRole("form", { name: "로그인", exact: true })
      .getByRole("button", { name: "로그인", exact: true })
      .click();
    await expect(page).toHaveURL(/\/notes$/);
    await expect(page.getByRole("heading", { name: "저장 예제", exact: true })).toBeVisible();
    await accessible("notes-1366-ko");
  });
  await group("notes-validation-save-revision-conflict-and-locale-draft", async () => {
    const form = page.getByRole("form", { name: "제목 입력 폼", exact: true });
    const title = form.getByRole("textbox", { name: "제목", exact: true });
    await title.fill("외부 운영 화면 저장");
    await form.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page).toHaveURL(/\/notes\/\d+$/);
    await expect(form.getByRole("status")).toHaveText("저장했습니다.");
    const id = Number(new URL(page.url()).pathname.split("/").at(-1));
    await command("/api/notes/" + id, { title: "다른 요청의 저장", revision: 1 }, 200, "PUT");
    await title.fill("보존할 운영 입력");
    await form.getByRole("button", { name: "저장", exact: true }).click();
    await expect(form.getByRole("alert")).toBeVisible();
    await expect(title).toHaveValue("보존할 운영 입력");
    await locale("en");
    await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue(
      "보존할 운영 입력",
    );
    await accessible("notes-conflict-1366-en");
    await page.reload();
    await expect(page.getByRole("textbox", { name: "제목", exact: true })).toHaveValue(
      "다른 요청의 저장",
    );
  });
  await group("actual-window-and-rejection-collector-own-version-and-notes-route", async () => {
    const before = (await read("/api/operations/browser-errors/groups?size=100")).items.reduce(
      (sum, row) => sum + row.occurrenceCount,
      0,
    );
    expectingErrors = true;
    await page.evaluate((message) => {
      setTimeout(() => {
        throw new Error(message);
      }, 0);
      setTimeout(() => {
        Promise.reject(new Error(message));
      }, 20);
    }, canary);
    await expect.poll(() => collected.length).toBe(2);
    await expect
      .poll(async () =>
        (await read("/api/operations/browser-errors/groups?size=100")).items.reduce(
          (sum, row) => sum + row.occurrenceCount,
          0,
        ),
      )
      .toBe(before + 2);
    await expect.poll(() => expectedErrors).toBe(2);
    expectingErrors = false;
    const fields = [
      "schemaVersion",
      "clientEventId",
      "source",
      "eventCode",
      "appVersion",
      "routeCode",
      "componentCode",
    ].sort();
    for (const event of collected) {
      check(
        JSON.stringify(Object.keys(event).sort()) === JSON.stringify(fields),
        "GENERATED_BROWSER_COLLECTOR_FIELDS",
      );
      check(
        event.schemaVersion === 1 &&
          event.appVersion === "1.0.0" &&
          event.routeCode === "notes" &&
          event.componentCode === "ROOT",
        "GENERATED_BROWSER_COLLECTOR_APP_CONTRACT",
      );
      check(!JSON.stringify(event).includes(canary), "GENERATED_BROWSER_COLLECTOR_RAW_BODY");
    }
    check(
      new Set(collected.map((event) => event.source)).size === 2 &&
        collected.some((event) => event.eventCode === "WINDOW_ERROR") &&
        collected.some((event) => event.eventCode === "UNHANDLED_REJECTION"),
      "GENERATED_BROWSER_COLLECTOR_ACTUAL_SOURCES",
    );
    report.collector = {
      events: 2,
      appVersion: "1.0.0",
      routeCode: "notes",
      rawFields: 0,
      expectedRuntimeErrors: expectedErrors,
    };
  });
  for (const width of [1366, 390])
    for (const language of ["ko", "en"]) {
      await group(`operations-three-pages-${width}-${language}`, async () => {
        await page.setViewportSize({ width, height: 844 });
        for (const [route, ko, en] of [
          ["messages", "메시지 처리", "Message processing"],
          ["schedules", "작업 예약", "Job schedules"],
          ["browser-errors", "브라우저 오류", "Browser errors"],
        ]) {
          await page.goto("/operations/" + route);
          await locale(language);
          await expect(
            page.getByRole("heading", { name: language === "ko" ? ko : en, exact: true }),
          ).toBeVisible();
          if (route === "browser-errors")
            await expect(
              page
                .getByRole("button")
                .filter({
                  hasText: language === "ko" ? /^발생 이력$/ : /^Occurrence history$/,
                })
                .first(),
            ).toBeVisible();
          await accessible(`${route}-${width}-${language}`);
        }
      });
    }
  await group("no-debug-global-unexpected-errors-or-private-evidence", async () => {
    check(
      await page.evaluate(
        () => !Object.keys(window).some((key) => /sc.*debug|debug.*sc/i.test(key)),
      ),
      "GENERATED_BROWSER_DEBUG_GLOBAL",
    );
    check(
      !report.unexpectedErrors.length && !report.failedAssets.length,
      "GENERATED_BROWSER_UNEXPECTED_ERRORS",
    );
    check(
      !JSON.stringify(report).includes(password) && !JSON.stringify(report).includes(canary),
      "GENERATED_BROWSER_PRIVATE_EVIDENCE",
    );
  });
  report.passed = true;
} catch (error) {
  report.failure = {
    phase,
    type: error.name,
    code:
      typeof error.message === "string" && /^GENERATED_BROWSER_[A-Z_]+$/.test(error.message)
        ? error.message
        : "GENERATED_BROWSER_ASSERTION",
  };
  console.error("FAIL " + phase + " (" + error.name + ")");
} finally {
  await context.close();
  await browser.close();
  await fs.writeFile(path.join(output, "summary.json"), JSON.stringify(report, null, 2) + "\n");
}
if (!report.passed) process.exitCode = 1;

// 외부 생성 앱의 실행 JAR만 접속한다. 테스트 계정 값은 파일에서 읽고 결과에 기록하지 않는다.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const options = {};
for (let index = 2; index < process.argv.length; index++) {
  const key = process.argv[index];
  if (
    !["--base-url", "--secret-file", "--output", "--patterns"].includes(key) ||
    !process.argv[index + 1]
  )
    throw new Error(
      "base URL, private secret file, evidence output and patterns on/off are required",
    );
  options[key] = process.argv[++index];
}
const base = new URL(options["--base-url"]);
assert.equal(base.hostname, "127.0.0.1");
const password = await fs.readFile(options["--secret-file"], "utf8");
const output = path.resolve(options["--output"]);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  baseURL: base.href,
  viewport: { width: 1366, height: 900 },
});
const page = await context.newPage();
const errors = [];
const failedAssets = [];
const requests = [];
page.on("pageerror", (error) => errors.push(error.name));
page.on("request", (request) =>
  requests.push({ path: new URL(request.url()).pathname, method: request.method() }),
);
page.on("requestfailed", (request) => {
  if (!request.url().includes("/api/")) failedAssets.push(new URL(request.url()).pathname);
});
page.on("dialog", (dialog) => dialog.accept());
const report = {
  stage: process.env.SC_EVIDENCE_STAGE ?? "011",
  passed: false,
  groups: [],
  axe: [],
  errors,
  failedAssets,
  screenshots: [],
};
async function group(name, action) {
  await action();
  report.groups.push({ name, passed: true });
  console.log(`PASS ${name}`);
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
  const results = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
      },
    }),
  );
  const duplicates = await page.evaluate(() => {
    const seen = new Set();
    const duplicates = [];
    for (const element of document.querySelectorAll("[id]")) {
      if (seen.has(element.id)) duplicates.push(element.id);
      seen.add(element.id);
    }
    return duplicates;
  });
  await fs.writeFile(
    path.join(output, `${name}-axe.json`),
    JSON.stringify({ results, duplicates, manualReviewComplete: false }, null, 2),
  );
  assert.deepEqual(
    results.violations.map(({ id }) => id),
    [],
  );
  assert.deepEqual(duplicates, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  report.axe.push({
    name,
    violations: 0,
    duplicateIds: 0,
    incomplete: results.incomplete.length,
    manualReviewComplete: false,
  });
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
  report.screenshots.push(`${name}.png`);
}
try {
  await group("packed login, native form and CSS tokens", async () => {
    await page.goto("/notes");
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole("textbox", { name: "사용자 이름", exact: true }).fill("admin");
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page
      .getByRole("form", { name: "로그인", exact: true })
      .getByRole("button", { name: "로그인", exact: true })
      .click();
    await expect(page).toHaveURL(/\/notes$/);
    await expect(page.getByRole("heading", { name: "저장 예제", exact: true })).toBeVisible();
    const css = await page.evaluate(() => ({
      primary: getComputedStyle(document.documentElement)
        .getPropertyValue("--sc-color-primary")
        .trim(),
      spacing: getComputedStyle(document.documentElement).getPropertyValue("--sc-space-4").trim(),
      buttonRadius: getComputedStyle(document.querySelector(".sc-action-button")).borderRadius,
    }));
    assert.equal(css.primary, "#21647a");
    assert.equal(css.spacing, "16px");
    assert.equal(css.buttonRadius, "6px");
    report.css = css;
    await accessible("notes-1366-ko");
  });
  await group("typed Notes API, Zod, Query invalidation and 409 draft preservation", async () => {
    const form = page.getByRole("form", { name: "제목 입력 폼", exact: true });
    const title = form.getByRole("textbox", { name: "제목", exact: true });
    await form.getByRole("button", { name: "저장", exact: true }).click();
    await expect(title).toHaveAccessibleDescription("제목을 입력하세요.");
    await title.fill("외부 tarball 저장 예제");
    await form.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page).toHaveURL(/\/notes\/\d+$/);
    await expect(title).toHaveValue("외부 tarball 저장 예제");
    await expect(form.getByRole("status")).toHaveText("저장했습니다.");
    const id = Number(new URL(page.url()).pathname.split("/").at(-1));
    const csrf = await (await context.request.get("/api/auth/csrf")).json();
    const update = await context.request.put(`/api/notes/${id}`, {
      headers: { [csrf.headerName]: csrf.token },
      data: { title: "다른 요청의 저장", revision: 1 },
    });
    assert.equal(update.status(), 200);
    await title.fill("보존할 409 입력");
    await form.getByRole("button", { name: "저장", exact: true }).click();
    await expect(form.getByRole("alert")).toBeVisible();
    await expect(title).toHaveValue("보존할 409 입력");
    assert.equal(
      (await (await context.request.get(`/api/notes/${id}`)).json()).title,
      "다른 요청의 저장",
    );
    report.noteId = id;
    await accessible("notes-conflict-1366-ko");
    await page.reload();
    await expect(title).toHaveValue("다른 요청의 저장");
  });
  if (options["--patterns"] === "on") {
    await page.goto("/patterns");
    await expect(page.getByRole("heading", { name: "공통 기능 예제", exact: true })).toBeVisible();
    await group("packed shared form, locale preservation and dialog focus", async () => {
      const form = page.getByRole("form", { name: "공통 입력 폼", exact: true });
      await form.getByRole("textbox", { name: "제목", exact: true }).fill("공개 패키지 입력");
      await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption("en");
      const english = page.getByRole("form", { name: "Shared input form", exact: true });
      await expect(english.getByRole("textbox", { name: "Title", exact: true })).toHaveValue(
        "공개 패키지 입력",
      );
      const reset = english.getByRole("button", { name: "Reset", exact: true });
      await reset.click();
      const dialog = page.getByRole("dialog", { name: "Confirm draft reset", exact: true });
      await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(reset).toBeFocused();
      await reset.click();
      await dialog.getByRole("button", { name: "Reset", exact: true }).click();
      await expect(english.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("");
      await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption("ko");
    });
    const beforePatterns = requests.length;
    await group("packed table, 10000-row virtual view and keyboard focus", async () => {
      const small = page.locator(".sc-data-table").first();
      await small.getByRole("checkbox", { name: "예제 00001 선택", exact: true }).check();
      await small.getByRole("button", { name: "수량: 오름차순 정렬", exact: true }).click();
      await small.getByRole("button", { name: "수량: 내림차순 정렬", exact: true }).click();
      await expect(small.locator("tbody [data-row-key]").first()).toHaveAttribute(
        "data-row-key",
        "sample-30",
      );
      const virtual = page.locator(".sc-virtual-table");
      await expect(
        virtual.getByRole("table", { name: "가상 표 10,000행", exact: true }),
      ).toHaveAttribute("aria-rowcount", "10001");
      assert((await virtual.locator("[data-row-key]").count()) <= 64);
      await virtual.getByRole("button", { name: "마지막 행으로 이동", exact: true }).click();
      await expect(
        virtual.getByRole("checkbox", { name: "예제 00001 선택", exact: true }),
      ).toBeFocused();
      await expect(virtual.locator('[data-row-key="sample-1"]')).toHaveAttribute(
        "aria-rowindex",
        "10001",
      );
      await virtual.getByRole("button", { name: "첫 행으로 이동", exact: true }).click();
      await expect(
        virtual.getByRole("checkbox", { name: "예제 10000 선택", exact: true }),
      ).toBeFocused();
      await expect(virtual.locator('[data-row-key="sample-10000"]')).toHaveAttribute(
        "aria-rowindex",
        "2",
      );
    });
    await group("packed SVG chart, rich text and XLSX download/import", async () => {
      const chart = page.getByRole("figure", { name: "중립 차트", exact: true });
      await expect(chart.locator(".sc-chart__plot svg")).toBeVisible();
      await chart.locator("summary").click();
      const chartTable = chart.getByRole("table", { name: "중립 차트 — 차트 데이터", exact: true });
      await expect(chartTable).toBeVisible();
      await page.getByRole("button", { name: "자료 변경", exact: true }).click();
      await expect(
        chartTable.getByRole("row", { name: /^A / }).getByRole("cell").first(),
      ).toHaveText("17");
      const editor = page.getByRole("textbox", { name: "서식 입력", exact: true });
      await editor.fill("");
      await page.getByRole("button", { name: "굵게", exact: true }).click();
      await editor.pressSequentially("배포 서식");
      await page
        .locator("summary")
        .filter({ hasText: /^JSON$/ })
        .click();
      await expect(page.locator(".extension-patterns__json")).toContainText('"type": "bold"');
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Excel 내보내기 (3)", exact: true }).click();
      const download = await downloadPromise;
      assert.equal(download.suggestedFilename(), "sc-examples.xlsx");
      await page.getByLabel("XLSX 파일", { exact: true }).setInputFiles(await download.path());
      await expect(
        page.getByRole("status").filter({ hasText: /^미리보기 자료: 3$/ }),
      ).toBeVisible();
      await page.getByRole("button", { name: "예제 자료에 반영", exact: true }).click();
      await expect(
        page.getByRole("table", { name: "엑셀 가져오기·내보내기 (3)", exact: true }),
      ).toContainText("=SUM(1,2)");
    });
    await group("packed board movement, normalized image box and zoom", async () => {
      const board = page.getByRole("region", { name: "중립 작업 항목", exact: true });
      const alpha = board.locator('[data-sc-board-key="a"]:not([aria-hidden="true"])');
      await alpha.getByRole("combobox", { name: "목적 열", exact: true }).selectOption("finished");
      await alpha.getByRole("button", { name: "Alpha: 이동", exact: true }).click();
      await expect(board.getByRole("region", { name: "완료 (1)", exact: true })).toContainText(
        "Alpha",
      );
      await expect(alpha.getByRole("button", { name: "이동: Alpha", exact: true })).toBeFocused();
      await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption("en");
      const imageSection = page.getByRole("region", { name: "Image annotation", exact: true });
      const image = imageSection.locator(".sc-image-annotator");
      const names = ["Horizontal start", "Vertical start", "Width", "Height"];
      const values = ["0.2", "0.15", "0.25", "0.35"];
      for (let i = 0; i < names.length; i++)
        await image.getByRole("spinbutton", { name: names[i], exact: true }).fill(values[i]);
      await image.getByRole("button", { name: "Apply coordinates", exact: true }).click();
      const normalized = '{"x":0.2,"y":0.15,"width":0.25,"height":0.35}';
      await expect(imageSection.locator('output[aria-label="Normalized box"]')).toHaveText(
        normalized,
      );
      const zoom = image.getByRole("slider", { name: "Zoom", exact: true });
      await zoom.focus();
      await zoom.press("ArrowRight");
      await expect(zoom).toHaveValue("1.25");
      await expect(imageSection.locator('output[aria-label="Normalized box"]')).toHaveText(
        normalized,
      );
      const jsonPreview = page.getByRole("region", { name: / JSON$/ });
      await expect(jsonPreview).toHaveAttribute("tabindex", "0");
      await jsonPreview.focus();
      await expect(jsonPreview).toBeFocused();
      assert.equal(
        await jsonPreview.evaluate((element) => element.scrollHeight > element.clientHeight),
        true,
      );
      await jsonPreview.press("ArrowDown");
      await expect
        .poll(() => jsonPreview.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
      await accessible("patterns-1366-en");
      await page.setViewportSize({ width: 390, height: 844 });
      await accessible("patterns-390-en");
    });
    assert.deepEqual(
      requests
        .slice(beforePatterns)
        .filter(({ path, method }) => path.startsWith("/api/") && method !== "GET"),
      [],
    );
  } else {
    await group("disabled optional route and optional chunk requests", async () => {
      const beginning = requests.length;
      await page.goto("/patterns");
      await expect(page).toHaveURL(/\/notes$/);
      assert.equal(
        await page.getByRole("link", { name: "공통 기능 예제", exact: true }).count(),
        0,
      );
      const optional = requests
        .slice(beginning)
        .filter(({ path }) =>
          /PatternsPage|BoardPatterns|ImagePatterns|ExtensionPatterns|TablePatterns/.test(path),
        );
      assert.deepEqual(optional, []);
      report.optionalChunkRequests = 0;
    });
  }
  await group("logout clears the shared session", async () => {
    await page.getByRole("button", { name: /^(로그아웃|Sign out)$/, exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    assert.equal((await context.request.get("/api/notes")).status(), 401);
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(failedAssets, []);
  report.passed = true;
} finally {
  await fs.writeFile(path.join(output, "summary.json"), JSON.stringify(report, null, 2) + "\n");
  await context.close();
  await browser.close();
}

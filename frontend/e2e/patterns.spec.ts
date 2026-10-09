// Playwright가 만든 임시 H2/JAR와 합성 XLSX만 사용한다. 사용자 DB·계정·업로드는 읽지 않는다.
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import ExcelJS from "exceljs";

async function loginReference(page: Page) {
  const metadata = JSON.parse(
    await fs.readFile(new URL("../../.runtime/e2e.json", import.meta.url), "utf8"),
  ) as { passwordFile: string };
  const csrfResponse = await page.request.get("/api/auth/csrf");
  expect(csrfResponse.status()).toBe(200);
  const csrf = (await csrfResponse.json()) as { headerName: string; token: string };
  const response = await page.request.post("/api/auth/login", {
    form: { username: "admin", password: await fs.readFile(metadata.passwordFile, "utf8") },
    headers: { [csrf.headerName]: csrf.token },
  });
  expect(response.status()).toBe(204);
}

function observeBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  return errors;
}

async function openPatterns(page: Page) {
  await page.goto("/patterns");
  await expect(page.getByRole("heading", { name: "공통 기능 예제", exact: true })).toBeVisible();
}

async function exerciseInputForm(page: Page, destination: "Examples" | "Get started") {
  const koreanForm = page.getByRole("form", { name: "공통 입력 폼", exact: true });
  const title = koreanForm.getByRole("textbox", { name: "제목", exact: true });
  const category = koreanForm.locator("input[role='combobox']");
  const description = koreanForm.getByRole("textbox", { name: "설명", exact: true });
  const accepted = koreanForm.getByRole("checkbox", { name: "검토 내용 확인", exact: true });
  await koreanForm.getByRole("button", { name: "저장", exact: true }).click();
  await expect(title).toHaveAccessibleDescription("입력해 주세요.");
  await expect(category).toHaveAccessibleDescription("입력해 주세요.");
  await expect(accepted).toHaveAccessibleDescription("검토 내용을 확인해 주세요.");

  const draft = "  언어 전환 중 보존할 한국어 제목  ";
  const multiline = "첫 번째 설명\n두 번째 설명";
  await title.fill(draft);
  await description.fill(multiline);
  await category.focus();
  await category.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(category).toHaveValue("개발");
  await accepted.focus();
  await accepted.press("Space");
  await expect(accepted).toBeChecked();

  await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const form = page.getByRole("form", { name: "Shared input form", exact: true });
  const englishTitle = form.getByRole("textbox", { name: "Title", exact: true });
  const englishCategory = form.locator("input[role='combobox']");
  const englishDescription = form.getByRole("textbox", { name: "Description", exact: true });
  const englishAccepted = form.getByRole("checkbox", { name: "Review acknowledged", exact: true });
  await expect(englishTitle).toHaveValue(draft);
  await expect(englishDescription).toHaveValue(multiline);
  await expect(englishCategory).toHaveValue("Development");
  await expect(englishAccepted).toBeChecked();
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(form.getByRole("status")).toHaveText(`Local validation completed. ${draft.trim()}`);
  // 파싱된 trim 값과 화면 초안을 구분한다. 검증 성공만으로 입력을 초기화하지 않는다.
  await expect(englishTitle).toHaveValue(draft);
  await expect(englishTitle).not.toHaveAttribute("aria-invalid", "true");

  const navigation = page.getByRole("navigation", { name: "Navigation", exact: true });
  await navigation.getByRole("link", { name: destination, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm draft reset", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/patterns$/);
  await expect(englishTitle).toHaveValue(draft);
  await expect(englishDescription).toHaveValue(multiline);

  const reset = form.getByRole("button", { name: "Reset", exact: true });
  await reset.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(reset).toBeFocused();
  await expect(englishTitle).toHaveValue(draft);
  await reset.click();
  await dialog.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(englishTitle).toHaveValue("");
  await expect(englishCategory).toHaveValue("");
  await expect(englishDescription).toHaveValue("");
  await expect(englishAccepted).not.toBeChecked();
  await expect(form.getByRole("status")).toHaveCount(0);

  // locale별 Zod 메시지도 재제출 시 실제로 다시 계산된다.
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(englishTitle).toHaveAccessibleDescription("Please enter a value.");
  await expect(englishAccepted).toHaveAccessibleDescription("Please acknowledge the review.");
  await englishTitle.fill("이동 확인용 초안");
  await navigation.getByRole("link", { name: destination, exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page).toHaveURL(destination === "Examples" ? /\/examples$/ : /\/$/);
  await expect(page.getByRole("form", { name: "Shared input form", exact: true })).toHaveCount(0);
}

async function exerciseTables(page: Page) {
  const small = page.locator(".sc-data-table").first();
  const firstSelection = small.getByRole("checkbox", { name: "예제 00001 선택", exact: true });
  await firstSelection.check();
  await small.getByRole("button", { name: "수량: 오름차순 정렬", exact: true }).click();
  await small.getByRole("button", { name: "수량: 내림차순 정렬", exact: true }).click();
  await expect(small.locator("tbody [data-row-key]").first()).toHaveAttribute(
    "data-row-key",
    "sample-30",
  );
  await expect(small.getByRole("columnheader", { name: /수량/ })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  await small.getByRole("button", { name: "다음 페이지", exact: true }).click();
  await expect(small.locator("tbody [data-row-key]").first()).toHaveAttribute(
    "data-row-key",
    "sample-20",
  );
  await expect(small.getByRole("status")).toHaveText("1개 선택");
  await small.getByRole("button", { name: "수량: 정렬 해제", exact: true }).click();
  await expect(firstSelection).toBeChecked();

  const virtual = page.locator(".sc-virtual-table");
  const viewport = virtual.getByRole("region", { name: "가상 표 10,000행 표 영역", exact: true });
  const table = virtual.getByRole("table", { name: "가상 표 10,000행", exact: true });
  await expect(table).toHaveAttribute("aria-rowcount", "10001");
  const selected = virtual.getByRole("checkbox", { name: "예제 00001 선택", exact: true });
  await expect(selected).toBeChecked();
  await selected.focus();
  const counts = [await viewport.locator("[data-row-key]").count()];
  expect(counts[0]).toBeGreaterThan(0);
  expect(counts[0]).toBeLessThanOrEqual(64);
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight / 2;
  });
  const middle = viewport.locator('[data-row-key="sample-5001"]');
  await expect(middle).toContainText("예제 05001");
  await expect(selected).toBeFocused();
  counts.push(await viewport.locator("[data-row-key]").count());
  await virtual.getByRole("button", { name: "마지막 행으로 이동", exact: true }).click();
  const last = virtual.getByRole("checkbox", { name: "예제 10000 선택", exact: true });
  await expect(last).toBeFocused();
  await last.press("Space");
  await expect(last).toBeChecked();
  await expect(viewport.locator('[data-row-key="sample-10000"]')).toHaveAttribute(
    "aria-rowindex",
    "10001",
  );
  counts.push(await viewport.locator("[data-row-key]").count());
  await virtual.getByRole("button", { name: "첫 행으로 이동", exact: true }).click();
  await expect(selected).toBeFocused();
  await expect(selected).toBeChecked();
  expect(Math.max(...counts)).toBeLessThanOrEqual(64);

  await virtual.getByRole("button", { name: "일반 페이지 표 보기", exact: true }).click();
  await expect(virtual.locator("tbody [data-row-key]")).toHaveCount(20);
  await expect(selected).toBeChecked();
  await virtual.getByRole("button", { name: "가상 스크롤 보기", exact: true }).click();
  await expect(table).toHaveAttribute("aria-rowcount", "10001");
  await expect(selected).toBeChecked();

  const list = page.locator(".sc-virtual-list");
  await list.getByRole("button", { name: "첫 행으로 이동", exact: true }).click();
  const firstItem = list.getByRole("button", { name: "예제 00001", exact: true });
  await expect(firstItem).toBeFocused();
  await firstItem.press("End");
  const lastItem = list.getByRole("button", { name: "예제 10000", exact: true });
  await expect(lastItem).toBeFocused();
  await expect(list.locator('[data-row-key="sample-10000"]')).toHaveAttribute(
    "aria-posinset",
    "10000",
  );
  await expect(list.locator('[data-row-key="sample-10000"]')).toHaveAttribute(
    "aria-setsize",
    "10000",
  );
  expect(await list.locator("[data-row-key]").count()).toBeLessThanOrEqual(64);

  await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption("en");
  await expect(
    small.getByRole("table", { name: "Sorting, pagination and selection", exact: true }),
  ).toBeVisible();
  await expect(
    small.getByRole("checkbox", { name: "Select 예제 00001", exact: true }),
  ).toBeChecked();
  await expect(small.getByRole("status")).toHaveText("2 selected");
}

async function exerciseExtensions(page: Page) {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.startsWith("/api/") &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())
    )
      writes.push(request.method());
  });
  const chart = page.getByRole("figure", { name: "중립 차트", exact: true });
  await expect(chart.locator(".sc-chart__plot svg")).toBeVisible();
  await chart.locator("summary").focus();
  await page.keyboard.press("Enter");
  const chartTable = chart.getByRole("table", { name: "중립 차트 — 차트 데이터", exact: true });
  await expect(chartTable).toBeVisible();
  const selection = chart.getByRole("button", { name: "항목 선택 A", exact: true });
  await selection.focus();
  await selection.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: /^선택한 항목: A$/ })).toBeVisible();
  await page.getByRole("button", { name: "자료 변경", exact: true }).click();
  await expect(chartTable.getByRole("row", { name: /^A / }).getByRole("cell").first()).toHaveText(
    "17",
  );
  await page.getByRole("button", { name: "선 그래프로", exact: true }).click();
  await expect(page.getByRole("button", { name: "막대 그래프로", exact: true })).toBeVisible();
  await expect(chart.locator(".sc-chart__plot svg")).toBeVisible();

  const editor = page.getByRole("textbox", { name: "서식 입력", exact: true });
  await editor.fill("");
  await page.getByRole("button", { name: "굵게", exact: true }).click();
  await editor.pressSequentially("한국어 서식 초안");
  await page
    .locator("summary")
    .filter({ hasText: /^JSON$/ })
    .focus();
  await page.keyboard.press("Enter");
  const json = page.locator(".extension-patterns__json");
  await expect(json).toContainText("한국어 서식 초안");
  await expect(json).toContainText('"type": "bold"');
  const documentBefore = JSON.parse((await json.textContent())!);
  await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption("en");
  await expect(page.getByRole("textbox", { name: "Rich text input", exact: true })).toHaveText(
    "한국어 서식 초안",
  );
  await expect(page.getByRole("button", { name: "Bold", exact: true })).toBeVisible();
  expect(JSON.parse((await json.textContent())!)).toEqual(documentBefore);
  await expect(page.getByRole("status").filter({ hasText: /^Selected datum: A$/ })).toBeVisible();

  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel (3)", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("sc-examples.xlsx");
  const path = await download.path();
  if (!path) throw new Error("임시 XLSX 다운로드 경로가 없습니다.");
  // 앱의 adapter로 다시 읽지 않고 별도의 실제 Workbook으로 파일 내용을 확인한다.
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.getWorksheet("Examples")!;
  expect(sheet.rowCount).toBe(4);
  expect([1, 2, 3, 4].map((column) => sheet.getRow(1).getCell(column).value)).toEqual([
    "Name",
    "Quantity",
    "UTC",
    "Note",
  ]);
  expect(sheet.getCell("A2").value).toBe("한글 예제");
  expect(sheet.getCell("B2").value).toBe(3);
  expect((sheet.getCell("C2").value as Date).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  expect(sheet.getCell("D3").value).toBe("=SUM(1,2)");
  expect(sheet.getCell("D3").type).toBe(ExcelJS.ValueType.String);

  const upload = new ExcelJS.Workbook();
  const uploadSheet = upload.addWorksheet("Examples");
  uploadSheet.addRow(["Name", "Quantity", "UTC", "Note"]);
  uploadSheet.addRow([
    "명시적으로 반영한 한국어",
    7,
    new Date("2026-02-03T00:00:00.000Z"),
    "@문자열",
  ]);
  uploadSheet.getColumn(3).numFmt = "yyyy-mm-dd hh:mm:ss";
  const payload = {
    name: "synthetic-import.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await upload.xlsx.writeBuffer()),
  };
  const actualFile = page.getByLabel("XLSX file", { exact: true });
  // 파일 선택은 native input으로 처리하며 업로드 직후의 staging과 실제 자료를 구분한다.
  const excelTable = page.getByRole("table", { name: "Excel import and export (3)", exact: true });
  await actualFile.setInputFiles(payload);
  await expect(page.getByRole("status").filter({ hasText: /^Import preview: 1$/ })).toBeVisible();
  await expect(excelTable).toBeVisible();
  await expect(
    excelTable.getByRole("cell", { name: "명시적으로 반영한 한국어", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel import", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Import preview:/ })).toHaveCount(0);
  await expect(excelTable).toBeVisible();
  await expect(actualFile).toHaveValue("");
  await actualFile.setInputFiles(payload);
  await expect(page.getByRole("status").filter({ hasText: /^Import preview: 1$/ })).toBeVisible();
  await page.getByRole("button", { name: "Apply to sample data", exact: true }).click();
  const applied = page.getByRole("table", { name: "Excel import and export (1)", exact: true });
  await expect(
    applied.getByRole("cell", { name: "명시적으로 반영한 한국어", exact: true }),
  ).toBeVisible();
  await expect(
    applied.getByRole("cell", { name: "2026-02-03T00:00:00.000Z", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /^Import preview:/ })).toHaveCount(0);

  await actualFile.setInputFiles({
    name: "invalid.xlsx",
    mimeType: payload.mimeType,
    buffer: Buffer.from("synthetic invalid XLSX"),
  });
  await expect(page.getByRole("status").filter({ hasText: /^Import preview: 0$/ })).toBeVisible();
  await expect(
    page.getByText("읽을 수 있는 XLSX 파일이 아닙니다.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply to sample data", exact: true }),
  ).toBeDisabled();
  await expect(
    applied.getByRole("cell", { name: "명시적으로 반영한 한국어", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel import", exact: true }).click();
  expect(writes).toEqual([]);
}

for (const application of ["reference", "starter"] as const) {
  test.describe(`${application} 실제 JAR 공통 기능 소비`, () => {
    if (application === "starter")
      test.use({ baseURL: `http://127.0.0.1:${process.env.SC_E2E_STARTER_PORT ?? "18184"}` });
    test.beforeEach(async ({ page }) => {
      if (application === "reference") await loginReference(page);
    });
    test("한영 입력 보존·Zod 검증·초기화·dirty 이동 확인", async ({ page }) => {
      const errors = observeBrowserErrors(page);
      await openPatterns(page);
      await exerciseInputForm(page, application === "reference" ? "Examples" : "Get started");
      expect(errors).toEqual([]);
    });
    test("정렬·페이지·선택과 10,000행 실제 스크롤·focus·일반 보기", async ({ page }) => {
      const errors = observeBrowserErrors(page);
      await openPatterns(page);
      await exerciseTables(page);
      expect(errors).toEqual([]);
    });
    test("SVG 차트·키보드 선택·JSON 서식과 XLSX 다운로드·검토·반영", async ({ page }) => {
      const errors = observeBrowserErrors(page);
      await openPatterns(page);
      await exerciseExtensions(page);
      expect(errors).toEqual([]);
    });
  });
}

test("Reference dirty 폼에서 로그아웃하면 확인 Promise에 갇히지 않고 로그인 화면에 도착한다", async ({
  page,
}) => {
  const errors = observeBrowserErrors(page);
  await loginReference(page);
  await page.goto("/patterns");
  await page
    .getByRole("form", { name: "공통 입력 폼", exact: true })
    .getByRole("textbox", { name: "제목", exact: true })
    .fill("로그아웃 시 종료할 초안");
  await page.getByRole("button", { name: /^사용자 메뉴 열기:/ }).click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("아이디", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "입력 초기화 확인", exact: true })).toHaveCount(0);
  await page.goto("/patterns");
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});

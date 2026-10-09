// Playwright가 소유하는 임시 H2/JAR만 검사한다. 로그인 비밀번호는 UI/trace/axe 증거에 넣지 않는다.
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import { assertAccessible } from "./support/accessibility";

async function loginReference(page: Page) {
  const metadata = JSON.parse(
    await fs.readFile(new URL("../../.runtime/e2e.json", import.meta.url), "utf8"),
  ) as { passwordFile: string };
  const tokenResponse = await page.request.get("/api/auth/csrf");
  expect(tokenResponse.status()).toBe(200);
  const token = (await tokenResponse.json()) as { headerName: string; token: string };
  const response = await page.request.post("/api/auth/login", {
    form: { username: "admin", password: await fs.readFile(metadata.passwordFile, "utf8") },
    headers: { [token.headerName]: token.token },
  });
  expect(response.status()).toBe(204);
}

async function createExample(page: Page, title: string) {
  const csrf = (await (await page.request.get("/api/auth/csrf")).json()) as {
    headerName: string;
    token: string;
  };
  const response = await page.request.post("/api/examples", {
    data: { title },
    headers: { [csrf.headerName]: csrf.token },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: number; title: string; revision: number };
}

for (const width of [390, 1366]) {
  test(`접근성 로그인 ${width}px: 닫힌 셸과 실제 로그인 필드`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/login");
    await expect(page.getByRole("form", { name: "로그인", exact: true })).toBeVisible();
    await expect(page.getByLabel("아이디", { exact: true })).toHaveAttribute(
      "autocomplete",
      "username",
    );
    await expect(page.getByLabel("비밀번호", { exact: true })).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    await assertAccessible(page, info, "login-ko");
  });

  test(`접근성 Reference 예제 ${width}px: 기본·400 필드·409·native 확인`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await loginReference(page);
    const item = await createExample(page, `접근성 합성 예제 ${width}px`);
    await page.goto("/examples");
    const editButton = page.getByRole("button", { name: `편집: ${item.title}`, exact: true });
    await expect(editButton).toBeVisible();
    await assertAccessible(page, info, "examples-default");

    await page.route("**/api/examples", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          code: "VALIDATION",
          message: "합성 서버 입력 오류",
          errors: [{ field: "title", message: "제목을 확인해 주세요." }],
        }),
      });
    });
    await page.getByRole("button", { name: "새 예제 작성", exact: true }).click();
    const registration = page.getByRole("form", { name: "예제 등록", exact: true });
    const createInput = registration.getByRole("textbox", { name: "제목", exact: true });
    await createInput.fill("400에서도 보존되는 접근성 초안");
    await registration.getByRole("button", { name: "등록", exact: true }).click();
    await expect(createInput).toHaveAccessibleDescription("제목을 확인해 주세요.");
    await expect(
      registration.getByRole("alert").filter({ hasText: "합성 서버 입력 오류" }),
    ).toHaveText("합성 서버 입력 오류");
    await assertAccessible(page, info, "examples-field-error-400");

    if (width < 768) await page.getByRole("button", { name: "목록으로", exact: true }).click();
    await editButton.click();
    await page.route(`**/api/examples/${item.id}`, async (route) => {
      if (route.request().method() !== "PUT") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          code: "REVISION_CONFLICT",
          message: "다른 수정이 먼저 저장되었습니다.",
          errors: [],
        }),
      });
    });
    const editor = page.getByRole("form", { name: "예제 수정", exact: true });
    const draft = editor.getByRole("textbox", { name: "제목", exact: true });
    await draft.fill("409에서 유지할 접근성 초안");
    await editor.getByRole("button", { name: "저장", exact: true }).click();
    await expect(editor.getByRole("alert")).toHaveText("다른 수정이 먼저 저장되었습니다.");
    await expect(draft).toHaveValue("409에서 유지할 접근성 초안");
    await assertAccessible(page, info, "examples-conflict-409");

    const reload = editor.getByRole("button", { name: "최신 내용 불러오기", exact: true });
    await reload.click();
    const dialog = page.getByRole("dialog", { name: "입력 변경 확인", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeFocused();
    await assertAccessible(page, info, "examples-confirm-open");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(reload).toBeFocused();
    await expect(draft).toHaveValue("409에서 유지할 접근성 초안");
    await assertAccessible(page, info, "examples-confirm-closed");
  });
}

for (const application of ["reference", "starter"] as const) {
  test.describe(`${application} 실제 JAR 공통 예제 접근성`, () => {
    if (application === "starter")
      test.use({ baseURL: `http://127.0.0.1:${process.env.SC_E2E_STARTER_PORT ?? "18184"}` });
    for (const width of [390, 1366]) {
      test(`접근성 patterns ${width}px: 한국어·영어·오류·dirty·열린 모달`, async ({
        page,
      }, info) => {
        await page.setViewportSize({ width, height: 844 });
        if (application === "reference") await loginReference(page);
        await page.goto("/patterns");
        const form = page.getByRole("form", { name: "공통 입력 폼", exact: true });
        await expect(form).toBeVisible();
        const chart = page.getByRole("figure", { name: "중립 차트", exact: true });
        await expect(chart.locator(".sc-chart__plot svg")).toBeVisible();
        const richText = page.getByRole("textbox", { name: "서식 입력", exact: true });
        await expect(richText).toHaveAttribute("contenteditable", "true");
        await assertAccessible(page, info, "patterns-ko-default");

        const title = form.getByRole("textbox", { name: "제목", exact: true });
        await title.fill("접근성 검수 중 유지할 한국어 제목");
        await form
          .getByRole("textbox", { name: "설명", exact: true })
          .fill("여러 줄 설명\n입력 유지 확인");
        await richText.fill("접근성 검수 중 유지할 서식 입력");
        await page
          .locator(".sc-data-table")
          .first()
          .getByRole("checkbox", { name: "예제 00001 선택", exact: true })
          .check();
        await chart.locator("summary").focus();
        await page.keyboard.press("Enter");
        await expect(
          chart.getByRole("table", { name: "중립 차트 — 차트 데이터", exact: true }),
        ).toBeVisible();
        await form.getByRole("button", { name: "저장", exact: true }).click();
        const category = form.locator("input[role='combobox']");
        await expect(category).toHaveAccessibleDescription("입력해 주세요.");
        await expect(
          form.getByRole("checkbox", { name: "검토 내용 확인", exact: true }),
        ).toHaveAccessibleDescription("검토 내용을 확인해 주세요.");
        await assertAccessible(page, info, "patterns-ko-dirty-errors-editor-table");

        await category.focus();
        await category.press("Enter");
        const menu = page.getByRole("listbox");
        await expect(menu).toBeVisible();
        await assertAccessible(page, info, "patterns-ko-select-menu-open");
        await page.keyboard.press("Escape");
        await expect(menu).not.toBeVisible();

        await page
          .getByRole("combobox", { name: "언어 / Language", exact: true })
          .selectOption("en");
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        const englishForm = page.getByRole("form", { name: "Shared input form", exact: true });
        await expect(englishForm.getByRole("textbox", { name: "Title", exact: true })).toHaveValue(
          "접근성 검수 중 유지할 한국어 제목",
        );
        await expect(
          page.getByRole("textbox", { name: "Rich text input", exact: true }),
        ).toHaveText("접근성 검수 중 유지할 서식 입력");
        await expect(
          page
            .locator(".sc-data-table")
            .first()
            .getByRole("checkbox", { name: "Select 예제 00001", exact: true }),
        ).toBeChecked();
        await englishForm.getByRole("button", { name: "Save", exact: true }).click();
        await expect(englishForm.locator("input[role='combobox']")).toHaveAccessibleDescription(
          "Please enter a value.",
        );
        await assertAccessible(page, info, "patterns-en-dirty-errors");

        const reset = englishForm.getByRole("button", { name: "Reset", exact: true });
        await reset.click();
        const dialog = page.getByRole("dialog", { name: "Confirm draft reset", exact: true });
        await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
        await assertAccessible(page, info, "patterns-en-confirm-open");
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
        await expect(reset).toBeFocused();
        await assertAccessible(page, info, "patterns-en-confirm-closed");

        if (width === 390) {
          const opener = page.getByRole("button", { name: "Open navigation", exact: true });
          await opener.click();
          const navigation = page.getByRole("dialog", { name: "Navigation", exact: true });
          await expect(navigation).toBeVisible();
          await assertAccessible(page, info, "patterns-en-mobile-navigation-open");
          await page.keyboard.press("Escape");
          await expect(navigation).not.toBeVisible();
          await expect(opener).toBeFocused();
          await assertAccessible(page, info, "patterns-en-mobile-navigation-closed");
        }
      });
    }
  });
}

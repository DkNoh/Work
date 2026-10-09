// 새 임시 계정·파일형 H2 서버만 사용한다. 실제 계정과 기존 앱 실행 자료는 읽지 않는다.
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";

type Example = { id: number; title: string; revision: number };
type ExamplePage = { items: Example[]; total: number; page: number; size: number };
type Csrf = { headerName: string; token: string };

async function token(page: Page): Promise<Csrf> {
  const response = await page.request.get("/api/auth/csrf");
  expect(response.status()).toBe(200);
  return (await response.json()) as Csrf;
}

async function login(page: Page) {
  const metadata = JSON.parse(
    fs.readFileSync(new URL("../../.runtime/e2e.json", import.meta.url), "utf8"),
  ) as { passwordFile: string };
  const password = fs.readFileSync(metadata.passwordFile, "utf8");
  const csrf = await token(page);
  // API 준비 요청도 브라우저와 같은 쿠키를 사용한다. 비밀번호/응답 본문은 출력하지 않는다.
  const response = await page.request.post("/api/auth/login", {
    form: { username: "admin", password },
    headers: { [csrf.headerName]: csrf.token },
  });
  expect(response.status()).toBe(204);
}

async function update(page: Page, item: Example, title: string) {
  const csrf = await token(page);
  const response = await page.request.put(`/api/examples/${item.id}`, {
    data: { title, revision: item.revision },
    headers: { [csrf.headerName]: csrf.token },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as Example;
}

async function createFixture(page: Page, title: string): Promise<Example> {
  const csrf = await token(page);
  const response = await page.request.post("/api/examples", {
    data: { title },
    headers: { [csrf.headerName]: csrf.token },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as Example;
}

test("공통 UI로 등록·수정하고 409에서도 작성 중인 입력을 보존한다", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.name));
  await page.goto("/examples");
  await expect(page.getByLabel("아이디", { exact: true })).toBeVisible();
  await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
  await login(page);
  await page.goto("/examples");
  await expect(page.getByRole("button", { name: /^사용자 메뉴 열기:/ })).toBeVisible();

  const registration = page.getByRole("form", { name: "예제 등록", exact: true });
  const originalTitle = "E2E 중립 예제";
  await registration.getByLabel("제목", { exact: true }).fill(originalTitle);
  await registration.getByRole("button", { name: "등록", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `편집: ${originalTitle}`, exact: true }),
  ).toBeVisible();
  const listing = await page.request.get("/api/examples?page=0&size=10");
  expect(listing.status()).toBe(200);
  const data = (await listing.json()) as ExamplePage;
  const item = data.items.find((row) => row.title === originalTitle);
  expect(Boolean(item)).toBe(true);

  await page.getByRole("button", { name: `편집: ${originalTitle}`, exact: true }).click();
  const editor = page.getByRole("form", { name: "예제 수정", exact: true });
  const title = editor.getByLabel("제목", { exact: true });
  const draft = "409에서 보존할 입력";
  await title.fill(draft);
  const current = await update(page, item!, "다른 요청에서 먼저 저장");
  await page.getByRole("link", { name: "공통 기능 예제", exact: true }).click();
  const leaveDialog = page.getByRole("dialog", { name: "입력 변경 확인" });
  await leaveDialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page).toHaveURL(/examples.*edit=/);
  await expect(title).toHaveValue(draft);
  const rejected = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/examples/${item!.id}` &&
      response.request().method() === "PUT",
  );
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  expect((await rejected).status()).toBe(409);
  await expect(page.getByRole("alert").filter({ hasText: /입력|변경|충돌/ })).toBeVisible();
  await expect(title).toHaveValue(draft);

  await page.getByRole("button", { name: "최신 내용 불러오기", exact: true }).click();
  const refreshDialog = page.getByRole("dialog", { name: "입력 변경 확인" });
  await expect(refreshDialog.getByRole("button", { name: "취소", exact: true })).toBeFocused();
  await refreshDialog.getByRole("button", { name: "계속 진행", exact: true }).click();
  await expect(title).toHaveValue(current.title);
  const savedTitle = "최신 revision으로 저장";
  await title.fill(savedTitle);
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `편집: ${savedTitle}`, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^사용자 메뉴 열기:/ }).click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page.getByLabel("아이디", { exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("서버 400 필드 오류에도 등록 입력과 필드 연결을 보존한다", async ({ page }) => {
  await login(page);
  await page.goto("/examples");
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
        message: "모의 서버 입력 오류",
        errors: [{ field: "title", message: "서버 제목 검증 오류" }],
      }),
    });
  });
  const form = page.getByRole("form", { name: "예제 등록", exact: true });
  const input = form.getByLabel("제목", { exact: true });
  await input.fill("400에서도 남는 입력");
  await form.getByRole("button", { name: "등록", exact: true }).click();
  await expect(input).toHaveValue("400에서도 남는 입력");
  await expect(input).toHaveAccessibleDescription("서버 제목 검증 오류");
  await expect(form.getByRole("alert").filter({ hasText: "모의 서버 입력 오류" })).toHaveText(
    "모의 서버 입력 오류",
  );
});

test("409 후 최신 조회가 500으로 실패하면 입력과 revision을 보존하고 다시 조회할 수 있다", async ({
  page,
}) => {
  await login(page);
  const item = await createFixture(page, "최신 조회 실패 예제");
  await page.goto(`/examples?edit=${item.id}`);
  const editor = page.getByRole("form", { name: "예제 수정", exact: true });
  const input = editor.getByLabel("제목", { exact: true });
  await input.fill("조회 실패에도 남는 draft");
  const current = await update(page, item, "서버 최신 제목");
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  const reload = page.getByRole("button", { name: "최신 내용 불러오기", exact: true });
  await expect(reload).toBeVisible();
  const failedList = async (route: import("@playwright/test").Route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ code: "INTERNAL", message: "최신 조회 실패", errors: [] }),
    });
  };
  await page.route("**/api/examples?*", failedList);
  await reload.click();
  await page
    .getByRole("dialog", { name: "입력 변경 확인" })
    .getByRole("button", { name: "계속 진행" })
    .click();
  await expect(editor.getByRole("alert")).toHaveText("최신 조회 실패");
  await expect(input).toHaveValue("조회 실패에도 남는 draft");
  await expect(input).toBeEnabled();
  await expect(page.getByText(`기준 revision ${item.revision}`, { exact: true })).toBeVisible();
  await expect(reload).toBeEnabled();
  await page.unroute("**/api/examples?*", failedList);
  await reload.click();
  await page
    .getByRole("dialog", { name: "입력 변경 확인" })
    .getByRole("button", { name: "계속 진행" })
    .click();
  await expect(input).toHaveValue(current.title);
  await expect(page.getByText(`기준 revision ${current.revision}`, { exact: true })).toBeVisible();
  await expect(reload).not.toBeVisible();
});

for (const outcome of ["success", "conflict"] as const) {
  test(`저장 중 선택 변경: 이전 항목의 ${outcome} 응답이 새 폼을 바꾸지 않는다`, async ({
    page,
  }) => {
    await login(page);
    const first = await createFixture(page, `지연 요청 A ${outcome}`);
    const second = await createFixture(page, `다음 선택 B ${outcome}`);
    await page.goto(`/examples?edit=${first.id}`);
    const editor = page.getByRole("form", { name: "예제 수정", exact: true });
    const input = editor.getByLabel("제목", { exact: true });
    await input.fill(`A draft ${outcome}`);
    let releaseRequest: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    let observeRequest: (() => void) | undefined;
    const observed = new Promise<void>((resolve) => {
      observeRequest = resolve;
    });
    await page.route(`**/api/examples/${first.id}`, async (route) => {
      if (route.request().method() !== "PUT") {
        await route.continue();
        return;
      }
      observeRequest?.();
      await gate;
      if (outcome === "success") await route.continue();
      else
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ code: "CONFLICT", message: "A의 지연 충돌", errors: [] }),
        });
    });
    try {
      await editor.getByRole("button", { name: "저장", exact: true }).click();
      await observed;
      await page.getByRole("button", { name: `편집: ${second.title}`, exact: true }).click();
      await page
        .getByRole("dialog", { name: "입력 변경 확인" })
        .getByRole("button", { name: "계속 진행" })
        .click();
      await expect(page).toHaveURL(new RegExp(`edit=${second.id}(?:&|$)`));
      await expect(input).toHaveValue(second.title);
      const settled = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/examples/${first.id}` &&
          response.request().method() === "PUT",
      );
      releaseRequest?.();
      expect((await settled).status()).toBe(outcome === "success" ? 200 : 409);
      await expect(editor.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
      await expect(input).toHaveValue(second.title);
      await expect(
        page.getByText(`기준 revision ${second.revision}`, { exact: true }),
      ).toBeVisible();
      await expect(editor.getByRole("alert")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "최신 내용 불러오기", exact: true }),
      ).toHaveCount(0);
    } finally {
      releaseRequest?.();
    }
  });
}

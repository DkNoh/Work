import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import { csrf } from "./support/requirements";

async function login(page: Page, starter = false) {
  const metadata = JSON.parse(
    await fs.readFile(
      new URL(
        starter ? "../../.runtime/e2e-starter.json" : "../../.runtime/e2e.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { passwordFile: string };
  const token = await csrf(page);
  const response = await page.request.post("/api/auth/login", {
    form: { username: "admin", password: await fs.readFile(metadata.passwordFile, "utf8") },
    headers: { [token.headerName]: token.token },
  });
  expect(response.status()).toBe(204);
}
async function checkOff(page: Page) {
  const requests: string[] = [];
  const errors: string[] = [];
  let disabledError = 0;
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/operations/")) requests.push(path);
  });
  page.on("pageerror", (error) => {
    if (error.message === "disabled collector canary") disabledError++;
    else errors.push(error.message);
  });
  const response = await page.request.get("/api/framework/capabilities");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    messaging: false,
    scheduler: false,
    browserErrors: false,
    observability: false,
  });
  for (const path of [
    "/operations/messages",
    "/operations/schedules",
    "/operations/browser-errors",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("status").filter({ hasText: "이 운영 기능은 활성화되지 않았습니다." }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "화면 탐색", exact: true })
        .getByRole("link", { name: /^운영/ }),
    ).toHaveCount(0);
  }
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error("disabled collector canary");
    }, 0);
  });
  await expect.poll(() => disabledError).toBe(1);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
}
test("기본 Reference OFF는 기존 탐색을 유지하고 운영 메뉴·기능 HTTP가 없다", async ({ page }) => {
  await login(page);
  await page.goto("/examples");
  const navigation = page.getByRole("navigation", { name: "화면 탐색", exact: true });
  await expect(navigation.getByRole("link", { name: "예제 목록", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "요구사항 목록", exact: true })).toBeVisible();
  await checkOff(page);
});
test.describe("기본 Starter OFF", () => {
  test.use({ baseURL: "http://127.0.0.1:" + (process.env.SC_E2E_STARTER_PORT ?? "18184") });
  test("Starter OFF는 시작·공통 기능 예제를 유지하고 운영 메뉴·기능 HTTP가 없다", async ({
    page,
  }) => {
    await login(page, true);
    await page.goto("/");
    const navigation = page.getByRole("navigation", { name: "화면 탐색", exact: true });
    await expect(
      navigation.getByRole("link", { name: "프로젝트 시작", exact: true }),
    ).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "공통 기능 예제", exact: true }),
    ).toBeVisible();
    await checkOff(page);
  });
});

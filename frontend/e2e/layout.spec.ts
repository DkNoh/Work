import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const evidenceDirectory = path.resolve(import.meta.dirname, "../../docs/검증");
const widths = [390, 1366, 1920];
const evidenceStage = process.env.SC_EVIDENCE_STAGE ?? "005";

async function captureView(page: Page, filename: string) {
  // 입력 라벨·버튼의 유한 애니메이션 완료를 기다려 실제 화면을 캡처한다.
  await page.evaluate(async () => {
    const running = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState === "running" &&
          Number.isFinite(animation.effect?.getComputedTiming().endTime),
      );
    await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
  });
  await fs.mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDirectory, filename), fullPage: true });
}

async function assertShell(page: Page, label: string, linkName: string, width: number) {
  const main = page.getByRole("main");
  await expect(main).toHaveCount(1);
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  // 입력 후 건너뛰기 링크에 돌아와 키보드로 활성화하면 실제 main에 포커스가 도착한다.
  const skip = page.getByRole("link", { name: "본문으로 이동", exact: true });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(main).toBeFocused();

  const opener = page.getByRole("button", { name: "메뉴 열기", exact: true });
  if (width < 768) {
    await expect(opener).toBeVisible();
    await opener.click();
    // 모달 동안 배경 트리거는 inert/aria-hidden이므로 상태만 DOM에서 읽는다.
    await expect(page.locator(".sc-app-shell__menu-toggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(page.locator(".sc-app-shell__header")).toHaveAttribute("inert", "");
    const dialog = page.getByRole("dialog", { name: label, exact: true });
    await expect(dialog).toBeVisible();
    const closer = dialog.getByRole("button", { name: "메뉴 닫기", exact: true });
    const current = dialog.getByRole("link", { name: linkName, exact: true });
    await expect(closer).toBeFocused();
    await expect(current).toHaveAttribute("aria-current", "page");
    // 실제 모달의 Tab 순환과 역방향 순환: 배경의 로그아웃·입력으로 빠지지 않는다.
    const navigationLinks = dialog.getByRole("link");
    const linkCount = await navigationLinks.count();
    expect(linkCount).toBeGreaterThan(0);
    for (let index = 0; index < linkCount; index += 1) {
      await page.keyboard.press("Tab");
      await expect(navigationLinks.nth(index)).toBeFocused();
    }
    await page.keyboard.press("Tab");
    await expect(closer).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(navigationLinks.last()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
    await expect(opener).toHaveAttribute("aria-expanded", "false");

    await opener.click();
    await current.click();
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();

    await opener.click();
    await page.setViewportSize({ width: 1366, height: 844 });
    await expect(dialog).not.toBeVisible();
    const desktopCurrent = page
      .getByRole("navigation", { name: label, exact: true })
      .getByRole("link", { name: linkName, exact: true });
    await expect(desktopCurrent).toBeFocused();
    await page.setViewportSize({ width, height: 844 });
    await expect(opener).toBeVisible();
    await expect(opener).toBeFocused();
  } else {
    await expect(opener).not.toBeVisible();
    const current = page
      .getByRole("navigation", { name: label, exact: true })
      .getByRole("link", { name: linkName, exact: true });
    await expect(current).toBeVisible();
    await expect(current).toHaveAttribute("aria-current", "page");
  }
  await main.focus();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

for (const width of widths) {
  test(`레퍼런스 ${width}px: 한국어·본문·현재 메뉴·모바일 키보드 탐색`, async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.name));
    await page.setViewportSize({ width, height: 844 });
    if (width === 390) await page.emulateMedia({ reducedMotion: "reduce" });
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
    const currentCsrf = (await (await page.request.get("/api/auth/csrf")).json()) as typeof csrf;
    const longTitle = `${width}px 긴한국어제목줄바꿈검증`.repeat(8);
    const created = await page.request.post("/api/examples", {
      data: { title: longTitle },
      headers: { [currentCsrf.headerName]: currentCsrf.token },
    });
    expect(created.status()).toBe(201);
    await page.goto("/examples");
    await expect(
      page.getByRole("button", { name: `편집: ${longTitle}`, exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "본문으로 이동", exact: true })).toBeFocused();
    const draft = "레이아웃 변경 중 보존할 등록 제목";
    if (width < 1200) {
      await page.getByRole("button", { name: "새 예제 작성", exact: true }).click();
    }
    const input = page
      .getByRole("form", { name: "예제 등록", exact: true })
      .getByLabel("제목", { exact: true });
    await input.fill(draft);
    await page.getByRole("link", { name: "본문으로 이동", exact: true }).focus();
    await assertShell(page, "화면 탐색", "예제 목록", width);
    // 현재 메뉴로 돌아오면 모바일 목록을 보여준다. 다시 폼을 열어 보존된 초안을 확인한다.
    if (width < 1200) {
      await page.getByRole("button", { name: "새 예제 작성", exact: true }).click();
    }
    await expect(input).toHaveValue(draft);
    if (width === 390) {
      expect(
        await page
          .locator(".sc-action-button")
          .first()
          .evaluate((element) => getComputedStyle(element).transitionDuration),
      ).toBe("0s");
    }
    const registration = page.getByRole("form", { name: "예제 등록", exact: true });
    // 라벨의 실제 애니메이션 완료를 기다려 입력값과 겹친 중간 프레임을 검수하지 않는다.
    await expect(registration.locator(".v-field-label--floating")).toBeVisible();
    await expect(registration.locator(".v-field__field > .v-field-label")).not.toBeVisible();
    await captureView(page, `${evidenceStage}-reference-${width}.png`);
    expect(browserErrors).toEqual([]);
  });
}

test.describe("최소 Starter의 독립적인 공통 셸 소비", () => {
  test.use({ baseURL: `http://127.0.0.1:${process.env.SC_E2E_STARTER_PORT ?? "18184"}` });

  for (const width of widths) {
    test(`Starter ${width}px: 동일 UI·Router·본문 탐색`, async ({ page }) => {
      const browserErrors: string[] = [];
      page.on("pageerror", (error) => browserErrors.push(error.name));
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "본문으로 이동", exact: true })).toBeFocused();
      const projectTitle = page.getByLabel("프로젝트 제목", { exact: true });
      await projectTitle.fill("작성 중인 새 프로젝트");
      await page.getByRole("link", { name: "본문으로 이동", exact: true }).focus();
      await assertShell(page, "화면 탐색", "프로젝트 시작", width);
      await expect(projectTitle).toHaveValue("작성 중인 새 프로젝트");
      await expect(
        page.getByRole("button", { name: "서버 상태 다시 확인", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "서버 상태 다시 확인", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("UP");
      const healthButton = page.getByRole("button", { name: "서버 상태 다시 확인", exact: true });
      await expect(healthButton).toBeEnabled();
      await expect(healthButton).toHaveAttribute("aria-busy", "false");
      await expect(page.locator(".v-field-label--floating")).toBeVisible();
      await expect(page.locator(".v-field__field > .v-field-label")).not.toBeVisible();
      await captureView(page, `${evidenceStage}-starter-${width}.png`);
      expect(browserErrors).toEqual([]);
    });
  }
});

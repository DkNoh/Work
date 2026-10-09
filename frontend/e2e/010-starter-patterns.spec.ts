// Starter 예제는 합성 로컬 자료만 사용하며 Reference의 계정·업무 API를 요구하지 않는다.
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { assertAccessible } from "./support/accessibility";

test.use({ baseURL: `http://127.0.0.1:${process.env.SC_E2E_STARTER_PORT ?? "18184"}` });

function observeRequests(page: Page) {
  const errors: string[] = [];
  const businessRequests: string[] = [];
  const actionRequests: string[] = [];
  let observingActions = false;
  page.on("pageerror", (error) => errors.push(error.name));
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (!pathname.startsWith("/api/")) return;
    if (!pathname.startsWith("/api/auth/")) businessRequests.push(pathname);
    if (observingActions) actionRequests.push(pathname);
  });
  return {
    errors,
    businessRequests,
    actionRequests,
    startActions() {
      observingActions = true;
    },
  };
}

async function capture(page: Page, info: TestInfo, state: string) {
  await assertAccessible(page, info, state);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("Starter 390px 보드의 native 이동·순서 변경은 로컬 자료만 바꾸고 전체 DOM 접근성을 유지한다", async ({
  page,
}, info) => {
  const observations = observeRequests(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/patterns");
  await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption("ko");
  const board = page.getByRole("region", { name: "중립 작업 항목", exact: true });
  const alpha = board.locator('[data-sc-board-key="a"]:not([aria-hidden="true"])');
  const ready = board.getByRole("region", { name: "준비 (2)", exact: true });
  await expect(ready.locator("[data-sc-board-key]")).toHaveCount(2);
  observations.startActions();

  const down = alpha.getByRole("button", { name: "Alpha: 아래로", exact: true });
  await down.focus();
  await down.press("Enter");
  await expect(ready.locator("[data-sc-board-key]").first()).toHaveAttribute(
    "data-sc-board-key",
    "b",
  );
  const up = alpha.getByRole("button", { name: "Alpha: 위로", exact: true });
  await up.focus();
  await up.press("Enter");
  await expect(ready.locator("[data-sc-board-key]").first()).toHaveAttribute(
    "data-sc-board-key",
    "a",
  );

  await alpha.getByRole("combobox", { name: "목적 열", exact: true }).selectOption("finished");
  const move = alpha.getByRole("button", { name: "Alpha: 이동", exact: true });
  await move.focus();
  await move.press("Enter");
  const finished = board.getByRole("region", { name: "완료 (1)", exact: true });
  await expect(finished.locator("[data-sc-board-key]")).toHaveCount(1);
  await expect(finished.locator("[data-sc-board-key]")).toHaveAttribute("data-sc-board-key", "a");
  await expect(board.getByRole("region", { name: "준비 (1)", exact: true })).toContainText("Beta");
  await expect(alpha.getByRole("button", { name: "이동: Alpha", exact: true })).toBeFocused();
  await alpha.getByRole("combobox", { name: "목적 열", exact: true }).selectOption("ready");
  await alpha.getByRole("button", { name: "Alpha: 이동", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(ready.locator("[data-sc-board-key]")).toHaveCount(2);
  await expect(ready.locator("[data-sc-board-key]").first()).toHaveAttribute(
    "data-sc-board-key",
    "b",
  );
  await expect(board.getByRole("region", { name: "완료 (0)", exact: true })).toContainText(
    "항목이 없습니다.",
  );
  await capture(page, info, "starter-board-390-ko");
  expect(observations.businessRequests).toEqual([]);
  expect(observations.actionRequests).toEqual([]);
  expect(observations.errors).toEqual([]);
});

test("Starter 1366px 이미지의 영어 좌표 입력·키보드 확대는 정규화된 로컬 박스를 보존하고 전체 DOM 접근성을 유지한다", async ({
  page,
}, info) => {
  const observations = observeRequests(page);
  await page.setViewportSize({ width: 1366, height: 844 });
  await page.goto("/patterns");
  await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const section = page.getByRole("region", { name: "Image annotation", exact: true });
  const figure = section.locator(".sc-image-annotator");
  await expect(figure.locator("canvas").first()).toBeVisible();
  const output = section.locator('output[aria-label="Normalized box"]');
  await expect(output).toHaveText('{"x":0.1,"y":0.1,"width":0.3,"height":0.2}');
  observations.startActions();
  const names = ["Horizontal start", "Vertical start", "Width", "Height"];
  const fields = names.map((name) => figure.getByRole("spinbutton", { name, exact: true }));
  const values = ["0.2", "0.15", "0.25", "0.35"];
  for (let index = 0; index < fields.length; index++) await fields[index]!.fill(values[index]!);
  const apply = figure.getByRole("button", { name: "Apply coordinates", exact: true });
  await apply.focus();
  await apply.press("Enter");
  const normalized = '{"x":0.2,"y":0.15,"width":0.25,"height":0.35}';
  await expect(output).toHaveText(normalized);
  const coordinates = () =>
    Promise.all(fields.map(async (input) => Number(await input.inputValue())));
  const zoom = figure.getByRole("slider", { name: "Zoom", exact: true });
  const canvas = figure.locator("canvas").first();
  const originalSize = await canvas.boundingBox();
  if (!originalSize) throw new Error("Starter canvas has no browser bounds");
  await zoom.focus();
  await zoom.press("ArrowRight");
  await expect(zoom).toHaveValue("1.25");
  await expect
    .poll(async () => (await canvas.boundingBox())?.width)
    .toBeCloseTo(originalSize.width * 1.25, 1);
  await expect(output).toHaveText(normalized);
  await expect.poll(coordinates).toEqual([0.2, 0.15, 0.25, 0.35]);
  await zoom.press("Home");
  await expect(zoom).toHaveValue("1");
  await expect
    .poll(async () => (await canvas.boundingBox())?.width)
    .toBeCloseTo(originalSize.width, 1);
  await expect(output).toHaveText(normalized);
  await fields[0]!.fill("0.9");
  await apply.click();
  await expect(figure.getByRole("alert")).toHaveText(
    "Coordinates must have a positive size within the image between 0 and 1.",
  );
  await expect(fields[0]!).toHaveAttribute("aria-invalid", "true");
  await expect(output).toHaveText(normalized);
  await fields[0]!.fill("0.2");
  await apply.click();
  await expect(figure.getByRole("alert")).toHaveCount(0);
  const annotation = figure.getByRole("button", { name: "Sample region", exact: true });
  await annotation.focus();
  await annotation.press("Enter");
  await expect(annotation).toHaveAttribute("aria-pressed", "true");
  await expect(output).toHaveText(normalized);
  await capture(page, info, "starter-image-1366-en");
  expect(observations.businessRequests).toEqual([]);
  expect(observations.actionRequests).toEqual([]);
  expect(observations.errors).toEqual([]);
});

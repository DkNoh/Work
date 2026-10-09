import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import type { components } from "../apps/reference-app/src/generated/api";
import { assertAccessible } from "./support/accessibility";
import {
  choose,
  command,
  confirmDiscard,
  csrf,
  detail,
  fixtures,
  input,
  switchActor,
  type Requirement,
} from "./support/requirements";

type Screen = components["schemas"]["ScreenResponse"];
type Version = components["schemas"]["RequirementScreenVersionResponse"];
const bodyForm = (page: Page) => page.getByRole("form", { name: "요구사항 본문", exact: true });

function observeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  return errors;
}

async function syntheticImage(page: Page, mime: "image/png" | "image/jpeg" = "image/png") {
  const data = await page.evaluate((type) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Synthetic image canvas unavailable");
    context.fillStyle = "#eff5f7";
    context.fillRect(0, 0, 640, 480);
    context.fillStyle = "#21647a";
    context.fillRect(24, 24, 592, 64);
    context.fillStyle = "#ffffff";
    context.fillRect(24, 112, 280, 320);
    context.fillRect(328, 112, 288, 320);
    return canvas.toDataURL(type);
  }, mime);
  return Buffer.from(data.split(",")[1]!, "base64");
}

async function createScreenInUi(page: Page, menuName: string, name: string) {
  await page.goto("/screens");
  const form = page.getByRole("form", { name: "화면 생성", exact: true });
  await choose(page, form, "메뉴", menuName);
  await form.getByRole("textbox", { name: "화면 이름", exact: true }).fill(name);
  const response = page.waitForResponse(
    (value) =>
      new URL(value.url()).pathname === "/api/screens" && value.request().method() === "POST",
  );
  await form.getByRole("button", { name: "화면 생성", exact: true }).click();
  const created = await response;
  expect(created.status()).toBe(200);
  const screen = (await created.json()) as Screen;
  await expect(page).toHaveURL(new RegExp(`screenId=${screen.id}`));
  return screen;
}

async function uploadInUi(page: Page, screen: Screen, buffer: Buffer, mime = "image/png") {
  const english = (await page.locator("html").getAttribute("lang")) === "en";
  const form = page.getByRole("form", {
    name: english ? "Upload image version" : "새 이미지 버전 등록",
    exact: true,
  });
  await form
    .getByLabel(english ? "PNG or JPEG file" : "PNG 또는 JPEG 파일", { exact: true })
    .setInputFiles({
      name: mime === "image/png" ? "synthetic-layout.png" : "synthetic-exif.jpg",
      mimeType: mime,
      buffer,
    });
  const response = page.waitForResponse(
    (value) =>
      new URL(value.url()).pathname === `/api/screens/${screen.id}/versions` &&
      value.request().method() === "POST",
  );
  await form
    .getByRole("button", {
      name: english ? "Upload image version" : "새 이미지 버전 등록",
      exact: true,
    })
    .click();
  const uploaded = await response;
  expect(uploaded.status()).toBe(200);
  const version = (await uploaded.json()) as Version;
  await expect(page).toHaveURL(new RegExp(`versionId=${version.id}`));
  await expect(page.locator(".sc-image-annotator canvas").first()).toBeVisible();
  return version;
}

async function applyCoordinates(page: Page, values: readonly string[], english = false) {
  const figure = page.locator(".sc-image-annotator");
  const names = english
    ? ["X", "Y", "Width", "Height"]
    : ["가로 시작", "세로 시작", "너비", "높이"];
  for (let index = 0; index < names.length; index++)
    await figure.getByRole("spinbutton", { name: names[index]!, exact: true }).fill(values[index]!);
  await figure
    .getByRole("button", { name: english ? "Apply coordinates" : "좌표 적용", exact: true })
    .click();
  const changed = english ? "Box changed" : "박스 변경";
  await expect(figure.getByRole("status").filter({ hasText: changed })).toHaveText(changed);
}

async function waitForCanvasFrames(canvas: Locator) {
  await canvas.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function canvasImageHash(canvas: Locator) {
  const rendered = await canvas.evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error("Expected rendered canvas");
    return element.toDataURL();
  });
  return createHash("sha256").update(rendered).digest("hex");
}

async function cancelBoxGesture(
  page: Page,
  info: TestInfo,
  canvas: Locator,
  coordinates: () => Promise<number[]>,
  baseline: readonly number[],
  gesture: "drag" | "resize",
) {
  await page.locator(".sc-image-viewport").focus();
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Cancellation canvas has no browser bounds");
  const start =
    gesture === "drag"
      ? { x: baseline[0]! + baseline[2]! / 2, y: baseline[1]! + baseline[3]! / 2 }
      : { x: baseline[0]! + baseline[2]!, y: baseline[1]! + baseline[3]! };
  await page.mouse.move(bounds.x + bounds.width * start.x, bounds.y + bounds.height * start.y);
  await waitForCanvasFrames(canvas);
  const before = await canvasImageHash(canvas);
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * (start.x + 0.04),
    bounds.y + bounds.height * (start.y + 0.04),
    { steps: 8 },
  );
  await waitForCanvasFrames(canvas);
  // 저장 emit이나 node 내부 상태 대신 실제 canvas 변화와 공개 좌표 입력을 검사한다.
  await expect.poll(() => canvasImageHash(canvas)).not.toBe(before);
  const active = await canvasImageHash(canvas);
  await expect.poll(coordinates).toEqual(baseline);
  await page.keyboard.press("Escape");
  await waitForCanvasFrames(canvas);
  await expect.poll(() => canvasImageHash(canvas)).toBe(before);
  await expect.poll(coordinates).toEqual(baseline);
  await page.mouse.up();
  await waitForCanvasFrames(canvas);
  await expect.poll(() => canvasImageHash(canvas)).toBe(before);
  await expect.poll(coordinates).toEqual(baseline);
  await info.attach(`trusted-${gesture}-escape`, {
    body: JSON.stringify({
      gesture,
      baseline,
      before,
      active,
      restored: await canvasImageHash(canvas),
    }),
    contentType: "application/json",
  });
}

async function capture(page: Page, info: TestInfo, name: string) {
  await assertAccessible(page, info, name);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const imagePath = info.outputPath(`${name}-image.png`);
  await page.locator(".sc-image-annotator").screenshot({ path: imagePath });
  await info.attach(`${name}-image`, { path: imagePath, contentType: "image/png" });
  await page.evaluate(() => scrollTo(0, 0));
  const pagePath = info.outputPath(`${name}-top.png`);
  await page.screenshot({ path: pagePath });
  await info.attach(`${name}-top`, { path: pagePath, contentType: "image/png" });
}

for (const width of [390, 1366]) {
  test(`image UI upload, trusted pointer, body preservation, PDF privacy and real box conflict at ${width}`, async ({
    page,
  }, info) => {
    test.setTimeout(150_000);
    const errors = observeErrors(page);
    await page.setViewportSize({ width, height: 844 });
    const fixture = await fixtures(page);
    const screen = await createScreenInUi(page, fixture.menu.name, `화면 작업 ${fixture.menu.id}`);
    await switchActor(page, fixture.author.credentials);
    await page.goto(`/screens?screenId=${screen.id}`);
    const imageBytes = await syntheticImage(page);
    const version = await uploadInUi(page, screen, imageBytes);
    expect([version.width, version.height, version.archived]).toEqual([640, 480, 0]);

    const canvas = page.locator(".sc-image-annotator canvas").first();
    await canvas.scrollIntoViewIfNeeded();
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error("Canvas has no browser bounds");
    await page.mouse.move(bounds.x + bounds.width * 0.12, bounds.y + bounds.height * 0.16);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.44, bounds.y + bounds.height * 0.51, {
      steps: 8,
    });
    await page.mouse.up();
    await expect(page.getByRole("spinbutton", { name: "너비", exact: true })).not.toHaveValue("");
    await applyCoordinates(page, ["0.1", "0.2", "0.3", "0.25"]);
    const coordinateInputs = ["가로 시작", "세로 시작", "너비", "높이"].map((name) =>
      page.getByRole("spinbutton", { name, exact: true }),
    );
    const coordinates = () =>
      Promise.all(coordinateInputs.map(async (input) => Number(await input.inputValue())));
    const zoom = page.getByRole("slider", { name: "확대", exact: true });
    await zoom.focus();
    await zoom.press("ArrowRight");
    await expect(zoom).toHaveValue("1.25");
    await expect.poll(coordinates).toEqual([0.1, 0.2, 0.3, 0.25]);
    const viewport = page.locator(".sc-image-viewport");
    await viewport.focus();
    await canvas.scrollIntoViewIfNeeded();
    const zoomed = await canvas.boundingBox();
    if (!zoomed) throw new Error("Zoomed canvas has no browser bounds");
    await page.mouse.move(zoomed.x + zoomed.width * 0.25, zoomed.y + zoomed.height * 0.325);
    await page.mouse.down();
    await page.mouse.move(zoomed.x + zoomed.width * 0.35, zoomed.y + zoomed.height * 0.425, {
      steps: 8,
    });
    await page.mouse.up();
    await expect.poll(async () => (await coordinates())[0]).toBeCloseTo(0.2, 2);
    const moved = await coordinates();
    expect(moved[1]).toBeCloseTo(0.3, 2);
    expect(moved[2]).toBeCloseTo(0.3, 2);
    expect(moved[3]).toBeCloseTo(0.25, 2);
    await page.mouse.move(
      zoomed.x + zoomed.width * (moved[0]! + moved[2]!),
      zoomed.y + zoomed.height * (moved[1]! + moved[3]!),
    );
    await page.mouse.down();
    await page.mouse.move(
      zoomed.x + zoomed.width * (moved[0]! + moved[2]! + 0.05),
      zoomed.y + zoomed.height * (moved[1]! + moved[3]! + 0.05),
      { steps: 8 },
    );
    await page.mouse.up();
    await expect.poll(async () => (await coordinates())[2]).toBeGreaterThan(moved[2]!);
    const resized = await coordinates();
    expect(resized[3]).toBeGreaterThan(moved[3]!);
    expect(resized[0]! + resized[2]!).toBeLessThanOrEqual(1);
    expect(resized[1]! + resized[3]!).toBeLessThanOrEqual(1);
    await cancelBoxGesture(page, info, canvas, coordinates, resized, "drag");
    await cancelBoxGesture(page, info, canvas, coordinates, resized, "resize");
    await page.mouse.move(zoomed.x + zoomed.width * 0.05, zoomed.y + zoomed.height * 0.7);
    await page.mouse.down();
    await page.mouse.move(zoomed.x + zoomed.width * 0.15, zoomed.y + zoomed.height * 0.85, {
      steps: 5,
    });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect.poll(coordinates).toEqual(resized);
    await zoom.focus();
    await zoom.press("Home");
    await expect(zoom).toHaveValue("1");
    await expect.poll(coordinates).toEqual(resized);
    // 센서가 작동한 뒤 수치 입력으로 정확한 원본 0~1 계약을 검증한다.
    await applyCoordinates(page, ["0.1", "0.2", "0.3", "0.25"]);
    await capture(page, info, `image-workspace-${width}-ko`);
    const form = bodyForm(page);
    await choose(page, form, "메뉴", fixture.menu.name);
    await form
      .getByRole("textbox", { name: "요구사항 제목", exact: true })
      .fill(`이미지 요청 ${width}`);
    await form
      .getByRole("textbox", { name: "원하는 동작", exact: true })
      .fill("선택한 원본 영역을 개선합니다.");
    await form
      .getByRole("textbox", { name: "요청 이유", exact: true })
      .fill("화면 흐름을 분명히 합니다.");
    await form.getByRole("button", { name: "요구사항 저장", exact: true }).click();
    await expect(page).toHaveURL(/\/requests\/\d+$/);
    const id = Number(new URL(page.url()).pathname.split("/").at(-1));
    let item = await detail(page, id);
    expect(item.screenVersionId).toBe(version.id);
    expect(item.annotation).toMatchObject({ x: 0.1, y: 0.2, width: 0.3, height: 0.25 });
    await bodyForm(page)
      .getByRole("textbox", { name: "요구사항 제목", exact: true })
      .fill(`본문 변경 ${width}`);
    await bodyForm(page).getByRole("button", { name: "요구사항 저장", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "변경 내용을 저장했습니다." }),
    ).toBeVisible();
    item = await detail(page, id);
    expect(item.screenVersionId).toBe(version.id);
    expect(item.annotation).toMatchObject({ x: 0.1, y: 0.2, width: 0.3, height: 0.25 });

    const pdfBytes = Buffer.from(
      "%PDF-1.4\n% synthetic fixture\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n",
    );
    await page
      .getByLabel("PNG, JPEG 또는 PDF 파일", { exact: true })
      .setInputFiles({ name: "한글 첨부.pdf", mimeType: "application/pdf", buffer: pdfBytes });
    const attachResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/requirements/${id}/attachments` &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "첨부 저장", exact: true }).click();
    expect((await attachResponse).status()).toBe(200);
    await expect(
      page.getByRole("button", { name: "한글 첨부.pdf: 다운로드", exact: true }),
    ).toBeVisible();
    item = await detail(page, id);
    const attachment = item.attachments[0]!;
    const fileResponse = await page.request.get(`/api/files/${attachment.fileId}`);
    expect(fileResponse.status()).toBe(200);
    expect(await fileResponse.body()).toEqual(pdfBytes);
    expect(fileResponse.headers()["cache-control"]).toContain("no-store");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "한글 첨부.pdf: 다운로드", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("한글 첨부.pdf");
    const downloaded = await download.path();
    if (!downloaded) throw new Error("Browser download unavailable");
    expect(await fs.readFile(downloaded)).toEqual(pdfBytes);
    await capture(page, info, `image-detail-${width}-ko`);

    await switchActor(page, fixture.outsider.credentials);
    expect((await page.request.get(`/api/files/${attachment.fileId}`)).status()).toBe(403);
    expect((await page.request.get(`/api/requirements/${id}`)).status()).toBe(403);
    await switchActor(page, fixture.author.credentials);
    await page.goto(`/requests/${id}`);
    await applyCoordinates(page, ["0.22", "0.21", "0.3", "0.25"]);
    const beforeConflict = await detail(page, id);
    const latest = await command<Requirement>(page, `/requirements/${id}`, "PUT", {
      ...input(fixture.menu.id, "동시 저장", beforeConflict.revision),
      screenVersionId: version.id,
      annotation: { x: 0.1, y: 0.2, width: 0.3, height: 0.25 },
    });
    const conflict = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/requirements/${id}/annotation` &&
        response.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "박스 저장", exact: true }).click();
    expect((await conflict).status()).toBe(409);
    await expect(page.getByRole("spinbutton", { name: "가로 시작", exact: true })).toHaveValue(
      "0.22",
    );
    expect((await detail(page, id)).revision).toBe(latest.revision);
    await assertAccessible(page, info, `image-conflict-${width}`);
    await page.getByRole("button", { name: "최신 내용 불러오기", exact: true }).click();
    await confirmDiscard(page);
    await expect(page.getByRole("spinbutton", { name: "가로 시작", exact: true })).toHaveValue(
      "0.1",
    );
    await page.getByRole("button", { name: "한글 첨부.pdf: 삭제", exact: true }).click();
    await page
      .getByRole("dialog", { name: "삭제", exact: true })
      .getByRole("button", { name: "확인", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "한글 첨부.pdf: 다운로드", exact: true }),
    ).toHaveCount(0);
    expect((await page.request.get(`/api/files/${attachment.fileId}`)).status()).toBe(404);
    await page.goto(`/screens?screenId=${screen.id}&versionId=${version.id}`);
    await page.getByRole("button", { name: "이 버전 보관", exact: true }).click();
    await page
      .getByRole("dialog", { name: "확인", exact: true })
      .getByRole("button", { name: "확인", exact: true })
      .click();
    await expect(page.getByRole("status").filter({ hasText: "보관됨" })).toBeVisible();
    await expect(bodyForm(page)).toHaveCount(0);
    await page.goto(`/requests/${id}`);
    await expect(page.getByRole("button", { name: "박스 저장", exact: true })).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test(`English image workspace has native coordinates and no overflow at ${width}`, async ({
    page,
  }, info) => {
    const errors = observeErrors(page);
    await page.setViewportSize({ width, height: 844 });
    const fixture = await fixtures(page);
    const screen = await command<Screen>(page, "/screens", "POST", {
      menuId: fixture.menu.id,
      name: "English image workspace",
    });
    await page.goto(`/screens?screenId=${screen.id}`);
    await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption("en");
    await expect(page.getByRole("heading", { name: "Image workspace", exact: true })).toBeVisible();
    await uploadInUi(page, screen, await syntheticImage(page));
    await applyCoordinates(page, ["0.15", "0.2", "0.25", "0.3"], true);
    await capture(page, info, `image-workspace-${width}-en`);
    expect(errors).toEqual([]);
  });
}

test("JPEG EXIF 6 uses browser-oriented original dimensions and preserves uploaded bytes", async ({
  page,
}, info) => {
  const errors = observeErrors(page);
  const fixture = await fixtures(page);
  const screen = await command<Screen>(page, "/screens", "POST", {
    menuId: fixture.menu.id,
    name: "EXIF orientation screen",
  });
  await page.goto(`/screens?screenId=${screen.id}`);
  const jpeg = await syntheticImage(page, "image/jpeg");
  const exif = Buffer.alloc(32);
  exif.write("Exif\0\0", 0, "binary");
  exif.write("II", 6, "ascii");
  exif.writeUInt16LE(42, 8);
  exif.writeUInt32LE(8, 10);
  exif.writeUInt16LE(1, 14);
  exif.writeUInt16LE(0x0112, 16);
  exif.writeUInt16LE(3, 18);
  exif.writeUInt32LE(1, 20);
  exif.writeUInt16LE(6, 24);
  const marker = Buffer.from([0xff, 0xe1, 0, 34]);
  const oriented = Buffer.concat([jpeg.subarray(0, 2), marker, exif, jpeg.subarray(2)]);
  const version = await uploadInUi(page, screen, oriented, "image/jpeg");
  expect([version.width, version.height]).toEqual([480, 640]);
  expect(await page.getByRole("button", { name: "좌표 적용", exact: true }).isEnabled()).toBe(true);
  const response = await page.request.get(`/api/files/${version.fileId}`);
  expect(response.status()).toBe(200);
  expect(await response.body()).toEqual(oriented);
  await applyCoordinates(page, ["0.2", "0.2", "0.3", "0.3"]);
  await capture(page, info, "image-exif6-browser");
  expect(errors).toEqual([]);
});

test("agreed author links ADO through the UI and exports stored plain text without an external call", async ({
  page,
}, info) => {
  const errors = observeErrors(page);
  const fixture = await fixtures(page);
  await switchActor(page, fixture.author.credentials);
  let item = await command<Requirement>(
    page,
    "/requirements",
    "POST",
    input(fixture.menu.id, "ADO 수동 연결 요청"),
  );
  item = await command<Requirement>(page, `/requirements/${item.id}/assignee`, "PUT", {
    revision: item.revision,
    reviewerId: fixture.reviewer.user.id,
  });
  item = await command<Requirement>(page, `/requirements/${item.id}/submit`, "POST", {
    revision: item.revision,
  });
  await switchActor(page, fixture.reviewer.credentials);
  item = await command<Requirement>(page, `/requirements/${item.id}/review`, "PUT", {
    revision: item.revision,
    decision: "POSSIBLE",
    rationale: "가능합니다.",
    conditions: "",
    scope: "목록",
    exclusions: "외부 API",
    acceptance: "테스트 통과",
    estimate: "SMALL",
    needsInfo: false,
  });
  await switchActor(page, fixture.author.credentials);
  item = await command<Requirement>(page, `/requirements/${item.id}/agree`, "POST", {
    revision: item.revision,
  });
  expect(item.status).toBe("AGREED");
  await page.goto(`/requests/${item.id}`);
  const form = page.getByRole("form", { name: "ADO 수동 연결", exact: true });
  await form.getByRole("textbox", { name: "티켓 번호", exact: true }).fill("SC-010");
  await form
    .getByRole("textbox", { name: "티켓 URL", exact: true })
    .fill("https://example.invalid/boards/SC-010");
  let externalRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).hostname === "example.invalid") externalRequests++;
  });
  await form.getByRole("button", { name: "연결 저장", exact: true }).click();
  await expect(page.locator(".requirement-meta")).toContainText("ADO 연결됨");
  const saved = await detail(page, item.id);
  expect(saved.ado).toMatchObject({
    ticket: "SC-010",
    url: "https://example.invalid/boards/SC-010",
    linkedBy: fixture.author.user.id,
  });
  expect(saved.revision).toBe(item.revision + 1);
  await page.getByRole("button", { name: "요구사항 텍스트 내보내기", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "내보낸 텍스트", exact: true })).toHaveValue(
    /ADO 수동 연결 요청/,
  );
  await expect(page.getByRole("textbox", { name: "내보낸 텍스트", exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  expect(externalRequests).toBe(0);
  await assertAccessible(page, info, "manual-ado-export");
  await switchActor(page);
  const token = await csrf(page);
  const denied = await page.request.put(`/api/requirements/${item.id}/ado`, {
    data: {
      revision: saved.revision,
      ticket: "ADMIN-OVERRIDE",
      url: "https://example.invalid/other",
    },
    headers: { [token.headerName]: token.token },
  });
  expect(denied.status()).toBe(403);
  expect((await detail(page, item.id)).ado?.ticket).toBe("SC-010");
  expect(errors).toEqual([]);
});

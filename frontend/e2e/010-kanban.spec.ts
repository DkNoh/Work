import { expect, test, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs/promises";
import ExcelJS from "exceljs";
import { readWorkbook, type ScWorkbookColumn } from "../packages/excel/src/index";
import type { components } from "../apps/reference-app/src/generated/api";
import { fixtures, command, csrf, switchActor, choose } from "./support/requirements";
import { assertAccessible } from "./support/accessibility";
type Task = components["schemas"]["TaskResponse"];
type Board = components["schemas"]["BoardResponse"];
type TaskInput = components["schemas"]["TaskInput"];
const form = (page: Page) => page.getByRole("form", { name: "작업 입력", exact: true });
const columns = [
  { key: "title", label: "title", type: "string" },
  { key: "description", label: "description", type: "string" },
  { key: "status", label: "status", type: "string" },
  { key: "priority", label: "priority", type: "string" },
  { key: "assigneeId", label: "assigneeId", type: "number" },
  { key: "dueDate", label: "dueDate", type: "string" },
  { key: "tags", label: "tags", type: "string" },
] as const satisfies readonly ScWorkbookColumn[];
async function setup(page: Page) {
  const fixture = await fixtures(page);
  await command(page, `/kanban/members/${fixture.author.user.id}`, "PUT", { allowed: true });
  await command(page, `/kanban/members/${fixture.reviewer.user.id}`, "PUT", { allowed: true });
  await switchActor(page, fixture.author.credentials);
  const board = await command<Board>(page, "/kanban/boards", "POST", {
    title: `010 ${fixture.author.user.username}`,
  });
  return { ...fixture, board };
}
function taskInput(boardId: number, title: string, dueDate: string | null = null): TaskInput {
  return {
    boardId,
    title,
    description: "원본 설명\n줄바꿈 유지",
    status: "TODO",
    priority: "MEDIUM",
    assigneeId: null,
    dueDate,
    tags: ["쉼표, 태그"],
  };
}
async function createTask(page: Page, board: Board, title: string, dueDate: string | null = null) {
  return command<Task>(page, "/kanban/tasks", "POST", taskInput(board.id, title, dueDate));
}
async function task(page: Page, id: number): Promise<Task> {
  const response = await page.request.get(`/api/kanban/tasks/${id}`);
  expect(response.status()).toBe(200);
  return response.json() as Promise<Task>;
}
async function tasks(page: Page, boardId: number): Promise<Task[]> {
  const response = await page.request.get(`/api/kanban/tasks?boardId=${boardId}`);
  expect(response.status()).toBe(200);
  return response.json() as Promise<Task[]>;
}
async function discard(page: Page) {
  const dialog = page.getByRole("dialog", { name: "미저장 입력 확인", exact: true });
  await dialog.getByRole("button", { name: "계속", exact: true }).click();
}
async function screenshot(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: "image/png" });
}
async function workbook(rows: unknown[][]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Tasks");
  sheet.addRow(columns.map((column) => column.label));
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await book.xlsx.writeBuffer());
}

test("칸반 실제 작성·수정은 줄바꿈·단일 쉼표 태그·0000과0099 달력 날짜를 보존한다", async ({
  page,
}) => {
  const fixture = await setup(page);
  await page.goto(`/kanban?boardId=${fixture.board.id}&taskId=new`);
  await expect(form(page).getByLabel("작업 제목", { exact: true })).toBeEnabled();
  await form(page).getByLabel("작업 제목", { exact: true }).fill("  직접 작성 작업  ");
  await form(page).getByLabel("작업 설명", { exact: true }).fill(" 원문\n 둘째 줄 ");
  await form(page).getByLabel("기한", { exact: true }).fill("0000-02-29");
  await form(page).getByLabel("태그", { exact: true }).fill("쉼표, 태그");
  await form(page).getByRole("button", { name: "태그 추가", exact: true }).click();
  await form(page).getByRole("button", { name: "작업 저장", exact: true }).click();
  await expect(page).toHaveURL(/taskId=\d+/);
  const id = Number(new URL(page.url()).searchParams.get("taskId"));
  let saved = await task(page, id);
  expect(saved).toMatchObject({
    title: "직접 작성 작업",
    description: " 원문\n 둘째 줄 ",
    dueDate: "0000-02-29",
    tags: ["쉼표, 태그"],
    authorId: fixture.author.user.id,
    boardId: fixture.board.id,
  });
  await choose(page, form(page), "상태", "완료");
  await form(page).getByLabel("기한", { exact: true }).fill("0099-12-31");
  await form(page).getByRole("button", { name: "작업 저장", exact: true }).click();
  await expect.poll(async () => (await task(page, id)).revision).toBe(2);
  saved = await task(page, id);
  expect(saved.status).toBe("DONE");
  expect(saved.dueDate).toBe("0099-12-31");
  expect(saved.completedAt).not.toBeNull();
  const completedAt = saved.completedAt;
  await form(page).getByLabel("작업 설명", { exact: true }).fill("DONE 본문만 변경");
  await form(page).getByRole("button", { name: "작업 저장", exact: true }).click();
  await expect.poll(async () => (await task(page, id)).revision).toBe(3);
  expect((await task(page, id)).completedAt).toBe(completedAt);
  expect((await task(page, id)).tags).toEqual(["쉼표, 태그"]);
});

test("칸반 멤버 접근과 타인 작업 변경 거절은 ADMIN·담당자에도 서버에서 적용한다", async ({
  page,
}) => {
  const fixture = await setup(page);
  const item = await command<Task>(page, "/kanban/tasks", "POST", {
    ...taskInput(fixture.board.id, "작성자 권한 작업"),
    assigneeId: fixture.reviewer.user.id,
  });
  for (const actor of [undefined, fixture.reviewer.credentials]) {
    await switchActor(page, actor);
    await page.goto(`/kanban?boardId=${fixture.board.id}&taskId=${item.id}`);
    await expect(form(page).getByLabel("작업 제목", { exact: true })).toHaveAttribute(
      "readonly",
      "",
    );
    await expect(form(page).getByRole("button", { name: "작업 저장" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "이동: 작성자 권한 작업", exact: true }),
    ).toBeDisabled();
    const token = await csrf(page);
    const response = await page.request.post(`/api/kanban/tasks/${item.id}/move`, {
      data: { status: "DONE", beforeId: null, revision: item.revision },
      headers: { [token.headerName]: token.token },
    });
    expect(response.status()).toBe(403);
  }
  await switchActor(page, fixture.outsider.credentials);
  await page.goto("/kanban");
  await expect(page.getByRole("alert")).toHaveText("칸반 접근 권한이 없습니다.");
  const response = await page.request.get("/api/kanban/tasks");
  expect(response.status()).toBe(403);
});

test("실제 보드 포인터·키보드 센서와 대체 이동은 저장한 작업만 이동하고 필터 정렬에서는 차단한다", async ({
  page,
}) => {
  const fixture = await setup(page);
  const alpha = await createTask(page, fixture.board, "포인터 Alpha");
  const beta = await createTask(page, fixture.board, "키보드 Beta");
  await page.goto(`/kanban?boardId=${fixture.board.id}`);
  const handle = page.getByRole("button", { name: "이동: 포인터 Alpha", exact: true });
  await expect(handle).toBeEnabled();
  const destination = page.getByRole("region", { name: "진행 중 (0)", exact: true });
  await destination.scrollIntoViewIfNeeded();
  const start = await handle.boundingBox();
  const end = await destination.boundingBox();
  expect(start).not.toBeNull();
  expect(end).not.toBeNull();
  await page.mouse.move(start!.x + 30, start!.y + 15);
  await page.mouse.down();
  await page.mouse.move(start!.x + 55, start!.y + 15, { steps: 5 });
  await expect(
    page.locator(`[data-sc-board-key='${alpha.id}']:not([aria-hidden='true'])`),
  ).toHaveClass(/sc-board-item--dragging/);
  await page.mouse.move(end!.x + 80, end!.y + 80, { steps: 15 });
  await page.mouse.up();
  await expect.poll(async () => (await task(page, alpha.id)).status).toBe("IN_PROGRESS");
  const betaHandle = page.getByRole("button", { name: "이동: 키보드 Beta", exact: true });
  await betaHandle.focus();
  await betaHandle.press("Space");
  await expect(
    page.locator(`[data-sc-board-key='${beta.id}']:not([aria-hidden='true'])`),
  ).toHaveClass(/sc-board-item--dragging/);
  await betaHandle.press("Escape");
  await expect(betaHandle).toBeFocused();
  expect((await task(page, beta.id)).revision).toBe(1);
  await betaHandle.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await task(page, beta.id)).status).toBe("IN_PROGRESS");
  const betaRow = page.locator(`[data-sc-board-key='${beta.id}']:not([aria-hidden='true'])`);
  await betaRow.getByLabel("목적 열", { exact: true }).selectOption("DONE");
  await betaRow.getByRole("button", { name: "키보드 Beta: 이동", exact: true }).click();
  await expect.poll(async () => (await task(page, beta.id)).status).toBe("DONE");
  const before = await task(page, beta.id);
  const filter = page.getByRole("form", { name: "조회", exact: true });
  await choose(page, filter, "화면 정렬", "등록일 최신순");
  await filter.getByRole("button", { name: "조회", exact: true }).click();
  await expect(page).toHaveURL(/order=createdDesc/);
  await expect(page.getByRole("button", { name: "이동: 키보드 Beta", exact: true })).toBeDisabled();
  expect((await task(page, beta.id)).revision).toBe(before.revision);
});

test("작업409 뒤 최신GET500도 편집 입력과 이전revision을 보존하고 명시적재조회로만 교체한다", async ({
  page,
}) => {
  const fixture = await setup(page);
  const item = await createTask(page, fixture.board, "충돌 기준 작업");
  await page.goto(`/kanban?boardId=${fixture.board.id}&taskId=${item.id}`);
  await expect(form(page).getByLabel("작업 제목", { exact: true })).toHaveValue(item.title);
  await form(page).getByLabel("작업 제목", { exact: true }).fill("보존할 작성 중 제목");
  const latest = await command<Task>(page, `/kanban/tasks/${item.id}`, "PUT", {
    ...taskInput(fixture.board.id, "서버 최신 제목"),
    revision: item.revision,
  });
  await form(page).getByRole("button", { name: "작업 저장", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "입력을 보존했습니다" })).toBeVisible();
  await expect(form(page).getByLabel("작업 제목", { exact: true })).toHaveValue(
    "보존할 작성 중 제목",
  );
  const target = `**/api/kanban/tasks/${item.id}`;
  await page.route(target, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 500, json: { code: "INTERNAL", message: "최신 조회 실패" } })
      : route.continue(),
  );
  await page.getByRole("button", { name: "최신 작업 조회", exact: true }).click();
  await discard(page);
  await expect(page.getByRole("alert").filter({ hasText: "최신 조회 실패" })).toBeVisible();
  await expect(form(page).getByLabel("작업 제목", { exact: true })).toHaveValue(
    "보존할 작성 중 제목",
  );
  await expect(page.getByText("편집 기준 revision: 1", { exact: false })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "입력을 보존했습니다" })).toBeVisible();
  await page.unroute(target);
  await page.getByRole("button", { name: "최신 작업 조회", exact: true }).click();
  await discard(page);
  await expect(form(page).getByLabel("작업 제목", { exact: true })).toHaveValue(latest.title);
  await expect(
    page.getByText(`편집 기준 revision: ${latest.revision}`, { exact: false }),
  ).toBeVisible();
});

test("XLSX 미리보기는 원본행을 보여주고 승인 전 저장하지 않으며 잘못된 담당자의 원자실패와 날짜 왕복을 검사한다", async ({
  page,
}) => {
  const fixture = await setup(page);
  await page.goto(`/kanban?boardId=${fixture.board.id}`);
  const file = page.getByLabel("XLSX 파일", { exact: true });
  const first = [
    "Excel 첫 작업",
    "설명\n원문",
    "TODO",
    "LOW",
    null,
    "0000-02-29",
    '["쉼표, 태그"]',
  ];
  const second: (string | number | null)[] = [
    "Excel 마지막 작업",
    "설명",
    "TODO",
    "HIGH",
    fixture.outsider.user.id,
    "0099-12-31",
    "[]",
  ];
  const invalid = await workbook([first, [], second]);
  await file.setInputFiles({
    name: "invalid-assignee.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: invalid,
  });
  const preview = page.getByRole("table", { name: "가져오기 미리보기", exact: true });
  await expect(preview.locator("tbody tr")).toHaveCount(2);
  await expect(preview.locator("tbody tr").nth(1)).toContainText("4");
  expect(await tasks(page, fixture.board.id)).toHaveLength(0);
  await page.getByRole("button", { name: "가져오기 승인", exact: true }).click();
  await page
    .getByRole("dialog", { name: "가져오기 승인", exact: true })
    .getByRole("button", { name: "가져오기 승인", exact: true })
    .click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
  expect(await tasks(page, fixture.board.id)).toHaveLength(0);
  await expect(page.getByRole("list", { name: "Excel 오류", exact: true })).toContainText(
    "원본 행 4",
  );
  const dialog = page.getByRole("dialog", { name: "가져오기 승인", exact: true });
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  second[4] = null;
  const valid = await workbook([first, [], second]);
  await file.setInputFiles({
    name: "valid-tasks.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: valid,
  });
  await expect(preview.locator("tbody tr")).toHaveCount(2);
  let browserImports = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/kanban/tasks/import") && request.method() === "POST")
      browserImports++;
  });
  await page.getByRole("button", { name: "가져오기 승인", exact: true }).click();
  await page
    .getByRole("dialog", { name: "가져오기 승인", exact: true })
    .getByRole("button", { name: "가져오기 승인", exact: true })
    .click();
  await expect(preview).toHaveCount(0);
  const saved = await tasks(page, fixture.board.id);
  expect(saved).toHaveLength(2);
  expect(saved.map((row) => row.dueDate)).toEqual(["0000-02-29", "0099-12-31"]);
  expect(saved[0]!.tags).toEqual(["쉼표, 태그"]);
  expect(browserImports).toBe(1);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "조회 작업 내보내기", exact: true }).click();
  const downloaded = await downloadEvent;
  const path = await downloaded.path();
  expect(path).not.toBeNull();
  const parsed = await readWorkbook(await fs.readFile(path!), { columns });
  expect(parsed.errors).toEqual([]);
  expect(parsed.rows.map((row) => row.dueDate)).toEqual(["0000-02-29", "0099-12-31"]);
  expect(JSON.parse(String(parsed.rows[0]!.tags))).toEqual(["쉼표, 태그"]);
});

for (const width of [390, 1366])
  for (const locale of ["ko", "en"] as const)
    test(`칸반 ${width}px ${locale}은 전체DOM 접근성과 보드가로스크롤을 검사한다`, async ({
      page,
    }, info) => {
      const fixture = await setup(page);
      const item = await createTask(
        page,
        fixture.board,
        "한국어 작업·긴 제목의 가로 이동을 확인합니다",
        "0099-12-31",
      );
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/kanban?boardId=${fixture.board.id}&taskId=${item.id}`);
      const language = page.getByRole("combobox", { name: "언어 / Language", exact: true });
      await language.selectOption(locale);
      await expect(form(page).getByLabel("작업 제목", { exact: true })).toHaveCount(
        locale === "ko" ? 1 : 0,
      );
      await expect(
        page.getByRole("heading", { name: locale === "ko" ? "칸반" : "Kanban", level: 1 }),
      ).toBeVisible();
      await assertAccessible(page, info, `010-kanban-${width}-${locale}`);
      const region = page.locator(".sc-board-scroll");
      if (width === 390) {
        await expect
          .poll(() => region.evaluate((node) => node.scrollWidth > node.clientWidth))
          .toBe(true);
        await region.focus();
        const scroll = await region.evaluate((node) => node.scrollLeft);
        await region.press("ArrowRight");
        await expect.poll(() => region.evaluate((node) => node.scrollLeft)).toBeGreaterThan(scroll);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await screenshot(page, info, `010-kanban-${width}-${locale}`);
    });

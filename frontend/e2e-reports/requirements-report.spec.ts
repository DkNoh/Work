// 보고서 전용 새 H2/JAR만 검사한다. 계정·runtime metadata는 증거에 첨부하지 않는다.
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs/promises";
import type { components } from "../apps/reference-app/src/generated/api";
import { assertAccessible } from "../e2e/support/accessibility";

type Report = components["schemas"]["RequirementReportPage"];
type ReportItem = components["schemas"]["RequirementReportItem"];
type ReportStats = components["schemas"]["RequirementReportStats"];
type SeedRow = Pick<
  ReportItem,
  | "id"
  | "title"
  | "menuId"
  | "authorId"
  | "status"
  | "updatedAt"
  | "commentCount"
  | "historyCount"
  | "lastCommentAt"
  | "assignedReviewerId"
  | "reviewDecision"
>;
type Fixture = {
  rows: SeedRow[];
  count: number;
  authorA: number;
  authorB: number;
  reviewer: number;
  menuA: number;
  menuB: number;
  usernameA: string;
  usernameB: string;
  menuNameA: string;
  menuNameB: string;
  firstRequirementId: number;
};
type Metadata = { baseURL: string; passwordFile: string; fixture: Fixture };
type ReportQuery = {
  q?: string;
  menuId?: number;
  status?: string;
  authorId?: number;
  page?: number;
  size?: number;
  sort?: "updatedAt" | "title" | "commentCount" | "historyCount" | "lastCommentAt";
  direction?: "asc" | "desc";
};
const endpoint = "/api/reports/requirements";
const statusKeys = [
  "DRAFT",
  "REQUESTED",
  "NEEDS_INFO",
  "REVIEWING",
  "AGREED",
  "ADO_LINKED",
] as const;

async function metadata(): Promise<Metadata> {
  return JSON.parse(
    await fs.readFile(new URL("../../.runtime/e2e-reports.json", import.meta.url), "utf8"),
  ) as Metadata;
}

async function login(page: Page, actor = "admin") {
  const state = await metadata();
  const response = await page.request.get("/api/auth/csrf");
  expect(response.status()).toBe(200);
  const token = (await response.json()) as { headerName: string; token: string };
  const result = await page.request.post("/api/auth/login", {
    form: { username: actor, password: await fs.readFile(state.passwordFile, "utf8") },
    headers: { [token.headerName]: token.token },
  });
  expect(result.status()).toBe(204);
  return state.fixture;
}

async function report(page: Page, query: ReportQuery = {}): Promise<Report> {
  const params = new URLSearchParams(
    Object.entries(query).map(([key, value]) => [key, String(value)]),
  );
  const response = await page.request.get(`${endpoint}?${params}`);
  expect(response.status()).toBe(200);
  return response.json() as Promise<Report>;
}

function filteredRows(fixture: Fixture, query: ReportQuery, actorId?: number) {
  return fixture.rows.filter(
    (row) =>
      (actorId === undefined || row.status !== "DRAFT" || row.authorId === actorId) &&
      (query.q === undefined || row.title.includes(query.q)) &&
      (query.menuId === undefined || row.menuId === query.menuId) &&
      (query.authorId === undefined || row.authorId === query.authorId) &&
      (query.status === undefined || row.status === query.status),
  );
}

function orderedRows(rows: readonly SeedRow[], query: ReportQuery) {
  const field = query.sort ?? "updatedAt";
  const factor = query.direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const a = left[field];
    const b = right[field];
    // 실제 fixture의 값을 독립 정렬한다. NULL은 방향과 무관하게 끝으로 보내야 한다.
    if (a == null || b == null)
      return a == null && b == null ? right.id - left.id : a == null ? 1 : -1;
    if (a !== b) return (a < b ? -1 : 1) * factor;
    return right.id - left.id;
  });
}

function stats(rows: readonly SeedRow[]): ReportStats {
  const result = {
    DRAFT: 0,
    REQUESTED: 0,
    NEEDS_INFO: 0,
    REVIEWING: 0,
    AGREED: 0,
    ADO_LINKED: 0,
    unassigned: 0,
  };
  for (const row of rows) {
    result[row.status as (typeof statusKeys)[number]]++;
    if (row.assignedReviewerId == null) result.unassigned++;
  }
  return result;
}

function assertReport(actual: Report, fixture: Fixture, query: ReportQuery = {}, actorId?: number) {
  const matches = filteredRows(fixture, query, actorId);
  const pageIndex = query.page ?? 0;
  const pageSize = query.size ?? 20;
  const expected = orderedRows(matches, query).slice(
    pageIndex * pageSize,
    (pageIndex + 1) * pageSize,
  );
  expect({
    total: actual.total,
    page: actual.page,
    size: actual.size,
    stats: actual.stats,
  }).toEqual({
    total: matches.length,
    page: pageIndex,
    size: pageSize,
    stats: stats(matches),
  });
  expect(statusKeys.reduce((sum, key) => sum + actual.stats[key], 0)).toBe(actual.total);
  expect(actual.items.map((row) => row.id)).toEqual(expected.map((row) => row.id));
  for (const row of actual.items) {
    const seeded = expected.find((item) => item.id === row.id)!;
    expect(row).toMatchObject(seeded);
    expect(row.menuName).toBe(row.menuId === fixture.menuA ? fixture.menuNameA : fixture.menuNameB);
    expect(row.authorName).toBe(
      row.authorId === fixture.authorA ? "Report author A" : "Report author B",
    );
    expect(row.revision).toBe(1);
    expect(row.createdAt).toBe("2026-01-01T00:00:00Z");
  }
  return expected;
}

test("10,000개 실제 H2 보고서의 첫·중간·끝 페이지/count·다중 자식 집계·정렬·literal 조건을 확인한다", async ({
  page,
}, info) => {
  expect((await page.request.get(endpoint)).status()).toBe(401);
  const fixture = await login(page);
  expect(fixture.count).toBe(10_000);
  for (const pageIndex of [0, 50, 99]) {
    const query = { page: pageIndex, size: 100 };
    assertReport(await report(page, query), fixture, query);
  }
  const empty = { page: 100, size: 100 };
  assertReport(await report(page, empty), fixture, empty);
  for (const sort of [
    "updatedAt",
    "title",
    "commentCount",
    "historyCount",
    "lastCommentAt",
  ] as const) {
    for (const direction of ["asc", "desc"] as const) {
      const query = { sort, direction, size: 100 };
      assertReport(await report(page, query), fixture, query);
    }
  }
  for (const q of ["%", "_", "\\", "'", "한국", "literal % _ \\ ' 한국", "  "]) {
    const query = { q, size: 100 };
    assertReport(await report(page, query), fixture, query);
  }
  const composed = { menuId: fixture.menuA, status: "DRAFT", authorId: fixture.authorA, size: 100 };
  assertReport(await report(page, composed), fixture, composed);
  const multiplicationProbe = { q: "보고서 합성 행 00003", size: 100 };
  const result = await report(page, multiplicationProbe);
  assertReport(result, fixture, multiplicationProbe);
  expect(result.items[0]).toMatchObject({ commentCount: 3, historyCount: 4 });
  const noChildren = { q: "literal % _ \\ ' 한국 보고서 00000", size: 100 };
  expect((await report(page, noChildren)).items[0]).toMatchObject({
    commentCount: 0,
    historyCount: 0,
    lastCommentAt: null,
  });
  await info.attach("report-api-summary.json", {
    body: Buffer.from(
      JSON.stringify(
        {
          syntheticRows: fixture.count,
          pageIndexes: [0, 50, 99, 100],
          childProbe: { comments: 3, history: 4 },
          testedSorts: 5,
          directions: 2,
          literalQueries: 7,
        },
        null,
        2,
      ),
    ),
    contentType: "application/json",
  });
});

test("일반 사용자 보고서는 타인 DRAFT와 자식 집계를 모든 페이지/count/stats에서 제외한다", async ({
  page,
}) => {
  const fixture = (await metadata()).fixture;
  await login(page, fixture.usernameA);
  const all = { size: 100 };
  const result = await report(page, all);
  assertReport(result, fixture, all, fixture.authorA);
  expect(result.total).toBe(9500);
  expect(result.stats.DRAFT).toBe(500);
  const drafts = { status: "DRAFT", authorId: fixture.authorB, size: 100 };
  const denied = await report(page, drafts);
  assertReport(denied, fixture, drafts, fixture.authorA);
  expect(denied.items).toEqual([]);
  expect(denied.total).toBe(0);
  for (const pageIndex of [0, 47, 94]) {
    const query = {
      page: pageIndex,
      size: 100,
      sort: "commentCount" as const,
      direction: "desc" as const,
    };
    assertReport(await report(page, query), fixture, query, fixture.authorA);
  }
});

test("보고서 500 재조회·재시도는 작성 중 조건/선택/URL을 보존하고 이전 조건의 늦은 응답을 폐기한다", async ({
  page,
}, info) => {
  const fixture = await login(page);
  const expected = orderedRows(fixture.rows, { size: 100 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  await page.goto("/reports/requirements?size=100");
  const table = page.getByRole("table", { name: "요구사항 보고서", exact: true });
  await expect(table.locator("tbody [data-row-key]")).toHaveCount(100);
  const selectedName = `${expected[0]!.title} 선택`;
  await table.getByRole("checkbox", { name: selectedName, exact: true }).check();
  const form = page.getByRole("form", { name: "보고서 조회 조건", exact: true });
  const search = form.getByRole("textbox", { name: "검색어", exact: true });
  const literal = "literal % _ \\ ' 한국";
  await search.fill(literal);
  const initialURL = page.url();
  let failRefresh = true;
  let holdSearch = false;
  let observed = false;
  let handled = false;
  let canceledOldRequest = false;
  let delayedTotal: number | undefined;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/reports/requirements**", async (route) => {
    const q = new URL(route.request().url()).searchParams.get("q") ?? "";
    if (failRefresh && q === "") {
      failRefresh = false;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          code: "INTERNAL_ERROR",
          message: "합성 보고서 재조회 실패",
          errors: [],
        }),
      });
      return;
    }
    if (holdSearch && q === literal) {
      holdSearch = false;
      const actual = await route.fetch();
      expect(actual.status()).toBe(200);
      delayedTotal = ((await actual.json()) as Report).total;
      observed = true;
      await gate;
      try {
        await route.fulfill({ response: actual });
      } catch (error) {
        // query 소유권 전환의 실제 Abort는 정상이다. 다른 routing 실패를 숨기지 않는다.
        if (route.request().failure()?.errorText === "net::ERR_ABORTED") canceledOldRequest = true;
        else throw error;
      } finally {
        handled = true;
      }
      return;
    }
    await route.continue();
  });
  try {
    await page.getByRole("button", { name: "새로고침", exact: true }).click();
    const alert = page
      .locator(".report-table-wrapper")
      .getByRole("alert")
      .filter({ hasText: "합성 보고서 재조회 실패" });
    await expect(alert).toBeVisible();
    const chartAlert = page.locator(".sc-chart__error").getByText("합성 보고서 재조회 실패", {
      exact: true,
    });
    await expect(chartAlert).toBeVisible();
    await expect(search).toHaveValue(literal);
    await expect(page).toHaveURL(initialURL);
    await expect(
      page.locator(".report-table-wrapper").getByRole("status").filter({ hasText: "1개 선택" }),
    ).toBeVisible();
    await assertAccessible(page, info, "report-refresh-failed");
    await alert.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(alert).toHaveCount(0);
    await expect(chartAlert).toHaveCount(0);
    await expect(table).toHaveAttribute("aria-rowcount", "10001");
    await expect(table.getByRole("checkbox", { name: selectedName, exact: true })).toBeChecked();
    await expect(search).toHaveValue(literal);
    await expect(page).toHaveURL(initialURL);
    holdSearch = true;
    await form.getByRole("button", { name: "조회", exact: true }).click();
    await expect.poll(() => observed).toBe(true);
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(literal);
    await page.goBack();
    await expect(page).toHaveURL(initialURL);
    await expect(table.locator("tbody [data-row-key]")).toHaveCount(100);
    release?.();
    await expect.poll(() => handled).toBe(true);
    expect(delayedTotal).toBe(10);
    await expect(table).toHaveAttribute("aria-rowcount", "10001");
    expect(
      await table
        .locator("tbody [data-row-key]")
        .evaluateAll((rows) => rows.map((row) => Number(row.getAttribute("data-row-key")))),
    ).toEqual(expected.slice(0, 100).map((row) => row.id));
    await expect(search).toHaveValue("");
    await expect(table.getByRole("checkbox", { name: selectedName, exact: true })).toBeChecked();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
    expect(errors).toEqual([]);
    await info.attach("report-refresh-ownership.json", {
      body: Buffer.from(
        JSON.stringify(
          {
            injectedFailure: 500,
            realDelayedResponseTotal: delayedTotal,
            activeQueryTotal: 10000,
            canceledOldRequest,
            preservedSelectionCount: 1,
          },
          null,
          2,
        ),
      ),
      contentType: "application/json",
    });
  } finally {
    release?.();
    await page.unroute("**/api/reports/requirements**");
  }
});

async function choose(page: Page, scope: Locator, label: string, option: string) {
  const input = scope
    .locator("input[role='combobox']")
    .and(scope.getByLabel(label, { exact: true }));
  await expect(input).toHaveAccessibleName(label);
  await input.focus();
  await input.press("Enter");
  await page.getByRole("listbox").getByRole("option", { name: option, exact: true }).click();
}

async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  // 상단 조건/집계와 조회 결과를 각각 남겨 모바일에서도 실제 표를 검토할 수 있게 한다.
  // 접근성 검사는 캡처 범위와 무관하게 document 전체에서 수행한다.
  const clip = await page.evaluate(() => ({
    x: 0,
    y: 0,
    width: window.innerWidth,
    height: Math.min(document.documentElement.scrollHeight, 1600),
  }));
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, clip, animations: "disabled" });
  await info.attach(name, { path, contentType: "image/png" });
  const results = page.getByRole("region", { name: /^(조회 결과|Results)$/, exact: true });
  await expect(results).toHaveCount(1);
  await expect(results).toBeVisible();
  const geometry = await results.evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    return {
      clip: {
        x: 0,
        y: rectangle.top + window.scrollY,
        width: window.innerWidth,
        height: Math.min(rectangle.height, 1100),
      },
      documentWidth: document.documentElement.scrollWidth,
    };
  });
  expect(geometry.clip.y).toBeGreaterThanOrEqual(0);
  expect(geometry.clip.height).toBeGreaterThan(0);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.clip.width + 1);
  const resultsPath = info.outputPath(`${name}-results.png`);
  await page.screenshot({
    path: resultsPath,
    fullPage: true,
    clip: geometry.clip,
    animations: "disabled",
  });
  await info.attach(`${name}-results`, { path: resultsPath, contentType: "image/png" });
}

for (const width of [390, 1366]) {
  test(`10k 보고서 ${width}px의 global ARIA·가상 DOM/focus·일반표·URL·한영·전체 DOM 접근성`, async ({
    page,
  }, info) => {
    const fixture = await login(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.name));
    await page.setViewportSize({ width, height: 844 });
    const query = { page: 50, size: 100 };
    const expected = orderedRows(fixture.rows, query).slice(5000, 5100);
    await page.goto("/reports/requirements?page=50&size=100");
    await expect(page.getByRole("heading", { name: "요구사항 보고서", exact: true })).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "조회 범위 집계", exact: true })
        .locator("dl > div")
        .filter({ hasText: "전체 건수" })
        .locator("dd"),
    ).toHaveText("10000");
    let table = page.getByRole("table", { name: "요구사항 보고서", exact: true });
    await expect(table).toHaveAttribute("aria-rowcount", "10001");
    await expect(table.locator("tbody [data-row-key]")).toHaveCount(100);
    await expect(table.locator("tbody [data-row-key]").first()).toHaveAttribute(
      "aria-rowindex",
      "5002",
    );
    await expect(table.locator("tbody [data-row-key]").last()).toHaveAttribute(
      "aria-rowindex",
      "5101",
    );
    expect(
      await table
        .locator("tbody [data-row-key]")
        .evaluateAll((rows) => rows.map((row) => Number(row.getAttribute("data-row-key")))),
    ).toEqual(expected.map((row) => row.id));
    const scroll = page.getByRole("region", { name: "요구사항 보고서 표 영역", exact: true });
    await scroll.focus();
    await expect(scroll).toBeFocused();
    await scroll.press("ArrowRight");
    await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await scroll.evaluate((element) => element.scrollTo({ left: 0, behavior: "instant" }));
    const selectedName = `${expected[0]!.title} 선택`;
    await table.getByRole("checkbox", { name: selectedName, exact: true }).check();
    await assertAccessible(page, info, `report-${width}-ko-standard`);
    await capture(page, info, `report-${width}-ko-standard`);
    await choose(page, page.locator("main"), "표 보기", "현재 페이지 가상 표");
    await expect(page).toHaveURL(/view=virtual/);
    const virtual = page.locator(".sc-virtual-table");
    table = virtual.getByRole("table", { name: "요구사항 보고서", exact: true });
    await expect(table).toHaveAttribute("aria-rowcount", "10001");
    await expect(table.getByRole("checkbox", { name: selectedName, exact: true })).toBeChecked();
    const viewport = virtual.getByRole("region", { name: "요구사항 보고서 표 영역", exact: true });
    await virtual.getByRole("button", { name: "마지막 행으로 이동", exact: true }).click();
    const last = table.locator(`[data-row-key='${expected[99]!.id}']`);
    await expect(last).toHaveAttribute("aria-rowindex", "5101");
    await expect(last.getByRole("checkbox")).toBeFocused();
    await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const mountedAtEnd = await table.locator("tbody [data-row-key]").count();
    expect(mountedAtEnd).toBeGreaterThan(0);
    expect(mountedAtEnd).toBeLessThan(60);
    await virtual.getByRole("button", { name: "첫 행으로 이동", exact: true }).click();
    await expect(table.getByRole("checkbox", { name: selectedName, exact: true })).toBeFocused();
    await expect(table.getByRole("checkbox", { name: selectedName, exact: true })).toBeChecked();
    await assertAccessible(page, info, `report-${width}-ko-virtual`);
    await capture(page, info, `report-${width}-ko-virtual`);
    await virtual.getByRole("button", { name: "다음 페이지", exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBe("51");
    await expect(table.locator("tbody [data-row-key]").first()).toHaveAttribute(
      "aria-rowindex",
      "5102",
    );
    await virtual.getByRole("button", { name: "이전 페이지", exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBe("50");
    await expect(table.getByRole("checkbox", { name: selectedName, exact: true })).toBeChecked();
    await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption("en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    table = virtual.getByRole("table", { name: "Requirements report", exact: true });
    await expect(
      table.getByRole("checkbox", { name: `Select ${expected[0]!.title}`, exact: true }),
    ).toBeChecked();
    await assertAccessible(page, info, `report-${width}-en-virtual`);
    await capture(page, info, `report-${width}-en-virtual`);
    await virtual.getByRole("button", { name: "Standard paginated table", exact: true }).click();
    await expect(virtual.locator(".sc-data-table tbody [data-row-key]")).toHaveCount(100);
    await assertAccessible(page, info, `report-${width}-en-standard-alternative`);
    await choose(page, page.locator("main"), "Table view", "Standard table");
    await expect(page.locator(".sc-virtual-table")).toHaveCount(0);
    table = page.getByRole("table", { name: "Requirements report", exact: true });
    await expect(
      table.getByRole("checkbox", { name: `Select ${expected[0]!.title}`, exact: true }),
    ).toBeChecked();
    const titleSort = table.getByRole("columnheader").filter({ hasText: "Requirement title" });
    await titleSort.getByRole("button").click();
    await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBe("title");
    await expect.poll(() => new URL(page.url()).searchParams.get("direction")).toBe("asc");
    await expect(titleSort).toHaveAttribute("aria-sort", "ascending");
    const byTitle = orderedRows(fixture.rows, { sort: "title", direction: "asc", size: 100 });
    await expect(table.locator("tbody [data-row-key]").first()).toHaveAttribute(
      "data-row-key",
      String(byTitle[0]!.id),
    );
    await titleSort.getByRole("button").click();
    await expect.poll(() => new URL(page.url()).searchParams.get("direction")).toBe("desc");
    await expect(titleSort).toHaveAttribute("aria-sort", "descending");
    await titleSort.getByRole("button").click();
    await expect.poll(() => new URL(page.url()).searchParams.has("sort")).toBe(false);
    await expect.poll(() => new URL(page.url()).searchParams.has("direction")).toBe(false);
    await expect(
      page.getByText("Default order: updated date descending, then ID descending", { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".report-table-wrapper").getByRole("status").filter({ hasText: "1 selected" }),
    ).toBeVisible();
    const filters = page.getByRole("form", { name: "Report filters", exact: true });
    const literal = "literal % _ \\ ' 한국";
    await filters.getByRole("textbox", { name: "Search text", exact: true }).fill(literal);
    await filters.getByRole("button", { name: "Search", exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(literal);
    await expect(table.locator("tbody [data-row-key]")).toHaveCount(10);
    await expect(table).toHaveAttribute("aria-rowcount", "11");
    await page.reload();
    // reload의 기본 locale과 무관하게 URL 필터가 유지된 자료에서 다시 영어를 선택한다.
    await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption("en");
    await expect(
      page
        .getByRole("form", { name: "Report filters", exact: true })
        .getByRole("textbox", { name: "Search text", exact: true }),
    ).toHaveValue(literal);
    await expect(
      page
        .getByRole("table", { name: "Requirements report", exact: true })
        .locator("tbody [data-row-key]"),
    ).toHaveCount(10);
    await page.goBack();
    await expect.poll(() => new URL(page.url()).searchParams.has("q")).toBe(false);
    await expect(
      page
        .getByRole("table", { name: "Requirements report", exact: true })
        .locator("tbody [data-row-key]"),
    ).toHaveCount(100);
    await page.goForward();
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(literal);
    await expect(
      page
        .getByRole("table", { name: "Requirements report", exact: true })
        .locator("tbody [data-row-key]"),
    ).toHaveCount(10);
    const currentFilters = page.getByRole("form", { name: "Report filters", exact: true });
    await choose(page, currentFilters, "Menu", fixture.menuNameA);
    await choose(page, currentFilters, "Status", "Draft");
    await choose(page, currentFilters, "Author", "Report author A");
    await currentFilters.getByRole("button", { name: "Search", exact: true }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("menuId"))
      .toBe(String(fixture.menuA));
    await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBe("DRAFT");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("authorId"))
      .toBe(String(fixture.authorA));
    await expect(
      page.getByRole("table", { name: "Requirements report", exact: true }),
    ).toHaveAttribute("aria-rowcount", "5");
    await expect(
      page
        .getByRole("region", { name: "Filtered totals", exact: true })
        .locator("dl > div")
        .filter({ hasText: "Total results" })
        .locator("dd"),
    ).toHaveText("4");
    const layout = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(layout.document).toBeLessThanOrEqual(layout.viewport + 1);
    await info.attach(`report-${width}-dom.json`, {
      body: Buffer.from(
        JSON.stringify(
          { mountedAtEnd, maxPageRows: 100, totalRows: 10000, rowOffset: 5000, layout },
          null,
          2,
        ),
      ),
      contentType: "application/json",
    });
    expect(errors).toEqual([]);
  });
}

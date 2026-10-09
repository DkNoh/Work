import { expect, test, type Page, type Route, type TestInfo } from "@playwright/test";
import { assertAccessible } from "./support/accessibility";
import {
  command,
  csrf,
  fixtures,
  input,
  create,
  detail,
  choose,
  confirmDiscard,
  switchActor,
  type Requirement,
} from "./support/requirements";

const bodyForm = (page: Page) => page.getByRole("form", { name: "요구사항 본문", exact: true });

async function captureBusinessScreen(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: "image/png" });
}

test("실제 작성자·담당자 세션에서 등록→지정→제출→검토→합의·댓글·이력을 저장한다", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  const fixture = await fixtures(page);
  await switchActor(page, fixture.author.credentials);
  await page.goto("/workspace");
  const form = bodyForm(page);
  await form.getByRole("button", { name: "요구사항 저장", exact: true }).click();
  await expect(form.getByLabel("요구사항 제목", { exact: true })).toHaveAccessibleDescription(
    "입력해 주세요.",
  );
  await choose(page, form, "메뉴", fixture.menu.name);
  const title = "실제 요구사항 작성·검토 흐름";
  await form.getByLabel("요구사항 제목", { exact: true }).fill(title);
  await form.getByLabel("원하는 동작", { exact: true }).fill("업무 화면 조회\n한국어 줄바꿈");
  await form.getByLabel("요청 이유", { exact: true }).fill("반복 조회를 개선합니다.");
  await form.getByRole("button", { name: "요구사항 저장", exact: true }).click();
  await expect(page).toHaveURL(/\/requests\/\d+$/);
  const id = Number(new URL(page.url()).pathname.split("/").at(-1));
  let item = await detail(page, id);
  expect([item.status, item.revision, item.authorId]).toEqual(["DRAFT", 1, fixture.author.user.id]);
  expect(item.desired).toBe("업무 화면 조회\n한국어 줄바꿈");
  const assignment = page.getByRole("form", { name: "담당자 지정", exact: true });
  await choose(page, assignment, "담당자", fixture.reviewer.user.displayName);
  await assignment.getByRole("button", { name: "담당자 저장", exact: true }).click();
  await expect(page.locator(".requirement-meta")).toContainText(fixture.reviewer.user.displayName);
  await page.getByRole("button", { name: "요청 제출", exact: true }).click();
  await expect(page.locator(".requirement-meta")).toContainText("요청됨");
  await switchActor(page, fixture.reviewer.credentials);
  await page.goto(`/requests/${id}`);
  await expect(bodyForm(page).getByLabel("요구사항 제목", { exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  await expect(bodyForm(page).getByRole("button", { name: "요구사항 저장" })).toHaveCount(0);
  const review = page.getByRole("form", { name: "담당자 검토", exact: true });
  await choose(page, review, "검토 결과", "가능");
  await review.getByLabel("검토 근거", { exact: true }).fill("현재 API로 구현할 수 있습니다.");
  await review.getByLabel("반영 범위", { exact: true }).fill("검색과 목록");
  await review.getByLabel("제외 범위", { exact: true }).fill("외부 서비스 연동");
  await review.getByLabel("완료 기준", { exact: true }).fill("조회·저장 검증 통과");
  await review.getByRole("button", { name: "검토 저장", exact: true }).click();
  await expect(page.locator(".requirement-meta")).toContainText("검토 중");
  await assertAccessible(page, info, "requirement-reviewer");
  await captureBusinessScreen(page, info, "requirement-reviewer");
  await switchActor(page, fixture.author.credentials);
  await page.goto(`/requests/${id}`);
  await page.getByRole("button", { name: "검토 합의", exact: true }).click();
  await expect(page.locator(".requirement-meta")).toContainText("합의됨");
  const comment = page.getByRole("form", { name: "댓글 작성", exact: true });
  await comment.getByLabel("댓글 내용", { exact: true }).fill("합의한 내용을 확인했습니다.");
  await comment.getByRole("button", { name: "댓글 등록", exact: true }).click();
  await expect(page.getByRole("list", { name: "댓글", exact: true })).toContainText(
    "합의한 내용을 확인했습니다.",
  );
  item = await detail(page, id);
  expect(item.status).toBe("AGREED");
  expect(item.review?.reviewerId).toBe(fixture.reviewer.user.id);
  expect(item.history.map((entry) => entry.action)).toEqual(
    expect.arrayContaining(["CREATE", "ASSIGN_REVIEWER", "SUBMIT", "REVIEW", "AGREE"]),
  );
  expect(item.createdAt).toMatch(/Z$/);
  await expect(page.locator("time").first()).toHaveAttribute("datetime", item.createdAt);
  await page
    .getByRole("list", { name: "변경 이력", exact: true })
    .locator("summary")
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "변경 후", exact: true }).first()).toBeVisible();
  await assertAccessible(page, info, "requirement-agreed-history");
  await captureBusinessScreen(page, info, "requirement-agreed-history");
  await page.reload();
  await expect(page.locator(".requirement-meta")).toContainText("합의됨");
  expect(errors).toEqual([]);
});

test("초안은 다른 사용자 목록/count에서 제외하며 ADMIN도 타인의 본문을 변경할 수 없다", async ({
  page,
}) => {
  const fixture = await fixtures(page);
  await switchActor(page, fixture.author.credentials);
  const item = await create(page, fixture.menu, "작성자에게만 보이는 초안");
  await switchActor(page, fixture.outsider.credentials);
  const denied = await page.request.get(`/api/requirements/${item.id}`);
  expect(denied.status()).toBe(403);
  const list = await page.request.get(`/api/requirements?q=${encodeURIComponent(item.title)}`);
  expect(list.status()).toBe(200);
  const data = (await list.json()) as { items: unknown[]; total: number };
  expect(data).toMatchObject({ items: [], total: 0 });
  await page.goto(`/requests/${item.id}`);
  await expect(page.getByRole("alert")).toContainText("권한");
  await expect(bodyForm(page)).toHaveCount(0);
  await switchActor(page);
  await page.goto(`/requests/${item.id}`);
  await expect(bodyForm(page).getByLabel("요구사항 제목", { exact: true })).toHaveValue(item.title);
  await expect(bodyForm(page).getByRole("button", { name: "요구사항 저장" })).toHaveCount(0);
  const token = await csrf(page);
  const mutation = await page.request.put(`/api/requirements/${item.id}`, {
    data: input(fixture.menu.id, "타인 수정", item.revision),
    headers: { [token.headerName]: token.token },
  });
  expect(mutation.status()).toBe(403);
  expect((await detail(page, item.id)).title).toBe(item.title);
});

for (const status of [400, 403]) {
  test(`요구사항 ${status} 저장 오류는 입력과 기준 revision을 보존한다`, async ({ page }) => {
    const fixture = await fixtures(page);
    await switchActor(page, fixture.author.credentials);
    const item = await create(page, fixture.menu, `오류 ${status} 초안`);
    await page.goto(`/requests/${item.id}`);
    const form = bodyForm(page);
    const title = form.getByLabel("요구사항 제목", { exact: true });
    await title.fill(`보존할 ${status} 입력`);
    await page.route(`**/api/requirements/${item.id}`, async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({
          code: status === 400 ? "INVALID_INPUT" : "FORBIDDEN",
          message: `합성 ${status} 오류`,
          errors: status === 400 ? [{ field: "title", message: "서버 제목 검증 오류" }] : [],
        }),
      });
    });
    await form.getByRole("button", { name: "요구사항 저장", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: `합성 ${status} 오류` })).toBeVisible();
    await expect(title).toHaveValue(`보존할 ${status} 입력`);
    await expect(
      page.getByText(`입력 기준 revision ${item.revision}`, { exact: true }),
    ).toBeVisible();
    if (status === 400) await expect(title).toHaveAccessibleDescription("서버 제목 검증 오류");
    expect((await detail(page, item.id)).title).toBe(item.title);
  });
}

test("실제 409 이후 최신 GET의 500 실패·취소·성공에서도 초안과 revision을 명시적으로 교체한다", async ({
  page,
}) => {
  const fixture = await fixtures(page);
  await switchActor(page, fixture.author.credentials);
  const item = await create(page, fixture.menu, "요구사항 충돌 초안");
  await page.goto(`/requests/${item.id}`);
  const form = bodyForm(page);
  const title = form.getByLabel("요구사항 제목", { exact: true });
  await title.fill("409에서 유지할 작성 내용");
  const current = await command<Requirement>(
    page,
    `/requirements/${item.id}`,
    "PUT",
    input(fixture.menu.id, "서버의 최신 내용", item.revision),
  );
  await form.getByRole("button", { name: "요구사항 저장", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "기준 revision을 유지" })).toBeVisible();
  await expect(title).toHaveValue("409에서 유지할 작성 내용");
  const failGet = async (route: Route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ code: "INTERNAL", message: "합성 최신 조회 실패", errors: [] }),
    });
  };
  await page.route(`**/api/requirements/${item.id}`, failGet);
  const reload = page.getByRole("button", { name: "최신 내용 불러오기", exact: true });
  await reload.click();
  await page.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
  await expect(title).toHaveValue("409에서 유지할 작성 내용");
  await reload.click();
  await confirmDiscard(page);
  await expect(
    page.getByRole("alert").filter({ hasText: "합성 최신 조회 실패" }).first(),
  ).toBeVisible();
  await expect(title).toHaveValue("409에서 유지할 작성 내용");
  await expect(
    page.getByText(`입력 기준 revision ${item.revision}`, { exact: true }),
  ).toBeVisible();
  await page.unroute(`**/api/requirements/${item.id}`, failGet);
  await reload.click();
  await confirmDiscard(page);
  await expect(title).toHaveValue(current.title);
  await expect(
    page.getByText(`입력 기준 revision ${current.revision}`, { exact: true }),
  ).toBeVisible();
  await title.fill("최신 revision으로 요구사항 저장");
  await form.getByRole("button", { name: "요구사항 저장", exact: true }).click();
  await expect(page.locator(".requirement-meta").getByText("초안", { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await detail(page, item.id)).title)
    .toBe("최신 revision으로 요구사항 저장");
});

for (const outcome of ["success", "conflict"] as const) {
  test(`요구사항 A의 지연 ${outcome} 저장 응답은 새 선택 B의 폼을 덮지 않는다`, async ({
    page,
  }) => {
    const fixture = await fixtures(page);
    await switchActor(page, fixture.author.credentials);
    const first = await create(page, fixture.menu, `지연 A ${outcome}`);
    const second = await create(page, fixture.menu, `선택 B ${outcome}`);
    await page.goto(`/requests/${first.id}`);
    const title = bodyForm(page).getByLabel("요구사항 제목", { exact: true });
    await title.fill("아직 완료되지 않은 A 입력");
    let release: (() => void) | undefined;
    let observed: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const requested = new Promise<void>((resolve) => {
      observed = resolve;
    });
    await page.route(`**/api/requirements/${first.id}`, async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      observed?.();
      await gate;
      if (outcome === "success") await route.continue();
      else
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            code: "REVISION_CONFLICT",
            message: "A 지연 충돌",
            errors: [],
          }),
        });
    });
    try {
      await bodyForm(page).getByRole("button", { name: "요구사항 저장", exact: true }).click();
      await requested;
      await page.getByRole("button", { name: "목록으로", exact: true }).click();
      await confirmDiscard(page);
      await page.getByRole("link", { name: `상세 보기: ${second.title}`, exact: true }).click();
      await expect(title).toHaveValue(second.title);
      const settled = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/requirements/${first.id}` &&
          response.request().method() === "PUT",
      );
      release?.();
      expect((await settled).status()).toBe(outcome === "success" ? 200 : 409);
      await expect(title).toHaveValue(second.title);
      await expect(
        page.getByText(`입력 기준 revision ${second.revision}`, { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
      await expect(bodyForm(page).getByRole("button", { name: "요구사항 저장" })).toBeEnabled();
    } finally {
      release?.();
    }
  });
}

test("검색·페이지 URL은 새로고침과 상세 복귀에서 유지되고 언어 전환은 작성 입력을 유지한다", async ({
  page,
}) => {
  const fixture = await fixtures(page);
  await switchActor(page, fixture.author.credentials);
  const first = await create(page, fixture.menu, "URL 검색 대상 1");
  await create(page, fixture.menu, "URL 검색 대상 2");
  const query = new URLSearchParams({
    q: "URL 검색 대상",
    page: "1",
    size: "1",
    authorId: String(fixture.author.user.id),
  });
  await page.goto(`/requests?${query}`);
  await expect(
    page.getByRole("link", { name: `상세 보기: ${first.title}`, exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: `상세 보기: ${first.title}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/requests/${first.id}\\?`));
  await page.getByRole("button", { name: "목록으로", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("page")).toBe("1");
  expect(new URL(page.url()).searchParams.get("q")).toBe("URL 검색 대상");
  await page.getByRole("link", { name: `상세 보기: ${first.title}`, exact: true }).click();
  const title = bodyForm(page).getByLabel("요구사항 제목", { exact: true });
  await title.fill("언어 전환 중인 업무 입력");
  await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption("en");
  await expect(page.getByLabel("Requirement title", { exact: true })).toHaveValue(
    "언어 전환 중인 업무 입력",
  );
  // 현재 셸의 로그아웃은 사용자 메뉴 안에 있다. 언어 전환 후에도 실제 사용자의 클릭 경로를 따른다.
  await page.getByRole("button", { name: /^Open user menu:/ }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("form", { name: "로그인", exact: true })).toBeVisible();
});

for (const width of [390, 1366]) {
  test(`요구사항 ${width}px 목록·본문·필드 오류·댓글·이력은 전체 DOM 접근성을 검사한다`, async ({
    page,
  }, info) => {
    const fixture = await fixtures(page);
    await page.setViewportSize({ width, height: 844 });
    await switchActor(page, fixture.author.credentials);
    const item = await create(page, fixture.menu, `접근성 요구사항 ${width}`);
    await page.goto(`/requests?q=${encodeURIComponent(item.title)}`);
    await expect(
      page.getByRole("link", { name: `상세 보기: ${item.title}`, exact: true }),
    ).toBeVisible();
    const tableRegion = page.getByRole("region", { name: "요구사항 목록 표 영역", exact: true });
    const layout = await tableRegion.evaluate((element) => {
      const table = element.querySelector("table");
      const row = table?.tBodies[0]?.rows[0];
      if (!table || !row) throw new Error("요구사항 목록의 첫 행이 없습니다.");
      const titleCell = row.cells[0]!;
      const dateCell = row.cells[4]!;
      const lineCount = (cell: HTMLTableCellElement) => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        return [...range.getClientRects()].filter((rectangle) => rectangle.width > 0).length;
      };
      const titleStyle = getComputedStyle(titleCell);
      return {
        regionWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        tableWidth: table.getBoundingClientRect().width,
        titleContentWidth:
          titleCell.getBoundingClientRect().width -
          parseFloat(titleStyle.paddingLeft) -
          parseFloat(titleStyle.paddingRight),
        titleLines: lineCount(titleCell),
        dateLines: lineCount(dateCell),
        dateWhiteSpace: getComputedStyle(dateCell).whiteSpace,
        viewportWidth: window.innerWidth,
        pageWidth: document.documentElement.scrollWidth,
      };
    });
    expect(layout.titleContentWidth).toBeGreaterThanOrEqual(180);
    expect(layout.titleLines).toBeLessThanOrEqual(2);
    expect(layout.dateLines).toBe(1);
    expect(layout.dateWhiteSpace).toBe("nowrap");
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    if (width === 390) {
      expect(layout.scrollWidth).toBeGreaterThan(layout.regionWidth);
      await tableRegion.focus();
      await expect(tableRegion).toBeFocused();
      await tableRegion.press("ArrowRight");
      await expect
        .poll(() => tableRegion.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(0);
      // 키보드 이동을 확인한 뒤 시각 증거는 목록의 시작 위치에서 기록한다.
      await tableRegion.evaluate((element) => element.scrollTo({ left: 0, behavior: "instant" }));
    } else {
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.regionWidth + 1);
    }
    await info.attach(`requirements-list-${width}-layout.json`, {
      body: Buffer.from(JSON.stringify(layout, null, 2)),
      contentType: "application/json",
    });
    await assertAccessible(page, info, `requirements-list-${width}`);
    await captureBusinessScreen(page, info, `requirements-list-${width}`);
    await page.getByRole("link", { name: `상세 보기: ${item.title}`, exact: true }).click();
    await expect(bodyForm(page)).toBeVisible();
    await assertAccessible(page, info, `requirement-detail-${width}`);
    await captureBusinessScreen(page, info, `requirement-detail-${width}`);
    await bodyForm(page).getByLabel("요구사항 제목", { exact: true }).fill("");
    await bodyForm(page).getByRole("button", { name: "요구사항 저장", exact: true }).click();
    await expect(
      bodyForm(page).getByLabel("요구사항 제목", { exact: true }),
    ).toHaveAccessibleDescription("입력해 주세요.");
    await assertAccessible(page, info, `requirement-invalid-${width}`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
  });
}

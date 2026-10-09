import { expect, test, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { components } from "../apps/reference-app/src/generated/api";
import { choose, csrf } from "./support/requirements";
import { assertAccessible } from "./support/accessibility";

type Schedule = components["schemas"]["OperationalScheduleResponse"];
type SchedulePage = components["schemas"]["OperationalSchedulePage"];
type MessagePage = components["schemas"]["OperationMessagePage"];
type Metadata = { passwordFile: string; baseURL: string; deadEventId?: string };
type Credentials = { username: string; password: string };
async function metadata(starter = false): Promise<Metadata> {
  return JSON.parse(
    await fs.readFile(
      new URL(
        starter
          ? "../../.runtime/e2e-operations-starter.json"
          : "../../.runtime/e2e-operations.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}
async function login(page: Page, starter = false, actor?: Credentials) {
  const token = await csrf(page);
  // page.request는 화면과 같은 쿠키다. 합성 암호는 입력·trace·증거 본문에 남기지 않는다.
  const credentials = actor ?? {
    username: "admin",
    password: await fs.readFile((await metadata(starter)).passwordFile, "utf8"),
  };
  const response = await page.request.post("/api/auth/login", {
    form: credentials,
    headers: { [token.headerName]: token.token },
  });
  expect(response.status()).toBe(204);
}
async function write<T>(
  page: Page,
  path: string,
  data: unknown,
  method: "POST" | "PUT" = "POST",
  status = 200,
): Promise<T> {
  const token = await csrf(page);
  const response = await page.request.fetch("/api" + path, {
    method,
    data,
    headers: { [token.headerName]: token.token },
  });
  expect(response.status()).toBe(status);
  return response.json();
}
async function read<T>(page: Page, path: string): Promise<T> {
  const response = await page.request.get("/api" + path);
  expect(response.status()).toBe(200);
  return response.json();
}
function scheduleInput(cron = "0 17 * * * ?") {
  return { jobCode: "PULSE", cron, timeZone: "UTC", misfirePolicy: "SKIP", enabled: false };
}
const scheduleBaselines = new WeakMap<Page, Map<number, Schedule>>();
function savedScheduleInput(schedule: Schedule) {
  return {
    jobCode: schedule.jobCode,
    cron: schedule.cron,
    timeZone: schedule.timeZone,
    misfirePolicy: schedule.misfirePolicy,
    enabled: schedule.enabled,
  };
}
async function prepareSchedule(page: Page, jobCode: "PULSE" | "FILE_RECOVERY" = "PULSE") {
  const list = await read<SchedulePage>(page, "/operations/jobs/schedules?size=100");
  let baseline = list.items.find((schedule) => schedule.jobCode === jobCode);
  if (!baseline) {
    // job_code는 UNIQUE다. 기본 예약이 없는 PULSE만 최초 한 번 등록한다.
    expect(jobCode).toBe("PULSE");
    baseline = await write<Schedule>(page, "/operations/jobs/schedules", scheduleInput());
  }
  const baselines = scheduleBaselines.get(page) ?? new Map<number, Schedule>();
  baselines.set(baseline.id, baseline);
  scheduleBaselines.set(page, baselines);
  const input = { ...savedScheduleInput(baseline), cron: "0 17 * * * ?", enabled: false };
  if (baseline.cron === input.cron && baseline.enabled === input.enabled) return baseline;
  return write<Schedule>(
    page,
    "/operations/jobs/schedules/" + baseline.id,
    { ...input, revision: baseline.revision },
    "PUT",
  );
}

test.afterEach(async ({ page }) => {
  const baselines = scheduleBaselines.get(page);
  if (!baselines) return;
  await page.unrouteAll({ behavior: "wait" });
  // 예약 삭제 API는 없다. 현재 revision을 다시 읽어 원래 등록 작업/설정을 복원한다.
  for (const baseline of baselines.values()) {
    const current = await read<Schedule>(page, "/operations/jobs/schedules/" + baseline.id);
    const restored = await write<Schedule>(
      page,
      "/operations/jobs/schedules/" + baseline.id,
      { ...savedScheduleInput(baseline), revision: current.revision },
      "PUT",
    );
    expect(savedScheduleInput(restored)).toEqual(savedScheduleInput(baseline));
  }
  scheduleBaselines.delete(page);
});
function browserErrors(page: Page, allowed: readonly string[] = []) {
  const unexpected: string[] = [];
  const expected: string[] = [];
  page.on("pageerror", (error) => {
    if (allowed.includes(error.message)) expected.push(error.message);
    else unexpected.push(error.message);
  });
  return { unexpected, expected };
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}
async function screenshot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(name + ".png"), fullPage: true });
}
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState === "running" &&
            Number.isFinite(animation.effect?.getComputedTiming().endTime),
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

test("메시지 DEAD 재시도는 실제 broker 완료 후 같은 이벤트를 다시 처리하지 않는다", async ({
  page,
}) => {
  const errors = browserErrors(page);
  await login(page);
  const fixture = await metadata();
  expect(fixture.deadEventId).toBeTruthy();
  await page.goto("/operations/messages?state=DEAD");
  const retry = page.getByRole("button", {
    name: "실패 메시지 재시도: " + fixture.deadEventId,
    exact: true,
  });
  await expect(retry).toBeVisible();
  await retry.click();
  const dialog = page.getByRole("dialog", { name: "실패 메시지 재시도", exact: true });
  await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "확인", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(
      async () => {
        const result = await read<MessagePage>(
          page,
          "/operations/messages?page=0&size=100&type=MESSAGE_DEMO",
        );
        return result.items.find((item) => item.eventId === fixture.deadEventId)?.state;
      },
      { timeout: 75_000 },
    )
    .toBe("COMPLETED");
  const token = await csrf(page);
  const again = await page.request.post(
    "/api/operations/messages/" + fixture.deadEventId + "/retry",
    { data: {}, headers: { [token.headerName]: token.token } },
  );
  expect(again.status()).toBe(409);
  expect(errors.unexpected).toEqual([]);
});

test("등록된 예제 메시지는 실제 저장하고 URL 필터와 새로고침에서 조회한다", async ({ page }) => {
  const errors = browserErrors(page);
  await login(page);
  await page.goto("/operations/messages");
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/operations/messages/demo") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "등록된 예제 메시지 발행", exact: true }).click();
  const createdResponse = await response;
  expect(createdResponse.status()).toBe(202);
  const created: components["schemas"]["OperationMessageItem"] = await createdResponse.json();
  expect(created.type).toBe("MESSAGE_DEMO");
  const filters = page.getByRole("form", { name: "메시지 조회 조건", exact: true });
  await choose(page, filters, "메시지 종류", "MESSAGE_DEMO");
  await filters.getByRole("button", { name: "조회", exact: true }).click();
  await expect(page).toHaveURL(/type=MESSAGE_DEMO/);
  await page.reload();
  await expect(page.getByRole("table", { name: "메시지 처리 목록", exact: true })).toContainText(
    created.eventId,
  );
  expect(errors.unexpected).toEqual([]);
});

test("예약 409와 최신 GET 500은 기준 revision·입력을 유지하고 명시 reload만 초기화한다", async ({
  page,
}, info) => {
  const errors = browserErrors(page);
  await login(page);
  const item = await prepareSchedule(page);
  const missingCsrf = await page.request.post("/api/operations/jobs/schedules", {
    data: scheduleInput(),
  });
  expect(missingCsrf.status()).toBe(403);
  await page.goto("/operations/schedules?id=" + item.id);
  const form = page.getByRole("form", { name: "예약 입력", exact: true });
  const cron = form.getByRole("textbox", { name: "예약식", exact: true });
  await expect(cron).toHaveValue(item.cron);
  await cron.fill("0 29 * * * ?");
  const newer = await write<Schedule>(
    page,
    "/operations/jobs/schedules/" + item.id,
    { ...scheduleInput("0 19 * * * ?"), revision: item.revision },
    "PUT",
  );
  await form.getByRole("button", { name: "예약 저장", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "다른 변경이 먼저 저장되었습니다" }),
  ).toBeVisible();
  await expect(cron).toHaveValue("0 29 * * * ?");
  await expect(form.getByTestId("schedule-revision")).toHaveText(String(item.revision));
  await page.route("**/api/operations/jobs/schedules/" + item.id, async (route) => {
    if (route.request().method() === "GET")
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: "INTERNAL", message: "합성 최신 조회 실패", errors: [] }),
      });
    else await route.continue();
  });
  await page.getByRole("button", { name: "최신 자료 조회", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "작업 예약", exact: true });
  await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(cron).toHaveValue("0 29 * * * ?");
  await page.getByRole("button", { name: "최신 자료 조회", exact: true }).click();
  await dialog.getByRole("button", { name: "확인", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "합성 최신 조회 실패" }).first(),
  ).toBeVisible();
  await expect(cron).toHaveValue("0 29 * * * ?");
  await expect(form.getByTestId("schedule-revision")).toHaveText(String(item.revision));
  await expect(
    page.getByRole("alert").filter({ hasText: "다른 변경이 먼저 저장되었습니다" }),
  ).toBeVisible();
  await assertAccessible(page, info, "operations-schedule-conflict-latest500");
  await page.unroute("**/api/operations/jobs/schedules/" + item.id);
  await page.getByRole("button", { name: "최신 자료 조회", exact: true }).click();
  await dialog.getByRole("button", { name: "확인", exact: true }).click();
  await expect(cron).toHaveValue(newer.cron);
  await expect(form.getByTestId("schedule-revision")).toHaveText(String(newer.revision));
  expect(errors.unexpected).toEqual([]);
});

test("예약 선택·이동 확인은 미저장 입력을 지키고 pause/resume은 revision을 갱신한다", async ({
  page,
}) => {
  const errors = browserErrors(page);
  await login(page);
  const first = await prepareSchedule(page);
  const second = await prepareSchedule(page, "FILE_RECOVERY");
  await page.goto("/operations/schedules?id=" + first.id);
  const form = page.getByRole("form", { name: "예약 입력", exact: true });
  const cron = form.getByRole("textbox", { name: "예약식", exact: true });
  await expect(cron).toHaveValue(first.cron);
  await cron.fill("0 31 * * * ?");
  await page
    .getByRole("button", { name: "선택 · 예약 " + second.id + " 편집", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "작업 예약", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(new RegExp("id=" + first.id + "(?:&|$)"));
  await expect(cron).toHaveValue("0 31 * * * ?");
  await page
    .getByRole("button", { name: "선택 · 예약 " + second.id + " 편집", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "확인", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(new RegExp("id=" + second.id + "(?:&|$)"));
  await expect(form.getByTestId("schedule-revision")).toHaveText(String(second.revision));
  await page.getByRole("button", { name: "예약 재개", exact: true }).click();
  await expect(form.getByTestId("schedule-revision")).toHaveText(String(second.revision + 1));
  await page.getByRole("button", { name: "예약 일시정지", exact: true }).click();
  await expect(form.getByTestId("schedule-revision")).toHaveText(String(second.revision + 2));
  expect(errors.unexpected).toEqual([]);
});

test("A 예약 저장이 B 선택 뒤 완료돼도 B 입력·revision을 교체하지 않는다", async ({ page }) => {
  const errors = browserErrors(page);
  await login(page);
  const a = await prepareSchedule(page);
  const b = await prepareSchedule(page, "FILE_RECOVERY");
  await page.goto("/operations/schedules?id=" + b.id);
  const form = page.getByRole("form", { name: "예약 입력", exact: true });
  const cron = form.getByRole("textbox", { name: "예약식", exact: true });
  await expect(cron).toHaveValue(b.cron);
  await page.getByRole("button", { name: "선택 · 예약 " + a.id + " 편집", exact: true }).click();
  await expect(form.getByTestId("schedule-revision")).toHaveText(String(a.revision));
  await cron.fill("0 37 * * * ?");
  let release: (() => void) | undefined;
  let entered: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/operations/jobs/schedules/" + a.id, async (route) => {
    if (route.request().method() !== "PUT") {
      await route.continue();
      return;
    }
    entered?.();
    await held;
    await route.continue();
  });
  let saved: ReturnType<Page["waitForResponse"]> | undefined;
  try {
    saved = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/operations/jobs/schedules/" + a.id) &&
        response.request().method() === "PUT",
    );
    await form.getByRole("button", { name: "예약 저장", exact: true }).click();
    await waiting;
    const navigation = page.goBack();
    const dialog = page.getByRole("dialog", { name: "작업 예약", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "확인", exact: true }).click();
    await navigation;
    await expect(form.getByTestId("schedule-revision")).toHaveText(String(b.revision));
    await expect(cron).toHaveValue(b.cron);
    release?.();
    expect((await saved).status()).toBe(200);
    await expect(form.getByRole("button", { name: "예약 저장", exact: true })).toBeEnabled();
    await expect(form.getByTestId("schedule-revision")).toHaveText(String(b.revision));
    await expect(cron).toHaveValue(b.cron);
    expect((await read<Schedule>(page, "/operations/jobs/schedules/" + a.id)).cron).toBe(
      "0 37 * * * ?",
    );
    expect(errors.unexpected).toEqual([]);
  } finally {
    release?.();
    await saved?.catch(() => undefined);
  }
});

test("실제 window/rejection 수집은 로그인 후 코드만 보내고 동일 Error를 중복하지 않는다", async ({
  page,
}) => {
  const errors = browserErrors(page, ["window private canary", "rejection private canary"]);
  const sent: Record<string, unknown>[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/operations/browser-errors") && request.method() === "POST")
      sent.push(request.postDataJSON());
  });
  await page.goto("/login");
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error("window private canary");
    }, 0);
  });
  await expect.poll(() => errors.expected.length).toBe(1);
  expect(sent).toHaveLength(0);
  await login(page);
  await page.goto("/operations/browser-errors");
  await expect(page.getByRole("table", { name: "브라우저 오류 집계", exact: true })).toBeVisible();
  await page.evaluate(() => {
    const same = new Error("window private canary");
    setTimeout(() => {
      throw same;
    }, 0);
    setTimeout(() => {
      void Promise.reject(same);
    }, 0);
    void Promise.reject(new Error("rejection private canary"));
  });
  await expect.poll(() => sent.length).toBe(2);
  expect(sent.map((event) => event.eventCode).sort()).toEqual([
    "UNHANDLED_REJECTION",
    "WINDOW_ERROR",
  ]);
  for (const event of sent) {
    expect(Object.keys(event).sort()).toEqual(
      [
        "schemaVersion",
        "clientEventId",
        "source",
        "eventCode",
        "appVersion",
        "routeCode",
        "componentCode",
      ].sort(),
    );
    expect(event.routeCode).toBe("operations-browser-errors");
    expect(event.schemaVersion).toBe(1);
    expect(event.appVersion).toBe("0.1.0");
    expect(event.componentCode).toBe("ROOT");
    expect(event.clientEventId).toMatch(/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i);
  }
  expect(JSON.stringify(sent)).not.toMatch(/private|canary|message|stack|token|cookie|query|info/);
  await expect
    .poll(async () =>
      (
        await read<components["schemas"]["BrowserErrorGroupPage"]>(
          page,
          "/operations/browser-errors/groups?page=0&size=100",
        )
      ).items.some(
        (group) =>
          group.routeCode === "operations-browser-errors" && group.eventCode === "WINDOW_ERROR",
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "최신 자료 조회", exact: true }).click();
  await page
    .getByRole("button", { name: /오류 그룹 \d+ 이력/ })
    .first()
    .click();
  await expect(page.getByRole("table", { name: /브라우저 오류 발생 이력 표/ })).toContainText(
    "admin",
  );
  await page.getByRole("button", { name: /^사용자 메뉴 열기:/ }).click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.evaluate(() => {
    void Promise.reject(new Error("rejection private canary"));
  });
  await expect.poll(() => errors.expected.length).toBe(5);
  expect(sent).toHaveLength(2);
  expect(errors.unexpected).toEqual([]);
});

test("수집 HTTP 실패는 재시도·재수집하지 않고 일반 사용자는 운영 조회가 금지된다", async ({
  page,
}) => {
  const errors = browserErrors(page, ["window private canary"]);
  const featureGets: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "GET" &&
      new URL(request.url()).pathname.startsWith("/api/operations/")
    )
      featureGets.push(new URL(request.url()).pathname);
  });
  await login(page);
  const credentials = { username: "op" + randomUUID().slice(0, 8), password: "Sc-" + randomUUID() };
  await write(page, "/users", {
    ...credentials,
    displayName: "운영 권한 합성 사용자",
    role: "REQUESTER",
  });
  const token = await csrf(page);
  await page.request.post("/api/auth/logout", { headers: { [token.headerName]: token.token } });
  await login(page, false, credentials);
  let posts = 0;
  await page.route("**/api/operations/browser-errors", async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: "INTERNAL", message: "합성 수집 실패", errors: [] }),
      });
    } else await route.continue();
  });
  const capability = page.waitForResponse((response) =>
    response.url().endsWith("/api/framework/capabilities"),
  );
  await page.goto("/operations/browser-errors");
  await capability;
  await expect(page.getByRole("status").filter({ hasText: "관리자만 운영 자료" })).toBeVisible();
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error("window private canary");
    }, 0);
  });
  await expect.poll(() => posts).toBe(1);
  await settle(page);
  expect(posts).toBe(1);
  const forbidden = await page.request.get("/api/operations/messages?page=0&size=20");
  expect(forbidden.status()).toBe(403);
  expect(featureGets).toEqual([]);
  expect(errors.unexpected).toEqual([]);
});

for (const width of [390, 1366]) {
  test(
    "운영 " + width + "px: KO/EN 예약·오류·메시지 전체 DOM 접근성과 키보드 가로 스크롤",
    async ({ page }, info) => {
      const errors = browserErrors(page);
      await page.setViewportSize({ width, height: 844 });
      await login(page);
      const schedule = await prepareSchedule(page);
      await page.goto("/operations/schedules?id=" + schedule.id);
      await expect(page.getByRole("form", { name: "예약 입력", exact: true })).toBeVisible();
      await assertAccessible(page, info, "operations-schedules-ko-" + width);
      await noOverflow(page);
      await screenshot(page, info, "operations-schedules-ko-" + width);
      if (width === 390) {
        const region = page.getByRole("region", {
          name: "작업 예약 목록 가로 스크롤",
          exact: true,
        });
        await region.focus();
        const before = await region.evaluate((element) => element.scrollLeft);
        await page.keyboard.press("ArrowRight");
        await expect
          .poll(() => region.evaluate((element) => element.scrollLeft))
          .toBeGreaterThan(before);
      }
      await page.getByLabel("언어 / Language", { exact: true }).selectOption("en");
      await expect(page.getByRole("form", { name: "Schedule form", exact: true })).toBeVisible();
      await assertAccessible(page, info, "operations-schedules-en-" + width);
      await noOverflow(page);
      await screenshot(page, info, "operations-schedules-en-" + width);
      // locale는 현재 앱 인스턴스 상태다. 새 문서 goto 대신 실제 RouterLink로 이동한다.
      const operations = page.getByRole("navigation", { name: "Operations", exact: true });
      await operations.getByRole("link", { name: "Message processing", exact: true }).click();
      await expect(page).toHaveURL(/\/operations\/messages(?:\?|$)/);
      await expect(page.getByLabel("언어 / Language", { exact: true })).toHaveValue("en");
      await expect(
        page.getByRole("table", { name: "Message processing list", exact: true }),
      ).toBeVisible();
      await assertAccessible(page, info, "operations-messages-en-" + width);
      await operations.getByRole("link", { name: "Browser errors", exact: true }).click();
      await expect(page).toHaveURL(/\/operations\/browser-errors(?:\?|$)/);
      await expect(page.getByLabel("언어 / Language", { exact: true })).toHaveValue("en");
      await expect(
        page.getByRole("table", { name: "Browser error aggregates", exact: true }),
      ).toBeVisible();
      await assertAccessible(page, info, "operations-errors-en-" + width);
      expect(errors.unexpected).toEqual([]);
    },
  );
}

test.describe("Starter 중립 운영 소비", () => {
  test.use({
    baseURL: "http://127.0.0.1:" + (process.env.SC_E2E_OPERATIONS_STARTER_PORT ?? "18194"),
  });
  test("Starter는 독립 예약·메시지 API와 실제 오류 수집을 공통 runtime/UI로 소비한다", async ({
    page,
  }, info) => {
    const errors = browserErrors(page, ["window private canary"]);
    await login(page, true);
    await page.goto("/operations/schedules");
    const form = page.getByRole("form", { name: "예약 입력", exact: true });
    await expect(form).toBeVisible();
    await choose(page, form, "등록 작업", "PULSE · TRANSACTIONAL");
    await form.getByRole("textbox", { name: "예약식", exact: true }).fill("0 23 * * * ?");
    await form.getByRole("checkbox", { name: "예약 활성", exact: true }).uncheck();
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/operations/jobs/schedules") &&
        response.request().method() === "POST",
    );
    await form.getByRole("button", { name: "예약 저장", exact: true }).click();
    expect((await created).status()).toBe(200);
    await expect(form.getByTestId("schedule-revision")).toHaveText("1");
    await page.reload();
    await expect(form.getByRole("textbox", { name: "예약식", exact: true })).toHaveValue(
      "0 23 * * * ?",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await assertAccessible(page, info, "operations-starter-schedules-390");
    await noOverflow(page);
    await page.goto("/operations/messages");
    const message = page.waitForResponse((response) =>
      response.url().endsWith("/api/operations/messages/demo"),
    );
    await page.getByRole("button", { name: "등록된 예제 메시지 발행", exact: true }).click();
    expect((await message).status()).toBe(202);
    await page.goto("/operations/browser-errors");
    await expect(page.getByRole("table", { name: "브라우저 오류", exact: true })).toBeVisible();
    const collected = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/operations/browser-errors") &&
        response.request().method() === "POST",
    );
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error("window private canary");
      }, 0);
    });
    expect((await collected).status()).toBe(202);
    await assertAccessible(page, info, "operations-starter-errors-390");
    expect(errors.unexpected).toEqual([]);
  });
});

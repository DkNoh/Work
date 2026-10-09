import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { components } from "../apps/reference-app/src/generated/api";
import { assertAccessible } from "./support/accessibility";
import {
  choose,
  command,
  create,
  csrf,
  fixtures,
  login,
  switchActor,
} from "./support/requirements";

type User = components["schemas"]["UserResponse"];
type Menu = components["schemas"]["MenuResponse"];
type AuditPage = components["schemas"]["AuditPage"];
type Report = components["schemas"]["RequirementReportPage"];

function observeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  return errors;
}
async function capture(page: Page, info: TestInfo, state: string) {
  // axe의 node HTML에도 암호 값이 남지 않게 비어 있는 form만 검사한다.
  for (const field of await page.locator("input[type=password]").all())
    expect((await field.inputValue()) === "").toBe(true);
  await assertAccessible(page, info, state);
  const file = info.outputPath(`${state}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await info.attach(state, { path: file, contentType: "image/png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function language(page: Page, locale: "ko" | "en") {
  await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}
async function read<T>(page: Page, path: string): Promise<T> {
  const response = await page.request.get(`/api${path}`);
  expect(response.status()).toBe(200);
  return response.json() as Promise<T>;
}

for (const width of [390, 1366]) {
  test(`ADMIN creates users and edits menus; audit and DB permissions at ${width}`, async ({
    page,
  }, info) => {
    const errors = observeErrors(page);
    await page.setViewportSize({ width, height: 844 });
    const data = await fixtures(page);
    const suffix = randomUUID().slice(0, 8);
    const username = `ui-user-${suffix}`;
    const displayName = `화면에서 만든 계정 ${suffix}`;
    const password = `Sc-${randomUUID()}`;
    await page.goto("/admin/users");
    const userForm = page.getByRole("form", { name: "사용자 생성", exact: true });
    await userForm.getByRole("button", { name: "사용자 생성", exact: true }).click();
    await expect(
      userForm.getByRole("textbox", { name: "계정명", exact: true }),
    ).toHaveAccessibleDescription("입력값과 길이를 확인해 주세요.");
    await capture(page, info, `admin-users-${width}-ko-validation`);
    await userForm.getByLabel("계정명", { exact: true }).fill(username);
    await userForm.getByLabel("표시 이름", { exact: true }).fill(displayName);
    await userForm.getByLabel("초기 비밀번호", { exact: true }).fill(password);
    await choose(page, userForm, "역할", "REVIEWER");
    await userForm.getByRole("button", { name: "사용자 생성", exact: true }).click();
    await expect(userForm.getByRole("status")).toHaveText("저장했습니다.");
    const savedUser = (await read<User[]>(page, "/users")).find((row) => row.username === username);
    expect(savedUser?.role).toBe("REVIEWER");
    expect(savedUser?.displayName).toBe(displayName);
    expect(savedUser && Object.keys(savedUser).sort()).toEqual([
      "displayName",
      "id",
      "role",
      "username",
    ]);
    expect((await userForm.getByLabel("초기 비밀번호", { exact: true }).inputValue()) === "").toBe(
      true,
    );
    await language(page, "en");
    await expect(page.getByRole("heading", { name: "Users", level: 1, exact: true })).toBeVisible();
    await capture(page, info, `admin-users-${width}-en-created`);

    await page.goto("/admin/menus");
    const menuForm = page.getByRole("form", { name: "메뉴 생성", exact: true });
    const menuName = `생성한 메뉴 ${suffix}`;
    await menuForm.getByLabel("메뉴 이름", { exact: true }).fill(menuName);
    await menuForm.getByLabel("정렬 순서", { exact: true }).fill("-3");
    await choose(page, menuForm, "상위 메뉴", data.menu.name);
    await menuForm.getByRole("button", { name: "메뉴 생성", exact: true }).click();
    await expect(page.getByRole("link", { name: menuName, exact: true })).toBeVisible();
    const menu = (await read<Menu[]>(page, "/menus")).find((row) => row.name === menuName);
    expect(menu?.parentId).toBe(data.menu.id);
    expect(menu?.sortOrder).toBe(-3);
    expect(menu?.active).toBe(1);
    expect(menu).toBeDefined();
    await page.getByRole("link", { name: menuName, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/menus\\?id=${menu!.id}$`));
    const editForm = page.getByRole("form", { name: "메뉴 수정", exact: true });
    await editForm.getByLabel("메뉴 이름", { exact: true }).fill(`${menuName} 변경`);
    await editForm.getByLabel("정렬 순서", { exact: true }).fill("-5");
    await editForm.getByRole("checkbox", { name: "사용", exact: true }).uncheck();
    await editForm.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByRole("link", { name: `${menuName} 변경`, exact: true })).toBeVisible();
    const updated = (await read<Menu[]>(page, "/menus")).find((row) => row.id === menu!.id);
    expect(updated).toMatchObject({
      name: `${menuName} 변경`,
      parentId: data.menu.id,
      sortOrder: -5,
      active: 0,
    });
    await capture(page, info, `admin-menus-${width}-ko-updated`);
    await language(page, "en");
    await expect(
      page
        .getByRole("form", { name: "Edit menu", exact: true })
        .getByLabel("Menu name", { exact: true }),
    ).toHaveValue(`${menuName} 변경`);
    await capture(page, info, `admin-menus-${width}-en-updated`);

    await page.goto("/admin/audit");
    const auditForm = page.getByRole("form", { name: "조회", exact: true });
    await auditForm.getByLabel("감사 동작", { exact: true }).fill("MENU_UPDATE");
    await auditForm.getByLabel("계정", { exact: true }).fill("admin");
    await choose(page, auditForm, "결과", "성공");
    await auditForm.getByRole("button", { name: "조회", exact: true }).click();
    await expect(page).toHaveURL(/action=MENU_UPDATE/);
    const recorded = await read<AuditPage>(
      page,
      "/audit/events?action=MENU_UPDATE&outcome=SUCCESS&actorSubject=admin&page=0&size=100",
    );
    expect(
      recorded.items.some(
        (row) => row.resourceType === "MENU" && row.resourceId === String(menu!.id),
      ),
    ).toBe(true);
    await expect(
      page
        .locator(".audit-list > li")
        .filter({ has: page.getByText(`MENU · ${menu!.id}`, { exact: true }) }),
    ).toBeVisible();
    await capture(page, info, `admin-audit-${width}-ko-filtered`);
    await language(page, "en");
    await expect(
      page
        .getByRole("form", { name: "Search", exact: true })
        .getByLabel("Audit action", { exact: true }),
    ).toHaveValue("MENU_UPDATE");
    await capture(page, info, `admin-audit-${width}-en-filtered`);

    await switchActor(page, data.author.credentials);
    await page.goto("/admin/users");
    await expect(page.getByRole("alert")).toHaveText("현재 계정의 관리자 권한이 필요합니다.");
    await expect(page.getByRole("form", { name: "사용자 생성", exact: true })).toHaveCount(0);
    const token = await csrf(page);
    expect(
      (
        await page.request.post("/api/users", {
          data: { username: `denied-${suffix}`, displayName: "권한 거절", password, role: "ADMIN" },
          headers: { [token.headerName]: token.token },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.put(`/api/menus/${menu!.id}`, {
          data: { name: "권한 거절", sortOrder: 0, active: true },
          headers: { [token.headerName]: token.token },
        })
      ).status(),
    ).toBe(403);
    expect((await page.request.get("/api/audit/events")).status()).toBe(403);
    await capture(page, info, `admin-${width}-requester-denied`);
    expect(errors).toEqual([]);
  });

  test(`synthetic account password changes end the session and require replacement credentials at ${width}`, async ({
    page,
  }, info) => {
    const errors = observeErrors(page);
    await page.setViewportSize({ width, height: 844 });
    const data = await fixtures(page);
    await switchActor(page, data.author.credentials);
    const nextPassword = `Sc-new-${randomUUID()}`;
    await page.goto("/account");
    const form = page.getByRole("form", { name: "비밀번호 변경", exact: true });
    await capture(page, info, `account-${width}-ko`);
    await form
      .getByLabel("현재 비밀번호", { exact: true })
      .fill("synthetic-wrong-current-password");
    await form.getByLabel("새 비밀번호", { exact: true }).fill(nextPassword);
    await form.getByLabel("새 비밀번호 확인", { exact: true }).fill(nextPassword);
    await form.getByRole("button", { name: "비밀번호 변경", exact: true }).click();
    await expect(form.getByRole("alert")).toHaveText("현재 비밀번호가 일치하지 않습니다.");
    expect((await read<User>(page, "/auth/me")).id).toBe(data.author.user.id);
    for (const field of await form.locator("input[type=password]").all()) await field.fill("");
    await language(page, "en");
    const englishForm = page.getByRole("form", { name: "Change password", exact: true });
    await capture(page, info, `account-${width}-en-current-password-error`);
    await englishForm
      .getByLabel("Current password", { exact: true })
      .fill(data.author.credentials.password);
    await englishForm.getByLabel("New password", { exact: true }).fill(nextPassword);
    await englishForm.getByLabel("Confirm new password", { exact: true }).fill(nextPassword);
    await englishForm.getByRole("button", { name: "Change password", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
    const token = await csrf(page);
    expect(
      (
        await page.request.post("/api/auth/login", {
          form: data.author.credentials,
          headers: { [token.headerName]: token.token },
        })
      ).status(),
    ).toBe(401);
    await login(page, { username: data.author.credentials.username, password: nextPassword });
    await page.goto("/account");
    expect((await read<User>(page, "/auth/me")).id).toBe(data.author.user.id);
    await expect(page.getByRole("form", { name: "비밀번호 변경", exact: true })).toBeVisible();
    await capture(page, info, `account-${width}-replacement-session`);
    expect(errors).toEqual([]);
  });

  test(`report chart uses the API's six full-result status counts rather than the loaded page at ${width}`, async ({
    page,
  }, info) => {
    const errors = observeErrors(page);
    await page.setViewportSize({ width, height: 844 });
    const data = await fixtures(page);
    await switchActor(page, data.author.credentials);
    const prefix = `chart-${randomUUID().slice(0, 8)}`;
    await create(page, data.menu, `${prefix}-draft`);
    const submitted = await create(page, data.menu, `${prefix}-submitted`);
    await command(page, `/requirements/${submitted.id}/submit`, "POST", {
      revision: submitted.revision,
    });
    const query = new URLSearchParams({
      q: prefix,
      menuId: String(data.menu.id),
      page: "0",
      size: "1",
    });
    const report = await read<Report>(page, `/reports/requirements?${query}`);
    expect(report.total).toBe(2);
    expect(report.items).toHaveLength(1);
    expect(report.stats.DRAFT).toBe(1);
    expect(report.stats.REQUESTED).toBe(1);
    await page.goto(`/reports/requirements?${query}`);
    const figure = page.getByRole("figure", { name: "전체 조회 결과의 상태 분포", exact: true });
    await expect(figure.locator("svg")).toHaveCount(1);
    await figure.locator("summary").click();
    const statuses = [
      "DRAFT",
      "REQUESTED",
      "NEEDS_INFO",
      "REVIEWING",
      "AGREED",
      "ADO_LINKED",
    ] as const;
    const labels = {
      ko: ["초안", "요청됨", "추가 정보 필요", "검토 중", "합의됨", "ADO 연결됨"],
      en: ["Draft", "Requested", "More information needed", "Under review", "Agreed", "ADO linked"],
    };
    for (const locale of ["ko", "en"] as const) {
      if (locale === "en") await language(page, "en");
      const chart = page.locator(".sc-chart");
      const rows = chart.locator("tbody tr");
      await expect(rows).toHaveCount(6);
      for (const [index, status] of statuses.entries()) {
        const row = rows.filter({
          has: page.getByRole("rowheader", { name: labels[locale][index]!, exact: true }),
        });
        await expect(row.getByRole("cell")).toHaveText(String(report.stats[status]));
      }
      expect(statuses.reduce((total, status) => total + report.stats[status], 0)).toBe(
        report.total,
      );
      await capture(page, info, `report-chart-${width}-${locale}`);
    }
    expect(errors).toEqual([]);
  });
}

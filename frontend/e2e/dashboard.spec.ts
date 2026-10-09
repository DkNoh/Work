import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import type { components } from "../apps/reference-app/src/generated/api";
import { assertAccessible } from "./support/accessibility";

type Report = components["schemas"]["RequirementReportPage"];

async function loginThroughForm(page: Page) {
  const metadata = JSON.parse(
    await fs.readFile(new URL("../../.runtime/e2e.json", import.meta.url), "utf8"),
  ) as { passwordFile: string };
  // e2e-server의 새 격리 H2용 합성 암호만 읽는다. 본문·값·trace는 출력하지 않는다.
  const password = await fs.readFile(metadata.passwordFile, "utf8");
  const form = page.getByRole("form", { name: "로그인", exact: true });
  await form.getByLabel("아이디", { exact: true }).fill("admin");
  await form.getByLabel("비밀번호", { exact: true }).fill(password);
  const loggedIn = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/login" &&
      response.request().method() === "POST",
  );
  await form.getByRole("button", { name: "로그인", exact: true }).click();
  expect((await loggedIn).status()).toBe(204);
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function language(page: Page, locale: "ko" | "en") {
  await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

function csvRows(content: string) {
  // 실제 내려받은 CSV의 인용 셀을 읽어 쉼표가 있는 금액도 한 칸으로 비교한다.
  return content
    .slice(1)
    .split("\r\n")
    .map((line) =>
      Array.from(line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g), (match) =>
        match[1]!.replaceAll('""', '"'),
      ),
    );
}

for (const width of [1440, 390]) {
  test(`대시보드 ${width}px: 로그인·샘플 CSV·차트 표·실제 집계`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.name));
    await page.setViewportSize({ width, height: 1000 });

    const initial = await page.goto("/dashboard");
    expect(initial?.status()).toBe(200);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "로그인", exact: true }),
    ).toBeVisible();
    await loginThroughForm(page);

    let dashboard = page.getByRole("region", { name: "매출 대시보드", exact: true });
    await expect(dashboard.getByRole("heading", { level: 1 })).toHaveText(/^안녕하세요, admin님$/);
    await expect(dashboard.locator(".dashboard-data-note")).toContainText("샘플 데이터");
    await expect(dashboard.locator(".sc-kpi-card")).toHaveCount(4);
    await expect(dashboard.getByRole("region", { name: "전체 주문", exact: true })).toContainText(
      "12,480",
    );
    await expect(dashboard.locator(".sc-series-chart__plot .echarts-host svg")).toBeVisible();

    await dashboard
      .getByRole("combobox", { name: "조회 기간", exact: true })
      .selectOption("quarter");
    await expect.poll(() => new URL(page.url()).searchParams.get("period")).toBe("quarter");
    await expect(dashboard.getByRole("region", { name: "전체 주문", exact: true })).toContainText(
      "37,440",
    );
    const reloaded = await page.reload();
    expect(reloaded?.status()).toBe(200);
    expect(reloaded?.headers()["content-type"]).toContain("text/html");
    await expect(page).toHaveURL(/\/dashboard\?period=quarter$/);
    await expect(dashboard.getByRole("region", { name: "전체 주문", exact: true })).toContainText(
      "37,440",
    );

    const downloaded = page.waitForEvent("download");
    await dashboard.getByRole("button", { name: "현재 표 CSV 내려받기", exact: true }).click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toBe("sc-dashboard.csv");
    expect(await download.failure()).toBeNull();
    const path = await download.path();
    expect(path !== null).toBe(true);
    const content = await fs.readFile(path!, "utf8");
    expect(content.startsWith("\uFEFF")).toBe(true);
    const exported = csvRows(content);
    const orderTable = dashboard
      .getByRole("region", { name: "최근 주문 표", exact: true })
      .getByRole("table");
    expect(exported).toHaveLength(5);
    expect(exported.every((row) => row.length === 5)).toBe(true);
    expect(exported[0]).toEqual(
      (await orderTable.getByRole("columnheader").allTextContents()).map((value) => value.trim()),
    );
    expect(exported[1]).toEqual([
      "스튜디오 헤드폰",
      "김민수",
      "₩128,000",
      "배송 완료",
      "2026.10.07",
    ]);

    const summary = dashboard
      .getByText("차트 데이터 보기", { exact: true })
      .and(dashboard.locator("summary"));
    await summary.focus();
    await expect(summary).toBeFocused();
    // 실제 Chromium 키 입력으로 native details의 기본 동작을 확인한다.
    await page.keyboard.press("Enter");
    const chartTable = dashboard.getByRole("table", { name: "매출 현황", exact: true });
    await expect(chartTable).toBeVisible();
    await expect(chartTable.getByRole("columnheader")).toHaveCount(3);
    await assertAccessible(page, info, `dashboard-${width}-sample-ko`);

    await language(page, "en");
    dashboard = page.getByRole("region", { name: "Sales dashboard", exact: true });
    await expect(dashboard.getByRole("heading", { level: 1 })).toHaveText(/^Hello there, admin$/);
    await expect(
      dashboard.getByRole("combobox", { name: "Dashboard data", exact: true }),
    ).toHaveValue("sample");
    await expect(dashboard.getByRole("combobox", { name: "Period", exact: true })).toHaveValue(
      "quarter",
    );
    await expect(
      dashboard.getByRole("region", { name: "Number of sales", exact: true }),
    ).toContainText("37,440");
    await expect(
      dashboard.getByRole("table", { name: "Sales revenue", exact: true }),
    ).toBeVisible();
    await assertAccessible(page, info, `dashboard-${width}-sample-en`);

    await language(page, "ko");
    dashboard = page.getByRole("region", { name: "매출 대시보드", exact: true });
    const received = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/reports/requirements" &&
        response.request().method() === "GET",
    );
    await dashboard
      .getByRole("combobox", { name: "대시보드 데이터", exact: true })
      .selectOption("live");
    const response = await received;
    expect(response.status()).toBe(200);
    const report = (await response.json()) as Report;
    await expect.poll(() => new URL(page.url()).searchParams.get("source")).toBe("live");
    await expect(dashboard.locator(".dashboard-data-note")).toContainText("실제 업무 데이터");
    await expect(dashboard.locator(".sc-kpi-card")).toHaveCount(4);
    for (const [label, value] of [
      ["전체 요구사항", report.total],
      ["검토 중", report.stats.REVIEWING],
      ["검토 요청", report.stats.REQUESTED],
      ["합의 완료", report.stats.AGREED + report.stats.ADO_LINKED],
    ] as const) {
      await expect(
        dashboard
          .getByRole("region", { name: label, exact: true })
          .getByText(new Intl.NumberFormat("ko-KR").format(value), { exact: true }),
      ).toBeVisible();
    }
    await expect(
      dashboard.getByRole("heading", { name: "브라우저 활동", exact: true }),
    ).toHaveCount(0);
    await expect(dashboard.getByRole("combobox", { name: "조회 기간", exact: true })).toHaveCount(
      0,
    );
    await assertAccessible(page, info, `dashboard-${width}-live-ko`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
}

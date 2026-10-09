import { expect, test } from "@playwright/test";
import { assertAccessible } from "./support/accessibility";
import { choose } from "./support/requirements";

const starterOrigin = `http://127.0.0.1:${process.env.SC_E2E_STARTER_PORT ?? "18184"}`;

for (const width of [390, 1366]) {
  test(`Starter 날짜 ${width}px: calendar·UTC 정밀도·DST·언어를 독립적으로 처리한다`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.name));
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${starterOrigin}/patterns`);
    const region = page.getByRole("region", { name: "날짜 표시 예제", exact: true });
    await expect(region).toBeVisible();
    const calendar = region.getByLabel("달력 날짜", { exact: true });
    const timestamp = region.getByLabel("UTC 시각 원문", { exact: true });
    await calendar.fill("1900-02-29");
    await expect(region.getByTestId("date-calendar-result")).toHaveText("유효하지 않은 날짜");
    await expect(calendar).toHaveValue("1900-02-29");
    await calendar.fill("2026-03-08");
    const raw = "2026-03-08T06:59:59.123456789Z";
    await timestamp.fill(raw);
    await choose(page, region, "표시 시간대", "America/New_York");
    await expect(region.getByTestId("date-timestamp-result")).toHaveText(
      "2026-03-08 01:59:59 -05:00",
    );
    await expect(region.getByTestId("date-calendar-result")).toHaveText("2026년 3월 8일");
    await expect(region.getByTestId("date-raw-timestamp")).toHaveText(raw);
    const afterDst = "2026-03-08T07:00:00.987654321Z";
    await timestamp.fill(afterDst);
    await expect(region.getByTestId("date-timestamp-result")).toHaveText(
      "2026-03-08 03:00:00 -04:00",
    );
    await choose(page, region, "날짜 언어", "English");
    await expect(region.getByTestId("date-calendar-result")).toHaveText("Mar 8, 2026");
    await expect(timestamp).toHaveValue(afterDst);
    await expect(region.getByTestId("date-raw-timestamp")).toHaveText(afterDst);
    await assertAccessible(page, info, `starter-date-dst-${width}`);
    await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption("en");
    const english = page.getByRole("region", { name: "Date display examples", exact: true });
    await expect(english.getByLabel("Raw UTC timestamp", { exact: true })).toHaveValue(afterDst);
    await expect(english.getByLabel("Calendar date", { exact: true })).toHaveValue("2026-03-08");
    await expect(english.getByTestId("date-calendar-result")).toHaveText("Mar 8, 2026");
    await assertAccessible(page, info, `starter-date-en-${width}`);
    expect(errors).toEqual([]);
  });
}

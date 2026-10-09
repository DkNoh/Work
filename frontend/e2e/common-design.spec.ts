// 같은 공개 UI 패키지를 소비하는 두 앱에서 실제 규격·키보드·초안 보존을 확인한다.
import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import { assertAccessible } from "./support/accessibility";

for (const application of ["reference", "starter"] as const) {
  for (const width of [1440, 390]) {
    test(`공통 디자인 ${application} ${width}px: 규격·키보드·언어 전환`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.name));
      await page.setViewportSize({ width, height: 1000 });
      const metadata = JSON.parse(
        await fs.readFile(
          new URL(
            application === "reference"
              ? "../../.runtime/e2e.json"
              : "../../.runtime/e2e-starter.json",
            import.meta.url,
          ),
          "utf8",
        ),
      ) as { baseURL: string; passwordFile: string };
      if (application === "reference") {
        const csrf = (await (
          await page.request.get(metadata.baseURL + "/api/auth/csrf")
        ).json()) as { headerName: string; token: string };
        const loggedIn = await page.request.post(metadata.baseURL + "/api/auth/login", {
          form: { username: "admin", password: await fs.readFile(metadata.passwordFile, "utf8") },
          headers: { [csrf.headerName]: csrf.token },
        });
        expect(loggedIn.status()).toBe(204);
      }
      await page.goto(metadata.baseURL + "/patterns");
      const panel = page.getByRole("region", { name: "공통 디자인 규격", exact: true });
      await expect(panel).toBeVisible();
      for (const [name, height] of [
        ["작은 버튼", 32],
        ["기본 버튼", 38],
        ["큰 버튼", 44],
      ] as const) {
        const button = panel.getByRole("button", { name, exact: true });
        await expect(button).toBeVisible();
        expect((await button.boundingBox())?.height).toBe(height);
      }
      const count = panel.getByRole("status", { name: "디자인 예제 실행 횟수", exact: true });
      await expect(count).toHaveText("0");
      const small = panel.getByRole("button", { name: "작은 버튼", exact: true });
      await small.focus();
      await page.keyboard.press("Enter");
      await expect(count).toHaveText("1");
      const icon = panel.getByRole("button", { name: "디자인 예제 새로 조회", exact: true });
      await icon.focus();
      await page.keyboard.press("Space");
      await expect(count).toHaveText("2");
      await panel
        .getByRole("textbox", { name: "간결한 제목", exact: true })
        .fill("공통 규격의 입력 초안");
      const category = panel.getByRole("combobox", { name: "간결한 구분", exact: true });
      await category.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("listbox")).toBeVisible();
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
      await expect(category).toHaveValue("검토 업무");
      await expect(panel.getByText("사용 준비", { exact: true })).toBeVisible();
      await assertAccessible(page, info, `${application}-${width}-common-design-ko`);
      await page.getByRole("combobox", { name: "언어 / Language", exact: true }).selectOption("en");
      const english = page.getByRole("region", { name: "Shared design standards", exact: true });
      await expect(
        english.getByRole("textbox", { name: "Compact title", exact: true }),
      ).toHaveValue("공통 규격의 입력 초안");
      await expect(
        english.getByRole("combobox", { name: "Compact category", exact: true }),
      ).toHaveValue("Review");
      await expect(
        english.getByRole("status", { name: "Design example action count", exact: true }),
      ).toHaveText("2");
      await assertAccessible(page, info, `${application}-${width}-common-design-en`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(errors).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`${application}-${width}-shared-design.png`),
        fullPage: false,
      });
    });
  }
}

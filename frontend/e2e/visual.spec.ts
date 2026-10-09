// 006 시각 비교는 SC_VISUAL=1로 명시 실행한다. 기존 기능 E2E와 기준 이미지 갱신을 분리한다.
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const repository = path.resolve(import.meta.dirname, "../..");
const profile = process.env.SC_VISUAL_PROFILE ?? `${process.platform}-chromium`;
const update = process.env.SC_VISUAL_UPDATE === "1";
const probe = process.env.SC_VISUAL_PROBE === "1";
const runId = process.env.SC_VISUAL_RUN_ID ?? "comparison";
const captures = ["shell-inputs", "table", "chart", "editor"] as const;
const widths = [1366, 390] as const;
const settings = {
  locale: "ko-KR",
  timezoneId: "UTC",
  deviceScaleFactor: 1,
  colorScheme: "light",
  reducedMotion: "reduce",
} as const;

test.beforeAll(async () => {
  if (process.env.SC_VISUAL !== "1" || !update) return;
  if (
    process.env.CI ||
    probe ||
    !process.env.SC_VISUAL_RUN_ID ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(profile) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(runId)
  )
    throw new Error("로컬 기준 갱신에는 안전한 프로필과 새로운 run ID가 필요합니다.");
  const directory = path.join(repository, ".runtime/visual", profile, runId);
  await fs.mkdir(path.dirname(directory), { recursive: true });
  // 부분 실패한 이전 실행의 완료 증거가 섞이지 않도록 같은 run ID를 다시 쓰지 않는다.
  await fs.mkdir(directory);
});

interface VisualEnvironment {
  profile: string;
  platform: NodeJS.Platform;
  architecture: string;
  os: { release: string; version: string };
  browser: "chromium";
  browserVersion: string;
  playwrightVersion: string;
  settings: typeof settings;
  font: {
    family: string;
    size: string;
    weight: string;
    latinWidth: number;
    koreanWidth: number;
    devicePixelRatio: number;
    userAgent: string;
  };
}

function assertExecutionMode(testInfo: TestInfo) {
  expect(profile, "SC_VISUAL_PROFILE은 안전한 디렉터리 이름이어야 합니다.").toMatch(
    /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/,
  );
  expect(runId, "SC_VISUAL_RUN_ID는 안전한 디렉터리 이름이어야 합니다.").toMatch(
    /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/,
  );
  expect(probe && update, "고의 실패 probe에서는 기준 이미지를 갱신할 수 없습니다.").toBe(false);
  expect(
    testInfo.config.updateSnapshots,
    update
      ? "명시 갱신은 --update-snapshots=all이 필요합니다."
      : "비교는 --update-snapshots=none으로 실행합니다.",
  ).toBe(update ? "all" : "none");
  if (update) {
    expect(process.env.CI, "CI에서 기준 이미지를 자동 승인하지 않습니다.").toBeFalsy();
    expect(
      process.env.SC_VISUAL_RUN_ID,
      "갱신은 새 SC_VISUAL_RUN_ID를 지정해야 합니다.",
    ).toBeTruthy();
  }
}

async function loginReference(page: Page) {
  const metadata = JSON.parse(
    await fs.readFile(path.join(repository, ".runtime/e2e.json"), "utf8"),
  ) as { passwordFile: string };
  const response = await page.request.get("/api/auth/csrf");
  expect(response.status()).toBe(200);
  const csrf = (await response.json()) as { headerName: string; token: string };
  const login = await page.request.post("/api/auth/login", {
    form: { username: "admin", password: await fs.readFile(metadata.passwordFile, "utf8") },
    headers: { [csrf.headerName]: csrf.token },
  });
  expect(login.status()).toBe(204);
}

async function settleView(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const running = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState === "running" &&
          Number.isFinite(animation.effect?.getComputedTiming().endTime),
      );
    await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  await page.mouse.move(0, 0);
}

async function readEnvironment(page: Page, browser: Browser): Promise<VisualEnvironment> {
  const installed = JSON.parse(
    await fs.readFile(path.join(repository, "node_modules/@playwright/test/package.json"), "utf8"),
  ) as { version: string };
  const font = await page.locator(".sc-app-shell").evaluate((element) => {
    const style = getComputedStyle(element);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("시각 환경의 글꼴 측정을 준비하지 못했습니다.");
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return {
      family: style.fontFamily,
      size: style.fontSize,
      weight: style.fontWeight,
      latinWidth: Number(context.measureText("ScFramework 0123456789").width.toFixed(6)),
      koreanWidth: Number(context.measureText("공통 화면 한국어 기준 글꼴").width.toFixed(6)),
      devicePixelRatio: window.devicePixelRatio,
      userAgent: navigator.userAgent,
    };
  });
  return {
    profile,
    platform: process.platform,
    architecture: process.arch,
    os: { release: os.release(), version: os.version() },
    browser: "chromium",
    browserVersion: browser.version(),
    playwrightVersion: installed.version,
    settings,
    font,
  };
}

async function assertApprovedEnvironment(environment: VisualEnvironment) {
  if (update) return;
  const filename = path.join(
    repository,
    "frontend/e2e/visual.spec.ts-snapshots",
    profile,
    "manifest.json",
  );
  const approved = JSON.parse(await fs.readFile(filename, "utf8")) as {
    schemaVersion: number;
    environment: VisualEnvironment;
  };
  expect(approved.schemaVersion).toBe(1);
  expect(
    environment,
    "OS·Chromium·Playwright·글꼴 환경이 승인된 프로필과 다릅니다. 같은 환경에서 비교해야 합니다.",
  ).toEqual(approved.environment);
}

async function neutralFocus(page: Page) {
  // 입력과 toolbar의 focus/hover를 고정한다. 실제 키보드 focus 계약은 기능 E2E가 검사한다.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await settleView(page);
}

async function cardClip(page: Page, card: Locator) {
  // 큰 카드를 locator screenshot으로 다시 스크롤하면 sticky header가 제목을 덮는다.
  // 실제 CSS를 바꾸지 않고 scroll 0의 문서 좌표를 사용해 카드 전체를 캡처한다.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await neutralFocus(page);
  const clip = await card.boundingBox();
  if (!clip || clip.width <= 0 || clip.height <= 0)
    throw new Error("시각 검증 카드의 문서 좌표를 확인하지 못했습니다.");
  return clip;
}

for (const application of ["reference", "starter"] as const) {
  for (const width of widths) {
    test.describe(`${application} ${width}px 시각 기준`, () => {
      test.use({
        ...settings,
        viewport: { width, height: 844 },
        ...(application === "starter"
          ? { baseURL: `http://127.0.0.1:${process.env.SC_E2E_STARTER_PORT ?? "18184"}` }
          : {}),
      });
      test("셸·입력·표·차트·서식의 승인 이미지와 비교", async ({ page, browser }, testInfo) => {
        test.skip(process.env.SC_VISUAL !== "1", "SC_VISUAL=1의 독립 시각 검증에서 실행합니다.");
        assertExecutionMode(testInfo);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.name));
        if (application === "reference") await loginReference(page);
        await page.goto("/patterns");
        await expect(
          page.getByRole("heading", { level: 1, name: "공통 기능 예제", exact: true }),
        ).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("lang", "ko");
        await expect(page.getByRole("main")).toHaveCount(1);
        await expect(page.getByRole("banner")).toHaveCount(1);
        const form = page.getByRole("form", { name: "공통 입력 폼", exact: true });
        await form
          .getByRole("textbox", { name: "제목", exact: true })
          .fill("시각 기준 한국어 제목");
        await form
          .getByRole("textbox", { name: "설명", exact: true })
          .fill("첫 번째 설명\n두 번째 설명");
        const category = form.locator("input[role='combobox']");
        await category.focus();
        await category.press("Enter");
        await expect(page.getByRole("listbox")).toBeVisible();
        await page.keyboard.press("End");
        await page.keyboard.press("Enter");
        await expect(category).toHaveValue("개발");
        await form.getByRole("checkbox", { name: "검토 내용 확인", exact: true }).check();
        await expect(form.locator(".v-field__field > .v-field-label")).toHaveCount(3);
        for (const label of await form.locator(".v-field__field > .v-field-label").all())
          await expect(label).not.toBeVisible();
        const table = page.getByRole("region", { name: "정렬·페이지·선택 예제", exact: true });
        await expect(table.locator("tbody [data-row-key]")).toHaveCount(10);
        await expect(table.locator("tbody [data-row-key]").first()).toHaveAttribute(
          "data-row-key",
          "sample-1",
        );
        const chart = page.getByRole("region", { name: "중립 차트", exact: true });
        await expect(chart.locator(".sc-chart__plot svg")).toBeVisible();
        const editor = page.getByRole("region", { name: "서식 입력", exact: true });
        await expect(editor.getByRole("textbox", { name: "서식 입력", exact: true })).toHaveText(
          "서식 입력 예제",
        );
        await neutralFocus(page);
        const chartText = await chart.locator(".sc-chart__plot svg").evaluate((svg) => {
          const texts = [...svg.querySelectorAll("text")];
          const rectangle = (label: string) => {
            const element = texts.find((item) => item.textContent === label);
            if (!element) throw new Error(`차트의 실제 SVG 문구를 찾지 못했습니다: ${label}`);
            const { left, right, top, bottom } = element.getBoundingClientRect();
            return { left, right, top, bottom };
          };
          return { axis: rectangle("B"), legend: rectangle("중립 차트") };
        });
        expect(
          chartText.legend.bottom <= chartText.axis.top ||
            chartText.axis.bottom <= chartText.legend.top ||
            chartText.legend.right <= chartText.axis.left ||
            chartText.axis.right <= chartText.legend.left,
          "차트 범례가 가운데 축 라벨 B를 덮지 않아야 합니다.",
        ).toBe(true);
        const environment = await readEnvironment(page, browser);
        await assertApprovedEnvironment(environment);
        if (probe)
          await page.addStyleTag({
            content:
              ".sc-app-shell__brand-mark { background: #ff00ff !important; border-radius: 0 !important; }",
          });
        const completed: { name: string; file: string }[] = [];
        for (const capture of captures) {
          const name = `${application}-${width}-${capture}.png`;
          const options = {
            animations: "disabled",
            caret: "hide",
            scale: "css",
            maxDiffPixels: 0,
            threshold: 0.1,
          } as const;
          if (capture === "shell-inputs") {
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
            await neutralFocus(page);
            await expect(page).toHaveScreenshot([profile, name], { ...options, fullPage: false });
          } else {
            const card = capture === "table" ? table : capture === "chart" ? chart : editor;
            const clip = await cardClip(page, card);
            await expect(page).toHaveScreenshot([profile, name], {
              ...options,
              fullPage: true,
              clip,
            });
          }
          completed.push({
            name,
            file: path
              .relative(repository, testInfo.snapshotPath(profile, name))
              .split(path.sep)
              .join("/"),
          });
        }
        expect(errors).toEqual([]);
        const runtimeDirectory = path.join(repository, ".runtime/visual", profile, runId);
        await fs.mkdir(runtimeDirectory, { recursive: true });
        await fs.writeFile(
          path.join(runtimeDirectory, `${application}-${width}.json`),
          `${JSON.stringify({ environment, application, width, completed }, null, 2)}\n`,
          { mode: 0o600 },
        );
      });
    });
  }
}

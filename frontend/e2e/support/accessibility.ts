import { expect, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import type { AxeResults, RunOptions } from "axe-core";

const require = createRequire(import.meta.url);
const axeScript = require.resolve("axe-core/axe.min.js");
const axeVersion = (require("axe-core/package.json") as { version: string }).version;
const axeOptions: RunOptions = {
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
  },
};
type AxeWindow = Window & { axe?: typeof import("axe-core") };

export async function assertAccessible(page: Page, info: TestInfo, state: string) {
  // 유한 CSS transition이 끝난 화면을 검사한다. 규칙 비활성화·DOM 제외·고정 sleep은 사용하지 않는다.
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Vue의 오류 DOM이 그려지고 CSS transition이 등록된 다음 완료를 기다린다.
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
  if (!(await page.evaluate(() => !!(window as AxeWindow).axe)))
    await page.addScriptTag({ path: axeScript });
  const results = await page.evaluate(async (options): Promise<AxeResults> => {
    const axe = (window as AxeWindow).axe;
    if (!axe) throw new Error("axe-core 스크립트가 로드되지 않았습니다.");
    return axe.run(document, options);
  }, axeOptions);
  const duplicateIds = await page.evaluate(() => {
    const counts = new Map<string, number>();
    for (const element of document.querySelectorAll("[id]")) {
      if (element.id) counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
    }
    return [...counts].filter(([, count]) => count > 1).map(([id, count]) => ({ id, count }));
  });
  const virtualDOM = await page.evaluate(() => ({
    tableRows: document.querySelectorAll(".sc-virtual-table [data-row-key]").length,
    listRows: document.querySelectorAll(".sc-virtual-list [data-row-key]").length,
  }));
  const reportPath = info.outputPath(`${state}-axe.json`);
  await fs.mkdir(info.outputDir, { recursive: true });
  await fs.writeFile(
    reportPath,
    JSON.stringify(
      {
        state,
        axeVersion,
        duplicateIds,
        virtualDOM,
        results,
        limits: [
          "axe는 현재 DOM의 자동 판별 규칙만 검사한다. incomplete는 수동 검수 후보이며 통과로 대체하지 않는다.",
          "10,000행 가상화에서는 현재 렌더된 행만 검사한다. 전체 행 내용·스크롤/focus·일반 표 대안은 별도 patterns E2E로 검증한다.",
          "Vuetify VSelect의 wrapper/input combobox 역할 중복은 현재 라이브러리 제한이다. 위반 규칙을 끄거나 해당 DOM을 제외하지 않는다.",
          "스크린리더 실제 낭독·키보드 전체 동선·제품 시각 검수·모든 WCAG 수동 기준을 자동 통과로 주장하지 않는다.",
        ],
      },
      null,
      2,
    ),
  );
  await info.attach(`${state}-axe.json`, {
    path: reportPath,
    contentType: "application/json",
  });
  expect(results.testEngine.version).toBe(axeVersion);
  expect(
    {
      violations: results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          failureSummary: node.failureSummary,
        })),
      })),
      duplicateIds,
    },
    `${state}: document 전체 접근성`,
  ).toEqual({ violations: [], duplicateIds: [] });
}

import { describe, expect, it } from "vitest";
import { createChartOption, hasValidChartData } from "./chart-model";
import { uiTokens } from "../tokens";

describe("차트 자료와 내부 옵션", () => {
  it("선/막대와 갱신 자료를 같은 디자인 토큰으로 구성하고 원본을 바꾸지 않는다", () => {
    const data = Object.freeze([Object.freeze({ label: "한국어 항목", value: 7 })]);
    const bar = createChartOption(data, "bar", "합성 수량", false);
    expect(bar.color).toEqual([uiTokens.color.primary]);
    expect(bar.series).toMatchObject([{ name: "합성 수량", type: "bar", data: [7] }]);
    const line = createChartOption([{ label: "새 항목", value: 12 }], "line", "합성 수량", true);
    expect(line.series).toMatchObject([{ type: "line", data: [12] }]);
    expect(line.animation).toBe(false);
    expect(data).toEqual([{ label: "한국어 항목", value: 7 }]);
  });
  it("NaN/Infinity를 오류 상태로 구분하고 빈 자료를 허용한다", () => {
    expect(hasValidChartData([])).toBe(true);
    expect(hasValidChartData([{ label: "음수", value: -4 }])).toBe(true);
    expect(hasValidChartData([{ label: "오류", value: NaN }])).toBe(false);
    expect(hasValidChartData([{ label: "오류", value: Infinity }])).toBe(false);
  });
});

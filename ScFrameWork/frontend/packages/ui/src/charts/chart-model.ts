import type { EChartsCoreOption } from "echarts/core";
import { uiTokens } from "../tokens";
import type { ScChartDatum, ScChartType } from "./contracts";

export function hasValidChartData(data: readonly ScChartDatum[]): boolean {
  return (
    Array.isArray(data) &&
    data.every(
      (item) =>
        !!item &&
        typeof item.label === "string" &&
        typeof item.value === "number" &&
        Number.isFinite(item.value),
    )
  );
}

/** vendor 옵션은 UI 내부에서만 구성한다. 업무 집계와 ECharts 객체를 앱에 공유하지 않는다. */
export function createChartOption(
  data: readonly ScChartDatum[],
  type: ScChartType,
  label: string,
  reducedMotion: boolean,
): EChartsCoreOption {
  return {
    animation: !reducedMotion,
    animationDuration: reducedMotion ? 0 : uiTokens.motion.duration,
    color: [uiTokens.color.primary],
    textStyle: {
      color: uiTokens.color.text,
      fontFamily: uiTokens.fontFamily,
      fontSize: uiTokens.fontSize.body,
    },
    grid: {
      left: uiTokens.space[4],
      right: uiTokens.space[4],
      top: uiTokens.space[10],
      bottom: uiTokens.space[4],
      outerBoundsMode: "same",
      outerBoundsContain: "axisLabel",
    },
    legend: {
      top: uiTokens.space[2],
      data: [label],
      textStyle: { color: uiTokens.color.text },
    },
    tooltip: { trigger: "axis", renderMode: "richText" },
    xAxis: {
      type: "category",
      data: data.map((item) => item.label),
      axisLabel: { color: uiTokens.color.textMuted },
      axisLine: { lineStyle: { color: uiTokens.color.controlBorder } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: uiTokens.color.textMuted },
      splitLine: { lineStyle: { color: uiTokens.color.border } },
    },
    series: [
      {
        name: label,
        type,
        data: data.map((item) => item.value),
        ...(type === "line" ? { symbolSize: uiTokens.space[2] } : {}),
      },
    ],
  };
}

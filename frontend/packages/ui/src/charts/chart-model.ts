/*
 * ScChart의 중립 label/value 입력을 ECharts 옵션으로 변환하는 순수 함수 모듈이다. DOM·조회·Vue 상태를 소유하지 않아 단독으로 검증할 수 있다.
 *  EChartsCoreOption은 type-only import여서 이 파일의 반환 모양만 검사한다. 실제 renderer 등록은 ScChart.vue에 있다.
 */
import type { EChartsCoreOption } from "echarts/core";
import { uiTokens } from "../tokens";
import type { ScChartDatum, ScChartType } from "./contracts";

// 타입 검사만으로는 실행 중 JSON 값을 보장하지 못한다. Array/문자열/유한 숫자 조건을 확인해 차트 계산 오류를 막는다.
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
  // UI 토큰에서 색·글꼴·여백을 가져온다. reducedMotion은 OS 선호를 읽은 컴포넌트가 전달해 순수 계산과 브라우저 효과를 분리한다.
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

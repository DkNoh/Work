/*
 * @sc/ui/charts 진입점: 단일/다중 차트와 label/value 자료 계약만 공개한다. ECharts 옵션 생성기와 인스턴스는 내부 구현이다.
 * Java package와 달리 폴더 안에 있다고 자동 공개되지 않는다. export는 패키지 경계를 만들고 export type은 실행 코드 없이 타입 검사 정보만 내보낸다.
 */
export { default as ScChart } from "./ScChart.vue";
export { default as ScSeriesChart } from "./ScSeriesChart.vue";
export type { ScChartSeries, ScSeriesChartProps, ScSeriesChartSlots } from "./contracts";
export type {
  ScChartDatum,
  ScChartType,
  ScChartProps,
  ScChartClick,
  ScChartEmits,
  ScChartSlots,
} from "./contracts";

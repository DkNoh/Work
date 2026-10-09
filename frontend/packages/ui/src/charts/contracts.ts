/*
 * 단일 차트와 다중 series 차트의 공개 자료/이벤트 타입이다. 업무 이름·값·문구만 받으며 ECharts options는 계약에 포함하지 않는다.
 *  readonly는 자식 차트가 부모 배열을 변경하지 못하게 한다. ScChartType union은 bar/line만, ScChartEmits 튜플은 select 데이터와 retry 의도만 허용한다.
 *  selectable의 실제 후속 동작(필터 변경·상세 이동)은 select 이벤트를 받는 소비 앱이 처리한다.
 */
export interface ScChartDatum {
  readonly label: string;
  readonly value: number;
}
export type ScChartType = "bar" | "line";
export interface ScChartProps {
  data: readonly ScChartDatum[];
  label: string;
  type?: ScChartType;
  summary?: string;
  height?: number;
  loading?: boolean;
  error?: string;
  emptyLabel?: string;
  dataTitle?: string;
  categoryLabel?: string;
  valueLabel?: string;
  loadingLabel?: string;
  retryLabel?: string;
  invalidDataLabel?: string;
  selectable?: boolean;
  selectLabel?: string;
}
export interface ScChartClick {
  label: string;
  value: number;
  index: number;
}
export interface ScChartEmits {
  select: [item: ScChartClick];
  retry: [];
}
export type ScChartSlots = Record<string, never>;

export interface ScChartSeries {
  readonly name: string;
  readonly color?: string;
  readonly data: readonly ScChartDatum[];
}
export interface ScSeriesChartProps {
  readonly label: string;
  readonly series: readonly ScChartSeries[];
  readonly height?: number;
  readonly dataLabel?: string;
  readonly categoryLabel?: string;
  readonly emptyLabel?: string;
  readonly invalidLabel?: string;
}
export type ScSeriesChartSlots = Record<string, never>;

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

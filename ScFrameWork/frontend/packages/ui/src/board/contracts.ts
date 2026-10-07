import type { VNode } from "vue";

export interface ScBoardColumn<T> {
  readonly id: string;
  readonly label: string;
  readonly items: readonly T[];
}
export interface ScBoardMove {
  readonly itemKey: string;
  readonly fromColumnId: string;
  readonly toColumnId: string;
  /** 목적 열에서 이 항목 바로 앞. null이면 열 끝. */
  readonly beforeKey: string | null;
}
export interface ScBoardLabels {
  loading: string;
  empty: string;
  retry: string;
  move: string;
  up: string;
  down: string;
  destination: string;
  scroll: string;
  instructions: string;
  started: string;
  cancelled: string;
  requested: string;
}
export interface ScSortableBoardProps<T> {
  label: string;
  columns: readonly ScBoardColumn<T>[];
  getItemKey: (item: T) => string;
  getItemLabel: (item: T) => string;
  isItemMovable?: (item: T) => boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  labels?: Partial<ScBoardLabels>;
}
export interface ScSortableBoardEmits {
  move: [move: ScBoardMove];
  retry: [];
}
export interface ScSortableBoardSlots<T> {
  item?: (props: { item: T; column: ScBoardColumn<T>; index: number }) => VNode[];
}

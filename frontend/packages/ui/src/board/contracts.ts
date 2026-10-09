/*
 * 업무 항목 T를 공통 보드에 표시하고 이동 의도를 앱으로 돌려주는 공개 계약이다. Java generic DTO처럼 T가 열 items와 item slot에 이어진다.
 *  ScBoardMove는 최종 배열을 전달하지 않고 key/열/beforeKey를 전달한다. 서버가 revision과 상태 전이를 검증할 수 있도록 저장 책임을 앱에 남긴다.
 *  labels의 Partial은 문구 일부 override, readonly columns/items는 자식의 제자리 정렬을 막기 위한 타입 경계다.
 */
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

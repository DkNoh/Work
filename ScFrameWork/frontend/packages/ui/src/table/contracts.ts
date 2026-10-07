import type { VNode } from "vue";

export interface ScTableColumn<T> {
  readonly id: string;
  readonly label: string;
  /** 표시·정렬용 값만 반환한다. Vue 렌더 함수는 받지 않는다. */
  readonly value: (row: T) => string | number | boolean | null | undefined;
  readonly sortable?: boolean;
}
export interface ScTableSort {
  readonly columnId: string;
  readonly direction: "asc" | "desc";
}
export interface ScTablePagination {
  readonly pageIndex: number;
  readonly pageSize: number;
  /** server 모드에서는 서버 응답의 전체 건수다. client 모드에서는 rows.length다. */
  readonly total: number;
}
export type ScTableSelectionMode = "none" | "single" | "multiple";
export interface ScTableLabels {
  loading: string;
  empty: string;
  retry: string;
  selectPage: string;
  selection: string;
  selectRow: (name: string) => string;
  selectionCount: (count: number) => string;
  sort: (label: string, next: "asc" | "desc" | "none") => string;
  previousPage: string;
  nextPage: string;
  page: (current: number, pages: number, total: number) => string;
  scrollRegion: (caption: string) => string;
  /** 목록 제목과 스크롤 영역을 구분하는 이름. 미지정 시 기본 한국어 이름을 사용한다. */
  listScrollRegion?: (label: string) => string;
  actions: string;
  virtualView: string;
  paginatedView: string;
  virtualHint: string;
  firstRow: string;
  previousRow: string;
  nextRow: string;
  lastRow: string;
  rowPosition: (current: number, total: number) => string;
}
export interface ScDataTableProps<T> {
  rows: readonly T[];
  columns: readonly ScTableColumn<T>[];
  caption: string;
  /** 업무 표와 대시보드 표가 같은 디자인의 간격 규격을 사용한다. */
  density?: "comfortable" | "compact";
  /** 숨긴 caption도 표의 접근성 이름으로 유지한다. */
  captionVisibility?: "visible" | "sr-only";
  /** 작은 화면에서는 공통 표 내부에서 가로 스크롤한다. 단위는 px. */
  minTableWidth?: number;
  /** 빈 문자열·중복·배열 index를 사용하지 않는 지속적인 업무 ID. */
  getRowKey: (row: T) => string;
  getRowLabel?: (row: T) => string;
  dataMode?: "client" | "server";
  sorting?: ScTableSort | null;
  pagination?: ScTablePagination;
  selectionMode?: ScTableSelectionMode;
  selectedKeys?: readonly string[];
  isRowSelectable?: (row: T) => boolean;
  loading?: boolean;
  error?: string;
  /** locale의 원본은 앱이다. 공통 UI는 한국어 기본 메시지를 제공한다. */
  labels?: Partial<ScTableLabels>;
}
export interface ScDataTableEmits {
  "change-sort": [sorting: ScTableSort | null];
  "change-pagination": [pagination: ScTablePagination];
  "update:selectedKeys": [keys: string[]];
  retry: [];
}
export interface ScTableCellSlot<T> {
  row: T;
  rowKey: string;
  rowIndex: number;
  columnId: string;
  value: string | number | boolean | null | undefined;
}
export interface ScTableRowSlot<T> {
  row: T;
  rowKey: string;
  rowIndex: number;
}
export interface ScDataTableSlots<T> {
  cell?: (props: ScTableCellSlot<T>) => VNode[];
  "row-actions"?: (props: ScTableRowSlot<T>) => VNode[];
  loading?: () => VNode[];
  empty?: () => VNode[];
  error?: (props: { message: string; retry: () => void }) => VNode[];
}
export interface ScVirtualOptions {
  /** 실제 스크롤 viewport 높이. 기본 480px, 양수만 허용한다. */
  height?: number;
  /** 최소 행 높이이자 초기 추정치. 실제 가변 높이는 ResizeObserver로 측정한다. */
  estimateRowHeight?: number;
  /** 양쪽 추가 렌더 개수. 기본 8, 0~20 정수만 허용한다. */
  overscan?: number;
}
export interface ScVirtualTableProps<T> extends ScDataTableProps<T>, ScVirtualOptions {}
export type ScVirtualTableEmits = ScDataTableEmits;
export type ScVirtualTableSlots<T> = ScDataTableSlots<T>;
export interface ScVirtualListProps<T> extends ScVirtualOptions {
  items: readonly T[];
  label: string;
  getItemKey: (item: T) => string;
  getItemLabel?: (item: T) => string;
  loading?: boolean;
  error?: string;
  labels?: Partial<ScTableLabels>;
}
export interface ScVirtualListEmits {
  retry: [];
}
export interface ScVirtualListSlots<T> {
  item?: (props: { item: T; itemKey: string; index: number }) => VNode[];
  loading?: () => VNode[];
  empty?: () => VNode[];
  error?: (props: { message: string; retry: () => void }) => VNode[];
}
export interface ScVirtualHandle {
  /** 존재하는 키만 이동한다. DOM 위치 index는 공개하지 않는다. */
  scrollToKey: (key: string) => boolean;
  /** 가상 행의 native 선택/행동 또는 목록의 탐색 버튼에 포커스를 이동한다. */
  focusRow: (key: string) => Promise<boolean>;
}

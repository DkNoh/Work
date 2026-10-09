/*
 * @sc/ui/table 진입점: 일반/가상 표·가상 목록 및 generic 행/셀/선택/페이지/handle 타입을 공개한다. TanStack 엔진과 내부 행 모델은 내보내지 않는다.
 * Java package와 달리 폴더 안에 있다고 자동 공개되지 않는다. export는 패키지 경계를 만들고 export type은 실행 코드 없이 타입 검사 정보만 내보낸다.
 */
export { default as ScDataTable } from "./ScDataTable.vue";
export { default as ScVirtualList } from "./ScVirtualList.vue";
export { default as ScVirtualTable } from "./ScVirtualTable.vue";
export type {
  ScTableColumn,
  ScTableSort,
  ScTablePagination,
  ScTableSelectionMode,
  ScTableLabels,
  ScDataTableProps,
  ScDataTableEmits,
  ScDataTableSlots,
  ScTableCellSlot,
  ScTableRowSlot,
  ScVirtualOptions,
  ScVirtualTableProps,
  ScVirtualTableEmits,
  ScVirtualTableSlots,
  ScVirtualListProps,
  ScVirtualListEmits,
  ScVirtualListSlots,
  ScVirtualHandle,
} from "./contracts";

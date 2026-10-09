/*
 * TanStack Table의 정렬/페이지 엔진을 Sc 계약으로 감싼 composable과 순수 선택 helper다. UI의 실제 table 태그는 Vue SFC가 그린다.
 *  useTableModel<T>는 업무 행 구조를 몰라도 getRowKey와 column.value 콜백으로 표시 모델을 만든다.
 *  computed와 state getter는 부모 props를 직접 읽으므로 정렬·페이지·행을 로컬 상태로 중복 저장하지 않는다.
 */
import { computed } from "vue";
import {
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
} from "@tanstack/vue-table";
import type { ScDataTableProps, ScTableSort } from "./contracts";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

// 배열 위치를 key로 사용하면 정렬/삭제 시 선택과 포커스가 다른 행으로 이동한다. 비어 있거나 중복된 업무 키를 먼저 거절한다.
export function validateRowKeys<T>(rows: readonly T[], getKey: (row: T) => string): string[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const key = getKey(row);
    if (typeof key !== "string" || !key.trim() || seen.has(key)) {
      throw new Error(`Sc table/list requires unique non-empty string keys: ${String(key)}`);
    }
    seen.add(key);
    return key;
  });
}

// 한 열 클릭을 asc → desc → 해제로 순환시키는 순수 함수다. 현재 정렬 객체를 변경하지 않고 다음 의도를 반환한다.
export function nextSort(
  current: ScTableSort | null | undefined,
  columnId: string,
): ScTableSort | null {
  if (current?.columnId !== columnId) return { columnId, direction: "asc" };
  return current.direction === "asc" ? { columnId, direction: "desc" } : null;
}

/** 현재 화면에서 선택 가능한 키만 변경하며 다른 서버 페이지의 선택을 보존한다. */
export function selectPageKeys(
  current: readonly string[],
  pageKeys: readonly string[],
  checked: boolean,
): string[] {
  const result = new Set(current);
  for (const key of pageKeys) {
    if (checked) result.add(key);
    else result.delete(key);
  }
  return [...result];
}

export function useTableModel<T extends object>(props: ScDataTableProps<T>, paginate: boolean) {
  // 공통 컬럼 계약을 vendor accessor 설정으로 변환한다. computed는 columns 입력이 바뀔 때 새 구성을 계산한다.
  const columns = computed(() => {
    const ids = new Set<string>();
    return props.columns.map((column) => {
      if (!column.id.trim() || ids.has(column.id))
        throw new Error("Sc table column IDs must be unique and non-empty");
      ids.add(column.id);
      return { id: column.id, accessorFn: column.value, enableSorting: column.sortable === true };
    });
  });
  const table = useTable<typeof features, T>({
    features,
    data: computed(() => {
      if (
        props.pagination &&
        (!Number.isInteger(props.pagination.pageIndex) ||
          props.pagination.pageIndex < 0 ||
          !Number.isInteger(props.pagination.pageSize) ||
          props.pagination.pageSize < 1 ||
          !Number.isInteger(props.pagination.total) ||
          props.pagination.total < 0)
      )
        throw new Error(
          "Sc table pagination requires non-negative integer pageIndex/total and positive integer pageSize",
        );
      validateRowKeys(props.rows, props.getRowKey);
      return props.rows;
    }),
    columns,
    getRowId: (row) => props.getRowKey(row),
    // server 모드는 서버 결과 순서/페이지를 그대로 표시한다. client에서 다시 정렬·slice하면 서버 total과 실제 행이 어긋난다.
    manualSorting: computed(() => props.dataMode === "server"),
    manualPagination: computed(() => !paginate || !props.pagination || props.dataMode === "server"),
    rowCount: computed(() =>
      props.dataMode === "server"
        ? (props.pagination?.total ?? props.rows.length)
        : props.rows.length,
    ),
    autoResetPageIndex: false,
    state: {
      get sorting() {
        return props.sorting
          ? [{ id: props.sorting.columnId, desc: props.sorting.direction === "desc" }]
          : [];
      },
      get pagination() {
        return {
          pageIndex: props.pagination?.pageIndex ?? 0,
          pageSize: props.pagination?.pageSize ?? 20,
        };
      },
    },
  });
  // vendor 내부 row 객체를 그대로 공개하지 않고 key/original/index만 SFC에 전달한다.
  const rows = computed(() =>
    table
      .getRowModel()
      .rows.map((row) => ({ key: row.id, original: row.original, index: row.index })),
  );
  return { rows, table };
}

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
  const rows = computed(() =>
    table
      .getRowModel()
      .rows.map((row) => ({ key: row.id, original: row.original, index: row.index })),
  );
  return { rows, table };
}

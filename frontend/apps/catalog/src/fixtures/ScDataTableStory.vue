<template>
  <section class="sc-stack" aria-label="공통 표 예제">
    <sc-data-table
      :rows="pageRows"
      :columns="tableExampleColumns"
      :get-row-key="tableExampleKey"
      :get-row-label="tableExampleLabel"
      caption="공통 표 자료"
      :data-mode="dataMode"
      :sorting="sorting"
      :pagination="pagination"
      :selection-mode="'multiple'"
      :selected-keys="selectedKeys"
      :is-row-selectable="canSelect"
      :loading="loading"
      :error="error"
      @change-sort="changeSort"
      @change-pagination="changePage"
      @update:selected-keys="changeSelection"
      @retry="retried = true"
    >
      <template #cell="{ columnId, value }">
        <strong v-if="columnId === 'amount'">{{ value }}원</strong>
        <span v-else>{{ value }}</span>
      </template>
      <template #row-actions="{ row }">
        <button
          type="button"
          class="sc-table-story-action"
          :aria-label="row.title + ' 열기'"
          @click="opened = row.id"
        >
          열기
        </button>
      </template>
    </sc-data-table>
    <p role="status" aria-label="선택 ID">{{ selectedKeys.join(", ") || "선택 없음" }}</p>
    <p v-if="opened" role="status" aria-label="행 열기">{{ opened }}</p>
    <p v-if="retried" role="status">재조회 요청 전달됨</p>
  </section>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 일반 표의 셀/행 행동 slot과 정렬·페이지·선택 이벤트를 실제로 연결한다. 선택 ID·열기·retry 결과를 화면에 남긴다.
 */

/*
 * 합성 행 45개를 사용하는 부모 화면 예제다. Pick<T, Keys>는 공개 Props 중 이 fixture에 필요한 설정만 선택한다.
 *  sorting/pagination/selectedKeys ref가 이 Story의 원본이고 공통 표는 새 의도를 emit한다. 실제 앱에서는 URL과 Query 상태로 연결할 부분이다.
 */
import { computed, ref, watch } from "vue";
import {
  ScDataTable,
  type ScDataTableProps,
  type ScTablePagination,
  type ScTableSort,
} from "@sc/ui/table";
import {
  createTableExampleRows,
  tableExampleColumns,
  tableExampleKey,
  tableExampleLabel,
} from "./ScTableData";

const props = withDefaults(
  defineProps<
    Pick<
      ScDataTableProps<{ id: string; title: string; amount: number }>,
      "dataMode" | "loading" | "error" | "selectedKeys" | "sorting" | "pagination"
    > & { empty?: boolean }
  >(),
  {
    dataMode: "client",
    loading: false,
    empty: false,
    error: undefined,
    selectedKeys: () => ["outside-page"],
    sorting: null,
    pagination: () => ({ pageIndex: 0, pageSize: 10, total: 45 }),
  },
);
const emit = defineEmits<{
  "update:selectedKeys": [keys: string[]];
  "change-sort": [sorting: ScTableSort | null];
  "change-pagination": [pagination: ScTablePagination];
}>();
const rows = createTableExampleRows(45);
const sorting = ref<ScTableSort | null>(props.sorting);
const pagination = ref<ScTablePagination>(props.pagination);
const selectedKeys = ref<string[]>([...props.selectedKeys]);
const opened = ref("");
const retried = ref(false);
const canSelect = (row: { id: string }) => row.id !== "row-00002";
// server story는 실제 서버 정렬/페이지 응답을 흉내 낸다. UI의 client 정렬과 구분한다.
// server 모드의 정렬/slice는 모의 서버 역할이다. 공통 표는 이 결과를 다시 client 정렬/페이지 처리하지 않아야 한다.
const pageRows = computed(() => {
  if (props.empty) return [];
  if (props.dataMode === "client") return rows;
  const ordered = sorting.value
    ? [...rows].sort((a, b) =>
        sorting.value?.direction === "asc" ? a.amount - b.amount : b.amount - a.amount,
      )
    : rows;
  return ordered.slice(
    pagination.value.pageIndex * pagination.value.pageSize,
    (pagination.value.pageIndex + 1) * pagination.value.pageSize,
  );
});
// 정렬 조건이 바뀌면 첫 페이지로 이동하고 두 이벤트를 상위 Story에 전달한다.
function changeSort(value: ScTableSort | null) {
  sorting.value = value;
  pagination.value = { ...pagination.value, pageIndex: 0 };
  emit("change-sort", value);
  emit("change-pagination", pagination.value);
}
function changePage(value: ScTablePagination) {
  pagination.value = value;
  emit("change-pagination", value);
}
function changeSelection(keys: string[]) {
  selectedKeys.value = keys;
  emit("update:selectedKeys", keys);
}
// Controls가 바꾸는 외부 설정을 예제 ref에 반영한다. 실제 서버 응답이나 공유 상태를 무조건 복사하는 일반 패턴은 아니다.
watch(
  () => props.sorting,
  (value) => {
    sorting.value = value;
  },
);
watch(
  () => props.pagination,
  (value) => {
    pagination.value = value;
  },
);
watch(
  () => props.selectedKeys,
  (value) => {
    selectedKeys.value = [...value];
  },
);
</script>

<style scoped lang="scss">
.sc-table-story-action {
  min-height: 44px;
  border: 1px solid var(--sc-color-control-border);
  border-radius: var(--sc-radius-sm);
  background: var(--sc-color-surface);
  color: var(--sc-color-text);
  padding: var(--sc-space-2);
}
.sc-table-story-action:focus-visible {
  outline: 3px solid var(--sc-color-focus);
  outline-offset: 2px;
}
</style>

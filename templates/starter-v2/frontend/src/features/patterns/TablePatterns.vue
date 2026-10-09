<template>
  <div class="sc-stack">
    <sc-section-card :title="t('app.table')">
      <sc-data-table
        v-model:selected-keys="selectedKeys"
        :rows="smallRows"
        :columns="columns"
        :caption="t('app.table')"
        :get-row-key="getRowKey"
        :get-row-label="getRowLabel"
        :sorting="sorting"
        :pagination="pagination"
        selection-mode="multiple"
        :labels="labels"
        @change-sort="changeSort"
        @change-pagination="pagination = $event"
      />
    </sc-section-card>
    <sc-section-card :title="t('app.largeTable')">
      <sc-virtual-table
        v-model:selected-keys="selectedKeys"
        :rows="rows"
        :columns="columns"
        :caption="t('app.largeTable')"
        :get-row-key="getRowKey"
        :get-row-label="getRowLabel"
        :sorting="sorting"
        selection-mode="multiple"
        :height="480"
        :estimate-row-height="48"
        :overscan="8"
        :labels="labels"
        @change-sort="changeSort"
      />
    </sc-section-card>
    <sc-section-card :title="t('app.largeList')">
      <sc-virtual-list
        :items="rows"
        :label="t('app.largeList')"
        :get-item-key="getRowKey"
        :get-item-label="getRowLabel"
        :height="240"
        :labels="labels"
      >
        <template #item="{ item }">
          <span>{{ item.name }} · {{ item.amount }}</span>
        </template>
      </sc-virtual-list>
    </sc-section-card>
  </div>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * v-model:selected-keys는 selectedKeys prop과 update:selectedKeys 이벤트를 묶는 문법이다. #item은 가상 목록이 넘긴 item을 표시하는 slot이다.
 */

/**
 * 일반 표와 가상 표는 열·정렬·선택 키를 공유하고, 가상 목록은 같은 행 자료를 item slot으로 표시하는 로컬 자료 예제다.
 * 10,000행 배열은 shallowRef에 보관하여 각 행 내부를 재귀 Proxy로 만들지 않는다. 자료 교체는 rows.value에 새 배열을 대입하는 방식이다.
 * ScTableColumn<SampleRow>의 value(row)는 타입이 지정된 표시/정렬 값을 제공한다. getRowKey는 화면 인덱스가 아닌 안정적인 업무 ID를 반환한다.
 * 선택은 ID 배열로 부모가 소유하므로 일반/가상 표시 사이에서도 유지된다. 정렬 변경 시 페이지를 0으로 돌려 유효 범위를 맞춘다.
 */

import { computed, ref, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { ScSectionCard } from "@sc/ui";
import {
  ScDataTable,
  ScVirtualTable,
  ScVirtualList,
  type ScTableColumn,
  type ScTableSort,
  type ScTablePagination,
  type ScTableLabels,
} from "@sc/ui/table";
interface SampleRow {
  id: string;
  name: string;
  amount: number;
}
const { t, locale } = useI18n({ useScope: "global" });
const rows = shallowRef<readonly SampleRow[]>(
  Array.from({ length: 10000 }, (_, index) => ({
    id: `sample-${index + 1}`,
    name: `예제 ${String(index + 1).padStart(5, "0")}`,
    amount: index + 1,
  })),
);
const smallRows = computed(() => rows.value.slice(0, 30));
const columns = computed<readonly ScTableColumn<SampleRow>[]>(() => [
  { id: "name", label: t("app.name"), value: (row) => row.name, sortable: true },
  { id: "amount", label: t("app.amount"), value: (row) => row.amount, sortable: true },
]);
const sorting = ref<ScTableSort | null>(null);
const selectedKeys = ref<string[]>([]);
const pagination = ref<ScTablePagination>({ pageIndex: 0, pageSize: 10, total: 30 });
const getRowKey = (row: SampleRow) => row.id;
const getRowLabel = (row: SampleRow) => row.name;
const labels = computed<Partial<ScTableLabels>>(() =>
  locale.value === "en"
    ? {
        loading: t("common.states.loading"),
        empty: t("common.states.empty"),
        retry: t("common.actions.retry"),
        selectPage: "Select this page",
        selectRow: (name) => `Select ${name}`,
        selectionCount: (count) => `${count} selected`,
        sort: (name, next) => `Sort ${name}: ${next}`,
        previousPage: "Previous",
        nextPage: "Next",
        page: (current, pages, total) => `Page ${current} of ${pages}, ${total} rows`,
        scrollRegion: (caption) => `${caption} scroll area`,
        listScrollRegion: (label) => `${label} scroll area`,
        actions: "Actions",
        virtualView: "Virtual view",
        paginatedView: "Paginated view",
        virtualHint:
          "Only visible rows are rendered. Use paginated view for full table navigation.",
        firstRow: "First row",
        previousRow: "Previous row",
        nextRow: "Next row",
        lastRow: "Last row",
        rowPosition: (current, total) => `Row ${current} of ${total}`,
      }
    : {
        loading: t("common.states.loading"),
        empty: t("common.states.empty"),
        retry: t("common.actions.retry"),
      },
);
function changeSort(next: ScTableSort | null) {
  sorting.value = next;
  pagination.value = { ...pagination.value, pageIndex: 0 };
}
</script>

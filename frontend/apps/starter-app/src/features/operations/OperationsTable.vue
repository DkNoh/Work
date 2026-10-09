<template>
  <sc-data-table
    class="operations-table"
    :rows="rows"
    :columns="columns"
    :caption="caption"
    :get-row-key="getRowKey"
    data-mode="server"
    :pagination="{ pageIndex: page, pageSize: 20, total }"
    :loading="loading"
    :error="error"
    :labels="labels"
    @change-pagination="emit('change-page', $event.pageIndex)"
    @retry="emit('retry')"
  >
    <template v-if="$slots['row-actions']" #row-actions="slotProps">
      <slot name="row-actions" v-bind="slotProps" />
    </template>
  </sc-data-table>
</template>

<script setup lang="ts" generic="T extends object">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 서버 total과 20개 페이지 크기를 공통 표에 전달한다. 행 action은 이름 있는 slot을 통해 각 패널이 정의한다.
 */

/**
 * 운영 패널의 서버 페이지 표 wrapper다. generic T는 rows/columns/getRowKey/slot의 행 타입을 동일하게 연결한다.
 * readonly props는 부모 소유이고 페이지 변경·재시도는 emit한다. data-mode server이므로 전달받은 페이지를 다시 자르지 않는다.
 * defineSlots는 row-actions의 타입 계약이다. 자식 표가 제공한 row를 부모의 action slot에 전달한다.
 */

import { computed, type VNode } from "vue";
import { useI18n } from "vue-i18n";
import {
  ScDataTable,
  type ScTableColumn,
  type ScTableLabels,
  type ScTableRowSlot,
} from "@sc/ui/table";
import { messages } from "./messages";
defineProps<{
  rows: readonly T[];
  columns: readonly ScTableColumn<T>[];
  caption: string;
  getRowKey: (row: T) => string;
  page: number;
  total: number;
  loading: boolean;
  error?: string;
}>();
const emit = defineEmits<{ "change-page": [page: number]; retry: [] }>();
defineSlots<{ "row-actions"?: (props: ScTableRowSlot<T>) => VNode[] }>();
const { t } = useI18n({ useScope: "local", messages });
const labels = computed<Partial<ScTableLabels>>(() => ({
  loading: t("loading"),
  empty: t("empty"),
  retry: t("retry"),
  previousPage: t("previous"),
  nextPage: t("next"),
  page: (page, _pages, total) => t("page", { page, total }),
  scrollRegion: (caption) => t("scroll", { caption }),
  actions: t("actions"),
}));
</script>

<style scoped>
.operations-table {
  min-width: 0;
  max-width: 100%;
}
.operations-table :deep(.sc-table) {
  table-layout: auto;
  min-width: 1000px;
}
.operations-table :deep(th),
.operations-table :deep(td) {
  white-space: nowrap;
}
</style>

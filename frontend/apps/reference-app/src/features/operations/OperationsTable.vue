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
 * data-mode="server"로 받은 20개 행을 다시 클라이언트 페이지로 자르지 않는다. 행 action slot은 부모에게 그대로 전달한다.
 */

/**
 * 운영 화면의 서버 페이지 표에 동일한 번역/열 너비/페이지 이벤트 규칙을 적용하는 앱 전용 wrapper다.
 * generic T extends object는 Java 제네릭처럼 rows·columns·getRowKey·row-actions가 같은 행 타입을 사용하도록 묶는다.
 * readonly 배열 props는 부모 소유 자료다. 이 wrapper는 직접 정렬/삭제하거나 API를 호출하지 않고 change-page/retry 이벤트로 요청한다.
 * defineSlots는 row-actions slot에 전달할 타입을 선언한다. VNode 타입 참조는 화면을 render/h/JSX로 구현한다는 뜻이 아니다.
 */

import { computed, type VNode } from "vue";
import { useI18n } from "vue-i18n";
import {
  ScDataTable,
  type ScTableColumn,
  type ScTableLabels,
  type ScTableRowSlot,
} from "@sc/ui/table";
import { operationMessages } from "./messages";
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
const { t } = useI18n({ useScope: "local", messages: operationMessages });
const labels = computed<Partial<ScTableLabels>>(() => ({
  loading: t("loading"),
  empty: t("empty"),
  retry: t("retry"),
  previousPage: t("previous"),
  nextPage: t("next"),
  page: (page, _pages, total) => t("page", { page, total }),
  scrollRegion: (caption) => t("scrollRegion", { caption }),
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
  min-width: 1100px;
}
.operations-table :deep(th),
.operations-table :deep(td) {
  white-space: nowrap;
}
</style>

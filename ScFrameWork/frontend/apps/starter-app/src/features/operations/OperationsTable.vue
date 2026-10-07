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

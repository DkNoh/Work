<template>
  <div class="report-table-wrapper sc-stack">
    <div class="report-table-actions">
      <sc-select
        :model-value="view"
        :label="t('report.view')"
        :options="viewOptions"
        @update:model-value="changeView"
      />
      <sc-action-button
        variant="outlined"
        :disabled="!selectedKeys.length"
        @click="emit('update:selectedKeys', [])"
      >
        {{ t("report.clearSelection") }}
      </sc-action-button>
    </div>
    <p>{{ sortingDescription }}</p>
    <p v-if="view === 'virtual'">{{ t("report.virtualPage") }}</p>
    <sc-data-table
      v-if="view === 'table'"
      v-bind="tableProps"
      class="report-table"
      @change-sort="emit('change-sort', $event)"
      @change-pagination="emit('change-page', $event.pageIndex)"
      @update:selected-keys="emit('update:selectedKeys', $event)"
      @retry="emit('retry')"
    >
      <template #row-actions="{ row }">
        <router-link
          class="report-detail-link"
          :to="{ path: `/requests/${row.id}` }"
          :aria-label="`${t('request.open')}: ${row.title}`"
        >
          {{ t("request.open") }}
        </router-link>
      </template>
    </sc-data-table>
    <sc-virtual-table
      v-else
      v-bind="tableProps"
      class="report-table"
      :height="480"
      :estimate-row-height="48"
      :overscan="8"
      @change-sort="emit('change-sort', $event)"
      @change-pagination="emit('change-page', $event.pageIndex)"
      @update:selected-keys="emit('update:selectedKeys', $event)"
      @retry="emit('retry')"
    >
      <template #row-actions="{ row }">
        <router-link
          class="report-detail-link"
          data-sc-focus="detail"
          :to="{ path: `/requests/${row.id}` }"
          :aria-label="`${t('request.open')}: ${row.title}`"
        >
          {{ t("request.open") }}
        </router-link>
      </template>
    </sc-virtual-table>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { createDateFormatter } from "@sc/date";
import { ScActionButton, ScSelect } from "@sc/ui";
import {
  ScDataTable,
  ScVirtualTable,
  type ScDataTableProps,
  type ScTableColumn,
  type ScTableLabels,
  type ScTableSort,
  type ScTablePagination,
} from "@sc/ui/table";
import type { RequirementReportItem } from "./api";
import type { ReportView } from "./filters";

const props = defineProps<{
  rows: readonly RequirementReportItem[];
  pagination: ScTablePagination;
  sorting: ScTableSort | null;
  selectedKeys: readonly string[];
  view: ReportView;
  loading: boolean;
  error: string;
}>();
const emit = defineEmits<{
  "change-sort": [sorting: ScTableSort | null];
  "change-page": [page: number];
  "change-view": [view: ReportView];
  "update:selectedKeys": [keys: string[]];
  retry: [];
}>();
const { t, locale } = useI18n({ useScope: "global" });
const formatter = computed(() =>
  createDateFormatter({
    locale: locale.value === "en" ? "en" : "ko",
    timeZone: "Asia/Seoul",
    emptyDisplay: t("report.noComment"),
  }),
);
const columns = computed<readonly ScTableColumn<RequirementReportItem>[]>(() => [
  { id: "title", label: t("request.title"), value: (row) => row.title, sortable: true },
  { id: "menu", label: t("request.menu"), value: (row) => row.menuName },
  { id: "status", label: t("request.status"), value: (row) => t(`request.statuses.${row.status}`) },
  { id: "author", label: t("request.author"), value: (row) => row.authorName },
  {
    id: "reviewer",
    label: t("report.reviewer"),
    value: (row) => row.assignedReviewerName ?? t("report.unassigned"),
  },
  {
    id: "decision",
    label: t("request.decision"),
    value: (row) =>
      row.reviewDecision === null
        ? t("report.noReview")
        : t(`request.decisions.${row.reviewDecision}`),
  },
  {
    id: "commentCount",
    label: t("report.commentCount"),
    value: (row) => row.commentCount,
    sortable: true,
  },
  {
    id: "historyCount",
    label: t("report.historyCount"),
    value: (row) => row.historyCount,
    sortable: true,
  },
  {
    id: "lastCommentAt",
    label: t("report.lastCommentAt"),
    value: (row) => formatter.value.formatTimestamp(row.lastCommentAt),
    sortable: true,
  },
  {
    id: "updatedAt",
    label: t("request.updatedAt"),
    value: (row) => formatter.value.formatTimestamp(row.updatedAt),
    sortable: true,
  },
]);
const labels = computed<Partial<ScTableLabels>>(() => ({
  loading: t("common.states.loading"),
  empty: t("common.states.empty"),
  retry: t("common.actions.retry"),
  selectPage: t("report.table.selectPage"),
  selection: t("report.table.selection"),
  selectRow: (name) => t("report.table.selectRow", { name }),
  selectionCount: (count) => t("report.table.selectionCount", { count }),
  sort: (label, next) =>
    `${label}: ${next === "none" ? t("report.defaultNext") : t(`report.${next}`)}`,
  previousPage: t("report.table.previousPage"),
  nextPage: t("report.table.nextPage"),
  page: (current, pages, total) => t("report.table.page", { current, pages, total }),
  scrollRegion: (caption) => t("report.table.scrollRegion", { caption }),
  actions: t("report.table.actions"),
  virtualView: t("report.table.virtualView"),
  paginatedView: t("report.table.paginatedView"),
  virtualHint: t("report.table.virtualHint"),
  firstRow: t("report.table.firstRow"),
  previousRow: t("report.table.previousRow"),
  nextRow: t("report.table.nextRow"),
  lastRow: t("report.table.lastRow"),
  rowPosition: (current, total) => t("report.table.rowPosition", { current, total }),
}));
const viewOptions = computed(() => [
  { value: "table", label: t("report.tableView") },
  { value: "virtual", label: t("report.virtualView") },
]);
const rowKey = (row: RequirementReportItem) => String(row.id);
const rowLabel = (row: RequirementReportItem) => row.title;
const tableProps = computed<ScDataTableProps<RequirementReportItem>>(() => ({
  rows: props.rows,
  columns: columns.value,
  caption: t("report.title"),
  getRowKey: rowKey,
  getRowLabel: rowLabel,
  dataMode: "server",
  sorting: props.sorting,
  pagination: props.pagination,
  selectionMode: "multiple",
  selectedKeys: props.selectedKeys,
  loading: props.loading,
  error: props.error,
  labels: labels.value,
}));
const sortingDescription = computed(() => {
  if (props.sorting === null) return t("report.defaultSort");
  const column = columns.value.find((item) => item.id === props.sorting?.columnId);
  return t("report.explicitSort", {
    field: column?.label ?? props.sorting.columnId,
    direction: t(`report.${props.sorting.direction}`),
  });
});
function changeView(value: string | null) {
  if (value === "table" || value === "virtual") emit("change-view", value);
}
</script>

<style scoped>
.report-table-wrapper,
.report-table {
  min-width: 0;
  max-width: 100%;
}
.report-table-actions {
  display: flex;
  align-items: start;
  flex-wrap: wrap;
  gap: var(--sc-space-3);
}
.report-table-actions > :first-child {
  flex: 0 1 260px;
}
.report-detail-link {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  padding: var(--sc-space-2);
}
/* 업무 열의 폭은 이 화면만 소유하며 가로 스크롤은 공통 표의 명명된 영역을 사용한다. */
.report-table :deep(.sc-table) {
  min-width: 1800px;
}
.report-table :deep(.sc-table th) {
  white-space: nowrap;
}
.report-table :deep(.sc-table th:nth-child(2)) {
  width: 240px;
}
.report-table :deep(.sc-table th:nth-child(8)),
.report-table :deep(.sc-table th:nth-child(9)) {
  width: 116px;
}
.report-table :deep(.sc-table th:nth-child(10)),
.report-table :deep(.sc-table th:nth-child(11)) {
  width: 240px;
}
.report-table :deep(.sc-table th:last-child) {
  width: 108px;
}
.report-table :deep(.sc-table td:nth-child(10)),
.report-table :deep(.sc-table td:nth-child(11)),
.report-table :deep(.sc-table td:last-child) {
  white-space: nowrap;
}
</style>

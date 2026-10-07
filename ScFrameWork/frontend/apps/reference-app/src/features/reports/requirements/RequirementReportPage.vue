<template>
  <section class="sc-content sc-stack">
    <sc-page-header
      :title="t('report.title')"
      :subtitle="data ? t('report.total', { count: data.total }) : t('report.description')"
    >
      <template #actions>
        <sc-action-button
          variant="outlined"
          :busy="query.isFetching.value"
          :disabled="!valid"
          @click="reloadReport"
        >
          {{ t("report.refresh") }}
        </sc-action-button>
      </template>
    </sc-page-header>
    <sc-section-card :title="t('report.filters')">
      <report-filters
        :filters="filters"
        :menus="lookups.menus.data.value ?? []"
        :users="lookups.users.data.value ?? []"
        :busy="query.isFetching.value"
        :server-errors="fieldErrors"
        @apply="applyFilters"
        @reset="resetFilters"
      />
      <p v-if="filters.screenVersionId !== null">
        {{ t("report.screenVersion", { id: filters.screenVersionId }) }}
      </p>
      <v-alert
        v-if="lookups.menus.isError.value || lookups.users.isError.value"
        type="error"
        role="alert"
      >
        <p>{{ t("request.lookupError") }}</p>
        <sc-action-button variant="outlined" @click="reloadLookups">
          {{ t("report.lookupRetry") }}
        </sc-action-button>
      </v-alert>
      <v-alert v-if="!valid" type="error" role="alert">
        <p>{{ t("report.queryError") }}</p>
        <ul>
          <li v-for="(message, field) in parsed.errors" :key="field">
            {{ t(`report.field.${field}`) }}: {{ t(`report.validation.${message}`) }}
          </li>
        </ul>
      </v-alert>
    </sc-section-card>
    <sc-section-card
      v-if="valid"
      :title="t('report.summary')"
      :description="t('report.summaryHint')"
      :aria-busy="query.isFetching.value || undefined"
    >
      <dl v-if="data" class="report-summary">
        <div v-for="item in summary" :key="item.key">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
      <p v-else role="status">
        {{ query.isError.value ? t("report.summaryError") : t("common.states.loading") }}
      </p>
    </sc-section-card>
    <sc-section-card v-if="valid" :title="t('report.results')">
      <report-table
        v-model:selected-keys="selectedKeys"
        :rows="data?.items ?? []"
        :pagination="pagination"
        :sorting="sorting"
        :view="parsed.view"
        :loading="query.isFetching.value"
        :error="operationError"
        @change-sort="changeSort"
        @change-page="changePage"
        @change-view="changeView"
        @retry="reloadReport"
      />
    </sc-section-card>
    <sc-section-card v-if="valid" :title="t('report.chart')">
      <report-chart
        :page="data ?? null"
        :loading="query.isFetching.value"
        :error="operationError"
        @retry="reloadReport"
      />
    </sc-section-card>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { ApiError } from "@sc/runtime";
import { ScActionButton, ScPageHeader, ScSectionCard } from "@sc/ui";
import type { ScTablePagination, ScTableSort } from "@sc/ui/table";
import { useReferenceRuntime } from "../../../auth/identity";
import { useRequirementLookups } from "../../requirements/query";
import ReportFilters from "./ReportFilters.vue";
import ReportTable from "./ReportTable.vue";
import ReportChart from "./ReportChart.vue";
import {
  isReportSortField,
  parseReportQuery,
  reportRouteQuery,
  reportStatuses,
  type ReportFilterInput,
  type ReportView,
} from "./filters";
import { useRequirementReport } from "./query";

const runtime = useReferenceRuntime();
const route = useRoute();
const { t } = useI18n({ useScope: "global" });
const parsed = computed(() => parseReportQuery(route.query));
const filters = computed(() => parsed.value.filters);
const valid = computed(() => Object.keys(parsed.value.errors).length === 0);
const query = useRequirementReport(filters, valid);
const lookups = useRequirementLookups();
const data = computed(() => (valid.value ? query.data.value : undefined));
// 선택 키는 UI 상태다. 페이지·정렬·보기 변경으로 서버 페이지 밖의 선택을 삭제하지 않는다.
const selectedKeys = ref<string[]>([]);
watch(
  () => runtime.session.identity?.id,
  () => {
    selectedKeys.value = [];
  },
);
const pagination = computed<ScTablePagination>(() => ({
  pageIndex: data.value?.page ?? filters.value.page,
  pageSize: data.value?.size ?? filters.value.size,
  total: data.value?.total ?? 0,
}));
const sorting = computed<ScTableSort | null>(() =>
  filters.value.sort === null
    ? null
    : {
        columnId: filters.value.sort,
        direction: filters.value.direction ?? "desc",
      },
);
const summary = computed(() => {
  const page = data.value;
  if (!page) return [];
  return [
    { key: "total", label: t("report.totalLabel"), value: page.total },
    ...reportStatuses.map((status) => ({
      key: status,
      label: t(`request.statuses.${status}`),
      value: page.stats[status],
    })),
    { key: "unassigned", label: t("report.unassigned"), value: page.stats.unassigned },
  ];
});
const operationError = computed(() =>
  query.isError.value ? (query.error.value?.message ?? t("request.operationError")) : "",
);
const fieldErrors = computed<Readonly<Record<string, string>>>(() => {
  if (!valid.value)
    return Object.fromEntries(
      Object.entries(parsed.value.errors).map(([field, code]) => [
        field,
        t(`report.validation.${code}`),
      ]),
    );
  return query.error.value instanceof ApiError ? query.error.value.fields : {};
});
async function applyFilters(input: ReportFilterInput) {
  await runtime.router.push({
    path: "/reports/requirements",
    query: reportRouteQuery({ ...filters.value, ...input, page: 0 }, parsed.value.view),
  });
}
async function resetFilters() {
  await runtime.router.push({ path: "/reports/requirements", query: { page: "0", size: "20" } });
}
async function changePage(page: number) {
  if (query.isFetching.value || !Number.isInteger(page) || page < 0 || page > 1_000_000) return;
  await runtime.router.push({
    path: "/reports/requirements",
    query: reportRouteQuery({ ...filters.value, page }, parsed.value.view),
  });
}
async function changeSort(next: ScTableSort | null) {
  if (query.isFetching.value || (next !== null && !isReportSortField(next.columnId))) return;
  const sort = next !== null && isReportSortField(next.columnId) ? next.columnId : null;
  // null은 기본 정렬로 복원한다. 다시 active 기본값을 주입하면 3상태 정렬 순환이 막힌다.
  await runtime.router.push({
    path: "/reports/requirements",
    query: reportRouteQuery(
      {
        ...filters.value,
        page: 0,
        sort,
        direction: next?.direction ?? null,
      },
      parsed.value.view,
    ),
  });
}
async function changeView(view: ReportView) {
  await runtime.router.push({
    path: "/reports/requirements",
    query: reportRouteQuery(filters.value, view),
  });
}
async function reloadReport() {
  if (valid.value && !query.isFetching.value) await query.refetch();
}
async function reloadLookups() {
  await Promise.all([lookups.users.refetch(), lookups.menus.refetch()]);
}
</script>

<style scoped>
.report-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr));
  gap: var(--sc-space-4);
}
.report-summary > div {
  padding: var(--sc-space-4);
  border: 1px solid var(--sc-color-border);
  border-radius: var(--sc-radius-md);
  background: var(--sc-color-surface-muted);
}
.report-summary dt {
  color: var(--sc-color-text-muted);
  overflow-wrap: anywhere;
}
.report-summary dd {
  margin: var(--sc-space-2) 0 0;
  font-size: var(--sc-font-size-title);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>

<template>
  <section class="sc-content sc-stack">
    <sc-page-header
      :title="t('request.list')"
      :subtitle="t('request.total', { count: query.data.value?.total ?? 0 })"
    >
      <template #actions>
        <sc-action-button @click="runtime.router.push('/workspace')">
          {{ t("request.new") }}
        </sc-action-button>
      </template>
    </sc-page-header>
    <sc-section-card :title="t('request.filter')">
      <form
        class="requirement-filters"
        :aria-label="t('request.filter')"
        @submit.prevent="applyFilters"
      >
        <sc-text-field v-model="search" :label="t('request.search')" :max-length="200" />
        <sc-select v-model="menu" :label="t('request.menu')" :options="menuOptions" />
        <sc-select v-model="status" :label="t('request.status')" :options="statusOptions" />
        <sc-select v-model="author" :label="t('request.author')" :options="authorOptions" />
        <sc-select v-model="size" :label="t('request.pageSize')" :options="sizeOptions" />
        <sc-action-button type="submit">{{ t("request.filter") }}</sc-action-button>
      </form>
      <v-alert
        v-if="lookups.menus.isError.value || lookups.users.isError.value"
        type="error"
        role="alert"
      >
        {{ t("request.lookupError") }}
      </v-alert>
    </sc-section-card>
    <sc-section-card :title="t('request.list')">
      <sc-data-table
        class="requirements-table"
        :rows="query.data.value?.items ?? []"
        :columns="columns"
        :caption="t('request.list')"
        :get-row-key="rowKey"
        :get-row-label="rowLabel"
        data-mode="server"
        :pagination="{
          pageIndex: filters.page,
          pageSize: filters.size,
          total: query.data.value?.total ?? 0,
        }"
        :loading="query.isPending.value"
        :error="
          query.isError.value ? (query.error.value?.message ?? t('request.operationError')) : ''
        "
        @change-pagination="changePage($event.pageIndex)"
        @retry="query.refetch()"
      >
        <template #row-actions="{ row }">
          <router-link
            class="requirement-link"
            :to="{ path: `/requests/${row.id}`, query: route.query }"
            :aria-label="`${t('request.open')}: ${row.title}`"
          >
            {{ t("request.open") }}
          </router-link>
        </template>
      </sc-data-table>
    </sc-section-card>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { createDateFormatter } from "@sc/date";
import { ScActionButton, ScPageHeader, ScSectionCard, ScSelect, ScTextField } from "@sc/ui";
import { ScDataTable, type ScTableColumn } from "@sc/ui/table";
import { useReferenceRuntime } from "../../auth/identity";
import { createRequirementsApi, type RequirementFilters, type RequirementSummary } from "./api";
import { requirementKeys, useRequirementLookups } from "./query";

const runtime = useReferenceRuntime();
const route = useRoute();
const api = createRequirementsApi(runtime);
const lookups = useRequirementLookups();
const { t, locale } = useI18n({ useScope: "global" });
const statuses = ["DRAFT", "REQUESTED", "NEEDS_INFO", "REVIEWING", "AGREED", "ADO_LINKED"];
function integer(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}
const filters = computed<RequirementFilters>(() => ({
  q: typeof route.query.q === "string" ? route.query.q.slice(0, 200) : "",
  menuId: integer(route.query.menuId, 0, 1, Number.MAX_SAFE_INTEGER) || null,
  status:
    typeof route.query.status === "string" && statuses.includes(route.query.status)
      ? route.query.status
      : "",
  authorId: integer(route.query.authorId, 0, 1, Number.MAX_SAFE_INTEGER) || null,
  page: integer(route.query.page, 0, 0, 1_000_000),
  size: integer(route.query.size, 20, 1, 100),
}));
const query = useQuery({
  queryKey: computed(() => [...requirementKeys.lists, filters.value] as const),
  queryFn: ({ queryKey, signal }) => api.list(queryKey[2], signal),
  enabled: computed(() => !!runtime.session.identity),
});
// 입력 중인 조회 조건은 제출 전까지 API 조건이 아니다. 적용된 조건·페이지의 원본은 URL이다.
const search = ref("");
const menu = ref<string | null>("");
const status = ref<string | null>("");
const author = ref<string | null>("");
const size = ref<string | null>("20");
watch(
  filters,
  (value) => {
    search.value = value.q;
    menu.value = value.menuId ? String(value.menuId) : "";
    status.value = value.status;
    author.value = value.authorId ? String(value.authorId) : "";
    size.value = String(value.size);
  },
  { immediate: true },
);
const allOption = computed(() => ({ value: "", label: t("request.all") }));
const menuOptions = computed(() => [
  allOption.value,
  ...(lookups.menus.data.value ?? []).map((item) => ({ value: String(item.id), label: item.name })),
]);
const authorOptions = computed(() => [
  allOption.value,
  ...(lookups.users.data.value ?? []).map((item) => ({
    value: String(item.id),
    label: item.displayName,
  })),
]);
const statusOptions = computed(() => [
  allOption.value,
  ...statuses.map((value) => ({ value, label: t(`request.statuses.${value}`) })),
]);
const sizeOptions = [10, 20, 50, 100].map((value) => ({
  value: String(value),
  label: String(value),
}));
const formatter = computed(() =>
  createDateFormatter({ locale: locale.value === "en" ? "en" : "ko", timeZone: "Asia/Seoul" }),
);
const columns = computed<readonly ScTableColumn<RequirementSummary>[]>(() => [
  { id: "title", label: t("request.title"), value: (row) => row.title },
  { id: "menu", label: t("request.menu"), value: (row) => row.menuName },
  { id: "status", label: t("request.status"), value: (row) => t(`request.statuses.${row.status}`) },
  { id: "author", label: t("request.author"), value: (row) => row.authorName },
  {
    id: "updatedAt",
    label: t("request.updatedAt"),
    value: (row) => formatter.value.formatTimestamp(row.updatedAt),
  },
]);
const rowKey = (row: RequirementSummary) => String(row.id);
const rowLabel = (row: RequirementSummary) => row.title;
async function applyFilters() {
  const query: Record<string, string> = { page: "0", size: size.value ?? "20" };
  if (search.value) query.q = search.value;
  if (menu.value) query.menuId = menu.value;
  if (status.value) query.status = status.value;
  if (author.value) query.authorId = author.value;
  await runtime.router.replace({ path: "/requests", query });
}
async function changePage(page: number) {
  await runtime.router.replace({ query: { ...route.query, page: String(page) } });
}
</script>

<style scoped>
.requirement-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
  gap: var(--sc-space-4);
  align-items: start;
}
.requirement-link {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  padding: var(--sc-space-2);
}
.requirements-table {
  min-width: 0;
  max-width: 100%;
}
/* 업무 열의 읽을 수 있는 폭을 유지하고 가로 이동은 공통 표의 명명된 스크롤 영역이 맡는다. */
.requirements-table :deep(.sc-table) {
  min-width: 900px;
}
.requirements-table :deep(.sc-table th) {
  white-space: nowrap;
}
.requirements-table :deep(.sc-table th:first-child) {
  width: 26%;
}
.requirements-table :deep(.sc-table th:nth-child(5)) {
  width: 240px;
}
.requirements-table :deep(.sc-table th:last-child) {
  width: 108px;
}
.requirements-table :deep(.sc-table td:nth-child(5)),
.requirements-table :deep(.sc-table td:last-child) {
  white-space: nowrap;
}
</style>

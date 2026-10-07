<template>
  <section class="sc-stack">
    <sc-page-header :title="t('browserErrors')" />
    <operations-navigation />
    <operations-gate :allowed="access.browserErrors.value">
      <form
        :aria-label="t('errorFilters')"
        class="operation-filters"
        novalidate
        @submit.prevent="applyFilters"
      >
        <sc-select
          v-model="source"
          :label="t('source')"
          :options="sourceOptions"
          :error-messages="form.errors.value.source"
        />
        <sc-select
          v-model="eventCode"
          :label="t('eventCode')"
          :options="codeOptions"
          :error-messages="form.errors.value.eventCode"
        />
        <sc-action-button type="submit">{{ t("search") }}</sc-action-button>
      </form>
      <p v-if="!valid" role="alert">{{ t("invalid") }}</p>
      <sc-action-button
        variant="text"
        :busy="groups.isFetching.value"
        :busy-label="t('processing')"
        @click="groups.refetch()"
      >
        {{ t("refresh") }}
      </sc-action-button>
      <operations-table
        :rows="groups.data.value?.items ?? []"
        :columns="groupColumns"
        :caption="t('groupList')"
        :get-row-key="groupKey"
        :page="page ?? 0"
        :total="groups.data.value?.total ?? 0"
        :loading="groups.isFetching.value"
        :error="groups.error.value?.message"
        @change-page="changePage"
        @retry="groups.refetch()"
      >
        <template #row-actions="{ row }">
          <sc-action-button
            variant="text"
            :aria-label="`${t('occurrences')} · ${t('selectGroup', { id: row.id })}`"
            @click="selectGroup(row.id)"
          >
            {{ t("occurrences") }}
          </sc-action-button>
        </template>
      </operations-table>
      <operations-table
        v-if="groupId"
        :rows="occurrences.data.value?.items ?? []"
        :columns="occurrenceColumns"
        :caption="`${t('occurrenceList')} · ${groupId}`"
        :get-row-key="occurrenceKey"
        :page="historyPage ?? 0"
        :total="occurrences.data.value?.total ?? 0"
        :loading="occurrences.isFetching.value"
        :error="occurrences.error.value?.message"
        @change-page="changeHistoryPage"
        @retry="occurrences.refetch()"
      />
    </operations-gate>
  </section>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { useForm } from "vee-validate";
import { useI18n } from "vue-i18n";
import { z } from "zod";
import { createDateFormatter } from "@sc/date";
import { ScActionButton, ScPageHeader, ScSelect } from "@sc/ui";
import type { ScTableColumn } from "@sc/ui/table";
import { useReferenceRuntime } from "../../auth/identity";
import {
  createOperationsApi,
  operationKeys,
  type BrowserGroupPage,
  type BrowserOccurrencePage,
} from "./api";
import { useOperationsAccess } from "./capabilities";
import { operationPage, operationSelection } from "./url";
import { operationMessages } from "./messages";
import OperationsNavigation from "./OperationsNavigation.vue";
import OperationsGate from "./OperationsGate.vue";
import OperationsTable from "./OperationsTable.vue";
const runtime = useReferenceRuntime();
const api = createOperationsApi(runtime);
const access = useOperationsAccess();
const route = useRoute();
const { t, locale } = useI18n({ useScope: "local", messages: operationMessages });
const sources = ["VUE", "WINDOW", "REJECTION"] as const;
const codes = ["VUE_ERROR", "WINDOW_ERROR", "UNHANDLED_REJECTION", "UNKNOWN_RUNTIME"] as const;
const schema = z.object({
  source: z.union([z.literal(""), z.enum(sources)]),
  eventCode: z.union([z.literal(""), z.enum(codes)]),
});
const filters = computed(() =>
  schema.safeParse({ source: route.query.source ?? "", eventCode: route.query.eventCode ?? "" }),
);
const page = computed(() => operationPage(route.query));
const historyPage = computed(() => operationPage(route.query, "historyPage"));
const groupId = computed(() => operationSelection(route.query, "group"));
const valid = computed(
  () =>
    page.value !== null &&
    historyPage.value !== null &&
    groupId.value !== undefined &&
    filters.value.success,
);
const parameters = computed(() => {
  const p = new URLSearchParams({ page: String(page.value ?? 0), size: "20" });
  if (filters.value.success) {
    if (filters.value.data.source) p.set("source", filters.value.data.source);
    if (filters.value.data.eventCode) p.set("eventCode", filters.value.data.eventCode);
  }
  return p.toString();
});
const historyParameters = computed(() =>
  new URLSearchParams({ page: String(historyPage.value ?? 0), size: "20" }).toString(),
);
const groups = useQuery({
  queryKey: computed(() => [...operationKeys.browserGroups, parameters.value]),
  queryFn: ({ queryKey, signal }) => api.browserGroups(queryKey[2]!, signal),
  enabled: computed(() => access.browserErrors.value && valid.value),
});
const occurrences = useQuery({
  queryKey: computed(
    () => [...operationKeys.browserOccurrences, groupId.value, historyParameters.value] as const,
  ),
  queryFn: ({ queryKey, signal }) => api.browserOccurrences(queryKey[2]!, queryKey[3]!, signal),
  enabled: computed(() => access.browserErrors.value && valid.value && groupId.value !== null),
});
const form = useForm<{ source: string; eventCode: string }>({
  initialValues: { source: "", eventCode: "" },
});
const [source] = form.defineField("source");
const [eventCode] = form.defineField("eventCode");
watch(
  [() => route.query.source, () => route.query.eventCode],
  () => {
    if (filters.value.success) form.resetForm({ values: filters.value.data });
  },
  { immediate: true },
);
const sourceOptions = computed(() => [
  { value: "", label: t("all") },
  ...sources.map((value) => ({ value, label: value })),
]);
const codeOptions = computed(() => [
  { value: "", label: t("all") },
  ...codes.map((value) => ({ value, label: value })),
]);
const formatter = computed(() =>
  createDateFormatter({ locale: locale.value === "en" ? "en" : "ko", timeZone: "Asia/Seoul" }),
);
type Group = BrowserGroupPage["items"][number];
type Occurrence = BrowserOccurrencePage["items"][number];
const groupColumns = computed<readonly ScTableColumn<Group>[]>(() => [
  { id: "id", label: "ID", value: (row) => row.id },
  { id: "source", label: t("source"), value: (row) => row.source },
  { id: "code", label: t("eventCode"), value: (row) => row.eventCode },
  { id: "route", label: t("routeCode"), value: (row) => row.routeCode },
  { id: "count", label: t("occurrenceCount"), value: (row) => row.occurrenceCount },
  {
    id: "first",
    label: t("firstSeen"),
    value: (row) => formatter.value.formatTimestamp(row.firstSeenAt),
  },
  {
    id: "last",
    label: t("lastSeen"),
    value: (row) => formatter.value.formatTimestamp(row.lastSeenAt),
  },
]);
const occurrenceColumns = computed<readonly ScTableColumn<Occurrence>[]>(() => [
  { id: "id", label: "ID", value: (row) => row.id },
  { id: "actor", label: t("actor"), value: (row) => row.actorSubject },
  { id: "request", label: t("requestId"), value: (row) => row.requestId },
  {
    id: "occurred",
    label: t("occurred"),
    value: (row) => formatter.value.formatTimestamp(row.occurredAt),
  },
]);
const groupKey = (row: Group) => String(row.id);
const occurrenceKey = (row: Occurrence) => String(row.id);
async function applyFilters() {
  const result = schema.safeParse(form.values);
  if (!result.success) {
    form.setErrors({ source: t("invalid"), eventCode: t("invalid") });
    return;
  }
  await runtime.router.push({
    query: {
      ...(result.data.source ? { source: result.data.source } : {}),
      ...(result.data.eventCode ? { eventCode: result.data.eventCode } : {}),
      page: "0",
    },
  });
}
async function changePage(page: number) {
  await runtime.router.push({
    query: { ...route.query, page: String(page), group: undefined, historyPage: undefined },
  });
}
async function selectGroup(id: number) {
  await runtime.router.push({ query: { ...route.query, group: String(id), historyPage: "0" } });
}
async function changeHistoryPage(page: number) {
  await runtime.router.push({ query: { ...route.query, historyPage: String(page) } });
}
</script>

<style scoped>
.operation-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  gap: var(--sc-space-4);
  align-items: start;
}
</style>

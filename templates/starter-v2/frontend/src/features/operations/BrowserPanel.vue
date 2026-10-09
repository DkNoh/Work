<template>
  <div class="sc-stack">
    <h2>{{ t("browserErrors") }}</h2>
    <p v-if="!valid" role="alert">{{ t("invalid") }}</p>
    <sc-action-button
      variant="text"
      :busy="groups.isFetching.value"
      :busy-label="t('processing')"
      @click="groups.refetch()"
    >
      {{ t("reload") }}
    </sc-action-button>
    <operations-table
      :rows="groups.data.value?.items ?? []"
      :columns="groupColumns"
      :caption="t('browserErrors')"
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
          :aria-label="`${t('history')} · ${t('selectGroup', { id: row.id })}`"
          @click="selectGroup(row.id)"
        >
          {{ t("history") }}
        </sc-action-button>
      </template>
    </operations-table>
    <operations-table
      v-if="groupId"
      :rows="occurrences.data.value?.items ?? []"
      :columns="occurrenceColumns"
      :caption="`${t('history')} · ${groupId}`"
      :get-row-key="occurrenceKey"
      :page="historyPage ?? 0"
      :total="occurrences.data.value?.total ?? 0"
      :loading="occurrences.isFetching.value"
      :error="occurrences.error.value?.message"
      @change-page="changeHistoryPage"
      @retry="occurrences.refetch()"
    />
  </div>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 그룹 표의 action 버튼으로 선택을 URL에 반영하면 이력 표가 나타난다. 원문 오류 내용이 아닌 허용된 코드/식별 정보만 표시한다.
 */

/**
 * 브라우저 오류 그룹과 선택 그룹 발생 이력의 읽기 전용 패널이다. 페이지/그룹/이력 페이지 원본은 Router query다.
 * 두 Query의 key를 분리하고 선택 그룹 ID를 이력 key에 포함한다. 잘못된 URL은 valid=false로 네트워크 조회를 막는다.
 * GroupPage["items"][number]는 배열 요소 타입을 꺼내는 TypeScript indexed access다. DTO 구조를 다시 선언하지 않고 표에 연결한다.
 */

import { computed } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { useFrameworkRuntime } from "@sc/runtime";
import { createDateFormatter } from "@sc/date";
import { ScActionButton } from "@sc/ui";
import type { ScTableColumn } from "@sc/ui/table";
import {
  createOperationsApi,
  operationKeys,
  type BrowserGroupPage,
  type BrowserOccurrencePage,
} from "./api";
import { pageNumber, selectedId } from "./url";
import { messages } from "./messages";
import OperationsTable from "./OperationsTable.vue";
const runtime = useFrameworkRuntime();
const api = createOperationsApi(runtime);
const route = useRoute();
const { t, locale } = useI18n({ useScope: "local", messages });
const page = computed(() => pageNumber(route.query));
const historyPage = computed(() => pageNumber(route.query, "historyPage"));
const groupId = computed(() => selectedId(route.query, "group"));
const valid = computed(
  () => page.value !== null && historyPage.value !== null && groupId.value !== undefined,
);
const parameters = computed(() =>
  new URLSearchParams({ page: String(page.value ?? 0), size: "20" }).toString(),
);
const historyParameters = computed(() =>
  new URLSearchParams({ page: String(historyPage.value ?? 0), size: "20" }).toString(),
);
const groups = useQuery({
  queryKey: computed(() => [...operationKeys.browserGroups, parameters.value]),
  queryFn: ({ queryKey, signal }) => api.browserGroups(queryKey[2]!, signal),
  enabled: valid,
});
const occurrences = useQuery({
  queryKey: computed(
    () => [...operationKeys.browserOccurrences, groupId.value, historyParameters.value] as const,
  ),
  queryFn: ({ queryKey, signal }) => api.browserOccurrences(queryKey[2]!, queryKey[3]!, signal),
  enabled: computed(() => valid.value && groupId.value !== null),
});
const formatter = computed(() =>
  createDateFormatter({ locale: locale.value === "en" ? "en" : "ko", timeZone: "UTC" }),
);
type Group = BrowserGroupPage["items"][number];
type Occurrence = BrowserOccurrencePage["items"][number];
const groupColumns = computed<readonly ScTableColumn<Group>[]>(() => [
  { id: "id", label: "ID", value: (row) => row.id },
  { id: "source", label: t("source"), value: (row) => row.source },
  { id: "code", label: t("code"), value: (row) => row.eventCode },
  { id: "route", label: t("route"), value: (row) => row.routeCode },
  { id: "count", label: t("count"), value: (row) => row.occurrenceCount },
  { id: "last", label: t("last"), value: (row) => formatter.value.formatTimestamp(row.lastSeenAt) },
]);
const occurrenceColumns = computed<readonly ScTableColumn<Occurrence>[]>(() => [
  { id: "id", label: "ID", value: (row) => row.id },
  { id: "actor", label: t("actor"), value: (row) => row.actorSubject },
  {
    id: "occurred",
    label: t("occurred"),
    value: (row) => formatter.value.formatTimestamp(row.occurredAt),
  },
]);
const groupKey = (row: Group) => String(row.id);
const occurrenceKey = (row: Occurrence) => String(row.id);
async function changePage(page: number) {
  await runtime.router.push({ query: { page: String(page) } });
}
/**
 * 새 그룹 선택 시 이력 페이지를 0으로 시작한다. 현재 그룹 페이지는 유지하여 뒤로가기로 탐색 맥락을 복원할 수 있다.
 */
async function selectGroup(id: number) {
  await runtime.router.push({ query: { ...route.query, group: String(id), historyPage: "0" } });
}
async function changeHistoryPage(page: number) {
  await runtime.router.push({ query: { ...route.query, historyPage: String(page) } });
}
</script>

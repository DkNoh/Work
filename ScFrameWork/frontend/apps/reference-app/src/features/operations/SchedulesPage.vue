<template>
  <section class="sc-stack">
    <sc-page-header :title="t('schedules')" />
    <operations-navigation />
    <operations-gate :allowed="access.scheduler.value">
      <p v-if="!valid" role="alert">{{ t("invalid") }}</p>
      <div class="sc-actions">
        <sc-action-button variant="outlined" :disabled="busy" @click="selectSchedule(null)">
          {{ t("newSchedule") }}
        </sc-action-button>
        <sc-action-button
          variant="text"
          :busy="query.isFetching.value"
          :busy-label="t('processing')"
          @click="reloadSchedule"
        >
          {{ t("refresh") }}
        </sc-action-button>
      </div>
      <v-alert v-if="commandError" role="alert" type="error">{{ commandError }}</v-alert>
      <v-alert v-if="conflict" role="alert" type="warning">{{ t("conflict") }}</v-alert>
      <p v-if="successMessage" role="status">{{ successMessage }}</p>
      <operations-table
        :rows="query.data.value?.items ?? []"
        :columns="scheduleColumns"
        :caption="t('scheduleList')"
        :get-row-key="scheduleKey"
        :page="page ?? 0"
        :total="query.data.value?.total ?? 0"
        :loading="query.isFetching.value"
        :error="query.error.value?.message"
        @change-page="changePage"
        @retry="reloadSchedule"
      >
        <template #row-actions="{ row }">
          <sc-action-button
            variant="text"
            :disabled="busy"
            :aria-label="`${t('select')} · ${t('selectSchedule', { id: row.id })}`"
            @click="selectSchedule(row.id)"
          >
            {{ t("select") }}
          </sc-action-button>
        </template>
      </operations-table>
      <sc-section-card
        v-if="initialized"
        :title="selectedId === null ? t('newSchedule') : t('selectSchedule', { id: selectedId })"
      >
        <p v-if="jobs.isError.value" role="alert">
          {{ jobs.error.value?.message }}
          <sc-action-button variant="text" @click="jobs.refetch()">
            {{ t("retry") }}
          </sc-action-button>
        </p>
        <schedule-form
          :initial="formInitial"
          :reset-key="resetKey"
          :jobs="jobs.data.value?.items ?? []"
          :busy="busy"
          :readonly="!access.scheduler.value || jobs.isPending.value || jobs.isError.value"
          :server-errors="serverErrors"
          @save="saveSchedule"
          @dirty-change="dirty = $event"
        />
        <div v-if="selectedSchedule" class="sc-actions">
          <sc-action-button
            variant="outlined"
            :disabled="busy || dirty"
            @click="changeEnabled(selectedSchedule.enabled ? 'pause' : 'resume')"
          >
            {{ t(selectedSchedule.enabled ? "pause" : "resume") }}
          </sc-action-button>
        </div>
      </sc-section-card>
      <p v-else-if="selectedId !== null && !detail.isFetching.value" role="alert">
        {{ t("invalid") }}
      </p>
      <operations-table
        :rows="runs.data.value?.items ?? []"
        :columns="runColumns"
        :caption="selectedId === null ? t('runList') : t('runsSchedule', { id: selectedId })"
        :get-row-key="runKey"
        :page="runPage ?? 0"
        :total="runs.data.value?.total ?? 0"
        :loading="runs.isFetching.value"
        :error="runs.error.value?.message"
        @change-page="changeRunPage"
        @retry="runs.refetch()"
      />
      <sc-confirm-dialog
        :model-value="guard.open.value"
        :title="t('schedules')"
        :message="t(guard.message.value === 'reload' ? 'reloadDraft' : 'leaveDraft')"
        :confirm-label="t('confirm')"
        :cancel-label="t('cancel')"
        @confirm="guard.finish(true)"
        @update:model-value="closeGuard"
      />
    </operations-gate>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { ApiError } from "@sc/runtime";
import { createDateFormatter } from "@sc/date";
import { ScActionButton, ScConfirmDialog, ScPageHeader, ScSectionCard } from "@sc/ui";
import type { ScTableColumn } from "@sc/ui/table";
import { useReferenceRuntime } from "../../auth/identity";
import { useDraftGuard } from "../../shared/useDraftGuard";
import {
  createOperationsApi,
  operationKeys,
  type Schedule,
  type ScheduleInput,
  type RunPage,
} from "./api";
import { useOperationsAccess } from "./capabilities";
import { operationPage, operationSelection } from "./url";
import { operationMessages } from "./messages";
import OperationsNavigation from "./OperationsNavigation.vue";
import OperationsGate from "./OperationsGate.vue";
import OperationsTable from "./OperationsTable.vue";
import ScheduleForm from "./ScheduleForm.vue";
const runtime = useReferenceRuntime();
const api = createOperationsApi(runtime);
const access = useOperationsAccess();
const route = useRoute();
const { t, locale } = useI18n({ useScope: "local", messages: operationMessages });
const page = computed(() => operationPage(route.query));
const runPage = computed(() => operationPage(route.query, "runPage"));
const selectedId = computed(() => operationSelection(route.query, "id"));
const valid = computed(
  () => page.value !== null && runPage.value !== null && selectedId.value !== undefined,
);
const parameters = computed(() =>
  new URLSearchParams({ page: String(page.value ?? 0), size: "20" }).toString(),
);
const runParameters = computed(() => {
  const p = new URLSearchParams({ page: String(runPage.value ?? 0), size: "20" });
  if (selectedId.value) p.set("scheduleId", String(selectedId.value));
  return p.toString();
});
const query = useQuery({
  queryKey: computed(() => [...operationKeys.schedules, parameters.value]),
  queryFn: ({ queryKey, signal }) => api.schedules(queryKey[2]!, signal),
  enabled: computed(() => access.scheduler.value && valid.value),
});
const jobs = useQuery({
  queryKey: operationKeys.jobs,
  queryFn: ({ signal }) => api.registeredJobs(signal),
  enabled: access.scheduler,
});
const runs = useQuery({
  queryKey: computed(() => [...operationKeys.runs, runParameters.value]),
  queryFn: ({ queryKey, signal }) => api.runs(queryKey[2]!, signal),
  enabled: computed(() => access.scheduler.value && valid.value),
});
const detail = useQuery({
  queryKey: computed(() => [...operationKeys.scheduleDetails, selectedId.value] as const),
  queryFn: ({ queryKey, signal }) => api.schedule(queryKey[2]!, signal),
  enabled: computed(() => access.scheduler.value && valid.value && selectedId.value !== null),
});
const selectedSchedule = computed(() => detail.data.value);
const resetKey = ref(0);
const initialized = ref(false);
const dirty = ref(false);
const busy = ref(false);
// 서버 Query의 복제 저장소가 아니라 명시적 폼 초기화에만 쓰는 입력 기준이다.
const formInitial = shallowRef<Schedule | null>(null);
const serverErrors = ref<Record<string, string>>({});
const commandError = ref("");
const conflict = ref(false);
const successMessage = ref("");
let epoch = 0;
const guard = useDraftGuard(
  computed(() => dirty.value),
  (to, from) => to.query.id === from.query.id && to.query.page === from.query.page,
);
watch(
  [selectedId, page],
  () => {
    epoch++;
    initialized.value = false;
    commandError.value = "";
    conflict.value = false;
    successMessage.value = "";
    serverErrors.value = {};
    dirty.value = false;
  },
  { immediate: true },
);
watch(
  [selectedSchedule, selectedId, () => detail.isSuccess.value],
  () => {
    if (initialized.value || !valid.value) return;
    if (selectedId.value === null || (detail.isSuccess.value && selectedSchedule.value)) {
      formInitial.value = selectedSchedule.value ?? null;
      resetKey.value++;
      initialized.value = true;
    }
  },
  { immediate: true },
);
const formatter = computed(() =>
  createDateFormatter({ locale: locale.value === "en" ? "en" : "ko", timeZone: "Asia/Seoul" }),
);
const scheduleColumns = computed<readonly ScTableColumn<Schedule>[]>(() => [
  { id: "id", label: "ID", value: (row) => row.id },
  { id: "job", label: t("job"), value: (row) => row.jobCode },
  { id: "cron", label: t("cron"), value: (row) => row.cron },
  { id: "zone", label: t("timeZone"), value: (row) => row.timeZone },
  {
    id: "misfire",
    label: t("misfire"),
    value: (row) => t(row.misfirePolicy === "SKIP" ? "skip" : "fireOnce"),
  },
  {
    id: "enabled",
    label: t("enabled"),
    value: (row) => t(row.enabled ? "enabledYes" : "enabledNo"),
  },
  { id: "revision", label: t("revision"), value: (row) => row.revision },
  {
    id: "next",
    label: t("nextFire"),
    value: (row) => formatter.value.formatTimestamp(row.nextFireAt),
  },
]);
type Run = RunPage["items"][number];
const runColumns = computed<readonly ScTableColumn<Run>[]>(() => [
  { id: "id", label: "ID", value: (row) => row.id },
  { id: "job", label: t("job"), value: (row) => row.jobCode },
  { id: "state", label: t("state"), value: (row) => row.state },
  {
    id: "scheduled",
    label: t("scheduled"),
    value: (row) => formatter.value.formatTimestamp(row.scheduledAt),
  },
  {
    id: "started",
    label: t("started"),
    value: (row) => formatter.value.formatTimestamp(row.startedAt),
  },
  {
    id: "completed",
    label: t("completed"),
    value: (row) => formatter.value.formatTimestamp(row.completedAt),
  },
  { id: "reason", label: t("reason"), value: (row) => row.reasonCode },
]);
const scheduleKey = (row: Schedule) => String(row.id);
const runKey = (row: Run) => String(row.id);
function closeGuard(open: boolean) {
  if (!open) guard.finish(false);
}
async function selectSchedule(id: number | null) {
  await runtime.router.push({
    query: { ...route.query, id: id === null ? undefined : String(id), runPage: "0" },
  });
}
async function changePage(page: number) {
  await runtime.router.push({
    query: { ...route.query, page: String(page), id: undefined, runPage: "0" },
  });
}
async function changeRunPage(page: number) {
  await runtime.router.push({ query: { ...route.query, runPage: String(page) } });
}
function showFailure(cause: unknown) {
  commandError.value = cause instanceof Error ? cause.message : t("validation");
  if (cause instanceof ApiError) {
    serverErrors.value = cause.fields;
    if (cause.status === 409) conflict.value = true;
  }
}
async function reloadSchedule() {
  if (busy.value || !access.scheduler.value || (dirty.value && !(await guard.confirm("reload"))))
    return;
  const selectionEpoch = epoch;
  const result = selectedId.value === null ? await query.refetch() : await detail.refetch();
  if (selectionEpoch !== epoch) return;
  if (result.isError) {
    showFailure(result.error);
    return;
  }
  if (selectedId.value !== null && !selectedSchedule.value) {
    commandError.value = t("invalid");
    return;
  }
  commandError.value = "";
  conflict.value = false;
  serverErrors.value = {};
  formInitial.value = selectedSchedule.value ?? null;
  resetKey.value++;
  initialized.value = true;
}
async function saveSchedule(input: ScheduleInput, revision: number | null) {
  const id = selectedId.value;
  if (id === undefined || (id !== null && revision === null)) return;
  await runCommand(() =>
    id === null
      ? api.createSchedule(input)
      : api.saveSchedule(id, { ...input, revision: revision! }),
  );
}
async function changeEnabled(action: "pause" | "resume") {
  const row = formInitial.value;
  if (!row || dirty.value) return;
  await runCommand(() => api.changeSchedule(row.id, action, row.revision));
}
async function runCommand(action: () => Promise<Schedule>) {
  if (busy.value || !access.scheduler.value) return;
  const selectionEpoch = epoch;
  const generation = runtime.client.getGeneration();
  busy.value = true;
  commandError.value = "";
  serverErrors.value = {};
  successMessage.value = "";
  try {
    const saved = await action();
    if (generation !== runtime.client.getGeneration()) return;
    runtime.queryClient.setQueryData([...operationKeys.scheduleDetails, saved.id], saved);
    // 저장 결과의 기준은 이 입력을 제출한 선택에만 적용한다. 다른 예약 입력은 유지한다.
    runtime.queryClient.setQueriesData<import("./api").SchedulePage>(
      { queryKey: operationKeys.schedules },
      (current) =>
        current
          ? { ...current, items: current.items.map((row) => (row.id === saved.id ? saved : row)) }
          : current,
    );
    if (selectionEpoch === epoch) {
      if (selectedId.value === null) {
        dirty.value = false;
        await runtime.router.replace({
          query: { ...route.query, page: "0", id: String(saved.id) },
        });
      }
      formInitial.value = saved;
      conflict.value = false;
      commandError.value = "";
      serverErrors.value = {};
      resetKey.value++;
      initialized.value = true;
      successMessage.value = t("saved");
    }
    await runtime.queryClient.invalidateQueries({ queryKey: operationKeys.schedules });
    await runtime.queryClient.invalidateQueries({
      queryKey: [...operationKeys.scheduleDetails, saved.id],
    });
    await runtime.queryClient.invalidateQueries({ queryKey: operationKeys.runs });
  } catch (cause) {
    if (selectionEpoch === epoch && generation === runtime.client.getGeneration())
      showFailure(cause);
  } finally {
    busy.value = false;
  }
}
</script>

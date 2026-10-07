<template>
  <div class="sc-stack">
    <h2>{{ t("schedules") }}</h2>
    <p v-if="!valid" role="alert">{{ t("invalid") }}</p>
    <div class="sc-actions">
      <sc-action-button variant="outlined" :disabled="busy" @click="selectSchedule(null)">
        {{ t("new") }}
      </sc-action-button>
      <sc-action-button
        variant="text"
        :busy="query.isFetching.value"
        :busy-label="t('processing')"
        @click="reload"
      >
        {{ t("reload") }}
      </sc-action-button>
    </div>
    <v-alert v-if="error" role="alert" type="error">{{ error }}</v-alert>
    <v-alert v-if="conflict" role="alert" type="warning">{{ t("conflict") }}</v-alert>
    <operations-table
      :rows="query.data.value?.items ?? []"
      :columns="columns"
      :caption="t('schedules')"
      :get-row-key="rowKey"
      :page="page ?? 0"
      :total="query.data.value?.total ?? 0"
      :loading="query.isFetching.value"
      :error="query.error.value?.message"
      @change-page="changePage"
      @retry="reload"
    >
      <template #row-actions="{ row }">
        <sc-action-button
          variant="text"
          :disabled="busy"
          :aria-label="`${t('detail')} · ${t('edit', { id: row.id })}`"
          @click="selectSchedule(row.id)"
        >
          {{ t("detail") }}
        </sc-action-button>
      </template>
    </operations-table>
    <sc-section-card
      v-if="initialized"
      :title="selection === null ? t('new') : t('edit', { id: selection })"
    >
      <form novalidate class="sc-stack" :aria-label="t('form')" @submit.prevent="save">
        <sc-select
          v-model="jobCode"
          :label="t('job')"
          :options="jobOptions"
          :error-messages="form.errors.value.jobCode"
          :disabled="busy || jobs.isPending.value || jobs.isError.value"
          required
        />
        <sc-text-field
          v-model="cron"
          :label="t('cron')"
          :error-messages="form.errors.value.cron"
          :disabled="busy"
          :max-length="120"
          required
        />
        <sc-text-field
          v-model="timeZone"
          :label="t('zone')"
          :error-messages="form.errors.value.timeZone"
          :disabled="busy"
          :max-length="64"
          required
        />
        <sc-select
          v-model="misfirePolicy"
          :label="t('misfire')"
          :options="misfireOptions"
          :error-messages="form.errors.value.misfirePolicy"
          :disabled="busy"
          required
        />
        <sc-checkbox v-model="enabled" :label="t('enabled')" :disabled="busy" />
        <p v-if="basisRevision !== null">
          {{ t("revision") }}:
          <span data-testid="schedule-revision">{{ basisRevision }}</span>
        </p>
        <sc-form-actions
          :busy="busy"
          :busy-label="t('processing')"
          :disabled="jobs.isPending.value || jobs.isError.value"
          :show-cancel="false"
          :submit-label="t('save')"
        />
      </form>
      <p v-if="jobs.isError.value" role="alert">
        {{ jobs.error.value?.message }}
        <sc-action-button variant="text" @click="jobs.refetch()">{{ t("retry") }}</sc-action-button>
      </p>
      <sc-action-button
        v-if="selected"
        variant="outlined"
        :disabled="busy || dirty"
        @click="changeEnabled"
      >
        {{ t(selected.enabled ? "pause" : "resume") }}
      </sc-action-button>
    </sc-section-card>
    <operations-table
      :rows="runs.data.value?.items ?? []"
      :columns="runColumns"
      :caption="t('runs')"
      :get-row-key="runKey"
      :page="runPage ?? 0"
      :total="runs.data.value?.total ?? 0"
      :loading="runs.isFetching.value"
      :error="runs.error.value?.message"
      @change-page="changeRunPage"
      @retry="runs.refetch()"
    />
    <sc-confirm-dialog
      :model-value="confirmOpen"
      :title="t('schedules')"
      :message="t('discard')"
      :confirm-label="t('confirm')"
      :cancel-label="t('cancel')"
      @confirm="finishConfirmation(true)"
      @update:model-value="closeConfirmation"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from "vue-router";
import { useEventListener } from "@vueuse/core";
import { useQuery } from "@tanstack/vue-query";
import { useForm } from "vee-validate";
import { z } from "zod";
import { useI18n } from "vue-i18n";
import { ApiError, useFrameworkRuntime } from "@sc/runtime";
import { createDateFormatter } from "@sc/date";
import {
  ScActionButton,
  ScCheckbox,
  ScConfirmDialog,
  ScFormActions,
  ScSectionCard,
  ScSelect,
  ScTextField,
} from "@sc/ui";
import type { ScTableColumn } from "@sc/ui/table";
import {
  createOperationsApi,
  operationKeys,
  type Schedule,
  type RunPage,
  type SchedulePage,
} from "./api";
import { pageNumber, selectedId } from "./url";
import { messages } from "./messages";
import OperationsTable from "./OperationsTable.vue";
const runtime = useFrameworkRuntime();
const api = createOperationsApi(runtime);
const route = useRoute();
const { t, locale } = useI18n({ useScope: "local", messages });
const page = computed(() => pageNumber(route.query));
const runPage = computed(() => pageNumber(route.query, "runPage"));
const selection = computed(() => selectedId(route.query, "id"));
const valid = computed(
  () => page.value !== null && runPage.value !== null && selection.value !== undefined,
);
const parameters = computed(() =>
  new URLSearchParams({ page: String(page.value ?? 0), size: "20" }).toString(),
);
const runParameters = computed(() => {
  const p = new URLSearchParams({ page: String(runPage.value ?? 0), size: "20" });
  if (selection.value) p.set("scheduleId", String(selection.value));
  return p.toString();
});
const query = useQuery({
  queryKey: computed(() => [...operationKeys.schedules, parameters.value]),
  queryFn: ({ queryKey, signal }) => api.schedules(queryKey[2]!, signal),
  enabled: valid,
});
const jobs = useQuery({
  queryKey: operationKeys.jobs,
  queryFn: ({ signal }) => api.registeredJobs(signal),
});
const runs = useQuery({
  queryKey: computed(() => [...operationKeys.runs, runParameters.value]),
  queryFn: ({ queryKey, signal }) => api.runs(queryKey[2]!, signal),
  enabled: valid,
});
const detail = useQuery({
  queryKey: computed(() => [...operationKeys.scheduleDetails, selection.value] as const),
  queryFn: ({ queryKey, signal }) => api.schedule(queryKey[2]!, signal),
  enabled: computed(() => valid.value && selection.value !== null),
});
const selected = computed(() => detail.data.value);
const empty = () => ({
  jobCode: "",
  cron: "0 * * * * ?",
  timeZone: "UTC",
  misfirePolicy: "SKIP",
  enabled: true,
});
const form = useForm({ initialValues: empty() });
const [jobCode] = form.defineField("jobCode");
const [cron] = form.defineField("cron");
const [timeZone] = form.defineField("timeZone");
const [misfirePolicy] = form.defineField("misfirePolicy");
const [enabled] = form.defineField("enabled");
const dirty = computed(() => form.meta.value.dirty);
const basisRevision = ref<number | null>(null);
const initialized = ref(false);
const busy = ref(false);
const error = ref("");
const conflict = ref(false);
let epoch = 0;
const jobOptions = computed(() =>
  (jobs.data.value?.items ?? []).map((job) => ({
    value: job.jobCode,
    label: `${job.jobCode} · ${job.executionMode}`,
  })),
);
const misfireOptions = computed(() => [
  { value: "SKIP", label: t("skip") },
  { value: "FIRE_ONCE", label: t("once") },
]);
const schema = computed(() =>
  z.object({
    jobCode: z
      .string()
      .refine(
        (value) => jobs.data.value?.items.some((job) => job.jobCode === value) === true,
        t("invalid"),
      ),
    cron: z
      .string()
      .max(120)
      .refine((value) => {
        const fields = value.trim().split(/\s+/);
        return (
          value === value.trim() &&
          (fields.length === 6 || fields.length === 7) &&
          fields[0] === "0"
        );
      }, t("invalid")),
    timeZone: z
      .string()
      .min(1)
      .max(64)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value }).format();
          return true;
        } catch {
          return false;
        }
      }, t("invalid")),
    misfirePolicy: z.enum(["SKIP", "FIRE_ONCE"]),
    enabled: z.boolean(),
  }),
);
function initialize(row: Schedule | null) {
  form.resetForm({
    values: row
      ? {
          jobCode: row.jobCode,
          cron: row.cron,
          timeZone: row.timeZone,
          misfirePolicy: row.misfirePolicy,
          enabled: row.enabled,
        }
      : empty(),
  });
  basisRevision.value = row?.revision ?? null;
  initialized.value = true;
  conflict.value = false;
  error.value = "";
}
watch(
  [selection, page],
  () => {
    epoch++;
    initialized.value = false;
    error.value = "";
    conflict.value = false;
  },
  { immediate: true },
);
watch(
  [selected, selection, () => detail.isSuccess.value],
  () => {
    if (
      !initialized.value &&
      valid.value &&
      (selection.value === null || (detail.isSuccess.value && selected.value))
    )
      initialize(selected.value ?? null);
  },
  { immediate: true },
);
const confirmOpen = ref(false);
let resolveConfirmation: ((value: boolean) => void) | undefined;
function confirmDiscard() {
  if (!runtime.session.identity || !dirty.value) return Promise.resolve(true);
  if (resolveConfirmation) return Promise.resolve(false);
  confirmOpen.value = true;
  return new Promise<boolean>((resolve) => {
    resolveConfirmation = resolve;
  });
}
function finishConfirmation(allowed: boolean) {
  confirmOpen.value = false;
  const resolve = resolveConfirmation;
  resolveConfirmation = undefined;
  resolve?.(allowed);
}
function closeConfirmation(open: boolean) {
  if (!open) finishConfirmation(false);
}
onBeforeRouteLeave(confirmDiscard);
onBeforeRouteUpdate(
  (to, from) =>
    (to.query.id === from.query.id && to.query.page === from.query.page) || confirmDiscard(),
);
watch(
  () => runtime.session.identity,
  (identity) => {
    if (!identity) finishConfirmation(true);
  },
);
useEventListener(window, "beforeunload", (event) => {
  if (dirty.value && runtime.session.identity) {
    event.preventDefault();
    event.returnValue = "";
  }
});
onBeforeUnmount(() => finishConfirmation(false));
const formatter = computed(() =>
  createDateFormatter({ locale: locale.value === "en" ? "en" : "ko", timeZone: "UTC" }),
);
const columns = computed<readonly ScTableColumn<Schedule>[]>(() => [
  { id: "id", label: "ID", value: (row) => row.id },
  { id: "job", label: t("job"), value: (row) => row.jobCode },
  { id: "cron", label: t("cron"), value: (row) => row.cron },
  { id: "zone", label: t("zone"), value: (row) => row.timeZone },
  {
    id: "enabled",
    label: t("enabled"),
    value: (row) => t(row.enabled ? "enabledYes" : "enabledNo"),
  },
  { id: "revision", label: t("revision"), value: (row) => row.revision },
]);
type Run = RunPage["items"][number];
const runColumns = computed<readonly ScTableColumn<Run>[]>(() => [
  { id: "id", label: "ID", value: (row) => row.id },
  { id: "job", label: t("job"), value: (row) => row.jobCode },
  { id: "state", label: t("state"), value: (row) => row.state },
  {
    id: "started",
    label: t("created"),
    value: (row) => formatter.value.formatTimestamp(row.startedAt),
  },
]);
const rowKey = (row: Schedule) => String(row.id);
const runKey = (row: Run) => String(row.id);
async function selectSchedule(id: number | null) {
  await runtime.router.push({
    query: { ...route.query, id: id === null ? undefined : String(id), runPage: "0" },
  });
}
async function changePage(page: number) {
  await runtime.router.push({ query: { page: String(page) } });
}
async function changeRunPage(page: number) {
  await runtime.router.push({ query: { ...route.query, runPage: String(page) } });
}
function showFailure(cause: unknown) {
  error.value = cause instanceof Error ? cause.message : t("invalid");
  if (cause instanceof ApiError) {
    form.setErrors(cause.fields);
    if (cause.status === 409) conflict.value = true;
  }
}
async function reload() {
  if (busy.value || !(await confirmDiscard())) return;
  const selectionEpoch = epoch;
  const result = selection.value === null ? await query.refetch() : await detail.refetch();
  if (selectionEpoch !== epoch) return;
  if (result.isError) {
    showFailure(result.error);
    return;
  }
  if (selection.value !== null && !selected.value) {
    error.value = t("invalid");
    return;
  }
  initialize(selected.value ?? null);
}
async function save() {
  if (busy.value || jobs.isError.value || jobs.isPending.value) return;
  form.setErrors({
    jobCode: undefined,
    cron: undefined,
    timeZone: undefined,
    misfirePolicy: undefined,
  });
  const input = schema.value.safeParse(form.values);
  if (!input.success) {
    form.setErrors(
      Object.fromEntries(input.error.issues.map((issue) => [String(issue.path[0]), issue.message])),
    );
    return;
  }
  const id = selection.value;
  const revision = basisRevision.value;
  if (id === undefined || (id !== null && revision === null)) return;
  await command(() =>
    id === null
      ? api.createSchedule(input.data)
      : api.saveSchedule(id, { ...input.data, revision: revision! }),
  );
}
async function changeEnabled() {
  const row = selected.value;
  if (row && !dirty.value)
    await command(() => api.changeSchedule(row.id, row.enabled ? "pause" : "resume", row.revision));
}
async function command(action: () => Promise<Schedule>) {
  if (busy.value) return;
  const selectionEpoch = epoch;
  const generation = runtime.client.getGeneration();
  busy.value = true;
  error.value = "";
  try {
    const saved = await action();
    if (generation !== runtime.client.getGeneration()) return;
    runtime.queryClient.setQueryData([...operationKeys.scheduleDetails, saved.id], saved);
    runtime.queryClient.setQueriesData<SchedulePage>(
      { queryKey: operationKeys.schedules },
      (current) =>
        current
          ? { ...current, items: current.items.map((row) => (row.id === saved.id ? saved : row)) }
          : current,
    );
    if (selectionEpoch === epoch) {
      initialize(saved);
      if (selection.value === null) {
        await runtime.router.replace({
          query: { ...route.query, page: "0", id: String(saved.id) },
        });
        initialize(saved);
      }
    }
    await runtime.queryClient.invalidateQueries({ queryKey: operationKeys.schedules });
    await runtime.queryClient.invalidateQueries({
      queryKey: [...operationKeys.scheduleDetails, saved.id],
    });
    await runtime.queryClient.invalidateQueries({ queryKey: operationKeys.runs });
  } catch (cause) {
    if (generation === runtime.client.getGeneration() && selectionEpoch === epoch)
      showFailure(cause);
  } finally {
    busy.value = false;
  }
}
</script>

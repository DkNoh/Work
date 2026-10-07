<template>
  <div class="sc-stack">
    <h2>{{ t("messages") }}</h2>
    <form :aria-label="t('filters')" novalidate class="filters" @submit.prevent="applyFilters">
      <sc-select v-model="type" :label="t('type')" :options="typeOptions" />
      <sc-select v-model="state" :label="t('state')" :options="stateOptions" />
      <sc-action-button type="submit">{{ t("reload") }}</sc-action-button>
    </form>
    <p v-if="!valid" role="alert">{{ t("invalid") }}</p>
    <sc-action-button
      variant="outlined"
      :busy="busy"
      :busy-label="t('processing')"
      @click="publishDemo"
    >
      {{ t("demo") }}
    </sc-action-button>
    <v-alert v-if="error" type="error" role="alert">{{ error }}</v-alert>
    <operations-table
      :rows="query.data.value?.items ?? []"
      :columns="columns"
      :caption="t('messages')"
      :get-row-key="rowKey"
      :page="page ?? 0"
      :total="query.data.value?.total ?? 0"
      :loading="query.isFetching.value"
      :error="query.error.value?.message"
      @change-page="changePage"
      @retry="query.refetch()"
    >
      <template #row-actions="{ row }">
        <sc-action-button
          v-if="row.state === 'DEAD'"
          variant="outlined"
          :disabled="busy"
          :aria-label="`${t('retryDead')}: ${row.eventId}`"
          @click="target = row.eventId"
        >
          {{ t("retryDead") }}
        </sc-action-button>
      </template>
    </operations-table>
    <sc-confirm-dialog
      :model-value="target !== null"
      :title="t('retryDead')"
      :message="t('confirmRetry')"
      :busy="busy"
      :busy-label="t('processing')"
      :confirm-label="t('confirm')"
      :cancel-label="t('cancel')"
      @confirm="retryDead"
      @update:model-value="closeDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { useForm } from "vee-validate";
import { z } from "zod";
import { useI18n } from "vue-i18n";
import { useFrameworkRuntime } from "@sc/runtime";
import { createDateFormatter } from "@sc/date";
import { ScActionButton, ScConfirmDialog, ScSelect } from "@sc/ui";
import type { ScTableColumn } from "@sc/ui/table";
import { createOperationsApi, operationKeys, type MessageItem } from "./api";
import { pageNumber } from "./url";
import { messages } from "./messages";
import OperationsTable from "./OperationsTable.vue";
const runtime = useFrameworkRuntime();
const api = createOperationsApi(runtime);
const route = useRoute();
const { t, locale } = useI18n({ useScope: "local", messages });
const types = ["SECURITY_AUDIT", "FILE_DELETE", "MESSAGE_DEMO"] as const;
const states = ["PENDING", "CLAIMED", "PUBLISHED", "COMPLETED", "DEAD"] as const;
const schema = z.object({
  type: z.union([z.literal(""), z.enum(types)]),
  state: z.union([z.literal(""), z.enum(states)]),
});
const filters = computed(() =>
  schema.safeParse({ type: route.query.type ?? "", state: route.query.state ?? "" }),
);
const page = computed(() => pageNumber(route.query));
const valid = computed(() => filters.value.success && page.value !== null);
const parameters = computed(() => {
  const p = new URLSearchParams({ page: String(page.value ?? 0), size: "20" });
  if (filters.value.success) {
    if (filters.value.data.type) p.set("type", filters.value.data.type);
    if (filters.value.data.state) p.set("state", filters.value.data.state);
  }
  return p.toString();
});
const query = useQuery({
  queryKey: computed(() => [...operationKeys.messages, parameters.value]),
  queryFn: ({ queryKey, signal }) => api.messages(queryKey[2]!, signal),
  enabled: valid,
});
const form = useForm({ initialValues: { type: "", state: "" } });
const [type] = form.defineField("type");
const [state] = form.defineField("state");
watch(
  [() => route.query.type, () => route.query.state],
  () => {
    if (filters.value.success) form.resetForm({ values: filters.value.data });
  },
  { immediate: true },
);
const typeOptions = computed(() => [
  { value: "", label: "—" },
  ...types.map((value) => ({ value, label: value })),
]);
const stateOptions = computed(() => [
  { value: "", label: "—" },
  ...states.map((value) => ({ value, label: value })),
]);
const formatter = computed(() =>
  createDateFormatter({ locale: locale.value === "en" ? "en" : "ko", timeZone: "UTC" }),
);
const columns = computed<readonly ScTableColumn<MessageItem>[]>(() => [
  { id: "id", label: "ID", value: (row) => row.eventId },
  { id: "type", label: t("type"), value: (row) => row.type },
  { id: "state", label: t("state"), value: (row) => row.state },
  { id: "attempts", label: t("attempts"), value: (row) => row.dispatchAttempts },
  {
    id: "created",
    label: t("created"),
    value: (row) => formatter.value.formatTimestamp(row.createdAt),
  },
]);
const rowKey = (row: MessageItem) => row.eventId;
const busy = ref(false);
const target = ref<string | null>(null);
const error = ref("");
async function applyFilters() {
  const result = schema.safeParse(form.values);
  if (!result.success) return;
  await runtime.router.push({
    query: {
      ...(result.data.type ? { type: result.data.type } : {}),
      ...(result.data.state ? { state: result.data.state } : {}),
      page: "0",
    },
  });
}
async function changePage(page: number) {
  await runtime.router.push({ query: { ...route.query, page: String(page) } });
}
function closeDialog(open: boolean) {
  if (!open && !busy.value) target.value = null;
}
async function command(action: () => Promise<unknown>) {
  if (busy.value) return;
  const generation = runtime.client.getGeneration();
  busy.value = true;
  error.value = "";
  try {
    await action();
    if (generation !== runtime.client.getGeneration()) return;
    target.value = null;
    await runtime.queryClient.invalidateQueries({ queryKey: operationKeys.messages });
  } catch (cause) {
    if (generation === runtime.client.getGeneration())
      error.value = cause instanceof Error ? cause.message : t("invalid");
  } finally {
    busy.value = false;
  }
}
function retryDead() {
  const id = target.value;
  if (id) void command(() => api.retryMessage(id));
}
function publishDemo() {
  void command(() => api.demoMessage());
}
</script>

<style scoped>
.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  gap: var(--sc-space-4);
  align-items: start;
}
</style>

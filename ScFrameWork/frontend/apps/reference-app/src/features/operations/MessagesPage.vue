<template>
  <section class="sc-stack">
    <sc-page-header :title="t('messages')" />
    <operations-navigation />
    <operations-gate :allowed="access.messaging.value">
      <form
        :aria-label="t('messageFilters')"
        class="operation-filters"
        novalidate
        @submit.prevent="applyFilters"
      >
        <sc-select
          v-model="type"
          :label="t('type')"
          :options="typeOptions"
          :error-messages="form.errors.value.type"
        />
        <sc-select
          v-model="state"
          :label="t('state')"
          :options="stateOptions"
          :error-messages="form.errors.value.state"
        />
        <sc-action-button type="submit">{{ t("search") }}</sc-action-button>
      </form>
      <p v-if="!valid" role="alert">{{ t("invalid") }}</p>
      <div class="sc-actions">
        <sc-action-button
          variant="outlined"
          :busy="busy"
          :busy-label="t('processing')"
          @click="publishDemo"
        >
          {{ t("demo") }}
        </sc-action-button>
        <sc-action-button
          variant="text"
          :busy="query.isFetching.value"
          :busy-label="t('processing')"
          @click="query.refetch()"
        >
          {{ t("refresh") }}
        </sc-action-button>
      </div>
      <v-alert v-if="commandError" role="alert" type="error">{{ commandError }}</v-alert>
      <operations-table
        :rows="query.data.value?.items ?? []"
        :columns="columns"
        :caption="t('messageList')"
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
            @click="retryTarget = row.eventId"
          >
            {{ t("retryDead") }}
          </sc-action-button>
        </template>
      </operations-table>
      <sc-confirm-dialog
        :model-value="retryTarget !== null"
        :title="t('retryDead')"
        :message="t('confirmRetry')"
        :busy="busy"
        :busy-label="t('processing')"
        :confirm-label="t('confirm')"
        :cancel-label="t('cancel')"
        @update:model-value="closeRetry"
        @confirm="retryMessage"
      />
    </operations-gate>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { useForm } from "vee-validate";
import { z } from "zod";
import { useI18n } from "vue-i18n";
import { createDateFormatter } from "@sc/date";
import { ScActionButton, ScConfirmDialog, ScPageHeader, ScSelect } from "@sc/ui";
import type { ScTableColumn } from "@sc/ui/table";
import { useReferenceRuntime } from "../../auth/identity";
import { createOperationsApi, operationKeys, type MessageItem } from "./api";
import { useOperationsAccess } from "./capabilities";
import { operationPage } from "./url";
import { operationMessages } from "./messages";
import OperationsNavigation from "./OperationsNavigation.vue";
import OperationsGate from "./OperationsGate.vue";
import OperationsTable from "./OperationsTable.vue";
const runtime = useReferenceRuntime();
const api = createOperationsApi(runtime);
const access = useOperationsAccess();
const route = useRoute();
const { t, locale } = useI18n({ useScope: "local", messages: operationMessages });
const types = ["SECURITY_AUDIT", "FILE_DELETE", "MESSAGE_DEMO"] as const;
const states = ["PENDING", "CLAIMED", "PUBLISHED", "COMPLETED", "DEAD"] as const;
const schema = z.object({
  type: z.union([z.literal(""), z.enum(types)]),
  state: z.union([z.literal(""), z.enum(states)]),
});
const filters = computed(() =>
  schema.safeParse({ type: route.query.type ?? "", state: route.query.state ?? "" }),
);
const page = computed(() => operationPage(route.query));
const valid = computed(() => page.value !== null && filters.value.success);
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
  enabled: computed(() => access.messaging.value && valid.value),
});
const form = useForm<{ type: string; state: string }>({ initialValues: { type: "", state: "" } });
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
  { value: "", label: t("all") },
  ...types.map((value) => ({ value, label: value })),
]);
const stateOptions = computed(() => [
  { value: "", label: t("all") },
  ...states.map((value) => ({ value, label: value })),
]);
const formatter = computed(() =>
  createDateFormatter({ locale: locale.value === "en" ? "en" : "ko", timeZone: "Asia/Seoul" }),
);
const columns = computed<readonly ScTableColumn<MessageItem>[]>(() => [
  { id: "eventId", label: t("eventId"), value: (row) => row.eventId },
  { id: "type", label: t("type"), value: (row) => row.type },
  { id: "state", label: t("state"), value: (row) => row.state },
  { id: "attempts", label: t("attempts"), value: (row) => row.dispatchAttempts },
  {
    id: "created",
    label: t("created"),
    value: (row) => formatter.value.formatTimestamp(row.createdAt),
  },
  {
    id: "next",
    label: t("nextAttempt"),
    value: (row) => formatter.value.formatTimestamp(row.nextAttemptAt),
  },
  {
    id: "published",
    label: t("published"),
    value: (row) => formatter.value.formatTimestamp(row.publishedAt),
  },
  {
    id: "completed",
    label: t("completed"),
    value: (row) => formatter.value.formatTimestamp(row.completedAt),
  },
  { id: "reason", label: t("reason"), value: (row) => row.lastFailureCode },
]);
const rowKey = (row: MessageItem) => row.eventId;
const busy = ref(false);
const commandError = ref("");
const retryTarget = ref<string | null>(null);
async function applyFilters() {
  const result = schema.safeParse(form.values);
  if (!result.success) {
    form.setErrors({ type: t("invalid"), state: t("invalid") });
    return;
  }
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
function closeRetry(open: boolean) {
  if (!open && !busy.value) retryTarget.value = null;
}
async function command(action: () => Promise<unknown>) {
  if (busy.value || !access.messaging.value) return;
  busy.value = true;
  commandError.value = "";
  const generation = runtime.client.getGeneration();
  try {
    await action();
    if (generation !== runtime.client.getGeneration()) return;
    retryTarget.value = null;
    await runtime.queryClient.invalidateQueries({ queryKey: operationKeys.messages });
  } catch (cause) {
    if (generation === runtime.client.getGeneration())
      commandError.value = cause instanceof Error ? cause.message : t("invalid");
  } finally {
    busy.value = false;
  }
}
function retryMessage() {
  const id = retryTarget.value;
  if (id) void command(() => api.retryMessage(id));
}
function publishDemo() {
  void command(() => api.demoMessage());
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

<template>
  <form class="kanban-filters" :aria-label="t('kanban.apply')" @submit.prevent="apply">
    <sc-text-field v-model="q" :label="t('kanban.search')" :max-length="200" />
    <sc-select v-model="status" :label="t('kanban.status')" :options="statusOptions" />
    <sc-select v-model="priority" :label="t('kanban.priority')" :options="priorityOptions" />
    <sc-select v-model="assigneeId" :label="t('kanban.assignee')" :options="userOptions" />
    <sc-select v-model="view" :label="t('kanban.view')" :options="viewOptions" />
    <sc-select v-model="orderDraft" :label="t('kanban.order')" :options="orderOptions" />
    <div class="kanban-filter-actions">
      <sc-action-button type="submit">{{ t("kanban.apply") }}</sc-action-button>
      <sc-action-button variant="outlined" @click="emit('reset')">
        {{ t("kanban.reset") }}
      </sc-action-button>
    </div>
  </form>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ScTextField, ScSelect, ScActionButton } from "@sc/ui";
import type { KanbanFilters, KanbanUser } from "./api";
import { taskStatuses, taskPriorities } from "./schema";
import { kanbanMessages } from "./messages";
export type KanbanOrder = "position" | "createdDesc" | "createdAsc";
const props = defineProps<{
  filters: KanbanFilters;
  order: KanbanOrder;
  users: readonly KanbanUser[];
}>();
const emit = defineEmits<{
  apply: [
    filters: {
      q: string;
      status: string;
      priority: string;
      assigneeId: string;
      view: string;
      order: string;
    },
  ];
  reset: [];
}>();
const { t } = useI18n({ useScope: "local", messages: kanbanMessages });
const q = ref("");
const status = ref<string | null>("");
const priority = ref<string | null>("");
const assigneeId = ref<string | null>("");
const view = ref<string | null>("ALL");
const orderDraft = ref<string | null>("position");
watch(
  () => [props.filters, props.order] as const,
  () => {
    q.value = props.filters.q;
    status.value = props.filters.status;
    priority.value = props.filters.priority;
    assigneeId.value = props.filters.assigneeId === null ? "" : String(props.filters.assigneeId);
    view.value = props.filters.view;
    orderDraft.value = props.order;
  },
  { immediate: true },
);
const all = computed(() => ({ value: "", label: t("kanban.all") }));
const statusOptions = computed(() => [
  all.value,
  ...taskStatuses.map((value) => ({ value, label: t(`kanban.${value}`) })),
]);
const priorityOptions = computed(() => [
  all.value,
  ...taskPriorities.map((value) => ({ value, label: t(`kanban.${value}`) })),
]);
const userOptions = computed(() => [
  all.value,
  ...props.users.map((user) => ({ value: String(user.id), label: user.displayName })),
]);
const viewOptions = computed(() => [
  { value: "ALL", label: t("kanban.all") },
  { value: "CREATED", label: t("kanban.created") },
  { value: "ASSIGNED", label: t("kanban.assigned") },
]);
const orderOptions = computed(() => [
  { value: "position", label: t("kanban.position") },
  { value: "createdDesc", label: t("kanban.newest") },
  { value: "createdAsc", label: t("kanban.oldest") },
]);
function apply() {
  emit("apply", {
    q: q.value,
    status: status.value ?? "",
    priority: priority.value ?? "",
    assigneeId: assigneeId.value ?? "",
    view: view.value ?? "ALL",
    order: orderDraft.value ?? "position",
  });
}
</script>
<style scoped>
.kanban-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: var(--sc-space-4);
}
.kanban-filter-actions {
  grid-column: 1/-1;
  display: flex;
  gap: var(--sc-space-2);
  flex-wrap: wrap;
}
</style>

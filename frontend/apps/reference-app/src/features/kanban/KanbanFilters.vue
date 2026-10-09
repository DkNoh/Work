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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 필터의 v-model은 이 자식의 미적용 입력이다. 적용/초기화 이벤트를 부모에게 보내며 직접 Query/API를 호출하지 않는다.
 */

// 칸반 조회 조건 편집기다. props는 적용된 Router 조건, ref는 제출 전 초안, computed는 언어별 선택 옵션을 맡는다.
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ScTextField, ScSelect, ScActionButton } from "@sc/ui";
import type { KanbanFilters, KanbanUser } from "./api";
import { taskStatuses, taskPriorities } from "./schema";
import { kanbanMessages } from "./messages";
// 리터럴 union은 세 가지 화면 정렬 문자열만 허용하는 TS 타입이다. 수동 순서와 날짜 정렬의 실제 동작은 부모가 결정한다.
export type KanbanOrder = "position" | "createdDesc" | "createdAsc";
// 부모 props는 읽기 전용이다. watch에서 별도 로컬 ref로 복사하고 입력 변경을 props에 직접 대입하지 않는다.
const props = defineProps<{
  filters: KanbanFilters;
  order: KanbanOrder;
  users: readonly KanbanUser[];
}>();
// 이벤트 인수 튜플로 부모 @apply에 전달할 필터 객체를 정의한다. reset의 []는 인수 없는 이벤트를 뜻한다.
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
// 적용 조건이 바뀌면 미적용 입력을 새 조건에 맞춘다. 즉시 실행 옵션은 컴포넌트 생성 직후에도 초기값을 맞춘다.
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
// nullable Select 값을 빈 문자열/기본값으로 정리해 부모에게 보낸다. 부모 applyFilters가 Router를 바꾸고 Query 조회를 유도한다.
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

<template>
  <section class="sc-content sc-stack">
    <sc-page-header :title="t('kanban.title')">
      <template #actions>
        <sc-action-button
          v-if="queries.access.data.value?.allowed"
          :disabled="busy"
          @click="openTask(null)"
        >
          {{ t("kanban.newTask") }}
        </sc-action-button>
      </template>
    </sc-page-header>
    <p v-if="queries.access.isPending.value" role="status">{{ t("kanban.loading") }}</p>
    <p v-if="queries.access.data.value?.allowed === false" role="alert">{{ t("kanban.denied") }}</p>
    <div v-if="error || queryError" role="alert">
      <p>{{ error || queryError }}</p>
      <sc-action-button :disabled="busy" @click="reloadLists">
        {{ t("kanban.retry") }}
      </sc-action-button>
    </div>
    <p v-if="!valid" role="alert">{{ t("kanban.error") }}: URL</p>
    <template v-if="queries.access.data.value?.allowed && valid">
      <sc-section-card :title="t('kanban.board')">
        <boards-panel
          :boards="queries.boards.data.value ?? []"
          :board-id="filters.boardId"
          :busy="busy"
          @select="selectBoard"
          @create="createBoard"
          @rename="renameBoard"
        />
      </sc-section-card>
      <sc-section-card :title="t('kanban.apply')">
        <kanban-filters
          :filters="filters"
          :order="order"
          :users="queries.users.data.value ?? []"
          @apply="applyFilters"
          @reset="resetFilters"
        />
      </sc-section-card>
      <p v-if="!manualOrder">{{ t("kanban.moveHint") }}</p>
      <sc-sortable-board
        :label="t('kanban.title')"
        :columns="columns"
        :get-item-key="taskKey"
        :get-item-label="taskLabel"
        :is-item-movable="canMove"
        :disabled="busy"
        :loading="queries.tasks.isFetching.value"
        :labels="locale === 'en' ? englishBoardLabels : undefined"
        @move="moveTask"
      >
        <template #item="{ item }">
          <p>{{ item.description }}</p>
          <p>
            {{ t("kanban.priority") }}: {{ t(`kanban.${item.priority}`) }} ·
            {{ t("kanban.assignee") }}: {{ item.assigneeName ?? "—" }}
          </p>
          <p>{{ t("kanban.date") }}: {{ formatter.formatCalendarDate(item.dueDate) }}</p>
          <p>{{ t("kanban.author") }}: {{ item.authorName }}</p>
          <sc-action-button
            variant="outlined"
            :disabled="busy"
            :aria-label="`${item.title}: ${t('kanban.edit')}`"
            @click="openTask(item.id)"
          >
            {{ t("kanban.edit") }}
          </sc-action-button>
        </template>
      </sc-sortable-board>
      <sc-section-card v-if="showForm" :title="basis?.title ?? t('kanban.newTask')">
        <div class="sc-stack">
          <p v-if="selectedId !== null && !initialized" role="status">{{ t("kanban.loading") }}</p>
          <p v-if="conflict" role="alert">{{ t("kanban.conflict") }}</p>
          <p v-if="basis">
            {{ t("kanban.revision") }}: {{ basis.revision }} ·
            {{ formatter.formatTimestamp(basis.updatedAt) }}
          </p>
          <div class="sc-actions">
            <sc-action-button v-if="selectedId !== null" :disabled="busy" @click="reloadTask">
              {{ t("kanban.reload") }}
            </sc-action-button>
            <sc-action-button
              v-if="basis && canEdit"
              :disabled="busy"
              color="error"
              @click="askDelete"
            >
              {{ t("kanban.remove") }}
            </sc-action-button>
          </div>
          <task-form
            :initial="basis"
            :reset-key="resetKey"
            :users="queries.users.data.value ?? []"
            :busy="busy || (selectedId !== null && !initialized)"
            :readonly="!canEdit"
            :server-errors="fields"
            @save="saveTask"
            @dirty-change="formDirty = $event"
          />
        </div>
      </sc-section-card>
      <task-workbook
        :board-id="filters.boardId"
        :tasks="queries.tasks.data.value ?? []"
        @applied="invalidate"
        @dirty-change="workbookDirty = $event"
      />
      <kanban-members
        v-if="runtime.session.identity?.role === 'ADMIN'"
        :members="queries.members.data.value ?? []"
        :busy="busy"
        @change="changeMember"
      />
      <p role="status">{{ success }}</p>
    </template>
    <sc-confirm-dialog
      v-model="confirmationOpen"
      :title="t('kanban.confirmTitle')"
      :message="t(confirmationKind === 'delete' ? 'kanban.deleteMessage' : 'kanban.leave')"
      :confirm-label="t('kanban.continue')"
      :cancel-label="t('kanban.cancel')"
      :busy="confirmationKind === 'delete' && busy"
      @confirm="finishConfirmation(true)"
      @cancel="finishConfirmation(false)"
    />
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRoute,
  useRouter,
  type LocationQuery,
} from "vue-router";
import { useI18n } from "vue-i18n";
import { useEventListener } from "@vueuse/core";
import { ApiError } from "@sc/runtime";
import { createDateFormatter } from "@sc/date";
import { ScActionButton, ScPageHeader, ScSectionCard, ScConfirmDialog } from "@sc/ui";
import {
  ScSortableBoard,
  type ScBoardColumn,
  type ScBoardMove,
  type ScBoardLabels,
} from "@sc/ui/board";
import { useReferenceRuntime } from "../../auth/identity";
import {
  createKanbanApi,
  type Task,
  type TaskCreateInput,
  type Board,
  type KanbanFilters as Filters,
} from "./api";
import { kanbanKeys, useKanbanQueries } from "./query";
import { taskStatuses, taskPriorities } from "./schema";
import { kanbanMessages } from "./messages";
import KanbanFilters, { type KanbanOrder } from "./KanbanFilters.vue";
import BoardsPanel from "./BoardsPanel.vue";
import TaskForm from "./TaskForm.vue";
import TaskWorkbook from "./TaskWorkbook.vue";
import KanbanMembers from "./KanbanMembers.vue";
const runtime = useReferenceRuntime();
const api = createKanbanApi(runtime);
const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n({ useScope: "local", messages: kanbanMessages });
function single(query: LocationQuery, key: string, fallback = "") {
  const value = query[key];
  return value === undefined ? fallback : typeof value === "string" ? value : "!invalid!";
}
function positive(value: string) {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}
const filters = computed<Filters>(() => ({
  boardId: positive(single(route.query, "boardId", "1")) ?? 0,
  q: single(route.query, "q"),
  status: single(route.query, "status"),
  priority: single(route.query, "priority"),
  assigneeId: single(route.query, "assigneeId")
    ? positive(single(route.query, "assigneeId"))
    : null,
  view:
    single(route.query, "view", "ALL") === "CREATED"
      ? "CREATED"
      : single(route.query, "view", "ALL") === "ASSIGNED"
        ? "ASSIGNED"
        : "ALL",
}));
const selectedId = computed(() => positive(single(route.query, "taskId")));
const showForm = computed(
  () => selectedId.value !== null || single(route.query, "taskId") === "new",
);
const order = computed<KanbanOrder>(() =>
  single(route.query, "order", "position") === "createdDesc"
    ? "createdDesc"
    : single(route.query, "order", "position") === "createdAsc"
      ? "createdAsc"
      : "position",
);
const valid = computed(
  () =>
    filters.value.boardId > 0 &&
    filters.value.q.length <= 200 &&
    (!filters.value.status || taskStatuses.some((value) => value === filters.value.status)) &&
    (!filters.value.priority || taskPriorities.some((value) => value === filters.value.priority)) &&
    (!single(route.query, "assigneeId") || filters.value.assigneeId !== null) &&
    ["ALL", "CREATED", "ASSIGNED"].includes(single(route.query, "view", "ALL")) &&
    ["position", "createdDesc", "createdAsc"].includes(single(route.query, "order", "position")) &&
    (!single(route.query, "taskId") ||
      single(route.query, "taskId") === "new" ||
      selectedId.value !== null),
);
const queries = useKanbanQueries(filters, selectedId, valid);
const busy = ref(false);
const error = ref("");
const success = ref("");
const fields = ref<Record<string, string>>({});
const conflict = ref(false);
const basis = shallowRef<Task | null>(null);
const initialized = ref(false);
const resetKey = ref(0);
const formDirty = ref(false);
const workbookDirty = ref(false);
let selectionEpoch = 0;
let active = true;
const dirty = computed(
  () => !!runtime.session.identity && (formDirty.value || workbookDirty.value),
);
const queryError = computed(
  () =>
    [
      queries.access.error.value,
      queries.boards.error.value,
      queries.tasks.error.value,
      queries.detail.error.value,
      queries.users.error.value,
      queries.members.error.value,
    ].find(Boolean)?.message ?? "",
);
const formatter = computed(() =>
  createDateFormatter({ locale: locale.value === "en" ? "en" : "ko", timeZone: "Asia/Seoul" }),
);
const canEdit = computed(
  () => selectedId.value === null || basis.value?.authorId === runtime.session.identity?.id,
);
const manualOrder = computed(
  () =>
    order.value === "position" &&
    !filters.value.q &&
    !filters.value.status &&
    !filters.value.priority &&
    filters.value.assigneeId === null &&
    filters.value.view === "ALL",
);
const columns = computed<readonly ScBoardColumn<Task>[]>(() =>
  taskStatuses.map((status) => {
    const items = (queries.tasks.data.value ?? []).filter((task) => task.status === status);
    if (order.value !== "position")
      items.sort((a, b) => {
        const delta = Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id;
        return order.value === "createdDesc" ? -delta : delta;
      });
    return { id: status, label: t(`kanban.${status}`), items };
  }),
);
const taskKey = (task: Task) => String(task.id);
const taskLabel = (task: Task) => task.title;
function canMove(task: Task) {
  return manualOrder.value && task.authorId === runtime.session.identity?.id;
}
const englishBoardLabels: ScBoardLabels = {
  loading: "Loading",
  empty: "No tasks.",
  retry: "Retry",
  move: "Move",
  up: "Up",
  down: "Down",
  destination: "Destination column",
  scroll: "Board scroll area",
  instructions:
    "Use Space or Enter to start; arrows to move; Escape to cancel. Separate move controls are also available.",
  started: "Move started",
  cancelled: "Move cancelled",
  requested: "Move requested",
};
function initialize(task: Task | null) {
  basis.value = task;
  initialized.value = true;
  resetKey.value++;
  formDirty.value = false;
  fields.value = {};
  conflict.value = false;
}
watch(
  () => [single(route.query, "taskId"), filters.value.boardId] as const,
  () => {
    selectionEpoch++;
    basis.value = null;
    initialized.value = selectedId.value === null;
    resetKey.value++;
    formDirty.value = false;
    fields.value = {};
    error.value = "";
    conflict.value = false;
  },
  { immediate: true },
);
watch(
  () => [queries.detail.data.value, selectedId.value, filters.value.boardId] as const,
  ([task]) => {
    if (!initialized.value && task?.id === selectedId.value) initialize(task);
  },
  { immediate: true },
);
watch(
  () => runtime.session.identity,
  (identity) => {
    if (!identity) {
      selectionEpoch++;
      finishConfirmation(true);
    }
  },
);
function failure(cause: unknown) {
  error.value = cause instanceof Error ? cause.message : t("kanban.error");
  if (cause instanceof ApiError) {
    fields.value = cause.fields;
    if (cause.status === 409) conflict.value = true;
  }
}
async function invalidate() {
  await runtime.queryClient.invalidateQueries({ queryKey: kanbanKeys.all });
}
async function command(action: () => Promise<unknown>) {
  if (busy.value) return;
  const epoch = selectionEpoch;
  busy.value = true;
  error.value = "";
  success.value = "";
  try {
    await action();
    if (active && runtime.session.identity) {
      if (epoch === selectionEpoch) success.value = t("kanban.saved");
      await invalidate();
    }
  } catch (cause) {
    if (active && runtime.session.identity && epoch === selectionEpoch) failure(cause);
  } finally {
    if (active) busy.value = false;
  }
}
let committedNavigation = false;
async function saveTask(input: TaskCreateInput) {
  if (busy.value || !canEdit.value) return;
  const epoch = selectionEpoch;
  const original = basis.value;
  const boardId = filters.value.boardId;
  await command(async () => {
    const saved = original
      ? await api.save(original.id, {
          ...input,
          revision: original.revision,
          boardId: original.boardId,
        })
      : await api.create({ ...input, boardId });
    if (active && epoch === selectionEpoch && runtime.session.identity) {
      initialize(saved);
      runtime.queryClient.setQueryData(kanbanKeys.detail(saved.id), saved);
      if (!original) {
        committedNavigation = true;
        try {
          await router.replace({
            path: "/kanban",
            query: { ...route.query, taskId: String(saved.id) },
          });
        } finally {
          committedNavigation = false;
        }
      }
    }
  });
}
async function moveTask(move: ScBoardMove) {
  const task = queries.tasks.data.value?.find((task) => String(task.id) === move.itemKey);
  if (!task || !canMove(task) || !taskStatuses.some((status) => status === move.toColumnId)) return;
  const status = taskStatuses.find((status) => status === move.toColumnId)!;
  const epoch = selectionEpoch;
  await command(async () => {
    const saved = await api.move(task.id, {
      status,
      beforeId: move.beforeKey === null ? null : Number(move.beforeKey),
      revision: task.revision,
    });
    if (epoch === selectionEpoch && saved.id === selectedId.value) {
      if (!formDirty.value) initialize(saved);
      else conflict.value = true;
    }
  });
}
async function reloadTask() {
  if (busy.value || selectedId.value === null) return;
  if (dirty.value && !(await confirm("leave"))) return;
  const epoch = selectionEpoch;
  busy.value = true;
  error.value = "";
  try {
    const result = await queries.detail.refetch();
    if (epoch !== selectionEpoch || !active) return;
    if (result.isError) failure(result.error);
    else if (result.data?.id === selectedId.value) initialize(result.data);
  } finally {
    if (active) busy.value = false;
  }
}
async function reloadLists() {
  if (busy.value) return;
  await Promise.all([
    queries.access.refetch(),
    queries.boards.refetch(),
    queries.tasks.refetch(),
    queries.users.refetch(),
  ]);
}
function openTask(id: number | null) {
  void router.push({
    path: "/kanban",
    query: { ...route.query, taskId: id === null ? "new" : String(id) },
  });
}
function selectBoard(id: number) {
  const query: LocationQuery = { ...route.query, boardId: String(id) };
  delete query.taskId;
  void router.push({ path: "/kanban", query });
}
function applyFilters(input: {
  q: string;
  status: string;
  priority: string;
  assigneeId: string;
  view: string;
  order: string;
}) {
  const query = { ...route.query };
  for (const [key, value] of Object.entries(input)) {
    if (value && value !== "ALL" && value !== "position") query[key] = value;
    else delete query[key];
  }
  void router.push({ path: "/kanban", query });
}
function resetFilters() {
  const query = { ...route.query };
  for (const key of ["q", "status", "priority", "assigneeId", "view", "order"]) delete query[key];
  void router.push({ path: "/kanban", query });
}
async function createBoard(title: string) {
  await command(async () => {
    const board = await api.createBoard(title);
    selectBoard(board.id);
  });
}
async function renameBoard(board: Board, title: string) {
  if (board.canRename) await command(() => api.renameBoard(board.id, title, board.revision));
}
async function changeMember(id: number, allowed: boolean) {
  await command(() => api.setMember(id, allowed));
}
const confirmationOpen = ref(false);
const confirmationKind = ref<"leave" | "delete">("leave");
let resolveConfirmation: ((value: boolean) => void) | null = null;
function confirm(kind: "leave" | "delete") {
  if (!runtime.session.identity) return Promise.resolve(true);
  if (resolveConfirmation) return Promise.resolve(false);
  confirmationKind.value = kind;
  confirmationOpen.value = true;
  return new Promise<boolean>((resolve) => {
    resolveConfirmation = resolve;
  });
}
function finishConfirmation(allowed: boolean) {
  confirmationOpen.value = false;
  const finish = resolveConfirmation;
  resolveConfirmation = null;
  finish?.(allowed);
}
async function askDelete() {
  if (!basis.value || !canEdit.value || busy.value || !(await confirm("delete"))) return;
  const selected = basis.value;
  const epoch = selectionEpoch;
  await command(async () => {
    await api.remove(selected.id, selected.revision);
    if (epoch === selectionEpoch) {
      formDirty.value = false;
      const query = { ...route.query };
      delete query.taskId;
      await router.replace({ path: "/kanban", query });
    }
  });
}
onBeforeRouteLeave(() => !dirty.value || !runtime.session.identity || confirm("leave"));
onBeforeRouteUpdate(
  (to, from) =>
    committedNavigation ||
    (to.query.taskId === from.query.taskId && to.query.boardId === from.query.boardId) ||
    !dirty.value ||
    !runtime.session.identity ||
    confirm("leave"),
);
useEventListener(window, "beforeunload", (event) => {
  if (dirty.value) {
    event.preventDefault();
    event.returnValue = "";
  }
});
onBeforeUnmount(() => {
  active = false;
  selectionEpoch++;
  finishConfirmation(false);
});
</script>

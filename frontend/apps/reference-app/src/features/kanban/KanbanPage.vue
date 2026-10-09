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
      <!-- columns/식별 함수는 아래로 전달하고 @move는 위로 받는다. #item 슬롯의 item은 현재 Task DTO라 업무 내용/버튼을 여기서 조립한다. -->
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
          <!-- initial/reset-key는 편집 기준, server-errors는 API 오류다. @save는 검증된 입력, @dirty-change는 이탈 경고용 입력 변경 여부다. -->
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
      <!-- Excel applied 이벤트는 가져오기 완료 후 Query 무효화로 이어진다. dirty-change는 아직 서버에 반영하지 않은 stage의 유무다. -->
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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 권한 조회 후 보드·조건·작업 칼럼·편집 폼·Excel을 조립한다. 공통 sortable board는 이동 이벤트만 올리고 업무 저장은 이 화면이 수행한다.
 */

// 칸반 기능의 조정자다. Router가 보드/작업 선택과 조회 조건을, Query가 서버 자료를, 자식 폼이 미저장 입력을 보유한다.
// 이 화면의 command는 UI 비동기 처리 묶음이며 DB 트랜잭션이 아니다. 서버 API가 권한·revision·원자적 변경을 책임진다.
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
// LocationQuery 값은 string뿐 아니라 배열/null도 가능하다. 단일 문자열이 아니면 invalid 표식으로 넘겨 URL 검증에 실패하게 한다.
function single(query: LocationQuery, key: string, fallback = "") {
  const value = query[key];
  return value === undefined ? fallback : typeof value === "string" ? value : "!invalid!";
}
function positive(value: string) {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}
// URL에서 계산한 API 조회 조건이다. computed<Filters> 제네릭은 결과 타입을 검사하며 원본은 계속 Router에 남는다.
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
// 직접 편집한 URL도 검증한다. 허용 상태/우선순위/정렬/ID를 통과한 경우에만 useKanbanQueries의 업무 조회가 활성화된다.
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
// shallowRef<Task|null>는 편집 시작 DTO/revision이다. Query 자동 재조회로 dirty 폼의 기준을 바꾸지 않고 명시적인 initialize에서만 교체한다.
const basis = shallowRef<Task | null>(null);
const initialized = ref(false);
const resetKey = ref(0);
const formDirty = ref(false);
const workbookDirty = ref(false);
let selectionEpoch = 0;
let active = true;
// 작업 폼과 Excel 미반영 미리보기 중 하나라도 남아 있으면 이탈 확인을 요청한다. 브라우저 화면 상태이며 HttpSession 속성이 아니다.
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
// 필터/날짜 정렬이 있으면 화면 일부의 위치를 전체 저장 순서로 해석할 수 없어 수동 이동을 막는다.
const manualOrder = computed(
  () =>
    order.value === "position" &&
    !filters.value.q &&
    !filters.value.status &&
    !filters.value.priority &&
    filters.value.assigneeId === null &&
    filters.value.view === "ALL",
);
// Task DTO를 상태별로 나눠 공통 보드 props를 계산한다. filter가 만든 새 배열을 정렬하므로 Query 원본 배열을 직접 sort하지 않는다.
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
// 수동 순서 화면이며 현재 사용자가 작성자인 작업만 이동 가능 표시한다. 서버가 move 요청의 실제 허용 여부를 다시 판단한다.
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
// 저장 성공/명시적 최신 조회/최초 상세로 폼 기준을 교체한다. resetKey로 자식 resetForm을 호출하고 dirty와 충돌 표시를 해제한다.
function initialize(task: Task | null) {
  basis.value = task;
  initialized.value = true;
  resetKey.value++;
  formDirty.value = false;
  fields.value = {};
  conflict.value = false;
}
// 선택 작업/보드가 바뀌면 epoch를 증가시키고 폼 기준을 비운다. 늦게 완료된 이전 작업 응답을 새 선택에 적용하지 않기 위함이다.
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
// catch의 unknown을 instanceof로 좁힌다. ApiError.fields는 자식 폼으로 전달하고 409는 입력을 보존한 채 충돌로 표시한다.
function failure(cause: unknown) {
  error.value = cause instanceof Error ? cause.message : t("kanban.error");
  if (cause instanceof ApiError) {
    fields.value = cause.fields;
    if (cause.status === 409) conflict.value = true;
  }
}
// kanban 접두사의 조회를 무효화한다. 저장 결과를 최신 서버 순서/권한/목록으로 다시 읽는 Query 동작이다.
async function invalidate() {
  await runtime.queryClient.invalidateQueries({ queryKey: kanbanKeys.all });
}
// 중복 명령 차단 → action Promise 실행 → 현재 세션/화면이면 성공 표시 및 Query 재조회 → 오류 처리 순서다.
// 선택 epoch가 다르면 이전 요청의 오류/성공 문구를 현재 폼에 붙이지 않는다.
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
// 신규 저장 뒤 서버 ID로 URL을 교체할 때만 이미 확정된 이동임을 표시한다. 일반 사용자의 이탈 확인을 전역으로 끄는 플래그가 아니다.
let committedNavigation = false;
// 자식 safeParse 결과에 보드 ID와 기존 revision을 붙인다. POST/PUT 성공 후 현재 선택이면 basis와 상세 Query를 갱신한다.
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
// 공통 @move의 itemKey/toColumnId/beforeKey를 서버의 task ID/status/beforeId로 변환한다.
// 저장 성공 후 선택한 작업의 폼이 clean이면 최신 기준으로 맞추고, dirty이면 입력을 유지하며 충돌을 표시한다.
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
// 입력 폐기 확인 후 상세 재조회가 실제 성공했을 때만 initialize한다. result.isError면 캐시가 있어도 최신 응답으로 쓰지 않는다.
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
// 접근권한/보드/목록/사용자 조회는 서로 독립이므로 Promise.all로 함께 재시도한다. 작업 폼은 직접 reset하지 않는다.
async function reloadLists() {
  if (busy.value) return;
  await Promise.all([
    queries.access.refetch(),
    queries.boards.refetch(),
    queries.tasks.refetch(),
    queries.users.refetch(),
  ]);
}
// 작업 선택은 URL taskId에 저장한다. null은 새 입력을 뜻하는 new 문자열로 기록하고 Router guard가 이탈 여부를 확인한다.
function openTask(id: number | null) {
  void router.push({
    path: "/kanban",
    query: { ...route.query, taskId: id === null ? "new" : String(id) },
  });
}
// 보드 변경은 이전 taskId를 제거한다. 보드 ID가 달라지면 Query key와 편집 기준 watch가 새 보드로 전환된다.
function selectBoard(id: number) {
  const query: LocationQuery = { ...route.query, boardId: String(id) };
  delete query.taskId;
  void router.push({ path: "/kanban", query });
}
// 자식 필터 이벤트를 Router query에 반영한다. 기본/빈 값은 URL에서 생략하고 나머지는 기존 조건과 합친다.
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
// 필터 관련 키만 지우고 선택 보드/작업 등 나머지 URL 값은 보존한다.
function resetFilters() {
  const query = { ...route.query };
  for (const key of ["q", "status", "priority", "assigneeId", "view", "order"]) delete query[key];
  void router.push({ path: "/kanban", query });
}
// 보드 POST 성공으로 받은 ID를 Router 선택에 적용한다. command가 뒤이어 서버 목록을 갱신한다.
async function createBoard(title: string) {
  await command(async () => {
    const board = await api.createBoard(title);
    selectBoard(board.id);
  });
}
// 보드 DTO의 canRename/revision을 사용한다. UI 허용 표시와 서버의 최종 revision/권한 검사는 별도다.
async function renameBoard(board: Board, title: string) {
  if (board.canRename) await command(() => api.renameBoard(board.id, title, board.revision));
}
// 자식 change 이벤트에서 받은 사용자 ID/허용 여부를 저장하고 command의 전체 칸반 무효화로 관련 옵션/권한을 갱신한다.
async function changeMember(id: number, allowed: boolean) {
  await command(() => api.setMember(id, allowed));
}
const confirmationOpen = ref(false);
const confirmationKind = ref<"leave" | "delete">("leave");
// Promise resolver를 보관해 모달의 confirm/cancel 이벤트를 기다린다. "leave" | "delete"는 두 문자열만 허용하는 union 타입이다.
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
// 삭제 확인이 true일 때 현재 basis의 revision으로 DELETE한다. 성공하면 dirty를 해제하고 URL에서 선택 taskId를 제거한다.
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
// 라우트 이탈/선택 변경은 미저장 폼과 Excel stage를 확인한다. 검색 조건만 바뀌는 이동과 저장 후 ID 확정 이동은 별도로 허용한다.
onBeforeRouteLeave(() => !dirty.value || !runtime.session.identity || confirm("leave"));
onBeforeRouteUpdate(
  (to, from) =>
    committedNavigation ||
    (to.query.taskId === from.query.taskId && to.query.boardId === from.query.boardId) ||
    !dirty.value ||
    !runtime.session.identity ||
    confirm("leave"),
);
// 탭 종료/새로고침은 Router 밖이므로 beforeunload로 경고한다. VueUse가 리스너의 생명주기를 관리한다.
useEventListener(window, "beforeunload", (event) => {
  if (dirty.value) {
    event.preventDefault();
    event.returnValue = "";
  }
});
// 제거 시 active/epoch로 늦은 응답을 무효화하고 남은 모달 Promise를 false로 완료한다.
onBeforeUnmount(() => {
  active = false;
  selectionEpoch++;
  finishConfirmation(false);
});
</script>

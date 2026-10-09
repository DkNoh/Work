<template>
  <div class="sc-stack">
    <sc-select
      :model-value="String(boardId)"
      :label="t('kanban.board')"
      :options="boards.map((board) => ({ value: String(board.id), label: board.title }))"
      :disabled="busy"
      @update:model-value="selectBoard"
    />
    <form class="board-editor" @submit.prevent="createBoard">
      <sc-text-field
        v-model="newTitle"
        :label="t('kanban.boardTitle')"
        :disabled="busy"
        :max-length="100"
        required
      />
      <sc-action-button type="submit" :busy="busy">{{ t("kanban.createBoard") }}</sc-action-button>
    </form>
    <form v-if="selected?.canRename" class="board-editor" @submit.prevent="renameBoard">
      <sc-text-field
        v-model="renameTitle"
        :label="t('kanban.boardTitle')"
        :disabled="busy"
        :max-length="100"
        required
      />
      <sc-action-button type="submit" :busy="busy">{{ t("kanban.renameBoard") }}</sc-action-button>
    </form>
  </div>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 보드 선택/추가/이름 변경 입력을 묶는다. 조회된 보드 props를 읽고 select/create/rename 이벤트를 부모에게 보낸다.
 */

// 보드 조작의 입력 전용 패널이다. 부모 KanbanPage가 HTTP 명령·Query 무효화·URL 선택 변경을 담당한다.
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ScTextField, ScSelect, ScActionButton } from "@sc/ui";
import type { Board } from "./api";
import { kanbanMessages } from "./messages";
const props = defineProps<{ boards: readonly Board[]; boardId: number; busy: boolean }>();
// rename은 선택한 Board DTO도 전달하므로 부모가 그 revision을 서버에 보내 동시 수정 충돌을 검사할 수 있다.
const emit = defineEmits<{
  select: [id: number];
  create: [title: string];
  rename: [board: Board, title: string];
}>();
const { t } = useI18n({ useScope: "local", messages: kanbanMessages });
const newTitle = ref("");
const renameTitle = ref("");
// 현재 선택은 props.boardId와 boards로 계산한다. 별도 선택 객체 상태를 만들지 않는다.
const selected = computed(() => props.boards.find((board) => board.id === props.boardId));
// 선택 ID 또는 서버 revision이 바뀌면 이름 입력을 해당 저장 상태로 맞춘다. 매 키 입력마다 props를 변경하지 않는다.
watch(
  () => [selected.value?.id, selected.value?.revision],
  () => {
    renameTitle.value = selected.value?.title ?? "";
  },
  { immediate: true },
);
// Select의 string|null을 양의 안전한 정수로 검사한 후 이벤트를 보낸다.
function selectBoard(value: string | null) {
  const id = Number(value);
  if (Number.isSafeInteger(id) && id > 0 && !props.busy) emit("select", id);
}
// 빈 제목/중복 조작만 여기서 차단한다. 실제 길이·권한·저장 검증은 서버 요청 경로에서 수행된다.
function createBoard() {
  if (!props.busy && newTitle.value.trim()) emit("create", newTitle.value);
}
// 서버가 내려준 canRename을 확인하고 Board와 새 제목을 부모로 전달한다. 서버 권한 검사와 revision 확인은 별도로 유지된다.
function renameBoard() {
  if (!props.busy && selected.value?.canRename && renameTitle.value.trim())
    emit("rename", selected.value, renameTitle.value);
}
</script>
<style scoped lang="scss">
@use "@sc/ui/tokens" with (
  $sc-emit-css: false
);

.board-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--sc-space-4);
}
.board-editor > * {
  min-width: 0;
}
@media (max-width: tokens.$sc-breakpoint-sm - 1px) {
  .board-editor {
    grid-template-columns: minmax(0, 1fr);
  }
  .board-editor > :last-child {
    justify-self: start;
  }
}
</style>
